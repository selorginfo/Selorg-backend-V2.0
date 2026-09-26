import mongoose from 'mongoose';
import { Order, IOrder } from './order.model';
import { WorldlinePayment } from '../payments/worldline-payment.model';
import { CustomerAddress } from '../addresses/addresses.model';
import { Product } from '../products/products.model';
import { PricingCoupon } from '../coupons/coupon.model';
import { CouponRedemption } from '../coupons/coupon-redemption.model';
import { calculatePricing, compareWithLegacy } from '../../services/pricing.service';
import * as cartService from '../cart/cart.service';
import { resolveStoreId } from '../store/store.repository';
import { DarkStore } from '../store/dark-store.model';
import { emitOrderStatus, emitOrderAssigned } from '../../services/realtime.service';
import { eventBus } from '../../events/eventBus';
import { EVENT_TYPES } from '../../events/eventTypes';
import { geocodeAddress } from '../../services/geocoding.service';
import { assertStockAllowsAsync } from '../products/products.stock';
import { buildPaymentMethodPresentation, buildEstimatedDeliveryMessage, inferInstrumentFieldsFromWorldline } from './paymentMethodDisplay';
import * as orderRepo from './order.repository';
import { CustomerUser } from '../auth/auth.model';
import { executeCancellation, canCustomerCancel } from './cancellation.service';
import { adminLabelForStage, deriveFulfillmentStage, type FulfillmentStage } from './order-lifecycle';
import { applyFulfillmentTransition } from './order-lifecycle.apply';
import { getOrCreateWallet, debitWalletForOrder, refundWalletForFailedOrderPayment, roundInr } from '../wallet/wallet.service';
import { logger } from '../../utils/logger';
import * as fulfillment from './fulfillment.service';
import {
  buildPricingLock,
  isPositivePrice,
  zeroPriceError,
  type PricingLine,
} from './order-pricing-guard';
import { runWithPlacementLock } from './order-placement-lock';

export { canCustomerCancel };

/** All orders route to Adyar darkstore only — same hardcoded constant as legacy. */
const ADYAR_STORE_ID = 'DS-Adyar-01';
const usePricingEngineForOrders = true;

/**
 * Cross-cutting order/payment lifecycle push notifications (legacy `notificationService.js`)
 * are NOT ported — that service is separate from the already-ported customer notification
 * inbox/preferences module and needs its own dedicated porting pass. Legacy itself treats
 * every notification call as non-blocking (wrapped in try/catch, errors swallowed) — a no-op
 * here preserves that same fire-and-forget contract without silently mis-behaving.
 */
function notifyOrderStatus(order: IOrder, status: string, opts?: Record<string, unknown>): void {
  void fulfillment.notifyCustomerOrderLifecycle(order, status, {
    actor: typeof opts?.actor === 'string' ? opts.actor : undefined,
    note: typeof opts?.note === 'string' ? opts.note : undefined,
  });
}
function notifyPaymentOutcome(order: IOrder, outcome: string, opts?: Record<string, unknown>): void {
  void fulfillment.notifyPaymentOutcome(order, outcome, {
    reason: typeof opts?.reason === 'string' ? opts.reason : undefined,
  });
}

async function runPostOrderIntegrations(
  userId: string,
  response: Record<string, unknown>,
  paymentStatus?: string,
  methodType?: string,
  totalBill?: number,
): Promise<void> {
  await fulfillment.runPostOrderIntegrations(userId, response, paymentStatus, methodType, totalBill);
}

function isGatewayPrepayment(resolvedMethodType?: string): boolean {
  return resolvedMethodType === 'card' || resolvedMethodType === 'upi' || resolvedMethodType === 'digital';
}

/** Indian mobile: 10 digits starting 6–9. Accepts a leading 0 or 91. */
function normalizeIndianMobile(value: unknown): string | null {
  const digits = String(value || '').replace(/\D/g, '');
  let mobile = digits;
  if (digits.length === 12 && digits.startsWith('91')) mobile = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) mobile = digits.slice(1);
  else if (digits.length !== 10) return null;
  return /^[6-9]\d{9}$/.test(mobile) ? mobile : null;
}

function isWalletCheckoutRequest(methodType?: string): boolean {
  const key = String(methodType || '').trim().toLowerCase();
  return key === 'wallet' || key === 'selorg_wallet';
}

function roundOrderMoney(amount: unknown): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

function buildDeliveryAddressString(address: Record<string, unknown> | null | undefined): string {
  if (!address || typeof address !== 'object') return '';
  return [address.line1, address.line2, address.landmark, address.city, address.state, address.pincode]
    .filter(Boolean)
    .map(String)
    .join(', ')
    .trim();
}

interface OrderItemLine {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantSize: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  image: string;
  itemStatus: string;
  substituteProductName: string;
}

/** Faithful port of legacy `formatOrderForApp` — response shape consumers depend on. */
function formatOrderForApp(o: Record<string, unknown> & { _worldlinePayment?: Record<string, unknown> | null }): Record<string, unknown> {
  const paymentPresentation = buildPaymentMethodPresentation(o as never, o._worldlinePayment || null);
  const paymentMethod = o.paymentMethod as Record<string, unknown> | undefined;
  const paymentMethodPayload = paymentMethod
    ? {
        id: o.paymentMethodId || '',
        type: paymentMethod.methodType || 'cash',
        last4: paymentMethod.last4,
        instrument: paymentMethod.instrument || paymentPresentation.instrument || '',
        displayLabel: paymentMethod.displayLabel || paymentPresentation.display || '',
        paymentMode: paymentMethod.paymentMode || '',
        display: paymentPresentation.display,
        detailDisplay: paymentPresentation.detailDisplay || paymentPresentation.display,
        lines: paymentPresentation.lines,
      }
    : {
        id: '',
        type: 'cash',
        display: 'Cash on Delivery',
        detailDisplay: 'Cash on Delivery',
        lines: [{ label: 'Cash on Delivery', amount: null }],
      };

  const items = (o.items as Array<Record<string, unknown>>) || [];
  const deliveryAddress = o.deliveryAddress as Record<string, unknown> | undefined;
  const walletDeduction = Number(o.walletDeduction) || 0;
  const totalBill = Number(o.totalBill) || 0;
  const methodType = paymentMethod?.methodType as string | undefined;

  const onlineAmountDue = (() => {
    if (walletDeduction > 0) {
      if (o.onlineAmountDue != null && Number(o.onlineAmountDue) >= 0) return Number(o.onlineAmountDue);
      return Math.max(0, roundOrderMoney(totalBill - walletDeduction));
    }
    if (isGatewayPrepayment(methodType)) return totalBill;
    return 0;
  })();

  const requiresOnlinePayment = (() => {
    if (!isGatewayPrepayment(methodType)) return false;
    if (o.paymentStatus === 'paid' || o.status === 'cancelled') return false;
    const due = walletDeduction > 0 ? (o.onlineAmountDue != null && Number(o.onlineAmountDue) >= 0 ? Number(o.onlineAmountDue) : Math.max(0, roundOrderMoney(totalBill - walletDeduction))) : totalBill;
    return due > 0 && o.paymentStatus === 'pending';
  })();

  return {
    id: String(o._id),
    orderNumber: o.orderNumber,
    items: items.map((it, index): OrderItemLine => ({
      id: String(it._id || `${it.productId || 'item'}-${index}`),
      productId: String(it.productId || ''),
      productName: (it.productName as string) || 'Item',
      variantId: (it.variantId as string) || '',
      variantSize: (it.variantSize as string) || '',
      quantity: it.quantity as number,
      price: it.price as number,
      originalPrice: it.originalPrice as number | undefined,
      image: (it.image as string) || '',
      itemStatus: (it.itemStatus as string) || 'pending',
      substituteProductName: (it.substituteProductName as string) || '',
    })),
    status: o.status,
    timeline: ((o.timeline as Array<Record<string, unknown>>) || []).map((t) => ({
      status: t.status,
      timestamp: t.timestamp,
      note: t.note || '',
      actor: t.actor || '',
      userId: t.userId || '',
    })),
    cancellationReason: o.cancellationReason || '',
    deliveryAddress: deliveryAddress
      ? {
          id: String(o.addressId || ''),
          address: [deliveryAddress.line1, deliveryAddress.line2].filter(Boolean).join(', '),
          line1: deliveryAddress.line1 || '',
          line2: deliveryAddress.line2 || '',
          city: deliveryAddress.city,
          state: deliveryAddress.state || '',
          pincode: deliveryAddress.pincode || '',
          landmark: deliveryAddress.landmark,
          latitude: deliveryAddress.latitude,
          longitude: deliveryAddress.longitude,
        }
      : {},
    deliveryNotes: o.deliveryNotes || '',
    customerName: o.customerName || '',
    customerPhone: o.customerPhone || '',
    deliveryMode: o.deliveryMode || 'express',
    deliverySlotId: o.deliverySlotId || '',
    deliverySlotLabel: o.deliverySlotLabel || '',
    scheduledWindowStart: o.scheduledWindowStart
      ? new Date(o.scheduledWindowStart as string).toISOString()
      : null,
    scheduledWindowEnd: o.scheduledWindowEnd
      ? new Date(o.scheduledWindowEnd as string).toISOString()
      : null,
    paymentMethod: paymentMethodPayload,
    paymentMethodDisplay: paymentPresentation.detailDisplay || paymentPresentation.display,
    estimatedDeliveryMessage: buildEstimatedDeliveryMessage(o as {
      status?: string;
      deliveryMode?: string;
      deliverySlotLabel?: string;
      scheduledWindowStart?: Date | string | null;
      scheduledWindowEnd?: Date | string | null;
      estimatedDelivery?: Date | string | null;
    }),
    itemTotal: o.itemTotal,
    adjustedTotal: o.adjustedTotal,
    totalTax: o.totalTax || 0,
    handlingCharge: o.handlingCharge,
    deliveryFee: o.deliveryFee,
    deliveryTip: o.deliveryTip || 0,
    discount: o.discount,
    couponCode: o.checkoutCouponCode || '',
    pricingSnapshot: o.pricingSnapshot || null,
    walletDeduction,
    onlineAmountDue,
    requiresOnlinePayment,
    totalBill: o.totalBill,
    createdAt: o.createdAt ? new Date(o.createdAt as string).toISOString() : null,
    estimatedDelivery: o.estimatedDelivery,
    deliveredAt: o.deliveredAt,
    deliveryOtp: o.deliveryOtp,
    otpVerified: o.otpVerified,
    refundId: o.refundId ? String(o.refundId) : null,
    refundStatus: o.refundStatus || 'none',
    refundAmount: o.refundAmount || 0,
    ratingScore: o.ratingScore,
    ratingComment: o.ratingComment || '',
    paymentStatus: o.paymentStatus || 'pending',
    storeId: o.storeId ? String(o.storeId) : null,
    riderId: o.riderId
      ? String(o.riderId)
      : (['accepted', 'picked_up', 'delivered'].includes(String(o.riderStage || '')) && o.pickerId
          ? String(o.pickerId)
          : null),
    offeredRiderId: o.offeredRiderId ? String(o.offeredRiderId) : null,
    offeredRiderName:
      String(o.riderStage || '') === 'offered' && (o.adminFulfillment as { riderName?: string } | undefined)?.riderName
        ? (o.adminFulfillment as { riderName?: string }).riderName
        : null,
    pickerId: o.pickerId ? String(o.pickerId) : null,
    hhdUserId: o.hhdUserId ? String(o.hhdUserId) : null,
    pickerAssignment: (o.adminFulfillment as { pickerName?: string } | undefined)?.pickerName
      ? { pickerName: (o.adminFulfillment as { pickerName?: string }).pickerName }
      : o.hhdUserId
        ? { pickerName: 'HSD Operator' }
        : undefined,
    assignee: (o.adminFulfillment as { pickerName?: string } | undefined)?.pickerName
      ? {
          id: o.hhdUserId ? String(o.hhdUserId) : null,
          name: (o.adminFulfillment as { pickerName?: string }).pickerName,
        }
      : o.hhdUserId
        ? { id: String(o.hhdUserId), name: 'HSD Operator' }
        : null,
    riderStage: o.riderStage || null,
    fulfillmentStage: (() => {
      const stage = deriveFulfillmentStage({
        status: String(o.status || ''),
        riderStage: (o.riderStage as string) || null,
        hhdUserId: o.hhdUserId,
        fulfillmentStage: (o.fulfillmentStage as string) || null,
        deliveryFailedAt: (o.deliveryFailedAt as Date | null) || null,
        otpVerified: o.otpVerified === true,
      });
      return stage;
    })(),
    fulfillmentLabel: adminLabelForStage(
      deriveFulfillmentStage({
        status: String(o.status || ''),
        riderStage: (o.riderStage as string) || null,
        hhdUserId: o.hhdUserId,
        fulfillmentStage: (o.fulfillmentStage as string) || null,
        deliveryFailedAt: (o.deliveryFailedAt as Date | null) || null,
        otpVerified: o.otpVerified === true,
      }),
    ),
    exceptionReason:
      (o.status === 'delivered' || o.fulfillmentStage === 'delivered' || o.riderStage === 'delivered') && o.otpVerified !== true
        ? (o.exceptionReason || 'NOT_DELIVERED')
        : (o.exceptionReason || null),
    hsdDeviceId: o.hsdDeviceId || null,
    hsdSessionId: o.hsdSessionId || null,
    pickerShiftId: o.pickerShiftId || null,
    bagScannedAt: o.bagScannedAt || null,
    rackedAt: o.rackedAt || null,
    pickerAcceptedAt: o.pickerAcceptedAt || null,
    deliveryType: o.deliveryType || 'standard',
    riderPayout: o.riderPayout || 0,
    bagCode: o.bagCode || null,
    offerHubKey: o.offerHubKey || null,
    dispatchBay: o.dispatchBay || null,
    acceptedAt: o.acceptedAt || null,
    pickedUpAt: o.pickedUpAt || null,
    offerExpiresAt: o.offerExpiresAt || null,
  };
}

export async function listOrders(userId: string, page = 1, limit = 20, status?: string) {
  const uid = new mongoose.Types.ObjectId(userId);
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  const skip = (Math.max(1, page) - 1) * limit;
  const [ordersSnapshot, total] = await Promise.all([orderRepo.listForUser(uid, query, skip, limit), orderRepo.countForUser(uid, query)]);
  await reconcileWorldlinePaymentsForOrderList(userId, ordersSnapshot as unknown as Array<Record<string, unknown>>);
  const orders = await orderRepo.listForUser(uid, query, skip, limit);
  return {
    data: orders.map((o) => formatOrderForApp(o as unknown as Record<string, unknown>)),
    pagination: { page: Math.max(1, page), limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function getOrderById(userId: string, orderId: string) {
  let order = await orderRepo.findOneForUserLean(orderId, userId);
  if (!order) return null;
  await reconcileOrderWithLatestWorldlinePayment(userId, order as unknown as Record<string, unknown>);
  order = await orderRepo.findOneForUserLean(orderId, userId);
  if (!order) return null;

  const worldlinePayment = await WorldlinePayment.findOne({ orderId: order._id, purpose: { $ne: 'wallet_topup' } })
    .sort({ createdAt: -1 })
    .lean();

  return formatOrderForApp({ ...order, _worldlinePayment: worldlinePayment || null } as unknown as Record<string, unknown>);
}

/**
 * Restore wallet funds taken for a partial-wallet order when online payment is voided.
 * Idempotent via `Order.walletRefundedAt` + the wallet ledger's unique reference index.
 */
async function refundWalletDeductionOnVoid(orderDoc: IOrder): Promise<{ skipped: true; reason: string } | { ok: true; credited: number; alreadyCredited: boolean } | { error: string }> {
  const deduction = roundOrderMoney(orderDoc?.walletDeduction);
  if (!(deduction > 0)) return { skipped: true, reason: 'no_deduction' };
  if (orderDoc.walletRefundedAt) return { skipped: true, reason: 'already_refunded' };

  const claimed = await Order.findOneAndUpdate(
    { _id: orderDoc._id, walletDeduction: { $gt: 0 }, walletRefundedAt: null },
    { $set: { walletRefundedAt: new Date() } },
    { new: true },
  );
  if (!claimed) return { skipped: true, reason: 'claim_failed' };

  try {
    const result = await refundWalletForFailedOrderPayment(claimed.userId, deduction, claimed._id, {
      description: `Wallet restored for cancelled order ${claimed.orderNumber || claimed._id}`,
    });
    if ('error' in result) {
      // Allow a later retry to re-attempt the credit.
      await Order.updateOne({ _id: claimed._id }, { $set: { walletRefundedAt: null } });
      logger.warn('wallet void refund failed', { orderId: String(claimed._id), error: result.error });
      return { error: result.error };
    }
    return { ok: true, credited: 'credited' in result ? result.credited : 0, alreadyCredited: 'alreadyCredited' in result ? !!result.alreadyCredited : false };
  } catch (err) {
    await Order.updateOne({ _id: claimed._id }, { $set: { walletRefundedAt: null } });
    logger.warn('wallet void refund exception', { orderId: String(claimed._id), error: (err as Error)?.message });
    return { error: (err as Error)?.message || 'wallet refund failed' };
  }
}

/**
 * After verified online payment: coupon redemption, clear cart, ops integrations, notify.
 * Idempotent via `fulfillmentReleased` atomic claim — pure DB logic, no gateway call, so
 * faithfully portable even though the gateway integration itself is out of scope.
 */
export async function releaseOrderFulfillment(orderId: string): Promise<{ ok?: true; error?: string; skipped?: boolean; reason?: string }> {
  const order = await orderRepo.findById(orderId);
  if (!order) return { error: 'Order not found' };
  if (order.fulfillmentReleased !== false) return { skipped: true };
  if (order.status === 'cancelled') {
    return { skipped: true, reason: 'cancelled' };
  }
  const methodType = order.paymentMethod?.methodType;
  if (methodType !== 'card' && methodType !== 'upi' && methodType !== 'digital') {
    return { error: 'Release only applies to online payment orders' };
  }
  if (order.paymentStatus !== 'paid') {
    return { error: 'Payment not confirmed' };
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (order.checkoutCouponCode) {
        const normalizedCode = String(order.checkoutCouponCode).trim().toUpperCase();
        const couponDoc = await PricingCoupon.findOne({ code: normalizedCode }).session(session);
        if (couponDoc) {
          const existingRedemption = await CouponRedemption.findOne({ couponId: couponDoc._id, userId: order.userId, orderId: order._id }).session(session);
          if (!existingRedemption) {
            await CouponRedemption.create([{ couponId: couponDoc._id, userId: order.userId, orderId: order._id, discountApplied: order.discount || 0 }], { session });
            await PricingCoupon.updateOne({ _id: couponDoc._id }, { $inc: { usageCount: 1 } }, { session });
          }
        }
      }
      await cartService.clearCart(String(order.userId), session);
    });
  } finally {
    await session.endSession();
  }

  await cartService.invalidateCartGetCache();

  const populated = await orderRepo.findByIdLean(String(order._id));
  const response = formatOrderForApp(populated as unknown as Record<string, unknown>);
  await runPostOrderIntegrations(String(order.userId), response, 'paid', methodType, order.totalBill);

  const claim = await Order.updateOne({ _id: order._id, fulfillmentReleased: false, status: { $ne: 'cancelled' } }, { $set: { fulfillmentReleased: true } });
  if (claim.modifiedCount === 1) {
    notifyPaymentOutcome(order, 'success');
  }
  return { ok: true };
}

/** Failed/cancelled online payment before fulfillment: cancel order and restore cart from order lines. */
export async function voidUnpaidOnlineOrder(userId: string, orderId: string, reason = '', outcome: 'failed' | 'cancelled' | 'timeout' = 'failed'): Promise<{ ok?: true; error?: string; skipped?: boolean }> {
  const order = await orderRepo.findOneForUserLean(orderId, new mongoose.Types.ObjectId(userId));
  if (!order) return { error: 'Order not found' };
  const methodType = order.paymentMethod?.methodType;
  if (methodType !== 'card' && methodType !== 'upi' && methodType !== 'digital') return { skipped: true };
  if (order.fulfillmentReleased === true) return { skipped: true };

  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, userId: new mongoose.Types.ObjectId(userId), status: { $ne: 'cancelled' }, fulfillmentReleased: { $ne: true }, paymentStatus: { $ne: 'paid' } },
    {
      $set: { status: 'cancelled', paymentStatus: 'failed', cancellationReason: reason || 'Payment failed or cancelled' },
      $push: { timeline: { status: 'cancelled', timestamp: new Date(), note: reason || 'Payment failed or cancelled', actor: 'system' } },
    },
    { new: true },
  );
  if (!claimed) return { ok: true, skipped: true };

  await refundWalletDeductionOnVoid(claimed);

  if (claimed.cartRestoredAt == null) {
    const restoreClaim = await Order.updateOne({ _id: claimed._id, cartRestoredAt: null }, { $set: { cartRestoredAt: new Date() } });
    if (restoreClaim.modifiedCount === 1) {
      await cartService.restoreCartFromOrder(userId, claimed.items as unknown as Array<Record<string, unknown>>);
    }
  }

  const validOutcome = (['failed', 'cancelled', 'timeout'] as const).includes(outcome) ? outcome : 'failed';
  notifyPaymentOutcome(claimed, validOutcome, { reason: reason || '' });
  return { ok: true };
}

/** Align `customer_orders` with verified state from `worldline_payments` (latest attempt). */
export async function reconcileOrderWithLatestWorldlinePayment(userId: string, orderLean: Record<string, unknown>): Promise<void> {
  if (!orderLean?._id) return;
  const paymentMethod = orderLean.paymentMethod as Record<string, unknown> | undefined;
  const methodType = paymentMethod?.methodType as string | undefined;
  if (!isGatewayPrepayment(methodType)) return;

  const orderId = String(orderLean._id);
  const latest = await WorldlinePayment.findOne({ orderId: new mongoose.Types.ObjectId(orderId), standaloneCheckout: { $ne: true } })
    .sort({ attemptNo: -1 })
    .lean();

  if (!latest) {
    const ttlMinutes = parseInt(process.env.PENDING_PAYMENT_TTL_MINUTES || '30', 10);
    const ageMs = Date.now() - new Date((orderLean.createdAt as string) || 0).getTime();
    if (orderLean.status === 'pending' && orderLean.paymentStatus !== 'paid' && orderLean.fulfillmentReleased === false && ageMs > ttlMinutes * 60 * 1000) {
      await voidUnpaidOnlineOrder(userId, orderId, 'Payment was not completed in time', 'timeout');
    }
    return;
  }

  const order = await orderRepo.findOneForUser(orderId, new mongoose.Types.ObjectId(userId));
  if (!order) return;
  if (!isGatewayPrepayment(order.paymentMethod?.methodType)) return;

  const verified = latest.verificationError === 'none';

  if (latest.status === 'success' && verified) {
    if (order.status === 'cancelled') return;
    if (order.paymentStatus !== 'paid' || !order.paymentMethod?.displayLabel) {
      order.paymentStatus = 'paid';
      const fields = inferInstrumentFieldsFromWorldline(latest as unknown as Record<string, unknown>);
      if (!order.paymentMethod) order.paymentMethod = { methodType: 'digital', instrument: '', displayLabel: '', paymentMode: '' };
      if (fields.instrument) order.paymentMethod.instrument = fields.instrument;
      if (fields.displayLabel) order.paymentMethod.displayLabel = fields.displayLabel;
      if (fields.paymentMode) order.paymentMethod.paymentMode = fields.paymentMode;
      await order.save();
    }
    await releaseOrderFulfillment(orderId);
    return;
  }

  // A failed or cancelled gateway attempt must not leave a successful order,
  // even when the hash could not be verified.
  if (latest.status === 'failed' || latest.status === 'cancelled') {
    if (order.fulfillmentReleased !== true && order.paymentStatus !== 'paid') {
      await voidUnpaidOnlineOrder(userId, orderId, latest.statusMessage || 'Payment failed', latest.status === 'cancelled' ? 'cancelled' : 'failed');
    }
    return;
  }

  if (!['success', 'failed', 'cancelled'].includes(latest.status)) {
    const sessionExpired = latest.sessionExpiresAt && new Date(latest.sessionExpiresAt).getTime() < Date.now();
    const attemptAgeMs = Date.now() - new Date((latest.createdAt as unknown as string) || (latest.updatedAt as unknown as string) || 0).getTime();
    const ttlMinutes = parseInt(process.env.PENDING_PAYMENT_TTL_MINUTES || '30', 10);
    const abandonedBeforeGateway = (latest.status === 'created' || latest.status === 'initiated') && (sessionExpired || (!latest.sessionExpiresAt && attemptAgeMs > ttlMinutes * 60 * 1000));
    const extremelyStale = attemptAgeMs > 24 * 60 * 60 * 1000;

    if ((abandonedBeforeGateway || extremelyStale) && order.status === 'pending' && order.paymentStatus !== 'paid' && order.fulfillmentReleased === false) {
      await WorldlinePayment.updateOne({ _id: latest._id, status: latest.status }, { $set: { status: 'failed', statusMessage: 'Payment session expired without completion', verificationSource: 'reconciliation' } });
      await voidUnpaidOnlineOrder(userId, orderId, 'Payment was not completed in time', 'timeout');
    }
    // One-time payment-timeout notification (legacy `maybeNotifyPaymentTimeout`) deferred with
    // the rest of notificationService — non-blocking in legacy, no functional loss.
  }
}

async function reconcileWorldlinePaymentsForOrderList(userId: string, ordersLean: Array<Record<string, unknown>>): Promise<void> {
  if (!ordersLean?.length) return;
  for (const o of ordersLean) {
    const paymentMethod = o.paymentMethod as Record<string, unknown> | undefined;
    if (!isGatewayPrepayment(paymentMethod?.methodType as string | undefined)) continue;
    await reconcileOrderWithLatestWorldlinePayment(userId, o);
  }
}

interface CreateOrderBody {
  items: Array<{ productId: string; variantId?: string; quantity?: number }>;
  addressId: string;
  paymentMethodId?: string;
  paymentMethodType?: string;
  couponCode?: string;
  deliveryTip?: number;
  deliveryNotes?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  deliverySlotOptionId?: string;
  deliveryMode?: 'express' | 'scheduled';
}

export async function createOrder(userId: string, body: CreateOrderBody): Promise<Record<string, unknown> | { error: string }> {
  const items = body?.items;
  if (!items || !Array.isArray(items) || items.length === 0) return { error: 'Items required' };
  return runWithPlacementLock(userId, () => placeOrderForUser(userId, body));
}

async function placeOrderForUser(userId: string, body: CreateOrderBody): Promise<Record<string, unknown> | { error: string }> {
  const { items, addressId, paymentMethodId, paymentMethodType, couponCode, deliveryTip } = body || {};
  if (!items || !Array.isArray(items) || items.length === 0) return { error: 'Items required' };

  const address = await CustomerAddress.findOne({ _id: addressId, userId }).lean();
  if (!address) return { error: 'Address not found' };

  const account = await CustomerUser.findById(userId).select('name phoneNumber').lean();
  const accountPhone = normalizeIndianMobile(account?.phoneNumber);
  const customerName = String(body.customerName || account?.name || '').trim();
  const requestedPhone = String(body.customerPhone || '').trim();
  // Receiver number is only sent when the order is for someone else. It must be a
  // valid Indian mobile, and it does not have to match the account's verified number.
  let customerPhone = accountPhone || '';
  if (requestedPhone) {
    const receiverPhone = normalizeIndianMobile(requestedPhone);
    if (!receiverPhone) {
      return { error: 'Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.' };
    }
    if (customerName.length < 2) {
      return { error: 'Receiver name is required when ordering for someone else.' };
    }
    customerPhone = receiverPhone;
  }

  const { resolveDeliverySlotOption } = await import('../delivery/delivery.service');
  const slotOptionId = String(body.deliverySlotOptionId || (body.deliveryMode === 'scheduled' ? '' : 'now')).trim() || 'now';
  const resolvedSlot = await resolveDeliverySlotOption(slotOptionId);
  if ('error' in resolvedSlot) return { error: resolvedSlot.error };

  const deliveryMode = resolvedSlot.mode;
  const deliverySlotId = resolvedSlot.slotId || '';
  const deliverySlotLabel =
    deliveryMode === 'scheduled'
      ? `${resolvedSlot.title}${resolvedSlot.sub ? ` (${resolvedSlot.sub})` : ''}`
      : 'Express';
  const scheduledWindowStart = resolvedSlot.windowStart ? new Date(resolvedSlot.windowStart) : null;
  const scheduledWindowEnd = resolvedSlot.windowEnd ? new Date(resolvedSlot.windowEnd) : null;

  let deliveryLatitude = address.latitude;
  let deliveryLongitude = address.longitude;
  if (deliveryLatitude == null || deliveryLongitude == null) {
    const geo = await geocodeAddress(buildDeliveryAddressString(address as unknown as Record<string, unknown>));
    if (geo) {
      deliveryLatitude = geo.latitude;
      deliveryLongitude = geo.longitude;
    }
  }

  let itemTotal = 0;
  let totalTax = 0;
  const orderItems: Array<Record<string, unknown>> = [];
  for (const line of items) {
    const product = await Product.findById(line.productId).lean();
    if (!product) return { error: `Product not found: ${line.productId}` };
    let price = product.price;
    let variantSize = '';
    if (product.variants && product.variants.length) {
      const v = product.variants.find((x) => String((x as { _id?: unknown })._id) === String(line.variantId)) || product.variants[0];
      price = v.price ?? product.price;
      variantSize = v.size || '';
    }
    const qty = Math.max(1, line.quantity || 1);
    if (!isPositivePrice(price)) return zeroPriceError(product.name);
    const stockCheck = await assertStockAllowsAsync(product as never, qty, 0, 'set');
    if (stockCheck.error) return { error: `${product.name || 'Product'}: ${stockCheck.error}` };

    const lineTotal = price * qty;
    const gstRate = product.gstRate || 0;
    const taxAmount = lineTotal * (gstRate / (100 + gstRate));
    itemTotal += lineTotal;
    totalTax += taxAmount;

    orderItems.push({
      productId: product._id,
      productName: product.name,
      variantId: line.variantId || '',
      variantSize,
      quantity: qty,
      price,
      originalPrice: product.originalPrice,
      hsnCode: product.hsnCode || '',
      gstRate,
      taxAmount,
      image: (product.images && product.images[0]) || '',
    });
  }

  let deliveryFee = 0;
  let handlingCharge = 0;
  let discount = 0;
  let totalBill = itemTotal + deliveryFee + handlingCharge - discount + (deliveryTip || 0);

  const resolvedMethodType = paymentMethodType || (paymentMethodId ? 'card' : 'cash');

  const checkoutCouponCode = couponCode ? String(couponCode).trim().toUpperCase() : '';
  let engineResult: Awaited<ReturnType<typeof calculatePricing>> | null = null;
  try {
    engineResult = await calculatePricing({
      userId,
      cartItems: orderItems.map((it) => ({ productId: String(it.productId), variantId: (it.variantId as string) || null, quantity: it.quantity as number, baseUnitPrice: it.price as number })),
      couponCode: couponCode || null,
      zone: address.city || null,
      paymentMethod: resolvedMethodType,
      mode: 'order',
    });
    compareWithLegacy({ itemTotal, totalBill }, engineResult?.totals || {});
  } catch {
    // Pricing-engine shadow execution is non-blocking, same as legacy.
  }

  if (usePricingEngineForOrders && engineResult?.totals) {
    const safeTotals = engineResult.totals;
    discount = Number(safeTotals.discount) || 0;
    deliveryFee = Number(safeTotals.deliveryFee) || 0;
    handlingCharge = Number(safeTotals.handlingCharge) || 0;
    totalBill = (Number(safeTotals.finalAmount) || 0) + (deliveryTip || 0);
  }

  const slaMinutes = Math.max(10, Number(process.env.DEFAULT_DELIVERY_SLA_MINUTES) || 30);
  const estimatedDelivery =
    deliveryMode === 'scheduled' && scheduledWindowEnd
      ? scheduledWindowEnd
      : new Date(Date.now() + slaMinutes * 60 * 1000);
  const etaMinutes =
    deliveryMode === 'scheduled' && scheduledWindowEnd
      ? Math.max(1, Math.round((scheduledWindowEnd.getTime() - Date.now()) / 60000))
      : slaMinutes;
  // Route order to nearest active darkstore whose service radius covers the delivery point.
  // Falls back to legacy Adyar constant only if lat/lng are unavailable (e.g. geocoding failed).
  let matchedStoreObjectId: mongoose.Types.ObjectId | null = null;
  if (deliveryLatitude != null && deliveryLongitude != null) {
    const nearest = await DarkStore.findOne({
      isActive: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [Number(deliveryLongitude), Number(deliveryLatitude)] },
          $maxDistance: Number(process.env.DELIVERY_ASSIGN_SEARCH_MAX_M) || 10000,
        },
      },
    }).lean();
    if (nearest) {
      const R = 6371;
      const dLat = ((nearest.location.coordinates[1] - Number(deliveryLatitude)) * Math.PI) / 180;
      const dLng = ((nearest.location.coordinates[0] - Number(deliveryLongitude)) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((Number(deliveryLatitude) * Math.PI) / 180) *
          Math.cos((nearest.location.coordinates[1] * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (distanceKm <= (nearest.serviceRadius || 5)) {
        matchedStoreObjectId = nearest._id as mongoose.Types.ObjectId;
      } else {
        return { error: 'Delivery address is outside our service area' };
      }
    } else {
      return { error: 'No serviceable store found near your location' };
    }
  } else {
    matchedStoreObjectId = await resolveStoreId(ADYAR_STORE_ID);
  }

  if (matchedStoreObjectId) {
    const { StoreInventory } = await import('../products/store-inventory.model');
    for (const line of orderItems) {
      const row = await StoreInventory.findOne({
        storeId: matchedStoreObjectId,
        productId: line.productId,
        isAvailable: true,
      }).select('quantity reservedQty').lean();
      if (!row) continue;
      const sellable = Math.max(0, Number(row.quantity || 0) - Number(row.reservedQty || 0));
      if (sellable < Number(line.quantity || 0)) {
        return { error: `${line.productName || 'This item'} is not available at the nearest store.` };
      }
    }
  }

  // --- Selorg Wallet checkout (full or partial) ---
  // Amounts are always computed server-side from live wallet balance + order total.
  let walletDeduction = 0;
  let onlineAmountDue = 0;
  let storedMethodType = resolvedMethodType;
  let storedPaymentMethodId = paymentMethodId || '';
  const walletCheckoutRequested = isWalletCheckoutRequest(resolvedMethodType);

  if (walletCheckoutRequested) {
    const wallet = await getOrCreateWallet(userId);
    if (!wallet.isActive) {
      return { error: 'Selorg Wallet is not available' };
    }
    const balance = roundInr(wallet.balance);
    if (!(balance > 0)) {
      return { error: 'Insufficient wallet balance. Please add money to your Selorg Wallet.' };
    }
    const bill = roundOrderMoney(totalBill);
    walletDeduction = roundOrderMoney(Math.min(balance, bill));
    onlineAmountDue = roundOrderMoney(bill - walletDeduction);
    if (onlineAmountDue <= 0) {
      storedMethodType = 'wallet';
      storedPaymentMethodId = 'selorg_wallet';
      onlineAmountDue = 0;
    } else {
      const minOnline = Number(process.env.WORLDLINE_MIN_AMOUNT_INR) || 1;
      if (onlineAmountDue < minOnline) {
        // Cannot open a Worldline session for a sub-minimum remainder.
        if (balance >= bill) {
          walletDeduction = bill;
          onlineAmountDue = 0;
          storedMethodType = 'wallet';
          storedPaymentMethodId = 'selorg_wallet';
        } else {
          return {
            error:
              `After applying your wallet, the remaining amount (₹${onlineAmountDue}) is below the minimum online payment of ₹${minOnline}. ` +
              'Please add money to your wallet to cover the full order, or pay online without using the wallet.',
          };
        }
      } else {
        storedMethodType = 'digital';
        storedPaymentMethodId = 'wallet_partial_worldline';
      }
    }
  }

  const pricingLock = buildPricingLock({
    lines: orderItems.map((it) => ({
      productId: String(it.productId),
      variantId: String(it.variantId || ''),
      quantity: Number(it.quantity),
      unitPrice: Number(it.price),
    })) as PricingLine[],
    itemTotal,
    totalTax,
    handlingCharge,
    deliveryFee,
    deliveryTip: deliveryTip || 0,
    discount,
    walletDeduction,
    onlineAmountDue,
    totalBill,
  });

  const deferFulfillment = isGatewayPrepayment(storedMethodType);
  let paymentStatus: IOrder['paymentStatus'] = storedMethodType === 'cash' ? 'cod_pending' : 'pending';

  let session: mongoose.ClientSession | null = null;
  let order!: IOrder;
  let orderNumber = '';
  try {
    const maxCreateAttempts = 5;
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxCreateAttempts; attempt++) {
      // A failed transaction poisons the session. Each attempt gets a new one
      // so a duplicate-key abort cannot replay the same order number.
      session = await mongoose.startSession();
      const txn = session;
      orderNumber = await orderRepo.generateOrderNumber();
      paymentStatus = storedMethodType === 'cash' ? 'cod_pending' : 'pending';
      try {
        await txn.withTransaction(async () => {
          const orderObjectId = new mongoose.Types.ObjectId();

          if (walletCheckoutRequested && walletDeduction > 0) {
            const debit = await debitWalletForOrder(userId, walletDeduction, orderObjectId, {
              session: txn,
              description: `Payment for order ${orderNumber}`,
            });
            if ('error' in debit) {
              const err = new Error(debit.error) as Error & { code?: string };
              err.code = 'WALLET_DEBIT_FAILED';
              throw err;
            }
            if (storedMethodType === 'wallet') {
              paymentStatus = 'paid';
            }
          } else if (storedMethodType === 'wallet') {
            paymentStatus = 'paid';
          }

          const timelineNote =
            storedMethodType === 'wallet'
              ? 'Paid with Selorg Wallet'
              : walletDeduction > 0
                ? 'Partial wallet payment — awaiting online payment for remainder'
                : deferFulfillment
                  ? 'Awaiting payment'
                  : 'Order placed';

          const created = await orderRepo.create(
            [
              {
                _id: orderObjectId,
                userId: new mongoose.Types.ObjectId(userId),
                orderNumber,
                items: orderItems,
                status: 'pending',
                timeline: [{ status: 'pending', timestamp: new Date(), note: timelineNote, actor: 'customer' }],
                addressId: address._id,
                storeId: matchedStoreObjectId || undefined,
                deliveryAddress: {
                  line1: address.line1,
                  line2: address.line2,
                  city: address.city,
                  state: address.state,
                  pincode: address.pincode,
                  landmark: address.label,
                  latitude: deliveryLatitude,
                  longitude: deliveryLongitude,
                },
                deliveryNotes: body.deliveryNotes || '',
                customerName,
                customerPhone,
                deliveryMode,
                deliverySlotId,
                deliverySlotLabel,
                scheduledWindowStart,
                scheduledWindowEnd,
                paymentMethodId: storedPaymentMethodId,
                paymentMethod: { methodType: storedMethodType, last4: '' },
                paymentStatus,
                itemTotal,
                totalTax,
                handlingCharge,
                deliveryFee,
                deliveryTip: deliveryTip || 0,
                discount,
                walletDeduction,
                onlineAmountDue,
                totalBill,
                pricingLock,
                estimatedDelivery,
                etaMinutes,
                pricingSnapshot: usePricingEngineForOrders ? engineResult : undefined,
                fulfillmentReleased: !deferFulfillment,
                checkoutCouponCode: checkoutCouponCode || '',
              },
            ],
            txn,
          );
          order = created[0];

          if (!deferFulfillment && couponCode) {
            const normalizedCode = String(couponCode).trim().toUpperCase();
            const couponDoc = await PricingCoupon.findOne({ code: normalizedCode }).session(txn);
            if (couponDoc) {
              const existingRedemption = await CouponRedemption.findOne({
                couponId: couponDoc._id,
                userId: new mongoose.Types.ObjectId(userId),
                orderId: order._id,
              }).session(txn);
              if (!existingRedemption) {
                await CouponRedemption.create(
                  [
                    {
                      couponId: couponDoc._id,
                      userId: new mongoose.Types.ObjectId(userId),
                      orderId: order._id,
                      discountApplied: discount,
                    },
                  ],
                  { session: txn },
                );
                await PricingCoupon.updateOne({ _id: couponDoc._id }, { $inc: { usageCount: 1 } }, { session: txn });
              }
            }
          }

          // COD / full wallet: clear cart once persisted.
          // Online / partial wallet: keep cart until releaseOrderFulfillment.
          if (!deferFulfillment) {
            await cartService.clearCart(userId, txn);
          }
        });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        const mongoCode = (err as { code?: number | string; errorResponse?: { code?: number } })?.code;
        const nestedCode = (err as { errorResponse?: { code?: number }; cause?: { code?: number } })?.errorResponse?.code
          ?? (err as { cause?: { code?: number } })?.cause?.code;
        const msg = String((err as Error)?.message || '');
        const isDupOrderNumber =
          mongoCode === 11000 ||
          mongoCode === '11000' ||
          nestedCode === 11000 ||
          /orderNumber.*already exists|E11000|duplicate key/i.test(msg);
        const walletFail =
          (err as { code?: string })?.code === 'WALLET_DEBIT_FAILED' ||
          /insufficient wallet|wallet not available/i.test(msg);
        if (walletFail) {
          return { error: msg || 'Wallet payment failed' };
        }
        if (isDupOrderNumber && attempt < maxCreateAttempts - 1) {
          continue;
        }
        throw err;
      } finally {
        await session.endSession();
        session = null;
      }
    }
    if (lastErr) throw lastErr;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const message = (err as Error)?.message || '';
    if (code === 'WALLET_DEBIT_FAILED' || /insufficient wallet|wallet not available/i.test(message)) {
      return { error: message || 'Wallet payment failed' };
    }
    throw err;
  } finally {
    if (session) await session.endSession();
  }

  await cartService.invalidateCartGetCache();

  const populated = await orderRepo.findByIdLean(String(order._id));
  const response = formatOrderForApp(populated as unknown as Record<string, unknown>);
  response.debugPricing = engineResult || null;
  // Deviation from legacy (real bug fix, not a stylistic choice): legacy unconditionally
  // overwrote `requiresOnlinePayment`/`onlineAmountDue` here using the wallet-partial-payment
  // local vars, which stomped `formatOrderForApp`'s already-correct per-order computation back
  // to `false`/`0` for every *non-wallet* online order. `formatOrderForApp` already reads
  // `o.walletDeduction`/`o.onlineAmountDue` from the persisted order doc and handles both the
  // wallet-partial and non-wallet cases correctly (see order.controller-adjacent formatter) —
  // no override needed, wallet-partial included, now that wallet checkout is wired above.

  if (!deferFulfillment) {
    await runPostOrderIntegrations(userId, response, paymentStatus, storedMethodType, totalBill);
  }

  return response;
}

export async function cancelOrder(userId: string, orderId: string, reason?: string): Promise<Record<string, unknown> | { error: string } | null> {
  const result = await executeCancellation(userId, orderId, reason);
  if (!result) return null;
  if ('error' in result) return result;
  await fulfillment.onCustomerOrderCancelled(result);
  return formatOrderForApp(result.toObject());
}

const STATUS_ACTOR_MAP: Record<string, string> = {
  confirmed: 'system',
  'getting-packed': 'darkstore',
  'on-the-way': 'rider',
  arrived: 'rider',
  delivered: 'rider',
  cancelled: 'system',
};

const STATUS_NOTE_MAP: Record<string, string> = {
  confirmed: 'Order confirmed by store',
  'getting-packed': 'Order is being packed',
  'on-the-way': 'Rider picked up, out for delivery',
  arrived: 'Delivery partner has arrived',
  delivered: 'Order delivered',
  cancelled: 'Order cancelled',
};

/** Map customer-order status → eventBus EVENT_TYPES so /customer-socket.io receives them. */
const STATUS_TO_EVENT: Record<string, string> = {
  confirmed: EVENT_TYPES.ORDER_CONFIRMED,
  'getting-packed': EVENT_TYPES.ORDER_PICKING_STARTED,
  'on-the-way': EVENT_TYPES.ORDER_OUT_FOR_DELIVERY,
  arrived: EVENT_TYPES.ORDER_OUT_FOR_DELIVERY,
  delivered: EVENT_TYPES.ORDER_DELIVERED,
  cancelled: EVENT_TYPES.ORDER_CANCELLED,
};

const DEFAULT_HUB_KEY = process.env.DASHBOARD_HUB_KEY || 'DS-Adyar-01';

function fulfillmentTargetForCustomerStatus(newStatus: string, from: FulfillmentStage): FulfillmentStage | 'arrived' | null {
  if (newStatus === 'arrived') return 'arrived';
  if (newStatus === 'confirmed') return 'confirmed';
  if (newStatus === 'getting-packed') {
    if (from === 'picker_accepted' || from === 'packed_in_rack' || from === 'rider_accepted') return from;
    return 'picker_accepted';
  }
  if (newStatus === 'on-the-way') return 'rider_picked';
  if (newStatus === 'delivered') return 'delivered';
  if (newStatus === 'cancelled') return 'cancelled';
  return null;
}

export async function updateCustomerOrderStatus(orderId: string, newStatus: string, opts: { actor?: string; note?: string; riderId?: string } = {}): Promise<Record<string, unknown> | { error: string }> {
  const { actor, note, riderId } = opts;
  const order = await findOrderDoc(orderId);
  if (!order) return { error: 'Order not found' };

  const from = deriveFulfillmentStage(order);
  if (from === 'delivered' || from === 'cancelled' || order.status === 'delivered' || order.status === 'cancelled') {
    return { error: `Cannot transition from "${order.status}" to "${newStatus}"` };
  }

  const target = fulfillmentTargetForCustomerStatus(newStatus, from);
  if (!target) return { error: `Cannot transition from "${order.status}" to "${newStatus}"` };

  if (target === 'arrived') {
    const arrivedFrom = order.status === 'on-the-way';
    if (from !== 'rider_picked' || !arrivedFrom) {
      return { error: `Cannot transition from "${order.status}" to "arrived"` };
    }
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: order.status },
      {
        $set: { status: 'arrived' },
        $push: {
          timeline: {
            status: 'arrived',
            timestamp: new Date(),
            note: note || STATUS_NOTE_MAP.arrived,
            actor: actor || STATUS_ACTOR_MAP.arrived,
          },
        },
      },
      { new: true },
    );
    if (!updated) return { error: 'Order changed while updating. Refresh and try again.' };
    notifyOrderStatus(updated, 'arrived', { actor: actor || STATUS_ACTOR_MAP.arrived });
    emitOrderStatus(String(updated._id), { status: 'arrived', orderNumber: updated.orderNumber, note: note || '' });
    eventBus.emit(STATUS_TO_EVENT.arrived, {
      orderId: String(updated._id),
      orderNumber: updated.orderNumber,
      userId: String(updated.userId),
      hubKey: updated.offerHubKey || DEFAULT_HUB_KEY,
      offerHubKey: updated.offerHubKey || DEFAULT_HUB_KEY,
      status: 'arrived',
      riderId: updated.riderId ? String(updated.riderId) : riderId || undefined,
    });
    return formatOrderForApp(updated.toObject());
  }

  if (target === from) return formatOrderForApp(order.toObject());

  if (newStatus === 'delivered') {
    if (from !== 'rider_picked') {
      return { error: 'Rider must pick up the order before it can be marked delivered' };
    }
    if (!order.otpVerified) {
      return { error: 'Delivery OTP must be verified by the rider before marking delivered' };
    }
    if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'cod_pending') {
      return { error: 'Payment is not confirmed for this order' };
    }
  }

  try {
    const updated = await applyFulfillmentTransition({
      orderId: String(order._id),
      to: target,
      actor: actor || STATUS_ACTOR_MAP[newStatus] || 'system',
      note: note || STATUS_NOTE_MAP[newStatus],
      set: riderId ? { riderId: String(riderId) } : undefined,
    });
    if (newStatus === 'cancelled') {
      try {
        await fulfillment.onCustomerOrderCancelled(updated);
      } catch {
        /* non-fatal — customer_orders already cancelled */
      }
    }
    notifyOrderStatus(updated, updated.status, { actor: actor || STATUS_ACTOR_MAP[newStatus] || 'system', note });
    if (riderId) emitOrderAssigned(String(updated._id), String(riderId), { orderNumber: updated.orderNumber, status: updated.status });
    return formatOrderForApp(updated.toObject());
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not update order status' };
  }
}

export async function getActiveOrder(userId: string): Promise<Record<string, unknown> | null> {
  const activeStatuses = ['pending', 'confirmed', 'getting-packed', 'on-the-way', 'arrived'];
  // Unpaid gateway drafts (paymentStatus: pending) must not surface as "active order"
  // on home/header — only settled online/wallet or accepted COD orders.
  const settledPayment = { paymentStatus: { $in: ['paid', 'cod_pending'] as const } };
  const uid = new mongoose.Types.ObjectId(userId);
  let order = await Order.findOne({ userId: uid, status: { $in: activeStatuses }, ...settledPayment })
    .sort({ createdAt: -1 })
    .lean();

  if (!order) {
    const recentCutoff = new Date(Date.now() - 5 * 60 * 1000);
    order = await Order.findOne({
      userId: uid,
      status: { $in: ['cancelled', 'delivered'] },
      updatedAt: { $gte: recentCutoff },
      ...settledPayment,
    })
      .sort({ updatedAt: -1 })
      .lean();
  }
  if (!order) return null;

  await reconcileOrderWithLatestWorldlinePayment(userId, order as unknown as Record<string, unknown>);
  order = await Order.findOne({ _id: order._id, userId: uid }).lean();
  if (!order) return null;

  const paymentMethod = order.paymentMethod as unknown as { methodType?: string } | undefined;
  if (order.status === 'cancelled' && order.paymentStatus === 'failed' && isGatewayPrepayment(paymentMethod?.methodType) && Date.now() - new Date(order.createdAt || 0).getTime() > 60 * 60 * 1000) {
    return null;
  }

  // After Worldline reconcile, an unpaid draft may remain — never expose it as active.
  if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'cod_pending') {
    return null;
  }

  return buildTrackingPayload(order as unknown as Record<string, unknown>);
}

export async function getOrderTracking(userId: string, orderId: string): Promise<Record<string, unknown> | null> {
  if (!mongoose.isValidObjectId(orderId)) return null;
  const uid = new mongoose.Types.ObjectId(userId);
  let order = await Order.findOne({ _id: orderId, userId: uid }).lean();
  if (!order) return null;

  await reconcileOrderWithLatestWorldlinePayment(userId, order as unknown as Record<string, unknown>);
  order = await Order.findOne({ _id: order._id, userId: uid }).lean();
  if (!order) return null;

  return buildTrackingPayload(order as unknown as Record<string, unknown>);
}

/**
 * Real-time tracking payload. Legacy also attached live rider GPS/details (RiderV2/Rider
 * models) and store coordinates from the `merch.Store`/`DarkStore` models — store lookup is
 * ported (store module exists), but rider tracking is deferred: the rider/rider_v2_backend
 * sub-apps are out of scope for this pass, so `deliveryPartner`/`riderLocation` are omitted
 * from the payload until that sub-app is ported.
 */
async function buildTrackingPayload(order: Record<string, unknown>): Promise<Record<string, unknown>> {
  const formatted = formatOrderForApp(order);

  const deliveryAddress = order.deliveryAddress as Record<string, unknown> | undefined;
  formatted.deliveryAddressLine = buildDeliveryAddressString(deliveryAddress);

  if (order.estimatedDelivery) {
    const remaining = Math.max(0, Math.round((new Date(order.estimatedDelivery as string).getTime() - Date.now()) / 60000));
    formatted.deliveryTimeMinutes = remaining;
    formatted.estimatedDelivery = new Date(order.estimatedDelivery as string).toISOString();
  } else {
    formatted.deliveryTimeMinutes = null;
  }

  return fulfillment.attachTrackingDetails(order, formatted);
}

export async function reorderItems(userId: string, orderId: string): Promise<Record<string, unknown> | { error: string; skipped?: unknown[]; itemsAdded?: number }> {
  const order = await orderRepo.findOneForUserLean(orderId, userId);
  if (!order) return { error: 'Order not found' };
  const items = (order.items as Array<Record<string, unknown>>) || [];
  if (items.length === 0) return { error: 'No items to reorder' };

  const added: Array<{ productId: string; productName: string; quantity: number }> = [];
  const skipped: Array<{ productId: string; productName: string; reason: string }> = [];

  for (const item of items) {
    const productName = (item.productName as string) || 'Item';
    const qty = Math.max(1, Number(item.quantity) || 1);
    const result = await cartService.addItem(userId, { productId: String(item.productId), variantId: (item.variantId as string) || '', quantity: qty });
    if ('error' in result) {
      skipped.push({ productId: String(item.productId || ''), productName, reason: String(result.error) });
      continue;
    }
    added.push({ productId: String(item.productId || ''), productName, quantity: qty });
  }

  if (added.length === 0) {
    const names = skipped.map((s) => s.productName).filter(Boolean).slice(0, 3).join(', ');
    return {
      error: names ? `None of the items from this order are available (${names}${skipped.length > 3 ? '…' : ''}).` : 'None of the items from this order are currently available.',
      skipped,
      itemsAdded: 0,
    };
  }

  return { success: true, itemsAdded: added.length, added, skipped };
}

// ─── Admin (dashboard) order queries ─────────────────────────────────────────
// Unlike listOrders/getOrderById, these are not scoped to a customer. They power
// the admin dashboard's order management screens.

/** Match a dark store by Mongo id or store code. */
export async function resolveDarkStoreKey(key: string): Promise<{ id: string; code: string } | null> {
  const trimmed = key.trim();
  if (!trimmed) return null;
  const store = /^[a-f0-9]{24}$/i.test(trimmed)
    ? await DarkStore.findById(trimmed).select('code name').lean()
    : await DarkStore.findOne({
        code: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      })
        .select('code name')
        .lean();
  if (!store) return null;
  return { id: String(store._id), code: store.code || '' };
}

async function loadStoreLabels(storeIds: Array<unknown>): Promise<Map<string, { name: string; code: string }>> {
  const ids = [...new Set(storeIds.map((id) => (id ? String(id) : '')).filter((id) => /^[a-f0-9]{24}$/i.test(id)))];
  if (!ids.length) return new Map();
  const stores = await DarkStore.find({ _id: { $in: ids } }).select('name code').lean();
  return new Map(stores.map((s) => [String(s._id), { name: s.name || '', code: s.code || '' }]));
}

export async function adminListOrders(
  page = 1,
  limit = 20,
  filters: {
    status?: string;
    statuses?: string[];
    storeId?: string;
    riderId?: string;
    search?: string;
    date?: string;
    scope?: Record<string, unknown> | null;
  } = {},
): Promise<{ data: Record<string, unknown>[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const query: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];
  if (filters.statuses?.length) query.status = { $in: filters.statuses };
  else if (filters.status) query.status = filters.status;
  if (filters.storeId && /^[a-f0-9]{24}$/i.test(filters.storeId)) {
    query.storeId = new mongoose.Types.ObjectId(filters.storeId);
  } else if (filters.storeId) {
    query.storeId = filters.storeId;
  }
  if (filters.riderId) query.riderId = filters.riderId;
  if (filters.search) {
    const rx = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    and.push({
      $or: [
        { orderNumber: rx },
        { customerName: rx },
        { customerPhone: rx },
        { 'deliveryAddress.line1': rx },
        { 'shippingAddress.contactName': rx },
        { 'shippingAddress.contactPhone': rx },
      ],
    });
  }
  if (filters.scope) and.push(filters.scope);
  if (and.length) query.$and = and;
  if (filters.date) {
    // Interpret date as IST (UTC+5:30)
    const day = filters.date;
    query.createdAt = {
      $gte: new Date(`${day}T00:00:00+05:30`),
      $lte: new Date(`${day}T23:59:59.999+05:30`),
    };
  }
  const skip = (Math.max(1, page) - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(query),
  ]);

  // Enrich with customer name and phone
  const userIds = [...new Set(orders.map((o) => String(o.userId)).filter(Boolean))];
  const users = userIds.length
    ? await CustomerUser.find({ _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } })
        .select('name phoneNumber savedCheckoutContact')
        .lean()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u as { name?: string; phoneNumber?: string; savedCheckoutContact?: { fullName?: string; phone?: string } }]));
  const storeLabels = await loadStoreLabels(orders.map((o) => o.storeId));

  const enriched = orders.map((o) => {
    const u = userMap.get(String(o.userId));
    const store = storeLabels.get(String(o.storeId || ''));
    return {
      ...formatOrderForApp(o as unknown as Record<string, unknown>),
      customer_name: u?.name || u?.savedCheckoutContact?.fullName || '',
      customer_phone: u?.phoneNumber || u?.savedCheckoutContact?.phone || '',
      storeName: store?.name || '',
      storeCode: store?.code || '',
    };
  });

  return {
    data: enriched,
    pagination: { page: Math.max(1, page), limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function adminGetOrderById(orderId: string): Promise<Record<string, unknown> | null> {
  const filter = mongoose.Types.ObjectId.isValid(orderId)
    ? { _id: orderId }
    : { orderNumber: orderId };
  const order = await Order.findOne(filter).lean();
  if (!order) return null;
  const worldlinePayment = await WorldlinePayment.findOne({ orderId: order._id, purpose: { $ne: 'wallet_topup' } })
    .sort({ createdAt: -1 })
    .lean();
  const user = order.userId
    ? await CustomerUser.findById(order.userId)
        .select('name phoneNumber savedCheckoutContact')
        .lean() as { name?: string; phoneNumber?: string; savedCheckoutContact?: { fullName?: string; phone?: string } } | null
    : null;
  const store = await loadStoreLabels([order.storeId]);
  const label = store.get(String(order.storeId || ''));
  return {
    ...formatOrderForApp({ ...order, _worldlinePayment: worldlinePayment || null } as unknown as Record<string, unknown>),
    customer_name: user?.name || user?.savedCheckoutContact?.fullName || '',
    customer_phone: user?.phoneNumber || user?.savedCheckoutContact?.phone || '',
    storeName: label?.name || '',
    storeCode: label?.code || '',
  };
}

export async function adminGetOrderLogs(orderId: string): Promise<Array<Record<string, unknown>> | null> {
  const filter = mongoose.Types.ObjectId.isValid(orderId)
    ? { _id: orderId }
    : { orderNumber: orderId };
  const order = await Order.findOne(filter).select('timeline orderNumber').lean();
  if (!order) return null;
  const timeline = (order.timeline as Array<Record<string, unknown>>) || [];
  return timeline.map((e) => ({
    status: e.status,
    timestamp: e.timestamp,
    note: e.note || '',
    actor: e.actor || 'system',
  }));
}

async function findOrderDoc(orderId: string) {
  const filter = mongoose.Types.ObjectId.isValid(orderId)
    ? { _id: orderId }
    : { orderNumber: orderId };
  return Order.findOne(filter);
}

/** Append an admin note to the order timeline without changing status. */
export async function adminAddOrderNote(
  orderId: string,
  opts: { note: string; visibility?: string; actor?: string },
): Promise<Record<string, unknown> | { error: string }> {
  const order = await findOrderDoc(orderId);
  if (!order) return { error: 'Order not found' };
  const note = String(opts.note || '').trim();
  if (!note) return { error: 'note is required' };
  const visibility = opts.visibility ? ` [${opts.visibility}]` : '';
  order.timeline.push({
    status: order.status,
    timestamp: new Date(),
    note: `Admin note${visibility}: ${note}`,
    actor: opts.actor || 'admin',
  });
  await order.save();
  return formatOrderForApp(order.toObject());
}

/** Assign / reassign HSD picker (packing operator) — writes hhdUserId, never rider pickerId. */
export async function adminReassignPicker(
  orderId: string,
  opts: { pickerId: string; pickerName?: string; reason?: string; note?: string; actor?: string },
): Promise<Record<string, unknown> | { error: string }> {
  const order = await findOrderDoc(orderId);
  if (!order) return { error: 'Order not found' };
  if (!opts.pickerId) return { error: 'pickerId is required' };
  if (!mongoose.Types.ObjectId.isValid(opts.pickerId)) {
    return { error: 'pickerId must be a valid HSD user ObjectId' };
  }

  const { HHDUser } = await import('../hhd/hhd.models');
  const hhd = await HHDUser.findById(opts.pickerId).select('name isActive warehouse darkstore').lean();
  if (!hhd) return { error: 'HSD picker not found' };
  if ((hhd as { isActive?: boolean }).isActive === false) return { error: 'HSD picker is inactive' };

  const name = opts.pickerName || (hhd as { name?: string }).name || opts.pickerId;
  const reason = opts.reason ? ` (${opts.reason})` : '';
  const extra = opts.note ? ` — ${opts.note}` : '';
  order.hhdUserId = new mongoose.Types.ObjectId(opts.pickerId);
  if (!order.adminFulfillment) (order as any).adminFulfillment = {};
  (order as any).adminFulfillment.pickerName = name;
  order.timeline.push({
    status: order.status,
    timestamp: new Date(),
    note: `HSD picker assigned to ${name}${reason}${extra}`,
    actor: opts.actor || 'admin',
    userId: opts.pickerId,
  });
  await order.save();
  return formatOrderForApp(order.toObject());
}

/** Offer / re-offer a rider. Does NOT mark Rider Accepted — rider must accept in the app. */
export async function adminReassignRider(
  orderId: string,
  opts: { riderId: string; riderName?: string; reason?: string; note?: string; actor?: string },
): Promise<Record<string, unknown> | { error: string }> {
  const order = await findOrderDoc(orderId);
  if (!order) return { error: 'Order not found' };
  if (!opts.riderId) return { error: 'riderId is required' };

  const { PickerUser } = await import('../picker/picker.models');
  if (!mongoose.Types.ObjectId.isValid(opts.riderId)) {
    return { error: 'riderId must be a picker/rider ObjectId' };
  }
  const riderUser = await PickerUser.findById(opts.riderId)
    .select('name status workforceRole activeOrderId isOnline')
    .lean();
  if (!riderUser || (riderUser as { workforceRole?: string }).workforceRole === 'picker') {
    return { error: 'Rider not found' };
  }
  if (!(riderUser as { isOnline?: boolean }).isOnline) {
    return { error: 'Rider must be online in the Rider App before an order can be offered.' };
  }
  if (order.riderStage !== 'offered' && order.fulfillmentStage !== 'packed_in_rack' && String(order.pickerId || '') !== opts.riderId) {
    return { error: 'Order is not ready for a rider. Finish picking and rack handover first.' };
  }
  try {
    const { assertRiderFreeForNewOrder } = await import('../picker/rider-lock');
    await assertRiderFreeForNewOrder(opts.riderId, String(order._id));
  } catch (err) {
    return { error: (err as Error).message || 'Rider is not available' };
  }

  const previousPickerId = order.pickerId ? String(order.pickerId) : null;
  const name = opts.riderName || (riderUser as { name?: string }).name || opts.riderId;
  const reason = opts.reason ? ` (${opts.reason})` : '';
  const extra = opts.note ? ` — ${opts.note}` : '';
  const now = new Date();
  const { pickerConfig } = await import('../picker/picker.config');

  // Offer only — clear ownership so the named rider (or any hub rider) must accept.
  order.riderId = null;
  order.pickerId = null;
  order.riderStage = 'offered';
  order.fulfillmentStage = 'packed_in_rack';
  order.acceptedAt = null;
  order.offerExpiresAt = new Date(now.getTime() + pickerConfig.offerExpirySeconds * 1000);
  if (!order.offerHubKey) order.offerHubKey = DEFAULT_HUB_KEY;
  if (!order.adminFulfillment) (order as any).adminFulfillment = {};
  (order as any).adminFulfillment.riderName = name;
  order.timeline.push({
    status: order.status,
    timestamp: now,
    note: `Admin offered order to rider ${name}${reason}${extra} — waiting for accept`,
    actor: opts.actor || 'admin',
  });
  await order.save();

  if (previousPickerId && previousPickerId !== opts.riderId) {
    await PickerUser.updateOne(
      { _id: previousPickerId, activeOrderId: String(order._id) },
      { $unset: { activeOrderId: 1 } },
    );
  }

  return formatOrderForApp(order.toObject());
}

/** Log an admin customer-contact attempt on the order timeline. */
export async function adminContactCustomer(
  orderId: string,
  opts: { channel: string; template?: string; note?: string; actor?: string },
): Promise<Record<string, unknown> | { error: string }> {
  const order = await findOrderDoc(orderId);
  if (!order) return { error: 'Order not found' };
  if (!opts.channel) return { error: 'channel is required' };
  const template = opts.template ? ` · ${opts.template}` : '';
  const extra = opts.note ? ` — ${opts.note}` : '';
  order.timeline.push({
    status: order.status,
    timestamp: new Date(),
    note: `Contacted customer via ${opts.channel}${template}${extra}`,
    actor: opts.actor || 'admin',
  });
  await order.save();
  return formatOrderForApp(order.toObject());
}

/**
 * Initiate an admin refund: create RefundRequest, optionally credit wallet,
 * and stamp the order timeline / refund fields.
 */
export async function adminInitiateRefund(
  orderId: string,
  opts: {
    amount: number;
    method?: string;
    reason?: string;
    scope?: string;
    note?: string;
    actor?: string;
  },
): Promise<Record<string, unknown> | { error: string }> {
  const order = await findOrderDoc(orderId);
  if (!order) return { error: 'Order not found' };
  const amount = Number(opts.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Valid amount is required' };

  const { RefundRequest } = await import('./refund-request.model');
  const user = order.userId
    ? await CustomerUser.findById(order.userId).select('name email').lean()
    : null;

  const refund = await RefundRequest.create({
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    customerId: String(order.userId || ''),
    customerName: user?.name || user?.email || 'Customer',
    customerEmail: user?.email || 'no-email@selorg.internal',
    customerPhone: '',
    reasonCode: opts.reason || 'admin_initiated',
    reasonText: opts.note || opts.reason || opts.scope || 'Admin initiated refund',
    amount,
    currency: 'INR',
    status: 'pending',
    channel: 'ops_adjustment',
    refundMethod: opts.method?.toLowerCase().includes('wallet') ? 'wallet' : 'original_payment',
    timeline: [
      {
        status: 'pending',
        timestamp: new Date(),
        note: `Admin refund initiated (${opts.scope || 'full/partial'})`,
        actor: opts.actor || 'admin',
      },
    ],
  });

  // Immediate wallet credit when Admin chooses Selorg wallet
  if (opts.method?.toLowerCase().includes('wallet') && order.userId) {
    const { creditWallet } = await import('../wallet/wallet.service');
    await creditWallet(String(order.userId), amount, {
      source: 'refund',
      referenceId: `admin-refund-${refund._id}`,
      referenceType: 'refund',
      description: opts.reason || 'Admin refund',
    });
    refund.status = 'completed';
    refund.timeline.push({
      status: 'completed',
      timestamp: new Date(),
      note: 'Credited to Selorg wallet',
      actor: opts.actor || 'admin',
    });
    await refund.save();
  }

  order.refundId = refund._id as unknown as mongoose.Types.ObjectId;
  const refundStatusMap: Record<string, IOrder['refundStatus']> = {
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    processed: 'processed',
    completed: 'processed',
    escalated: 'pending',
  };
  order.refundStatus = refundStatusMap[refund.status] || 'pending';
  order.refundAmount = amount;
  order.timeline.push({
    status: order.status,
    timestamp: new Date(),
    note: `Refund initiated ₹${amount} via ${opts.method || 'original'} (${opts.reason || 'admin'})`,
    actor: opts.actor || 'admin',
  });
  await order.save();
  return formatOrderForApp(order.toObject());
}
