import mongoose, { Schema } from 'mongoose';
import { MAX_OPEN_ORDERS, tooManyOpenOrdersError, type OrderFlowError } from './order-pricing-guard';

/** In-flight placements older than this are dropped so a crashed request cannot block the customer. */
const SLOT_TTL_MS = 60_000;

interface PlacementLockDoc {
  userId: mongoose.Types.ObjectId;
  inFlight: number;
  inFlightUntil: Date | null;
}

const placementLockSchema = new Schema<PlacementLockDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    inFlight: { type: Number, default: 0 },
    inFlightUntil: { type: Date, default: null },
  },
  { collection: 'order_placement_locks' },
);

const OrderPlacementLock =
  (mongoose.models.OrderPlacementSlot as mongoose.Model<PlacementLockDoc>) ||
  mongoose.model<PlacementLockDoc>('OrderPlacementSlot', placementLockSchema);

const localInFlight = new Map<string, number>();

export function resetLocalPlacementLocks(): void {
  localInFlight.clear();
}

/** Reserve one in-flight placement. Orders already saved do not use a slot. */
export function tryClaimLocalSlot(userId: string, max = MAX_OPEN_ORDERS): boolean {
  const pending = localInFlight.get(userId) ?? 0;
  if (pending >= max) return false;
  localInFlight.set(userId, pending + 1);
  return true;
}

export function releaseLocalSlot(userId: string): void {
  const pending = localInFlight.get(userId) ?? 0;
  if (pending <= 1) localInFlight.delete(userId);
  else localInFlight.set(userId, pending - 1);
}

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

/** Atomic cross-process reserve. `slotsLeft` is how many placements may still run together. */
export async function tryClaimStoredSlot(userId: string, slotsLeft: number, now = Date.now()): Promise<boolean> {
  if (slotsLeft <= 0) return false;
  const oid = new mongoose.Types.ObjectId(userId);
  const until = new Date(now + SLOT_TTL_MS);
  await OrderPlacementLock.updateOne(
    { userId: oid, inFlightUntil: { $ne: null, $lte: new Date(now) } },
    { $set: { inFlight: 0, inFlightUntil: null } },
  );
  const room = {
    userId: oid,
    $or: [{ inFlight: { $lt: slotsLeft } }, { inFlight: { $exists: false } }, { inFlight: null }],
  };
  try {
    const taken = await OrderPlacementLock.findOneAndUpdate(
      room,
      { $inc: { inFlight: 1 }, $set: { userId: oid, inFlightUntil: until } },
      { upsert: true, new: true },
    );
    return taken != null;
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
  const taken = await OrderPlacementLock.findOneAndUpdate(
    { userId: oid, inFlight: { $lt: slotsLeft } },
    { $inc: { inFlight: 1 }, $set: { inFlightUntil: until } },
    { new: true },
  );
  return taken != null;
}

export async function releaseStoredSlot(userId: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return;
  await OrderPlacementLock.updateOne(
    { userId: new mongoose.Types.ObjectId(userId), inFlight: { $gt: 0 } },
    { $inc: { inFlight: -1 } },
  );
}

export async function acquireOpenOrderSlot(
  userId: string,
): Promise<{ release: () => Promise<void> } | OrderFlowError> {
  if (!tryClaimLocalSlot(userId)) return tooManyOpenOrdersError();

  try {
    const stored = await tryClaimStoredSlot(userId, MAX_OPEN_ORDERS);
    if (!stored) {
      releaseLocalSlot(userId);
      return tooManyOpenOrdersError();
    }
  } catch (err) {
    releaseLocalSlot(userId);
    throw err;
  }

  let released = false;
  return {
    async release() {
      if (released) return;
      released = true;
      try {
        await releaseStoredSlot(userId);
      } finally {
        releaseLocalSlot(userId);
      }
    },
  };
}

export async function runWithPlacementLock<T>(
  userId: string,
  fn: () => Promise<T>,
): Promise<T | OrderFlowError> {
  const gate = await acquireOpenOrderSlot(userId);
  if ('error' in gate) return gate;
  try {
    return await fn();
  } finally {
    await gate.release();
  }
}
