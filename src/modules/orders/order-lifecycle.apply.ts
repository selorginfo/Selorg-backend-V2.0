import mongoose from 'mongoose';
import { Order, type IOrder } from './order.model';
import {
  assertFulfillmentTransition,
  customerStatusForStage,
  deriveFulfillmentStage,
  isFulfillmentStage,
  riderStageForFulfillment,
  type FulfillmentStage,
  type ExceptionReason,
} from './order-lifecycle';
import { emitOrderStatus } from '../../services/realtime.service';
import { eventBus } from '../../events/eventBus';
import { EVENT_TYPES } from '../../events/eventTypes';

const DEFAULT_HUB_KEY = process.env.DASHBOARD_HUB_KEY || 'DS-Adyar-01';

const STAGE_TO_EVENT: Partial<Record<FulfillmentStage, string>> = {
  confirmed: EVENT_TYPES.ORDER_CONFIRMED,
  picker_accepted: EVENT_TYPES.ORDER_PICKING_STARTED,
  packed_in_rack: EVENT_TYPES.ORDER_PICKING_STARTED,
  rider_picked: EVENT_TYPES.ORDER_OUT_FOR_DELIVERY,
  delivered: EVENT_TYPES.ORDER_DELIVERED,
  cancelled: EVENT_TYPES.ORDER_CANCELLED,
};

export interface ApplyFulfillmentInput {
  orderId: string;
  to: FulfillmentStage;
  actor: string;
  actorUserId?: string;
  note?: string;
  /** Extra $set fields applied with the stage write */
  set?: Record<string, unknown>;
  /** Extra $unset fields */
  unset?: Record<string, unknown>;
  exceptionReason?: ExceptionReason;
  exceptionNote?: string;
  /** Skip transition check (repair / idempotent same-stage only). Prefer not to use. */
  force?: boolean;
  /** Require current stage to be one of these before applying. */
  requireFrom?: FulfillmentStage[];
}

export async function applyFulfillmentTransition(input: ApplyFulfillmentInput): Promise<IOrder> {
  const order = await Order.findById(input.orderId);
  if (!order) {
    const err = new Error('Order not found') as Error & { statusCode?: number; code?: string };
    err.statusCode = 404;
    err.code = 'ORDER_NOT_FOUND';
    throw err;
  }

  const from = deriveFulfillmentStage(order);
  if (from === input.to && !input.force) {
    // Idempotent: already there. Still merge optional fields if provided.
    if (input.set && Object.keys(input.set).length) {
      await Order.updateOne({ _id: order._id }, { $set: input.set });
      const refreshed = await Order.findById(order._id);
      if (!refreshed) throw new Error('Order not found after update');
      return refreshed;
    }
    return order;
  }

  if (input.requireFrom?.length && !input.requireFrom.includes(from)) {
    const err = new Error(`Order is at "${from}", expected one of: ${input.requireFrom.join(', ')}`) as Error & {
      statusCode?: number;
      code?: string;
    };
    err.statusCode = 409;
    err.code = 'WRONG_FULFILLMENT_STAGE';
    throw err;
  }

  if (!input.force) {
    assertFulfillmentTransition(from, input.to);
  }

  const customerStatus = customerStatusForStage(input.to);
  const riderStage = riderStageForFulfillment(input.to);
  const now = new Date();

  const $set: Record<string, unknown> = {
    fulfillmentStage: input.to,
    status: customerStatus,
    ...(input.set || {}),
  };

  if (riderStage !== undefined) {
    // packed_in_rack → offered; confirmed/picker_accepted → clear rider stage
    if (input.to === 'confirmed' || input.to === 'picker_accepted' || input.to === 'pending') {
      $set.riderStage = null;
    } else if (riderStage !== null) {
      $set.riderStage = riderStage;
    }
  }

  if (input.to === 'exception') {
    if (input.exceptionReason) $set.exceptionReason = input.exceptionReason;
    if (input.exceptionNote != null) $set.exceptionNote = input.exceptionNote;
    $set.deliveryFailedAt = now;
  }
  if (input.to === 'cancelled') {
    $set.cancellationReason = input.note || input.exceptionNote || 'Order cancelled';
    $set.riderStage = 'cancelled';
  }
  if (input.to === 'delivered') {
    if (order.otpVerified !== true && input.set?.otpVerified !== true) {
      const err = new Error('Delivery OTP must be verified before the order can be marked delivered') as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 409;
      err.code = 'OTP_REQUIRED';
      throw err;
    }
    $set.deliveredAt = now;
    $set.otpVerified = true;
  }
  if (input.to === 'picker_accepted' && !$set.pickerAcceptedAt) {
    $set.pickerAcceptedAt = now;
  }
  if (input.to === 'packed_in_rack' && !$set.rackedAt) {
    $set.rackedAt = now;
  }
  if (input.to === 'rider_picked' && !$set.pickedUpAt) {
    $set.pickedUpAt = now;
  }
  if (input.to === 'rider_accepted') {
    if (!$set.acceptedAt) $set.acceptedAt = now;
    if (!$set.assignedAt) $set.assignedAt = now;
  }

  const timelineStatus =
    input.to === 'rider_accepted'
      ? 'accepted'
      : input.to === 'rider_picked'
        ? 'on-the-way'
        : input.to === 'exception'
          ? 'delivery_failed'
          : input.to === 'picker_accepted' || input.to === 'packed_in_rack'
            ? 'getting-packed'
            : customerStatus;

  const update: Record<string, unknown> = {
    $set,
    $push: {
      timeline: {
        status: timelineStatus,
        timestamp: now,
        note: input.note || `Fulfillment → ${input.to}`,
        actor: input.actor,
        userId: input.actorUserId || '',
      },
    },
  };
  if (input.unset && Object.keys(input.unset).length) {
    update.$unset = input.unset;
  }

  const storedStage = isFulfillmentStage(order.fulfillmentStage) ? order.fulfillmentStage : null;
  const filter: Record<string, unknown> = { _id: order._id };
  if (storedStage) {
    filter.fulfillmentStage = storedStage;
  } else {
    filter.$or = [{ fulfillmentStage: { $exists: false } }, { fulfillmentStage: null }];
    if (order.status) filter.status = order.status;
  }

  const updated = await Order.findOneAndUpdate(filter, update, { new: true });
  if (!updated) {
    const err = new Error('Order changed while updating. Refresh and try again.') as Error & { statusCode?: number; code?: string };
    err.statusCode = 409;
    err.code = 'FULFILLMENT_CONFLICT';
    throw err;
  }

  emitOrderStatus(String(updated._id), {
    status: updated.status,
    fulfillmentStage: updated.fulfillmentStage,
    orderNumber: updated.orderNumber,
    note: input.note || '',
    actor: input.actor,
  });

  const eventType = STAGE_TO_EVENT[input.to];
  if (eventType) {
    eventBus.emit(eventType, {
      orderId: String(updated._id),
      orderNumber: updated.orderNumber,
      userId: String(updated.userId),
      hubKey: updated.offerHubKey || DEFAULT_HUB_KEY,
      offerHubKey: updated.offerHubKey || DEFAULT_HUB_KEY,
      status: updated.status,
      fulfillmentStage: updated.fulfillmentStage,
      riderId: updated.riderId ? String(updated.riderId) : undefined,
    });
  }

  return updated;
}

/** Backfill fulfillmentStage on read paths without a write when already set. */
export function ensureStageOnDoc(order: IOrder | Record<string, unknown>): FulfillmentStage {
  const stage = deriveFulfillmentStage(order as Parameters<typeof deriveFulfillmentStage>[0]);
  if (!isFulfillmentStage((order as { fulfillmentStage?: string }).fulfillmentStage)) {
    (order as { fulfillmentStage?: string }).fulfillmentStage = stage;
  }
  return stage;
}

export async function backfillFulfillmentStage(orderId: string): Promise<FulfillmentStage | null> {
  if (!mongoose.Types.ObjectId.isValid(orderId)) return null;
  const order = await Order.findById(orderId);
  if (!order) return null;
  const stage = deriveFulfillmentStage(order);
  if (order.fulfillmentStage !== stage) {
    await Order.updateOne({ _id: order._id }, { $set: { fulfillmentStage: stage } });
  }
  return stage;
}
