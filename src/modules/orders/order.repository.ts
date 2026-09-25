import mongoose from 'mongoose';
import { Order, IOrder } from './order.model';

function orderFilter(orderId: string) {
  return mongoose.Types.ObjectId.isValid(orderId)
    ? { _id: orderId }
    : { orderNumber: orderId };
}

export function findById(orderId: string) {
  return Order.findOne(orderFilter(orderId));
}

export function findByIdLean(orderId: string) {
  return Order.findOne(orderFilter(orderId)).lean();
}

export function findOneForUser(orderId: string, userId: string | mongoose.Types.ObjectId) {
  return Order.findOne({ ...orderFilter(orderId), userId });
}

export function findOneForUserLean(orderId: string, userId: string | mongoose.Types.ObjectId) {
  return Order.findOne({ ...orderFilter(orderId), userId }).lean();
}

export function listForUser(userId: mongoose.Types.ObjectId, query: Record<string, unknown>, skip: number, limit: number) {
  return Order.find({ userId, ...query })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

export function countForUser(userId: mongoose.Types.ObjectId, query: Record<string, unknown>) {
  return Order.countDocuments({ userId, ...query });
}

export function countAll() {
  return Order.countDocuments();
}

/**
 * Allocate a unique customer order number for today.
 *
 * Previous implementation used `countDocuments()+1`, which collides whenever
 * documents are deleted or concurrent checkouts share the same count
 * (E11000 on unique index `orderNumber_1` → "orderNumber already exists").
 *
 * Strategy:
 * 1. Atomic per-day counter (upsert + $inc)
 * 2. Jump counter ahead of the highest existing ORD-YYYYMMDD-* sequence
 * 3. Final exists() guard + entropy fallback for races
 */
const OrderNumberCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: 'customer_order_number_counters' },
);

const OrderNumberCounter =
  (mongoose.models.OrderNumberCounter as mongoose.Model<{ _id: string; seq: number }>) ||
  mongoose.model<{ _id: string; seq: number }>('OrderNumberCounter', OrderNumberCounterSchema);

function dayStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function maxExistingSeqForDay(dayPrefix: string): Promise<number> {
  const escaped = dayPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const latest = await Order.findOne({ orderNumber: { $regex: `^${escaped}` } })
    .sort({ orderNumber: -1 })
    .select('orderNumber')
    .lean();
  if (!latest?.orderNumber) return 0;
  const m = String(latest.orderNumber).match(/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export async function generateOrderNumber(): Promise<string> {
  const date = dayStamp();
  const dayPrefix = `ORD-${date}-`;
  const counterId = `ord-${date}`;

  const maxExisting = await maxExistingSeqForDay(dayPrefix);

  let doc = await OrderNumberCounter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (!doc) {
    doc = await OrderNumberCounter.create({ _id: counterId, seq: Math.max(1, maxExisting + 1) });
  }

  if (doc.seq <= maxExisting) {
    doc = await OrderNumberCounter.findByIdAndUpdate(
      counterId,
      { $set: { seq: maxExisting + 1 } },
      { new: true },
    );
  }

  let candidate = `${dayPrefix}${String(doc?.seq || maxExisting + 1).padStart(5, '0')}`;

  // Rare race: another writer inserted the same sequence between counter bump and create.
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = await Order.exists({ orderNumber: candidate });
    if (!exists) return candidate;
    doc = await OrderNumberCounter.findByIdAndUpdate(counterId, { $inc: { seq: 1 } }, { new: true });
    candidate = `${dayPrefix}${String(doc?.seq || Date.now() % 100000).padStart(5, '0')}`;
  }

  // Entropy fallback — still unique-index safe.
  return `${dayPrefix}${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
}

export function create(payload: Record<string, unknown>[], session: mongoose.ClientSession) {
  return Order.create(payload as Partial<IOrder>[], { session });
}
