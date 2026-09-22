"use client";

import { SafeRemoteImage } from "@/components/ui/SafeRemoteImage";
import Link from "next/link";
import { ShoppingCart, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useUI } from "@/context/UIContext";
import { formatMoney } from "@/lib/money";
import { productDisplayName } from "@/lib/products";

export function CartDrawer() {
  const { drawerOpen, closeDrawer } = useUI();
  const { lines, totals, increment, decrement } = useCart();
  const router = useRouter();

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-[rgba(20,24,16,0.42)] animate-fadeIn" onClick={closeDrawer}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="fixed inset-0 flex h-[100dvh] w-full flex-col bg-white animate-fadeIn min-[861px]:inset-y-0 min-[861px]:right-0 min-[861px]:left-auto min-[861px]:h-full min-[861px]:w-[410px] min-[861px]:max-w-[92vw] min-[861px]:animate-drawerIn min-[861px]:shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-white px-4 py-4 min-[861px]:px-[22px] min-[861px]:py-5">
          <h2 className="font-sans text-[19px] font-extrabold">
            Your cart <span className="text-sm font-semibold text-muted">({totals.count})</span>
          </h2>
          <button
            onClick={closeDrawer}
            aria-label="Close cart"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[22px] text-muted hover:bg-accent-tint"
          >
            <X size={20} />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3.5 p-8 text-center">
            <ShoppingCart size={52} strokeWidth={1.6} className="text-[#c9ccc0]" />
            <div className="text-[17px] font-extrabold">Your cart is empty</div>
            <p className="text-[13.5px] text-muted">Add fresh picks to get started.</p>
            <button
              onClick={closeDrawer}
              className="rounded-xl bg-accent px-[22px] py-3 text-sm font-bold text-white"
            >
              Start shopping
            </button>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
            <div className="flex flex-col gap-2.5">
              {lines.map((l) => (
                <div
                  key={l.product.id}
                  className="flex items-center gap-3 rounded-[14px] border border-line bg-white p-2.5"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[11px] bg-[#f6f6f0]">
                    <SafeRemoteImage
                      src={l.product.photo}
                      alt={productDisplayName(l.product.name)}
                      fill
                      sizes="56px"
                      className="object-cover"
                      fallbackClassName="object-contain opacity-40 p-1.5"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-bold leading-tight">
                      {l.product.name}
                    </div>
                    <div className="text-[11.5px] text-muted">{l.variant.label}</div>
                    <div className="mt-0.5 text-sm font-extrabold">{formatMoney(l.lineTotal)}</div>
                  </div>
                  <div className="flex h-8 items-center rounded-[9px] bg-accent font-extrabold text-white">
                    <button
                      onClick={() => decrement(l.product.id)}
                      className="flex h-8 w-7 items-center justify-center text-base text-white"
                    >
                      −
                    </button>
                    <span className="min-w-[18px] text-center text-[13px]">{l.qty}</span>
                    <button
                      onClick={() => increment(l.product.id)}
                      className="flex h-8 w-7 items-center justify-center text-base text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {lines.length > 0 ? (
          <div
            className="shrink-0 border-t border-line bg-white px-4 py-4 min-[861px]:px-5 min-[861px]:py-[18px]"
            style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
          >
            {!totals.belowFree ? (
              <div className="mb-3 text-[12.5px] font-bold text-accent-dark">
                🎉 You&apos;ve unlocked free delivery!
              </div>
            ) : null}
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <b>{formatMoney(totals.sub)}</b>
            </div>
            <div className="mb-3.5 flex justify-between text-sm">
              <span className="text-muted">Delivery</span>
              <b className="text-accent-dark">
                {totals.delivery === 0 ? "FREE" : formatMoney(totals.delivery)}
              </b>
            </div>
            <button
              onClick={() => {
                closeDrawer();
                router.push("/checkout");
              }}
              className="flex h-[50px] w-full items-center justify-center gap-2.5 rounded-[13px] bg-accent text-[15px] font-extrabold text-white"
            >
              Checkout · {formatMoney(totals.grand)} <span>→</span>
            </button>
            <Link
              href="/cart"
              onClick={closeDrawer}
              className="mt-2.5 hidden text-center text-[13.5px] font-bold text-accent-dark min-[861px]:block"
            >
              View full cart
            </Link>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
