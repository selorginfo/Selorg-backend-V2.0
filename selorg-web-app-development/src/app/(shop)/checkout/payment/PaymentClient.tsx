"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useCart } from "@/context/CartContext";
import { useCartTotals } from "@/hooks/useCartTotals";
import { useCheckout } from "@/context/CheckoutContext";
import { useOrders } from "@/context/OrdersContext";
import { useUI } from "@/context/UIContext";
import { formatMoney } from "@/lib/money";
import {
  buildWalletTopupReturnHref,
  isWalletTopupReturn,
} from "@/lib/walletTopupSession";

function goToFailed(
  router: ReturnType<typeof useRouter>,
  orderId: string,
  reason?: string,
  txnId?: string | null,
) {
  const q = new URLSearchParams({ orderId });
  if (reason) q.set("reason", reason);
  if (txnId) q.set("txnId", txnId);
  router.replace(`/checkout/failed?${q.toString()}`);
}

function goToConfirmation(
  router: ReturnType<typeof useRouter>,
  orderId: string,
  txnId?: string | null,
) {
  const q = new URLSearchParams({ orderId });
  if (txnId) q.set("txnId", txnId);
  router.replace(`/checkout/confirmation?${q.toString()}`);
}

export function PaymentClient() {
  const loggedIn = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const totals = useCartTotals();
  const { clearCart } = useCart();
  const { showToast } = useUI();
  const { placeOrder, refreshActiveOrder } = useOrders();
  const {
    payStep,
    payError,
    setPayTxn,
    pendingGatewayTxnId,
    runRealGatewaySession,
    completeGatewayReturn,
    pollPaymentStatus,
  } = useCheckout();

  const realOrderId = searchParams.get("orderId");
  const isDirect = searchParams.get("direct") === "1";
  const paynimoBridge = searchParams.get("paynimo_bridge") === "1";
  const bridgeStatus = searchParams.get("status");
  const bridgeTxnId = searchParams.get("txnId");
  const bridgePurpose = searchParams.get("purpose");
  const startedRef = useRef(false);

  useEffect(() => {
    if (bridgeTxnId) setPayTxn(bridgeTxnId);
  }, [bridgeTxnId, setPayTxn]);

  useEffect(() => {
    if (!loggedIn) return;

    // Wallet top-up must NEVER enter order confirmation / failed flow.
    if (
      paynimoBridge &&
      isWalletTopupReturn({
        purpose: bridgePurpose,
        orderId: realOrderId,
        txnId: bridgeTxnId,
      })
    ) {
      startedRef.current = true;
      router.replace(buildWalletTopupReturnHref(searchParams));
      return;
    }

    // Bridge return without orderId: never bounce through empty checkout → /cart
    // after a successful charge (server may already have cleared the cart).
    if (!realOrderId && !isDirect) {
      if (paynimoBridge) {
        const status = (bridgeStatus || "").toLowerCase();
        if (status === "success" || status === "paid") {
          router.replace("/orders");
          return;
        }
        router.replace(
          `/checkout/failed?reason=${encodeURIComponent(
            "We couldn't match this payment to an order. Check My Orders or contact support.",
          )}`,
        );
        return;
      }
      router.replace("/checkout");
      return;
    }

    if (startedRef.current) return;

    if (paynimoBridge && realOrderId) {
      startedRef.current = true;
      const txnId = bridgeTxnId || pendingGatewayTxnId;
      void (async () => {
        // If purpose was dropped from the redirect, resolve via status API.
        if (!bridgePurpose) {
          try {
            const { paymentService } = await import("@/services/paymentService");
            const status = await paymentService.getPaymentStatus(realOrderId);
            if (status.purpose === "wallet_topup") {
              const q = new URLSearchParams(searchParams.toString());
              q.set("purpose", "wallet_topup");
              router.replace(buildWalletTopupReturnHref(q));
              return;
            }
          } catch {
            /* continue as order */
          }
        }

        const returnUrl = typeof window !== "undefined" ? window.location.href : "";

        if (bridgeStatus === "cancelled" || bridgeStatus === "canceled") {
          const result = await pollPaymentStatus(realOrderId);
          if (result === "paid") {
            await refreshActiveOrder();
            clearCart();
            goToConfirmation(router, realOrderId, txnId);
            return;
          }
          goToFailed(
            router,
            realOrderId,
            "You cancelled the payment. No amount has been charged.",
            txnId,
          );
          return;
        }
        if (bridgeStatus === "failed") {
          const result = await pollPaymentStatus(realOrderId);
          if (result === "paid") {
            await refreshActiveOrder();
            clearCart();
            goToConfirmation(router, realOrderId, txnId);
            return;
          }
          goToFailed(
            router,
            realOrderId,
            "We couldn't process your payment. Please try again.",
            txnId,
          );
          return;
        }

        if (bridgeStatus === "success" || bridgeStatus === "paid") {
          const result = await completeGatewayReturn(realOrderId, returnUrl);
          if (result === "paid") {
            await refreshActiveOrder();
            clearCart();
            goToConfirmation(router, realOrderId, txnId);
            return;
          }
          if (result === "failed") {
            goToFailed(router, realOrderId, undefined, txnId);
            return;
          }
          // PENDING — do not claim success or hard-fail; send to recovery screen.
          goToFailed(
            router,
            realOrderId,
            "Payment is still being verified. You can retry or check My Orders shortly.",
            txnId,
          );
          return;
        }
        const result = await pollPaymentStatus(realOrderId);
        if (result === "paid") {
          await refreshActiveOrder();
          clearCart();
          goToConfirmation(router, realOrderId, txnId);
          return;
        }
        if (result === "failed") {
          goToFailed(router, realOrderId, undefined, txnId);
          return;
        }
        goToFailed(
          router,
          realOrderId,
          "Payment is still being verified. You can retry or check My Orders shortly.",
          txnId,
        );
      })();
      return;
    }

    // Legacy COD/zero-due entry: prefer placing from CheckoutClient now, but
    // keep this path working with visible errors if anything still links here.
    if (isDirect) {
      startedRef.current = true;
      void (async () => {
        try {
          const id = await placeOrder({ clearCartOnSuccess: false });
          void refreshActiveOrder();
          goToConfirmation(router, id);
          clearCart();
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : "Could not place your order. Please try again.",
          );
          router.replace("/checkout");
        }
      })();
      return;
    }

    if (realOrderId) {
      startedRef.current = true;
      void (async () => {
        await runRealGatewaySession(realOrderId);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, isDirect, realOrderId, paynimoBridge, bridgePurpose, bridgeTxnId]);

  // Session start failures set payStep=failed without a bridge redirect.
  useEffect(() => {
    if (!realOrderId || isDirect) return;
    if (payStep !== "failed") return;
    goToFailed(
      router,
      realOrderId,
      payError || undefined,
      pendingGatewayTxnId,
    );
  }, [payStep, payError, realOrderId, isDirect, router, pendingGatewayTxnId]);

  if (!loggedIn || isDirect) return null;

  if (!realOrderId) return null;

  return (
    <div className="mx-auto w-full max-w-[560px] px-3 pb-10 pt-5 sm:px-5 sm:pb-14 sm:pt-8">
      <div className="overflow-hidden rounded-2xl border border-line bg-white sm:rounded-[20px]">
        <div className="flex flex-col gap-3 bg-[#20241c] px-4 py-3.5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-[22px] sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/selorg-logo.png"
              alt="Selorg"
              width={38}
              height={38}
              className="shrink-0 rounded-[11px] object-cover"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold">Selorg Secure Checkout</div>
              <div className="text-[11px] opacity-70">Payments processed over TLS 1.3</div>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-2.5 sm:block sm:border-0 sm:pt-0 sm:text-right">
            <div className="text-[11px] opacity-70">Amount</div>
            <div className="text-base font-extrabold">{formatMoney(totals.grand)}</div>
          </div>
        </div>

        <div className="px-4 py-10 text-center sm:px-6 sm:py-16">
          <div className="mx-auto h-11 w-11 animate-spin-slow rounded-full border-4 border-[#eeefe7] border-t-accent sm:h-[52px] sm:w-[52px]" />
          <div className="mt-4 text-[15px] font-extrabold sm:mt-5 sm:text-[17px]">
            Connecting to secure payment…
          </div>
          <p className="mx-auto mt-1.5 max-w-[320px] text-[13px] leading-relaxed text-muted sm:text-[13.5px]">
            Please don&apos;t refresh or press back.
            <br />
            This usually takes a few seconds.
          </p>
          <div className="mt-5 flex items-center justify-center gap-1.5 px-2 text-[11px] text-muted sm:text-[11.5px]">
            <Lock size={12} className="shrink-0" />
            <span>Your payment is handled by our secure payment partner</span>
          </div>
        </div>
      </div>
    </div>
  );
}
