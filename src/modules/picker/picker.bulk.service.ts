import mongoose from 'mongoose';
import { Order } from '../orders/order.model';
import { Cluster } from '../rider/rider.models';
import { PickerUser, PickerWorkLocation, deriveDeliveryMode } from './picker.models';
import {
  PickerBulkBatch, PickerPodPhoto, type IBulkBatchStop, type IPickerBulkBatch,
} from './picker.rider.models';
import { AppError } from '../../utils/AppError';
import { pickerConfig } from './picker.config';
import {
  distanceDisplay, durationDisplay, formatAddressLine, haversineKm, hasCoords,
  maskPhone, dialablePhone, orderDisplayNumbers, relativeDateTimeDisplay, parseHubDate, hubDayEnd,
} from './picker.format';
import { computeRiderPayout, consumePodPhoto } from './picker.order.service';
import { getCashInHand, recordCodCollection } from './picker.cash.service';
import { storeProofOfDeliveryPhoto } from './picker.upload.service';
import { creditEarnings } from './picker.service';

/**
 * Rider-facing bulk (multi-drop) delivery. APIs 32–40.
 *
 * Admin clustering (`Cluster` + `dispatch.service.groupOrders`) produces the
 * assignment; this module materialises a rider-consumable batch with a frozen
 * stop sequence, bag codes and per-stop state the admin cluster model lacks.
 */

const ACTIVE_BATCH_STATUSES = ['assigned', 'loading', 'ready', 'dispatched', 'in_transit'];

function bulkVehicleOf(vehicleType?: string | null): 'auto' | 'van' | 'motorcycle' {
  if (vehicleType === 'van') return 'van';
  if (vehicleType === 'auto' || vehicleType === 'ev_auto') return 'auto';
  return 'motorcycle';
}
function paymentModeOf(order: { paymentStatus?: string; paymentMethod?: { methodType?: string } }): 'cod' | 'prepaid' {
  if (order.paymentStatus === 'paid') return 'prepaid';
  const methodType = order.paymentMethod?.methodType;
  return order.paymentStatus === 'cod_pending' || methodType === 'cash' ? 'cod' : 'prepaid';
}

function codAmountOf(order: { paymentStatus?: string; paymentMethod?: { methodType?: string }; totalBill?: number; onlineAmountDue?: number }): number | null {
  if (paymentModeOf(order) !== 'cod') return null;
  return Math.max(0, Math.round((order.totalBill || 0) - (order.onlineAmountDue || 0)));
}

async function generateBatchId(): Promise<string> {
  const count = await PickerBulkBatch.countDocuments();
  return `BD-${10000 + count + 1}`;
}

function bagCodeForSeq(seq: number): string {
  return `BD${String(seq + 1).padStart(2, '0')}`;
}

export function resolveStop(batch: { stops: IBulkBatchStop[] }, stopId: string): IBulkBatchStop | undefined {
  const byId = batch.stops.find((s) => s.stopId === stopId);
  if (byId) return byId;
  if (/^\d+$/.test(stopId)) {
    const seq = Number(stopId);
    return batch.stops.find((s) => s.seq === seq);
  }
  return undefined;
}

function stopTotals(stops: IBulkBatchStop[]) {
  const delivered = stops.filter((s) => s.status === 'delivered').length;
  const failed = stops.filter((s) => s.status === 'failed').length;
  const remaining = stops.filter((s) => s.status === 'pending').length;
  return { orders: stops.length, delivered, failed, remaining };
}

function nextPendingStop(stops: IBulkBatchStop[]): IBulkBatchStop | undefined {
  return [...stops].sort((a, b) => a.seq - b.seq).find((s) => s.status === 'pending');
}

function toStopDto(stop: IBulkBatchStop) {
  const { num } = orderDisplayNumbers(stop.orderNumber, String(stop.orderId));
  return {
    stopId: stop.stopId,
    seq: stop.seq,
    orderId: String(stop.orderId),
    customer: stop.customerName,
    num,
    addr: stop.address,
    latitude: stop.latitude ?? null,
    longitude: stop.longitude ?? null,
    bag: stop.bagCode,
    bagLoaded: Boolean(stop.bagLoaded),
    dist: distanceDisplay(stop.distanceKm ?? null),
    distanceKm: stop.distanceKm ?? null,
    eta: durationDisplay(stop.etaMinutes ?? null),
    etaMinutes: stop.etaMinutes ?? null,
    items: stop.itemCount,
    status: stop.status,
    phase: stop.phase,
    failureReason: stop.failureReason || null,
    deliveredAt: stop.deliveredAt ? new Date(stop.deliveredAt).toISOString() : null,
    maskedPhone: maskPhone(stop.phone),
    phone: dialablePhone(stop.phone),
    paymentMode: stop.paymentMode,
    codAmount: stop.codAmount ?? null,
  };
}

function toBatchDto(batch: IPickerBulkBatch | Record<string, unknown>) {
  const stops = ((batch.stops || []) as IBulkBatchStop[]).slice().sort((a, b) => a.seq - b.seq);
  const totals = stopTotals(stops);
  const current = stops.find((s) => s.stopId === (batch.currentStopId as string)) || nextPendingStop(stops);
  return {
    id: batch.batchId as string,
    status: batch.status,
    vehicle: {
      type: batch.vehicleType,
      label: String(batch.vehicleType || 'auto').toUpperCase(),
      registrationNumber: (batch.vehicleRegistrationNumber as string) || null,
    },
    hub: { id: (batch.hubKey as string) || null, name: (batch.hubName as string) || null },
    totals: {
      ...totals,
      distanceKm: (batch.totalDistanceKm as number) ?? null,
      estimatedMinutes: (batch.estimatedMinutes as number) ?? null,
    },
    currentStopId: current?.stopId || null,
    currentStopPhase: current?.phase || null,
    orders: stops.map(toStopDto),
    earnings: batch.earnings || { total: 0 },
  };
}

function assertBulkRider(user: { deliveryMode?: string; vehicleType?: string } | null): void {
  const mode = user?.deliveryMode || deriveDeliveryMode(user?.vehicleType);
  if (mode !== 'bulk') {
    throw new AppError('Bulk delivery is not enabled for your vehicle.', 403, 'NOT_BULK_RIDER');
  }
}

async function loadActiveBatch(pickerId: string, batchId?: string): Promise<IPickerBulkBatch> {
  const userId = new mongoose.Types.ObjectId(pickerId);
  if (batchId) {
    const found = await PickerBulkBatch.findOne({ batchId, pickerId: userId });
    if (!found) throw new AppError('Batch not found.', 404, 'BATCH_NOT_FOUND');
    if (String(found.pickerId) !== pickerId) throw new AppError('This batch is not assigned to you.', 403, 'NOT_BATCH_RIDER');
    return found;
  }

  const existing = await PickerBulkBatch.findOne({ pickerId: userId, status: { $in: ACTIVE_BATCH_STATUSES } });
  if (existing) return existing;

  const user = (await PickerUser.findById(pickerId).select('activeBatchId').lean()) as any;
  if (user?.activeBatchId) {
    const byId = await PickerBulkBatch.findOne({ batchId: user.activeBatchId, pickerId: userId });
    if (byId && ACTIVE_BATCH_STATUSES.includes(byId.status)) return byId;
  }

  const materialized = await materializeFromCluster(pickerId);
  if (materialized) return materialized;

  throw new AppError('No active bulk batch assigned.', 404, 'NO_ACTIVE_BATCH');
}

/**
 * Turns an admin `Cluster` assigned to this picker into a rider-facing batch.
 * Sequence is frozen at materialisation so index-based stop addressing stays stable.
 */
async function materializeFromCluster(pickerId: string): Promise<IPickerBulkBatch | null> {
  const cluster = (await Cluster.findOne({
    status: 'assigned',
    $or: [{ riderId: pickerId }, { riderId: String(pickerId) }],
  }).lean()) as { orderIds?: string[]; center?: { lat?: number; lng?: number }; clusterId?: string } | null;
  if (!cluster || !Array.isArray(cluster.orderIds) || cluster.orderIds.length === 0) return null;

  const objectIds = cluster.orderIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const orders = await Order.find({
    $or: [
      ...(objectIds.length ? [{ _id: { $in: objectIds.map((id) => new mongoose.Types.ObjectId(id)) } }] : []),
      { orderNumber: { $in: cluster.orderIds } },
    ],
  }).lean();
  if (orders.length === 0) return null;

  const user = (await PickerUser.findById(pickerId)
    .select('currentLocationId vehicleType vehicleRegistrationNumber')
    .lean()) as any;
  const hub = user?.currentLocationId
    ? ((await PickerWorkLocation.findOne({ warehouseKey: user.currentLocationId })
        .select('warehouseKey name coordinates')
        .lean()) as any)
    : null;

  const hubLat = hub?.coordinates?.latitude ?? cluster.center?.lat;
  const hubLng = hub?.coordinates?.longitude ?? cluster.center?.lng;

  const stops: IBulkBatchStop[] = orders.map((order: any, seq: number) => {
    const dropLat = order.deliveryAddress?.latitude;
    const dropLng = order.deliveryAddress?.longitude;
    const distanceKm = hasCoords(hubLat, hubLng) && hasCoords(dropLat, dropLng)
      ? Math.round(haversineKm(hubLat, hubLng, dropLat, dropLng) * 10) / 10
      : undefined;
    const etaMinutes = distanceKm != null
      ? Math.max(1, Math.round(distanceKm * pickerConfig.minutesPerKm + pickerConfig.minutesPerStopBuffer))
      : undefined;
    const payout = computeRiderPayout(distanceKm ?? null).total;
    return {
      stopId: `st_${seq + 1}`,
      seq,
      orderId: order._id,
      orderNumber: order.orderNumber || '',
      customerName: order.deliveryAddress?.line1 ? 'Customer' : 'Customer',
      address: formatAddressLine(order.deliveryAddress),
      landmark: order.deliveryAddress?.landmark,
      latitude: dropLat,
      longitude: dropLng,
      phone: undefined,
      bagCode: bagCodeForSeq(seq),
      bagLoaded: false,
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
      distanceKm,
      etaMinutes,
      status: 'pending',
      phase: 'to_nav',
      returnToHub: false,
      paymentMode: paymentModeOf(order),
      codAmount: codAmountOf(order) ?? undefined,
      requiresOtp: Boolean(order.deliveryOtp),
      payout,
    } as IBulkBatchStop;
  });

  const totalDistanceKm = Math.round(stops.reduce((sum, s) => sum + (s.distanceKm || 0), 0) * 10) / 10;
  const estimatedMinutes = stops.reduce((sum, s) => sum + (s.etaMinutes || 0), 0);
  const earningsTotal = pickerConfig.bulkBatchBasePayout + stops.length * pickerConfig.bulkStopPayout;

  const batchId = await generateBatchId();
  const batch = await PickerBulkBatch.create({
    batchId,
    pickerId: new mongoose.Types.ObjectId(pickerId),
    hubKey: hub?.warehouseKey,
    hubName: hub?.name,
    hubLatitude: hubLat,
    hubLongitude: hubLng,
    vehicleType: bulkVehicleOf(user?.vehicleType),
    vehicleRegistrationNumber: user?.vehicleRegistrationNumber,
    status: 'assigned',
    stops,
    currentStopId: stops[0]?.stopId || null,
    totalDistanceKm,
    estimatedMinutes,
    earnings: {
      total: earningsTotal,
      base: pickerConfig.bulkBatchBasePayout,
      perStop: pickerConfig.bulkStopPayout,
    },
    assignedAt: new Date(),
    clusterId: cluster.clusterId,
  });

  await Order.updateMany(
    { _id: { $in: orders.map((o: any) => o._id) } },
    {
      $set: {
        pickerId: new mongoose.Types.ObjectId(pickerId),
        deliveryType: 'bulk',
        bulkBatchId: batchId,
        riderStage: 'accepted',
        assignedAt: new Date(),
        acceptedAt: new Date(),
      },
    },
  );
  await PickerUser.updateOne({ _id: pickerId }, { $set: { activeBatchId: batchId } });

  return batch;
}

function routeLabel(batch: IPickerBulkBatch): string | null {
  const stops = (batch.stops || []).slice().sort((a, b) => a.seq - b.seq);
  if (stops.length === 0) return null;
  const first = batch.hubName || 'Hub';
  const last = stops[stops.length - 1]?.address?.split(',')[0] || 'Route';
  return `${first} → ${last}`;
}

// ─── API 32 ───────────────────────────────────────────────────────────────────

export async function getCurrentBatch(pickerId: string, batchId?: string) {
  const user = (await PickerUser.findById(pickerId).select('deliveryMode vehicleType').lean()) as any;
  assertBulkRider(user);
  const batch = await loadActiveBatch(pickerId, batchId);
  return toBatchDto(batch);
}

// ─── API 33 ───────────────────────────────────────────────────────────────────

export async function loadBag(
  pickerId: string,
  input: { bag: string; batchId?: string; loaded?: boolean; scanMethod?: 'scan' | 'manual' },
) {
  const batch = await loadActiveBatch(pickerId, input.batchId);
  if (['dispatched', 'in_transit', 'completed', 'cancelled'].includes(batch.status)) {
    throw new AppError('Bags cannot be changed after the batch is dispatched.', 409, 'BATCH_ALREADY_DISPATCHED');
  }

  const stop = batch.stops.find((s) => s.bagCode.toUpperCase() === String(input.bag).trim().toUpperCase());
  if (!stop) throw new AppError('This bag is not part of your batch.', 404, 'BAG_NOT_IN_BATCH');

  const loaded = input.loaded !== false;
  stop.bagLoaded = loaded;
  stop.bagLoadedAt = loaded ? new Date() : undefined;
  stop.bagScanMethod = input.scanMethod;

  const loadedCount = batch.stops.filter((s) => s.bagLoaded).length;
  const allLoaded = loadedCount === batch.stops.length && batch.stops.length > 0;
  if (allLoaded) batch.status = 'ready';
  else if (batch.status === 'assigned') batch.status = 'loading';
  else if (batch.status === 'ready' && !allLoaded) batch.status = 'loading';
  await batch.save();

  return {
    bag: stop.bagCode,
    loaded,
    loadedCount,
    totalBags: batch.stops.length,
    allLoaded,
    batchStatus: batch.status,
  };
}

// ─── API 34 ───────────────────────────────────────────────────────────────────

export async function startBatch(
  pickerId: string,
  input: { batchId?: string; location?: { latitude: number; longitude: number } },
) {
  const batch = await loadActiveBatch(pickerId, input.batchId);
  if (['dispatched', 'in_transit', 'completed'].includes(batch.status)) {
    const current = nextPendingStop(batch.stops) || batch.stops[0];
    return {
      batchId: batch.batchId,
      status: 'dispatched' as const,
      startedAt: (batch.startedAt || new Date()).toISOString(),
      currentStopId: current?.stopId || null,
      currentStopPhase: current?.phase || 'to_nav',
    };
  }

  const missing = batch.stops.filter((s) => !s.bagLoaded).map((s) => s.bagCode);
  if (missing.length > 0) {
    throw new AppError('Load every bag before starting the batch.', 409, 'BAGS_NOT_LOADED', { missingBags: missing });
  }

  const first = nextPendingStop(batch.stops);
  const startedAt = new Date();
  batch.status = 'dispatched';
  batch.startedAt = startedAt;
  batch.currentStopId = first?.stopId || null;
  await batch.save();

  await Order.updateMany(
    { _id: { $in: batch.stops.map((s) => s.orderId) } },
    { $set: { status: 'on-the-way', riderStage: 'picked_up', pickedUpAt: startedAt } },
  );
  await PickerUser.updateOne({ _id: pickerId }, { $set: { activeBatchId: batch.batchId, lastSeenAt: startedAt } });

  return {
    batchId: batch.batchId,
    status: 'dispatched' as const,
    startedAt: startedAt.toISOString(),
    currentStopId: first?.stopId || null,
    currentStopPhase: 'to_nav' as const,
  };
}

async function requireOwnedStop(pickerId: string, stopId: string) {
  const batch = await loadActiveBatch(pickerId);
  const stop = resolveStop(batch, stopId);
  if (!stop) throw new AppError('Stop not found.', 404, 'STOP_NOT_FOUND');
  return { batch, stop };
}

// ─── API 35 ───────────────────────────────────────────────────────────────────

export async function arriveAtStop(
  pickerId: string,
  stopId: string,
  input: { phase: 'navigating' | 'arrived'; location?: { latitude: number; longitude: number } },
) {
  const { batch, stop } = await requireOwnedStop(pickerId, stopId);
  if (stop.status !== 'pending') {
    throw new AppError('This stop has already been resolved.', 409, 'STOP_ALREADY_RESOLVED');
  }
  if (batch.currentStopId && batch.currentStopId !== stop.stopId) {
    throw new AppError('Finish the current stop before advancing another.', 409, 'NOT_CURRENT_STOP');
  }

  const now = new Date();
  if (input.phase === 'navigating') {
    if (stop.phase === 'arrived') {
      throw new AppError('Cannot go back from arrived to navigating.', 409, 'INVALID_PHASE_TRANSITION');
    }
    stop.phase = 'navigating';
    stop.navigationStartedAt = stop.navigationStartedAt || now;
    batch.status = 'in_transit';
  } else {
    if (stop.phase === 'to_nav') {
      throw new AppError('Start navigation before marking arrived.', 409, 'INVALID_PHASE_TRANSITION');
    }
    stop.phase = 'arrived';
    stop.arrivedAt = now;
  }
  batch.currentStopId = stop.stopId;
  await batch.save();

  return {
    stopId: stop.stopId,
    phase: stop.phase,
    updatedAt: now.toISOString(),
    navigationStartedAt: stop.navigationStartedAt ? new Date(stop.navigationStartedAt).toISOString() : null,
    arrivedAt: stop.arrivedAt ? new Date(stop.arrivedAt).toISOString() : null,
  };
}

// ─── API 36 ───────────────────────────────────────────────────────────────────

export async function uploadStopPhoto(
  pickerId: string,
  stopId: string,
  file: Express.Multer.File,
  meta: { latitude?: number; longitude?: number },
) {
  const { batch, stop } = await requireOwnedStop(pickerId, stopId);
  if (stop.status !== 'pending') {
    throw new AppError('This stop has already been resolved.', 409, 'STOP_ALREADY_RESOLVED');
  }

  const stored = await storeProofOfDeliveryPhoto(file, pickerId);
  const photo = await PickerPodPhoto.create({
    pickerId: new mongoose.Types.ObjectId(pickerId),
    orderId: stop.orderId,
    batchId: batch.batchId,
    stopId: stop.stopId,
    url: stored.url,
    fileName: stored.fileName,
    mimeType: stored.mimeType,
    sizeBytes: stored.sizeBytes,
    latitude: meta.latitude,
    longitude: meta.longitude,
  });

  return {
    photoId: String(photo._id),
    url: photo.url,
    stopId: stop.stopId,
    uploadedAt: new Date(photo.createdAt).toISOString(),
  };
}

async function maybeCompleteBatch(batch: IPickerBulkBatch): Promise<{ completed: boolean; summary?: ReturnType<typeof toBatchSummary> }> {
  const pending = batch.stops.some((s) => s.status === 'pending');
  if (pending) {
    const next = nextPendingStop(batch.stops);
    batch.currentStopId = next?.stopId || null;
    if (next) next.phase = 'to_nav';
    await batch.save();
    return { completed: false };
  }

  const completedAt = new Date();
  batch.status = 'completed';
  batch.completedAt = completedAt;
  if (batch.startedAt) {
    batch.durationMinutes = Math.max(1, Math.round((completedAt.getTime() - new Date(batch.startedAt).getTime()) / 60000));
  }
  await batch.save();
  await PickerUser.updateOne({ _id: batch.pickerId }, { $set: { activeBatchId: null } });
  await Cluster.updateOne({ clusterId: batch.clusterId }, { $set: { status: 'completed' } }).catch(() => undefined);
  return { completed: true, summary: toBatchSummary(batch) };
}

function toBatchSummary(batch: IPickerBulkBatch) {
  const totals = stopTotals(batch.stops);
  return {
    id: batch.batchId,
    status: batch.status,
    completedAt: batch.completedAt ? new Date(batch.completedAt).toISOString() : null,
    route: routeLabel(batch),
    vehicle: [String(batch.vehicleType || 'auto'), batch.vehicleRegistrationNumber].filter(Boolean).join(' · ') || null,
    totals: {
      ...totals,
      distanceKm: batch.totalDistanceKm ?? null,
      distanceDisplay: distanceDisplay(batch.totalDistanceKm ?? null),
      durationMinutes: batch.durationMinutes ?? null,
      durationDisplay: durationDisplay(batch.durationMinutes ?? null),
    },
    earnings: batch.earnings || { total: 0 },
    stops: batch.stops.slice().sort((a, b) => a.seq - b.seq).map(toStopDto),
  };
}

// ─── API 37 ───────────────────────────────────────────────────────────────────

export async function deliverStop(
  pickerId: string,
  stopId: string,
  input: {
    photoId?: string; photo?: boolean; otp?: string;
    codCollected?: number; location?: { latitude: number; longitude: number };
  },
) {
  const { batch, stop } = await requireOwnedStop(pickerId, stopId);
  if (stop.status === 'delivered') {
    const totals = stopTotals(batch.stops);
    return {
      stopId: stop.stopId,
      status: 'delivered' as const,
      deliveredAt: (stop.deliveredAt || new Date()).toISOString(),
      batch: { status: batch.status, ...totals, nextStopId: nextPendingStop(batch.stops)?.stopId || null },
      cash: { collected: stop.codCollected ?? null, cashInHand: await getCashInHand(pickerId) },
    };
  }
  if (stop.status === 'failed') throw new AppError('This stop has already been resolved.', 409, 'STOP_ALREADY_RESOLVED');
  if (stop.phase !== 'arrived') throw new AppError('Mark arrived before delivering this stop.', 409, 'NOT_ARRIVED');

  const order = await Order.findById(stop.orderId);
  if (!order) throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');

  if (order.deliveryOtp && String(input.otp || '') !== String(order.deliveryOtp)) {
    throw new AppError('Incorrect OTP. Please try again.', 400, 'INCORRECT_OTP');
  }
  if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'cod_pending') {
    throw new AppError('Payment is not confirmed for this order.', 409, 'PAYMENT_NOT_CONFIRMED');
  }

  const expectedCod = stop.codAmount ?? null;
  if (expectedCod != null && expectedCod > 0) {
    if (input.codCollected == null) {
      throw new AppError(`Record the ${expectedCod} rupees collected for this COD order.`, 400, 'VALIDATION_ERROR', { codAmount: expectedCod });
    }
    if (Math.round(input.codCollected) !== expectedCod) {
      throw new AppError('The collected amount does not match the order total.', 409, 'COD_AMOUNT_MISMATCH', { codAmount: expectedCod });
    }
  }

  const podPhotoId = await consumePodPhoto({
    pickerId,
    photoId: input.photoId,
    legacyPhotoFlag: input.photo,
    orderId: order._id,
    batchId: batch.batchId,
    stopId: stop.stopId,
  });

  const deliveredAt = new Date();
  const onTime = !order.slaDeadline || deliveredAt <= new Date(order.slaDeadline);

  stop.status = 'delivered';
  stop.deliveredAt = deliveredAt;
  stop.podPhotoId = podPhotoId || undefined;
  if (expectedCod != null) stop.codCollected = expectedCod;

  order.riderStage = 'delivered';
  order.status = 'delivered';
  order.deliveredAt = deliveredAt;
  order.podPhotoId = podPhotoId;
  order.deliveryType = 'bulk';
  order.bulkBatchId = batch.batchId;
  if (expectedCod != null && expectedCod > 0) {
    order.codCollectedAmount = expectedCod;
    if (order.paymentStatus !== 'paid') order.paymentStatus = 'cod_pending';
  }
  order.timeline.push({ status: 'delivered', timestamp: deliveredAt, actor: 'rider', note: `Bulk stop ${stop.stopId} delivered` });
  await order.save();

  if (expectedCod != null && expectedCod > 0) {
    await recordCodCollection({
      pickerId,
      amount: expectedCod,
      orderId: order._id,
      orderNumber: order.orderNumber,
      batchId: batch.batchId,
      hubKey: batch.hubKey,
    });
  }
  if (stop.payout) {
    await creditEarnings(pickerId, stop.payout, `Bulk stop ${batch.batchId} · ${stop.bagCode}`, String(order._id));
  }
  await PickerUser.updateOne(
    { _id: pickerId },
    { $inc: { totalTrips: 1, ...(onTime ? { onTimeDeliveries: 1 } : { lateDeliveries: 1 }) }, $set: { lastSeenAt: deliveredAt } },
  );

  const completion = await maybeCompleteBatch(batch);
  const totals = stopTotals(batch.stops);
  return {
    stopId: stop.stopId,
    status: 'delivered' as const,
    deliveredAt: deliveredAt.toISOString(),
    batch: {
      status: batch.status,
      ...totals,
      nextStopId: nextPendingStop(batch.stops)?.stopId || null,
      ...(completion.completed ? { summary: completion.summary } : {}),
    },
    cash: { collected: expectedCod, cashInHand: await getCashInHand(pickerId) },
  };
}

// ─── API 38 ───────────────────────────────────────────────────────────────────

export async function failStop(
  pickerId: string,
  stopId: string,
  input: { reason: string; note?: string; photoId?: string; location?: { latitude: number; longitude: number } },
) {
  const { batch, stop } = await requireOwnedStop(pickerId, stopId);
  if (stop.status !== 'pending') {
    throw new AppError('This stop has already been resolved.', 409, 'STOP_ALREADY_RESOLVED');
  }

  const failedAt = new Date();
  stop.status = 'failed';
  stop.failedAt = failedAt;
  stop.failureReason = input.reason as IBulkBatchStop['failureReason'];
  stop.failureNote = input.note || '';
  stop.returnToHub = true;

  if (input.photoId) {
    const photoId = await consumePodPhoto({
      pickerId, photoId: input.photoId, orderId: stop.orderId, batchId: batch.batchId, stopId: stop.stopId,
    });
    stop.podPhotoId = photoId || undefined;
  }

  await Order.updateOne(
    { _id: stop.orderId },
    {
      $set: {
        riderStage: 'cancelled',
        deliveryFailedAt: failedAt,
        riderCancellationReason: input.reason,
        riderCancellationNote: input.note || '',
        pickerId: null,
      },
      $inc: { riderReassignmentCount: 1 },
      $push: { timeline: { status: 'getting-packed', timestamp: failedAt, actor: 'rider', note: `Bulk stop failed: ${input.reason}` } },
    },
  );

  const completion = await maybeCompleteBatch(batch);
  const totals = stopTotals(batch.stops);
  return {
    stopId: stop.stopId,
    status: 'failed' as const,
    reason: input.reason,
    failedAt: failedAt.toISOString(),
    batch: {
      status: batch.status,
      ...totals,
      nextStopId: nextPendingStop(batch.stops)?.stopId || null,
      ...(completion.completed ? { summary: completion.summary } : {}),
    },
    returnToHub: true,
  };
}

// ─── APIs 39–40 ───────────────────────────────────────────────────────────────

export async function listBatches(
  pickerId: string,
  params: { status: 'completed' | 'cancelled' | 'all'; dateFrom?: string; dateTo?: string; page: number; limit: number },
) {
  const query: Record<string, unknown> = { pickerId: new mongoose.Types.ObjectId(pickerId) };
  if (params.status !== 'all') query.status = params.status;

  const from = parseHubDate(params.dateFrom);
  const to = parseHubDate(params.dateTo);
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = from;
    if (to) range.$lte = hubDayEnd(to);
    query.completedAt = range;
  }

  const skip = (params.page - 1) * params.limit;
  const [rows, total] = await Promise.all([
    PickerBulkBatch.find(query).sort({ completedAt: -1, assignedAt: -1 }).skip(skip).limit(params.limit).lean(),
    PickerBulkBatch.countDocuments(query),
  ]);

  const now = new Date();
  const batches = (rows as unknown as IPickerBulkBatch[]).map((batch) => {
    const totals = stopTotals(batch.stops || []);
    const at = batch.completedAt || batch.assignedAt;
    return {
      id: batch.batchId,
      completedAt: at ? new Date(at).toISOString() : new Date().toISOString(),
      whenDisplay: at ? relativeDateTimeDisplay(new Date(at), now) : '',
      route: routeLabel(batch),
      orders: totals.orders,
      delivered: totals.delivered,
      failed: totals.failed,
      distanceKm: batch.totalDistanceKm ?? null,
      summaryLine: `${totals.orders} orders · ${totals.delivered} delivered${batch.totalDistanceKm != null ? ` · ${distanceDisplay(batch.totalDistanceKm)}` : ''}`,
      earnings: Math.round(batch.earnings?.total || 0),
    };
  });

  return { batches, total, page: params.page, limit: params.limit, totalPages: Math.max(1, Math.ceil(total / params.limit)) };
}

export async function getBatchDetail(pickerId: string, batchId: string) {
  const batch = await PickerBulkBatch.findOne({ batchId, pickerId: new mongoose.Types.ObjectId(pickerId) });
  if (!batch) throw new AppError('Batch not found.', 404, 'BATCH_NOT_FOUND');
  return toBatchSummary(batch);
}
