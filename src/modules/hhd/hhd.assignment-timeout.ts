/**
 * Server-authoritative 20-minute HSD picker assignment timeout.
 * Releases stale assignments and auto-assigns the next eligible operator.
 */
import mongoose from 'mongoose';
import { HHDOrder, HHDItem, HHDPhoto } from './hhd.models';
import { ORDER_STATUS, ITEM_STATUS, OrderStatus } from './hhd.constants';
import { HHD_PICKER_ASSIGNMENT_TIMEOUT_MS } from './hhd.assignment-config';
import { findNextEligibleHhdOperator } from './hhd.eligibility';
import { claimHhdOrder } from './hhd.claim';
import { Order } from '../orders/order.model';
import { eventBus } from '../../events/eventBus';
import { EVENT_TYPES } from '../../events/eventTypes';
import { logger } from '../../utils/logger';
import { orderRealtime } from '../../realtime/orderRealtime';
import { DEFAULT_HUB_KEY } from '../orders/fulfillment.service';

export { HHD_PICKER_ASSIGNMENT_TIMEOUT_MS } from './hhd.assignment-config';

const INCOMPLETE_STATUSES: OrderStatus[] = [
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.BAG_SCANNED,
  ORDER_STATUS.PICKING,
  ORDER_STATUS.PHOTO_VERIFIED,
];

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;

async function resetPickProgress(orderId: string): Promise<void> {
  await HHDItem.updateMany(
    { orderId },
    { $set: { status: ITEM_STATUS.PENDING, scannedQuantity: 0 } },
  ).catch(() => undefined);
  await HHDPhoto.deleteMany({ orderId }).catch(() => undefined);
}

/** Full release + optional auto-reassign for one HHD ticket. */
export async function processExpiredHhdAssignment(doc: {
  orderId: string;
  userId?: mongoose.Types.ObjectId | null;
  hubKey?: string | null;
  assignedAt?: Date | null;
  assignmentGeneration?: number;
}): Promise<'released' | 'reassigned' | 'skipped'> {
  const cutoff = new Date(Date.now() - HHD_PICKER_ASSIGNMENT_TIMEOUT_MS);
  if (!doc.assignedAt || doc.assignedAt > cutoff || !doc.userId) {
    return 'skipped';
  }

  const previousUserId = String(doc.userId);
  const hubKey = String(doc.hubKey || DEFAULT_HUB_KEY);
  const priorGeneration = Number(doc.assignmentGeneration || 0);

  const released = await HHDOrder.findOneAndUpdate(
    {
      orderId: doc.orderId,
      userId: doc.userId,
      status: { $in: INCOMPLETE_STATUSES },
      assignedAt: { $lte: cutoff },
      $or: [{ assignmentGeneration: priorGeneration }, { assignmentGeneration: { $exists: false } }],
    },
    {
      $set: {
        userId: null,
        status: ORDER_STATUS.PENDING,
        assignedAt: null,
      },
      $unset: {
        startedAt: 1,
        bagId: 1,
        rackLocation: 1,
        targetRackCode: 1,
        targetRiderId: 1,
        targetRiderName: 1,
        riderId: 1,
        riderName: 1,
      },
      $inc: { assignmentGeneration: 1 },
    },
    { new: true },
  );

  if (!released) {
    // Concurrent completion or already released — do not reassign.
    return 'skipped';
  }

  await resetPickProgress(doc.orderId);

  // Revert customer order packing assignee when still in picker_accepted.
  await Order.updateOne(
    {
      orderNumber: doc.orderId,
      fulfillmentStage: 'picker_accepted',
      hhdUserId: doc.userId,
    },
    {
      $set: {
        fulfillmentStage: 'confirmed',
        status: 'confirmed',
        hhdUserId: null,
        'adminFulfillment.pickerName': null,
        'adminFulfillment.riderName': null,
      },
    },
  ).catch(() => undefined);

  const payload = {
    orderId: doc.orderId,
    orderNumber: doc.orderId,
    hubKey,
    offerHubKey: hubKey,
    previousHhdUserId: previousUserId,
    status: ORDER_STATUS.PENDING,
    reason: 'PICKER_ASSIGNMENT_TIMEOUT',
  };

  orderRealtime.notifyHhdUser(previousUserId, 'order:reassigned', payload);
  eventBus.emit(EVENT_TYPES.ORDER_CONFIRMED, payload);
  orderRealtime.notifyHhdHub(hubKey, 'order:available', payload);
  orderRealtime.notifyHhdHub(hubKey, 'assignorder:assigned', payload);

  const nextUserId = await findNextEligibleHhdOperator(hubKey, previousUserId);
  if (!nextUserId) {
    logger.info('[hhd-timeout] released to pool (no eligible picker)', {
      orderId: doc.orderId,
      previousUserId,
    });
    return 'released';
  }

  try {
    await claimHhdOrder(nextUserId, doc.orderId);
    orderRealtime.notifyHhdUser(nextUserId, 'order:assigned', {
      ...payload,
      hhdUserId: nextUserId,
      status: ORDER_STATUS.RECEIVED,
    });
    logger.info('[hhd-timeout] auto-reassigned', {
      orderId: doc.orderId,
      from: previousUserId,
      to: nextUserId,
    });
    return 'reassigned';
  } catch (err) {
    logger.warn('[hhd-timeout] auto-claim failed; left in pool', {
      orderId: doc.orderId,
      nextUserId,
      error: (err as Error).message,
    });
    return 'released';
  }
}

export async function sweepExpiredHhdAssignments(): Promise<{
  scanned: number;
  released: number;
  reassigned: number;
  skipped: number;
}> {
  const cutoff = new Date(Date.now() - HHD_PICKER_ASSIGNMENT_TIMEOUT_MS);
  const expired = await HHDOrder.find({
    status: { $in: INCOMPLETE_STATUSES },
    userId: { $ne: null },
    assignedAt: { $lte: cutoff },
  })
    .select('orderId userId hubKey assignedAt assignmentGeneration')
    .limit(40)
    .lean();

  let released = 0;
  let reassigned = 0;
  let skipped = 0;

  for (const row of expired) {
    const result = await processExpiredHhdAssignment(row as never);
    if (result === 'reassigned') reassigned += 1;
    else if (result === 'released') released += 1;
    else skipped += 1;
  }

  return { scanned: expired.length, released, reassigned, skipped };
}

export function startHhdAssignmentTimeoutJob(): void {
  if (intervalHandle || process.env.HHD_PICKER_TIMEOUT_JOB === '0') return;

  const tickMs = Math.max(
    15_000,
    Number(process.env.HHD_PICKER_TIMEOUT_TICK_MS || 30_000) || 30_000,
  );

  const tick = async () => {
    if (tickInFlight) return;
    tickInFlight = true;
    try {
      const stats = await sweepExpiredHhdAssignments();
      if (stats.scanned > 0) {
        logger.info('[hhd-timeout] sweep', stats);
      }
    } catch (err) {
      logger.warn('[hhd-timeout] sweep failed', { error: (err as Error).message });
    } finally {
      tickInFlight = false;
    }
  };

  intervalHandle = setInterval(() => {
    void tick();
  }, tickMs);
  if (typeof (intervalHandle as { unref?: () => void }).unref === 'function') {
    (intervalHandle as { unref: () => void }).unref();
  }

  logger.info('[hhd-timeout] job started', {
    timeoutMs: HHD_PICKER_ASSIGNMENT_TIMEOUT_MS,
    tickMs,
  });
}

export function stopHhdAssignmentTimeoutJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
