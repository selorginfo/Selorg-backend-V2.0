import mongoose from 'mongoose';
import { Order } from '../orders/order.model';
import { adminLabelForStage, deriveFulfillmentStage } from '../orders/order-lifecycle';
import { PickerUser, PickerAttendance, PickerDevice, PickerTransaction, PickerWallet } from '../picker/picker.models';
import { PickerCashLedger } from '../picker/picker.rider.models';
import { getCashInHand, getCodTransferGate } from '../picker/picker.cash.service';
import { pickerConfig } from '../picker/picker.config';
import { hubDayStart, hubDayEnd, rupees } from '../picker/picker.format';
import { HHDUser } from '../hhd/hhd.models';
import { DarkstoreDevice, DeviceHistory } from '../darkstore/darkstore.models';
import { DarkStore } from '../store/dark-store.model';
import { ensureDarkstoreDeviceOtp, ensurePickerDeviceOtp, expandStoreKeys, rotateDeviceOtp } from '../picker/hsd-collection-otp';
import { assertAnyStoreAccess } from '../../utils/store-scope';
import type { AdminAuthUser } from '../../types/express';

function rangeToDates(range?: string, from?: string, to?: string): { start: Date; end: Date } {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end);
  switch (range) {
    case 'yesterday': {
      start.setDate(end.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'this_week': {
      const day = end.getDay() || 7;
      start.setDate(end.getDate() - day + 1);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'last_week': {
      const day = end.getDay() || 7;
      end.setDate(end.getDate() - day);
      end.setHours(23, 59, 59, 999);
      start.setTime(end.getTime());
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'this_month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'last_month': {
      start.setMonth(end.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'custom':
      break;
    case 'today':
    default:
      start.setHours(0, 0, 0, 0);
      break;
  }
  return { start, end };
}

export async function getCodSummary(range?: string, from?: string, to?: string) {
  const { start, end } = rangeToDates(range, from, to);
  const match = {
    createdAt: { $gte: start, $lte: end },
    status: { $nin: ['cancelled'] },
    $or: [
      { paymentStatus: 'cod_pending' },
      { paymentStatus: 'paid', 'paymentMethod.methodType': 'cash' },
      { codCollectedAmount: { $gt: 0 } },
    ],
  };

  const orders = await Order.find(match)
    .select('orderNumber status paymentStatus totalBill codCollectedAmount deliveredAt customerName customerPhone pickerId riderId fulfillmentStage createdAt')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  let orderValue = 0;
  let collected = 0;
  let pending = 0;
  let settled = 0;

  const rows = orders.map((o) => {
    const bill = Number(o.totalBill) || 0;
    orderValue += bill;
    const collectedAmt = Number(o.codCollectedAmount) || 0;
    const isSettled = o.paymentStatus === 'paid';
    const isPending = o.paymentStatus === 'cod_pending';
    if (isSettled) settled += bill;
    if (isPending) pending += bill;
    if (collectedAmt > 0) collected += collectedAmt;
    return {
      orderId: String(o._id),
      orderNumber: o.orderNumber,
      customer: o.customerName,
      phone: o.customerPhone,
      amount: bill,
      collectedAmount: collectedAmt || null,
      paymentStatus: o.paymentStatus,
      collectionStatus: isSettled ? 'settled' : collectedAmt > 0 ? 'collected' : isPending ? 'pending' : 'unknown',
      fulfillmentStage: deriveFulfillmentStage(o),
      fulfillmentLabel: adminLabelForStage(deriveFulfillmentStage(o)),
      riderId: o.riderId || (o.pickerId ? String(o.pickerId) : null),
      deliveredAt: o.deliveredAt || null,
      createdAt: o.createdAt,
    };
  });

  return {
    summary: {
      orderValue,
      collected,
      pending,
      submitted: collected,
      verified: settled,
      settled,
      exception: 0,
      realizedRevenue: settled,
      note: 'Pending COD is not realized revenue. Realized = paymentStatus paid after deposit.',
    },
    orders: rows,
  };
}

export type CodRiderTransferState = 'clear' | 'pending_transfer' | 'blocked';

export interface CodRiderTransferRow {
  riderId: string;
  riderName: string;
  phone: string | null;
  hub: string | null;
  isOnline: boolean;
  cashInHand: number;
  cashInHandDisplay: string;
  collectedToday: number;
  depositedToday: number;
  lastDepositAt: string | null;
  lastDepositRef: string | null;
  transferStatus: CodRiderTransferState;
  blockedFromOnline: boolean;
  ordersPendingSettle: number;
}

/**
 * Per-rider COD float board: who still owes company cash and who is blocked from going online.
 */
export async function getCodRiderTransfers(range?: string, from?: string, to?: string) {
  const { start, end } = rangeToDates(range, from, to);
  const dayStart = hubDayStart(end);
  const dayEnd = hubDayEnd(end);

  const riders = (await PickerUser.find({
    status: { $in: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
    $or: [{ workforceRole: { $exists: false } }, { workforceRole: { $ne: 'picker' } }],
  })
    .select('name phone currentLocationId isOnline')
    .lean()) as Array<{
    _id: mongoose.Types.ObjectId;
    name?: string;
    phone?: string;
    currentLocationId?: string;
    isOnline?: boolean;
  }>;

  if (riders.length === 0) {
    return {
      summary: {
        ridersWithFloat: 0,
        totalCashInHand: 0,
        blockedFromOnline: 0,
        transferredToday: 0,
        collectedToday: 0,
        note: 'Riders must transfer COD at shift end. Undeposited cash blocks going online the next day.',
      },
      riders: [] as CodRiderTransferRow[],
    };
  }

  const riderIds = riders.map((r) => r._id);

  const [balances, dayAgg, lastDeposits, pendingOrders] = await Promise.all([
    PickerCashLedger.aggregate<{ _id: mongoose.Types.ObjectId; net: number }>([
      { $match: { pickerId: { $in: riderIds }, status: { $ne: 'disputed' } } },
      {
        $group: {
          _id: '$pickerId',
          net: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'in'] }, '$amount', { $multiply: ['$amount', -1] }],
            },
          },
        },
      },
    ]),
    PickerCashLedger.aggregate<{
      _id: mongoose.Types.ObjectId;
      collected: number;
      deposited: number;
    }>([
      {
        $match: {
          pickerId: { $in: riderIds },
          status: { $ne: 'disputed' },
          createdAt: { $gte: dayStart, $lte: dayEnd },
        },
      },
      {
        $group: {
          _id: '$pickerId',
          collected: {
            $sum: { $cond: [{ $eq: ['$direction', 'in'] }, '$amount', 0] },
          },
          deposited: {
            $sum: { $cond: [{ $eq: ['$direction', 'out'] }, '$amount', 0] },
          },
        },
      },
    ]),
    PickerCashLedger.aggregate<{
      _id: mongoose.Types.ObjectId;
      lastDepositAt: Date;
      lastDepositRef: string | null;
    }>([
      {
        $match: {
          pickerId: { $in: riderIds },
          type: 'deposit',
          status: { $ne: 'disputed' },
          createdAt: { $gte: start, $lte: end },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$pickerId',
          lastDepositAt: { $first: '$createdAt' },
          lastDepositRef: { $first: '$ref' },
        },
      },
    ]),
    Order.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      {
        $match: {
          paymentStatus: 'cod_pending',
          pickerId: { $in: riderIds },
          status: { $nin: ['cancelled'] },
        },
      },
      { $group: { _id: '$pickerId', count: { $sum: 1 } } },
    ]),
  ]);

  const balanceMap = new Map(balances.map((b) => [String(b._id), Math.max(0, Math.round(b.net || 0))]));
  const dayMap = new Map(
    dayAgg.map((d) => [
      String(d._id),
      { collected: Math.round(d.collected || 0), deposited: Math.round(d.deposited || 0) },
    ]),
  );
  const depositMap = new Map(
    lastDeposits.map((d) => [
      String(d._id),
      {
        at: d.lastDepositAt ? new Date(d.lastDepositAt).toISOString() : null,
        ref: d.lastDepositRef || null,
      },
    ]),
  );
  const pendingMap = new Map(pendingOrders.map((p) => [String(p._id), p.count]));
  const carry = pickerConfig.codOfflineCarryLimit;

  const rows: CodRiderTransferRow[] = [];
  let totalCashInHand = 0;
  let ridersWithFloat = 0;
  let blockedFromOnline = 0;
  let transferredToday = 0;
  let collectedToday = 0;

  for (const rider of riders) {
    const id = String(rider._id);
    const cashInHand = balanceMap.get(id) || 0;
    const day = dayMap.get(id) || { collected: 0, deposited: 0 };
    const last = depositMap.get(id);
    const ordersPendingSettle = pendingMap.get(id) || 0;

    // Skip quiet riders with nothing to show in the selected window.
    if (cashInHand <= 0 && day.collected <= 0 && day.deposited <= 0 && ordersPendingSettle <= 0) {
      continue;
    }

    const blocked = cashInHand > carry;
    const transferStatus: CodRiderTransferState = blocked
      ? 'blocked'
      : cashInHand > 0
        ? 'pending_transfer'
        : 'clear';

    if (cashInHand > 0) {
      ridersWithFloat += 1;
      totalCashInHand += cashInHand;
    }
    if (blocked) blockedFromOnline += 1;
    if (day.deposited > 0 && cashInHand <= carry) transferredToday += 1;
    collectedToday += day.collected;

    rows.push({
      riderId: id,
      riderName: rider.name || 'Rider',
      phone: rider.phone || null,
      hub: rider.currentLocationId || null,
      isOnline: Boolean(rider.isOnline),
      cashInHand,
      cashInHandDisplay: rupees(cashInHand),
      collectedToday: day.collected,
      depositedToday: day.deposited,
      lastDepositAt: last?.at || null,
      lastDepositRef: last?.ref || null,
      transferStatus,
      blockedFromOnline: blocked,
      ordersPendingSettle,
    });
  }

  rows.sort((a, b) => {
    const rank = (s: CodRiderTransferState) => (s === 'blocked' ? 0 : s === 'pending_transfer' ? 1 : 2);
    const diff = rank(a.transferStatus) - rank(b.transferStatus);
    if (diff !== 0) return diff;
    return b.cashInHand - a.cashInHand;
  });

  return {
    summary: {
      ridersWithFloat,
      totalCashInHand: rupees(totalCashInHand),
      blockedFromOnline,
      transferredToday,
      collectedToday: rupees(collectedToday),
      note: 'Riders must transfer COD at shift end. Undeposited cash blocks going online the next day.',
    },
    riders: rows,
  };
}

export async function listReviews(opts: { rating?: number; from?: string; to?: string; limit?: number }) {
  const filter: Record<string, unknown> = { ratingScore: { $exists: true, $ne: null } };
  if (opts.rating) filter.ratingScore = opts.rating;
  if (opts.from || opts.to) {
    filter.updatedAt = {};
    if (opts.from) (filter.updatedAt as Record<string, Date>).$gte = new Date(opts.from);
    if (opts.to) (filter.updatedAt as Record<string, Date>).$lte = new Date(opts.to);
  }
  const rows = await Order.find(filter)
    .select('orderNumber customerName customerPhone ratingScore ratingComment pickerId riderId hhdUserId storeId offerHubKey updatedAt deliveredAt')
    .sort({ updatedAt: -1 })
    .limit(opts.limit || 200)
    .lean();
  return rows.map((o) => ({
    reviewId: String(o._id),
    orderId: String(o._id),
    orderNumber: o.orderNumber,
    customer: o.customerName,
    phone: o.customerPhone,
    rating: o.ratingScore,
    reviewText: o.ratingComment || '',
    riderId: o.riderId || (o.pickerId ? String(o.pickerId) : null),
    pickerId: o.hhdUserId ? String(o.hhdUserId) : null,
    darkStore: o.offerHubKey || o.storeId || null,
    date: o.updatedAt || o.deliveredAt,
  }));
}

export async function listOrderProgress(opts: { store?: string; limit?: number }) {
  const filter: Record<string, unknown> = { status: { $nin: ['cancelled'] } };
  if (opts.store) filter.offerHubKey = opts.store;
  const rows = await Order.find(filter)
    .select('orderNumber status riderStage fulfillmentStage hhdUserId pickerId riderId bagCode dispatchBay hsdDeviceId timeline customerName totalBill paymentStatus offerHubKey createdAt deliveredAt exceptionReason')
    .sort({ createdAt: -1 })
    .limit(opts.limit || 100)
    .lean();

  return rows.map((o) => {
    const stage = deriveFulfillmentStage(o);
    return {
      orderId: String(o._id),
      orderNumber: o.orderNumber,
      customer: o.customerName,
      darkStore: o.offerHubKey,
      fulfillmentStage: stage,
      fulfillmentLabel: adminLabelForStage(stage),
      status: o.status,
      riderStage: o.riderStage,
      pickerId: o.hhdUserId ? String(o.hhdUserId) : null,
      riderId: o.riderId || (o.pickerId ? String(o.pickerId) : null),
      bagCode: o.bagCode,
      dispatchBay: o.dispatchBay,
      hsdDeviceId: o.hsdDeviceId,
      paymentStatus: o.paymentStatus,
      exceptionReason: o.exceptionReason || null,
      timeline: (o.timeline || []).map((t: Record<string, unknown>) => ({
        status: t.status,
        timestamp: t.timestamp,
        actor: t.actor,
        userId: t.userId,
        note: t.note,
      })),
      createdAt: o.createdAt,
      deliveredAt: o.deliveredAt,
    };
  });
}

async function workerOrderStats(workerId: string, role: 'rider' | 'picker', range?: string, from?: string, to?: string) {
  const { start, end } = rangeToDates(range, from, to);
  const oid = new mongoose.Types.ObjectId(workerId);
  const match =
    role === 'rider'
      ? {
          createdAt: { $gte: start, $lte: end },
          $or: [{ pickerId: oid }, { riderId: workerId }],
        }
      : {
          createdAt: { $gte: start, $lte: end },
          hhdUserId: oid,
        };

  const orders = await Order.find(match)
    .select('orderNumber status riderStage fulfillmentStage totalBill paymentStatus codCollectedAmount customerName customerPhone deliveredAt acceptedAt pickedUpAt pickerAcceptedAt rackedAt createdAt paymentMethod')
    .sort({ createdAt: -1 })
    .lean();

  const stats = {
    ordersAssigned: orders.length,
    ordersAccepted: orders.filter((o) => o.acceptedAt || o.pickerAcceptedAt || ['accepted', 'picked_up', 'delivered'].includes(String(o.riderStage))).length,
    ordersPicked: orders.filter((o) => o.pickedUpAt || o.rackedAt).length,
    ordersDelivered: orders.filter((o) => o.status === 'delivered').length,
    failed: orders.filter((o) => o.fulfillmentStage === 'exception').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    codOrders: orders.filter((o) => o.paymentStatus === 'cod_pending' || o.paymentMethod?.methodType === 'cash').length,
    codCollected: orders.reduce((s, o) => s + (Number(o.codCollectedAmount) || 0), 0),
    codPending: orders.filter((o) => o.paymentStatus === 'cod_pending').reduce((s, o) => s + (Number(o.totalBill) || 0), 0),
    orderValue: orders.reduce((s, o) => s + (Number(o.totalBill) || 0), 0),
  };

  return {
    range: { start, end, key: range || 'today' },
    stats,
    orders: orders.map((o) => ({
      orderId: String(o._id),
      orderNumber: o.orderNumber,
      customer: o.customerName,
      phone: o.customerPhone,
      amount: o.totalBill,
      paymentStatus: o.paymentStatus,
      status: o.status,
      fulfillmentStage: deriveFulfillmentStage(o),
      fulfillmentLabel: adminLabelForStage(deriveFulfillmentStage(o)),
      acceptedAt: o.acceptedAt || o.pickerAcceptedAt,
      pickedAt: o.pickedUpAt || o.rackedAt,
      deliveredAt: o.deliveredAt,
      createdAt: o.createdAt,
    })),
  };
}

export async function getRiderDetails(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const user = (await PickerUser.findById(id).lean()) as Record<string, any> | null;
  if (!user || user.workforceRole === 'picker') return null;

  const [attendance, wallet, txs, stats, cashInHand, transferGate, lastDeposit] = await Promise.all([
    PickerAttendance.find({ userId: id }).sort({ punchIn: -1 }).limit(60).lean(),
    PickerWallet.findOne({ userId: id }).lean(),
    PickerTransaction.find({ userId: id }).sort({ createdAt: -1 }).limit(50).lean(),
    workerOrderStats(id, 'rider', 'this_month'),
    getCashInHand(id),
    getCodTransferGate(id),
    PickerCashLedger.findOne({ pickerId: id, type: 'deposit', status: { $ne: 'disputed' } })
      .sort({ createdAt: -1 })
      .select('ref amount createdAt method')
      .lean(),
  ]);

  const currentOrder = await Order.findOne({
    pickerId: new mongoose.Types.ObjectId(id),
    riderStage: { $in: ['accepted', 'picked_up'] },
    status: { $nin: ['delivered', 'cancelled'] },
  })
    .select('orderNumber status riderStage fulfillmentStage')
    .lean();

  return {
    profile: {
      riderId: String(user._id),
      employeeId: user.employeeId || null,
      name: user.name,
      phone: user.phone,
      email: user.email,
      profileImage: user.profilePhoto || null,
      approvalStatus: user.status,
      active: user.status === 'ACTIVE',
      joiningDate: user.createdAt || null,
    },
    work: {
      darkStore: user.currentLocationId || null,
      vehicleType: user.vehicleType || null,
      vehicleNumber: user.vehicleNumber || null,
      isOnline: Boolean(user.isOnline),
      onlineSince: user.onlineSince || null,
      lastSeenAt: user.lastSeenAt || null,
      currentOrder: currentOrder
        ? {
            orderId: String(currentOrder._id),
            orderNumber: currentOrder.orderNumber,
            status: currentOrder.status,
            fulfillmentStage: deriveFulfillmentStage(currentOrder),
          }
        : null,
      totalTrips: user.totalTrips || 0,
    },
    cod: {
      cashInHand,
      cashInHandDisplay: rupees(cashInHand),
      transferStatus: transferGate.transferStatus,
      blockedFromOnline: transferGate.codTransferRequired,
      transferMessage: transferGate.transferMessage,
      lastDeposit: lastDeposit
        ? {
            ref: (lastDeposit as { ref?: string }).ref || null,
            amount: (lastDeposit as { amount?: number }).amount || 0,
            method: (lastDeposit as { method?: string }).method || null,
            at: (lastDeposit as { createdAt?: Date }).createdAt
              ? new Date((lastDeposit as { createdAt: Date }).createdAt).toISOString()
              : null,
          }
        : null,
    },
    location: {
      current: user.gpsLocation || null,
      lastSeenAt: user.lastSeenAt || null,
    },
    earnings: {
      walletBalance: (wallet as { availableBalance?: number } | null)?.availableBalance || 0,
      totalEarnings: (wallet as { totalEarnings?: number } | null)?.totalEarnings || 0,
      recentTransactions: txs,
    },
    attendance,
    activity: (await Order.find({ $or: [{ pickerId: new mongoose.Types.ObjectId(id) }, { riderId: id }] })
      .select('orderNumber timeline')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean())
      .flatMap((o) =>
        (o.timeline || [])
          .filter((t: { actor?: string }) => String(t.actor || '').includes('rider') || String(t.actor || '') === 'rider')
          .map((t: Record<string, unknown>) => ({
            orderNumber: o.orderNumber,
            ...t,
          })),
      )
      .slice(0, 50),
    stats,
  };
}

export async function getPickerDetails(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const hhd = (await HHDUser.findById(id).lean()) as Record<string, any> | null;
  const workforce = (await PickerUser.findById(id).lean()) as Record<string, any> | null;
  if (!hhd && !workforce) return null;
  if (!hhd && workforce?.workforceRole === 'rider') return null;

  const attendanceUserId = workforce ? String(workforce._id) : id;
  const [attendance, device, stats] = await Promise.all([
    PickerAttendance.find({ userId: attendanceUserId }).sort({ punchIn: -1 }).limit(60).lean(),
    PickerDevice.findOne({ assignedTo: new mongoose.Types.ObjectId(id), status: 'assigned' }).lean(),
    workerOrderStats(id, 'picker', 'this_month'),
  ]);

  const current = await Order.findOne({
    hhdUserId: new mongoose.Types.ObjectId(id),
    status: { $in: ['confirmed', 'getting-packed'] },
    fulfillmentStage: { $in: ['picker_accepted', 'confirmed'] },
  })
    .select('orderNumber status fulfillmentStage')
    .lean();

  return {
    profile: {
      pickerId: id,
      name: hhd?.name || workforce?.name,
      phone: hhd?.phone || workforce?.phone,
      email: workforce?.email || null,
      approval: workforce?.status || (hhd?.isActive ? 'ACTIVE' : 'INACTIVE'),
      darkStore: hhd?.warehouse || hhd?.darkstore || workforce?.currentLocationId,
    },
    work: {
      currentOrder: current
        ? {
            orderId: String(current._id),
            orderNumber: current.orderNumber,
            fulfillmentStage: deriveFulfillmentStage(current),
          }
        : null,
      hsdDevice: device
        ? { deviceId: (device as { deviceId?: string }).deviceId, status: (device as { status?: string }).status, assignedAt: (device as { assignedAt?: Date }).assignedAt }
        : hhd?.deviceId
          ? { deviceId: hhd.deviceId }
          : null,
    },
    attendance,
    stats,
  };
}

export const getRiderStats = (id: string, range?: string, from?: string, to?: string) =>
  workerOrderStats(id, 'rider', range, from, to);
export const getPickerStats = (id: string, range?: string, from?: string, to?: string) =>
  workerOrderStats(id, 'picker', range, from, to);

async function storeLabelMap(keys: string[]): Promise<Map<string, string>> {
  const expanded = await expandStoreKeys(keys);
  if (!expanded.length) return new Map();
  const ids = expanded.filter((k) => /^[a-f0-9]{24}$/i.test(k));
  const codes = expanded.filter((k) => !/^[a-f0-9]{24}$/i.test(k));
  const or: Record<string, unknown>[] = [];
  if (ids.length) or.push({ _id: { $in: ids } });
  if (codes.length) or.push({ code: { $in: codes } });
  const stores = or.length ? await DarkStore.find(or.length === 1 ? or[0] : { $or: or }).select('name code').lean() : [];
  const map = new Map<string, string>();
  for (const store of stores) {
    const label = store.code ? `${store.name} (${store.code})` : store.name;
    map.set(String(store._id), label);
    if (store.code) map.set(store.code, label);
  }
  return map;
}

export async function listHsdDevices(opts?: { storeKey?: string; allowedKeys?: string[] | null }) {
  const scopeKeys = opts?.storeKey
    ? await expandStoreKeys([opts.storeKey])
    : opts?.allowedKeys
      ? await expandStoreKeys(opts.allowedKeys)
      : null;
  const pickerQuery: Record<string, unknown> = {};
  const darkQuery: Record<string, unknown> = {};
  if (scopeKeys) {
    if (!scopeKeys.length) return { devices: [] };
    pickerQuery.warehouseKey = { $in: scopeKeys };
    darkQuery.store_id = { $in: scopeKeys };
  }
  const [pickerDevices, darkstoreDevices] = await Promise.all([
    PickerDevice.find(pickerQuery).sort({ updatedAt: -1 }).lean(),
    DarkstoreDevice.find(darkQuery).sort({ updatedAt: -1 }).lean(),
  ]);

  const assigneeIds = pickerDevices.map((d) => d.assignedTo).filter(Boolean).map((id) => String(id));
  const pickers = assigneeIds.length
    ? await PickerUser.find({ _id: { $in: assigneeIds } }).select('name phone').lean()
    : [];
  const pickerNames = new Map(pickers.map((p) => [String(p._id), p.name || p.phone || String(p._id)]));

  const storeKeys = [
    ...pickerDevices.map((d) => d.warehouseKey || ''),
    ...darkstoreDevices.map((d) => d.store_id || ''),
  ];
  const labels = await storeLabelMap(storeKeys);

  const devices = [
    ...await Promise.all(pickerDevices.map(async (d) => {
      const collectionOtp = await ensurePickerDeviceOtp(d.deviceId);
      const storeKey = d.warehouseKey || '';
      return {
        source: 'picker_devices',
        _id: String(d._id),
        deviceId: d.deviceId,
        label: d.deviceModel || d.type || d.deviceId,
        model: d.deviceModel || d.type,
        status: d.status,
        assignedTo: d.assignedTo ? pickerNames.get(String(d.assignedTo)) || String(d.assignedTo) : null,
        battery: d.battery,
        lastSeen: d.lastSyncedAt,
        assignedAt: d.assignedAt,
        storeId: storeKey || null,
        store: labels.get(storeKey) || storeKey || 'Unassigned store',
        collectionOtp,
        serial: null,
        firmware: null,
      };
    })),
    ...await Promise.all(darkstoreDevices.map(async (d) => {
      const collectionOtp = await ensureDarkstoreDeviceOtp(d.device_id);
      const storeKey = d.store_id || '';
      return {
        source: 'darkstore_devices',
        _id: String(d._id),
        deviceId: d.device_id,
        label: d.model || d.device_id,
        serial: d.serial_number,
        model: d.model,
        status: d.status,
        assignedTo: d.assigned_to || null,
        battery: d.battery_level,
        lastSeen: d.last_seen,
        storeId: storeKey || null,
        store: labels.get(storeKey) || storeKey || 'Unassigned store',
        firmware: d.firmware_version,
        collectionOtp,
      };
    })),
  ];
  return { devices };
}

export async function regenerateHsdDeviceOtp(deviceId: string, user?: AdminAuthUser) {
  const picker = await PickerDevice.findOne({ deviceId }).select('deviceId warehouseKey').lean() as { deviceId?: string; warehouseKey?: string } | null;
  const dark = picker ? null : await DarkstoreDevice.findOne({ device_id: deviceId }).select('device_id store_id').lean();
  if (!picker && !dark) return null;
  const storeId = picker?.warehouseKey || (dark as { store_id?: string } | null)?.store_id || null;
  assertAnyStoreAccess(user, storeId || undefined);
  const collectionOtp = await rotateDeviceOtp(deviceId);
  return { deviceId, collectionOtp, storeId };
}

export async function getHsdDeviceHistory(deviceId: string, range?: string, from?: string, to?: string) {
  const { start, end } = rangeToDates(range, from, to);
  const history = await DeviceHistory.find({
    device_id: deviceId,
    createdAt: { $gte: start, $lte: end },
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()
    .catch(() => []);

  const orders = await Order.find({
    hsdDeviceId: deviceId,
    createdAt: { $gte: start, $lte: end },
  })
    .select('orderNumber status fulfillmentStage hhdUserId bagCode dispatchBay createdAt rackedAt')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return { deviceId, history, orders };
}
