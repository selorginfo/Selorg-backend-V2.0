import type { DecoratedOrder, Order, OrderTimelineStep } from "@/types";
import { ORDER_STATUS_STEPS } from "./constants";

/** True once checkout is settled (online/wallet paid or COD accepted) and still in flight. */
export function isLiveTrackableOrder(
  order: Pick<Order, "status" | "paymentStatus">,
): boolean {
  if (order.status === "Cancelled" || order.status === "Delivered") return false;
  const pay = (order.paymentStatus ?? "").toLowerCase();
  return pay === "paid" || pay === "cod_pending";
}

/** Human-facing order reference for UI (never the Mongo ObjectId when orderNumber exists). */
export function formatOrderRef(order: Pick<Order, "id" | "orderNumber">): string {
  const ref = String(order.orderNumber || order.id || "").trim();
  if (!ref) return "";
  return ref.startsWith("#") ? ref : `#${ref}`;
}

export function decorateOrder(order: Order): DecoratedOrder {
  const cancelled = order.status === "Cancelled";
  const isDelivered = order.status === "Delivered";
  const statusColor = cancelled ? "#e4572e" : isDelivered ? "#5E8C3A" : "#c98a3a";
  const badgeBg = cancelled ? "#fff2ef" : isDelivered ? "#eef4e6" : "#fbf1e0";
  const canCancel = order.statusIndex >= 0 && order.statusIndex < 3 && !cancelled;

  const timeline: OrderTimelineStep[] = ORDER_STATUS_STEPS.map((label, i) => ({
    label,
    done: !cancelled && i <= order.statusIndex,
    active: !cancelled && i === order.statusIndex,
    at: order.stepTimes?.[i],
    note: order.stepNotes?.[i],
  }));

  return {
    ...order,
    cancelled,
    isDelivered,
    canCancel,
    statusColor,
    badgeBg,
    timeline,
  };
}

export function generateOrderId(): string {
  return `SEL${String(Date.now()).slice(-8)}`;
}

export function generateTxnId(): string {
  return `TXN${String(Date.now()).slice(-10)}`;
}

export function formatOrderDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
