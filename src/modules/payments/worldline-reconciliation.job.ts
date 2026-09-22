import { WorldlinePayment } from './worldline-payment.model';
import { Order } from '../orders/order.model';
import { voidUnpaidOnlineOrder } from '../orders/orders.service';
import { logger } from '../../utils/logger';
import { isEnabled } from './worldline.service';

/**
 * Ported from legacy `customer-backend/jobs/worldlineReconciliationJob.js`. Sweeps stale
 * non-terminal WorldlinePayment attempts and votes/times them out. Legacy exposed `start()`
 * to self-schedule via `setInterval` — that scheduling is an ops/deployment concern (this repo
 * has no cron/worker process yet), so only the sweep logic (`runOnce`) is ported here. Wire it
 * to a scheduler (cron, ECS scheduled task, etc.) when one exists for selorg-service.
 */
export async function runOnce(): Promise<void> {
  if (!isEnabled()) return;

  const staleAfterMinutes = parseInt(process.env.WORLDLINE_RECONCILE_STALE_MINUTES || '15', 10);
  const cutoff = new Date(Date.now() - staleAfterMinutes * 60 * 1000);

  try {
    const candidates = await WorldlinePayment.find({
      status: { $in: ['created', 'initiated', 'pending', 'unknown'] },
      updatedAt: { $lte: cutoff },
    })
      .sort({ updatedAt: 1 })
      .limit(100)
      .lean();

    if (candidates.length === 0) return;

    for (const p of candidates) {
      const timeSinceUpdateMs = Date.now() - new Date((p as unknown as { updatedAt: Date }).updatedAt).getTime();
      const isExtremelyStale = timeSinceUpdateMs > 24 * 60 * 60 * 1000;
      const sessionExpired = p.sessionExpiresAt && new Date(p.sessionExpiresAt).getTime() < Date.now();
      const abandonedBeforeGateway = (p.status === 'created' || p.status === 'initiated') && sessionExpired;

      const update: Record<string, unknown> = {
        status: 'unknown',
        statusMessage: 'Reconciliation: stale pending payment',
        verificationSource: 'reconciliation',
      };

      if (abandonedBeforeGateway) {
        update.status = 'failed';
        update.statusMessage = 'Payment session expired without completion';
      } else if (isExtremelyStale) {
        update.status = 'failed';
        update.statusMessage = 'Reconciliation: timed out after 24h';
      }

      await WorldlinePayment.updateOne({ _id: p._id, status: p.status }, { $set: update });

      const latestAttempt = await WorldlinePayment.findOne({ orderId: p.orderId }).sort({ attemptNo: -1 });
      if (latestAttempt && String(latestAttempt._id) === String(p._id)) {
        const orderForGuard = await Order.findById(p.orderId).select('paymentMethod').lean();
        const methodType = (orderForGuard as unknown as { paymentMethod?: { methodType?: string } } | null)?.paymentMethod?.methodType;
        if (orderForGuard && methodType !== 'card' && methodType !== 'upi' && methodType !== 'digital') {
          logger.warn('[worldlineReconciliationJob] skipped non-gateway order with payment row', { orderId: String(p.orderId), methodType });
          continue;
        }
        if (update.status === 'failed') {
          const o = await Order.findById(p.orderId).lean();
          const oRec = o as unknown as { _id: unknown; userId: unknown; fulfillmentReleased?: boolean; paymentStatus?: string } | null;
          if (oRec && oRec.fulfillmentReleased === false && oRec.paymentStatus !== 'paid') {
            try {
              await voidUnpaidOnlineOrder(String(oRec.userId), String(oRec._id), String(update.statusMessage) || 'Payment timed out', 'timeout');
            } catch (e) {
              logger.warn('[worldlineReconciliationJob] voidUnpaidOnlineOrder failed', { orderId: String(p.orderId), error: (e as Error)?.message });
            }
          } else if (oRec && oRec.paymentStatus !== 'paid') {
            await Order.updateOne({ _id: p.orderId }, { $set: { paymentStatus: 'failed' } });
          }
        } else {
          await Order.updateOne({ _id: p.orderId, paymentStatus: { $ne: 'paid' } }, { $set: { paymentStatus: 'pending' } });
        }
      }
    }

    logger.warn('[worldlineReconciliationJob] marked stale payments as unknown', { count: candidates.length, staleAfterMinutes });
  } catch (err) {
    logger.error('[worldlineReconciliationJob] run failed', { error: (err as Error)?.message });
  }
}
