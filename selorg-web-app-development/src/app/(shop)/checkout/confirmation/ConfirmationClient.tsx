"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderResultCard } from "@/components/checkout/OrderResultCard";
import { OrderResultPageSkeleton } from "@/components/ui/page-skeletons";
import { useCart } from "@/context/CartContext";
import { useCheckout } from "@/context/CheckoutContext";
import { useOrders } from "@/context/OrdersContext";
import { paymentService } from "@/services/paymentService";

export function ConfirmationClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");
  const txnFromUrl = searchParams.get("txnId");
  const { getOrder, fetchOrderById, orderDetailLoading } = useOrders();
  const { payTxn, setPayTxn, pendingGatewayTxnId } = useCheckout();
  const { clearCart } = useCart();
  const order = orderId ? getOrder(orderId) : undefined;
  const [remoteMiss, setRemoteMiss] = useState(false);
  const [fetchedTxn, setFetchedTxn] = useState<string | undefined>();

  const resolvedTxnId =
    txnFromUrl || payTxn || pendingGatewayTxnId || fetchedTxn || undefined;

  useEffect(() => {
    if (!orderId) {
      router.replace("/");
      return;
    }
    if (order) return;

    let cancelled = false;
    void (async () => {
      const fetched = await fetchOrderById(orderId);
      if (cancelled) return;
      if (!fetched) {
        // Synthetic wallet top-up ids have no CustomerOrder — bounce to wallet.
        try {
          const status = await paymentService.getPaymentStatus(orderId);
          if (status.purpose === "wallet_topup") {
            const q = new URLSearchParams({
              paynimo_bridge: "1",
              purpose: "wallet_topup",
              orderId,
              status: status.walletCredited ? "success" : "failed",
            });
            if (status.latestPayment?.txnId) q.set("txnId", status.latestPayment.txnId);
            router.replace(`/account/wallet?${q.toString()}`);
            return;
          }
        } catch {
          /* fall through */
        }
        setRemoteMiss(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, order, fetchOrderById, router]);

  // Prefer real gateway txn ids (URL / session / status API) — never invent TXN*.
  useEffect(() => {
    if (txnFromUrl && txnFromUrl !== payTxn) {
      queueMicrotask(() => setPayTxn(txnFromUrl));
    }
    if (txnFromUrl || payTxn || pendingGatewayTxnId) return;
    if (!orderId || !order || order.paymentStatus === "cod_pending") return;

    let cancelled = false;
    void (async () => {
      try {
        const status = await paymentService.getPaymentStatus(orderId);
        const txn = status.latestPayment?.txnId;
        if (!cancelled && txn) {
          setFetchedTxn(txn);
          setPayTxn(txn);
        }
      } catch {
        /* COD / no payment row — leave blank */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, order, txnFromUrl, payTxn, pendingGatewayTxnId, setPayTxn]);

  // Settled orders: clear local cart after success is confirmed (online path
  // places without clearing; backend clears server cart on paid).
  useEffect(() => {
    if (!order) return;
    if (order.paymentStatus === "paid" || order.paymentStatus === "cod_pending") {
      clearCart();
    }
  }, [order, clearCart]);

  // Unpaid gateway drafts must not land on the success screen.
  useEffect(() => {
    if (!order || !orderId) return;
    if (order.paymentStatus === "failed") {
      router.replace(
        `/checkout/failed?orderId=${encodeURIComponent(orderId)}&reason=${encodeURIComponent(
          "Payment was not completed for this order.",
        )}`,
      );
      return;
    }
    if (order.paymentStatus === "pending") {
      router.replace(
        `/checkout/failed?orderId=${encodeURIComponent(orderId)}&reason=${encodeURIComponent(
          "Payment is still pending. Please complete payment to confirm your order.",
        )}`,
      );
    }
  }, [order, orderId, router]);

  if (!orderId || (!order && (orderDetailLoading || !remoteMiss))) {
    return <OrderResultPageSkeleton />;
  }

  if (!order) {
    return (
      <OrderResultCard
        variant="failed"
        title="Order not found"
        subtitle="We couldn't load this order. It may still be processing — check My Orders, or continue shopping."
        primaryAction={{ label: "View orders", href: "/orders" }}
        secondaryAction={{ label: "Continue shopping", href: "/" }}
      />
    );
  }

  if (order.paymentStatus === "failed" || order.paymentStatus === "pending") {
    return <OrderResultPageSkeleton />;
  }

  const etaRaw = (order.eta || "").trim();
  let etaDisplay: string | undefined;
  if (etaRaw) {
    const mins = etaRaw.match(/(\d+)\s*min/i);
    if (mins) etaDisplay = `Arriving in ${mins[1]} minutes`;
    else if (/^in\s+/i.test(etaRaw)) etaDisplay = etaRaw.replace(/^in\s+/i, "Arriving in ");
    else etaDisplay = etaRaw;
  }

  return (
    <OrderResultCard
      variant="success"
      title="Order placed successfully!"
      subtitle="Thank you for shopping with Selorg. Your fresh picks are on the way."
      order={order}
      etaLabel="Estimated Arrival"
      etaValue={etaDisplay}
      transactionId={resolvedTxnId}
      primaryAction={{ label: "Track order", href: `/orders/${order.id}` }}
      secondaryAction={{ label: "Continue shopping", href: "/" }}
    />
  );
}
