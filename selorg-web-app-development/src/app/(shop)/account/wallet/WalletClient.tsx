"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wallet as WalletIcon } from "lucide-react";
import { WalletTopupResult } from "@/components/account/WalletTopupResult";
import { useAppConfig } from "@/context/AppConfigContext";
import { useWallet } from "@/context/WalletContext";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { isWalletTopupPurpose } from "@/lib/walletTopupSession";

export function WalletClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    wallet,
    walletTopup,
    setWalletTopup,
    startTopup,
    topupResult,
    handleTopupReturn,
    dismissTopupResult,
    retryTopup,
  } = useWallet();
  // Top-up amounts are admin-configured (`/bootstrap` → `appConfig.wallet.topUpAmounts`).
  const { walletPresets } = useAppConfig();
  const bridgeHandledRef = useRef(false);

  useEffect(() => {
    const paynimoBridge = searchParams.get("paynimo_bridge") === "1";
    if (!paynimoBridge || bridgeHandledRef.current) return;
    bridgeHandledRef.current = true;

    const purpose = searchParams.get("purpose");
    // Defensive: if an order bridge somehow lands here without wallet purpose, ignore.
    if (purpose && !isWalletTopupPurpose(purpose) && purpose !== "order") {
      /* unknown purpose — still try wallet handling if we have pending session */
    }

    void handleTopupReturn({
      status: searchParams.get("status"),
      orderId: searchParams.get("orderId"),
      txnId: searchParams.get("txnId"),
      amount: searchParams.get("amount"),
      message: searchParams.get("message"),
      returnUrl: typeof window !== "undefined" ? window.location.href : undefined,
    }).finally(() => {
      // Strip bridge query so refresh does not re-run the handler.
      router.replace("/account/wallet", { scroll: false });
    });
  }, [searchParams, handleTopupReturn, router]);

  return (
    <div className="flex flex-col gap-5">
      {topupResult ? (
        <WalletTopupResult
          result={topupResult}
          onDismiss={dismissTopupResult}
          onRetry={() => {
            dismissTopupResult();
            if (topupResult.amount > 0) setWalletTopup(String(Math.round(topupResult.amount)));
            retryTopup();
          }}
        />
      ) : null}

      <div className="rounded-app bg-gradient-to-br from-accent to-accent-dark px-6 py-[22px] text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[13px] bg-white/18">
            <WalletIcon size={20} />
          </span>
          <div>
            <div className="text-xs font-semibold opacity-90">Selorg Wallet balance</div>
            <div className="text-[30px] font-extrabold leading-tight tracking-tight">
              {formatMoney(wallet.balance)}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-app border border-line bg-white p-5">
        <h3 className="mb-3 text-[15px] font-extrabold">Add money</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          {walletPresets.map((p) => (
            <button
              key={p}
              onClick={() => setWalletTopup(String(p))}
              className={cn(
                "rounded-[10px] border-[1.5px] px-4 py-[9px] text-[13px] font-bold transition-colors",
                walletTopup === String(p)
                  ? "border-accent bg-accent-tint text-accent-dark"
                  : "border-line bg-white hover:border-accent hover:text-accent-dark",
              )}
            >
              ₹{p}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <div className="flex h-[46px] min-w-[170px] flex-1 items-center gap-2 rounded-[11px] border-[1.5px] border-line px-3.5 focus-within:border-accent">
            <span className="font-bold text-muted">₹</span>
            <input
              value={walletTopup}
              onChange={(e) => setWalletTopup(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="Enter amount"
              inputMode="numeric"
              className="min-w-0 flex-1 border-none bg-transparent text-[14.5px] font-semibold outline-none"
            />
          </div>
          <button
            onClick={startTopup}
            className="h-[46px] rounded-[11px] bg-accent px-6 text-sm font-extrabold text-white"
          >
            Add money
          </button>
        </div>
      </div>

      {/* Wallet checkout / auto top-up toggles hidden for now
      <div className="flex flex-col rounded-app border border-line bg-white px-5">
        <div className="flex items-center justify-between gap-3.5 border-b border-line py-[15px]">
          <div>
            <div className="text-sm font-bold">Use wallet at checkout</div>
            <div className="text-xs text-muted">Apply your balance automatically to new orders</div>
          </div>
          <Switch checked={wallet.useAtCheckout} onChange={toggleWalletCheckout} />
        </div>
        <div className="flex items-center justify-between gap-3.5 py-[15px]">
          <div>
            <div className="text-sm font-bold">Auto top-up</div>
            <div className="text-xs text-muted">Add ₹500 when balance drops below ₹100</div>
          </div>
          <Switch checked={wallet.autoTopup} onChange={toggleAutoTopup} />
        </div>
      </div>
      */}

      <div className="rounded-app border border-line bg-white p-5">
        <h3 className="mb-3 text-[15px] font-extrabold">Transaction history</h3>
        <div className="flex flex-col divide-y divide-line">
          {wallet.txns.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-[13px] font-bold">{t.label}</div>
                <div className="text-xs text-muted">{t.when}</div>
              </div>
              <span
                className={cn(
                  "text-sm font-extrabold",
                  t.type === "credit" ? "text-accent-dark" : "text-warn",
                )}
              >
                {t.type === "credit" ? "+" : "-"}
                {formatMoney(t.amt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
