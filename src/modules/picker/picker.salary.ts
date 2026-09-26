/**
 * Picker monthly salary / week-off / leave / OT calculation.
 *
 * Single source for payroll math. Config defaults live in `picker.config.ts`
 * (env) and may be overridden via AdminPickerConfig.
 */

import { AdminPickerConfig, ADMIN_PICKER_CONFIG_KEY } from '../admin/admin-picker-config.model';
import { pickerConfig } from './picker.config';
import { hubDateKey, hubMonthBounds } from './picker.format';

export type SalaryConfig = {
  monthlySalary: number;
  /** Full scheduled shift including break + handovers (minutes). Default 600 = 10h. */
  standardShiftMinutes: number;
  productiveWorkMinutes: number;
  breakMinutes: number;
  startHandoverMinutes: number;
  endHandoverMinutes: number;
  overtimeMultiplier: number;
  weekOffAllowance: number;
  /** 0 = Sunday … 6 = Saturday */
  weekOffWeekday: number;
  /**
   * How daily salary is derived from monthly:
   * - calendar_minus_weekoffs → daysInMonth − weekOffAllowance
   * - fixed → monthlyWorkingDaysFixed
   */
  monthlyWorkingDaysMode: 'calendar_minus_weekoffs' | 'fixed';
  monthlyWorkingDaysFixed: number;
};

const CACHE_TTL_MS = 60_000;
let cache: { at: number; cfg: SalaryConfig } | null = null;

export function invalidateSalaryConfigCache(): void {
  cache = null;
}

function envSalaryDefaults(): SalaryConfig {
  return {
    monthlySalary: pickerConfig.monthlySalary,
    standardShiftMinutes: pickerConfig.standardShiftMinutes,
    productiveWorkMinutes: pickerConfig.productiveWorkMinutes,
    breakMinutes: pickerConfig.breakMinutes,
    startHandoverMinutes: pickerConfig.startHandoverMinutes,
    endHandoverMinutes: pickerConfig.endHandoverMinutes,
    overtimeMultiplier: pickerConfig.overtimeMultiplier,
    weekOffAllowance: pickerConfig.weekOffAllowance,
    weekOffWeekday: pickerConfig.weekOffWeekday,
    monthlyWorkingDaysMode: pickerConfig.monthlyWorkingDaysMode,
    monthlyWorkingDaysFixed: pickerConfig.monthlyWorkingDaysFixed,
  };
}

function numOr(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Merge env defaults with optional admin Mongo overrides. */
export function mergeSalaryConfig(doc?: Record<string, unknown> | null): SalaryConfig {
  const base = envSalaryDefaults();
  if (!doc) return base;
  const modeRaw = doc.monthlyWorkingDaysMode;
  const mode =
    modeRaw === 'fixed' || modeRaw === 'calendar_minus_weekoffs'
      ? modeRaw
      : base.monthlyWorkingDaysMode;
  return {
    monthlySalary: numOr(doc.monthlySalary, base.monthlySalary),
    standardShiftMinutes: numOr(doc.standardShiftMinutes, base.standardShiftMinutes),
    productiveWorkMinutes: numOr(doc.productiveWorkMinutes, base.productiveWorkMinutes),
    breakMinutes: numOr(doc.breakMinutes, base.breakMinutes),
    startHandoverMinutes: numOr(doc.startHandoverMinutes, base.startHandoverMinutes),
    endHandoverMinutes: numOr(doc.endHandoverMinutes, base.endHandoverMinutes),
    overtimeMultiplier: numOr(doc.overtimeMultiplier, base.overtimeMultiplier),
    weekOffAllowance: numOr(doc.weekOffAllowance, base.weekOffAllowance),
    weekOffWeekday: Math.min(6, Math.max(0, Math.trunc(numOr(doc.weekOffWeekday, base.weekOffWeekday)))),
    monthlyWorkingDaysMode: mode,
    monthlyWorkingDaysFixed: numOr(doc.monthlyWorkingDaysFixed, base.monthlyWorkingDaysFixed),
  };
}

export async function resolveSalaryConfig(): Promise<SalaryConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.cfg;
  try {
    const doc = await AdminPickerConfig.findOne({ key: ADMIN_PICKER_CONFIG_KEY }).lean();
    const cfg = mergeSalaryConfig(doc as Record<string, unknown> | null);
    cache = { at: Date.now(), cfg };
    return cfg;
  } catch {
    const cfg = envSalaryDefaults();
    cache = { at: Date.now(), cfg };
    return cfg;
  }
}

/** Round to whole rupees (matches existing wallet crediting). */
export function roundRupees(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount);
}

/** Two-decimal money for rates (hourly / daily display). */
export function roundRate(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100) / 100;
}

export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

export function monthlyWorkingDays(cfg: SalaryConfig, year: number, monthIndex0: number): number {
  if (cfg.monthlyWorkingDaysMode === 'fixed') {
    return Math.max(1, Math.trunc(cfg.monthlyWorkingDaysFixed));
  }
  const dim = daysInMonth(year, monthIndex0);
  return Math.max(1, dim - Math.max(0, Math.trunc(cfg.weekOffAllowance)));
}

export function dailySalary(cfg: SalaryConfig, year: number, monthIndex0: number): number {
  return roundRate(cfg.monthlySalary / monthlyWorkingDays(cfg, year, monthIndex0));
}

export function normalHourlyRate(cfg: SalaryConfig, daily: number): number {
  const hours = Math.max(1, cfg.standardShiftMinutes / 60);
  return roundRate(daily / hours);
}

export function otHourlyRate(cfg: SalaryConfig, daily: number): number {
  return roundRate(normalHourlyRate(cfg, daily) * cfg.overtimeMultiplier);
}

export function otAmountFromMinutes(cfg: SalaryConfig, daily: number, otMinutes: number): number {
  const mins = Math.max(0, otMinutes);
  if (mins <= 0) return 0;
  return roundRupees((mins / 60) * otHourlyRate(cfg, daily));
}

export type ShiftAttendanceBreakdown = {
  shiftStartTime: Date;
  actualWorkStartTime: Date;
  actualWorkEndTime: Date | null;
  shiftEndTime: Date | null;
  startHandoverMinutes: number;
  endHandoverMinutes: number;
  breakMinutes: number;
  totalShiftMinutes: number;
  productiveWorkMinutes: number;
  overtimeMinutes: number;
  isWeekOffWork: boolean;
};

/**
 * Build attendance timing fields from punch in/out + configured shift structure.
 * OT is based on total on-site duration vs standard shift (10h), NOT net-of-break.
 */
export function computeShiftBreakdown(input: {
  punchIn: Date;
  punchOut?: Date | null;
  breaks?: Array<{ startTime: Date; endTime?: Date | null }>;
  cfg: SalaryConfig;
  isWeekOffDay?: boolean;
}): ShiftAttendanceBreakdown {
  const { punchIn, punchOut, cfg } = input;
  const startHandover = Math.max(0, cfg.startHandoverMinutes);
  const endHandover = Math.max(0, cfg.endHandoverMinutes);

  let breakMinutes = 0;
  for (const b of input.breaks || []) {
    if (!b?.startTime || !b.endTime) continue;
    const mins = Math.floor((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000);
    if (mins > 0) breakMinutes += mins;
  }
  // Do not invent a break from config — only logged breaks reduce productive time.
  // OT still uses wall-clock vs standardShiftMinutes, so the 1h paid break is not treated as OT.

  const end = punchOut ? new Date(punchOut) : null;
  const totalShiftMinutes = end
    ? Math.max(0, Math.floor((end.getTime() - punchIn.getTime()) / 60000))
    : 0;

  const actualWorkStartTime = new Date(punchIn.getTime() + startHandover * 60000);
  const actualWorkEndTime = end
    ? new Date(end.getTime() - endHandover * 60000)
    : null;

  const productiveWorkMinutes = end
    ? Math.max(0, totalShiftMinutes - breakMinutes - startHandover - endHandover)
    : 0;

  // Week-off work: entire on-site duration is OT-eligible at OT rate (separate line).
  // Normal day: OT only beyond the standard 10h scheduled shift.
  let overtimeMinutes = 0;
  if (end) {
    if (input.isWeekOffDay) {
      overtimeMinutes = totalShiftMinutes;
    } else {
      overtimeMinutes = Math.max(0, totalShiftMinutes - cfg.standardShiftMinutes);
    }
  }

  return {
    shiftStartTime: punchIn,
    actualWorkStartTime,
    actualWorkEndTime,
    shiftEndTime: end,
    startHandoverMinutes: startHandover,
    endHandoverMinutes: endHandover,
    breakMinutes,
    totalShiftMinutes,
    productiveWorkMinutes,
    overtimeMinutes,
    isWeekOffWork: Boolean(input.isWeekOffDay && end && totalShiftMinutes > 0),
  };
}

/** Hub-local weekday (0=Sun) for a Date. */
export function hubWeekday(date: Date): number {
  const shifted = new Date(date.getTime() + 330 * 60000);
  return shifted.getUTCDay();
}

/** All week-off calendar dates (YYYY-MM-DD) in a hub month. */
export function weekOffDateKeysInMonth(
  year: number,
  monthIndex0: number,
  weekOffWeekday: number,
): string[] {
  const dim = daysInMonth(year, monthIndex0);
  const keys: string[] = [];
  for (let d = 1; d <= dim; d++) {
    const utcMidnight = Date.UTC(year, monthIndex0, d);
    const hubInstant = new Date(utcMidnight - 330 * 60000);
    if (hubWeekday(hubInstant) === weekOffWeekday) {
      keys.push(hubDateKey(hubInstant));
    }
  }
  return keys;
}

export type MonthlyPayrollInput = {
  cfg: SalaryConfig;
  year: number;
  monthIndex0: number;
  /** Attendance records for the month (lean docs). */
  records: Array<{
    punchIn: Date | string;
    punchOut?: Date | string | null;
    status?: string;
    overtimeMinutes?: number;
    totalShiftMinutes?: number;
    isWeekOffWork?: boolean;
  }>;
  /** Optional join date — days before this are ignored. */
  joiningDate?: Date | null;
  /** As-of date for leave (defaults to now). Future days are not unpaid leave. */
  asOf?: Date;
};

export type MonthlyPayrollResult = {
  monthlySalary: number;
  dailySalary: number;
  normalHourlyRate: number;
  otHourlyRate: number;
  calendarDays: number;
  monthlyWorkingDays: number;
  workingDays: number;
  weekOffsScheduled: number;
  weekOffsPaid: number;
  weekOffsWorked: number;
  presentDays: number;
  halfDays: number;
  unpaidLeaveDays: number;
  leaveDeduction: number;
  otMinutes: number;
  otHours: number;
  otEarnings: number;
  weekOffWorkMinutes: number;
  weekOffWorkEarnings: number;
  paidDays: number;
  finalSalary: number;
  weekOffDates: string[];
  paidWeekOffDates: string[];
};

function isPresentStatus(status?: string, hasPunch?: boolean): boolean {
  if (hasPunch) return true;
  return ['present', 'COMPLETED', 'ON_DUTY', 'ON_BREAK', 'half-day'].includes(String(status || ''));
}

export function computeMonthlyPayroll(input: MonthlyPayrollInput): MonthlyPayrollResult {
  const { cfg, year, monthIndex0 } = input;
  const asOf = input.asOf || new Date();
  const { from, to } = hubMonthBounds(new Date(Date.UTC(year, monthIndex0, 15) - 330 * 60000));
  const calendarDays = daysInMonth(year, monthIndex0);
  const workingDayCount = monthlyWorkingDays(cfg, year, monthIndex0);
  const daily = dailySalary(cfg, year, monthIndex0);
  const normalHr = normalHourlyRate(cfg, daily);
  const otHr = otHourlyRate(cfg, daily);

  const allWeekOffs = weekOffDateKeysInMonth(year, monthIndex0, cfg.weekOffWeekday);
  const paidWeekOffDates = allWeekOffs.slice(0, Math.max(0, cfg.weekOffAllowance));
  const paidWeekOffSet = new Set(paidWeekOffDates);
  const weekOffSet = new Set(allWeekOffs);

  const byDay = new Map<string, (typeof input.records)[0]>();
  for (const r of input.records) {
    const key = hubDateKey(new Date(r.punchIn));
    const prev = byDay.get(key);
    if (!prev) byDay.set(key, r);
    else {
      // Keep the record with more overtime / longer presence
      const prevOt = prev.overtimeMinutes || 0;
      const nextOt = r.overtimeMinutes || 0;
      if (nextOt >= prevOt) byDay.set(key, r);
    }
  }

  let joinKey: string | null = null;
  if (input.joiningDate) {
    joinKey = hubDateKey(input.joiningDate);
  }

  const asOfKey = hubDateKey(asOf);
  const monthEndKey = hubDateKey(to);
  const lastCountableKey = asOfKey < monthEndKey ? asOfKey : monthEndKey;
  /** Fixed monthly salary (₹13,000 default): do not treat missing punches as unpaid leave until the month has closed. */
  const monthClosed = asOfKey >= monthEndKey;

  let presentDays = 0;
  let halfDays = 0;
  let weekOffsWorked = 0;
  let otMinutes = 0;
  let weekOffWorkMinutes = 0;
  let unpaidLeaveDays = 0;

  for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
    const day = new Date(t);
    const key = hubDateKey(day);
    if (joinKey && key < joinKey) continue;
    if (key > lastCountableKey) continue;

    const rec = byDay.get(key);
    const present = rec && isPresentStatus(rec.status, Boolean(rec.punchIn));
    const isWeekOff = weekOffSet.has(key);
    const isPaidWeekOff = paidWeekOffSet.has(key);

    if (present) {
      presentDays += 1;
      if (rec?.status === 'half-day') halfDays += 1;
      const ot = Math.max(0, rec?.overtimeMinutes || 0);
      if (isWeekOff || rec?.isWeekOffWork) {
        weekOffsWorked += 1;
        weekOffWorkMinutes += ot > 0 ? ot : Math.max(0, rec?.totalShiftMinutes || 0);
      } else {
        otMinutes += ot;
      }
      continue;
    }

    // In-progress month: keep fixed monthly salary — no leave deduction for days not yet worked.
    if (!monthClosed) continue;

    // Month closed: paid week-off is non-deductible; other absences are unpaid leave
    if (isPaidWeekOff) continue;
    if (isWeekOff && !isPaidWeekOff) {
      // Extra week-off weekday beyond allowance (e.g. 5th Sunday) → unpaid if not worked
      unpaidLeaveDays += 1;
      continue;
    }
    unpaidLeaveDays += 1;
  }

  const leaveDeduction = roundRupees(unpaidLeaveDays * daily);
  const otEarnings = otAmountFromMinutes(cfg, daily, otMinutes);
  const weekOffWorkEarnings = otAmountFromMinutes(cfg, daily, weekOffWorkMinutes);
  const paidDays = Math.max(0, workingDayCount - unpaidLeaveDays);
  const finalSalary = roundRupees(
    Math.max(0, cfg.monthlySalary - leaveDeduction + otEarnings + weekOffWorkEarnings),
  );

  return {
    monthlySalary: cfg.monthlySalary,
    dailySalary: daily,
    normalHourlyRate: normalHr,
    otHourlyRate: otHr,
    calendarDays,
    monthlyWorkingDays: workingDayCount,
    workingDays: presentDays,
    weekOffsScheduled: allWeekOffs.length,
    weekOffsPaid: paidWeekOffDates.length,
    weekOffsWorked,
    presentDays,
    halfDays,
    unpaidLeaveDays,
    leaveDeduction,
    otMinutes,
    otHours: roundRate(otMinutes / 60),
    otEarnings,
    weekOffWorkMinutes,
    weekOffWorkEarnings,
    paidDays,
    finalSalary,
    weekOffDates: allWeekOffs,
    paidWeekOffDates,
  };
}

export function isWeekOffDateKey(dateKey: string, cfg: SalaryConfig, year: number, monthIndex0: number): boolean {
  return weekOffDateKeysInMonth(year, monthIndex0, cfg.weekOffWeekday).includes(dateKey);
}

export function hubYearMonth(date: Date = new Date()): { year: number; monthIndex0: number } {
  const shifted = new Date(date.getTime() + 330 * 60000);
  return { year: shifted.getUTCFullYear(), monthIndex0: shifted.getUTCMonth() };
}
