import mongoose from 'mongoose';
import { PickerUser, PickerShift, PickerShiftAssignment, PickerWorkLocation, PickerActionLog } from './picker.models';
import { Order } from '../orders/order.model';
import { PickerBulkBatch } from './picker.rider.models';
import { AppError } from '../../utils/AppError';
import { pickerConfig } from './picker.config';
import {
  timeRangeDisplay, rupees, hubDateKey, hubDayStart, hubDayEnd, parseHubDate, haversineKm, hasCoords,
} from './picker.format';
import { assertCodTransferredForOnline, getCashInHand } from './picker.cash.service';

/**
 * Shift booking and online presence (APIs 18–23).
 *
 * `PickerShift` is the slot catalogue and `PickerShiftAssignment` is a rider's
 * claim on one. Everything the rider app needs beyond the raw slot — whether the
 * caller has booked it, how many places are left, the formatted time and pay
 * lines — is derived here so the app renders without further computation.
 */

/** Minutes before a shift starts after which a booking can no longer be released. */
const CANCELLATION_CUTOFF_MINUTES = parseInt(process.env.PICKER_SHIFT_CANCEL_CUTOFF_MINUTES || '60', 10);

export type ApiShiftStatus = 'open' | 'full' | 'closed' | 'started' | 'completed';

export interface ShiftSlotDto {
  id: string;
  label: string;
  date: string;
  startTime: string;
  endTime: string;
  timeDisplay: string;
  payDisplay: string;
  basePayPerHour: number | null;
  hasIncentive: boolean;
  isSurge: boolean;
  capacity: number;
  bookedCount: number;
  remainingSlots: number;
  booked: boolean;
  /** Alias of `booked` for picker clients that treat `booked` as a count. */
  isBookedByMe: boolean;
  status: ApiShiftStatus;
  hubId: string | null;
  hubName: string | null;
}

/** `"₹120/hr + incentives"` / `"₹120/hr + surge"` — the `SlotCard` pay line. */
function payDisplay(basePay?: number | null, hasIncentive?: boolean, isSurge?: boolean): string {
  const base = basePay ? `${rupees(basePay)}/hr` : 'Pay as per hub rate';
  const suffixes: string[] = [];
  if (hasIncentive) suffixes.push('incentives');
  if (isSurge) suffixes.push('surge');
  return suffixes.length > 0 ? `${base} + ${suffixes.join(' + ')}` : base;
}

/** Maps the stored `SCREAMING_CASE` shift state plus capacity onto the API enum. */
function toApiShiftStatus(shiftStatus: string, bookedCount: number, capacity: number): ApiShiftStatus {
  switch (String(shiftStatus).toUpperCase()) {
    case 'ACTIVE': return 'started';
    case 'COMPLETED': return 'completed';
    case 'CANCELLED': return 'closed';
    default: return bookedCount >= capacity ? 'full' : 'open';
  }
}

/** Minutes-from-midnight for an `HH:mm` string; null when absent or malformed. */
function minutesOfDay(hhmm?: string | null): number | null {
  const match = hhmm ? /^(\d{1,2}):(\d{2})/.exec(String(hhmm)) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Absolute instant a shift starts, combining its date with `startTime`. */
function shiftStartAt(shift: { date?: Date | null; startTime?: string | null }): Date | null {
  const minutes = minutesOfDay(shift.startTime);
  if (minutes == null) return null;
  const base = hubDayStart(shift.date ? new Date(shift.date) : new Date());
  return new Date(base.getTime() + minutes * 60000);
}

function toShiftSlotDto(
  shift: any,
  bookedCount: number,
  booked: boolean,
  hubName: string | null,
): ShiftSlotDto {
  const capacity = shift.capacity ?? 1;
  return {
    id: String(shift._id),
    label: shift.name,
    date: hubDateKey(shift.date ? new Date(shift.date) : new Date()),
    startTime: shift.startTime || '',
    endTime: shift.endTime || '',
    timeDisplay: timeRangeDisplay(shift.startTime, shift.endTime, shift.time),
    payDisplay: payDisplay(shift.basePay, shift.hasIncentive, shift.isSurge),
    basePayPerHour: shift.basePay ?? null,
    hasIncentive: Boolean(shift.hasIncentive),
    isSurge: Boolean(shift.isSurge),
    capacity,
    bookedCount,
    remainingSlots: Math.max(0, capacity - bookedCount),
    booked,
    isBookedByMe: booked,
    status: toApiShiftStatus(shift.status, bookedCount, capacity),
    hubId: shift.warehouseKey || null,
    hubName,
  };
}

/** Live booking counts for a set of shifts, excluding cancellations and no-shows. */
async function countBookings(shiftIds: mongoose.Types.ObjectId[]): Promise<Map<string, number>> {
  if (shiftIds.length === 0) return new Map();
  const rows = await PickerShiftAssignment.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { shiftId: { $in: shiftIds }, status: { $in: ['ASSIGNED', 'STARTED', 'COMPLETED'] } } },
    { $group: { _id: '$shiftId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

async function hubNames(warehouseKeys: string[]): Promise<Map<string, string>> {
  const keys = warehouseKeys.filter(Boolean);
  if (keys.length === 0) return new Map();
  const hubs = (await PickerWorkLocation.find({ warehouseKey: { $in: keys } })
    .select('warehouseKey name')
    .lean()) as Array<{ warehouseKey: string; name: string }>;
  return new Map(hubs.map((h) => [h.warehouseKey, h.name]));
}

/** Builds the API 18 DTO for one shift, used by book/unbook to return the patched slot. */
async function buildSlot(shift: any, pickerId: string): Promise<ShiftSlotDto> {
  const [counts, names, mine] = await Promise.all([
    countBookings([shift._id]),
    hubNames([shift.warehouseKey]),
    PickerShiftAssignment.findOne({
      userId: new mongoose.Types.ObjectId(pickerId),
      shiftId: shift._id,
      status: { $in: ['ASSIGNED', 'STARTED', 'COMPLETED'] },
    }).select('_id').lean(),
  ]);
  return toShiftSlotDto(shift, counts.get(String(shift._id)) || 0, Boolean(mine), names.get(shift.warehouseKey) || null);
}

// ─── List available shifts (API 18) ───────────────────────────────────────────

/**
 * Bookable slots for a day (or range), each annotated with the caller's own
 * booking state and live remaining capacity.
 *
 * Legacy `PickerShift` rows have no `date`; they are treated as recurring and
 * always included, which keeps pre-existing catalogue data usable.
 */
export async function listAvailableShifts(
  pickerId: string,
  params: { warehouseKey?: string; date?: string; dateFrom?: string; dateTo?: string },
): Promise<ShiftSlotDto[]> {
  const user = (await PickerUser.findById(pickerId).select('currentLocationId').lean()) as any;
  const warehouseKey = params.warehouseKey || user?.currentLocationId;

  const query: Record<string, unknown> = { status: { $in: ['SCHEDULED', 'ACTIVE'] } };
  if (warehouseKey) query.warehouseKey = warehouseKey;

  const from = parseHubDate(params.dateFrom) || parseHubDate(params.date) || hubDayStart();
  const to = params.dateTo
    ? hubDayEnd(parseHubDate(params.dateTo) as Date)
    : hubDayEnd(parseHubDate(params.date) || from);
  query.$or = [{ date: { $gte: from, $lte: to } }, { date: null }, { date: { $exists: false } }];

  const shifts = (await PickerShift.find(query).sort({ startTime: 1 }).lean()) as any[];
  if (shifts.length === 0) return [];

  const [counts, names, myAssignments] = await Promise.all([
    countBookings(shifts.map((s) => s._id)),
    hubNames(shifts.map((s) => s.warehouseKey)),
    PickerShiftAssignment.find({
      userId: new mongoose.Types.ObjectId(pickerId),
      shiftId: { $in: shifts.map((s) => s._id) },
      status: { $in: ['ASSIGNED', 'STARTED', 'COMPLETED'] },
    })
      .select('shiftId')
      .lean() as Promise<Array<{ shiftId: mongoose.Types.ObjectId }>>,
  ]);

  const mine = new Set(myAssignments.map((a) => String(a.shiftId)));
  return shifts.map((shift) =>
    toShiftSlotDto(shift, counts.get(String(shift._id)) || 0, mine.has(String(shift._id)), names.get(shift.warehouseKey) || null),
  );
}

export async function getMyShifts(pickerId: string) {
  return PickerShiftAssignment.find({
    userId: new mongoose.Types.ObjectId(pickerId),
    status: { $in: ['ASSIGNED', 'STARTED'] },
  })
    .populate('shiftId')
    .sort({ date: 1 })
    .lean();
}

// ─── Book (API 19) ────────────────────────────────────────────────────────────

/**
 * Books a slot for the calling rider, enforcing eligibility, capacity, duplicates
 * and overlaps — none of which the previous implementation checked.
 *
 * The capacity guard re-counts after insert and rolls back on overflow. A plain
 * pre-check is racy, and a unique index cannot express "at most N rows", so this
 * insert-then-verify is the narrowest correct approach without a transaction
 * (the deployment target is not guaranteed to be a replica set).
 */
export async function selectShift(pickerId: string, shiftId: string): Promise<{ assignmentId: string; shift: ShiftSlotDto }> {
  const userId = new mongoose.Types.ObjectId(pickerId);

  const user = (await PickerUser.findById(pickerId).select('status').lean()) as any;
  if (!user) throw AppError.notFound('Picker');
  if (String(user.status).toUpperCase() !== 'ACTIVE') {
    throw new AppError('Complete your onboarding before booking shifts.', 403, 'ONBOARDING_INCOMPLETE');
  }

  const shift = await PickerShift.findById(shiftId);
  if (!shift) throw new AppError('Shift not found', 404, 'SHIFT_NOT_FOUND');

  const shiftStatus = String(shift.status).toUpperCase();
  if (shiftStatus === 'CANCELLED' || shiftStatus === 'COMPLETED') {
    throw AppError.conflict('This slot is no longer open for booking.', 'SHIFT_CLOSED');
  }

  const startAt = shiftStartAt(shift);
  if (startAt && startAt.getTime() <= Date.now()) {
    throw AppError.conflict('This slot has already started.', 'SHIFT_CLOSED');
  }

  const existing = await PickerShiftAssignment.findOne({
    userId, shiftId: shift._id, status: { $in: ['ASSIGNED', 'STARTED', 'COMPLETED'] },
  });
  if (existing) {
    // Idempotent: the app treats a double-tap as success.
    return { assignmentId: String(existing._id), shift: await buildSlot(shift.toObject(), pickerId) };
  }

  const shiftDate = shift.date ? new Date(shift.date) : hubDayStart();
  await assertNoOverlap(pickerId, shift, shiftDate);

  const capacity = shift.capacity ?? 1;
  const assignment = await PickerShiftAssignment.create({
    userId,
    shiftId: shift._id,
    date: shiftDate,
    warehouseKey: shift.warehouseKey,
    status: 'ASSIGNED',
  });

  const booked = await PickerShiftAssignment.countDocuments({
    shiftId: shift._id, status: { $in: ['ASSIGNED', 'STARTED', 'COMPLETED'] },
  });
  if (booked > capacity) {
    await PickerShiftAssignment.deleteOne({ _id: assignment._id });
    throw AppError.conflict('This slot just filled up.', 'SHIFT_FULL');
  }

  return { assignmentId: String(assignment._id), shift: await buildSlot(shift.toObject(), pickerId) };
}

/** Refuses a booking whose hours overlap one the rider already holds that day. */
async function assertNoOverlap(pickerId: string, shift: any, shiftDate: Date): Promise<void> {
  const start = minutesOfDay(shift.startTime);
  const end = minutesOfDay(shift.endTime);
  if (start == null || end == null) return;

  const sameDay = (await PickerShiftAssignment.find({
    userId: new mongoose.Types.ObjectId(pickerId),
    status: { $in: ['ASSIGNED', 'STARTED'] },
    date: { $gte: hubDayStart(shiftDate), $lte: hubDayEnd(shiftDate) },
  })
    .populate('shiftId')
    .lean()) as any[];

  for (const assignment of sameDay) {
    const other = assignment.shiftId;
    if (!other || String(other._id) === String(shift._id)) continue;
    const otherStart = minutesOfDay(other.startTime);
    const otherEnd = minutesOfDay(other.endTime);
    if (otherStart == null || otherEnd == null) continue;
    if (start < otherEnd && otherStart < end) {
      throw new AppError(
        `This slot overlaps your booked ${other.name} shift.`,
        409,
        'SHIFT_OVERLAP',
        { conflictingShiftId: String(other._id), conflictingShiftName: other.name },
      );
    }
  }
}

// ─── Unbook (API 20) ──────────────────────────────────────────────────────────

export async function deselectShift(
  pickerId: string,
  shiftId: string,
  reason?: string,
): Promise<{ cancelled: boolean; shift: ShiftSlotDto }> {
  const assignment = await PickerShiftAssignment.findOne({
    userId: new mongoose.Types.ObjectId(pickerId),
    shiftId: new mongoose.Types.ObjectId(shiftId),
    status: { $in: ['ASSIGNED', 'STARTED', 'COMPLETED'] },
  });
  if (!assignment) throw new AppError('You do not hold this shift.', 404, 'ASSIGNMENT_NOT_FOUND');

  if (assignment.status !== 'ASSIGNED') {
    throw AppError.conflict('This shift has already started and cannot be released.', 'SHIFT_ALREADY_STARTED');
  }

  const shift = await PickerShift.findById(shiftId);
  if (!shift) throw new AppError('Shift not found', 404, 'SHIFT_NOT_FOUND');

  const startAt = shiftStartAt(shift);
  if (startAt && startAt.getTime() - Date.now() < CANCELLATION_CUTOFF_MINUTES * 60000) {
    throw AppError.conflict(
      `Slots cannot be released within ${CANCELLATION_CUTOFF_MINUTES} minutes of the start time.`,
      'CANCELLATION_WINDOW_CLOSED',
    );
  }

  assignment.status = 'CANCELLED';
  assignment.cancelledAt = new Date();
  await assignment.save();

  if (reason) {
    // Kept on the action log rather than the assignment: the ops audit trail is
    // append-only, whereas an assignment can be re-created for the same slot.
    await PickerActionLog.create({
      userId: new mongoose.Types.ObjectId(pickerId),
      action: 'SHIFT_UNBOOKED',
      entityType: 'PickerShift',
      entityId: shiftId,
      details: { reason },
    });
  }

  return { cancelled: true, shift: await buildSlot(shift.toObject(), pickerId) };
}

// ─── Start shift / go online (API 22) ─────────────────────────────────────────

export interface StartShiftResultDto {
  assignmentId: string;
  shiftId: string;
  status: 'started';
  startedAt: string;
  isOnline: boolean;
  shift: { timeDisplay: string };
}

/**
 * Puts the rider online against a booked slot.
 *
 * `shiftId` is read from the body (falling back to the path parameter), which is
 * what fixes the previously always-404 `POST /shifts/start` route.
 */
export async function startShift(
  pickerId: string,
  shiftId: string,
  location?: { latitude: number; longitude: number },
): Promise<StartShiftResultDto> {
  const userId = new mongoose.Types.ObjectId(pickerId);

  const user = (await PickerUser.findById(pickerId).select('status currentLocationId').lean()) as any;
  if (!user) throw AppError.notFound('Picker');
  if (String(user.status).toUpperCase() !== 'ACTIVE') {
    throw new AppError('Complete your onboarding before going online.', 403, 'ONBOARDING_INCOMPLETE');
  }

  const alreadyStarted = await PickerShiftAssignment.findOne({ userId, status: 'STARTED' }).populate('shiftId');
  if (alreadyStarted) {
    if (String((alreadyStarted.shiftId as any)?._id) === String(shiftId)) {
      // Idempotent re-tap of the toggle.
      return buildStartResult(alreadyStarted, alreadyStarted.shiftId as any, true);
    }
    throw AppError.conflict('Another shift is already active. End it before starting a new one.', 'ANOTHER_SHIFT_ACTIVE');
  }

  // Overnight float must be transferred before starting the next day's shift.
  await assertCodTransferredForOnline(pickerId);

  const assignment = await PickerShiftAssignment.findOne({
    userId, shiftId: new mongoose.Types.ObjectId(shiftId), status: 'ASSIGNED',
  }).populate('shiftId');
  if (!assignment) {
    throw new AppError('You have not booked this shift.', 404, 'ASSIGNMENT_NOT_FOUND');
  }

  const shift = assignment.shiftId as any;
  await assertWithinGeofence(shift?.warehouseKey || user.currentLocationId, location);

  const startedAt = new Date();
  assignment.status = 'STARTED';
  assignment.startedAt = startedAt;
  await assignment.save();

  await PickerUser.updateOne(
    { _id: userId },
    {
      $set: {
        isOnline: true,
        onlineSince: startedAt,
        activeShiftId: assignment.shiftId,
        onBreak: false,
        lastSeenAt: startedAt,
        ...(location ? { gpsLocation: { ...location, timestamp: startedAt } } : {}),
      },
    },
  );

  return buildStartResult(assignment, shift, true);
}

function buildStartResult(assignment: any, shift: any, isOnline: boolean): StartShiftResultDto {
  return {
    assignmentId: String(assignment._id),
    shiftId: String(shift?._id || assignment.shiftId),
    status: 'started',
    startedAt: new Date(assignment.startedAt || Date.now()).toISOString(),
    isOnline,
    shift: { timeDisplay: timeRangeDisplay(shift?.startTime, shift?.endTime, shift?.time) },
  };
}

/**
 * Geofence check against the hub. Skipped when the client sends no coordinates or
 * the hub has none, so a missing GPS fix cannot lock a rider out of their shift.
 */
async function assertWithinGeofence(
  warehouseKey?: string | null,
  location?: { latitude: number; longitude: number },
): Promise<void> {
  if (!location || !warehouseKey) return;

  const hub = (await PickerWorkLocation.findOne({ warehouseKey }).select('coordinates geofenceRadius name').lean()) as any;
  const lat = hub?.coordinates?.latitude;
  const lng = hub?.coordinates?.longitude;
  if (!hasCoords(lat, lng)) return;

  const radiusMetres = hub.geofenceRadius ?? 200;
  const distanceKm = haversineKm(location.latitude, location.longitude, lat, lng);
  if (distanceKm * 1000 > radiusMetres) {
    throw new AppError(
      `You are too far from ${hub.name || 'the hub'} to start your shift.`,
      403,
      'OUTSIDE_GEOFENCE',
      { distanceKm: Math.round(distanceKm * 10) / 10, allowedRadiusMetres: radiusMetres },
    );
  }
}

// ─── End shift / go offline (API 23) ──────────────────────────────────────────

export interface EndShiftResultDto {
  assignmentId: string;
  status: 'completed';
  completedAt: string;
  isOnline: boolean;
  summary: { workedMinutes: number; ordersDelivered: number; earnings: number; cashInHand: number };
  warnings: string[];
}

/**
 * Takes the rider offline, refusing while a delivery is still open or while they
 * hold more COD cash than the carry limit allows.
 */
export async function endShift(
  pickerId: string,
  shiftId: string,
  location?: { latitude: number; longitude: number },
): Promise<EndShiftResultDto> {
  const userId = new mongoose.Types.ObjectId(pickerId);

  const assignment = await PickerShiftAssignment.findOne({
    userId, shiftId: new mongoose.Types.ObjectId(shiftId), status: 'STARTED',
  });
  if (!assignment) throw new AppError('This shift has not been started.', 404, 'SHIFT_NOT_STARTED');

  const [openOrder, openBatch] = await Promise.all([
    Order.findOne({ pickerId: userId, riderStage: { $in: ['accepted', 'picked_up'] } }).select('_id orderNumber').lean(),
    PickerBulkBatch.findOne({ pickerId: userId, status: { $in: ['loading', 'ready', 'dispatched', 'in_transit'] } })
      .select('batchId').lean(),
  ]);
  if (openOrder) {
    throw new AppError('Finish your active delivery before going offline.', 409, 'ACTIVE_ORDER_IN_PROGRESS', {
      orderId: String((openOrder as any)._id),
      orderNumber: (openOrder as any).orderNumber,
    });
  }
  if (openBatch) {
    throw new AppError('Finish your active bulk batch before going offline.', 409, 'ACTIVE_ORDER_IN_PROGRESS', {
      batchId: (openBatch as any).batchId,
    });
  }

  const cashInHand = await getCashInHand(pickerId);
  if (cashInHand > pickerConfig.codOfflineCarryLimit) {
    throw new AppError(
      `Transfer your COD cash (${rupees(cashInHand)}) to the company before ending the shift.`,
      409,
      'UNDEPOSITED_CASH',
      { cashInHand, allowedCarry: pickerConfig.codOfflineCarryLimit },
    );
  }

  const completedAt = new Date();
  assignment.status = 'COMPLETED';
  assignment.completedAt = completedAt;
  await assignment.save();

  await PickerUser.updateOne(
    { _id: userId },
    {
      $set: {
        isOnline: false,
        onlineSince: null,
        activeShiftId: null,
        onBreak: false,
        lastSeenAt: completedAt,
        ...(location ? { gpsLocation: { ...location, timestamp: completedAt } } : {}),
      },
    },
  );

  const startedAt = assignment.startedAt ? new Date(assignment.startedAt) : completedAt;
  const workedMinutes = Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 60000));

  const [delivered] = await Order.aggregate<{ count: number; earnings: number }>([
    { $match: { pickerId: userId, riderStage: 'delivered', deliveredAt: { $gte: startedAt, $lte: completedAt } } },
    { $group: { _id: null, count: { $sum: 1 }, earnings: { $sum: '$riderPayout' } } },
    { $project: { _id: 0, count: 1, earnings: 1 } },
  ]);

  return {
    assignmentId: String(assignment._id),
    status: 'completed',
    completedAt: completedAt.toISOString(),
    isOnline: false,
    summary: {
      workedMinutes,
      ordersDelivered: delivered?.count || 0,
      earnings: Math.round(delivered?.earnings || 0),
      cashInHand,
    },
    warnings: cashInHand > 0 ? ['UNDEPOSITED_CASH'] : [],
  };
}

/** The rider's currently running shift, used by the dashboard and cash deadline. */
export async function getActiveAssignment(pickerId: string) {
  return PickerShiftAssignment.findOne({
    userId: new mongoose.Types.ObjectId(pickerId),
    status: 'STARTED',
  })
    .populate('shiftId')
    .lean();
}

// ─── Shiftless go-online / go-offline (HomeScreen toggle) ─────────────────────

export interface GoOnlineResultDto {
  isOnline: boolean;
  onlineSince: string | null;
  mode: 'shiftless' | 'shift';
}

export interface GoOfflineResultDto {
  isOnline: boolean;
  warnings?: string[];
}

/**
 * Puts the rider online without a booked shift slot (24h / shiftless mode).
 * Used by Rider HomeScreen when no ObjectId shift is selected.
 */
export async function goOnline(
  pickerId: string,
  location?: { latitude: number; longitude: number },
): Promise<GoOnlineResultDto> {
  const userId = new mongoose.Types.ObjectId(pickerId);
  const user = (await PickerUser.findById(pickerId)
    .select('status isOnline onlineSince activeShiftId currentLocationId')
    .lean()) as any;
  if (!user) throw AppError.notFound('Picker');
  if (String(user.status).toUpperCase() !== 'ACTIVE') {
    throw new AppError('Complete your onboarding before going online.', 403, 'ONBOARDING_INCOMPLETE');
  }

  // Already online — idempotent success (HomeScreen re-taps / reconnect).
  if (user.isOnline) {
    const active = await getActiveAssignment(pickerId);
    return {
      isOnline: true,
      onlineSince: user.onlineSince
        ? new Date(user.onlineSince).toISOString()
        : new Date().toISOString(),
      mode: active ? 'shift' : 'shiftless',
    };
  }

  // Undeposited COD from a prior shift blocks going online until transferred.
  await assertCodTransferredForOnline(pickerId);

  // Shiftless go-online is presence for dispatch across the service area.
  // Hub geofence applies to booked shift start (`startShift`), not this toggle.
  // GPS is optional — recorded when present, never required to go online.
  const onlineSince = new Date();
  await PickerUser.updateOne(
    { _id: userId },
    {
      $set: {
        isOnline: true,
        onlineSince,
        onBreak: false,
        lastSeenAt: onlineSince,
        ...(location ? { gpsLocation: { ...location, timestamp: onlineSince } } : {}),
      },
    },
  );

  const active = await getActiveAssignment(pickerId);
  try {
    const cacheService = (await import('../../utils/cache')).default;
    await cacheService.del('rider:dashboard:counts:picker');
    await cacheService.del('rider:summary:picker');
    await cacheService.delPattern('riders:*');
  } catch {
    /* cache optional */
  }
  return {
    isOnline: true,
    onlineSince: onlineSince.toISOString(),
    mode: active ? 'shift' : 'shiftless',
  };
}

/**
 * Takes a shiftless (or already-online) rider offline. Same delivery/cash guards
 * as endShift so an open order cannot be abandoned.
 */
export async function goOffline(
  pickerId: string,
  location?: { latitude: number; longitude: number },
): Promise<GoOfflineResultDto> {
  const userId = new mongoose.Types.ObjectId(pickerId);
  const user = (await PickerUser.findById(pickerId).select('status isOnline activeShiftId').lean()) as any;
  if (!user) throw AppError.notFound('Picker');

  if (!user.isOnline) {
    return { isOnline: false, warnings: [] };
  }

  // If a booked shift is still STARTED, prefer ending that assignment so
  // attendance/shift state stays consistent with endShift.
  const active = await getActiveAssignment(pickerId);
  if (active) {
    const shiftId = String((active as any).shiftId?._id || (active as any).shiftId);
    const ended = await endShift(pickerId, shiftId, location);
    return { isOnline: ended.isOnline, warnings: ended.warnings };
  }

  const [openOrder, openBatch] = await Promise.all([
    Order.findOne({ pickerId: userId, riderStage: { $in: ['accepted', 'picked_up'] } })
      .select('_id orderNumber')
      .lean(),
    PickerBulkBatch.findOne({
      pickerId: userId,
      status: { $in: ['loading', 'ready', 'dispatched', 'in_transit'] },
    })
      .select('batchId')
      .lean(),
  ]);
  if (openOrder) {
    throw new AppError('Finish your active delivery before going offline.', 409, 'ACTIVE_ORDER_IN_PROGRESS', {
      orderId: String((openOrder as any)._id),
      orderNumber: (openOrder as any).orderNumber,
    });
  }
  if (openBatch) {
    throw new AppError('Finish your active bulk batch before going offline.', 409, 'ACTIVE_ORDER_IN_PROGRESS', {
      batchId: (openBatch as any).batchId,
    });
  }

  const cashInHand = await getCashInHand(pickerId);
  if (cashInHand > pickerConfig.codOfflineCarryLimit) {
    throw new AppError(
      `Transfer your COD cash (${rupees(cashInHand)}) to the company before going offline.`,
      409,
      'UNDEPOSITED_CASH',
      { cashInHand, allowedCarry: pickerConfig.codOfflineCarryLimit },
    );
  }

  const now = new Date();
  await PickerUser.updateOne(
    { _id: userId },
    {
      $set: {
        isOnline: false,
        onlineSince: null,
        onBreak: false,
        lastSeenAt: now,
        ...(location ? { gpsLocation: { ...location, timestamp: now } } : {}),
      },
    },
  );

  return {
    isOnline: false,
    warnings: cashInHand > 0 ? ['UNDEPOSITED_CASH'] : [],
  };
}
