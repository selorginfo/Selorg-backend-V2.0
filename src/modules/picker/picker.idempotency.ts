import mongoose from 'mongoose';
import type { Request } from 'express';
import { PickerIdempotencyRecord } from './picker.rider.models';
import { logger } from '../../utils/logger';

/**
 * `Idempotency-Key` support for the mutating rider actions where a retry after a
 * flaky mobile connection must not double-apply: order accept/complete, bulk
 * deliver/fail and cash deposits.
 *
 * The first successful call stores its response body; a replay with the same key
 * returns that stored body instead of re-running the handler.
 */

export function readIdempotencyKey(req: Request): string | null {
  const raw = req.headers['idempotency-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}

/**
 * Runs `handler` at most once per (picker, scope, key). Without a key the
 * handler simply runs, so clients that do not send one are unaffected.
 */
export async function withIdempotency<T>(
  pickerId: string,
  scope: string,
  key: string | null,
  handler: () => Promise<T>,
): Promise<{ result: T; replayed: boolean }> {
  if (!key) return { result: await handler(), replayed: false };

  const filter = { pickerId: new mongoose.Types.ObjectId(pickerId), scope, key };
  const existing = await PickerIdempotencyRecord.findOne(filter).lean();
  if (existing) return { result: existing.response as T, replayed: true };

  const result = await handler();

  try {
    await PickerIdempotencyRecord.create({ ...filter, response: result, statusCode: 200 });
  } catch (err) {
    // A concurrent duplicate won the race. The handler already ran, so return
    // its result rather than failing a request the client sees as successful.
    if ((err as { code?: number }).code !== 11000) {
      logger.warn('[PickerIdempotency] could not persist record', { scope, error: (err as Error).message });
    }
  }

  return { result, replayed: false };
}
