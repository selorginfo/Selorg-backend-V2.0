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
 * Allocate a unique customer order number for today (`ORD-YYYYMMDD-#####`).
 *
 * `countDocuments()+1` and a shared `$set` to `max+1` both hand the same number
 * to concurrent checkouts (E11000 → "orderNumber already exists"). Each call
 * takes one atomic counter step: `seq = max(seq, highestExisting) + 1`.
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

function mongoDuplicateCode(err: unknown): boolean {
  const code = (err as { code?: number | string })?.code;
  return code === 11000 || code === '11000' || code === 'E11000';
}

/** Highest numeric suffix already stored for this day. String sort is wrong when widths differ. */
async function maxExistingSeqForDay(dayPrefix: string): Promise<number> {
  const escaped = dayPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rows = await Order.aggregate<{ maxSeq?: number }>([
    { $match: { orderNumber: { $regex: `^${escaped}\\d+$` } } },
    {
      $project: {
        seq: {
          $convert: {
            input: { $arrayElemAt: [{ $split: ['$orderNumber', '-'] }, -1] },
            to: 'long',
            onError: 0,
            onNull: 0,
          },
        },
      },
    },
    { $group: { _id: null, maxSeq: { $max: '$seq' } } },
  ]);
  return Number(rows[0]?.maxSeq || 0);
}

async function allocateSeq(counterId: string, floor: number): Promise<number> {
  const update = [
    {
      $set: {
        seq: {
          $add: [{ $max: [{ $ifNull: ['$seq', 0] }, floor] }, 1],
        },
      },
    },
  ];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const doc = await OrderNumberCounter.findOneAndUpdate({ _id: counterId }, update, {
        upsert: true,
        new: true,
      });
      if (doc?.seq) return doc.seq;
    } catch (err) {
      if (!mongoDuplicateCode(err) || attempt === 2) throw err;
    }
  }
  throw new Error('Could not allocate an order number');
}

export async function generateOrderNumber(): Promise<string> {
  const date = dayStamp();
  const dayPrefix = `ORD-${date}-`;
  const counterId = `ord-${date}`;
  let floor = await maxExistingSeqForDay(dayPrefix);

  for (let attempt = 0; attempt < 8; attempt++) {
    const seq = await allocateSeq(counterId, floor);
    const candidate = `${dayPrefix}${String(seq).padStart(5, '0')}`;
    const taken = await Order.exists({ orderNumber: candidate });
    if (!taken) return candidate;
    floor = Math.max(floor, seq);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${dayPrefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`.toUpperCase();
    const taken = await Order.exists({ orderNumber: candidate });
    if (!taken) return candidate;
  }

  throw new Error('Could not allocate a unique order number');
}

export function create(payload: Record<string, unknown>[], session: mongoose.ClientSession) {
  return Order.create(payload as Partial<IOrder>[], { session });
}
