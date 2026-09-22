"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, MapPin, Receipt, Star } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useOrders } from "@/context/OrdersContext";
import { decorateOrder, formatOrderRef } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { productDisplayName } from "@/lib/products";
import { orderService } from "@/services/orderService";
import { getSocket } from "@/services/socket";
import { downloadCustomerInvoiceHtml } from "@/lib/invoiceHtml";
import { Button } from "@/components/ui/Button";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { LiveTrackingMap } from "@/components/orders/LiveTrackingMap";
import { RiderCard } from "@/components/orders/RiderCard";
import { OrderDetailPageSkeleton } from "@/components/ui/page-skeletons";
import { useUI } from "@/context/UIContext";

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const loggedIn = useRequireAuth();
  const router = useRouter();
  const { showToast, openModal } = useUI();
  const {
    getOrder,
    fetchOrderById,
    orderDetailLoading,
    reorder,
    rateOrder,
    trackProgress,
    etaSecs,
    riderInfo,
    startTracking,
    resetTracking,
  } = useOrders();
  const order = getOrder(orderId);
  const decorated = order ? decorateOrder(order) : null;
  const trackLive = decorated?.status === "Out for delivery";
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  useEffect(() => {
    if (loggedIn) void fetchOrderById(orderId);
  }, [fetchOrderById, loggedIn, orderId]);

  // Live status via Socket.IO — the moment picker/rider transitions the order
  // we refetch instead of waiting for a poll cycle. Subscribes only while
  // the tab/screen is mounted.
  useEffect(() => {
    if (!loggedIn) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit("order:subscribe", orderId);
    const onStatus = () => {
      void fetchOrderById(orderId);
    };
    socket.on("order:status", onStatus);
    return () => {
      socket.emit("order:unsubscribe", orderId);
      socket.off("order:status", onStatus);
    };
  }, [loggedIn, orderId, fetchOrderById]);

  useEffect(() => {
    if (trackLive) startTracking(orderId);
    return () => resetTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackLive, orderId]);

  const downloadInvoice = async () => {
    setInvoiceLoading(true);
    try {
      const invoice = await orderService.getInvoice(orderId);
      downloadCustomerInvoiceHtml(invoice, {
        customerName: order?.addr.name,
        deliveryNote:
          decorated?.isDelivered
            ? "Delivered to customer address"
            : decorated?.cancelled
              ? "Order cancelled"
              : order?.status
                ? `Status: ${order.status}`
                : "Delivered to customer address",
      });
    } catch {
      showToast("Could not download invoice");
    } finally {
      setInvoiceLoading(false);
    }
  };

  const submitRating = async () => {
    if (rating < 1) {
      showToast("Please select a rating");
      return;
    }
    setRatingSubmitting(true);
    try {
      await rateOrder(orderId, rating, ratingComment || undefined);
      setRating(0);
      setRatingComment("");
    } catch {
      showToast("Could not submit rating");
    } finally {
      setRatingSubmitting(false);
    }
  };

  if (!loggedIn) return null;

  if (orderDetailLoading && !order) {
    return <OrderDetailPageSkeleton />;
  }

  if (!order || !decorated) {
    return (
      <div className="mx-auto flex max-w-[900px] flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-xl font-extrabold">Order not found</h1>
        <Link href="/orders">
          <Button>Back to orders</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap max-w-[1240px] pb-9 pt-[18px]">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] border border-line bg-white"
        >
          <ArrowLeft size={17} />
        </button>
        <div>
          <h1 className="font-sans text-2xl font-extrabold tracking-[-0.6px]">
            Order {formatOrderRef(order)}
          </h1>
          <div className="text-[12.5px] text-muted">Placed on {order.date}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 min-[1081px]:grid-cols-[minmax(0,1fr)_396px]">
        <div className="order-1 flex min-w-0 flex-col gap-3.5 min-[1081px]:sticky min-[1081px]:top-4 min-[1081px]:order-2">
          <div className="rounded-2xl border border-line bg-white p-[22px]">
            <div className="mb-5 flex items-center justify-between">
              <span
                className="rounded-[20px] px-3.5 py-[7px] text-[13px] font-extrabold"
                style={{ background: decorated.badgeBg, color: decorated.statusColor }}
              >
                {order.status}
              </span>
              {!decorated.cancelled ? (
                <span className="text-[13px] font-bold text-accent-dark">{order.eta}</span>
              ) : null}
            </div>

            {decorated.cancelled ? (
              <div className="rounded-xl border border-[#ffd9cf] bg-[#fff2ef] p-3.5 text-[13.5px] font-bold text-warn">
                This order was cancelled. Any amount paid will be refunded within 3–5 business days.
              </div>
            ) : (
              <OrderTimeline steps={decorated.timeline} />
            )}
          </div>

          {trackLive ? (
            <>
              <LiveTrackingMap
                progress={trackProgress}
                etaSecs={etaSecs}
                riderLat={riderInfo?.latitude}
                riderLng={riderInfo?.longitude}
              />
              <RiderCard rider={riderInfo} progress={trackProgress} />
            </>
          ) : null}

          {decorated.isDelivered ? (
            <div className="rounded-2xl border border-line bg-white p-[22px]">
              <h3 className="mb-3 text-sm font-extrabold">Rate your order</h3>
              <div className="mb-3 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={n <= rating ? "text-warn" : "text-line"}
                  >
                    <Star size={22} fill={n <= rating ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Optional feedback…"
                className="mb-3 w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-accent"
                rows={2}
              />
              <Button
                size="sm"
                disabled={ratingSubmitting || rating < 1}
                onClick={() => void submitRating()}
              >
                Submit rating
              </Button>
            </div>
          ) : null}
        </div>

        <div className="order-2 flex min-w-0 flex-col gap-3.5 min-[1081px]:order-1">
          <div className="rounded-2xl border border-line bg-white p-[22px]">
            <h2 className="mb-3.5 text-[15px] font-extrabold">Items ({order.items.length})</h2>
            <div className="flex flex-col">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                  <span
                    className="relative flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-[#f6f6f0] text-xl"
                    style={item.photo ? undefined : { background: item.bg }}
                  >
                    {item.photo ? (
                      <Image src={item.photo} alt={productDisplayName(item.name)} fill sizes="50px" className="object-cover" />
                    ) : (
                      item.emoji
                    )}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-bold">{productDisplayName(item.name)}</div>
                    <div className="text-xs text-muted">{item.variant} × {item.qty}</div>
                  </div>
                  <span className="text-sm font-extrabold">{formatMoney(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 min-[600px]:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="mb-3 flex items-center gap-[7px] text-sm font-extrabold">
                <MapPin size={15} className="text-accent-dark" /> Delivery address
              </h2>
              <p className="text-[13.5px] font-bold">{order.addr.name} · {order.addr.type}</p>
              <p className="mt-1 text-[13px] text-[#4a4d43]">
                {[order.addr.line, order.addr.area].filter(Boolean).join(", ")}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="mb-3 flex items-center gap-[7px] text-sm font-extrabold">
                <Receipt size={15} className="text-accent-dark" /> Bill details
              </h2>
              <Row label="Subtotal" value={formatMoney(order.sub)} />
              {order.discount > 0 ? (
                <Row label="Discount" value={`– ${formatMoney(order.discount)}`} emphasis />
              ) : null}
              <Row label="Delivery" value={order.delivery === 0 ? "FREE" : formatMoney(order.delivery)} emphasis />
              <Row label="Payment" value={order.payment} />
              <div className="my-2.5 border-t border-dashed border-line" />
              <div className="flex justify-between text-base font-extrabold">
                <span>Total</span>
                <span>{formatMoney(order.total)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => reorder(order.id)} className="flex-1">
              Reorder items
            </Button>
            <Button
              variant="outline"
              onClick={() => void downloadInvoice()}
              disabled={invoiceLoading}
              className="flex-1"
            >
              <Download size={16} className="mr-1.5 inline" />
              {invoiceLoading ? "Downloading…" : "Download invoice"}
            </Button>
            {decorated.canCancel ? (
              <Button
                variant="danger"
                onClick={() => openModal({ type: "cancelOrder", orderId: order.id })}
                className="flex-1"
              >
                Cancel order
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="mb-1.5 flex justify-between text-[13px]">
      <span className="text-muted">{label}</span>
      <span className={emphasis ? "font-bold text-accent-dark" : "font-semibold"}>{value}</span>
    </div>
  );
}
