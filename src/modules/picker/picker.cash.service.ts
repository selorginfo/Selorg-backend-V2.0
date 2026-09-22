import mongoose from 'mongoose';
import { PickerUser, PickerShiftAssignment } from './picker.models';
import { PickerCashLedger, DEPOSIT_METHOD_LABELS, type DepositMethod } from './picker.rider.models';
import { Order } from '../orders/order.model';
import { AppError } from '../../utils/AppError';
import { pickerConfig } from './picker.config';
import { rupees, signedRupees, timeOfDayDisplay, hubDayStart, hubDayEnd, parseHubDate, formatHhMm } from './picker.format';

/**
 * Floating cash — the COD money a rider is physically holding (APIs 46–48).
 *
 * This is the inverse of `PickerWallet`: the wallet is earnings the company owes
 * the rider, whereas float is cash the rider owes the company. They are kept in
 * separate ledgers so the two liabilities are never netted into one figure.
 *
 * `PickerCashLedger` is the single source of truth; the balance is always derived
 * by aggregation rather than denormalised, so it cannot drift from its rows.
 */

/** Net cash the rider is holding: COD collected in, deposits and adjustments out. */
export async function getCashInHand(pickerId: string): Promise<number> {
  const [result] = await PickerCashLedger.aggregate<{ net: number }>([
    { $match: { pickerId: new mongoose.Types.ObjectId(pickerId), status: { $ne: 'disputed' } } },
    {
      $group: {
        _id: null,
        net: { $sum: { $cond: [{ $eq: ['$direction', 'in'] }, '$amount', { $multiply: ['$amount', -1] }] } },
      },
    },
    { $project: { _id: 0, net: 1 } },
  ]);
  return Math.max(0, Math.round(result?.net || 0));
}

async function sumForDay(pickerId: string, direction: 'in' | 'out', day: Date): Promise<number> {
  const [result] = await PickerCashLedger.aggregate<{ total: number }>([
    {
      $match: {
        pickerId: new mongoose.Types.ObjectId(pickerId),
        direction,
        status: { $ne: 'disputed' },
        createdAt: { $gte: hubDayStart(day), $lte: hubDayEnd(day) },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
    { $project: { _id: 0, total: 1 } },
  ]);
  return Math.round(result?.total || 0);
}

/**
 * Records COD taken at the door. Called from the delivery-completion paths
 * (standard and bulk) rather than exposed as its own endpoint, so float can only
 * increase as the by-product of a real delivery.
 */
export async function recordCodCollection(params: {
  pickerId: string;
  amount: number;
  orderId: mongoose.Types.ObjectId | string;
  orderNumber?: string;
  batchId?: string | null;
  hubKey?: string | null;
}): Promise<void> {
  if (!params.amount || params.amount <= 0) return;

  const orderId = new mongoose.Types.ObjectId(String(params.orderId));
  // A retried completion must not credit the float twice.
  const existing = await PickerCashLedger.findOne({
    pickerId: new mongoose.Types.ObjectId(params.pickerId),
    orderId,
    type: 'cod_collected',
  }).select('_id').lean();
  if (existing) return;

  await PickerCashLedger.create({
    pickerId: new mongoose.Types.ObjectId(params.pickerId),
    type: 'cod_collected',
    amount: Math.round(params.amount),
    direction: 'in',
    label: `COD collected · ${params.orderNumber || ''}`.trim().replace(/·\s*$/, '').trim(),
    orderId,
    orderNumber: params.orderNumber || '',
    batchId: params.batchId || null,
    hubKey: params.hubKey || undefined,
    status: 'confirmed',
  });
}

/** End of the rider's currently running shift, which is the deposit deadline. */
async function resolveDepositDeadline(pickerId: string): Promise<{ dueAt: Date | null; display: string | null }> {
  const assignment = (await PickerShiftAssignment.findOne({
    userId: new mongoose.Types.ObjectId(pickerId),
    status: 'STARTED',
  })
    .populate('shiftId')
    .lean()) as any;

  if (!assignment?.shiftId) return { dueAt: null, display: 'Deposit before end of shift' };

  const endTime = assignment.shiftId.endTime as string | undefined;
  const match = endTime ? /^(\d{1,2}):(\d{2})/.exec(endTime) : null;
  if (!match) return { dueAt: null, display: 'Deposit before end of shift' };

  const base = hubDayStart(assignment.date ? new Date(assignment.date) : new Date());
  const dueAt = new Date(base.getTime() + (Number(match[1]) * 60 + Number(match[2])) * 60000);
  return { dueAt, display: `Deposit before ${formatHhMm(endTime)}` };
}

export interface CashSummaryDto {
  cashInHand: number;
  cashInHandDisplay: string;
  depositLimit: number;
  limitExceeded: boolean;
  depositDueBy: string | null;
  depositDueDisplay: string | null;
  collectedToday: number;
  depositedToday: number;
  pendingDeposits: number;
  canGoOffline: boolean;
}

export async function getCashSummary(pickerId: string): Promise<CashSummaryDto> {
  const today = new Date();
  const [cashInHand, collectedToday, depositedToday, pendingAgg, deadline] = await Promise.all([
    getCashInHand(pickerId),
    sumForDay(pickerId, 'in', today),
    sumForDay(pickerId, 'out', today),
    PickerCashLedger.aggregate<{ total: number }>([
      { $match: { pickerId: new mongoose.Types.ObjectId(pickerId), type: 'deposit', status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
      { $project: { _id: 0, total: 1 } },
    ]),
    resolveDepositDeadline(pickerId),
  ]);

  return {
    cashInHand,
    cashInHandDisplay: rupees(cashInHand),
    depositLimit: pickerConfig.codDepositLimit,
    limitExceeded: cashInHand > pickerConfig.codDepositLimit,
    depositDueBy: deadline.dueAt ? deadline.dueAt.toISOString() : null,
    depositDueDisplay: deadline.display,
    collectedToday,
    depositedToday,
    pendingDeposits: Math.round(pendingAgg[0]?.total || 0),
    canGoOffline: cashInHand <= pickerConfig.codOfflineCarryLimit,
  };
}

// ─── Transactions (API 47) ────────────────────────────────────────────────────

export interface CashTransactionDto {
  id: string;
  type: string;
  amount: number;
  direction: 'in' | 'out';
  label: string;
  amountDisplay: string;
  time: string;
  createdAt: string;
  orderId: string | null;
  ref: string | null;
  method: DepositMethod | null;
  status: string;
}

export async function listCashTransactions(
  pickerId: string,
  params: { type?: string; dateFrom?: string; dateTo?: string; page: number; limit: number },
): Promise<{ transactions: CashTransactionDto[]; total: number; page: number; limit: number; totalPages: number }> {
  const query: Record<string, unknown> = { pickerId: new mongoose.Types.ObjectId(pickerId) };
  if (params.type && params.type !== 'all') query.type = params.type;

  const from = parseHubDate(params.dateFrom);
  const to = parseHubDate(params.dateTo);
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = from;
    if (to) range.$lte = hubDayEnd(to);
    query.createdAt = range;
  } else {
    // The FloatCash screen shows "Recent transactions" for the current shift day.
    query.createdAt = { $gte: hubDayStart(), $lte: hubDayEnd() };
  }

  const skip = (params.page - 1) * params.limit;
  const [rows, total] = await Promise.all([
    PickerCashLedger.find(query).sort({ createdAt: -1 }).skip(skip).limit(params.limit).lean(),
    PickerCashLedger.countDocuments(query),
  ]);

  const transactions: CashTransactionDto[] = (rows as any[]).map((row) => ({
    id: String(row._id),
    type: row.type,
    amount: row.amount,
    direction: row.direction,
    label: row.label || (row.type === 'deposit' ? 'Deposit to Selorg wallet' : 'COD collected'),
    amountDisplay: signedRupees(row.amount, row.direction),
    time: timeOfDayDisplay(new Date(row.createdAt)),
    createdAt: new Date(row.createdAt).toISOString(),
    orderId: row.orderId ? String(row.orderId) : null,
    ref: row.ref || null,
    method: row.method || null,
    status: row.status,
  }));

  return {
    transactions,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

// ─── Deposits (API 48) ────────────────────────────────────────────────────────

/**
 * Server-issued deposit reference. Unique-indexed on the ledger, so the loop
 * simply retries on the (very unlikely) collision rather than trusting randomness.
 */
async function generateDepositRef(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ref = `DP${Math.floor(100000 + Math.random() * 900000)}`;
    const clash = await PickerCashLedger.findOne({ ref }).select('_id').lean();
    if (!clash) return ref;
  }
  throw AppError.internal('Could not allocate a deposit reference. Please retry.');
}

export interface DepositResultDto {
  ref: string;
  depositId: string;
  amount: number;
  method: DepositMethod;
  methodLabel: string;
  status: 'pending' | 'confirmed';
  createdAt: string;
  cashInHand: number;
  cashInHandDisplay: string;
  receiptUrl: string | null;
}

/**
 * Records a cash hand-over and reconciles the COD orders it covers, oldest first,
 * so finance can see which specific orders a deposit settled.
 */
export async function recordDeposit(
  pickerId: string,
  input: { amount: number; method: DepositMethod; hubId?: string; note?: string },
): Promise<DepositResultDto> {
  const userId = new mongoose.Types.ObjectId(pickerId);
  const cashInHand = await getCashInHand(pickerId);

  if (input.amount > cashInHand) {
    throw new AppError(
      `Amount exceeds cash in hand (${rupees(cashInHand)}).`,
      400,
      'AMOUNT_EXCEEDS_CASH_IN_HAND',
      { cashInHand },
    );
  }
  if (input.amount > pickerConfig.codDepositLimit) {
    throw new AppError(
      `A single deposit cannot exceed ${rupees(pickerConfig.codDepositLimit)}.`,
      400,
      'AMOUNT_EXCEEDS_LIMIT',
      { depositLimit: pickerConfig.codDepositLimit },
    );
  }

  let hubKey = input.hubId;
  if (!hubKey) {
    const user = await PickerUser.findById(pickerId).select('currentLocationId').lean();
    hubKey = (user as any)?.currentLocationId || undefined;
  }

  // Which COD collections this deposit clears, taken oldest-first up to the amount.
  const outstanding = (await PickerCashLedger.find({
    pickerId: userId,
    type: 'cod_collected',
    status: 'confirmed',
    orderId: { $ne: null },
  })
    .sort({ createdAt: 1 })
    .select('_id orderId amount')
    .lean()) as Array<{ _id: mongoose.Types.ObjectId; orderId: mongoose.Types.ObjectId; amount: number }>;

  const reconciledOrderIds: mongoose.Types.ObjectId[] = [];
  const reconciledLedgerIds: mongoose.Types.ObjectId[] = [];
  let remaining = input.amount;
  for (const row of outstanding) {
    if (remaining < row.amount) break;
    remaining -= row.amount;
    reconciledOrderIds.push(row.orderId);
    reconciledLedgerIds.push(row._id);
  }

  const ref = await generateDepositRef();
  const deposit = await PickerCashLedger.create({
    pickerId: userId,
    type: 'deposit',
    amount: input.amount,
    direction: 'out',
    label: 'Deposit to Selorg wallet',
    method: input.method,
    ref,
    hubKey,
    note: input.note || '',
    status: 'confirmed',
    reconciledOrderIds,
  });

  if (reconciledLedgerIds.length > 0) {
    await PickerCashLedger.updateMany({ _id: { $in: reconciledLedgerIds } }, { $set: { status: 'reconciled' } });
    // The customer-facing order is now fully settled.
    await Order.updateMany(
      { _id: { $in: reconciledOrderIds }, paymentStatus: 'cod_pending' },
      { $set: { paymentStatus: 'paid' } },
    );
  }

  const newCash = await getCashInHand(pickerId);
  return {
    ref,
    depositId: String(deposit._id),
    amount: input.amount,
    method: input.method,
    methodLabel: DEPOSIT_METHOD_LABELS[input.method],
    status: 'confirmed',
    createdAt: new Date(deposit.createdAt).toISOString(),
    cashInHand: newCash,
    cashInHandDisplay: rupees(newCash),
    receiptUrl: null,
  };
}
