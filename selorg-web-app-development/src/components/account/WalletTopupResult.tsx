"use client";

import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { WalletTopupResultState } from "@/types";

interface WalletTopupResultProps {
  result: WalletTopupResultState;
  onDismiss: () => void;
  onRetry: () => void;
}

export function WalletTopupResult({ result, onDismiss, onRetry }: WalletTopupResultProps) {
  const isSuccess = result.status === "success";
  const isPending = result.status === "processing" || result.status === "pending";
  const isCancelled = result.status === "cancelled";

  const title =
    result.status === "success"
      ? "Money added successfully"
      : result.status === "cancelled"
        ? "Add money cancelled"
        : isPending
          ? "Payment processing"
          : "Add money failed";

  const subtitle =
    result.message ||
    (result.status === "success"
      ? "Your wallet has been credited."
      : result.status === "cancelled"
        ? "No money was added to your wallet."
        : isPending
          ? "We're confirming your payment. Your balance will update once the credit is verified."
          : "Your wallet was not credited. Please try again.");

  return (
    <div className="overflow-hidden rounded-app border border-line bg-white">
      <div className="flex flex-col gap-3 bg-[#20241c] px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              isSuccess ? "bg-accent" : isPending ? "bg-white/15" : "bg-warn",
            )}
          >
            {isPending ? (
              <Loader2 size={22} className="animate-spin-slow" />
            ) : isSuccess ? (
              <Check size={22} strokeWidth={3} />
            ) : (
              <X size={22} strokeWidth={3} />
            )}
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold sm:text-base">{title}</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-white/75">{subtitle}</p>
          </div>
        </div>
        {result.amount > 0 ? (
          <div className="border-t border-white/10 pt-2.5 sm:border-0 sm:pt-0 sm:text-right">
            <div className="text-[11px] opacity-70">{isSuccess ? "Amount added" : "Amount"}</div>
            <div className="text-lg font-extrabold">{formatMoney(result.amount)}</div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 px-5 py-4">
        {isSuccess ? (
          <div className="rounded-[11px] bg-accent-tint px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-accent-dark/70">
              Updated wallet balance
            </div>
            <div className="mt-0.5 text-[22px] font-extrabold text-accent-dark">
              {formatMoney(result.balance)}
            </div>
          </div>
        ) : null}

        {!isSuccess && !isPending ? (
          <p className="text-[13px] leading-relaxed text-muted">
            {isCancelled
              ? "You closed the payment screen before completing the top-up. Your wallet balance is unchanged."
              : "If money was deducted by your bank, it will be refunded automatically. Wallet balance is only updated after Selorg confirms the credit."}
          </p>
        ) : null}

        {result.txnId ? (
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-[12.5px]">
            <span className="text-muted">Reference ID</span>
            <span className="max-w-[60%] truncate font-bold text-ink" title={result.txnId}>
              {result.txnId}
            </span>
          </div>
        ) : null}

        <div className="mt-1 flex flex-col gap-2.5 sm:flex-row">
          {isSuccess || isPending ? (
            <Button type="button" onClick={onDismiss} className="w-full min-h-[48px]">
              {isPending ? "Back to wallet" : "Done"}
            </Button>
          ) : (
            <>
              <Button type="button" onClick={onRetry} className="w-full min-h-[48px] sm:flex-1">
                Try again
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={onDismiss}
                className="w-full min-h-[48px] sm:flex-1"
              >
                Back to wallet
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
