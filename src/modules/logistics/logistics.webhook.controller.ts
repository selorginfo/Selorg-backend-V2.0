import type { Request, Response, NextFunction } from 'express';
import { WebhookEvent } from './logistics.models';
import { createPorterAdapter } from './porter.adapter';
import { applyWebhookStatusUpdate } from './logistics.service';
import { mapPorterStatus } from './porter.adapter';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';

/**
 * Safely reads the raw body (Buffer) or falls back to re-serialising req.body.
 */
function getRawBuffer(req: Request): Buffer {
  const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (raw && Buffer.isBuffer(raw)) return raw;
  return Buffer.from(JSON.stringify(req.body || {}), 'utf8');
}

/**
 * Parses the incoming payload, preferring the raw body for JSON fidelity.
 */
function parsePayload(req: Request): Record<string, unknown> {
  const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (raw && Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString('utf8'));
    } catch {
      return {};
    }
  }
  return (req.body as Record<string, unknown>) || {};
}

/**
 * POST /webhooks/porter
 *
 * 1. Verifies the HMAC signature (rejects with 401 on failure).
 * 2. Persists the raw event to WebhookEvent for auditability.
 * 3. Synchronously applies the status update to the matching LogisticsOrder
 *    (which records an in-process event + LogisticsMetric; RabbitMQ stays opt-in).
 * 4. Acknowledges with 200 immediately so Porter doesn't retry.
 */
export async function ingestPorter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adapter = createPorterAdapter();
    const buf = getRawBuffer(req);
    const sig =
      (req.headers['x-porter-signature'] as string) ||
      (req.headers['x-logistics-signature'] as string) ||
      (req.headers['x-signature'] as string) ||
      '';

    // Signature verification — only enforced when a secret is configured
    const hmacSecret = process.env.PORTER_HMAC_SECRET || '';
    if (hmacSecret && !adapter.verifyWebhookSignature(buf, sig)) {
      throw new AppError('Invalid webhook signature', 401, 'WEBHOOK_SIGNATURE_INVALID');
    }

    const payload = parsePayload(req);

    // Persist event for audit trail
    const doc = await WebhookEvent.create({
      provider: 'PORTER',
      payload,
      signature: String(sig).slice(0, 512),
      processed: false,
    });

    // Synchronously process the status update
    const providerOrderId =
      (payload.order_id as string) ||
      (payload.id as string) ||
      ((payload.data as Record<string, unknown>)?.order_id as string) ||
      '';

    const rawStatus =
      (payload.status as string) ||
      (payload.order_status as string) ||
      ((payload.data as Record<string, unknown>)?.status as string) ||
      '';

    if (providerOrderId && rawStatus) {
      const nextStatus = mapPorterStatus(rawStatus);
      const driver = (payload.driver || payload.driver_details) as
        | {
            name?: string;
            phone?: string;
            vehicleNumber?: string;
            vehicle_number?: string;
            vehicleType?: string;
            vehicle_type?: string;
          }
        | undefined;

      const loc = (payload.location || payload.driver_location) as
        | { lat?: number; lng?: number }
        | undefined;

      const result = await applyWebhookStatusUpdate({
        providerOrderId,
        nextStatus: nextStatus as Parameters<typeof applyWebhookStatusUpdate>[0]['nextStatus'],
        driver,
        location: loc,
      });

      if (result.ok) {
        await WebhookEvent.findByIdAndUpdate(doc._id, { $set: { processed: true } });
      } else {
        await WebhookEvent.findByIdAndUpdate(doc._id, {
          $set: { processingError: result.reason || 'Unknown' },
        });
        logger.warn('[webhook] porter status update skipped', {
          reason: result.reason,
          providerOrderId,
          nextStatus,
        });
      }
    } else {
      logger.warn('[webhook] porter payload missing order_id or status', {
        webhookEventId: doc._id,
      });
    }

    res.status(200).json({ success: true, received: true });
  } catch (err) {
    next(err);
  }
}
