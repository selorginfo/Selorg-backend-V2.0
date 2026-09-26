import mongoose from 'mongoose';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/AppError';
import { eventBus } from '../../events/eventBus';
import { orderRealtime } from '../../realtime/orderRealtime';
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
  if (order.status === 'cancelled' || order.fulfillmentStage === 'cancelled') {
    throw new AppError('This order has been cancelled', 409, 'ORDER_CANCELLED');
  }
  if (order.status === 'delivered' || order.fulfillmentStage === 'delivered') {
    throw new AppError('This order is already delivered', 409, 'ORDER_DELIVERED');
  }
  const paymentReady = order.paymentStatus === 'paid' || order.paymentStatus === 'cod_pending';
  if (!paymentReady) {
    throw new AppError('Payment is not confirmed — cannot pick this order', 409, 'PAYMENT_NOT_CONFIRMED');
  }
  // Waiting-for-picker or already accepted by this flow.
  if (!['confirmed', 'getting-packed'].includes(order.status) && order.fulfillmentStage !== 'confirmed' && order.fulfillmentStage !== 'picker_accepted') {
    throw new AppError(`Order cannot be picked in status ${order.status}`, 409, 'WRONG_STATUS');
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

  // Reserve a bag label for ops, but bagScannedAt stays null until HSD scans the bag.
  const bagCode = order.bagCode || bagCodeForOrderNumber(order.orderNumber);
  const deliveryOtp = order.deliveryOtp || generateDeliveryOtp();
  const hubKey = order.offerHubKey || DEFAULT_HUB_KEY;
  const set: Record<string, unknown> = {
    bagCode,
    deliveryOtp,
    offerHubKey: hubKey,
    fulfillmentStage: 'confirmed',
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
            note: 'Order confirmed — waiting for picker',
            actor: 'system',
          },
        },
      },
    );
  } else {
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          ...set,
          ...(order.fulfillmentStage ? {} : { fulfillmentStage: 'confirmed' }),
        },
      },
    );
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

export async function markCustomerPicking(
  hhdOrderId: string,
  opts?: {
    hhdUserId?: string;
    hhdUserName?: string;
    hsdDeviceId?: string | null;
    hsdSessionId?: string | null;
    pickerShiftId?: string | null;
  },
): Promise<void> {
  const order = await findCustomerOrderByHhdOrderId(hhdOrderId);
  if (!order || order.status === 'cancelled') return;

  const { applyFulfillmentTransition } = await import('./order-lifecycle.apply');
  const { deriveFulfillmentStage } = await import('./order-lifecycle');

  const hhdUserId =
    opts?.hhdUserId && mongoose.Types.ObjectId.isValid(opts.hhdUserId)
      ? new mongoose.Types.ObjectId(opts.hhdUserId)
      : null;
  const pickerName = String(opts?.hhdUserName || '').trim() || 'HSD Operator';
  const stage = deriveFulfillmentStage(order);

  // Attach HSD assignee even if already past confirmed (idempotent claim).
  const setFields: Record<string, unknown> = {};
  if (hhdUserId) {
    setFields.hhdUserId = hhdUserId;
    setFields['adminFulfillment.pickerName'] = pickerName;
  }
  if (opts?.hsdDeviceId) setFields.hsdDeviceId = opts.hsdDeviceId;
  if (opts?.hsdSessionId) setFields.hsdSessionId = opts.hsdSessionId;
  if (opts?.pickerShiftId) setFields.pickerShiftId = opts.pickerShiftId;

  if (stage === 'confirmed' || stage === 'pending') {
    await applyFulfillmentTransition({
      orderId: String(order._id),
      to: 'picker_accepted',
      actor: hhdUserId ? `hsd:${opts?.hhdUserId}` : 'darkstore',
      actorUserId: opts?.hhdUserId,
      note: hhdUserId ? `Picker accepted — packing started by ${pickerName}` : 'Picker accepted',
      requireFrom: stage === 'pending' ? ['pending', 'confirmed'] : ['confirmed'],
      set: setFields,
    });
    return;
  }

  if (Object.keys(setFields).length) {
    await Order.updateOne({ _id: order._id }, { $set: setFields });
  }
}

/** Sync customer_orders line itemStatus from HSD pick scans (Admin order detail). */
export async function syncCustomerItemPicked(
  hhdOrderId: string,
  itemCode: string,
  opts?: { scannedQuantity?: number; quantity?: number },
): Promise<void> {
  const order = await findCustomerOrderByHhdOrderId(hhdOrderId);
  if (!order || !Array.isArray(order.items) || !order.items.length) return;

  const code = String(itemCode || '').trim();
  if (!code) return;

  const qtyDone =
    opts?.quantity != null && opts?.scannedQuantity != null
      ? Number(opts.scannedQuantity) >= Number(opts.quantity)
      : true;
  if (!qtyDone) return;

  // Resolve productId(s) for this HHD itemCode (SKU or product ObjectId).
  const productIds = new Set<string>();
  if (mongoose.Types.ObjectId.isValid(code)) productIds.add(code);
  const bySku = await Product.find({ sku: new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
    .select('_id')
    .lean();
  for (const p of bySku) productIds.add(String(p._id));

  let matched = false;
  const nextItems = order.items.map((it: Record<string, unknown>) => {
    const productId = String(it.productId || '');
    const sku = String(it.sku || it.itemCode || it.productSku || '').trim();
    const hit =
      productIds.has(productId) ||
      productId.toLowerCase() === code.toLowerCase() ||
      (sku.length > 0 && sku.toLowerCase() === code.toLowerCase()) ||
      (order.items.length === 1 && String(it.itemStatus || 'pending') === 'pending');
    if (!hit) return it;
    matched = true;
    if (String(it.itemStatus || 'pending') === 'picked') return it;
    return { ...it, itemStatus: 'picked' };
  });

  // Single-line order fallback: HSD scanned the only line.
  if (!matched && order.items.length === 1) {
    const it = order.items[0] as Record<string, unknown>;
    nextItems[0] = { ...it, itemStatus: 'picked' };
    matched = true;
  }

  if (!matched) return;

  // Prefer positional $set so Mongoose subdocs update reliably.
  const setOps: Record<string, unknown> = {};
  nextItems.forEach((it, idx) => {
    if (String((it as Record<string, unknown>).itemStatus) === 'picked') {
      setOps[`items.${idx}.itemStatus`] = 'picked';
    }
  });
  if (Object.keys(setOps).length) {
    await Order.updateOne({ _id: order._id }, { $set: setOps });
  } else {
    await Order.updateOne({ _id: order._id }, { $set: { items: nextItems } });
  }
}

export async function onHhdStatusChanged(hhdOrderId: string, hhdStatus: string): Promise<void> {
  if (hhdStatus === ORDER_STATUS.HANDED_OFF) return;

  if (hhdStatus === ORDER_STATUS.BAG_SCANNED) {
    const customer = await findCustomerOrderByHhdOrderId(hhdOrderId);
    if (customer) {
      const hhd = await HHDOrder.findOne({ orderId: hhdOrderId }).select('bagId').lean();
      const bag = String(hhd?.bagId || customer.bagCode || '').trim();
      await Order.updateOne(
        { _id: customer._id },
        {
          $set: {
            ...(bag ? { bagCode: bag } : {}),
            bagScannedAt: new Date(),
          },
        },
      );
    }
  }

  if (PICKING_HHD_STATUSES.has(hhdStatus)) {
    await markCustomerPicking(hhdOrderId);
    if (hhdStatus === ORDER_STATUS.RACK_ASSIGNED || hhdStatus === ORDER_STATUS.PHOTO_VERIFIED) {
      const hhd = await HHDOrder.findOne({ orderId: hhdOrderId }).select('rackLocation targetRackCode').lean();
      const bay = String(hhd?.rackLocation || hhd?.targetRackCode || '').trim();
      const customer = await findCustomerOrderByHhdOrderId(hhdOrderId);
      if (customer && bay) {
        await Order.updateOne(
          { _id: customer._id },
          { $set: { dispatchBay: bay, ...(hhdStatus === ORDER_STATUS.RACK_ASSIGNED ? { rackedAt: new Date() } : {}) } },
        );
      }
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

  const paymentReady = customer.paymentStatus === 'paid' || customer.paymentStatus === 'cod_pending';
  const { deriveFulfillmentStage } = await import('./order-lifecycle');
  const { applyFulfillmentTransition } = await import('./order-lifecycle.apply');
  const stage = deriveFulfillmentStage(customer);
  if (!paymentReady || !['confirmed', 'picker_accepted', 'packed_in_rack'].includes(stage)) {
    if (!['confirmed', 'getting-packed'].includes(customer.status) || !paymentReady) {
      throw new AppError('Order is not ready for handover', 409, 'WRONG_STATUS');
    }
  }
  if (stage === 'packed_in_rack' && customer.riderStage === 'offered') {
    throw new AppError('Order already handed over', 409, 'ALREADY_HANDED_OVER');
  }

  if (input.hub && customer.offerHubKey && input.hub !== customer.offerHubKey) {
    throw new AppError('This order does not belong to this hub', 409, 'WRONG_HUB');
  }

  const now = new Date();
  const bagCode = input.bagId || customer.bagCode || bagCodeForOrderNumber(customer.orderNumber);
  const dispatchBay =
    String(input.dispatchBay || input.rackCode || customer.dispatchBay || '').trim() || null;

  const { pickerConfig } = await import('../picker/picker.config');
  const offerExpiresAt = new Date(now.getTime() + pickerConfig.offerExpirySeconds * 1000);

  let claimed: IOrder;
  try {
    claimed = await applyFulfillmentTransition({
      orderId: String(customer._id),
      to: 'packed_in_rack',
      actor: `hsd:${input.scannedBy}`,
      actorUserId: input.scannedBy,
      note: dispatchBay
        ? `Packed & placed in rack ${dispatchBay} — waiting for rider`
        : 'Packed & placed in rack — waiting for rider',
      requireFrom: ['picker_accepted', 'packed_in_rack'],
      set: {
        pickerId: null,
        riderId: null,
        bagCode,
        bagScannedAt: customer.bagScannedAt || now,
        rackedAt: now,
        ...(dispatchBay ? { dispatchBay } : {}),
        offerHubKey: input.hub || customer.offerHubKey || DEFAULT_HUB_KEY,
        deliveryOtp: customer.deliveryOtp || generateDeliveryOtp(),
        offerExpiresAt,
        ...(input.deviceId ? { hsdDeviceId: input.deviceId } : {}),
      },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'INVALID_FULFILLMENT_TRANSITION' || code === 'WRONG_FULFILLMENT_STAGE') {
      throw new AppError('Order already handed over', 409, 'ALREADY_HANDED_OVER');
    }
    throw err;
  }

  logger.info('[fulfillment] completeHandover offered to riders', {
    orderId: String(claimed._id),
    orderNumber: claimed.orderNumber,
    previousStatus: customer.status,
    nextStatus: claimed.status,
    fulfillmentStage: claimed.fulfillmentStage,
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
    fulfillmentStage: claimed.fulfillmentStage,
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
    const { tryFormBulkBatch } = await import('../delivery/bulk-detect.service');
    await tryFormBulkBatch(claimed.offerHubKey || DEFAULT_HUB_KEY);
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
    const created = await Notification.create({
      userId: new mongoose.Types.ObjectId(userId),
      title: copy.title,
      body: copy.body,
      read: false,
      category: CATEGORIES.ORDER,
      data: { orderId, orderNumber, status, type: copy.type },
      dedupeKey,
      deliveryStatus: 'pending',
    });
    orderRealtime.publishInboxNotification(userId, created);
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
    isOnline: true,
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

/** Push the latest rider fix to the customer watching this order. */
export async function broadcastRiderGps(
  pickerId: string,
  latitude: number,
  longitude: number,
  orderId?: string | null,
  heading?: number | null,
): Promise<void> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  let id = orderId && mongoose.isValidObjectId(orderId) ? String(orderId) : '';
  let userId: string | null = null;
  if (id) {
    const order = await Order.findById(id).select('userId status').lean();
    if (!order || order.status === 'delivered' || order.status === 'cancelled') return;
    userId = order.userId ? String(order.userId) : null;
  } else if (mongoose.isValidObjectId(pickerId)) {
    const order = await Order.findOne({
      pickerId: new mongoose.Types.ObjectId(pickerId),
      status: { $in: ['confirmed', 'getting-packed', 'on-the-way', 'arrived'] },
    })
      .sort({ updatedAt: -1 })
      .select('_id userId')
      .lean();
    if (!order) return;
    id = String(order._id);
    userId = order.userId ? String(order.userId) : null;
  }
  if (!id) return;
  orderRealtime.emitRiderGps({ orderId: id, userId, latitude, longitude, heading });
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
