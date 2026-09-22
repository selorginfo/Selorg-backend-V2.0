import mongoose from 'mongoose';
import { Order, IOrder } from './order.model';
import { CancellationPolicy, ICancellationPolicy } from './cancellation-policy.model';
import { RefundRequest } from './refund-request.model';
import { CustomerUser } from '../auth/auth.model';
import * as cartService from '../cart/cart.service';
import { creditWallet, refundWalletForFailedOrderPayment } from '../wallet/wallet.service';
import { logger } from '../../utils/logger';
import * as orderRepo from './order.repository';

function roundMoney(amount: unknown): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

/** Daily cancel cap per user (calendar day). Default 1000; override with CUSTOMER_MAX_CANCELLATIONS_PER_DAY. */
function getEffectiveMaxCancellationsPerDay(): number {
  const raw = process.env.CUSTOMER_MAX_CANCELLATIONS_PER_DAY;
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 1000;
}

type EffectivePolicy = Pick<ICancellationPolicy, 'allowedStatuses' | 'freeWindowMinutes' | 'cancellationFeePercent' | 'maxCancellationFee' | 'customerCanCancel' | 'autoRefundOnCancel' | 'refundMethod'> & {
  maxCancellationsPerDay: number;
};

async function getActivePolicy(paymentMethod?: string): Promise<EffectivePolicy> {
  let policy = await CancellationPolicy.findOne({ isActive: true, appliesTo: paymentMethod || 'all' }).lean();
  if (!policy) {
    policy = await CancellationPolicy.findOne({ isActive: true, appliesTo: 'all' }).lean();
  }
  // Default matches the policy schema enum + webapp UI (cancel until out for delivery).
  const base: EffectivePolicy = policy || {
    allowedStatuses: ['pending', 'confirmed', 'getting-packed'],
    freeWindowMinutes: 2,
    cancellationFeePercent: 0,
    maxCancellationFee: 0,
    customerCanCancel: true,
    autoRefundOnCancel: true,
    refundMethod: 'original_payment',
    maxCancellationsPerDay: 1000,
  };
  return { ...base, maxCancellationsPerDay: getEffectiveMaxCancellationsPerDay() };
}

/**
 * Darkstore fulfillment-stage block (legacy checked `DarkstoreOrder.status` for
 * PICKING/PACKED/etc.) is deferred — the darkstore sub-app is out of scope for this pass, so
 * that extra guard is not ported. Policy-status + free-window + daily-cap checks below still
 * apply in full.
 */
export async function canCustomerCancel(userId: string, orderId: string): Promise<{ allowed: boolean; reason?: string; cancellationFee?: number; isPastFreeWindow?: boolean; policy?: EffectivePolicy }> {
  const order = await orderRepo.findOneForUserLean(orderId, userId);
  if (!order) return { allowed: false, reason: 'Order not found' };

  const policy = await getActivePolicy(order.paymentMethod?.methodType);

  if (!policy.customerCanCancel) return { allowed: false, reason: 'Customer cancellation is not allowed' };
  if (!policy.allowedStatuses.includes(order.status)) return { allowed: false, reason: `Cannot cancel order in "${order.status}" status` };

  const orderAge = (Date.now() - new Date(order.createdAt).getTime()) / 60000;
  const isPastFreeWindow = orderAge > policy.freeWindowMinutes;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaysCancellations = await Order.countDocuments({ userId, status: 'cancelled', updatedAt: { $gte: todayStart } });
  if (todaysCancellations >= policy.maxCancellationsPerDay) return { allowed: false, reason: 'Daily cancellation limit reached' };

  let cancellationFee = 0;
  if (isPastFreeWindow && policy.cancellationFeePercent > 0) {
    cancellationFee = Math.min(order.totalBill * (policy.cancellationFeePercent / 100), policy.maxCancellationFee || Infinity);
  }

  return { allowed: true, cancellationFee, isPastFreeWindow, policy };
}

async function createCancelRefundRequest(order: IOrder, refundAmount: number, refundMethod: string, reason: string) {
  const user = await CustomerUser.findById(order.userId).lean();
  const existing = await RefundRequest.findOne({ orderId: String(order._id), customerId: String(order.userId), status: { $in: ['pending', 'approved', 'processed'] } });
  if (existing) return existing;

  return RefundRequest.create({
    orderId: String(order._id),
    orderNumber: order.orderNumber || '',
    customerId: String(order.userId),
    customerName: (user as { name?: string; email?: string; phoneNumber?: string })?.name || (user as { email?: string })?.email || (user as { phoneNumber?: string })?.phoneNumber || 'Customer',
    customerEmail: (user as { email?: string })?.email || '',
    customerPhone: (user as { phoneNumber?: string })?.phoneNumber || '',
    reasonCode: 'customer_cancelled',
    reasonText: reason || 'Cancelled by customer',
    amount: refundAmount,
    currency: 'INR',
    status: 'pending',
    channel: 'self_service',
    refundMethod: refundMethod === 'wallet' ? 'wallet' : 'original_payment',
    timeline: [{ status: 'pending', timestamp: new Date(), actor: 'customer', note: 'Auto-created from customer order cancellation' }],
  });
}

function roundOrderMoney(amount: unknown): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

/**
 * Wallet crediting below uses `wallet.service.ts`'s `creditWallet` (session-idempotent,
 * atomic) — NOT legacy `cancellationService.js`'s import from `autoRefundService.js`.
 * `autoRefundService.creditWallet(customerId, amount, refundId, orderId)` is a real,
 * unfixed legacy bug: it does a non-atomic read-modify-write (`wallet.balance += amount;
 * wallet.save()`) with no session and no idempotency key, and its `orderId` parameter is
 * never even used — so concurrent credits can race and lose money, and retries double-credit.
 * Deliberately not ported; using the safe `wallet.service.ts` version instead with distinct
 * `referenceId`s per case (`cancel-{orderId}` full refund, `cancel-wallet-{orderId}` partial
 * portion) for idempotency.
 */
export async function executeCancellation(userId: string, orderId: string, reason = ''): Promise<IOrder | { error: string } | null> {
  const check = await canCustomerCancel(userId, orderId);
  if (!check.allowed) return { error: check.reason || 'Cannot cancel order' };

  const order = await orderRepo.findOneForUser(orderId, userId);
  if (!order) return { error: 'Order not found' };

  order.status = 'cancelled';
  order.cancellationReason = reason || 'Cancelled by customer';
  order.timeline.push({ status: 'cancelled', timestamp: new Date(), note: reason || 'Cancelled by customer', actor: 'customer' });

  const isUnreleasedGateway = order.fulfillmentReleased === false && (order.paymentMethod?.methodType === 'card' || order.paymentMethod?.methodType === 'upi' || order.paymentMethod?.methodType === 'digital');
  if (isUnreleasedGateway) {
    order.paymentStatus = 'failed';
  }

  // Unpaid partial-wallet orders: restore the wallet debit when customer cancels before online pay.
  if (isUnreleasedGateway && Number(order.walletDeduction) > 0 && !order.walletRefundedAt) {
    try {
      const claimedRefund = await Order.findOneAndUpdate({ _id: order._id, walletDeduction: { $gt: 0 }, walletRefundedAt: null }, { $set: { walletRefundedAt: new Date() } }, { new: true });
      if (claimedRefund) {
        const result = await refundWalletForFailedOrderPayment(userId, Number(order.walletDeduction), order._id, {
          description: `Wallet restored after cancelling order ${order.orderNumber || order._id}`,
        });
        if (result && 'error' in result) {
          await Order.updateOne({ _id: order._id }, { $set: { walletRefundedAt: null } });
        } else {
          order.walletRefundedAt = claimedRefund.walletRefundedAt || new Date();
        }
      }
    } catch (e) {
      logger.warn('wallet restore on cancel failed (non-blocking)', { orderId: String(order._id), error: (e as Error)?.message });
    }
  }

  let refundAmount = 0;
  let refundMethod = check.policy?.refundMethod || 'original_payment';

  if (check.policy?.autoRefundOnCancel && order.paymentMethod?.methodType !== 'cash' && order.paymentStatus === 'paid') {
    refundAmount = Math.max(0, Number(order.totalBill || 0) - (check.cancellationFee || 0));
    if (refundAmount > 0) {
      order.refundAmount = refundAmount;
      order.refundStatus = 'pending';

      const walletPortion = Math.min(refundAmount, Math.max(0, Number(order.walletDeduction) || 0));
      const isFullWalletPay = order.paymentMethod?.methodType === 'wallet';

      // Full wallet orders always refund to wallet. Partial wallet: restore wallet portion
      // immediately; remainder follows the configured refund policy.
      if (isFullWalletPay || refundMethod === 'wallet') {
        await creditWallet(userId, refundAmount, {
          source: 'refund',
          description: `Refund for cancelled order ${order.orderNumber || order._id}`,
          referenceId: `cancel-${order._id}`,
          referenceType: 'order',
        });
        order.refundStatus = 'processed';
        refundMethod = 'wallet';
      } else if (walletPortion > 0) {
        await creditWallet(userId, walletPortion, {
          source: 'refund',
          description: `Partial wallet refund for cancelled order ${order.orderNumber || order._id}`,
          referenceId: `cancel-wallet-${order._id}`,
          referenceType: 'order',
        });
        const onlineRefund = roundOrderMoney(refundAmount - walletPortion);
        if (onlineRefund > 0) {
          if (refundMethod === 'manual') {
            order.refundStatus = 'pending';
          } else {
            try {
              const refund = await createCancelRefundRequest(order, onlineRefund, 'original_payment', reason);
              order.refundId = refund._id as mongoose.Types.ObjectId;
              order.refundStatus = (refund.status as IOrder['refundStatus']) || 'pending';
            } catch {
              // Non-blocking, matches legacy.
            }
          }
        } else {
          order.refundStatus = 'processed';
          refundMethod = 'wallet';
        }
      } else if (refundMethod === 'manual') {
        order.refundStatus = 'pending';
      } else {
        // original_payment — create a finance refund request for ops processing.
        try {
          const refund = await createCancelRefundRequest(order, refundAmount, 'original_payment', reason);
          order.refundId = refund._id as mongoose.Types.ObjectId;
          order.refundStatus = (refund.status as IOrder['refundStatus']) || 'pending';
        } catch {
          // Non-blocking, matches legacy.
        }
      }
    }
  }

  await order.save();

  if (isUnreleasedGateway && order.cartRestoredAt == null) {
    const restoreClaim = await Order.updateOne({ _id: order._id, cartRestoredAt: null }, { $set: { cartRestoredAt: new Date() } });
    if (restoreClaim.modifiedCount === 1) {
      try {
        await cartService.restoreCartFromOrder(userId, order.items as unknown as Array<Record<string, unknown>>);
      } catch {
        // Non-blocking, matches legacy.
      }
    }
  }

  // Order-status and refund-outcome notifications (legacy `sendOrderStatusNotification` /
  // `sendRefundNotification`) deferred — see orders.service.ts's notifyOrderStatus doc comment.

  return order;
}
