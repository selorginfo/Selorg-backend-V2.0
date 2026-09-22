"use client";

import { Loader2, XCircle } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useUI } from "@/context/UIContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/money";

export function WalletTopupModal() {
  const { modal } = useUI();
  const {
    walletTopup,
    topupStep,
    topupError,
    submitTopup,
    retryTopup,
    closeTopup,
  } = useWallet();
  const open = modal?.type === "walletTopup";
  const amount = parseInt(walletTopup, 10) || 0;

  return (
    <Modal open={open} onClose={closeTopup} className="max-w-[430px] overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 bg-[#20241c] px-5 py-[15px] text-white">
        <div>
          <div className="text-sm font-extrabold">Add money to wallet</div>
          <div className="text-[11px] opacity-70">Secure payment · encrypted</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] opacity-70">Amount</div>
          <div className="text-[17px] font-extrabold">{formatMoney(amount)}</div>
        </div>
      </div>

      {topupStep === "confirm" || topupStep === "method" ? (
        <div className="flex flex-col gap-3.5 p-5">
          <p className="text-sm leading-relaxed text-muted">
            You&apos;ll be redirected to our secure payment partner to add{" "}
            <b className="text-ink">{formatMoney(amount)}</b> to your wallet.
          </p>
          {topupError ? <span className="text-xs font-semibold text-warn">{topupError}</span> : null}
          <Button onClick={() => void submitTopup()} className="w-full" disabled={!amount}>
            Continue to payment
          </Button>
        </div>
      ) : null}

      {topupStep === "processing" ? (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <Loader2 size={32} className="animate-spin-slow text-accent" />
          <span className="text-sm font-bold text-muted">Connecting to payment…</span>
        </div>
      ) : null}

      {topupStep === "failed" ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <XCircle size={40} className="text-warn" />
          <span className="text-sm font-bold text-warn">{topupError}</span>
          <Button onClick={retryTopup} className="mt-2 w-full">
            Try again
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
