import mongoose, { Schema, Document } from 'mongoose';
import type { Request } from 'express';
import { logger } from '../../utils/logger';

export interface ICustomerOrderIdempotency extends Document {
  userId: mongoose.Types.ObjectId;
  key: string;
  response: unknown;
  statusCode: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerOrderIdempotencySchema = new Schema<ICustomerOrderIdempotency>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    key: { type: String, required: true },
    response: { type: Schema.Types.Mixed, required: true },
    statusCode: { type: Number, default: 201 },
  },
  { timestamps: true, collection: 'customer_order_idempotency' },
);

CustomerOrderIdempotencySchema.index({ userId: 1, key: 1 }, { unique: true });
CustomerOrderIdempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const CustomerOrderIdempotency =
  (mongoose.models.CustomerOrderIdempotency as mongoose.Model<ICustomerOrderIdempotency>) ||
  mongoose.model<ICustomerOrderIdempotency>('CustomerOrderIdempotency', CustomerOrderIdempotencySchema);

export function readCustomerIdempotencyKey(req: Request): string | null {
  const raw = req.headers['idempotency-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}

export async function replayCustomerOrderIdempotency(
  userId: string,
  key: string,
): Promise<{ body: unknown; statusCode: number } | null> {
  const existing = await CustomerOrderIdempotency.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    key,
  }).lean();
  if (!existing) return null;
  return { body: existing.response, statusCode: existing.statusCode || 201 };
}

export async function persistCustomerOrderIdempotency(
  userId: string,
  key: string,
  body: unknown,
  statusCode = 201,
): Promise<void> {
  try {
    await CustomerOrderIdempotency.create({
      userId: new mongoose.Types.ObjectId(userId),
      key,
      response: body,
      statusCode,
    });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) {
      logger.warn('[order-idempotency] persist failed', { error: (err as Error).message });
    }
  }
}
