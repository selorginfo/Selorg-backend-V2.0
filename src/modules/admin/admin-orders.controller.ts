import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Order } from '../orders/order.model';
import { Product } from '../products/products.model';
import { CustomerUser } from '../auth/auth.model';
import { CustomerAddress } from '../addresses/addresses.model';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { calculatePricing } from '../../services/pricing.service';
import { computeDeliveryFee, getDeliveryPricingConfig } from '../../services/deliveryPricing.service';
import { findNearestDarkstore, resolveDarkStoreIdByCode } from '../store/store.repository';
import { deriveFulfillmentStage, adminLabelForStage, deliveryMissingOtp } from '../orders/order-lifecycle';
import { assertAnyStoreAccess, orderStoreScopeFilter } from '../../utils/store-scope';
import {
  clientPriceEditError,
  isPositivePrice,
  zeroPriceError,
} from '../orders/order-pricing-guard';
import { acquireOpenOrderSlot } from '../orders/order-placement-lock';


export async function listAdminOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.customerId) filter.userId = req.query.customerId;
    if (req.query.date) {
      // Interpret date as IST (UTC+5:30) — orders stored in UTC
      const day = String(req.query.date);
      filter.createdAt = {
        $gte: new Date(`${day}T00:00:00+05:30`),
        $lte: new Date(`${day}T23:59:59.999+05:30`),
      };
    }
    const scope = orderStoreScopeFilter(req.user);
    if (scope) Object.assign(filter, scope);

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);

    // Enrich with customer name and phone for admin display
    const userIds = [...new Set(orders.map((o) => String(o.userId)).filter(Boolean))];
    const users = userIds.length
      ? await CustomerUser.find({ _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } })
          .select('name phoneNumber savedCheckoutContact')
          .lean()
      : [];
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const enriched = orders.map((o) => {
      const u = userMap.get(String(o.userId)) as { name?: string; phoneNumber?: string; savedCheckoutContact?: { fullName?: string; phone?: string } } | undefined;
      const stage = deriveFulfillmentStage(o);
      return {
        ...o,
        customer_name: u?.name || u?.savedCheckoutContact?.fullName || o.customerName || '',
        customer_phone: u?.phoneNumber || u?.savedCheckoutContact?.phone || o.customerPhone || '',
        fulfillmentStage: stage,
        fulfillmentLabel: adminLabelForStage(stage),
        exceptionReason: deliveryMissingOtp(o) ? (o.exceptionReason || 'NOT_DELIVERED') : o.exceptionReason ?? null,
        offeredRiderName:
          o.riderStage === 'offered' && o.adminFulfillment?.riderName ? o.adminFulfillment.riderName : null,
      };
    });

    res.status(200).json({ success: true, data: enriched, meta: { total, page, limit } });
  } catch (err) {
    next(err);
  }
}

export async function getAdminOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const order = await Order.findOne(
      mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { orderNumber: id }
    ).lean();
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    const hub =
      (order as { offerHubKey?: string }).offerHubKey ||
      (order as { hubKey?: string }).hubKey ||
      '';
    const storeId = (order as { storeId?: unknown }).storeId;
    assertAnyStoreAccess(req.user, hub ? String(hub) : undefined, storeId ? String(storeId) : undefined);
    const user = order.userId
      ? await CustomerUser.findById(order.userId).select('name phoneNumber savedCheckoutContact').lean() as { name?: string; phoneNumber?: string; savedCheckoutContact?: { fullName?: string; phone?: string } } | null
      : null;
    const stage = deriveFulfillmentStage(order);
    const enriched = {
      ...order,
      customer_name: user?.name || user?.savedCheckoutContact?.fullName || '',
      customer_phone: user?.phoneNumber || user?.savedCheckoutContact?.phone || '',
      fulfillmentStage: stage,
      fulfillmentLabel: adminLabelForStage(stage),
      exceptionReason: deliveryMissingOtp(order) ? (order.exceptionReason || 'NOT_DELIVERED') : order.exceptionReason ?? null,
      offeredRiderName:
        order.riderStage === 'offered' && order.adminFulfillment?.riderName ? order.adminFulfillment.riderName : null,
    };
    res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

export async function getAdminOrderLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const order = await Order.findOne(
      mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { orderNumber: id }
    ).select('timeline').lean();
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    const logs = (order.timeline ?? []).map((entry: Record<string, unknown>) => ({
      status: entry.status,
      timestamp: entry.timestamp,
      note: entry.note ?? '',
      actor: entry.actor ?? 'system',
    }));
    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

export async function placeOrderOnBehalf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { customerId, items, paymentMethod, deliveryNotes, couponCode } = req.body as {
      customerId?: string;
      items: { productId: string; quantity: number }[];
      paymentMethod?: string;
      deliveryNotes?: string;
      couponCode?: string;
    };

    if (!customerId) throw AppError.badRequest('customerId is required');
    if (!Array.isArray(items) || items.length === 0) throw AppError.badRequest('items must be a non-empty array');

    const priceEdit = clientPriceEditError(req.body);
    if (priceEdit) throw new AppError(priceEdit.error, priceEdit.statusCode, priceEdit.code);

    const customer = await CustomerUser.findById(customerId).lean();
    if (!customer) throw AppError.notFound('Customer');

    const gate = await acquireOpenOrderSlot(String(customer._id));
    if ('error' in gate) throw new AppError(gate.error, gate.statusCode, gate.code);
    try {
    // Resolve product details and build order lines
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const orderItems: Record<string, unknown>[] = [];
    let subtotal = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) throw AppError.badRequest(`Product ${item.productId} not found`);
      const qty = Math.max(1, item.quantity || 1);
      const price = Number(product.price || 0);
      if (!isPositivePrice(price)) {
        const zero = zeroPriceError(product.name);
        throw new AppError(zero.error, zero.statusCode, zero.code);
      }
      const lineTotal = price * qty;
      subtotal += lineTotal;
      orderItems.push({
        productId: new mongoose.Types.ObjectId(item.productId),
        productName: product.name,
        variantSize: String(product.size || product.uom || '1 unit'),
        quantity: qty,
        price,
        originalPrice: Number(product.mrp || price),
        image: product.imageUrl || product.thumbnailUrl || '',
        itemStatus: 'pending',
        substituteProductName: '',
      });
    }

    // Prefer the customer's default address so on-behalf orders route like their own would.
    const address =
      (await CustomerAddress.findOne({ userId: customerId, isDefault: true }).lean()) ??
      (await CustomerAddress.findOne({ userId: customerId }).lean());

    const orderNumber = `ADM-${Date.now().toString(36).toUpperCase()}`;
    const paymentMethodType = paymentMethod ?? 'cash';

    // Bill through the same pricing engine as a customer checkout. Previously this handler hard-set
    // deliveryFee/tax/discount to 0 and stored `couponCode` without ever applying it, so an
    // admin-placed order under-charged the customer and silently ignored the coupon.
    let deliveryFee = 0;
    let handlingCharge = 0;
    let discount = 0;
    let totalTax = 0;
    let totalBill = subtotal;
    try {
      const pricing = await calculatePricing({
        userId: customerId,
        cartItems: items.map((i) => {
          const product = productMap.get(i.productId)!;
          return {
            productId: i.productId,
            variantId: null,
            quantity: Math.max(1, i.quantity || 1),
            baseUnitPrice: Number(product.price || 0),
          };
        }),
        couponCode: couponCode || null,
        zone: address?.city || null,
        paymentMethod: paymentMethodType,
        mode: 'order',
      });
      const totals = pricing?.totals;
      if (totals) {
        deliveryFee = Number(totals.deliveryFee) || 0;
        handlingCharge = Number(totals.handlingCharge) || 0;
        discount = Number(totals.discount) || 0;
        totalTax = Number(totals.tax) || 0;
        totalBill = Number(totals.finalAmount) || subtotal;
      }
    } catch (err) {
      // Fall back to the config-driven delivery fee rather than charging nothing.
      logger.warn('[AdminOrder] pricing engine failed, using delivery pricing config', {
        error: (err as Error).message,
      });
      const feeConfig = await getDeliveryPricingConfig();
      deliveryFee = computeDeliveryFee(subtotal, feeConfig);
      handlingCharge = subtotal > 0 ? feeConfig.handlingCharge : 0;
      totalBill = subtotal + deliveryFee + handlingCharge;
    }

    // Route to a darkstore so fulfilment can reserve and consume inventory for this order.
    let storeObjectId: mongoose.Types.ObjectId | null = null;
    let hubKey: string | null = null;
    if (address?.latitude != null && address?.longitude != null) {
      const nearestCode = await findNearestDarkstore(Number(address.latitude), Number(address.longitude));
      if (nearestCode) {
        hubKey = nearestCode;
        storeObjectId = await resolveDarkStoreIdByCode(nearestCode);
      }
    }

    const order = await Order.create({
      userId: new mongoose.Types.ObjectId(customerId),
      orderNumber,
      status: 'confirmed',
      items: orderItems,
      itemTotal: subtotal,
      deliveryFee,
      handlingCharge,
      totalTax,
      discount,
      totalBill,
      storeId: storeObjectId || undefined,
      offerHubKey: hubKey,
      paymentMethod: { methodType: paymentMethodType, displayLabel: paymentMethodType === 'cash' ? 'Cash on Delivery' : paymentMethodType },
      deliveryAddress: address
        ? {
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            pincode: address.pincode,
            // Carried through so downstream hub re-resolution and rider navigation work.
            latitude: address.latitude,
            longitude: address.longitude,
          }
        : null,
      deliveryNotes: deliveryNotes || '',
      checkoutCouponCode: couponCode || undefined,
    });

    logger.info('[AdminOrder] placed on behalf', { orderId: String(order._id), customerId, adminId: req.user?.userId });
    res.status(201).json({ success: true, data: order });
    } finally {
      await gate.release();
    }
  } catch (err) {
    next(err);
  }
}
