import { RiderShift, RiderShiftAssignment, RiderHR } from './rider.models';

function parseDateOnly(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const dt = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatDateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function parseTimeToMinutes(time: string): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
}

function shiftsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function toShiftDto(shift: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    id: shift.id,
    hubId: shift.hubId,
    hubName: shift.hubName,
    date: formatDateOnly(shift.date as Date),
    startTime: shift.startTime,
    endTime: shift.endTime,
    durationMinutes: shift.durationMinutes,
    capacity: shift.capacity,
    bookedCount: (shift.bookedCount as number) ?? 0,
    status: shift.status,
    isPeak: !!(shift.isPeak),
    basePay: (shift.basePay as number) ?? 0,
    bonus: (shift.bonus as number) ?? 0,
    currency: (shift.currency as string) ?? 'INR',
    breakMinutes: (shift.breakMinutes as number) ?? 0,
    walkInBufferMinutes: (shift.walkInBufferMinutes as number) ?? 15,
    ...overrides,
  };
}

async function generateShiftId(): Promise<string> {
  const latest = await RiderShift.findOne().sort({ createdAt: -1 }).select('id');
  let next = 1;
  if (latest && typeof (latest as { id?: string }).id === 'string') {
    const match = ((latest as { id: string }).id).match(/RSHIFT-(\d+)/i);
    if (match?.[1]) next = (parseInt(match[1], 10) || 0) + 1;
  }
  return `RSHIFT-${String(next).padStart(4, '0')}`;
}

export async function createShift(payload: Record<string, unknown>) {
  const { startTime, endTime } = payload as { startTime: string; endTime: string };
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  if (startMins == null || endMins == null || endMins <= startMins) {
    throw Object.assign(new Error('Invalid shift time window'), { code: 'INVALID_TIME_WINDOW' });
  }
  // Write into Rider App catalogue so Admin + Rider App share the same slots.
  const { PickerShift } = await import('../picker/picker.models');
  const { mapPickerShiftToAdmin } = await import('./pickerOps.bridge');
  const created = await PickerShift.create({
    name: (payload.name as string) || (payload.title as string) || `Shift ${startTime}-${endTime}`,
    warehouseKey: (payload.hubId as string) || (payload.hubName as string) || (payload.scope as string) || undefined,
    startTime,
    endTime,
    time: `${startTime} – ${endTime}`,
    capacity: Number(payload.capacity) || Number(payload.headcountTarget) || 1,
    breakDuration: Number(payload.breakMinutes) || Number(payload.breakDuration) || 0,
    status: 'SCHEDULED',
    basePay: Number(payload.basePay) || 0,
    hasIncentive: true,
    isSurge: !!(payload.isPeak || payload.isSurge),
  });
  return mapPickerShiftToAdmin(created.toObject() as any, 0);
}

export async function getShiftById(id: string) {
  const { PickerShift } = await import('../picker/picker.models');
  const { mapPickerShiftToAdmin } = await import('./pickerOps.bridge');
  if (id && id.length === 24) {
    const picker = (await PickerShift.findById(id).lean()) as { _id: unknown } | null;
    if (picker) {
      const booked = await (await import('../picker/picker.models')).PickerShiftAssignment.countDocuments({
        shiftId: picker._id,
        status: { $in: ['ASSIGNED', 'STARTED', 'COMPLETED'] },
      });
      return mapPickerShiftToAdmin(picker as any, booked);
    }
  }
  return RiderShift.findOne({ id });
}

export async function listShifts(filters: Record<string, unknown> = {}, options: { page?: number; limit?: number } = {}) {
  // Prefer Rider App catalogue (picker_shifts) so Admin Shift Templates / roster aren't empty.
  try {
    const { listShiftsFromPickers } = await import('./pickerOps.bridge');
    const bridged = await listShiftsFromPickers(filters, options);
    if (bridged.total > 0) return bridged;
  } catch {
    /* fall through to legacy rider_shifts */
  }

  const query: Record<string, unknown> = {};
  const { dateFrom, dateTo, date, hubId, hubName, status, isPeak, search, availability, sortBy, sortOrder } = filters as Record<string, unknown>;

  if (dateFrom || dateTo) {
    const range: Record<string, Date> = {};
    if (dateFrom) { const s = parseDateOnly(dateFrom as string); if (s) { s.setHours(0, 0, 0, 0); range.$gte = s; } }
    if (dateTo) { const e = parseDateOnly(dateTo as string); if (e) { e.setHours(23, 59, 59, 999); range.$lte = e; } }
    if (Object.keys(range).length) query.date = range;
  } else if (date) {
    const day = parseDateOnly(date as string) ?? new Date(date as string);
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    query.date = { $gte: start, $lt: end };
  }
  if (hubId) query.hubId = hubId;
  if (hubName) query.hubName = new RegExp(String(hubName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (status) query.status = status;
  if (isPeak === true || isPeak === 'true') query.isPeak = true;
  else if (isPeak === false || isPeak === 'false') query.isPeak = false;

  if (availability === 'full') query.$expr = { $gte: ['$bookedCount', '$capacity'] };
  else if (availability === 'available') query.$expr = { $lt: ['$bookedCount', '$capacity'] };

  if (search) {
    const pattern = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const clause = { $or: [{ id: pattern }, { hubName: pattern }, { hubId: pattern }, { startTime: pattern }] };
    query.$and = [...((query.$and as unknown[]) || []), clause];
  }

  const sort: Record<string, 1 | -1> = { date: sortOrder === 'desc' ? -1 : 1, startTime: 1 };
  if (sortBy === 'capacity') Object.assign(sort, { capacity: sortOrder === 'desc' ? -1 : 1, date: 1 } as Record<string, 1 | -1>);

  const limit = Math.min(Number(options.limit) || 50, 200);
  const page = Math.max(Number(options.page) || 1, 1);

  const [items, total] = await Promise.all([RiderShift.find(query).sort(sort).skip((page - 1) * limit).limit(limit).lean(), RiderShift.countDocuments(query)]);
  const statusCounts = await RiderShift.aggregate([{ $match: query }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  const summary = { draft: 0, published: 0, cancelled: 0, all: total } as Record<string, number>;
  statusCounts.forEach((r) => { if (r._id && summary[r._id] !== undefined) summary[r._id] = r.count; });

  return { items: items.map((s) => toShiftDto(s as Record<string, unknown>)), total, page, limit, totalPages: Math.ceil(total / limit) || 0, summary };
}

export async function getShiftFilterOptions() {
  const { PickerShift } = await import('../picker/picker.models');
  const pickerHubs = await PickerShift.aggregate([
    { $match: { warehouseKey: { $exists: true, $nin: [null, ''] } } },
    { $group: { _id: '$warehouseKey' } },
    { $sort: { _id: 1 } },
  ]);
  if (pickerHubs.length > 0) {
    return { hubs: pickerHubs.map((r) => ({ hubName: r._id, hubId: r._id })) };
  }
  const hubs = await RiderShift.aggregate([
    { $match: { $or: [{ hubName: { $exists: true, $nin: [null, ''] } }, { hubId: { $exists: true, $nin: [null, ''] } }] } },
    { $group: { _id: { hubName: '$hubName', hubId: '$hubId' } } },
    { $sort: { '_id.hubName': 1 } },
  ]);
  return { hubs: hubs.map((r) => ({ hubName: r._id.hubName || 'Unknown Hub', hubId: r._id.hubId || '' })).filter((h) => h.hubName) };
}

export async function updateShift(id: string, updates: Record<string, unknown>) {
  const { PickerShift } = await import('../picker/picker.models');
  const { mapPickerShiftToAdmin } = await import('./pickerOps.bridge');
  if (id && id.length === 24) {
    const patch: Record<string, unknown> = {};
    if (updates.name != null) patch.name = updates.name;
    if (updates.startTime != null) patch.startTime = updates.startTime;
    if (updates.endTime != null) patch.endTime = updates.endTime;
    if (updates.capacity != null) patch.capacity = Number(updates.capacity);
    if (updates.headcountTarget != null) patch.capacity = Number(updates.headcountTarget);
    if (updates.hubId != null || updates.hubName != null) {
      patch.warehouseKey = updates.hubId || updates.hubName;
    }
    if (updates.status != null) {
      const s = String(updates.status).toLowerCase();
      patch.status = s.includes('cancel') ? 'CANCELLED' : s.includes('draft') ? 'SCHEDULED' : 'SCHEDULED';
    }
    if (updates.startTime || updates.endTime) {
      const st = String(updates.startTime || '');
      const et = String(updates.endTime || '');
      if (st && et) patch.time = `${st} – ${et}`;
    }
    const updated = await PickerShift.findByIdAndUpdate(id, patch, { new: true }).lean();
    if (updated) return mapPickerShiftToAdmin(updated as any, 0);
  }
  const shift = await RiderShift.findOne({ id });
  if (!shift) return null;
  if (updates.startTime || updates.endTime) {
    const st = parseTimeToMinutes((updates.startTime as string) ?? shift.startTime);
    const et = parseTimeToMinutes((updates.endTime as string) ?? shift.endTime);
    if (st == null || et == null || et <= st) throw Object.assign(new Error('Invalid shift time window'), { code: 'INVALID_TIME_WINDOW' });
    shift.durationMinutes = et - st;
  }
  Object.assign(shift, updates);
  return shift.save();
}

export async function deleteShift(id: string) {
  const { PickerShift } = await import('../picker/picker.models');
  const { mapPickerShiftToAdmin } = await import('./pickerOps.bridge');
  if (id && id.length === 24) {
    const updated = await PickerShift.findByIdAndUpdate(id, { status: 'CANCELLED' }, { new: true }).lean();
    if (updated) return mapPickerShiftToAdmin(updated as any, 0);
  }
  const shift = await RiderShift.findOne({ id });
  if (!shift) return null;
  shift.status = 'cancelled';
  return shift.save();
}

export async function getAvailableForRider(riderId: string, date: string) {
  const base = await listShifts({ date, status: 'published' }, { limit: 200 });
  if (!base.items.length) return [];

  const shiftDocs = await RiderShift.find({ id: { $in: base.items.map((s) => s.id) } }).select('_id id').lean() as Array<{ _id: unknown; id: string }>;
  const shiftObjectIds = shiftDocs.map((s) => s._id);
  const [allAssignments, riderAssignments] = await Promise.all([
    RiderShiftAssignment.find({ shiftId: { $in: shiftObjectIds }, status: { $in: ['selected', 'started'] } }),
    RiderShiftAssignment.find({ riderId, shiftId: { $in: shiftObjectIds }, status: { $in: ['selected', 'started', 'completed'] } }).select('shiftId'),
  ]);

  const countsByShiftId = allAssignments.reduce((acc, a) => { const k = String(a.shiftId); acc[k] = (acc[k] || 0) + 1; return acc; }, {} as Record<string, number>);
  const riderBooked = new Set(riderAssignments.map((a) => String(a.shiftId)));

  return base.items.filter((s) => !riderBooked.has(String((shiftDocs.find((d) => d.id === s.id) as { _id: unknown; id: string } | undefined)?._id))).map((s) => toShiftDto(s as Record<string, unknown>, { bookedCount: countsByShiftId[String((shiftDocs.find((d) => d.id === s.id) as { _id: unknown; id: string } | undefined)?._id)] || 0 }));
}

export async function selectShifts(riderId: string, shiftIds: string[]) {
  if (!Array.isArray(shiftIds) || !shiftIds.length) throw Object.assign(new Error('No shifts selected'), { code: 'NO_SHIFTS_SELECTED' });
  const shifts = await RiderShift.find({ id: { $in: shiftIds }, status: 'published' });
  if (!shifts.length) throw Object.assign(new Error('No valid shifts found'), { code: 'NO_VALID_SHIFTS' });

  const byId = new Map(shifts.map((s) => [s.id, s]));
  const date = shifts[0].date;
  const existingAssignments = await RiderShiftAssignment.find({ riderId, date, status: { $in: ['selected', 'started'] } }).populate('shiftId');
  const existingWindows = existingAssignments.map((a) => {
    const s = a.shiftId as unknown as { startTime: string; endTime: string };
    if (!s) return null;
    return { start: parseTimeToMinutes(s.startTime)!, end: parseTimeToMinutes(s.endTime)! };
  }).filter(Boolean) as Array<{ start: number; end: number }>;

  for (const id of shiftIds) {
    const shift = byId.get(id);
    if (!shift) throw Object.assign(new Error(`Shift not found: ${id}`), { code: 'SHIFT_NOT_FOUND' });
    const start = parseTimeToMinutes(shift.startTime)!;
    const end = parseTimeToMinutes(shift.endTime)!;
    if (existingWindows.some((w) => shiftsOverlap(start, end, w.start, w.end))) throw Object.assign(new Error('Shift overlaps with existing selection'), { code: 'SHIFT_OVERLAP' });
    const activeCount = await RiderShiftAssignment.countDocuments({ shiftId: shift._id, status: { $in: ['selected', 'started'] } });
    if (activeCount >= shift.capacity) throw Object.assign(new Error('Shift capacity reached'), { code: 'CAPACITY_REACHED' });
    existingWindows.push({ start, end });
  }

  await RiderShiftAssignment.insertMany(shiftIds.map((id) => { const s = byId.get(id)!; return { shiftId: s._id, riderId, date: s.date, status: 'selected' }; }));

  const bulkOps = shiftIds.map((id) => { const s = byId.get(id)!; return { updateOne: { filter: { _id: s._id }, update: { $inc: { bookedCount: 1 } } } }; });
  if (bulkOps.length) await RiderShift.bulkWrite(bulkOps);
}

export async function cancelShiftSelection(riderId: string, shiftId: string, timestamp: Date = new Date()) {
  const shift = await RiderShift.findOne({ id: shiftId });
  if (!shift) throw Object.assign(new Error('Shift not found'), { code: 'SHIFT_NOT_FOUND' });
  const assignment = await RiderShiftAssignment.findOne({ riderId, shiftId: shift._id, status: 'selected' });
  if (!assignment) throw Object.assign(new Error('Shift not selected'), { code: 'SHIFT_NOT_SELECTED' });

  const shiftStart = new Date(shift.date);
  const [h, m] = shift.startTime.split(':').map(Number);
  shiftStart.setHours(h, m, 0, 0);
  if (timestamp >= shiftStart) throw Object.assign(new Error('Cannot cancel shift after it has started'), { code: 'CANNOT_CANCEL_AFTER_START' });

  assignment.status = 'cancelled';
  assignment.endedAt = timestamp;
  await assignment.save();
  await RiderShift.updateOne({ _id: shift._id }, { $inc: { bookedCount: -1 } });
  await RiderShift.updateOne({ _id: shift._id, bookedCount: { $lt: 0 } }, { $set: { bookedCount: 0 } });
}

export async function startShift(riderId: string, shiftId: string, timestamp: Date = new Date()) {
  const shift = await RiderShift.findOne({ id: shiftId, status: 'published' });
  if (!shift) throw Object.assign(new Error('Shift not found'), { code: 'SHIFT_NOT_FOUND' });
  const assignment = await RiderShiftAssignment.findOne({ riderId, shiftId: shift._id, status: { $in: ['selected', 'started'] } });
  if (!assignment) throw Object.assign(new Error('Shift not selected'), { code: 'SHIFT_NOT_SELECTED' });

  const buf = shift.walkInBufferMinutes ?? 0;
  const shiftStart = new Date(shift.date);
  const [h, m] = shift.startTime.split(':').map(Number);
  shiftStart.setHours(h, m, 0, 0);
  const earliest = new Date(shiftStart.getTime() - buf * 60000);
  const latest = new Date(shiftStart.getTime() + buf * 60000);
  if (timestamp < earliest || timestamp > latest) throw Object.assign(new Error('Cannot start shift outside allowed window'), { code: 'OUTSIDE_START_WINDOW' });

  assignment.status = 'started';
  assignment.startedAt = timestamp;
  await assignment.save();
  return { shiftStartTime: timestamp };
}

export async function endShift(riderId: string, shiftId: string, timestamp: Date = new Date()) {
  const shift = await RiderShift.findOne({ id: shiftId });
  if (!shift) throw Object.assign(new Error('Shift not found'), { code: 'SHIFT_NOT_FOUND' });
  const assignment = await RiderShiftAssignment.findOne({ riderId, shiftId: shift._id, status: 'started' });
  if (!assignment) throw Object.assign(new Error('Shift not started'), { code: 'SHIFT_NOT_STARTED' });
  assignment.status = 'completed';
  assignment.endedAt = timestamp;
  await assignment.save();
}

export async function listRiderShifts(riderId: string, { date, status }: { date?: string; status?: string | string[] } = {}) {
  const query: Record<string, unknown> = { riderId };
  if (date) {
    const day = parseDateOnly(date) ?? new Date(date);
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    query.date = { $gte: start, $lt: end };
  }
  query.status = status ? (Array.isArray(status) ? { $in: status } : status) : { $in: ['selected', 'started', 'completed'] };

  const assignments = await RiderShiftAssignment.find(query).populate('shiftId').sort({ date: 1 });
  const now = new Date();

  return assignments.filter((a) => !!a.shiftId).map((a) => {
    const s = a.shiftId as unknown as Record<string, unknown>;
    const shiftDate = new Date(s.date as Date);
    const startMins = parseTimeToMinutes(s.startTime as string);
    const endMins = parseTimeToMinutes(s.endTime as string);
    let windowStart: Date | null = null, windowEnd: Date | null = null;
    if (!Number.isNaN(shiftDate.getTime()) && startMins != null && endMins != null) {
      windowStart = new Date(shiftDate); windowStart.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
      windowEnd = new Date(shiftDate); windowEnd.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0);
    }
    const temporal = !windowStart ? 'upcoming' : now < windowStart ? 'upcoming' : now <= windowEnd! ? 'ongoing' : 'past';
    const scheduled = (s.durationMinutes as number) || (startMins != null && endMins != null ? endMins - startMins : 0);
    let attended = 0;
    if (a.startedAt) { attended = a.endedAt ? Math.floor((a.endedAt.getTime() - a.startedAt.getTime()) / 60000) : temporal === 'ongoing' ? Math.floor((now.getTime() - a.startedAt.getTime()) / 60000) : 0; }
    else if (temporal === 'ongoing' && windowStart) attended = Math.floor((now.getTime() - windowStart.getTime()) / 60000);
    const attendancePct = scheduled > 0 ? Math.min(100, Math.round((attended / scheduled) * 100)) : 0;
    const completion = temporal === 'upcoming' ? 'upcoming' : temporal === 'ongoing' ? 'ongoing' : !a.startedAt ? 'missed' : a.status === 'completed' && attendancePct >= 90 ? 'completed' : 'missed';
    return toShiftDto(s, { status: a.status, assignmentId: a._id, assignmentStatus: a.status, startedAt: a.startedAt, endedAt: a.endedAt, attendanceMinutes: attended, attendancePercentage: attendancePct, completionStatus: completion });
  });
}

export async function getShiftAssignments(shiftId: string) {
  const shift = await RiderShift.findOne({ id: shiftId }) ?? (String(shiftId).match(/^[a-f0-9]{24}$/i) ? await RiderShift.findById(shiftId) : null);
  if (!shift) throw Object.assign(new Error('Shift not found'), { code: 'SHIFT_NOT_FOUND' });

  const assignments = await RiderShiftAssignment.find({ shiftId: shift._id }).sort({ createdAt: -1 }).lean() as Array<{ riderId: string; status: string; date: Date; startedAt?: Date; endedAt?: Date; createdAt?: Date; _id: unknown }>;
  const riderIds = [...new Set(assignments.map((a) => a.riderId))];
  const riders = await RiderHR.find({ id: { $in: riderIds } }).select('id name phone email status').lean() as Array<{ id: string; name?: string; phone?: string; status?: string }>;
  const riderMap = new Map(riders.map((r) => [r.id, r]));

  return {
    shift: toShiftDto(shift.toObject() as Record<string, unknown>),
    assignments: assignments.map((a) => ({ id: String(a._id), riderId: a.riderId, riderName: riderMap.get(a.riderId)?.name || a.riderId, riderPhone: riderMap.get(a.riderId)?.phone || null, riderStatus: riderMap.get(a.riderId)?.status || null, status: a.status, date: formatDateOnly(a.date), startedAt: a.startedAt?.toISOString() || null, endedAt: a.endedAt?.toISOString() || null, createdAt: a.createdAt?.toISOString() || null })),
    summary: { total: assignments.length, selected: assignments.filter((a) => a.status === 'selected').length, started: assignments.filter((a) => a.status === 'started').length, completed: assignments.filter((a) => a.status === 'completed').length, cancelled: assignments.filter((a) => a.status === 'cancelled').length, capacity: shift.capacity, available: Math.max(0, shift.capacity - (shift.bookedCount ?? 0)) },
  };
}

export async function adminAssignRider(shiftId: string, riderId: string) {
  if (!riderId) throw Object.assign(new Error('Missing riderId'), { code: 'MISSING_RIDER_ID' });
  await selectShifts(riderId, [shiftId]);
  return getShiftAssignments(shiftId);
}

export async function adminUnassignRider(shiftId: string, riderId: string) {
  await cancelShiftSelection(riderId, shiftId);
  return getShiftAssignments(shiftId);
}
