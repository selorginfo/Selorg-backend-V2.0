/**
 * Standalone formula checks for picker salary / OT / leave.
 * Run: npx ts-node --transpile-only src/modules/picker/picker.salary.selftest.ts
 * (from Selorg-backend-V2.0)
 */
import {
  mergeSalaryConfig,
  dailySalary,
  normalHourlyRate,
  otHourlyRate,
  otAmountFromMinutes,
  computeShiftBreakdown,
  computeMonthlyPayroll,
  weekOffDateKeysInMonth,
  daysInMonth,
} from './picker.salary';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK  ${msg}`);
}

const cfg = mergeSalaryConfig(null);
// Force known defaults for the test (env may override)
const testCfg = {
  ...cfg,
  monthlySalary: 13000,
  standardShiftMinutes: 600,
  productiveWorkMinutes: 480,
  breakMinutes: 60,
  startHandoverMinutes: 30,
  endHandoverMinutes: 30,
  overtimeMultiplier: 1.5,
  weekOffAllowance: 4,
  weekOffWeekday: 0,
  monthlyWorkingDaysMode: 'calendar_minus_weekoffs' as const,
  monthlyWorkingDaysFixed: 26,
};

// Sep 2026 has 30 days → working days = 26
const year = 2026;
const month = 8; // September
const dim = daysInMonth(year, month);
const daily = dailySalary(testCfg, year, month);
const expectedDaily = Math.round((13000 / (dim - 4)) * 100) / 100;
assert(daily === expectedDaily, `Case daily salary: ${daily} === ${expectedDaily}`);

const nHr = normalHourlyRate(testCfg, daily);
const otHr = otHourlyRate(testCfg, daily);
assert(Math.abs(nHr - daily / 10) < 0.011, `Normal hourly ≈ daily/10 (${nHr})`);
assert(Math.abs(otHr - nHr * 1.5) < 0.011, `OT hourly ≈ normal×1.5 (${otHr})`);

const punchIn = new Date('2026-09-01T03:30:00.000Z'); // 09:00 IST

function punchOutAfter(hours: number) {
  return new Date(punchIn.getTime() + hours * 3600000);
}

// Case 1 — Normal 10h → 0 OT
{
  const b = computeShiftBreakdown({
    punchIn,
    punchOut: punchOutAfter(10),
    breaks: [{ startTime: new Date(punchIn.getTime() + 4 * 3600000), endTime: new Date(punchIn.getTime() + 5 * 3600000) }],
    cfg: testCfg,
  });
  assert(b.totalShiftMinutes === 600, 'Case1 totalShift 600');
  assert(b.overtimeMinutes === 0, 'Case1 OT 0');
  assert(b.breakMinutes === 60, 'Case1 break 60');
  assert(b.startHandoverMinutes === 30 && b.endHandoverMinutes === 30, 'Case1 handovers');
  assert(otAmountFromMinutes(testCfg, daily, b.overtimeMinutes) === 0, 'Case1 OT pay 0');
}

// Case 2 — 10h30 → 30m OT
{
  const b = computeShiftBreakdown({ punchIn, punchOut: punchOutAfter(10.5), cfg: testCfg });
  assert(b.overtimeMinutes === 30, 'Case2 OT 30m');
  const pay = otAmountFromMinutes(testCfg, daily, 30);
  const expected = Math.round(0.5 * otHr);
  assert(pay === expected, `Case2 OT pay ${pay} === ${expected}`);
}

// Case 3 — 11h → 1h OT
{
  const b = computeShiftBreakdown({ punchIn, punchOut: punchOutAfter(11), cfg: testCfg });
  assert(b.overtimeMinutes === 60, 'Case3 OT 60m');
  assert(otAmountFromMinutes(testCfg, daily, 60) === Math.round(otHr), 'Case3 OT pay 1× rate');
}

// Case 4 — 12h → 2h OT
{
  const b = computeShiftBreakdown({ punchIn, punchOut: punchOutAfter(12), cfg: testCfg });
  assert(b.overtimeMinutes === 120, 'Case4 OT 120m');
  assert(otAmountFromMinutes(testCfg, daily, 120) === Math.round(2 * otHr), 'Case4 OT pay 2× rate');
}

// Case 5 — Normal 4 week-offs, full attendance on working days → ₹0 leave
{
  const weekOffs = weekOffDateKeysInMonth(year, month, 0);
  assert(weekOffs.length >= 4, `Sep has ≥4 Sundays (${weekOffs.length})`);
  const records: Array<{ punchIn: Date; status: string; overtimeMinutes: number }> = [];
  for (let d = 1; d <= dim; d++) {
    const key = `2026-09-${String(d).padStart(2, '0')}`;
    if (weekOffs.includes(key)) continue;
    records.push({
      punchIn: new Date(Date.UTC(2026, 8, d) - 330 * 60000 + 9 * 3600000),
      status: 'present',
      overtimeMinutes: 0,
    });
  }
  const payroll = computeMonthlyPayroll({
    cfg: testCfg,
    year,
    monthIndex0: month,
    records,
    asOf: new Date(Date.UTC(2026, 8, 30) - 330 * 60000 + 12 * 3600000),
  });
  assert(payroll.weekOffsPaid === 4, `Case5 weekOffsPaid 4 (got ${payroll.weekOffsPaid})`);
  assert(payroll.unpaidLeaveDays === 0, `Case5 unpaid 0 (got ${payroll.unpaidLeaveDays})`);
  assert(payroll.leaveDeduction === 0, 'Case5 leave ₹0');
  assert(payroll.finalSalary === 13000, `Case5 final 13000 (got ${payroll.finalSalary})`);
}

// Case 6 — one extra unpaid leave weekday
{
  const weekOffs = new Set(weekOffDateKeysInMonth(year, month, 0));
  const records: Array<{ punchIn: Date; status: string; overtimeMinutes: number }> = [];
  let skippedOne = false;
  for (let d = 1; d <= dim; d++) {
    const key = `2026-09-${String(d).padStart(2, '0')}`;
    if (weekOffs.has(key)) continue;
    if (!skippedOne) {
      skippedOne = true;
      continue; // one unpaid leave
    }
    records.push({
      punchIn: new Date(Date.UTC(2026, 8, d) - 330 * 60000 + 9 * 3600000),
      status: 'present',
      overtimeMinutes: 0,
    });
  }
  const payroll = computeMonthlyPayroll({
    cfg: testCfg,
    year,
    monthIndex0: month,
    records,
    asOf: new Date(Date.UTC(2026, 8, 30) - 330 * 60000 + 12 * 3600000),
  });
  assert(payroll.unpaidLeaveDays === 1, `Case6 unpaid 1 (got ${payroll.unpaidLeaveDays})`);
  assert(payroll.leaveDeduction === Math.round(daily), `Case6 deduction ${payroll.leaveDeduction}`);
  assert(payroll.finalSalary === Math.round(13000 - daily), `Case6 final ${payroll.finalSalary}`);
}

// Case 7 — work on week-off: not treated as unpaid leave; hours at OT rate
{
  const weekOffs = weekOffDateKeysInMonth(year, month, 0);
  const firstSunday = weekOffs[0];
  const [y, m, d] = firstSunday.split('-').map(Number);
  const sundayPunch = new Date(Date.UTC(y, m - 1, d) - 330 * 60000 + 3.5 * 3600000);
  const b = computeShiftBreakdown({
    punchIn: sundayPunch,
    punchOut: new Date(sundayPunch.getTime() + 10 * 3600000),
    cfg: testCfg,
    isWeekOffDay: true,
  });
  assert(b.isWeekOffWork === true, 'Case7 week-off work flag');
  assert(b.overtimeMinutes === 600, 'Case7 full shift counted as OT minutes');
  const payroll = computeMonthlyPayroll({
    cfg: testCfg,
    year,
    monthIndex0: month,
    records: [{
      punchIn: sundayPunch,
      status: 'present',
      overtimeMinutes: b.overtimeMinutes,
      totalShiftMinutes: b.totalShiftMinutes,
      isWeekOffWork: true,
    }],
    asOf: sundayPunch,
  });
  assert(payroll.weekOffsWorked === 1, 'Case7 weekOffsWorked 1');
  // The Sunday worked must not appear as unpaid leave (weekdays before it may still be unpaid in this partial month fixture).
  assert(payroll.weekOffWorkEarnings > 0, 'Case7 week-off earnings > 0');
  assert(payroll.otEarnings === 0, 'Case7 normal OT line stays 0 (hours booked under week-off work)');
}

console.log('\nAll salary self-tests passed.');
