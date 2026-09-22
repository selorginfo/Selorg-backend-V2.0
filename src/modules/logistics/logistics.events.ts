import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { LogisticsMetric, type ILogisticsOrder, type OrderStatus } from './logistics.models';
import { logger } from '../../utils/logger';

/**
 * Process-local logistics event bus.
 *
 * RabbitMQ fan-out is intentionally not wired here — that needs an infra decision
 * (broker URL, exchanges, consumer ownership). Until then we:
 *   1. Emit in-process events for any local subscribers
 *   2. Persist a LogisticsMetric row so analytics/KPIs have durable data
 *
 * When RabbitMQ lands, publish the same envelope from `publishLogisticsEvent`.
 */
export const logisticsEvents = new EventEmitter();
logisticsEvents.setMaxListeners(50);

export interface LogisticsEventEnvelope {
  eventId: string;
  eventType: string;
  version: 1;
  timestamp: string;
  data: Record<string, unknown>;
}

function routingKeyForStatus(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    CREATED: 'order.created',
    DRIVER_ASSIGNED: 'order.driver_assigned',
    PICKED_UP: 'order.picked_up',
    IN_TRANSIT: 'order.in_transit',
    DELIVERED: 'order.delivered',
    CANCELLED: 'order.cancelled',
    FAILED: 'order.failed',
  };
  return map[status] || 'order.created';
}

function costPerKm(order: Partial<ILogisticsOrder>): number | undefined {
  const fare = Number(order.actualFare ?? order.estimatedFare);
  const distance = Number(order.distanceKm);
  if (!Number.isFinite(fare) || !Number.isFinite(distance) || distance <= 0) return undefined;
  return Math.round((fare / distance) * 100) / 100;
}

/** SLA breach heuristic: delivered after scheduledTime, or still open past scheduledTime + 4h. */
function slaBreached(order: Partial<ILogisticsOrder>, status: OrderStatus): boolean {
  if (!order.scheduledTime) return false;
  const deadline = new Date(order.scheduledTime).getTime() + 4 * 60 * 60 * 1000;
  if (status === 'DELIVERED' && order.deliveredAt) {
    return new Date(order.deliveredAt).getTime() > deadline;
  }
  if (status === 'CANCELLED' || status === 'FAILED') return false;
  return Date.now() > deadline;
}

export async function publishLogisticsEvent(
  order: Partial<ILogisticsOrder> & { _id?: unknown },
  status: OrderStatus,
  extra: Record<string, unknown> = {},
): Promise<LogisticsEventEnvelope> {
  const eventType = routingKeyForStatus(status);
  const envelope: LogisticsEventEnvelope = {
    eventId: uuidv4(),
    eventType,
    version: 1,
    timestamp: new Date().toISOString(),
    data: {
      logisticsOrderId: order._id ? String(order._id) : undefined,
      referenceId: order.referenceId,
      status,
      provider: order.provider,
      orderType: order.type,
      estimatedFare: order.estimatedFare,
      actualFare: order.actualFare,
      distanceKm: order.distanceKm,
      ...extra,
    },
  };

  logisticsEvents.emit(eventType, envelope);
  logisticsEvents.emit('logistics.*', envelope);

  try {
    await LogisticsMetric.create({
      eventId: envelope.eventId,
      eventType,
      logisticsOrderId: order._id || undefined,
      referenceId: order.referenceId,
      status,
      provider: order.provider,
      orderType: order.type,
      estimatedFare: order.estimatedFare,
      actualFare: order.actualFare,
      distanceKm: order.distanceKm,
      costPerKm: costPerKm(order),
      slaBreached: slaBreached(order, status),
      recordedAt: new Date(),
    });
  } catch (err) {
    logger.warn('[logistics] metric persist failed', { error: (err as Error).message, eventType });
  }

  // RabbitMQ remains opt-in via env flag so we never pretend a broker exists.
  if (process.env.LOGISTICS_RABBITMQ_URL) {
    logger.info('[logistics] LOGISTICS_RABBITMQ_URL is set but publisher is not implemented yet', {
      eventId: envelope.eventId,
      eventType,
    });
  } else {
    logger.debug('[logistics] status event recorded (in-process + metric)', {
      eventId: envelope.eventId,
      eventType,
      referenceId: order.referenceId,
      status,
    });
  }

  return envelope;
}
