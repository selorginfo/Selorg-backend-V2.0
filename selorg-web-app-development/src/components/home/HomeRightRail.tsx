"use client";

import Link from "next/link";
import { User, Wallet } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useOrders } from "@/context/OrdersContext";
import { useWallet } from "@/context/WalletContext";
import { decorateOrder, isLiveTrackableOrder } from "@/lib/orders";
import { formatMoney } from "@/lib/money";

export function HomeRightRail() {
  const { authReady, auth, profile } = useAuth();
  const { wallet } = useWallet();
  const { activeOrder: contextActiveOrder, orders } = useOrders();

  const isLoggedIn = authReady && auth.loggedIn;

  // Prefer API active order; fall back to first settled in-flight order from the list.
  // Never show unpaid gateway drafts or the empty "Track Your Order" shell.
  const trackOrder =
    (contextActiveOrder && isLiveTrackableOrder(contextActiveOrder)
      ? decorateOrder(contextActiveOrder)
      : null) ??
    orders
      .map(decorateOrder)
      .find((o) => isLiveTrackableOrder(o));

  return (
    <aside className="hidden min-w-0 min-[1221px]:sticky min-[1221px]:top-0 min-[1221px]:flex min-[1221px]:flex-col min-[1221px]:gap-4 min-[1221px]:self-start min-[1221px]:overflow-x-hidden">
      <div
        className="overflow-x-hidden rounded-2xl p-[18px] text-white"
        style={{ background: "linear-gradient(150deg, var(--color-accent), var(--color-accent-dark))" }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/20">
            <User size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-extrabold">
              {isLoggedIn ? `Hi, ${profile.name.split(" ")[0]}` : "Welcome"}
            </div>
            <div className="truncate text-xs opacity-90">
              {isLoggedIn ? "Great to see you again" : "Sign in for faster checkout"}
            </div>
          </div>
        </div>

        <Link
          href="/account/wallet"
          className="mt-3.5 flex min-w-0 items-center gap-2.5 rounded-xl bg-white/[.14] px-3.5 py-3 text-left"
        >
          <Wallet size={18} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-extrabold text-white">Selorg Wallet</span>
            <span className="block truncate text-[11.5px] opacity-90">
              {isLoggedIn ? `Balance ${formatMoney(wallet.balance)}` : "Sign in to see your balance"}
            </span>
          </span>
          <span className="shrink-0 text-[15px] opacity-80">›</span>
        </Link>

        <Link
          href={isLoggedIn ? "/account/profile" : "/auth"}
          className="mt-3 flex h-[42px] items-center justify-center rounded-[11px] bg-white text-sm font-extrabold text-accent-dark"
        >
          {isLoggedIn ? "My Account" : "Sign in"}
        </Link>
      </div>

      {trackOrder ? (
        <div className="overflow-x-hidden rounded-2xl border border-line bg-white p-[18px]">
          <div className="mb-2.5 flex min-w-0 items-center justify-between gap-2">
            <div className="truncate text-[15px] font-extrabold">Track Your Order</div>
            <Link href="/orders" className="shrink-0 text-[12.5px] font-bold text-accent-dark">
              View All
            </Link>
          </div>

          <Link
            href={`/orders/${trackOrder.id}`}
            className="block min-w-0 overflow-x-hidden rounded-xl border border-line p-[13px]"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span
                className="truncate text-[11.5px] font-extrabold uppercase tracking-wide"
                style={{ color: trackOrder.statusColor }}
              >
                {trackOrder.status}
              </span>
              <span className="max-w-[45%] truncate text-[11.5px] font-semibold text-muted">
                #{trackOrder.id}
              </span>
            </div>
            <div className="my-2 h-[5px] overflow-hidden rounded-full" style={{ background: "#eeefe7" }}>
              <span
                className="block h-[5px] rounded-full"
                style={{
                  background: trackOrder.statusColor,
                  width: `${Math.max(8, Math.min(100, Math.round(((trackOrder.statusIndex + 1) / 5) * 100)))}%`,
                }}
              />
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[12.5px] font-bold">{trackOrder.eta}</span>
              <span className="shrink-0 text-xs text-muted">
                {trackOrder.items.length} items · {formatMoney(trackOrder.total)}
              </span>
            </div>
            <div className="mt-2 text-[12.5px] font-extrabold text-accent-dark">Track order →</div>
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
