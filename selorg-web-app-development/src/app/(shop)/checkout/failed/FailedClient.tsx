"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderResultCard } from "@/components/checkout/OrderResultCard";
import { OrderResultPageSkeleton } from "@/components/ui/page-skeletons";
import { useCheckout } from "@/context/CheckoutContext";
import { useOrders } from "@/context/OrdersContext";
import { paymentService } from "@/services/paymentService";
import {
  buildWalletTopupReturnHref,
  isWalletTopupReturn,
} from "@/lib/walletTopupSession";

function customerSafeReason(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const text = raw.trim();
  // Never surface stack traces, Mongo ids dumps, or internal codes to customers.
  if (/at\s+\S+\s+\(/.test(text) || /ECONN|ENOTFOUND|Mongo|stack/i.test(text)) {
    return undefined;
  }
  if (text.length > 280) return `${text.slice(0, 277)}…`;
  return text;
}

export function FailedClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");
  const reasonParam = searchParams.get("reason");
  const txnFromUrl = searchParams.get("txnId");
  const purpose = searchParams.get("purpose");
  const { getOrder, fetchOrderById, orderDetailLoading } = useOrders();
  const { payError, payTxn, setPayTxn, pendingGatewayTxnId, retryPayment, cancelPayment } =
    useCheckout();
  const order = orderId ? getOrder(orderId) : undefined;
  const [remoteMiss, setRemoteMiss] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [fetchedTxn, setFetchedTxn] = useState<string | undefined>();

  const resolvedTxnId =
    txnFromUrl || payTxn || pendingGatewayTxnId || fetchedTxn || undefined;

  // Wallet top-up must never stay on Order Failed.
  useEffect(() => {
    if (
      isWalletTopupReturn({
        purpose,
        orderId,
        txnId: txnFromUrl,
      })
    ) {
      const q = new URLSearchParams(searchParams.toString());
      if (!q.get("paynimo_bridge")) q.set("paynimo_bridge", "1");
      if (!q.get("status")) {
        q.set(
          "status",
          /cancel/i.test(reasonParam || "") ? "cancelled" : "failed",
        );
      }
      if (reasonParam && !q.get("message")) q.set("message", reasonParam);
      router.replace(buildWalletTopupReturnHref(q));
    }
  }, [purpose, orderId, txnFromUrl, reasonParam, router, searchParams]);

  useEffect(() => {
    if (!orderId || order) return;

    let cancelled = false;
    void (async () => {
      const fetched = await fetchOrderById(orderId);
      if (cancelled) return;
      if (!fetched) setRemoteMiss(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, order, fetchOrderById]);

  useEffect(() => {
    if (txnFromUrl && txnFromUrl !== payTxn) {
      queueMicrotask(() => setPayTxn(txnFromUrl));
    }
    if (txnFromUrl || payTxn || pendingGatewayTxnId || !orderId) return;

    let cancelled = false;
    void (async () => {
      try {
        const status = await paymentService.getPaymentStatus(orderId);
        // If this synthetic id is a wallet top-up, bounce to wallet UI.
        if (status.purpose === "wallet_topup") {
          const q = new URLSearchParams({
            paynimo_bridge: "1",
            purpose: "wallet_topup",
            orderId,
            status: status.walletCredited
              ? "success"
              : String(status.latestPayment?.status || "failed"),
          });
          if (status.latestPayment?.txnId) q.set("txnId", status.latestPayment.txnId);
          router.replace(`/account/wallet?${q.toString()}`);
          return;
        }
        const txn = status.latestPayment?.txnId;
        if (!cancelled && txn) {
          setFetchedTxn(txn);
          setPayTxn(txn);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, txnFromUrl, payTxn, pendingGatewayTxnId, setPayTxn, router]);

  // If payment settled after arriving here, send them to success.
  useEffect(() => {
    if (!order || !orderId) return;
    if (order.paymentStatus === "paid" || order.paymentStatus === "cod_pending") {
      const q = new URLSearchParams({ orderId });
      if (resolvedTxnId) q.set("txnId", resolvedTxnId);
      router.replace(`/checkout/confirmation?${q.toString()}`);
    }
  }, [order, orderId, resolvedTxnId, router]);

  const subtitle =
    customerSafeReason(reasonParam) ||
    customerSafeReason(payError) ||
    "We couldn't complete your order. Please try again or use a different payment method.";

  const isPending = order?.paymentStatus === "pending";
  const title = isPending ? "Payment pending" : "Order could not be placed";

  const retryGateway = () => {
    if (!orderId || retrying) return;
    setRetrying(true);
    retryPayment();
    router.push(`/checkout/payment?orderId=${encodeURIComponent(orderId)}`);
    window.setTimeout(() => setRetrying(false), 500);
  };

  const changeMethod = () => {
    cancelPayment();
    router.push("/checkout");
  };

  if (
    isWalletTopupReturn({
      purpose,
      orderId,
      txnId: txnFromUrl,
    })
  ) {
    return <OrderResultPageSkeleton />;
  }

  if (orderId && !order && (orderDetailLoading || !remoteMiss)) {
    return <OrderResultPageSkeleton />;
  }

  if (order?.paymentStatus === "paid" || order?.paymentStatus === "cod_pending") {
    return <OrderResultPageSkeleton />;
  }

  return (
    <OrderResultCard
      variant="failed"
      title={title}
      subtitle={subtitle}
      order={order}
      etaLabel="Status"
      etaValue={isPending ? "Awaiting payment" : "Payment unsuccessful"}
      transactionId={resolvedTxnId}
      primaryAction={
        orderId
          ? { label: isPending ? "Complete payment" : "Retry payment", onClick: retryGateway }
          : { label: "View my orders", href: "/orders" }
      }
      secondaryAction={{ label: "Back to cart", href: "/cart" }}
      footerNote={
        <>
          {orderId ? (
            <p>
              {isPending
                ? `Order #${order?.orderNumber || orderId} is waiting for payment. No amount has been charged yet.`
                : `Order #${order?.orderNumber || orderId} was not completed. Your cart items are still available.`}
            </p>
          ) : (
            <p>If money was deducted, it will reflect in My Orders once the bank confirms the payment.</p>
          )}
          <div className="mt-3 flex flex-col items-center gap-2.5 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
            {orderId ? (
              <button
                type="button"
                onClick={changeMethod}
                className="min-h-[44px] px-2 font-bold text-accent-dark hover:text-accent"
              >
                Use a different payment method
              </button>
            ) : null}
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center px-2 text-[13px] font-semibold text-muted hover:text-ink"
            >
              Continue shopping
            </Link>
          </div>
        </>
      }
    />
  );
}
