import mongoose from 'mongoose';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/AppError';
import { eventBus } from '../../events/eventBus';
import { EVENT_TYPES } from '../../events/eventTypes';
import { sendWebPush } from '../../services/webpush.service';
import { sendToTokens } from '../../services/fcm.service';
import { Order, IOrder, OrderRiderStage } from './order.model';
import { Product } from '../products/products.model';
import { StoreInventory } from '../products/store-inventory.model';
import { HHDOrder, HHDItem, HHDAssignOrder, HHDUser } from '../hhd/hhd.models';
import { ORDER_STATUS, ORDER_PRIORITY, ZONE, ITEM_STATUS } from '../hhd/hhd.constants';
import { PickerUser, PickerNotification } from '../picker/picker.models';
import { PickerLocationPing } from '../picker/picker.rider.models';
import { DarkStore } from '../store/dark-store.model';
import { Notification, PushToken } from '../notifications/notifications.model';
import { CATEGORIES } from '../notifications/notifications.constants';

export const DEFAULT_HUB_KEY = 'DS-Adyar-01';

const HANDED_OVER_STAGES: OrderRiderStage[] = ['offered', 'accepted', 'picked_up', 'delivered'];
const PICKING_HHD_STATUSES = new Set<string>([
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.BAG_SCANNED,
  ORDER_STATUS.PICKING,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.PHOTO_VERIFIED,
  ORDER_STATUS.RACK_ASSIGNED,
]);

function bagCodeForOrderNumber(orderNumber?: string | null): string {
  const raw = String(orderNumber || '')
    .replace(/^#?SG-?/i, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(-6) || '000000';
  return `SG-${raw}-A`;
}

function generateDeliveryOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function fireAndForget(label: string, work: () => Promise<unknown>): void {
  setImmediate(() => {
    void work().catch((err) => {
      logger.warn(`[fulfillment] ${label} failed`, { error: (err as Error)?.message });
    });
  });
}

export async function findCustomerOrderByHhdOrderId(hhdOrderId: string): Promise<IOrder | null> {
  if (!hhdOrderId) return null;
  const byNumber = await Order.findOne({ orderNumber: hhdOrderId });
  if (byNumber) return byNumber;
  if (mongoose.isValidObjectId(hhdOrderId)) {
    return Order.findById(hhdOrderId);
  }
  return null;
}

export async function assertCustomerOrderPickable(hhdOrderId: string): Promise<IOrder> {
  const order = await findCustomerOrderByHhdOrderId(hhdOrderId);
  if (!order) {
    throw new AppError('Invalid order/package', 404, 'ORDER_NOT_FOUND');
  }
  if (order.status === 'cancelled') {
    throw new AppError('This order has been cancelled', 409, 'ORDER_CANCELLED');
  }
  return order;
}

export async function isCustomerOrderCancelled(hhdOrderId: string): Promise<boolean> {
  const order = await findCustomerOrderByHhdOrderId(hhdOrderId);
  return !order || order.status === 'cancelled';
}

function parseBagQr(qrCode: string): { bagId: string; litres: number; size: string; sizeLabel: string } | null {
  const trimmed = String(qrCode || '').trim();
  const match = trimmed.match(/^BAG-(\d+)-([A-Za-z]+)-([A-Za-z0-9-]+)$/i);
  if (!match) return null;
  const litres = parseInt(match[1], 10);
  const size = match[2].toUpperCase();
  return {
    bagId: trimmed,
    litres,
    size,
    sizeLabel: size === 'S' ? 'Small' : size === 'L' ? 'Large' : 'Medium',
  };
}

/** Accepts BAG-* QR, customer bagCode, or order number as the package identifier. */
export function resolvePackageScan(
  qrCode: string,
  orderId: string,
  bagCode?: string | null,
): { bagId: string; litres: number; size: string; sizeLabel: string } {
  const parsed = parseBagQr(qrCode);
  if (parsed) return parsed;

  const trimmed = String(qrCode || '').trim();
  const candidates = [orderId, bagCode].filter(Boolean).map((v) => String(v).trim().toUpperCase());
  if (trimmed && candidates.includes(trimmed.toUpperCase())) {
    return {
      bagId: bagCode || trimmed,
      litres: 0,
      size: 'M',
      sizeLabel: 'Order package',
    };
  }

  throw new AppError(
    'Invalid order/package',
    400,
    'INVALID_BAG_QR',
  );
}

async function reserveInventoryForOrder(order: IOrder): Promise<void> {
  const items = (order.items || []) as Array<{ productId?: unknown; quantity?: unknown }>;
  for (const item of items) {
    const productId = item.productId ? String(item.productId) : '';
    const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
    if (!productId || !mongoose.isValidObjectId(productId) || qty < 1) continue;
    const filter: Record<string, unknown> = { productId: new mongoose.Types.ObjectId(productId) };
    if (order.storeId) filter.storeId = order.storeId;
    await StoreInventory.updateOne(filter, { $inc: { reservedQty: qty } });
  }
}

export async function releaseInventoryForOrder(order: IOrder): Promise<void> {
  const items = (order.items || []) as Array<{ productId?: unknown; quantity?: unknown }>;
  for (const item of items) {
    const productId = item.productId ? String(item.productId) : '';
    const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
    if (!productId || !mongoose.isValidObjectId(productId) || qty < 1) continue;
    const filter: Record<string, unknown> = { productId: new mongoose.Types.ObjectId(productId) };
    if (order.storeId) filter.storeId = order.storeId;
    await StoreInventory.updateOne(filter, [
      {
        $set: {
          reservedQty: {
            $max: [0, { $subtract: [{ $ifNull: ['$reservedQty', 0] }, qty] }],
          },
        },
      },
    ]);
  }
}

export async function consumeInventoryForDeliveredOrder(order: IOrder): Promise<void> {
  const items = (order.items || []) as Array<{ productId?: unknown; quantity?: unknown }>;
  for (const item of items) {
    const productId = item.productId ? String(item.productId) : '';
    const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
    if (!productId || !mongoose.isValidObjectId(productId) || qty < 1) continue;
    const filter: Record<string, unknown> = { productId: new mongoose.Types.ObjectId(productId) };
    if (order.storeId) filter.storeId = order.storeId;
    await StoreInventory.updateOne(filter, [
      {
        $set: {
          quantity: { $max: [0, { $subtract: [{ $ifNull: ['$quantity', 0] }, qty] }] },
          reservedQty: { $max: [0, { $subtract: [{ $ifNull: ['$reservedQty', 0] }, qty] }] },
        },
      },
    ]);
  }
}

async function createHhdPickTicket(order: IOrder): Promise<void> {
  const orderId = String(order.orderNumber || order._id);
  const existing = await HHDOrder.findOne({ orderId }).lean();
  if (existing) return;

  const items = (order.items || []) as Array<Record<string, unknown>>;
  const productIds = items
    .map((it) => String(it.productId || ''))
    .filter((id) => mongoose.isValidObjectId(id));
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).select('_id sku name').lean()
    : [];
  const skuById = new Map(products.map((p) => [String(p._id), String((p as { sku?: string }).sku || '')]));

  const unitCount = items.reduce((sum, it) => sum + Math.max(1, Number(it.quantity) || 1), 0) || 1;

  try {
    await HHDOrder.create({
      orderId,
      userId: null,
      hubKey: String(order.offerHubKey || DEFAULT_HUB_KEY),
      zone: ZONE.A,
      itemCount: unitCount,
      lineCount: items.length || 1,
      unitCount,
      targetTime: 10,
      priority: ORDER_PRIORITY.HIGH,
      status: ORDER_STATUS.PENDING,
      recommendedBagSize: 'M',
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code !== 11000) throw err;
    return;
  }

  if (items.length > 0) {
    await HHDItem.insertMany(
      items.map((item) => {
        const productId = String(item.productId || '');
        const sku = skuById.get(productId);
        return {
          orderId,
          itemCode: sku || productId || String(item.productName || 'ITEM'),
          name: String(item.productName || 'Item'),
          quantity: Math.max(1, Number(item.quantity) || 1),
          scannedQuantity: 0,
          status: ITEM_STATUS.PENDING,
          mrp: item.price != null ? Number(item.price) : undefined,
          packSize: String(item.variantSize || ''),
        };
      }),
    );
  }
}

async function confirmAndTagOrder(orderId: string): Promise<IOrder | null> {
  const order = await Order.findById(orderId);
  if (!order || order.status === 'cancelled') return order;

  const bagCode = order.bagCode || bagCodeForOrderNumber(order.orderNumber);
  const deliveryOtp = order.deliveryOtp || generateDeliveryOtp();
  const hubKey = order.offerHubKey || DEFAULT_HUB_KEY;
  const set: Record<string, unknown> = {
    bagCode,
    deliveryOtp,
    offerHubKey: hubKey,
  };

  if (order.status === 'pending') {
    set.status = 'confirmed';
    await Order.updateOne(
      { _id: order._id, status: 'pending' },
      {
        $set: set,
        $push: {
          timeline: {
            status: 'confirmed',
            timestamp: new Date(),
            note: 'Order confirmed by store',
            actor: 'system',
          },
        },
      },
    );
  } else {
    await Order.updateOne({ _id: order._id }, { $set: set });
  }

  return Order.findById(orderId);
}

export async function runPostOrderIntegrations(
  _userId: string,
  response: Record<string, unknown>,
  _paymentStatus?: string,
  _methodType?: string,
  _totalBill?: number,
): Promise<void> {
  const orderId = String(response.id || response._id || '');
  if (!orderId || !mongoose.isValidObjectId(orderId)) return;

  try {
    const confirmed = await confirmAndTagOrder(orderId);
    if (!confirmed || confirmed.status === 'cancelled') return;

    await reserveInventoryForOrder(confirmed);
    await createHhdPickTicket(confirmed);

    const hubKey = confirmed.offerHubKey || DEFAULT_HUB_KEY;
    eventBus.emit(EVENT_TYPES.ORDER_CREATED, {
      orderId: String(confirmed._id),
      orderNumber: confirmed.orderNumber,
      userId: String(confirmed.userId),
      hubKey,
      offerHubKey: hubKey,
      status: confirmed.status,
    });
    eventBus.emit(EVENT_TYPES.ORDER_CONFIRMED, {
      orderId: String(confirmed._id),
      orderNumber: confirmed.orderNumber,
      userId: String(confirmed.userId),
      hubKey,
      offerHubKey: hubKey,
      status: 'confirmed',
    });

    fireAndForget('notify-confirmed', () =>
      notifyCustomerOrderLifecycle(confirmed, 'confirmed', { actor: 'system' }),
    );
  } catch (err) {
    logger.error('[fulfillment] runPostOrderIntegrations failed', {
      orderId,
      error: (err as Error)?.message,
    });
  }
}

export async function markCustomerPicking(hhdOrderId: string): Promise<void> {
  const order = await findCustomerOrderByHhdOrderId(hhdOrderId);
  if (!order || order.status === 'cancelled') return;
  if (order.status !== 'confirmed') return;

  await Order.updateOne(
    { _id: order._id, status: 'confirmed' },
    {
      $set: { status: 'getting-packed' },
      $push: {
        timeline: {
          status: 'getting-packed',
          timestamp: new Date(),
          note: 'Order is being packed',
          actor: 'darkstore',
        },
      },
    },
  );

  eventBus.emit(EVENT_TYPES.ORDER_PICKING_STARTED, {
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    userId: String(order.userId),
    hubKey: order.offerHubKey || DEFAULT_HUB_KEY,
    offerHubKey: order.offerHubKey || DEFAULT_HUB_KEY,
    status: 'getting-packed',
  });
  const latest = await Order.findById(order._id);
  if (latest) {
    fireAndForget('notify-packing', () =>
      notifyCustomerOrderLifecycle(latest, 'getting-packed', { actor: 'darkstore' }),
    );
  }
}

export async function onHhdStatusChanged(hhdOrderId: string, hhdStatus: string): Promise<void> {
  if (PICKING_HHD_STATUSES.has(hhdStatus) || hhdStatus === ORDER_STATUS.PENDING) {
    if (hhdStatus !== ORDER_STATUS.PENDING) {
      await markCustomerPicking(hhdOrderId);
    }
  }
}

export async function completeHandover(input: {
  hhdOrderId: string;
  scannedBy: string;
  hub?: string | null;
  bagId?: string | null;
  packageId?: string | null;
  deviceId?: string | null;
  /** Rack / bay code shown to riders (e.g. Rack-D1-Slot3). Persisted on CustomerOrder.dispatchBay. */
  dispatchBay?: string | null;
  rackCode?: string | null;
}): Promise<{ orderNumber: string; customerOrderId: string; dispatchBay: string | null }> {
  const customer = await findCustomerOrderByHhdOrderId(input.hhdOrderId);
  if (!customer) {
    throw new AppError('Invalid order/package', 404, 'ORDER_NOT_FOUND');
  }
  if (customer.status === 'cancelled') {
    throw new AppError('This order has been cancelled', 409, 'ORDER_CANCELLED');
  }

  const existingHandover = await HHDAssignOrder.findOne({
    orderId: input.hhdOrderId,
    handedOver: true,
  }).lean();
  if (existingHandover || (customer.riderStage && HANDED_OVER_STAGES.includes(customer.riderStage))) {
    throw new AppError('Order already handed over', 409, 'ALREADY_HANDED_OVER');
  }

  if (!['confirmed', 'getting-packed'].includes(customer.status)) {
    throw new AppError('Order is not ready for handover', 409, 'WRONG_STATUS');
  }

  if (input.hub && customer.offerHubKey && input.hub !== customer.offerHubKey) {
    throw new AppError('This order does not belong to this hub', 409, 'WRONG_HUB');
  }

  const now = new Date();
  const bagCode = input.bagId || customer.bagCode || bagCodeForOrderNumber(customer.orderNumber);
  const dispatchBay =
    String(input.dispatchBay || input.rackCode || customer.dispatchBay || '').trim() || null;

  const claimed = await Order.findOneAndUpdate(
    {
      _id: customer._id,
      status: { $in: ['confirmed', 'getting-packed'] },
      $or: [{ riderStage: null }, { riderStage: { $exists: false } }],
    },
    {
      $set: {
        status: 'getting-packed',
        riderStage: 'offered',
        pickerId: null,
        bagCode,
        ...(dispatchBay ? { dispatchBay } : {}),
        offerHubKey: input.hub || customer.offerHubKey || DEFAULT_HUB_KEY,
        deliveryOtp: customer.deliveryOtp || generateDeliveryOtp(),
      },
      $push: {
        timeline: {
          status: 'getting-packed',
          timestamp: now,
          note: dispatchBay
            ? `Package racked at ${dispatchBay} — ready for rider pickup`
            : 'Package handed over for delivery',
          actor: 'darkstore',
        },
      },
    },
    { new: true },
  );

  if (!claimed) {
    throw new AppError('Order already handed over', 409, 'ALREADY_HANDED_OVER');
  }

  logger.info('[fulfillment] completeHandover offered to riders', {
    orderId: String(claimed._id),
    orderNumber: claimed.orderNumber,
    previousStatus: customer.status,
    nextStatus: claimed.status,
    riderStage: claimed.riderStage,
    pickerId: claimed.pickerId ? String(claimed.pickerId) : null,
    offerHubKey: claimed.offerHubKey || null,
    dispatchBay: claimed.dispatchBay || null,
    deliveryType: claimed.deliveryType || null,
    hubInput: input.hub || null,
    scannedBy: input.scannedBy,
  });

  await HHDAssignOrder.findOneAndUpdate(
    { orderId: input.hhdOrderId },
    {
      $set: {
        orderId: input.hhdOrderId,
        userId: new mongoose.Types.ObjectId(input.scannedBy),
        status: 'handed_off',
        completedAt: now,
        scannedBy: input.scannedBy,
        scannedAt: now,
        hub: input.hub || claimed.offerHubKey || undefined,
        bagId: bagCode,
        packageId: input.packageId || bagCode,
        customerOrderId: claimed._id,
        handedOver: true,
        deviceId: input.deviceId || undefined,
      },
    },
    { upsert: true },
  );

  const eventPayload = {
    orderId: String(claimed._id),
    orderNumber: claimed.orderNumber,
    userId: String(claimed.userId),
    bagCode,
    hubKey: claimed.offerHubKey || DEFAULT_HUB_KEY,
    offerHubKey: claimed.offerHubKey || DEFAULT_HUB_KEY,
    dispatchBay,
    rackCode: dispatchBay,
    status: claimed.status,
    riderStage: claimed.riderStage,
  };

  eventBus.emit(EVENT_TYPES.ORDER_HANDED_OVER, eventPayload);
  eventBus.emit(EVENT_TYPES.ORDER_HHD_SCANNED, eventPayload);
  eventBus.emit(EVENT_TYPES.ORDER_PICKED, eventPayload);

  fireAndForget('notify-handover', async () => {
    await notifyCustomerOrderLifecycle(claimed, 'getting-packed', { actor: 'darkstore', note: 'ready' });
    await notifyHubRiders(
      claimed,
      'New delivery available',
      dispatchBay
        ? `Order ${claimed.orderNumber} ready at ${dispatchBay}`
        : `Order ${claimed.orderNumber} is ready for pickup`,
    );
  });

  return {
    orderNumber: claimed.orderNumber,
    customerOrderId: String(claimed._id),
    dispatchBay,
  };
}

export async function onCustomerOrderCancelled(order: IOrder): Promise<void> {
  try {
    await releaseInventoryForOrder(order);
  } catch (err) {
    logger.warn('[fulfillment] inventory release on cancel failed', { error: (err as Error)?.message });
  }

  const hhdOrderId = String(order.orderNumber || '');
  if (hhdOrderId) {
    const hhd = await HHDOrder.findOne({ orderId: hhdOrderId });
    if (hhd && ![ORDER_STATUS.COMPLETED, ORDER_STATUS.HANDED_OFF].includes(hhd.status as never)) {
      await HHDItem.deleteMany({ orderId: hhdOrderId });
      await HHDOrder.deleteOne({ orderId: hhdOrderId });
    }
  }

  if (order.riderStage && ['offered', 'accepted'].includes(order.riderStage) && order.riderStage !== 'picked_up') {
    await Order.updateOne(
      { _id: order._id },
      { $set: { pickerId: null, riderStage: 'cancelled' } },
    );
  }

  eventBus.emit(EVENT_TYPES.ORDER_CANCELLED, {
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    userId: String(order.userId),
  });
  fireAndForget('notify-cancelled', () =>
    notifyCustomerOrderLifecycle(order, 'cancelled', { actor: 'customer' }),
  );
}

export async function notifyCustomerOrderLifecycle(
  order: IOrder | Record<string, unknown>,
  status: string,
  _opts?: { actor?: string; note?: string },
): Promise<void> {
  const userId = String((order as IOrder).userId || (order as { userId?: unknown }).userId || '');
  const orderNumber = String((order as IOrder).orderNumber || '');
  const orderId = String((order as IOrder)._id || '');
  if (!userId || !mongoose.isValidObjectId(userId)) return;

  const copy = customerNotificationCopy(status, orderNumber, _opts?.note);
  if (!copy) return;

  const dedupeKey = `order:${orderId}:${status}:${_opts?.note || 'default'}`;
  try {
    await Notification.create({
      userId: new mongoose.Types.ObjectId(userId),
      title: copy.title,
      body: copy.body,
      read: false,
      category: CATEGORIES.ORDER,
      data: { orderId, orderNumber, status, type: copy.type },
      dedupeKey,
      deliveryStatus: 'pending',
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code !== 11000) {
      logger.warn('[fulfillment] inbox notification failed', { error: (err as Error)?.message });
    }
  }

  try {
    const tokens = await PushToken.find({ userId, active: true }).lean();
    let delivered = 0;
    const attempted: string[] = [];
    const fcmTokens: string[] = [];
    for (const token of tokens) {
      if (token.platform === 'web' && token.webSubscription?.endpoint && token.webSubscription.keys?.p256dh && token.webSubscription.keys?.auth) {
        attempted.push('web-push');
        const result = await sendWebPush(
          {
            endpoint: token.webSubscription.endpoint,
            keys: { p256dh: token.webSubscription.keys.p256dh, auth: token.webSubscription.keys.auth },
          },
          { title: copy.title, body: copy.body, data: { orderId, orderNumber, status } },
        );
        if (result.sent) delivered += 1;
        else logger.warn('[fulfillment] web-push send failed', { error: result.error, orderId });
      } else if (token.token) {
        attempted.push(token.tokenType || 'fcm');
        fcmTokens.push(token.token);
      }
    }
    if (fcmTokens.length) {
      const sent = await sendToTokens(fcmTokens, {
        title: copy.title,
        body: copy.body,
        data: { orderId, orderNumber, status },
      });
      delivered += sent;
      if (sent === 0) {
        logger.warn('[fulfillment] FCM dispatch sent 0 messages', { orderId, tokens: fcmTokens.length });
      }
    }
    await Notification.updateOne(
      { dedupeKey },
      {
        $set: {
          deliveryStatus: delivered > 0 ? 'partial' : attempted.length ? 'failed' : 'skipped',
          channelsAttempted: attempted,
          failureReason: delivered > 0 ? null : attempted.includes('fcm') ? 'fcm_not_configured' : null,
        },
      },
    );
  } catch (err) {
    logger.warn('[fulfillment] push dispatch failed', { error: (err as Error)?.message });
  }
}

export async function notifyPaymentOutcome(
  order: IOrder,
  outcome: string,
  opts?: { reason?: string },
): Promise<void> {
  const status = outcome === 'success' ? 'confirmed' : 'payment_failed';
  await notifyCustomerOrderLifecycle(order, status, { note: opts?.reason || outcome });
}

async function notifyHubRiders(order: IOrder, title: string, body: string): Promise<void> {
  const hubKey = order.offerHubKey || DEFAULT_HUB_KEY;
  const { resolveWarehouseKey } = await import('../picker/picker.hub');
  const candidates = await PickerUser.find({
    status: 'ACTIVE',
    $or: [{ workforceRole: 'rider' }, { workforceRole: { $exists: false } }, { workforceRole: null }],
  })
    .select('_id currentLocationId')
    .limit(100)
    .lean();

  const matched: mongoose.Types.ObjectId[] = [];
  for (const rider of candidates) {
    const raw = rider.currentLocationId ? String(rider.currentLocationId) : '';
    if (!raw || raw === hubKey) {
      matched.push(rider._id as mongoose.Types.ObjectId);
      continue;
    }
    const resolved = await resolveWarehouseKey(raw, { fallbackToDefault: false });
    if (resolved === hubKey) {
      matched.push(rider._id as mongoose.Types.ObjectId);
    }
  }

  if (!matched.length) return;
  await PickerNotification.insertMany(
    matched.map((riderId) => ({
      userId: riderId,
      type: 'order.handed_over',
      title,
      body,
      data: { orderId: String(order._id), orderNumber: order.orderNumber, hubKey },
      read: false,
    })),
  );
}

function customerNotificationCopy(
  status: string,
  orderNumber: string,
  note?: string,
): { title: string; body: string; type: string } | null {
  const num = orderNumber || 'your order';
  if (status === 'confirmed') {
    return { title: 'Order confirmed', body: `Order ${num} is confirmed and will be packed shortly.`, type: 'ORDER_CONFIRMED' };
  }
  if (status === 'getting-packed' && note === 'ready') {
    return { title: 'Order ready', body: `Order ${num} is packed and ready for delivery.`, type: 'ORDER_PACKED' };
  }
  if (status === 'getting-packed') {
    return { title: 'Picking started', body: `We have started packing order ${num}.`, type: 'ORDER_PACKED' };
  }
  if (status === 'on-the-way') {
    return { title: 'Out for delivery', body: `Order ${num} is on the way.`, type: 'ORDER_ON_WAY' };
  }
  if (status === 'arrived') {
    return { title: 'Rider arrived', body: `Your delivery partner has arrived with order ${num}.`, type: 'ORDER_ARRIVED' };
  }
  if (status === 'delivered') {
    return { title: 'Order delivered', body: `Order ${num} has been delivered.`, type: 'ORDER_DELIVERED' };
  }
  if (status === 'cancelled') {
    return { title: 'Order cancelled', body: `Order ${num} was cancelled.`, type: 'ORDER_CANCELLED' };
  }
  if (status === 'payment_failed') {
    const why = note?.trim() ? ` ${note.trim()}` : '';
    return {
      title: 'Payment failed',
      body: `Payment for order ${num} was not completed.${why} You can retry from checkout.`,
      type: 'PAYMENT_FAILED',
    };
  }
  if (status === 'accepted') {
    return { title: 'Rider assigned', body: `A rider has been assigned to order ${num}.`, type: 'ORDER_ON_WAY' };
  }
  return null;
}

export async function attachTrackingDetails(
  order: Record<string, unknown>,
  formatted: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  formatted.riderStage = order.riderStage || null;
  formatted.bagCode = order.bagCode || null;
  formatted.pickerId = order.pickerId ? String(order.pickerId) : null;
  formatted.offerHubKey = order.offerHubKey || null;
  formatted.dispatchBay = order.dispatchBay || null;

  const pickerId = order.pickerId ? String(order.pickerId) : '';
  if (pickerId && mongoose.isValidObjectId(pickerId)) {
    const rider = (await PickerUser.findById(pickerId)
      .select('name phone phoneIsPlaceholder photoUri ratingSum ratingCount vehicleType')
      .lean()) as {
      name?: string;
      phone?: string;
      phoneIsPlaceholder?: boolean;
      photoUri?: string;
      ratingSum?: number;
      ratingCount?: number;
      vehicleType?: string;
    } | null;

    if (rider) {
      const ratingCount = Number(rider.ratingCount) || 0;
      formatted.deliveryPartner = {
        id: pickerId,
        name: rider.name || 'Delivery partner',
        phone: rider.phoneIsPlaceholder ? null : rider.phone || null,
        photoUri: rider.photoUri || null,
        vehicleType: rider.vehicleType || null,
        rating: ratingCount > 0 ? Math.round((Number(rider.ratingSum || 0) / ratingCount) * 10) / 10 : null,
      };
    }

    const ping = await PickerLocationPing.findOne({
      $or: [{ orderId: order._id }, { pickerId: new mongoose.Types.ObjectId(pickerId) }],
    })
      .sort({ recordedAt: -1 })
      .lean();
    if (ping) {
      formatted.riderLocation = {
        latitude: ping.latitude,
        longitude: ping.longitude,
        accuracy: ping.accuracy ?? null,
        heading: ping.heading ?? null,
        recordedAt: ping.recordedAt,
      };
    }
  }

  const deliveryAddress = order.deliveryAddress as Record<string, unknown> | undefined;
  const destination = mapPoint(deliveryAddress?.latitude, deliveryAddress?.longitude);
  if (destination) formatted.destination = destination;

  const storeId = order.storeId ? String(order.storeId) : '';
  if (storeId && mongoose.isValidObjectId(storeId)) {
    const store = await DarkStore.findById(storeId).select('name location').lean();
    const coords = store?.location?.coordinates;
    const storePoint = coords && coords.length >= 2 ? mapPoint(coords[1], coords[0]) : null;
    if (storePoint) {
      formatted.storeLocation = { ...storePoint, name: store?.name || 'Selorg store' };
    }
  }

  return formatted;
}

function mapPoint(lat: unknown, lng: unknown): { latitude: number; longitude: number } | null {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

export async function notifyRiderAccepted(order: IOrder): Promise<void> {
  eventBus.emit(EVENT_TYPES.ORDER_RIDER_ACCEPTED, {
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    userId: String(order.userId),
    pickerId: String(order.pickerId || ''),
    hubKey: order.offerHubKey || DEFAULT_HUB_KEY,
    offerHubKey: order.offerHubKey || DEFAULT_HUB_KEY,
    dispatchBay: order.dispatchBay || null,
    status: order.status,
    riderStage: order.riderStage,
  });
  fireAndForget('notify-rider-accepted', () =>
    notifyCustomerOrderLifecycle(order, 'accepted', { actor: 'rider' }),
  );
}

export async function notifyOutForDelivery(order: IOrder): Promise<void> {
  eventBus.emit(EVENT_TYPES.ORDER_OUT_FOR_DELIVERY, {
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    userId: String(order.userId),
    hubKey: order.offerHubKey || DEFAULT_HUB_KEY,
    offerHubKey: order.offerHubKey || DEFAULT_HUB_KEY,
    status: 'on-the-way',
    riderStage: order.riderStage,
  });
  fireAndForget('notify-ofd', () =>
    notifyCustomerOrderLifecycle(order, 'on-the-way', { actor: 'rider' }),
  );
}

export async function notifyDelivered(order: IOrder): Promise<void> {
  eventBus.emit(EVENT_TYPES.ORDER_DELIVERED, {
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    userId: String(order.userId),
    status: 'delivered',
  });
  fireAndForget('consume-inventory', () => consumeInventoryForDeliveredOrder(order));
  fireAndForget('notify-delivered', () =>
    notifyCustomerOrderLifecycle(order, 'delivered', { actor: 'rider' }),
  );
}

export async function resolveHhdHub(userId?: string | null): Promise<string | null> {
  if (!userId || !mongoose.isValidObjectId(userId)) return null;
  const user = await HHDUser.findById(userId).select('warehouse darkstore').lean();
  return (user?.warehouse || user?.darkstore || null) as string | null;
}
