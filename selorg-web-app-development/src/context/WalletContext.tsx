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
import * as walletService from "@/services/walletService";
import { openPaynimoCheckout, paymentService } from "@/services/paymentService";
import { getToken, onAuthChange } from "@/services/session";
import {
  clearPendingWalletTopup,
  getPendingWalletTopup,
  savePendingWalletTopup,
} from "@/lib/walletTopupSession";
import {
  isWalletTopupCredited,
  isWorldlineFailedStatus,
  isWorldlinePaidStatus,
  parseReturnUrl,
} from "@/lib/worldline";
import type { TopupStep, WalletState, WalletTopupResultState, WalletTransaction } from "@/types";
import { useAppConfig } from "./AppConfigContext";
import { useUI } from "./UIContext";

interface WalletTopupReturnInput {
  status?: string | null;
  orderId?: string | null;
  txnId?: string | null;
  amount?: string | null;
  message?: string | null;
  returnUrl?: string;
}

interface WalletContextValue {
  wallet: WalletState;
  toggleWalletCheckout: () => void;
  toggleAutoTopup: () => void;
  /** Re-fetch balance + transactions from the backend (signed-in). */
  refreshWallet: () => Promise<void>;
  clearWalletCheckoutFlag: () => void;
  // top-up flow
  walletTopup: string;
  setWalletTopup: (value: string) => void;
  topupStep: TopupStep;
  topupError: string;
  topupResult: WalletTopupResultState | null;
  startTopup: () => void;
  submitTopup: () => Promise<void>;
  retryTopup: () => void;
  closeTopup: () => void;
  dismissTopupResult: () => void;
  /** Handle Paynimo bridge return on /account/wallet — never order pages. */
  handleTopupReturn: (input: WalletTopupReturnInput) => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { showToast, openModal, closeModal } = useUI();
  const { walletMaxTopup } = useAppConfig();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [autoTopup, setAutoTopup] = useState(false);
  const [useAtCheckout, setUseAtCheckout] = useState(false);

  const [walletTopup, setWalletTopup] = useState("");
  const [topupStep, setTopupStep] = useState<TopupStep>("confirm");
  const [topupError, setTopupError] = useState("");
  const [topupAmt, setTopupAmt] = useState(0);
  const [topupResult, setTopupResult] = useState<WalletTopupResultState | null>(null);

  const submittingRef = useRef(false);
  const handlingReturnRef = useRef(false);

  const refreshWallet = useCallback(async () => {
    if (!getToken()) {
      setBalance(0);
      setTxns([]);
      return;
    }
    try {
      const [bal, transactions] = await Promise.all([
        walletService.getBalance(),
        walletService.getTransactions(),
      ]);
      setBalance(bal.balance);
      setTxns(transactions);
    } catch {
      /* keep whatever was already shown */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!getToken()) {
        if (!cancelled) {
          setBalance(0);
          setTxns([]);
        }
        return;
      }
      try {
        const [bal, transactions] = await Promise.all([
          walletService.getBalance(),
          walletService.getTransactions(),
        ]);
        if (cancelled) return;
        setBalance(bal.balance);
        setTxns(transactions);
      } catch {
        /* keep whatever was already shown */
      }
    };
    load();
    const unsubscribe = onAuthChange(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const clearWalletCheckoutFlag = useCallback(() => {
    setUseAtCheckout(false);
  }, []);

  const toggleWalletCheckout = useCallback(() => {
    if (!balance) {
      showToast("Your wallet balance is empty");
      return;
    }
    setUseAtCheckout((s) => !s);
  }, [balance, showToast]);

  const toggleAutoTopup = useCallback(() => {
    setAutoTopup((s) => {
      const next = !s;
      showToast(next ? "Auto top-up on · ₹500 when below ₹100" : "Auto top-up off");
      return next;
    });
  }, [showToast]);

  const startTopup = useCallback(() => {
    if (!getToken()) {
      showToast("Please sign in to add money to your wallet");
      return;
    }
    const amt = parseInt(walletTopup, 10);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast("Enter a valid amount");
      return;
    }
    if (amt > walletMaxTopup) {
      showToast(`Maximum top-up is ₹${walletMaxTopup.toLocaleString("en-IN")} per transaction`);
      return;
    }
    setTopupAmt(amt);
    setTopupStep("confirm");
    setTopupError("");
    setTopupResult(null);
    openModal({ type: "walletTopup" });
  }, [openModal, showToast, walletTopup, walletMaxTopup]);

  const submitTopup = useCallback(async () => {
    if (submittingRef.current) return;
    if (!getToken()) {
      setTopupError("Please sign in to add money to your wallet");
      setTopupStep("failed");
      return;
    }
    if (!topupAmt || topupAmt <= 0) {
      setTopupError("Enter a valid amount");
      setTopupStep("failed");
      return;
    }
    submittingRef.current = true;
    setTopupError("");
    setTopupStep("processing");
    try {
      const session = await walletService.initiateTopUp(topupAmt);
      savePendingWalletTopup({
        orderId: String(session.orderId),
        txnId: String(session.txnId),
        amount: topupAmt,
        startedAt: Date.now(),
      });
      // Drop our confirm modal so it cannot sit under / trap focus from Paynimo.
      closeModal();
      await openPaynimoCheckout(session);
    } catch (err) {
      clearPendingWalletTopup();
      setTopupError(
        err instanceof Error
          ? err.message
          : "Could not start the payment. Please try again.",
      );
      setTopupStep("failed");
      openModal({ type: "walletTopup" });
    } finally {
      submittingRef.current = false;
    }
  }, [topupAmt, closeModal, openModal]);

  const retryTopup = useCallback(() => {
    setTopupStep("confirm");
    setTopupError("");
    setTopupResult(null);
    openModal({ type: "walletTopup" });
  }, [openModal]);

  const closeTopup = useCallback(() => {
    closeModal();
    setWalletTopup("");
    setTopupStep("confirm");
  }, [closeModal]);

  const dismissTopupResult = useCallback(() => {
    setTopupResult(null);
    setWalletTopup("");
    setTopupStep("confirm");
    clearPendingWalletTopup();
  }, []);

  const handleTopupReturn = useCallback(
    async (input: WalletTopupReturnInput) => {
      if (handlingReturnRef.current) return;
      handlingReturnRef.current = true;

      const pending = getPendingWalletTopup();
      const orderId = String(input.orderId || pending?.orderId || "").trim();
      const txnId = String(input.txnId || pending?.txnId || "").trim();
      const amountHint = Number(input.amount || pending?.amount || topupAmt || 0) || 0;
      const bridgeStatus = String(input.status || "").toLowerCase();
      const bridgeMessage = String(input.message || "").trim();
      const balanceBefore = balance;

      setTopupResult({
        status: "processing",
        amount: amountHint,
        balance,
        txnId: txnId || undefined,
        orderId: orderId || undefined,
        message: "Confirming your wallet top-up…",
      });

      const finish = (result: WalletTopupResultState) => {
        setTopupResult(result);
        clearPendingWalletTopup();
      };

      try {
        if (!orderId) {
          // No session id — still refresh balance in case credit already landed.
          await refreshWallet();
          const bal = await walletService.getBalance().catch(() => ({ balance: balanceBefore }));
          setBalance(bal.balance);
          if (amountHint > 0 && bal.balance >= balanceBefore + amountHint - 0.01) {
            finish({
              status: "success",
              amount: amountHint,
              balance: bal.balance,
              txnId: txnId || undefined,
              message: "Your wallet has been credited successfully.",
            });
            showToast("Money added to your wallet");
            return;
          }
          const cancelled =
            bridgeStatus === "cancelled" ||
            bridgeStatus === "canceled" ||
            /cancel/i.test(bridgeMessage);
          finish({
            status: cancelled ? "cancelled" : "failed",
            amount: amountHint,
            balance: bal.balance,
            txnId: txnId || undefined,
            message:
              bridgeMessage ||
              (cancelled
                ? "You cancelled the payment. No money was added to your wallet."
                : "We couldn't confirm this top-up. No money was added to your wallet."),
          });
          return;
        }

        // Best-effort complete for non-presentation payloads (idempotent on server).
        const returnUrl = input.returnUrl || (typeof window !== "undefined" ? window.location.href : "");
        const response = parseReturnUrl(returnUrl);
        const hasGatewayPayload = Boolean(
          response.msg ||
            response.hash ||
            response.tpsl_txn_id ||
            response.clnt_txn_ref ||
            response.txn_status,
        );
        if (hasGatewayPayload && txnId) {
          try {
            await paymentService.completePayment(orderId, txnId, response);
          } catch {
            /* status poll is the source of truth */
          }
        }

        // Bridge status is a UI hint only — never show cancel/fail until backend confirms.
        // Poll long enough to beat abort-vs-success races after Paynimo closes.
        let credited = false;
        let lastStatus: Awaited<ReturnType<typeof paymentService.getPaymentStatus>> | null = null;
        for (let i = 0; i < 15; i += 1) {
          try {
            lastStatus = await paymentService.getPaymentStatus(orderId);
          } catch {
            if (i < 14) await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          if (isWalletTopupCredited(lastStatus) || isWorldlinePaidStatus(lastStatus)) {
            if (isWalletTopupCredited(lastStatus)) {
              credited = true;
              break;
            }
            // Paid at gateway but credit flag lagging — keep waiting briefly.
            if (i < 14) {
              await new Promise((r) => setTimeout(r, 1000));
              continue;
            }
            credited = lastStatus.uiState === "PAID";
            break;
          }
          if (isWorldlineFailedStatus(lastStatus)) {
            // One more wait: abort can arrive before credit flag is visible.
            if (i < 5) {
              await new Promise((r) => setTimeout(r, 1000));
              continue;
            }
            break;
          }
          if (i < 14) await new Promise((r) => setTimeout(r, 1000));
        }

        const bal = await walletService.getBalance().catch(() => ({ balance: balanceBefore }));
        setBalance(bal.balance);
        await refreshWallet();

        const resolvedTxn = lastStatus?.latestPayment?.txnId || txnId || undefined;
        const latestSt = String(lastStatus?.latestPayment?.status || "").toLowerCase();
        const amountCredited =
          amountHint > 0 && bal.balance >= balanceBefore + amountHint - 0.01;

        // Balance increase or walletCredited = success (bridge cancel message is ignored).
        if (credited || isWalletTopupCredited(lastStatus || {}) || amountCredited) {
          const creditedAmount =
            amountHint ||
            Number((lastStatus as { amountInr?: number } | null)?.amountInr || 0) ||
            amountHint;
          finish({
            status: "success",
            amount: creditedAmount,
            balance: bal.balance,
            txnId: resolvedTxn,
            orderId,
            message: "Your wallet has been credited successfully.",
          });
          showToast("Money added to your wallet");
          return;
        }

        if (isWorldlinePaidStatus(lastStatus || {}) && !isWalletTopupCredited(lastStatus || {})) {
          finish({
            status: "failed",
            amount: amountHint,
            balance: bal.balance,
            txnId: resolvedTxn,
            orderId,
            message:
              "Payment was received but wallet credit could not be confirmed. Please contact support with your reference ID.",
          });
          return;
        }

        if (latestSt === "cancelled" || latestSt === "canceled" || bridgeStatus === "cancelled" || bridgeStatus === "canceled") {
          finish({
            status: "cancelled",
            amount: amountHint,
            balance: bal.balance,
            txnId: resolvedTxn,
            orderId,
            message:
              "You cancelled the payment. No money was added to your wallet.",
          });
          return;
        }

        if (isWorldlineFailedStatus(lastStatus || {}) || bridgeStatus === "failed" || latestSt === "failed") {
          finish({
            status: "failed",
            amount: amountHint,
            balance: bal.balance,
            txnId: resolvedTxn,
            orderId,
            message:
              lastStatus?.latestPayment?.statusMessage ||
              "Payment failed. No money was added to your wallet.",
          });
          return;
        }

        finish({
          status: "pending",
          amount: amountHint,
          balance: bal.balance,
          txnId: resolvedTxn,
          orderId,
          message:
            "Payment is still being verified. Your wallet will update once the credit is confirmed.",
        });
      } catch (err) {
        finish({
          status: "failed",
          amount: amountHint,
          balance,
          txnId: txnId || undefined,
          orderId: orderId || undefined,
          message:
            err instanceof Error
              ? err.message
              : "Could not verify wallet top-up. Check your wallet balance — it may already be credited.",
        });
      } finally {
        handlingReturnRef.current = false;
      }
    },
    [balance, refreshWallet, showToast, topupAmt],
  );

  return (
    <WalletContext.Provider
      value={{
        wallet: { balance, autoTopup, useAtCheckout, txns },
        toggleWalletCheckout,
        toggleAutoTopup,
        refreshWallet,
        clearWalletCheckoutFlag,
        walletTopup,
        setWalletTopup,
        topupStep,
        topupError,
        topupResult,
        startTopup,
        submitTopup,
        retryTopup,
        closeTopup,
        dismissTopupResult,
        handleTopupReturn,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
