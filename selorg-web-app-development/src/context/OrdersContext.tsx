"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatOrderDate, isLiveTrackableOrder } from "@/lib/orders";
import { formatAddressArea, formatAddressLine } from "@/lib/formatAddress";
import type { OrderPaymentStatus } from "@/types";
import {
  TRACK_PROGRESS_CAP,
  TRACK_PROGRESS_STEP,
  TRACK_TICK_MS,
} from "@/lib/constants";
import { orderService } from "@/services/orderService";
import type { ApiOrder, OrderTrackingResult } from "@/services/orderService";
import { ApiError } from "@/services/api";
import { getToken, onAuthChange } from "@/services/session";
import type { Order } from "@/types";
import type { AddressType } from "@/types";
import { useAddresses } from "./AddressContext";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { useCheckout } from "./CheckoutContext";
import { useUI } from "./UIContext";
import { useWallet } from "./WalletContext";
import { useAccountReset } from "./AccountResetContext";

const STATUS_MAP: Record<string, { label: Order["status"]; index: number }> = {
  pending: { label: "Placed", index: 0 },
  confirmed: { label: "Confirmed", index: 1 },
  "getting-packed": { label: "Packed", index: 2 },
  "on-the-way": { label: "Out for delivery", index: 3 },
  arrived: { label: "Out for delivery", index: 3 },
  delivered: { label: "Delivered", index: 4 },
  cancelled: { label: "Cancelled", index: -1 },
};

function orderIdOf(raw: ApiOrder): string {
  return String(raw._id ?? raw.id ?? "");
}

/** `timeline[]` on the order detail response carries the real time each status
 *  was reached; index it by progress step so the rail can show it. */
function toStepTimes(raw: ApiOrder): Record<number, string> | undefined {
  const entries = raw.timeline ?? [];
  if (entries.length === 0) return undefined;
  const times: Record<number, string> = {};
  for (const entry of entries) {
    const step = STATUS_MAP[entry.status?.toLowerCase() ?? ""];
    if (step && step.index >= 0 && entry.timestamp) times[step.index] = entry.timestamp;
  }
  return Object.keys(times).length > 0 ? times : undefined;
}

function toStepNotes(raw: ApiOrder): Record<number, string> | undefined {
  const entries = raw.timeline ?? [];
  if (entries.length === 0) return undefined;
  const notes: Record<number, string> = {};
  for (const entry of entries) {
    const step = STATUS_MAP[entry.status?.toLowerCase() ?? ""];
    const note = String(entry.note || "").trim();
    if (step && step.index >= 0 && note) notes[step.index] = note;
  }
  return Object.keys(notes).length > 0 ? notes : undefined;
}

function toLocalOrder(raw: ApiOrder, profile: { name: string }): Order {
  const mapped = STATUS_MAP[raw.status?.toLowerCase()] ?? { label: "Placed" as const, index: 0 };
  const items = raw.items ?? [];
  const sub =
    raw.subtotal ??
    raw.itemTotal ??
    items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0);
  const addr = raw.deliveryAddress ?? raw.address;
  const etaMin = raw.deliveryTimeMinutes ?? raw.tracking?.etaMin;
  const eta =
    raw.estimatedDeliveryMessage ??
    raw.eta ??
    (etaMin != null ? `Arriving in ${etaMin} min` : "Processing");

  const paymentStatusRaw = (raw.paymentStatus ?? "").toLowerCase();
  const paymentStatus: OrderPaymentStatus | undefined =
    paymentStatusRaw === "paid" ||
    paymentStatusRaw === "cod_pending" ||
    paymentStatusRaw === "pending" ||
    paymentStatusRaw === "failed"
      ? paymentStatusRaw
      : undefined;

  return {
    id: orderIdOf(raw),
    orderNumber: raw.orderNumber || undefined,
    date: formatOrderDate(new Date(raw.createdAt ?? Date.now())),
    status: mapped.label,
    statusIndex: mapped.index,
    eta,
    delivery: raw.deliveryFee ?? 0,
    discount: raw.discount ?? 0,
    sub,
    total: raw.total ?? raw.totalBill ?? sub,
    payment:
      raw.paymentMethodDisplay ??
      raw.paymentMethod?.display ??
      raw.paymentMethodType ??
      "UPI",
    paymentStatus,
    addr: {
      type: (["Home", "Work", "Other"].includes(addr?.label ?? "")
        ? addr!.label
        : "Home") as AddressType,
      name: profile.name,
      line: formatAddressLine({
        line1: addr?.line1 || addr?.address || "",
        line2: addr?.line2 || "",
        landmark: addr?.landmark || "",
        city: addr?.city || "",
        state: addr?.state || "",
        pincode: addr?.pincode || "",
      }),
      area: formatAddressArea({
        line1: addr?.line1 || "",
        line2: addr?.line2 || "",
        landmark: addr?.landmark || "",
        city: addr?.city || "",
        state: addr?.state || "",
        pincode: addr?.pincode || "",
      }),
    },
    items: items.map((it) => ({
      name: it.productName ?? it.name ?? it.productId,
      emoji: "🛒",
      bg: "#f5f5f5",
      qty: it.quantity,
      variant: it.variantSize ?? it.variant ?? "1 unit",
      price: it.price ?? 0,
      photo: it.image ?? it.photo,
    })),
    stepTimes: toStepTimes(raw),
    stepNotes: toStepNotes(raw),
  };
}

export interface RiderInfo {
  name: string;
  phone?: string;
  rating?: number;
  vehicle?: string;
  initial: string;
  latitude?: number;
  longitude?: number;
}

interface OrdersContextValue {
  orders: Order[];
  activeOrder: Order | null;
  loading: boolean;
  orderDetailLoading: boolean;
  placeOrder: (options?: { clearCartOnSuccess?: boolean }) => Promise<string>;
  cancelOrder: (orderId: string, reason?: string) => Promise<void>;
  reorder: (orderId: string) => Promise<void>;
  rateOrder: (orderId: string, rating: number, comment?: string) => Promise<void>;
  getOrder: (orderId: string) => Order | undefined;
  fetchOrderById: (orderId: string) => Promise<Order | undefined>;
  trackProgress: number;
  etaSecs: number;
  riderInfo: RiderInfo | null;
  startTracking: (orderId: string) => void;
  resetTracking: () => void;
  refreshActiveOrder: () => Promise<void>;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { showToast } = useUI();
  const { lines, totals, clearCart, couponApplied, refreshFromServer } = useCart();
  const { addresses, selectedAddr } = useAddresses();
  const { profile } = useAuth();
  const { refreshWallet, clearWalletCheckoutFlag } = useWallet();
  const { paymentMethod } = useCheckout();
  const { resetToken } = useAccountReset();

  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [trackProgress, setTrackProgress] = useState(0.34);
  const [riderInfo, setRiderInfo] = useState<RiderInfo | null>(null);
  const etaSecs = Math.max(0, Math.round((1 - trackProgress) * 720));
  const trackTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackingOrderId = useRef<string | null>(null);
  const placeIdempotencyKeyRef = useRef<string | null>(null);
  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const [handledResetToken, setHandledResetToken] = useState(resetToken);
  if (resetToken !== handledResetToken) {
    setHandledResetToken(resetToken);
    setOrders([]);
  }

  const refreshActiveOrder = useCallback(async () => {
    if (!getToken()) {
      setActiveOrder(null);
      return;
    }
    try {
      const raw = await orderService.getActiveOrder();
      if (raw) {
        const order = toLocalOrder(raw, { name: profile.name });
        setActiveOrder(isLiveTrackableOrder(order) ? order : null);
      } else {
        setActiveOrder(null);
      }
    } catch {
      /* keep previous */
    }
  }, [profile.name]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!getToken()) {
        setOrders([]);
        setActiveOrder(null);
        return;
      }
      setLoading(true);
      try {
        const [raw, active] = await Promise.all([
          orderService.listOrders({ limit: 50 }),
          orderService.getActiveOrder(),
        ]);
        if (!cancelled) {
          setOrders(raw.map((o) => toLocalOrder(o, { name: profile.name })));
          const mappedActive = active ? toLocalOrder(active, { name: profile.name }) : null;
          setActiveOrder(mappedActive && isLiveTrackableOrder(mappedActive) ? mappedActive : null);
        }
      } catch {
        // keep whatever was shown
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const unsub = onAuthChange(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [profile.name]);

  const getOrder = useCallback(
    (orderId: string) => orders.find((o) => o.id === orderId),
    [orders],
  );

  const fetchOrderById = useCallback(
    async (orderId: string): Promise<Order | undefined> => {
      const cached = orders.find((o) => o.id === orderId);
      if (cached) return cached;
      if (!getToken()) return undefined;

      setOrderDetailLoading(true);
      try {
        const raw = await orderService.getOrderById(orderId);
        const order = toLocalOrder(raw, { name: profile.name });
        setOrders((prev) => {
          if (prev.some((o) => o.id === orderId)) {
            return prev.map((o) => (o.id === orderId ? order : o));
          }
          return [order, ...prev];
        });
        return order;
      } catch {
        return undefined;
      } finally {
        setOrderDetailLoading(false);
      }
    },
    [orders, profile.name],
  );

  const placeOrder = useCallback(
    async (options?: { clearCartOnSuccess?: boolean }): Promise<string> => {
      const clearCartOnSuccess = options?.clearCartOnSuccess ?? true;
      const address = addresses.find((a) => a.id === selectedAddr);

      const apiItems = lines.map((l) => ({
        productId: l.product.id,
        variantId: l.variant.variantId,
        quantity: l.qty,
      }));

      // Backend only applies Selorg Wallet when paymentMethodType is "wallet"/"selorg_wallet".
      // Partial wallet + online remainder is handled server-side (onlineAmountDue / requiresOnlinePayment).
      const useWalletPay = totals.walletUsed > 0;
      const payType = useWalletPay
        ? "wallet"
        : (
            { upi: "upi", card: "card", netbanking: "digital", cod: "cash" } as Record<
              string,
              string
            >
          )[paymentMethod] ?? "upi";

      if (getToken() && address && apiItems.length > 0) {
        if (!placeIdempotencyKeyRef.current) {
          placeIdempotencyKeyRef.current =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        }
        try {
          const raw = await orderService.createOrder(
            {
              items: apiItems,
              addressId: address.id,
              paymentMethodType: payType as "card" | "upi" | "cash" | "wallet" | "digital",
              couponCode: couponApplied?.code,
              customerName: profile.name || undefined,
            },
            { idempotencyKey: placeIdempotencyKeyRef.current },
          );
          placeIdempotencyKeyRef.current = null;
          const order = toLocalOrder(raw, { name: profile.name });
          if (!order.id) {
            throw new Error("Order was created but no order id was returned. Please check My Orders.");
          }
          setOrders((prev) => [order, ...prev]);
          // Unpaid gateway drafts stay off the home/header track widgets until payment settles.
          if (isLiveTrackableOrder(order)) {
            setActiveOrder(order);
          }
          if (useWalletPay) {
            // Server already debited the ledger — sync UI from GET /wallet/balance.
            clearWalletCheckoutFlag();
            void refreshWallet();
          }
          if (clearCartOnSuccess) clearCart();
          // Do not invent a fake TXN* id — gateway txn ids come from Paynimo
          // session/bridge; COD has no transaction id to show.
          return order.id;
        } catch (err) {
          // Keep idempotency key so a client retry cannot create a duplicate order.
          throw err;
        }
      }

      if (!getToken()) {
        throw new Error("Please sign in to place your order.");
      }

      throw new Error(
        address
          ? "Could not place your order. Please check your cart and try again."
          : "Please select a delivery address before placing your order.",
      );
    },
    [
      addresses,
      clearCart,
      clearWalletCheckoutFlag,
      couponApplied,
      lines,
      paymentMethod,
      profile.name,
      refreshWallet,
      selectedAddr,
      totals,
    ],
  );

  const cancelOrder = useCallback(
    async (orderId: string, reason?: string) => {
      const trimmed = reason?.trim();
      if (!trimmed) {
        showToast("Please select a reason to cancel");
        throw new Error("Please select a reason to cancel");
      }
      let snapshot: Order | undefined;
      setOrders((prev) => {
        snapshot = prev.find((o) => o.id === orderId);
        return prev.map((o) =>
          o.id === orderId ? { ...o, status: "Cancelled" as const, statusIndex: -1 } : o,
        );
      });
      setActiveOrder((prev) => (prev?.id === orderId ? null : prev));
      try {
        if (!getToken()) {
          throw new Error("Please sign in to cancel this order");
        }
        await orderService.cancelOrder(orderId, trimmed);
        showToast("Order cancelled");
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not cancel order";
        showToast(message);
        if (snapshot) {
          const restored = snapshot;
          setOrders((prev) => prev.map((o) => (o.id === orderId ? restored : o)));
          if (isLiveTrackableOrder(restored)) {
            setActiveOrder((prev) => prev ?? restored);
          }
        }
        void refreshActiveOrder();
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [refreshActiveOrder, showToast],
  );

  const reorder = useCallback(
    async (orderId: string) => {
      if (getToken()) {
        try {
          await orderService.reorder(orderId);
          await refreshFromServer();
          showToast("Items added to cart");
          return;
        } catch {
          showToast("Could not reorder items");
          return;
        }
      }
      showToast("Please sign in to reorder");
    },
    [refreshFromServer, showToast],
  );

  const clearTrackTimer = useCallback(() => {
    if (trackTimer.current) {
      clearInterval(trackTimer.current);
      trackTimer.current = null;
    }
  }, []);

  const rateOrder = useCallback(
    async (orderId: string, rating: number, comment?: string) => {
      if (!getToken()) {
        showToast("Please sign in to rate your order");
        return;
      }
      await orderService.rateOrder(orderId, rating, comment);
      await fetchOrderById(orderId);
      showToast("Thank you for your feedback!");
    },
    [fetchOrderById, showToast],
  );

  const pollTracking = useCallback(async (orderId: string) => {
    if (!getToken()) {
      return;
    }
    try {
      const tracking = await orderService.getTracking(orderId) as OrderTrackingResult;
      const statusKey = tracking.status?.toLowerCase() ?? "";
      const mapped = STATUS_MAP[statusKey];

      const partner = tracking.deliveryPartner;
      const loc = tracking.riderLocation;
      if (partner?.name) {
        setRiderInfo({
          name: partner.name,
          phone: partner.phone,
          rating: partner.rating,
          vehicle: partner.vehicle,
          initial: partner.initial ?? partner.name.charAt(0).toUpperCase(),
          latitude: loc?.latitude,
          longitude: loc?.longitude,
        });
      } else if (loc?.latitude != null && loc?.longitude != null) {
        setRiderInfo((prev) =>
          prev
            ? { ...prev, latitude: loc.latitude, longitude: loc.longitude }
            : null,
        );
      }

      if (mapped) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: mapped.label,
                  statusIndex: mapped.index,
                  eta:
                    tracking.deliveryTimeMinutes != null
                      ? `Arriving in ${tracking.deliveryTimeMinutes} min`
                      : o.eta,
                }
              : o,
          ),
        );
        setTrackProgress(Math.min(TRACK_PROGRESS_CAP, (mapped.index + 1) / 5));

        if (mapped.index >= 4 || mapped.index < 0) {
          clearTrackTimer();
        }
      }
    } catch {
      // Do not fabricate progress when the tracking API fails — keep last known state.
    }
  }, [clearTrackTimer]);

  const startTracking = useCallback(
    (orderId: string) => {
      trackingOrderId.current = orderId;
      setTrackProgress(0.06);
      setRiderInfo(null);
      clearTrackTimer();
      void pollTracking(orderId);
      trackTimer.current = setInterval(() => {
        // Intentional live tracking — pause while the tab is hidden so idle
        // background tabs do not hammer GET /orders/:id/tracking every tick.
        if (typeof document !== "undefined" && document.hidden) return;
        const order = ordersRef.current.find((o) => o.id === trackingOrderId.current);
        if (!order || order.statusIndex < 0 || order.statusIndex >= 4) return;
        void pollTracking(trackingOrderId.current!);
      }, TRACK_TICK_MS);
    },
    [clearTrackTimer, pollTracking],
  );

  const resetTracking = useCallback(() => {
    clearTrackTimer();
  }, [clearTrackTimer]);
  useEffect(() => clearTrackTimer, [clearTrackTimer]);

  return (
    <OrdersContext.Provider
      value={{
        orders,
        activeOrder,
        loading,
        orderDetailLoading,
        placeOrder,
        cancelOrder,
        reorder,
        rateOrder,
        getOrder,
        fetchOrderById,
        trackProgress,
        etaSecs,
        riderInfo,
        startTracking,
        resetTracking,
        refreshActiveOrder,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within an OrdersProvider");
  return ctx;
}
