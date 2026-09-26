import mongoose from 'mongoose';
import { Order, type IOrder, type RiderCancelReason } from '../orders/order.model';
import { PickerUser, PickerWorkLocation } from './picker.models';
import { PickerPodPhoto, PickerLocationPing } from './picker.rider.models';
import { AppError } from '../../utils/AppError';
import { pickerConfig } from './picker.config';
import {
  distanceDisplay, durationDisplay, formatAddressLine, haversineKm, hasCoords, maskPhone, dialablePhone,
  orderDisplayNumbers, relativeDateTimeDisplay, hubDayStart, hubDayEnd, parseHubDate,
} from './picker.format';
import { getCashInHand, recordCodCollection } from './picker.cash.service';
import { creditEarnings } from './picker.service';
import { assertRiderFreeForNewOrder, deliveryPaymentAllowed } from './rider-lock';
import { storeProofOfDeliveryPhoto } from './picker.upload.service';
import { logger } from '../../utils/logger';
import * as fulfillment from '../orders/fulfillment.service';
import { DEFAULT_HUB_KEY } from '../orders/fulfillment.service';
import { normalizeRiderHubKey } from './picker.hub';
import { HHDOrder } from '../hhd/hhd.models';

/**
 * Standard (single-drop) delivery flow: APIs 26–31 and 45.
 *
 * The rider lifecycle lives on `Order.riderStage`, deliberately separate from the
 * customer-facing `Order.status`. `accepted` and `picked_up` have no customer
 * meaning, and a rider cancellation returns the order to the hub rather than
 * cancelling it — collapsing the two would break the customer app's enum.
 */

/** Order states whose parcel is physically ready for a rider to take. */
const OFFERABLE_ORDER_STATUSES = ['confirmed', 'getting-packed'];
const MAX_OTP_ATTEMPTS = 5;

/** Prefer CustomerOrder.dispatchBay; fall back to HHD rackLocation for older tickets. */
async function resolveDispatchBay(order: { dispatchBay?: string | null; orderNumber?: string; _id?: unknown }): Promise<string | null> {
  const direct = String(order.dispatchBay || '').trim();
  if (direct) return direct;
  const hhdOrderId = String(order.orderNumber || '');
  if (!hhdOrderId) return null;
  const hhd = await HHDOrder.findOne({ orderId: hhdOrderId }).select('rackLocation targetRackCode').lean();
  const rack = String(hhd?.rackLocation || hhd?.targetRackCode || '').trim();
  return rack || null;
}

// ─── Derived per-order values ─────────────────────────────────────────────────

/**
 * Straight-line hub→drop distance. Returns null when either end lacks
 * coordinates; unlike `dispatch.service.calculateDistance` this never falls back
 * to an address hash, because the figure is shown to the rider as a real distance.
 */
function computeDistanceKm(
  hub: { latitude?: number | null; longitude?: number | null } | null,
  address?: { latitude?: number; longitude?: number } | null,
): number | null {
  if (!hub || !hasCoords(hub.latitude, hub.longitude)) return null;
  if (!address || !hasCoords(address.latitude, address.longitude)) return null;
  const km = haversineKm(hub.latitude as number, hub.longitude as number, address.latitude as number, address.longitude as number);
  return Math.round(km * 10) / 10;
}

function computeEtaMinutes(distanceKm: number | null): number | null {
  if (distanceKm == null) return null;
  return Math.max(1, Math.round(distanceKm * pickerConfig.minutesPerKm + pickerConfig.minutesPerStopBuffer));
}

/**
 * Rider payout: a flat base plus a per-km component, using the same constants the
 * admin dispatch view already estimates with, so the two agree.
 */
export function computeRiderPayout(distanceKm: number | null): { total: number; base: number; distance: number } {
  const base = pickerConfig.payoutBase;
  const distance = Math.round((distanceKm ?? 0) * pickerConfig.payoutPerKm);
  return { total: base + distance, base, distance };
}

/** `cod` when money is still owed at the door, otherwise `prepaid`. */
function paymentModeOf(order: Pick<IOrder, 'paymentStatus' | 'paymentMethod'>): 'cod' | 'prepaid' {
  if (order.paymentStatus === 'paid') return 'prepaid';
  const methodType = order.paymentMethod?.methodType;
  return order.paymentStatus === 'cod_pending' || methodType === 'cash' ? 'cod' : 'prepaid';
}

function codAmountOf(order: Pick<IOrder, 'paymentStatus' | 'paymentMethod' | 'totalBill' | 'onlineAmountDue'>): number | null {
  if (paymentModeOf(order) !== 'cod') return null;
  // `onlineAmountDue` is already settled online; the rider collects the remainder.
  const due = Math.round((order.totalBill || 0) - (order.onlineAmountDue || 0));
  return Math.max(0, due);
}

/** `"SG-2048-A"` — the bag label `BagScreen` renders. */
function bagCodeFor(order: { orderNumber?: string; bagCode?: string }): string {
  if (order.bagCode) return order.bagCode;
  const { raw } = orderDisplayNumbers(order.orderNumber);
  return `SG-${raw}-A`;
}

async function resolveHubForOrder(order: Pick<IOrder, 'offerHubKey'>): Promise<{
  key: string | null; name: string; address: string | null; latitude: number | null; longitude: number | null;
}> {
  const fallback = { key: null, name: 'Selorg Darkstore', address: null, latitude: null, longitude: null };
  if (!order.offerHubKey) return fallback;

  const hub = (await PickerWorkLocation.findOne({ warehouseKey: order.offerHubKey })
    .select('warehouseKey name address coordinates')
    .lean()) as any;
  if (!hub) return fallback;

  return {
    key: hub.warehouseKey,
    name: hub.name,
    address: hub.address || null,
    latitude: hub.coordinates?.latitude ?? null,
    longitude: hub.coordinates?.longitude ?? null,
  };
}

// ─── Available orders (API 26) ────────────────────────────────────────────────

export interface AvailableOrderDto {
  id: string;
  num: string;
  raw: string;
  payout: number;
  pickup: string;
  bay: string | null;
  deliver: string;
  distanceKm: number | null;
  distance: string | null;
  etaMinutes: number | null;
  time: string | null;
  items: number;
  priority: boolean;
  paymentMode: 'cod' | 'prepaid';
  codAmount: number | null;
  assignedToMe: boolean;
  riderStage: string;
  expiresAt: string | null;
}

async function toAvailableOrderDto(order: any, pickerId: string, hubName: string): Promise<AvailableOrderDto> {
  const { num, raw } = orderDisplayNumbers(order.orderNumber, String(order._id));
  const distanceKm = order.distanceKm ?? null;
  const etaMinutes = order.etaMinutes ?? computeEtaMinutes(distanceKm);
  const bay = await resolveDispatchBay(order);

  return {
    id: String(order._id),
    num,
    raw,
    payout: Math.round(order.riderPayout || computeRiderPayout(distanceKm).total),
    pickup: hubName,
    bay,
    deliver: formatAddressLine(order.deliveryAddress),
    distanceKm,
    distance: distanceDisplay(distanceKm),
    etaMinutes,
    time: durationDisplay(etaMinutes),
    items: Array.isArray(order.items) ? order.items.length : 0,
    priority: Boolean(order.isPriority),
    paymentMode: paymentModeOf(order),
    codAmount: codAmountOf(order),
    assignedToMe: String(order.pickerId || '') === pickerId,
    riderStage: order.riderStage || 'offered',
    expiresAt: order.offerExpiresAt ? new Date(order.offerExpiresAt).toISOString() : null,
  };
}

/**
 * The rider's Live Orders feed: unclaimed offers at their hub plus their own
 * in-progress order, so the screen renders both sections from one call.
 *
 * Orders with no `offerHubKey` are included because hub tagging is applied by the
 * admin dispatch pipeline and legacy/untagged orders would otherwise be
 * invisible to every rider. Orders tagged for a *different* hub are excluded.
 */
function riderHubClause(hubKey: string): Record<string, unknown> {
  const hub = String(hubKey || '').trim() || DEFAULT_HUB_KEY;
  const clause: Record<string, unknown>[] = [{ offerHubKey: hub }];
  if (hub === DEFAULT_HUB_KEY) {
    clause.push({ offerHubKey: null }, { offerHubKey: { $exists: false } });
  }
  return { $or: clause };
}

export async function listAvailableOrders(
  pickerId: string,
  params: { scope: 'available' | 'mine' | 'all'; page: number; limit: number },
): Promise<{ orders: AvailableOrderDto[]; total: number; page: number; limit: number; totalPages: number }> {
  const userId = new mongoose.Types.ObjectId(pickerId);
  const user = (await PickerUser.findById(pickerId).select('isOnline currentLocationId deliveryMode').lean()) as any;
  if (!user) throw AppError.notFound('Picker');

  // ObjectId / orphan hub refs must resolve to the same warehouseKey CustomerOrder.offerHubKey uses.
  const riderHubKey = await normalizeRiderHubKey(pickerId, user.currentLocationId);

  if (!user.isOnline && params.scope === 'available') {
    throw new AppError('Go online to see available orders.', 403, 'RIDER_OFFLINE');
  }
  if (!user.isOnline && params.scope === 'all') {
    logger.info('[rider-orders] scope=all demoted to mine because rider is offline', {
      pickerId,
      currentLocationId: user.currentLocationId || null,
      riderHubKey,
      deliveryMode: user.deliveryMode || null,
    });
    params = { ...params, scope: 'mine' };
  }

  const mineFilter = { pickerId: userId, riderStage: { $in: ['accepted', 'picked_up'] } };
  const availableFilter = {
    pickerId: null,
    riderStage: 'offered',
    status: { $in: OFFERABLE_ORDER_STATUSES },
    deliveryType: user.deliveryMode === 'bulk' ? 'bulk' : 'standard',
    $and: [
      riderHubClause(riderHubKey),
      { $or: [{ offerExpiresAt: null }, { offerExpiresAt: { $gt: new Date() } }] },
    ],
  };

  let query: Record<string, unknown>;
  if (params.scope === 'mine') query = mineFilter;
  else if (params.scope === 'available') query = availableFilter;
  else query = { $or: [mineFilter, availableFilter] };

  const skip = (params.page - 1) * params.limit;
  const [rows, total, offeredAtHub, offeredAny] = await Promise.all([
    // Own orders first so the active card is never paged out of view.
    Order.find(query).sort({ pickerId: -1, isPriority: -1, createdAt: 1 }).skip(skip).limit(params.limit).lean(),
    Order.countDocuments(query),
    Order.countDocuments(availableFilter),
    Order.countDocuments({
      pickerId: null,
      riderStage: 'offered',
      status: { $in: OFFERABLE_ORDER_STATUSES },
    }),
  ]);

  logger.info('[rider-orders] listAvailableOrders', {
    pickerId,
    scope: params.scope,
    isOnline: Boolean(user.isOnline),
    currentLocationId: user.currentLocationId || null,
    riderHubKey,
    deliveryMode: user.deliveryMode || null,
    hubClause: riderHubClause(riderHubKey),
    returned: rows.length,
    total,
    offeredMatchingRiderFilters: offeredAtHub,
    offeredAnyHubOrType: offeredAny,
  });

  const hubKeys = Array.from(new Set((rows as any[]).map((o) => o.offerHubKey).filter(Boolean)));
  const hubs = (await PickerWorkLocation.find({ warehouseKey: { $in: hubKeys } }).select('warehouseKey name').lean()) as Array<{ warehouseKey: string; name: string }>;
  const hubNameByKey = new Map(hubs.map((h) => [h.warehouseKey, h.name]));

  const orders = await Promise.all(
    (rows as any[]).map((order) =>
      toAvailableOrderDto(order, pickerId, hubNameByKey.get(order.offerHubKey) || 'Selorg Darkstore'),
    ),
  );

  return { orders, total, page: params.page, limit: params.limit, totalPages: Math.max(1, Math.ceil(total / params.limit)) };
}

// ─── Order detail / bag manifest (API 27) ─────────────────────────────────────

/**
 * Loads an order the caller is entitled to see: their own, or one still on offer.
 * Anything else is a 403 rather than a 404, so a rider cannot enumerate order ids.
 */
async function loadOrderForRider(orderId: string, pickerId: string, opts: { mustOwn?: boolean } = {}): Promise<any> {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');

  const isMine = String(order.pickerId || '') === pickerId;
  if (opts.mustOwn && !isMine) {
    throw new AppError('This order is not assigned to you.', 403, 'NOT_ASSIGNED_TO_RIDER');
  }
  if (!isMine && order.pickerId) {
    throw new AppError('This order is not assigned to you.', 403, 'NOT_ASSIGNED_TO_RIDER');
  }
  return order;
}

export async function getOrderDetail(orderId: string, pickerId: string) {
  const order = await loadOrderForRider(orderId, pickerId);
  const hub = await resolveHubForOrder(order);

  const distanceKm = order.distanceKm ?? computeDistanceKm(hub, order.deliveryAddress);
  const etaMinutes = order.etaMinutes ?? computeEtaMinutes(distanceKm);
  const { num, raw } = orderDisplayNumbers(order.orderNumber, String(order._id));

  const customer = (await mongoose.connection
    .collection('customer_users')
    .findOne({ _id: order.userId }, { projection: { name: 1, mobile: 1, phone: 1 } })) as any;

  const bay = await resolveDispatchBay(order);

  return {
    id: String(order._id),
    num,
    raw,
    riderStage: order.riderStage || 'offered',
    status: order.status,
    bagCode: bagCodeFor(order),
    bay,
    items: (order.items || []).map((item: any) => ({
      id: String(item._id),
      name: item.productName || 'Item',
      // `"2 bunches"` — quantity plus the pack size, as the manifest renders it.
      qty: [item.quantity, item.variantSize].filter(Boolean).join(' ').trim() || String(item.quantity ?? 1),
      quantity: item.quantity ?? 1,
      image: item.image || null,
      itemStatus: item.itemStatus || 'pending',
    })),
    pickup: {
      name: hub.name,
      address: hub.address,
      latitude: hub.latitude,
      longitude: hub.longitude,
    },
    customer: {
      name: customer?.name || 'Customer',
      maskedPhone: maskPhone(customer?.mobile || customer?.phone),
      phoneMasked: maskPhone(customer?.mobile || customer?.phone),
      phone: ['accepted', 'picked_up'].includes(String(order.riderStage || ''))
        ? dialablePhone(customer?.mobile || customer?.phone)
        : undefined,
    },
    delivery: {
      address: formatAddressLine(order.deliveryAddress),
      landmark: order.deliveryAddress?.landmark || null,
      latitude: order.deliveryAddress?.latitude ?? null,
      longitude: order.deliveryAddress?.longitude ?? null,
    },
    payout: Math.round(order.riderPayout || computeRiderPayout(distanceKm).total),
    paymentMode: paymentModeOf(order),
    codAmount: codAmountOf(order),
    distanceKm,
    etaMinutes,
  };
}

// ─── Status transitions (API 28) ──────────────────────────────────────────────

/**
 * Legal rider-stage transitions. `delivered` is intentionally absent: it is only
 * reachable through the OTP-verified completion endpoint (API 30).
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  offered: ['accepted'],
  accepted: ['picked_up', 'cancelled'],
  picked_up: ['cancelled'],
  delivered: [],
  cancelled: [],
};

export interface OrderStatusResultDto {
  id: string;
  riderStage: string;
  status: string;
  updatedAt: string;
  cancellation?: { reason: string | null; note: string | null; reassigned: boolean };
}

export async function updateOrderStatus(
  pickerId: string,
  orderId: string,
  input: {
    status: 'accepted' | 'picked_up' | 'cancelled';
    reason?: RiderCancelReason;
    note?: string;
    itemsVerified?: boolean;
    location?: { latitude: number; longitude: number };
  },
): Promise<OrderStatusResultDto> {
  if (input.status === 'accepted') return acceptOrder(pickerId, orderId);
  if (input.status === 'picked_up') return confirmPickup(pickerId, orderId, input);
  return cancelOrder(pickerId, orderId, input);
}

/**
 * Claims an offered order.
 *
 * The claim is a single conditional `findOneAndUpdate` on `pickerId: null`, which
 * is what makes it safe under contention: exactly one of two concurrent riders
 * matches, and the loser gets `409 ORDER_ALREADY_ASSIGNED`.
 */
async function acceptOrder(pickerId: string, orderId: string): Promise<OrderStatusResultDto> {
  const userId = new mongoose.Types.ObjectId(pickerId);

  const user = (await PickerUser.findById(pickerId).select('isOnline status currentLocationId').lean()) as any;
  if (!user?.isOnline) throw new AppError('Go online before accepting orders.', 403, 'RIDER_OFFLINE');

  const existing = await Order.findById(orderId).select('pickerId riderStage status orderNumber offerHubKey distanceKm deliveryAddress').lean();
  if (!existing) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  if ((existing as any).status === 'cancelled') {
    throw new AppError('This order has been cancelled', 409, 'ORDER_CANCELLED');
  }

  if (String((existing as any).pickerId || '') === pickerId) {
    // Idempotent replay of the Accept tap.
    const order = await Order.findById(orderId);
    return { id: orderId, riderStage: order!.riderStage || 'accepted', status: order!.status, updatedAt: new Date(order!.updatedAt).toISOString() };
  }
  if ((existing as any).pickerId) throw AppError.conflict('Another rider has already accepted this order.', 'ORDER_ALREADY_ASSIGNED');
  await assertRiderFreeForNewOrder(pickerId, orderId);
  if ((existing as any).riderStage !== 'offered') {
    throw AppError.conflict('Another rider has already accepted this order.', 'ORDER_ALREADY_ASSIGNED');
  }
  if (!OFFERABLE_ORDER_STATUSES.includes((existing as any).status)) {
    throw AppError.conflict('This order is no longer available.', 'INVALID_TRANSITION');
  }
  const riderHub = await normalizeRiderHubKey(pickerId, user.currentLocationId);
  const orderHub = String((existing as any).offerHubKey || DEFAULT_HUB_KEY).trim();
  if (riderHub.toLowerCase() !== orderHub.toLowerCase()) {
    throw new AppError('This order does not belong to this hub', 403, 'WRONG_HUB');
  }

  const hub = await resolveHubForOrder(existing as any);
  const distanceKm = (existing as any).distanceKm ?? computeDistanceKm(hub, (existing as any).deliveryAddress);
  const payout = computeRiderPayout(distanceKm);
  const acceptedAt = new Date();

  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, pickerId: null, riderStage: 'offered', status: { $in: OFFERABLE_ORDER_STATUSES } },
    {
      $set: {
        pickerId: userId,
        riderId: String(pickerId),
        riderStage: 'accepted',
        fulfillmentStage: 'rider_accepted',
        acceptedAt,
        assignedAt: acceptedAt,
        offerExpiresAt: null,
        riderPayout: payout.total,
        riderEarningBreakdown: { base: payout.base, distance: payout.distance },
        ...(distanceKm != null ? { distanceKm, etaMinutes: computeEtaMinutes(distanceKm) } : {}),
        ...(hub.key ? { offerHubKey: hub.key } : {}),
        bagCode: bagCodeFor(existing as any),
      },
      // Customer `status` stays getting-packed until pickup; fulfillmentStage is the ops truth.
      $push: { timeline: { status: 'accepted', timestamp: acceptedAt, actor: 'rider', userId: pickerId, note: 'Rider accepted the order' } },
    },
    { new: true },
  );

  if (!claimed) throw AppError.conflict('Another rider has already accepted this order.', 'ORDER_ALREADY_ASSIGNED');

  await PickerUser.updateOne({ _id: userId }, { $set: { activeOrderId: String(claimed._id) } });
  void fulfillment.notifyRiderAccepted(claimed);

  return {
    id: String(claimed._id),
    riderStage: 'accepted',
    status: claimed.status,
    updatedAt: new Date(claimed.updatedAt).toISOString(),
  };
}

async function confirmPickup(
  pickerId: string,
  orderId: string,
  input: { itemsVerified?: boolean; location?: { latitude: number; longitude: number } },
): Promise<OrderStatusResultDto> {
  const order = await loadOrderForRider(orderId, pickerId, { mustOwn: true });
  const stage = order.riderStage || 'offered';

  if (stage === 'picked_up') {
    return { id: orderId, riderStage: stage, status: order.status, updatedAt: new Date(order.updatedAt).toISOString() };
  }
  if (!ALLOWED_TRANSITIONS[stage]?.includes('picked_up')) {
    throw AppError.conflict(`Cannot confirm pickup from stage "${stage}".`, 'INVALID_TRANSITION');
  }
  if (input.itemsVerified === false) {
    throw AppError.conflict('Verify every item in the bag before confirming pickup.', 'ITEMS_NOT_VERIFIED');
  }

  const pickedUpAt = new Date();
  order.riderStage = 'picked_up';
  order.fulfillmentStage = 'rider_picked';
  order.pickedUpAt = pickedUpAt;
  // Pickup *is* customer-visible, and `on-the-way` is the matching status in the
  // existing customer enum.
  if (order.status !== 'on-the-way') order.status = 'on-the-way';
  if (!order.riderId) order.riderId = String(pickerId);
  order.items = (order.items || []).map((item: any) => ({
    ...item,
    itemStatus: item.itemStatus === 'pending' ? 'picked' : item.itemStatus,
  }));
  order.timeline.push({ status: 'on-the-way', timestamp: pickedUpAt, actor: 'rider', userId: pickerId, note: 'Rider picked up the order' });
  await order.save();
  void fulfillment.notifyOutForDelivery(order);

  return { id: orderId, riderStage: 'picked_up', status: order.status, updatedAt: new Date(order.updatedAt).toISOString() };
}

/**
 * Rider cancellation. The customer's order is *not* cancelled — it is released
 * back to the hub pool for reassignment, which is what `CancelOrderSheet` tells
 * the rider will happen.
 */
async function cancelOrder(
  pickerId: string,
  orderId: string,
  input: { reason?: RiderCancelReason; note?: string; location?: { latitude: number; longitude: number } },
): Promise<OrderStatusResultDto> {
  const order = await loadOrderForRider(orderId, pickerId, { mustOwn: true });
  const stage = order.riderStage || 'offered';

  if (stage === 'delivered') {
    throw AppError.conflict('A delivered order cannot be cancelled. Please contact support.', 'CANCELLATION_NOT_ALLOWED');
  }
  if (!ALLOWED_TRANSITIONS[stage]?.includes('cancelled')) {
    throw AppError.conflict(`Cannot cancel from stage "${stage}".`, 'CANCELLATION_NOT_ALLOWED');
  }

  const cancelledAt = new Date();
  const reason = input.reason as RiderCancelReason;

  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        pickerId: null,
        riderId: null,
        // Re-offer immediately so the order stays in the rider Live Orders feed.
        riderStage: 'offered',
        fulfillmentStage: 'packed_in_rack',
        acceptedAt: null,
        pickedUpAt: null,
        riderCancellationReason: reason,
        riderCancellationNote: input.note || '',
        riderCancelledAt: cancelledAt,
        // Back to waiting-for-rider so the hub can re-offer it.
        status: 'getting-packed',
        offerExpiresAt: null,
      },
      $inc: { riderReassignmentCount: 1 },
      $push: {
        timeline: {
          status: 'rider_cancelled',
          timestamp: cancelledAt,
          actor: 'rider',
          userId: pickerId,
          note: `Rider cancelled (${reason})${input.note ? `: ${input.note}` : ''}`,
        },
      },
    },
  );

  await PickerUser.updateOne({ _id: new mongoose.Types.ObjectId(pickerId) }, { $set: { activeOrderId: null } });

  const updated = await Order.findById(orderId).select('status updatedAt').lean();
  return {
    id: orderId,
    riderStage: 'cancelled',
    status: (updated as any)?.status || 'getting-packed',
    updatedAt: new Date((updated as any)?.updatedAt || cancelledAt).toISOString(),
    cancellation: { reason, note: input.note || null, reassigned: true },
  };
}

// ─── Proof-of-delivery photo (API 29) ────────────────────────────────────────

export async function uploadProofPhoto(
  pickerId: string,
  orderId: string,
  file: Express.Multer.File,
  meta: { capturedAt?: Date; latitude?: number; longitude?: number },
): Promise<{ photoId: string; url: string; orderId: string; uploadedAt: string }> {
  const order = await loadOrderForRider(orderId, pickerId, { mustOwn: true });
  if (order.riderStage !== 'picked_up') {
    throw AppError.conflict('Proof of delivery can only be uploaded after pickup.', 'INVALID_ORDER_STAGE');
  }

  const stored = await storeProofOfDeliveryPhoto(file, pickerId);
  const photo = await PickerPodPhoto.create({
    pickerId: new mongoose.Types.ObjectId(pickerId),
    orderId: order._id,
    url: stored.url,
    fileName: stored.fileName,
    mimeType: stored.mimeType,
    sizeBytes: stored.sizeBytes,
    capturedAt: meta.capturedAt,
    latitude: meta.latitude,
    longitude: meta.longitude,
  });

  return {
    photoId: String(photo._id),
    url: photo.url,
    orderId: String(order._id),
    uploadedAt: new Date(photo.createdAt).toISOString(),
  };
}

/**
 * Resolves and consumes a POD photo for an order or stop.
 *
 * Returns null when the caller used the transitional `photo: boolean` form, which
 * the contract permits for one release; that case is logged so the migration can
 * be tracked.
 */
export async function consumePodPhoto(params: {
  pickerId: string;
  photoId?: string;
  legacyPhotoFlag?: boolean;
  orderId?: mongoose.Types.ObjectId | string | null;
  batchId?: string | null;
  stopId?: string | null;
}): Promise<mongoose.Types.ObjectId | null> {
  if (!params.photoId) {
    logger.warn('[PickerOrder] delivery completed without a proof-of-delivery photo', {
      pickerId: params.pickerId,
      orderId: params.orderId ? String(params.orderId) : null,
      legacyPhotoFlag: params.legacyPhotoFlag ?? null,
    });
    return null;
  }

  const photo = await PickerPodPhoto.findOne({
    _id: params.photoId,
    pickerId: new mongoose.Types.ObjectId(params.pickerId),
  });
  if (!photo) throw AppError.badRequest('The proof-of-delivery photo could not be found. Please retake it.');

  if (params.orderId && photo.orderId && String(photo.orderId) !== String(params.orderId)) {
    throw AppError.badRequest('That proof-of-delivery photo belongs to a different order.');
  }
  if (params.stopId && photo.stopId && photo.stopId !== params.stopId) {
    throw AppError.badRequest('That proof-of-delivery photo belongs to a different stop.');
  }

  photo.consumedAt = new Date();
  if (params.orderId && !photo.orderId) photo.orderId = new mongoose.Types.ObjectId(String(params.orderId));
  if (params.batchId && !photo.batchId) photo.batchId = params.batchId;
  if (params.stopId && !photo.stopId) photo.stopId = params.stopId;
  await photo.save();

  return photo._id as mongoose.Types.ObjectId;
}

// ─── Complete delivery (API 30) ───────────────────────────────────────────────

export interface CompleteDeliveryDto {
  orderId: string;
  completed: boolean;
  deliveredAt: string;
  summary: { payout: number; tripMinutes: number | null; distanceKm: number | null; tripsToday: number };
  cash: { collected: number | null; cashInHand: number };
  paymentStatus: 'paid' | 'cod_pending';
}

/**
 * OTP-verified delivery completion.
 *
 * Mirrors the customer-side `order.controller.verifyOtp` — attempt cap, OTP
 * comparison, status and timeline writes — but scoped by rider ownership rather
 * than customer ownership, with COD settlement and the completion summary added.
 */
export async function completeDelivery(
  pickerId: string,
  orderId: string,
  input: {
    otp: string; photoId?: string; photo?: boolean;
    codCollected?: number; location?: { latitude: number; longitude: number };
  },
): Promise<CompleteDeliveryDto> {
  const userId = new mongoose.Types.ObjectId(pickerId);
  const order = await loadOrderForRider(orderId, pickerId, { mustOwn: true });

  if (order.riderStage === 'delivered') {
    // Idempotent replay: report the stored outcome rather than failing.
    return buildCompletionSummary(order, pickerId, order.codCollectedAmount ?? null);
  }
  if (order.riderStage !== 'picked_up') {
    throw AppError.conflict('Complete pickup before delivering this order.', 'INVALID_ORDER_STAGE');
  }
  if (!deliveryPaymentAllowed(order)) {
    throw AppError.conflict('Payment is not confirmed for this order.', 'PAYMENT_NOT_CONFIRMED');
  }

  if ((order.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
    throw new AppError('Too many incorrect attempts. Please contact support.', 429, 'OTP_ATTEMPTS_EXCEEDED');
  }

  if (!order.deliveryOtp || String(order.deliveryOtp) !== String(input.otp).trim()) {
    order.otpAttempts = (order.otpAttempts || 0) + 1;
    await order.save();
    if (order.otpAttempts >= MAX_OTP_ATTEMPTS) {
      throw new AppError('Too many incorrect attempts. Please contact support.', 429, 'OTP_ATTEMPTS_EXCEEDED');
    }
    throw new AppError('Incorrect OTP. Please try again.', 400, 'INCORRECT_OTP');
  }

  const expectedCod = codAmountOf(order);
  if (expectedCod != null && expectedCod > 0) {
    if (input.codCollected == null) {
      throw new AppError(`Record the ${expectedCod} rupees collected for this COD order.`, 400, 'VALIDATION_ERROR', { codAmount: expectedCod });
    }
    if (Math.round(input.codCollected) !== expectedCod) {
      throw new AppError('The collected amount does not match the order total.', 409, 'COD_AMOUNT_MISMATCH', { codAmount: expectedCod });
    }
  }

  const podPhotoId = await consumePodPhoto({
    pickerId, photoId: input.photoId, legacyPhotoFlag: input.photo, orderId: order._id,
  });

  const deliveredAt = new Date();
  const onTime = !order.slaDeadline || deliveredAt <= new Date(order.slaDeadline);

  order.riderStage = 'delivered';
  order.fulfillmentStage = 'delivered';
  order.status = 'delivered';
  order.deliveredAt = deliveredAt;
  order.otpVerified = true;
  order.podPhotoId = podPhotoId;
  if (!order.riderId) order.riderId = String(pickerId);
  if (expectedCod != null && expectedCod > 0) {
    order.codCollectedAmount = Math.round(input.codCollected as number);
    // COD stays `cod_pending` until the rider deposits the cash (API 48).
    if (order.paymentStatus !== 'paid') order.paymentStatus = 'cod_pending';
  }
  order.items = (order.items || []).map((item: any) => ({ ...item, itemStatus: 'delivered' }));
  order.timeline.push({ status: 'delivered', timestamp: deliveredAt, actor: 'rider', userId: pickerId, note: 'Delivered and verified by OTP' });
  await order.save();

  if (expectedCod != null && expectedCod > 0) {
    await recordCodCollection({
      pickerId,
      amount: order.codCollectedAmount as number,
      orderId: order._id,
      orderNumber: order.orderNumber,
      hubKey: order.offerHubKey,
    });
  }

  if (order.riderPayout) {
    await creditEarnings(pickerId, Math.round(order.riderPayout), `Delivery ${order.orderNumber || orderId}`, String(order._id));
  }

  await PickerUser.updateOne(
    { _id: userId },
    {
      $set: { activeOrderId: null, lastSeenAt: deliveredAt },
      $inc: { totalTrips: 1, ...(onTime ? { onTimeDeliveries: 1 } : { lateDeliveries: 1 }) },
    },
  );

  void fulfillment.notifyDelivered(order);

  return buildCompletionSummary(order, pickerId, order.codCollectedAmount ?? null);
}

async function buildCompletionSummary(order: any, pickerId: string, codCollected: number | null): Promise<CompleteDeliveryDto> {
  const userId = new mongoose.Types.ObjectId(pickerId);
  const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : new Date();
  const acceptedAt = order.acceptedAt ? new Date(order.acceptedAt) : null;

  const [tripsToday, cashInHand] = await Promise.all([
    Order.countDocuments({
      pickerId: userId,
      riderStage: 'delivered',
      deliveredAt: { $gte: hubDayStart(deliveredAt), $lte: hubDayEnd(deliveredAt) },
    }),
    getCashInHand(pickerId),
  ]);

  return {
    orderId: String(order._id),
    completed: true,
    deliveredAt: deliveredAt.toISOString(),
    summary: {
      payout: Math.round(order.riderPayout || 0),
      tripMinutes: acceptedAt ? Math.max(1, Math.round((deliveredAt.getTime() - acceptedAt.getTime()) / 60000)) : null,
      distanceKm: order.distanceKm ?? null,
      tripsToday,
    },
    cash: { collected: codCollected, cashInHand },
    paymentStatus: order.paymentStatus === 'paid' ? 'paid' : 'cod_pending',
  };
}

// ─── Location tracking (API 31) ───────────────────────────────────────────────

export async function trackLocation(
  pickerId: string,
  input: {
    latitude: number; longitude: number; accuracy?: number; speed?: number; heading?: number;
    recordedAt?: Date; orderId?: string; batchId?: string; batteryLevel?: number;
  },
): Promise<{ tracked: boolean; recordedAt: string; nextPingSeconds: number }> {
  const userId = new mongoose.Types.ObjectId(pickerId);
  const user = (await PickerUser.findById(pickerId).select('preferences').lean()) as any;

  // The Privacy Policy promises the Settings toggle actually stops tracking.
  if (user?.preferences?.locationSharing === false) {
    throw new AppError('Location sharing is turned off in your settings.', 403, 'LOCATION_SHARING_DISABLED');
  }

  const recordedAt = input.recordedAt ? new Date(input.recordedAt) : new Date();

  await Promise.all([
    PickerLocationPing.create({
      pickerId: userId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      speed: input.speed,
      heading: input.heading,
      batteryLevel: input.batteryLevel,
      orderId: input.orderId ? new mongoose.Types.ObjectId(input.orderId) : null,
      batchId: input.batchId || null,
      recordedAt,
    }),
    PickerUser.updateOne(
      { _id: userId },
      {
        $set: {
          gpsLocation: { latitude: input.latitude, longitude: input.longitude, timestamp: recordedAt },
          lastSeenAt: recordedAt,
          ...(input.batteryLevel != null ? { batteryLevel: input.batteryLevel } : {}),
        },
      },
    ),
  ]);

  void fulfillment.broadcastRiderGps(pickerId, input.latitude, input.longitude, input.orderId, input.heading);
  return { tracked: true, recordedAt: recordedAt.toISOString(), nextPingSeconds: pickerConfig.locationPingSeconds };
}

// ─── Delivery history (API 45) ────────────────────────────────────────────────

export interface HistoryOrderDto {
  id: string;
  num: string;
  deliveredAt: string;
  time: string;
  addr: string;
  items: number;
  dist: string | null;
  distanceKm: number | null;
  payout: number;
  type: 'standard' | 'bulk';
  batchId: string | null;
  status: 'delivered' | 'failed' | 'cancelled';
  codCollected: number | null;
}

export async function listDeliveryHistory(
  pickerId: string,
  params: { type: 'all' | 'standard' | 'bulk'; dateFrom?: string; dateTo?: string; page: number; limit: number },
): Promise<{ orders: HistoryOrderDto[]; total: number; page: number; limit: number; totalPages: number }> {
  const query: Record<string, unknown> = {
    pickerId: new mongoose.Types.ObjectId(pickerId),
    riderStage: { $in: ['delivered', 'cancelled'] },
  };
  if (params.type !== 'all') query.deliveryType = params.type;

  const from = parseHubDate(params.dateFrom);
  const to = parseHubDate(params.dateTo);
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = from;
    if (to) range.$lte = hubDayEnd(to);
    query.deliveredAt = range;
  }

  const skip = (params.page - 1) * params.limit;
  const [rows, total] = await Promise.all([
    Order.find(query).sort({ deliveredAt: -1, updatedAt: -1 }).skip(skip).limit(params.limit).lean(),
    Order.countDocuments(query),
  ]);

  const now = new Date();
  const orders: HistoryOrderDto[] = (rows as any[]).map((order) => {
    const { num } = orderDisplayNumbers(order.orderNumber, String(order._id));
    const at = new Date(order.deliveredAt || order.deliveryFailedAt || order.updatedAt);
    return {
      id: String(order._id),
      num,
      deliveredAt: at.toISOString(),
      time: relativeDateTimeDisplay(at, now),
      addr: formatAddressLine(order.deliveryAddress),
      items: Array.isArray(order.items) ? order.items.length : 0,
      dist: distanceDisplay(order.distanceKm ?? null),
      distanceKm: order.distanceKm ?? null,
      payout: Math.round(order.riderPayout || 0),
      type: order.deliveryType === 'bulk' ? 'bulk' : 'standard',
      batchId: order.bulkBatchId || null,
      status: order.deliveryFailedAt ? 'failed' : order.riderStage === 'delivered' ? 'delivered' : 'cancelled',
      codCollected: order.codCollectedAmount ?? null,
    };
  });

  return { orders, total, page: params.page, limit: params.limit, totalPages: Math.max(1, Math.ceil(total / params.limit)) };
}
