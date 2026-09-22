"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  openPaynimoCheckout,
  paymentService,
  pollUntilPaymentSettled,
} from "@/services/paymentService";
import { parseReturnUrl } from "@/lib/worldline";
import type {
  DeliverySlotId,
  PayStep,
  PaymentMethod,
  ReceiverInfo,
} from "@/types";

const INITIAL_RECEIVER: ReceiverInfo = { name: "", phone: "", note: "" };

interface CheckoutContextValue {
  slot: DeliverySlotId;
  setSlot: (slot: DeliverySlotId) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  receiver: ReceiverInfo;
  setReceiverField: (field: keyof ReceiverInfo, value: string) => void;
  payStep: PayStep;
  payError: string;
  payTxn: string;
  pendingGatewayTxnId: string | null;
  retryPayment: () => void;
  cancelPayment: () => void;
  resetPayStep: () => void;
  setPayTxn: (txn: string) => void;
  runRealGatewaySession: (orderId: string) => Promise<void>;
  completeGatewayReturn: (orderId: string, returnUrl: string) => Promise<"paid" | "failed" | "pending">;
  abortGatewayPayment: (orderId: string) => Promise<void>;
  pollPaymentStatus: (orderId: string) => Promise<"paid" | "pending" | "failed">;
}

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<DeliverySlotId>("now");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [receiver, setReceiver] = useState<ReceiverInfo>(INITIAL_RECEIVER);
  const [payStep, setPayStep] = useState<PayStep>("processing");
  const [payError, setPayError] = useState("");
  const [payTxn, setPayTxn] = useState("");
  const [pendingGatewayTxnId, setPendingGatewayTxnId] = useState<string | null>(null);

  const setReceiverField = useCallback((field: keyof ReceiverInfo, value: string) => {
    setReceiver((s) => ({ ...s, [field]: value }));
  }, []);

  const retryPayment = useCallback(() => {
    setPayStep("processing");
    setPayError("");
    setPendingGatewayTxnId(null);
  }, []);

  const cancelPayment = useCallback(() => {
    setPayStep("processing");
    setPayError("");
    setPendingGatewayTxnId(null);
  }, []);

  const resetPayStep = useCallback(() => {
    setPayStep("processing");
    setPayError("");
    setPendingGatewayTxnId(null);
  }, []);

  const runRealGatewaySession = useCallback(async (orderId: string) => {
    setPayError("");
    setPayStep("processing");
    try {
      // Always open Paynimo with `all` on web. Scoping to UPI/cards/netBanking alone
      // often renders an empty instrument list when the merchant scheme isn't set up
      // for that single mode — shopper still picked a preferred method on checkout.
      const session = await paymentService.createOrderPaymentSession(orderId, {
        paymentMode: "all",
      });
      setPendingGatewayTxnId(session.txnId);
      setPayTxn(session.txnId);
      await openPaynimoCheckout(session);
      // Success navigates away via Paynimo returnUrl — no resolve here.
    } catch (err) {
      setPayError(
        err instanceof Error
          ? err.message
          : "Could not start the payment. Please try again.",
      );
      setPayStep("failed");
    }
  }, []);

  const completeGatewayReturn = useCallback(async (orderId: string, returnUrl: string) => {
    setPayStep("processing");
    setPayError("");
    try {
      const response = parseReturnUrl(returnUrl);
      await paymentService.completePayment(orderId, pendingGatewayTxnId ?? "", response);
      const result = await pollUntilPaymentSettled(orderId);
      if (result === "paid") {
        setPayStep("processing");
        setPendingGatewayTxnId(null);
        return "paid" as const;
      }
      if (result === "failed") {
        setPayError("Payment was not completed. Please try again.");
        setPayStep("failed");
        return "failed" as const;
      }
      return "pending" as const;
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Could not verify payment status");
      setPayStep("failed");
      return "failed" as const;
    }
  }, [pendingGatewayTxnId]);

  const abortGatewayPayment = useCallback(async (orderId: string) => {
    if (pendingGatewayTxnId) {
      try {
        await paymentService.abortPayment(orderId, pendingGatewayTxnId, "user_cancelled");
      } catch {
        /* best effort */
      }
    }
    setPendingGatewayTxnId(null);
    setPayStep("failed");
    setPayError("Payment was cancelled.");
  }, [pendingGatewayTxnId]);

  const pollPaymentStatus = useCallback(async (orderId: string) => {
    try {
      const result = await pollUntilPaymentSettled(orderId);
      if (result === "paid") {
        setPayStep("processing");
        setPendingGatewayTxnId(null);
        return "paid" as const;
      }
      if (result === "failed") {
        const status = await paymentService.getPaymentStatus(orderId);
        const msg = status.latestPayment?.statusMessage || "Payment failed";
        const st = String(status.latestPayment?.status || "").toLowerCase();
        setPayError(
          st === "cancelled" || /cancel/i.test(msg)
            ? "You cancelled the payment. No amount has been charged."
            : msg,
        );
        setPayStep("failed");
        return "failed" as const;
      }
      return "pending" as const;
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Could not verify payment status");
      setPayStep("failed");
      return "failed" as const;
    }
  }, []);

  return (
    <CheckoutContext.Provider
      value={{
        slot,
        setSlot,
        paymentMethod,
        setPaymentMethod,
        receiver,
        setReceiverField,
        payStep,
        payError,
        payTxn,
        pendingGatewayTxnId,
        retryPayment,
        cancelPayment,
        resetPayStep,
        setPayTxn,
        runRealGatewaySession,
        completeGatewayReturn,
        abortGatewayPayment,
        pollPaymentStatus,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout(): CheckoutContextValue {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error("useCheckout must be used within a CheckoutProvider");
  return ctx;
}
