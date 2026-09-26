/**
 * Bridge: Admin HR / Shifts / Payouts / Notifications ↔ Rider App (picker_*) collections.
 * Mirrors pickerFleet.bridge.ts for workforce screens that previously read empty parallel stores.
 */
import mongoose from 'mongoose';
import {
  PickerUser,
  PickerShift,
  PickerShiftAssignment,
  PickerWithdrawalRequest,
  PickerWallet,
  PickerDocument,
  PickerNotification,
  PickerTransaction,
} from '../picker/picker.models';
import { RIDER_APP_USER_FILTER, findPickerFleetUser, mapPickerToAdminDirectory } from './pickerFleet.bridge';

function phoneDisplay(phone?: string | null, placeholder?: boolean): string {
  if (placeholder || !phone) return '';
  const p = String(phone);
  if (p.startsWith('15') || p.startsWith('12')) return '';
  return p.startsWith('+') ? p : `+91${p.replace(/\D/g, '').slice(-10)}`;
}

function hrStatusFromPicker(status?: string | null): 'active' | 'inactive' | 'suspended' | 'onboarding' {
  const s = String(status || '').toUpperCase();
  if (s === 'ACTIVE') return 'active';
  if (s === 'SUSPENDED') return 'suspended';
  if (s === 'INACTIVE' || s === 'REJECTED') return 'inactive';
  return 'onboarding';
}

function onboardingFromPicker(status?: string | null): string {
  const s = String(status || '').toUpperCase();
  if (s === 'ACTIVE') return 'approved';
  if (s === 'REJECTED') return 'rejected';
  if (s === 'PENDING' || s === 'DOCUMENTS_PENDING') return 'pending_docs';
  if (s === 'UNDER_REVIEW') return 'under_review';
  return 'invited';
}

export function mapPickerToHR(u: Record<string, any>) {
  const dir = mapPickerToAdminDirectory(u as any);
  const status = hrStatusFromPicker(u.status);
  const onboardingStatus = onboardingFromPicker(u.status);
  return {
    id: String(u._id),
    _id: String(u._id),
    name: dir.name || 'Rider',
    phone: phoneDisplay(u.phone, u.phoneIsPlaceholder) || dir.phone || '',
    email: u.email || '',
    status,
    onboardingStatus,
    trainingStatus: 'not_started',
    appAccess: status === 'active' ? 'enabled' : 'disabled',
    deviceAssigned: false,
    hub: dir.hub,
    vehicle: dir.vehicleType,
    isOnline: dir.isOnline,
    contract: {
      startDate: u.approvedAt || u.createdAt || new Date(),
      endDate: null,
      renewalDue: false,
    },
    compliance: {
      isCompliant: status !== 'suspended',
      lastAuditDate: u.updatedAt || new Date(),
      policyViolationsCount: 0,
    },
    suspension: {
      isSuspended: status === 'suspended',
      reason: u.rejectedReason || null,
      since: u.updatedAt || null,
    },
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    source: 'picker_users',
  };
}

export async function listHRRidersFromPickers(filters: {
  status?: string;
  onboardingStatus?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 50));
  const and: Record<string, unknown>[] = [...(RIDER_APP_USER_FILTER.$and || [])];

  if (filters.status) {
    const s = filters.status.toLowerCase();
    const map: Record<string, string[]> = {
      active: ['ACTIVE'],
      inactive: ['INACTIVE', 'REJECTED'],
      suspended: ['SUSPENDED'],
      onboarding: ['PENDING', 'DOCUMENTS_PENDING', 'UNDER_REVIEW', 'INVITED'],
    };
    and.push({ status: { $in: map[s] || [filters.status.toUpperCase()] } });
  }
  if (filters.onboardingStatus) {
    const o = filters.onboardingStatus.toLowerCase();
    if (o === 'approved') and.push({ status: 'ACTIVE' });
    else if (o === 'rejected') and.push({ status: 'REJECTED' });
    else if (o.includes('doc') || o === 'pending') and.push({ status: { $in: ['PENDING', 'DOCUMENTS_PENDING'] } });
    else if (o.includes('review')) and.push({ status: 'UNDER_REVIEW' });
  }
  if (filters.search) {
    const re = new RegExp(String(filters.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    and.push({ $or: [{ name: re }, { email: re }, { phone: re }] });
  }

  const query = { $and: and };
  const [rows, total] = await Promise.all([
    PickerUser.find(query).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    PickerUser.countDocuments(query),
  ]);
  return { riders: rows.map((r) => mapPickerToHR(r as any)), total, page, limit, source: 'picker_users' };
}

export async function getHRRiderFromPicker(riderId: string) {
  const u = await findPickerFleetUser(riderId);
  return u ? mapPickerToHR(u as any) : null;
}

export async function updateHRRiderOnPicker(riderId: string, body: Record<string, unknown>) {
  if (!mongoose.isValidObjectId(riderId)) return null;
  const patch: Record<string, unknown> = {};
  if (body.name != null) patch.name = body.name;
  if (body.email != null) patch.email = body.email;
  if (body.phone != null) {
    const digits = String(body.phone).replace(/\D/g, '').slice(-10);
    if (digits.length === 10) {
      patch.phone = digits;
      patch.phoneIsPlaceholder = false;
    }
  }
  if (body.status != null) {
    const s = String(body.status).toLowerCase();
    patch.status =
      s === 'active' ? 'ACTIVE' : s === 'suspended' ? 'SUSPENDED' : s === 'inactive' ? 'INACTIVE' : 'PENDING';
  }
  if (body.appAccess === 'enabled') patch.status = 'ACTIVE';
  if (body.appAccess === 'disabled') patch.isOnline = false;
  if (Object.keys(patch).length === 0) return getHRRiderFromPicker(riderId);
  const updated = await PickerUser.findByIdAndUpdate(riderId, patch, { new: true }).lean();
  return updated ? mapPickerToHR(updated as any) : null;
}

export async function approveHRRiderOnPicker(riderId: string) {
  if (!mongoose.isValidObjectId(riderId)) return null;
  const updated = await PickerUser.findByIdAndUpdate(
    riderId,
    { status: 'ACTIVE', approvedAt: new Date(), isOnline: false },
    { new: true },
  ).lean();
  return updated ? mapPickerToHR(updated as any) : null;
}

export async function getHRDashboardSummaryFromPickers() {
  const base = RIDER_APP_USER_FILTER;
  const [total, pendingOnboarding, pendingDocuments, active, suspended] = await Promise.all([
    PickerUser.countDocuments(base),
    PickerUser.countDocuments({ $and: [...(base.$and || []), { status: { $in: ['PENDING', 'UNDER_REVIEW'] } }] }),
    PickerUser.countDocuments({ $and: [...(base.$and || []), { status: 'DOCUMENTS_PENDING' }] }),
    PickerUser.countDocuments({ $and: [...(base.$and || []), { status: 'ACTIVE' }] }),
    PickerUser.countDocuments({ $and: [...(base.$and || []), { status: 'SUSPENDED' }] }),
  ]);
  return { total, pendingOnboarding, pendingDocuments, active, suspended, source: 'picker_users' };
}

function adminStatusFromPickerShift(status?: string | null): string {
  const s = String(status || '').toUpperCase();
  if (s === 'CANCELLED') return 'cancelled';
  if (s === 'COMPLETED') return 'published';
  if (s === 'ACTIVE' || s === 'SCHEDULED') return 'published';
  return 'draft';
}

function formatDateOnly(value?: Date | string | null): string | null {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function mapPickerShiftToAdmin(
  shift: Record<string, any>,
  bookedCount = 0,
): Record<string, unknown> {
  const hub = shift.warehouseKey || shift.siteId || shift.site || null;
  const status = adminStatusFromPickerShift(shift.status);
  return {
    id: String(shift._id),
    _id: String(shift._id),
    name: shift.name || `Shift ${shift.startTime || ''}`.trim(),
    title: shift.name,
    templateName: shift.name,
    hubId: hub,
    hubName: hub,
    hub,
    store: hub,
    darkStore: hub,
    scope: hub || 'All stores',
    date: formatDateOnly(shift.date),
    startTime: shift.startTime || '',
    endTime: shift.endTime || '',
    start: shift.startTime || '',
    end: shift.endTime || '',
    hours: shift.time || `${shift.startTime || ''} – ${shift.endTime || ''}`.trim(),
    durationMinutes: null,
    capacity: shift.capacity ?? 1,
    bookedCount,
    assigned: bookedCount,
    assignedCount: bookedCount,
    headcountTarget: String(shift.capacity ?? 1),
    target: shift.capacity ?? 1,
    confirmed: bookedCount,
    gap: Math.max(0, (shift.capacity ?? 1) - bookedCount),
    status,
    appliesTo: 'Rider',
    workforce: 'Rider',
    type: 'Rider',
    days: 'Mon–Sun',
    breakTime: `${shift.breakDuration ?? 0} min`,
    break: `${shift.breakDuration ?? 0} min`,
    isPeak: !!shift.isSurge,
    basePay: shift.basePay ?? 0,
    bonus: shift.hasIncentive ? 1 : 0,
    currency: 'INR',
    source: 'picker_shifts',
  };
}

export async function listShiftsFromPickers(
  filters: Record<string, unknown> = {},
  options: { page?: number; limit?: number } = {},
) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(options.limit) || 50));
  const query: Record<string, unknown> = {};
  const hubId = filters.hubId || filters.storeId || filters.warehouseKey;
  if (hubId) query.warehouseKey = String(hubId);
  if (filters.status) {
    const s = String(filters.status).toLowerCase();
    if (s === 'cancelled') query.status = 'CANCELLED';
    else if (s === 'draft') query.status = { $nin: ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] };
    else query.status = { $in: ['SCHEDULED', 'ACTIVE', 'COMPLETED'] };
  } else {
    query.status = { $ne: 'CANCELLED' };
  }
  if (filters.search) {
    const re = new RegExp(String(filters.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ name: re }, { warehouseKey: re }, { startTime: re }];
  }

  const [shifts, total] = await Promise.all([
    PickerShift.find(query).sort({ startTime: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    PickerShift.countDocuments(query),
  ]);

  const ids = shifts.map((s) => s._id);
  const counts =
    ids.length === 0
      ? []
      : await PickerShiftAssignment.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
          { $match: { shiftId: { $in: ids }, status: { $in: ['ASSIGNED', 'STARTED', 'COMPLETED'] } } },
          { $group: { _id: '$shiftId', count: { $sum: 1 } } },
        ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  const items = shifts.map((s) => mapPickerShiftToAdmin(s as any, countMap.get(String(s._id)) || 0));

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
    summary: { draft: 0, published: total, cancelled: 0, all: total },
    source: 'picker_shifts',
  };
}

export async function listStoreShiftSlots(storeId: string) {
  const query: Record<string, unknown> = {
    status: { $in: ['SCHEDULED', 'ACTIVE'] },
  };
  if (storeId && storeId !== 'all' && storeId !== '-') {
    query.warehouseKey = storeId;
  }
  const shifts = await PickerShift.find(query).sort({ startTime: 1 }).limit(200).lean();
  const ids = shifts.map((s) => s._id);
  const counts =
    ids.length === 0
      ? []
      : await PickerShiftAssignment.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
          { $match: { shiftId: { $in: ids }, status: { $in: ['ASSIGNED', 'STARTED', 'COMPLETED'] } } },
          { $group: { _id: '$shiftId', count: { $sum: 1 } } },
        ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  const slots = shifts.map((s) => mapPickerShiftToAdmin(s as any, countMap.get(String(s._id)) || 0));
  return { storeId, slots, total: slots.length, source: 'picker_shifts' };
}

/** Roster board rows derived from picker shift capacity + bookings (no separate change-request collection). */
export async function listRosterFromPickerAssignments() {
  const shifts = await PickerShift.find({ status: { $in: ['SCHEDULED', 'ACTIVE'] } })
    .sort({ startTime: 1 })
    .limit(200)
    .lean();
  const ids = shifts.map((s) => s._id);
  const counts =
    ids.length === 0
      ? []
      : await PickerShiftAssignment.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
          { $match: { shiftId: { $in: ids }, status: { $in: ['ASSIGNED', 'STARTED'] } } },
          { $group: { _id: '$shiftId', count: { $sum: 1 } } },
        ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  const requests = shifts.map((s) => {
    const booked = countMap.get(String(s._id)) || 0;
    const capacity = s.capacity ?? 1;
    const gap = Math.max(0, capacity - booked);
    const under = gap > 0;
    return {
      ...mapPickerShiftToAdmin(s as any, booked),
      requestId: String(s._id),
      shift: s.name,
      shiftName: s.name,
      location: s.warehouseKey || '—',
      status: under ? 'understaffed' : 'staffed',
      tab: under ? 'Today' : 'Today',
      starts: s.startTime || '—',
    };
  });
  return { requests, total: requests.length, source: 'picker_shift_assignments' };
}

/** Persist a new store shift slot into `picker_shifts`. */
export async function createStoreShiftSlot(
  storeId: string,
  body: Record<string, unknown>,
) {
  const warehouseKey =
    String(body.warehouseKey || body.hubId || body.hub || body.store || storeId || '').trim() || storeId;
  const name = String(body.name || body.title || body.templateName || 'Shift').trim() || 'Shift';
  const startTime = String(body.startTime || body.start || '').trim() || '09:00';
  const endTime = String(body.endTime || body.end || '').trim() || '18:00';
  let date: Date | undefined;
  if (body.date) {
    const d = new Date(String(body.date));
    if (!Number.isNaN(d.getTime())) date = d;
  }
  const doc = await PickerShift.create({
    name,
    warehouseKey,
    site: warehouseKey,
    siteId: warehouseKey,
    startTime,
    endTime,
    time: `${startTime} – ${endTime}`,
    date,
    capacity: Math.max(1, Number(body.capacity ?? body.target ?? body.headcountTarget) || 1),
    breakDuration: Math.max(0, Number(body.breakDuration ?? body.breakMinutes) || 0),
    status: 'SCHEDULED',
    basePay: Number(body.basePay) || 0,
    hasIncentive: body.hasIncentive !== false,
    isSurge: !!body.isPeak || !!body.isSurge,
  });
  return mapPickerShiftToAdmin(doc.toObject() as Record<string, unknown>, 0);
}

/** Reassign / assign a picker onto a shift in `picker_shift_assignments`. */
export async function reassignPickerShift(
  shiftId: string,
  body: Record<string, unknown>,
) {
  if (!mongoose.Types.ObjectId.isValid(shiftId)) {
    throw Object.assign(new Error('Invalid shift id'), { statusCode: 400 });
  }
  const shift = (await PickerShift.findById(shiftId).lean()) as { date?: Date | string; warehouseKey?: string } | null;
  if (!shift) throw Object.assign(new Error('Shift not found'), { statusCode: 404 });

  const pickerId = String(body.pickerId || body.userId || body.toPickerId || '').trim();
  if (!pickerId || !mongoose.Types.ObjectId.isValid(pickerId)) {
    throw Object.assign(new Error('pickerId (ObjectId) is required'), { statusCode: 400 });
  }
  const fromPickerId = String(body.fromPickerId || body.previousPickerId || '').trim();

  const date =
    body.date
      ? new Date(String(body.date))
      : shift.date
        ? new Date(shift.date)
        : new Date();
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error('Invalid date'), { statusCode: 400 });
  }
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  if (fromPickerId && mongoose.Types.ObjectId.isValid(fromPickerId)) {
    await PickerShiftAssignment.updateMany(
      {
        shiftId: new mongoose.Types.ObjectId(shiftId),
        userId: new mongoose.Types.ObjectId(fromPickerId),
        status: { $in: ['ASSIGNED', 'STARTED'] },
      },
      { status: 'CANCELLED', cancelledAt: new Date() },
    );
  }

  const assignment = (await PickerShiftAssignment.findOneAndUpdate(
    {
      userId: new mongoose.Types.ObjectId(pickerId),
      shiftId: new mongoose.Types.ObjectId(shiftId),
      date: dayStart,
    },
    {
      $set: {
        warehouseKey: shift.warehouseKey || undefined,
        status: 'ASSIGNED',
        cancelledAt: undefined,
      },
      $unset: { startedAt: 1, completedAt: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean()) as { _id: unknown; status?: string } | null;

  return {
    shiftId,
    pickerId,
    fromPickerId: fromPickerId || null,
    assignmentId: assignment ? String(assignment._id) : null,
    status: assignment?.status || 'ASSIGNED',
    date: formatDateOnly(dayStart),
    reassigned: true,
    source: 'picker_shift_assignments',
  };
}

export async function listRiderPayoutsFromPickers(filters: Record<string, string> = {}) {
  const page = Math.max(1, parseInt(filters.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '50', 10) || 50));
  const statusFilter = filters.status ? String(filters.status).toUpperCase() : null;

  const wdQuery: Record<string, unknown> = {};
  if (statusFilter) wdQuery.status = statusFilter;

  const [withdrawals, wdTotal, wallets] = await Promise.all([
    PickerWithdrawalRequest.find(wdQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name phone workforceRole status')
      .lean(),
    PickerWithdrawalRequest.countDocuments(wdQuery),
    PickerWallet.find({}).sort({ updatedAt: -1 }).limit(100).populate('userId', 'name phone workforceRole status totalTrips').lean(),
  ]);

  const fromWithdrawals = withdrawals.map((w: any, i: number) => {
    const user = w.userId && typeof w.userId === 'object' ? w.userId : null;
    return {
      id: String(w._id),
      _id: String(w._id),
      ref: `WD-${String(w._id).slice(-6).toUpperCase()}`,
      payoutId: String(w._id),
      person: user?.name || 'Rider',
      riderName: user?.name || 'Rider',
      name: user?.name || 'Rider',
      riderId: user?._id ? String(user._id) : String(w.userId),
      amount: w.amount,
      net: w.amount,
      base: w.amount,
      incentive: 0,
      deduction: 0,
      deliveries: user?.totalTrips ?? 0,
      status: String(w.status || 'PENDING').toLowerCase(),
      payoutStatus: String(w.status || 'PENDING').toLowerCase(),
      currency: w.currency || 'INR',
      createdAt: w.createdAt,
      source: 'picker_withdrawal_requests',
      kind: 'withdrawal',
      index: i,
    };
  });

  // If no withdrawals yet, surface wallet balances so Admin Earnings isn't empty.
  if (fromWithdrawals.length === 0) {
    const riderWallets = wallets.filter((w: any) => {
      const role = w.userId?.workforceRole;
      return role !== 'picker';
    });
    const items = riderWallets.slice(0, limit).map((w: any, i: number) => {
      const user = w.userId && typeof w.userId === 'object' ? w.userId : null;
      const earned = Number(w.totalEarnings || w.availableBalance || 0);
      return {
        id: `wallet-${String(w._id)}`,
        _id: String(w._id),
        ref: `WAL-${String(w._id).slice(-6).toUpperCase()}`,
        payoutId: String(w._id),
        person: user?.name || 'Rider',
        riderName: user?.name || 'Rider',
        name: user?.name || 'Rider',
        riderId: user?._id ? String(user._id) : String(w.userId),
        amount: earned,
        net: Number(w.availableBalance || 0),
        base: earned,
        incentive: 0,
        deduction: Number(w.reservedBalance || 0),
        deliveries: user?.totalTrips ?? 0,
        status: earned > 0 ? 'pending' : 'settled',
        payoutStatus: 'pending',
        currency: w.currency || 'INR',
        createdAt: w.updatedAt,
        source: 'picker_wallets',
        kind: 'wallet',
        index: i,
      };
    });
    return { items, total: items.length, page, limit, source: 'picker_wallets' };
  }

  return { items: fromWithdrawals, total: wdTotal, page, limit, source: 'picker_withdrawal_requests' };
}

export async function listPickerWithdrawalsFixed(filters: Record<string, string> = {}) {
  const page = Math.max(1, parseInt(filters.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '50', 10) || 50));
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = String(filters.status).toUpperCase();
  const [items, total] = await Promise.all([
    PickerWithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name phone email workforceRole')
      .lean(),
    PickerWithdrawalRequest.countDocuments(query),
  ]);
  const mapped = items.map((w: any) => {
    const user = w.userId && typeof w.userId === 'object' ? w.userId : null;
    return {
      id: String(w._id),
      _id: String(w._id),
      pickerId: user?._id ? String(user._id) : String(w.userId),
      pickerName: user?.name || '—',
      name: user?.name || '—',
      person: user?.name || '—',
      phone: user?.phone || null,
      amount: w.amount,
      net: w.amount,
      status: String(w.status || 'PENDING').toLowerCase(),
      currency: w.currency || 'INR',
      createdAt: w.createdAt,
      source: 'picker_withdrawal_requests',
    };
  });
  return { items: mapped, list: mapped, withdrawals: mapped, total, page, limit, source: 'picker_withdrawal_requests' };
}

export async function listDocumentsFromPickers(filters: {
  status?: string;
  riderId?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 50));
  const query: Record<string, unknown> = { supersededBy: null };
  if (filters.riderId && mongoose.isValidObjectId(filters.riderId)) {
    query.userId = new mongoose.Types.ObjectId(filters.riderId);
  }
  if (filters.status) query.status = filters.status.toLowerCase();
  const [docs, total] = await Promise.all([
    PickerDocument.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name phone')
      .lean(),
    PickerDocument.countDocuments(query),
  ]);
  const documents = docs.map((d: any) => ({
    id: String(d._id),
    documentId: String(d._id),
    riderId: d.userId?._id ? String(d.userId._id) : String(d.userId),
    riderName: d.userId?.name || '—',
    type: d.type,
    side: d.side || null,
    status: d.status,
    url: d.url || null,
    fileName: d.fileName || null,
    createdAt: d.createdAt,
    source: 'picker_documents',
  }));
  return { documents, total, page, limit, source: 'picker_documents' };
}

export async function listNotificationsFromPickers(filters: {
  read?: boolean;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));
  const query: Record<string, unknown> = {};
  if (filters.read !== undefined) query.read = filters.read;
  const [rows, total] = await Promise.all([
    PickerNotification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name')
      .lean(),
    PickerNotification.countDocuments(query),
  ]);
  const notifications = rows.map((n: any) => ({
    id: String(n._id),
    _id: String(n._id),
    title: n.title,
    body: n.body,
    type: n.type,
    read: !!n.read,
    riderId: n.userId?._id ? String(n.userId._id) : String(n.userId),
    riderName: n.userId?.name || null,
    data: n.data || {},
    createdAt: n.createdAt,
    source: 'picker_notifications',
  }));
  return { notifications, total, page, limit, source: 'picker_notifications' };
}

export async function getRiderCashSummaryFromPickers() {
  const [walletAgg, pendingWd, riderCount] = await Promise.all([
    PickerWallet.aggregate<{ total: number; pending: number }>([
      { $group: { _id: null, total: { $sum: '$totalEarnings' }, pending: { $sum: '$availableBalance' } } },
    ]),
    PickerWithdrawalRequest.countDocuments({ status: 'PENDING' }),
    PickerUser.countDocuments(RIDER_APP_USER_FILTER),
  ]);
  const total = walletAgg[0]?.total || 0;
  const pending = walletAgg[0]?.pending || 0;
  return {
    totalCollected: Math.round(total),
    totalDeposited: Math.round(Math.max(0, total - pending)),
    pendingDeposit: Math.round(pending),
    riders: riderCount,
    pendingWithdrawals: pendingWd,
    source: 'picker_wallets',
  };
}

/** Recent credit transactions as earnings activity (optional enrichment). */
export async function listRecentEarningsCredits(limit = 50) {
  const rows = await PickerTransaction.find({ type: 'credit', status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'name phone')
    .lean();
  return rows.map((t: any) => ({
    id: String(t._id),
    person: t.userId?.name || 'Rider',
    amount: t.amount,
    description: t.description,
    createdAt: t.createdAt,
    source: 'picker_transactions',
  }));
}
