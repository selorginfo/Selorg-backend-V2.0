export const EVENT_TYPES = Object.freeze({
  ORDER_CREATED: 'order.created',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_PICKED: 'order.picked',
  ORDER_PICKING_STARTED: 'order.picking_started',
  ORDER_HHD_SCANNED: 'order.hhd_scanned',
  ORDER_HANDED_OVER: 'order.handed_over',
  ORDER_RIDER_ACCEPTED: 'order.rider_accepted',
  ORDER_OUT_FOR_DELIVERY: 'order.out_for_delivery',
  ORDER_DISPATCHED: 'order.dispatched',
  ORDER_DELIVERED: 'order.delivered',
  INVENTORY_UPDATED: 'inventory.updated',
  INVENTORY_LOW_STOCK: 'inventory.low_stock',
  DELIVERY_ASSIGNED: 'delivery.assigned',
  DELIVERY_COMPLETED: 'delivery.completed',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
} as const);

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
