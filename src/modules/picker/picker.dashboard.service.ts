import mongoose from 'mongoose';
import { Order } from '../orders/order.model';
import {
  PickerUser, PickerShiftAssignment, PickerAttendance, PickerTransaction,
} from './picker.models';
import { PickerBulkBatch, PickerIncentiveRule, PickerCashLedger } from './picker.rider.models';
import { AppError } from '../../utils/AppError';
import { pickerConfig } from './picker.config';
import {
  rupees, hoursDisplay, hubDateKey, hubDayStart, hubDayEnd, parseHubDate,
  hubWeekBounds, hubMonthBounds, weekdayShort, dateDisplay, relativeFutureDisplay,
  timeRangeDisplay,
} from './picker.format';
import { getCashInHand } from './picker.cash.service';
import { getActiveAssignment } from './picker.shift.service';
import { getWallet } from './picker.service';

/**
 * Dashboard, incentives, earnings and wallet reads (APIs 24, 25, 41–43).
 */

function periodBounds(period: 'week' | 'month' | 'custom', dateFrom?: string, dateTo?: string): { from: Date; to: Date } {
  if (period === 'custom') {
    const from = parseHubDate(dateFrom);
    const to = parseHubDate(dateTo);
    if (!from || !to) throw AppError.validation('dateFrom and dateTo are required when period is "custom"');
    return { from, to: hubDayEnd(to) };
  }
  if (period === 'month') {
    const bounds = hubMonthBounds();
    return { from: bounds.from, to: hubDayEnd(bounds.to) };
  }
  const bounds = hubWeekBounds();
  return { from: bounds.from, to: hubDayEnd(bounds.to) };
}

async function onlineHoursInRange(pickerId: string, from: Date, to: Date, extraLiveMinutes = 0): Promise<number> {
  const [result] = await PickerAttendance.aggregate<{ minutes: number }>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(pickerId),
        punchIn: { $gte: from, $lte: to },
      },
    },
    { $group: { _id: null, minutes: { $sum: '$totalWorkedMinutes' } } },
  ]);
  const minutes = (result?.minutes || 0) + extraLiveMinutes;
  return Math.round((minutes / 60) * 10) / 10;
}

async function liveOnlineMinutes(user: { isOnline?: boolean; onlineSince?: Date } | null, dayStart: Date): Promise<number> {
  if (!user?.isOnline || !user.onlineSince) return 0;
  const since = new Date(user.onlineSince);
  const start = since > dayStart ? since : dayStart;
  return Math.max(0, Math.round((Date.now() - start.getTime()) / 60000));
}

async function countAvailableOrders(pickerId: string): Promise<number> {
  const user = (await PickerUser.findById(pickerId).select('isOnline currentLocationId deliveryMode').lean()) as any;
  if (!user?.isOnline) return 0;
  const { normalizeRiderHubKey } = await import('./picker.hub');
  const { DEFAULT_HUB_KEY } = await import('../orders/fulfillment.service');
  const riderHubKey = await normalizeRiderHubKey(pickerId, user.currentLocationId);
  const hubClause: Record<string, unknown>[] = [{ offerHubKey: riderHubKey }];
  if (riderHubKey === DEFAULT_HUB_KEY) {
    hubClause.push({ offerHubKey: null }, { offerHubKey: { $exists: false } });
  }
  return Order.countDocuments({
    pickerId: null,
    riderStage: 'offered',
    status: { $in: ['confirmed', 'getting-packed'] },
    deliveryType: user.deliveryMode === 'bulk' ? 'bulk' : 'standard',
    $or: hubClause,
  });
}

// ─── API 24 ───────────────────────────────────────────────────────────────────

export async function getTodayDashboard(pickerId: string, date?: string) {
  const day = parseHubDate(date) || new Date();
  const from = hubDayStart(day);
  const to = hubDayEnd(day);
  const userId = new mongoose.Types.ObjectId(pickerId);
  const user = (await PickerUser.findById(pickerId).select('isOnline onlineSince activeOrderId activeBatchId').lean()) as any;
  if (!user) throw AppError.notFound('Picker');

  const liveMinutes = await liveOnlineMinutes(user, from);

  const [codAgg, delivered, hours, slotsCompleted, availableOrdersCount, activeOrder, activeBatch, assignment] = await Promise.all([
    PickerCashLedger.aggregate<{ total: number }>([
      { $match: { pickerId: userId, type: 'cod_collected', createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Order.aggregate<{ count: number; earnings: number }>([
      { $match: { pickerId: userId, riderStage: 'delivered', deliveredAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, count: { $sum: 1 }, earnings: { $sum: '$riderPayout' } } },
    ]),
    onlineHoursInRange(pickerId, from, to, liveMinutes),
    PickerShiftAssignment.countDocuments({ userId, status: 'COMPLETED', completedAt: { $gte: from, $lte: to } }),
    countAvailableOrders(pickerId),
    Order.findOne({ pickerId: userId, riderStage: { $in: ['accepted', 'picked_up'] } }).select('_id').lean(),
    PickerBulkBatch.findOne({ pickerId: userId, status: { $in: ['assigned', 'loading', 'ready', 'dispatched', 'in_transit'] } })
      .select('batchId').lean(),
    getActiveAssignment(pickerId),
  ]);

  const shift = assignment ? (assignment as any).shiftId : null;
  return {
    date: hubDateKey(day),
    codCollected: Math.round(codAgg[0]?.total || 0),
    ordersDelivered: delivered[0]?.count || 0,
    onlineHours: hours,
    slotsCompleted,
    earnings: Math.round(delivered[0]?.earnings || 0),
    availableOrdersCount,
    activeOrderId: activeOrder ? String((activeOrder as any)._id) : user.activeOrderId || null,
    activeBatchId: (activeBatch as any)?.batchId || user.activeBatchId || null,
    isOnline: Boolean(user.isOnline),
    activeShift: shift ? { timeDisplay: timeRangeDisplay(shift.startTime, shift.endTime, shift.time) } : null,
  };
}

// ─── API 25 ───────────────────────────────────────────────────────────────────

export async function getTodayIncentive(pickerId: string, date?: string) {
  const day = parseHubDate(date) || new Date();
  const from = hubDayStart(day);
  const to = hubDayEnd(day);
  const userId = new mongoose.Types.ObjectId(pickerId);
  const user = (await PickerUser.findById(pickerId).select('currentLocationId deliveryMode').lean()) as any;

  const rule = await PickerIncentiveRule.findOne({
    isActive: true,
    $and: [
      { $or: [{ hubKey: null }, { hubKey: user?.currentLocationId || null }] },
      { $or: [{ deliveryMode: null }, { deliveryMode: user?.deliveryMode || 'standard' }] },
      { $or: [{ validFrom: null }, { validFrom: { $lte: to } }] },
      { $or: [{ validTo: null }, { validTo: { $gte: from } }] },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  const empty = {
    hasIncentive: false,
    title: null,
    targetValue: null,
    currentValue: null,
    unit: null,
    progressPercent: 0,
    progressLabel: null,
    earnedAmount: 0,
    rewardAmount: null,
    onTimeCount: 0,
    lateCount: 0,
    footnote: null,
    expiresAt: null,
  };
  if (!rule) return empty;

  const [delivered, hours] = await Promise.all([
    Order.aggregate<{ count: number; onTime: number; late: number }>([
      { $match: { pickerId: userId, riderStage: 'delivered', deliveredAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          onTime: { $sum: { $cond: [{ $or: [{ $eq: ['$slaDeadline', null] }, { $lte: ['$deliveredAt', '$slaDeadline'] }] }, 1, 0] } },
          late: { $sum: { $cond: [{ $and: [{ $ne: ['$slaDeadline', null] }, { $gt: ['$deliveredAt', '$slaDeadline'] }] }, 1, 0] } },
        },
      },
    ]),
    onlineHoursInRange(pickerId, from, to),
  ]);

  const currentValue = rule.metric === 'hours' ? hours : (delivered[0]?.count || 0);
  const progressPercent = Math.min(100, Math.round((currentValue / Math.max(1, rule.targetValue)) * 100));
  const unitLabel = rule.metric === 'hours' ? 'Hours' : 'Orders';
  const earnedAmount = rule.prorated
    ? Math.round(rule.rewardAmount * Math.min(1, currentValue / rule.targetValue))
    : currentValue >= rule.targetValue ? rule.rewardAmount : 0;
  const onTimeCount = delivered[0]?.onTime || 0;
  const lateCount = delivered[0]?.late || 0;

  return {
    hasIncentive: true,
    title: rule.title,
    targetValue: rule.targetValue,
    currentValue,
    unit: rule.metric,
    progressPercent,
    progressLabel: `${currentValue}/${rule.targetValue} ${unitLabel}`,
    earnedAmount,
    rewardAmount: rule.rewardAmount,
    onTimeCount,
    lateCount,
    footnote: `Delivered on time: ${onTimeCount}, late: ${lateCount}`,
    expiresAt: rule.validTo ? new Date(rule.validTo).toISOString() : hubDayEnd(day).toISOString(),
  };
}

function nextPayoutDue(): Date {
  const now = new Date();
  const weekday = pickerConfig.payoutWeekday; // 0 = Sunday
  const current = now.getUTCDay();
  let daysAhead = (weekday - current + 7) % 7;
  if (daysAhead === 0) daysAhead = 7;
  const due = new Date(now.getTime() + daysAhead * 86400000);
  due.setUTCHours(22, 30, 0, 0); // 04:00 IST
  return due;
}

// ─── API 41 ───────────────────────────────────────────────────────────────────

export async function getEarningsSummary(
  pickerId: string,
  params: { period: 'week' | 'month' | 'custom'; dateFrom?: string; dateTo?: string },
) {
  const { from, to } = periodBounds(params.period, params.dateFrom, params.dateTo);
  const userId = new mongoose.Types.ObjectId(pickerId);

  const [byType, hours, wallet] = await Promise.all([
    Order.aggregate<{ _id: string; amount: number; count: number }>([
      { $match: { pickerId: userId, riderStage: 'delivered', deliveredAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $ifNull: ['$deliveryType', 'standard'] }, amount: { $sum: '$riderPayout' }, count: { $sum: 1 } } },
    ]),
    onlineHoursInRange(pickerId, from, to),
    getWallet(pickerId),
  ]);

  const standard = byType.find((r) => r._id !== 'bulk') || { amount: 0, count: 0 };
  const bulk = byType.find((r) => r._id === 'bulk') || { amount: 0, count: 0 };
  const incentive = 0;
  const deliveries = byType.reduce((sum, r) => sum + r.count, 0);
  const total = Math.round((standard.amount || 0) + (bulk.amount || 0) + incentive);
  const avgPerOrder = deliveries > 0 ? Math.round(total / deliveries) : 0;
  const dueAt = nextPayoutDue();
  const payoutAmount = Math.round((wallet as any)?.availableBalance || total);

  return {
    period: { from: hubDateKey(from), to: hubDateKey(to) },
    total,
    totalDisplay: rupees(total),
    deliveries,
    avgPerOrder,
    avgPerOrderDisplay: rupees(avgPerOrder),
    onlineHours: hours,
    onlineHoursDisplay: hoursDisplay(hours),
    breakdown: [
      { key: 'standard', label: 'Standard Deliveries', amount: Math.round(standard.amount || 0), amountDisplay: rupees(standard.amount || 0), highlight: false },
      { key: 'bulk', label: 'Bulk Delivery', amount: Math.round(bulk.amount || 0), amountDisplay: rupees(bulk.amount || 0), highlight: true },
      { key: 'incentive', label: 'Incentives', amount: incentive, amountDisplay: rupees(incentive), highlight: false },
    ],
    nextPayout: {
      amount: payoutAmount,
      amountDisplay: rupees(payoutAmount),
      dueAt: dueAt.toISOString(),
      whenDisplay: relativeFutureDisplay(dueAt),
      scheduleDisplay: pickerConfig.payoutScheduleLabel,
    },
  };
}

// ─── API 42 ───────────────────────────────────────────────────────────────────

export async function getDailyEarnings(
  pickerId: string,
  params: { period: 'week' | 'month'; dateFrom?: string; dateTo?: string; limit: number },
) {
  const bounds = params.dateFrom || params.dateTo
    ? periodBounds('custom', params.dateFrom, params.dateTo)
    : periodBounds(params.period);
  const userId = new mongoose.Types.ObjectId(pickerId);

  const [orderDays, attendanceDays] = await Promise.all([
    Order.aggregate<{ _id: string; orders: number; amount: number }>([
      { $match: { pickerId: userId, riderStage: 'delivered', deliveredAt: { $gte: bounds.from, $lte: bounds.to } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: { $add: ['$deliveredAt', 330 * 60 * 1000] } } },
          orders: { $sum: 1 },
          amount: { $sum: '$riderPayout' },
        },
      },
    ]),
    PickerAttendance.aggregate<{ _id: string; minutes: number }>([
      { $match: { userId, punchIn: { $gte: bounds.from, $lte: bounds.to } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: { $add: ['$punchIn', 330 * 60 * 1000] } } },
          minutes: { $sum: '$totalWorkedMinutes' },
        },
      },
    ]),
  ]);

  const byDate = new Map<string, { orders: number; amount: number; minutes: number }>();
  for (const row of orderDays) {
    byDate.set(row._id, { orders: row.orders, amount: Math.round(row.amount || 0), minutes: 0 });
  }
  for (const row of attendanceDays) {
    const existing = byDate.get(row._id) || { orders: 0, amount: 0, minutes: 0 };
    existing.minutes = row.minutes || 0;
    byDate.set(row._id, existing);
  }

  const history = Array.from(byDate.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, params.limit)
    .map(([date, row]) => {
      const hoursDecimal = Math.round((row.minutes / 60) * 10) / 10;
      const parsed = new Date(`${date}T00:00:00.000Z`);
      return {
        date,
        day: weekdayShort(parsed).toUpperCase(),
        dateDisplay: dateDisplay(parsed),
        orders: row.orders,
        hours: hoursDisplay(hoursDecimal),
        hoursDecimal,
        amount: String(row.amount),
        amountValue: row.amount,
      };
    });

  return {
    history,
    total: history.reduce((sum, row) => sum + row.amountValue, 0),
  };
}

// ─── API 43 ───────────────────────────────────────────────────────────────────

export async function getWalletBalance(pickerId: string) {
  const wallet = (await getWallet(pickerId)) as any;
  return {
    availableBalance: Math.round(wallet.availableBalance || 0),
    pendingBalance: Math.round(wallet.pendingBalance || 0),
    reservedBalance: Math.round(wallet.reservedBalance || 0),
    totalEarnings: Math.round(wallet.totalEarnings || 0),
    currency: wallet.currency || 'INR',
  };
}

export async function getWalletTransactions(
  pickerId: string,
  params: { page: number; limit: number },
) {
  const skip = (params.page - 1) * params.limit;
  const userId = new mongoose.Types.ObjectId(pickerId);
  const [transactions, total] = await Promise.all([
    PickerTransaction.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(params.limit).lean(),
    PickerTransaction.countDocuments({ userId }),
  ]);
  return {
    transactions,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}
