import mongoose, { Schema, Document } from 'mongoose';
import type { Request } from 'express';
import { logger } from '../../utils/logger';

export interface IHHDIdempotencyRecord extends Document {
  userId: mongoose.Types.ObjectId;
  scope: string;
  key: string;
  response: unknown;
  statusCode: number;
  createdAt: Date;
  updatedAt: Date;
}

const HHDIdempotencySchema = new Schema<IHHDIdempotencyRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    scope: { type: String, required: true },
    key: { type: String, required: true },
    response: { type: Schema.Types.Mixed, required: true },
    statusCode: { type: Number, default: 200 },
  },
  { timestamps: true, collection: 'hhd_idempotency' },
);

HHDIdempotencySchema.index({ userId: 1, scope: 1, key: 1 }, { unique: true });
HHDIdempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const HHDIdempotencyRecord =
  (mongoose.models.HHDIdempotencyRecord as mongoose.Model<IHHDIdempotencyRecord>) ||
  mongoose.model<IHHDIdempotencyRecord>('HHDIdempotencyRecord', HHDIdempotencySchema);

export function readIdempotencyKey(req: Request): string | null {
  const raw = req.headers['idempotency-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}

export async function withHhdIdempotency<T>(
  userId: string,
  scope: string,
  key: string | null,
  handler: () => Promise<{ body: T; statusCode?: number }>,
): Promise<{ body: T; statusCode: number; replayed: boolean }> {
  if (!key) {
    const result = await handler();
    return { body: result.body, statusCode: result.statusCode ?? 200, replayed: false };
  }

  const filter = {
    userId: new mongoose.Types.ObjectId(userId),
    scope,
    key,
  };
  const existing = await HHDIdempotencyRecord.findOne(filter).lean();
  if (existing) {
    return {
      body: existing.response as T,
      statusCode: existing.statusCode || 200,
      replayed: true,
    };
  }

  const result = await handler();
  const statusCode = result.statusCode ?? 200;

  try {
    await HHDIdempotencyRecord.create({ ...filter, response: result.body, statusCode });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) {
      logger.warn('[HHD Idempotency] could not persist record', {
        scope,
        error: (err as Error).message,
      });
    }
  }

  return { body: result.body, statusCode, replayed: false };
}
