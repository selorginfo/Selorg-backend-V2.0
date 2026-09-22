import { Shift } from './shift.model';

export interface RiderShiftDto {
  id: string;
  riderId: string;
  riderName: string;
  date: string | null;
  startTime: string;
  endTime: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  hub: string;
  isPeakHour: boolean;
  overtimeMinutes: number;
}

export function dayBounds(dateStr: string): { startOfDay: Date; endOfDay: Date } {
  const parts = String(dateStr).split('-').map(Number);
  const y = parts[0] || new Date().getFullYear();
  const m = (parts[1] || 1) - 1;
  const d = parts[2] || 1;
  return {
    startOfDay: new Date(y, m, d, 0, 0, 0, 0),
    endOfDay: new Date(y, m, d, 23, 59, 59, 999),
  };
}

export function toRiderShift(s: any): RiderShiftDto {
  return {
    id: s.id,
    riderId: s.staffId,
    riderName: s.staffName,
    date: s.date ? (typeof s.date === 'string' ? s.date : new Date(s.date).toISOString().split('T')[0]) : null,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    checkInTime: s.checkInTime || undefined,
    checkOutTime: s.checkOutTime || undefined,
    hub: s.hub,
    isPeakHour: !!s.isPeakHour,
    overtimeMinutes: s.overtimeMinutes || 0,
  };
}

export async function getSummaryForDate(dateStr: string) {
  const { startOfDay, endOfDay } = dayBounds(dateStr);
  const shifts = await Shift.find({ date: { $gte: startOfDay, $lte: endOfDay } }).lean();
  return {
    date: dateStr,
    checkedInCount: shifts.filter((s) => s.status === 'active' || s.status === 'completed').length,
    scheduledTodayCount: shifts.length,
    absentOrLateCount: shifts.filter((s) => s.status === 'absent' || s.status === 'late').length,
  };
}

export async function listShiftsForDate(dateStr: string, filter: string) {
  const { startOfDay, endOfDay } = dayBounds(dateStr);
  const query: Record<string, any> = { date: { $gte: startOfDay, $lte: endOfDay } };
  if (filter === 'checked-in') query.status = { $in: ['active', 'completed'] };
  else if (filter === 'absent') query.status = { $in: ['absent', 'late'] };
  const shifts = await Shift.find(query).sort({ startTime: 1 }).lean();
  return shifts.map(toRiderShift);
}

export async function getShift(shiftId: string) {
  return Shift.findOne({ id: shiftId }).lean();
}

export async function createShift(body: any, riderName: string) {
  const count = await Shift.countDocuments();
  const id = body.id || `S-${Date.now()}-${(count + 1).toString().padStart(3, '0')}`;
  const shift = await Shift.create({
    id,
    staffId: body.riderId || body.staffId,
    staffName: riderName,
    date: new Date(body.date),
    startTime: body.startTime,
    endTime: body.endTime,
    status: body.status || 'scheduled',
    hub: body.hub,
    isPeakHour: !!body.isPeakHour,
    overtimeMinutes: 0,
  });
  return toRiderShift(shift.toObject());
}

export async function updateShift(shiftId: string, body: any) {
  const shift = await Shift.findOne({ id: shiftId });
  if (!shift) return null;
  const allowed = ['status', 'checkInTime', 'checkOutTime', 'overtimeMinutes', 'startTime', 'endTime', 'hub', 'isPeakHour'];
  for (const key of allowed) {
    if (body[key] !== undefined) (shift as any)[key] = body[key];
  }
  await shift.save();
  return toRiderShift(shift.toObject());
}

export async function listRidersForDate(dateStr: string) {
  const { startOfDay, endOfDay } = dayBounds(dateStr);
  const shifts = await Shift.find({ date: { $gte: startOfDay, $lte: endOfDay } }).lean();
  const hoursByRider: Record<string, number> = {};
  for (const s of shifts) {
    const rid = s.staffId;
    if (!hoursByRider[rid]) hoursByRider[rid] = 0;
    const start = s.startTime ? s.startTime.split(':').map(Number) : [0, 0];
    const end = s.endTime ? s.endTime.split(':').map(Number) : [0, 0];
    hoursByRider[rid] += (end[0] - start[0]) + (end[1] - start[1]) / 60;
  }
  // Return unique riders who have shifts
  const riderIds = [...new Set(shifts.map((s) => s.staffId))];
  return riderIds.map((rid) => {
    const s = shifts.find((x) => x.staffId === rid)!;
    return {
      id: rid,
      name: s.staffName,
      hub: s.hub || 'Default Hub',
      existingHours: Math.round((hoursByRider[rid] || 0) * 10) / 10,
    };
  });
}
