/**
 * Canonical order fulfillment lifecycle for Selorg ops.
 *
 * Customer-facing `status` stays backward-compatible for apps.
 * Ops truth lives in `fulfillmentStage` and must change ONLY after the
 * responsible user action is persisted.
 */

import type { OrderStatus, OrderRiderStage } from './order.model';

export const FULFILLMENT_STAGES = [
  'pending',
  'confirmed', // waiting for eligible picker
  'picker_accepted',
  'packed_in_rack', // waiting for eligible rider
  'rider_accepted',
  'rider_picked',
  'delivered',
  'exception',
  'cancelled',
] as const;

export type FulfillmentStage = (typeof FULFILLMENT_STAGES)[number];

export const EXCEPTION_REASONS = [
  'FAILED',
  'ISSUE',
  'NOT_DELIVERED',
  'CUSTOMER_UNAVAILABLE',
  'PAYMENT_ISSUE',
  'PRODUCT_ISSUE',
  'PICKING_ISSUE',
  'RIDER_ISSUE',
  'DELIVERY_ISSUE',
  'OTHER',
] as const;

export type ExceptionReason = (typeof EXCEPTION_REASONS)[number];

/** Legal forward transitions. Cancel / exception can be entered from most active stages. */
export const FULFILLMENT_TRANSITIONS: Record<FulfillmentStage, FulfillmentStage[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['picker_accepted', 'cancelled', 'exception'],
  picker_accepted: ['packed_in_rack', 'cancelled', 'exception'],
  packed_in_rack: ['rider_accepted', 'cancelled', 'exception'],
  rider_accepted: ['rider_picked', 'packed_in_rack', 'cancelled', 'exception'], // packed_in_rack = rider reject / re-offer
  rider_picked: ['delivered', 'exception', 'cancelled'],
  delivered: [],
  exception: ['confirmed', 'picker_accepted', 'packed_in_rack', 'cancelled'],
  cancelled: [],
};

export function isFulfillmentStage(value: unknown): value is FulfillmentStage {
  return typeof value === 'string' && (FULFILLMENT_STAGES as readonly string[]).includes(value);
}

export function assertFulfillmentTransition(from: FulfillmentStage, to: FulfillmentStage): void {
  const allowed = FULFILLMENT_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    const err = new Error(`Cannot transition fulfillment from "${from}" to "${to}"`) as Error & {
      statusCode?: number;
      code?: string;
    };
    err.statusCode = 409;
    err.code = 'INVALID_FULFILLMENT_TRANSITION';
    throw err;
  }
}

/** Map ops stage → customer-visible status (apps already understand these). */
export function customerStatusForStage(stage: FulfillmentStage): OrderStatus {
  switch (stage) {
    case 'pending':
      return 'pending';
    case 'confirmed':
    case 'picker_accepted':
    case 'packed_in_rack':
    case 'rider_accepted':
      return stage === 'confirmed' ? 'confirmed' : 'getting-packed';
    case 'rider_picked':
      return 'on-the-way';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    case 'exception':
      return 'getting-packed'; // still open for ops; customer shows packing/issue via timeline
    default:
      return 'confirmed';
  }
}

export function riderStageForFulfillment(stage: FulfillmentStage): OrderRiderStage | null {
  switch (stage) {
    case 'packed_in_rack':
      return 'offered';
    case 'rider_accepted':
      return 'accepted';
    case 'rider_picked':
      return 'picked_up';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

/** A stored "delivered" row that never verified the delivery OTP is an exception, not a completed delivery. */
export function deliveryMissingOtp(order: {
  status?: string | null;
  riderStage?: string | null;
  fulfillmentStage?: string | null;
  otpVerified?: boolean | null;
}): boolean {
  const stored = isFulfillmentStage(order.fulfillmentStage) ? order.fulfillmentStage : null;
  const looksDelivered = stored === 'delivered' || order.status === 'delivered' || order.riderStage === 'delivered';
  return looksDelivered && order.otpVerified !== true;
}

/** Derive stage from legacy documents that pre-date fulfillmentStage. */
export function deriveFulfillmentStage(order: {
  status?: string | null;
  riderStage?: string | null;
  hhdUserId?: unknown;
  deliveryFailedAt?: Date | null;
  fulfillmentStage?: string | null;
  otpVerified?: boolean | null;
}): FulfillmentStage {
  if (deliveryMissingOtp(order)) return 'exception';
  if (order.otpVerified === true && (order.status === 'delivered' || order.riderStage === 'delivered' || order.fulfillmentStage === 'delivered')) {
    return 'delivered';
  }
  if (isFulfillmentStage(order.fulfillmentStage)) return order.fulfillmentStage;

  const status = String(order.status || '');
  const rider = String(order.riderStage || '');

  if (status === 'cancelled') return 'cancelled';
  if (order.deliveryFailedAt || status === 'exception') return 'exception';
  if (status === 'delivered' || rider === 'delivered') return 'delivered';
  if (status === 'on-the-way' || status === 'arrived' || rider === 'picked_up') return 'rider_picked';
  if (rider === 'accepted') return 'rider_accepted';
  if (rider === 'offered') return 'packed_in_rack';
  if (status === 'getting-packed' || order.hhdUserId) return 'picker_accepted';
  if (status === 'confirmed') return 'confirmed';
  if (status === 'pending') return 'pending';
  // Illegal legacy statuses (e.g. out_for_delivery) — treat as exception for ops visibility
  if (status && !['pending', 'confirmed', 'getting-packed', 'on-the-way', 'arrived', 'delivered', 'cancelled'].includes(status)) {
    return 'exception';
  }
  return 'confirmed';
}

export function adminLabelForStage(stage: FulfillmentStage): string {
  switch (stage) {
    case 'pending':
      return 'Placed';
    case 'confirmed':
      return 'Waiting for Picker';
    case 'picker_accepted':
      return 'Picker Accepted';
    case 'packed_in_rack':
      return 'Waiting for Rider';
    case 'rider_accepted':
      return 'Rider Accepted';
    case 'rider_picked':
      return 'Rider Picked';
    case 'delivered':
      return 'Delivered';
    case 'exception':
      return 'Exception';
    case 'cancelled':
      return 'Cancelled';
    default:
      return stage;
  }
}

export function adminStageIndex(stage: FulfillmentStage): number {
  switch (stage) {
    case 'pending':
      return 0;
    case 'confirmed':
      return 1;
    case 'picker_accepted':
      return 2;
    case 'packed_in_rack':
      return 6;
    case 'rider_accepted':
      return 7;
    case 'rider_picked':
      return 8;
    case 'delivered':
      return 10;
    case 'exception':
      return 0;
    case 'cancelled':
      return 0;
    default:
      return 1;
  }
}
