import type { Address } from "./address";

export type OrderStatusLabel =
  | "Placed"
  | "Confirmed"
  | "Packed"
  | "Out for delivery"
  | "Delivered"
  | "Cancelled";

export interface OrderItem {
  name: string;
  emoji: string;
  bg: string;
  qty: number;
  variant: string;
  price: number;
  /** Present for orders placed from the live catalog; seed/demo orders fall back to `emoji`. */
  photo?: string;
}

export type OrderPaymentStatus = "paid" | "cod_pending" | "pending" | "failed";

export interface Order {
  id: string;
  /** Human-facing order number from API when available (e.g. SEL18031884). */
  orderNumber?: string;
  date: string;
  status: OrderStatusLabel;
  statusIndex: number;
  eta: string;
  delivery: number;
  discount: number;
  sub: number;
  total: number;
  payment: string;
  /** From API — unpaid gateway drafts must not drive home/track widgets. */
  paymentStatus?: OrderPaymentStatus;
  walletUsed?: number;
  /** `name` is the recipient's name from their profile at order time — addresses
   *  themselves don't carry a per-address contact name/phone in selorg-service. */
  addr: Pick<Address, "type" | "line" | "area"> & { name: string };
  items: OrderItem[];
  /** ISO timestamp per progress step, taken from the order's `timeline[]`.
   *  Sparse — only steps the order has actually reached are present. */
  stepTimes?: Record<number, string>;
  /** Optional note per progress step from API `timeline[].note`. */
  stepNotes?: Record<number, string>;
}

export interface OrderTimelineStep {
  label: OrderStatusLabel;
  done: boolean;
  active: boolean;
  /** Real time this step happened, when the backend recorded one. */
  at?: string;
  /** Backend note for this step (e.g. "Order confirmed by store"). */
  note?: string;
}

export interface DecoratedOrder extends Order {
  cancelled: boolean;
  isDelivered: boolean;
  canCancel: boolean;
  statusColor: string;
  /** Pill background paired with statusColor, matching the design source. */
  badgeBg: string;
  timeline: OrderTimelineStep[];
}
