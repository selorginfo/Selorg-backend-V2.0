"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Wallet, Zap } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCartTotals } from "@/hooks/useCartTotals";
import { useDelivery } from "@/context/DeliveryContext";
import { useWallet } from "@/context/WalletContext";
import { useAddresses } from "@/context/AddressContext";
import { formatMoney } from "@/lib/money";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { SavedItemRow } from "@/components/cart/SavedItemRow";
import { BillSummary } from "@/components/cart/BillSummary";
import { CouponBox } from "@/components/cart/CouponBox";
import { ExclusiveOffers } from "@/components/cart/ExclusiveOffers";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { ProductGrid } from "@/components/product/ProductGrid";
import { categoryService } from "@/services/categoryService";
import type { Product } from "@/types";

/** "You may also like" — real products from the first cart item's category
 *  (selorg-service has no recommendations endpoint). Stays empty rather than
 *  suggesting anything the catalog API didn't return. */
function useCartSuggestions(firstCartLineCategoryId: string | undefined): Product[] | null {
  const [suggestions, setSuggestions] = useState<Product[] | null>(null);

  useEffect(() => {
    if (!firstCartLineCategoryId) return undefined;
    let cancelled = false;
    categoryService.getById(firstCartLineCategoryId).then((result) => {
      if (!cancelled) setSuggestions(result?.products ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [firstCartLineCategoryId]);

  return suggestions;
}

export function CartClient() {
  const { lines, savedLines } = useCart();
  const totals = useCartTotals();
  const { promiseText, loading: deliveryLoading } = useDelivery();
  const { wallet, toggleWalletCheckout } = useWallet();
  const { addresses, selectedAddr } = useAddresses();
  const router = useRouter();
  const realSuggestions = useCartSuggestions(lines[0]?.product.cat);

  if (lines.length === 0 && savedLines.length === 0) {
    return (
      <div className="wrap flex flex-col items-center py-16">
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          subtitle="Looks like you haven't added anything yet. Explore fresh organic picks."
          action={
            <Link href="/">
              <Button>Start shopping</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const cartProductIds = new Set(lines.map((l) => l.product.id));
  const suggestions = (realSuggestions ?? []).filter((p) => !cartProductIds.has(p.id)).slice(0, 8);
  const address = addresses.find((a) => a.id === selectedAddr);

  return (
    <div className="wrap pb-9 pt-3 min-[861px]:pt-[18px]">
      <h1 className="mb-4 text-[22px] font-extrabold tracking-[-0.7px] min-[861px]:text-[28px]">
        My Cart <span className="text-[16px] font-bold text-muted min-[861px]:text-[20px]">({totals.count} items)</span>
      </h1>

      <div className="grid grid-cols-1 gap-[28px] min-[1041px]:grid-cols-[minmax(0,1fr)_372px]">
        <div className="flex flex-col gap-3">
          {address ? (
            <div className="flex items-center gap-[9px] rounded-xl border border-[#dbe6cb] bg-accent-tint px-4 py-3 text-[13px] font-bold text-accent-dark">
              <Zap size={16} /> Delivery in {deliveryLoading ? "…" : promiseText ?? "soon"} to {address.area}
            </div>
          ) : null}

          {lines.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
              Your cart is empty — move a saved item back in, or keep shopping.
            </div>
          ) : (
            lines.map((l) => <CartItemRow key={l.product.id} line={l} />)
          )}

          {savedLines.length > 0 ? (
            <div className="mt-[14px]">
              <h2 className="mb-3 text-base font-extrabold">Saved for later ({savedLines.length})</h2>
              <div className="flex flex-col gap-2.5">
                {savedLines.map((l) => (
                  <SavedItemRow key={l.product.id} line={l} />
                ))}
              </div>
            </div>
          ) : null}

          {suggestions.length > 0 ? (
            <div className="mt-[30px]">
              <h2 className="mb-4 font-sans text-[22px] font-extrabold tracking-[-0.6px]">You may also like</h2>
              <ProductGrid products={suggestions} />
            </div>
          ) : null}
        </div>

        {lines.length > 0 ? (
          <div className="flex flex-col gap-3.5 min-[1041px]:sticky min-[1041px]:top-4 min-[1041px]:self-start">
            <div className="max-[860px]:sticky max-[860px]:bottom-[calc(72px+env(safe-area-inset-bottom))] max-[860px]:z-30">
              <BillSummary
                totals={totals}
                showWalletToggle={
                  wallet.balance > 0 ? (
                    <div className="flex items-center justify-between gap-3 rounded-[11px] border border-[#dbe6cb] bg-accent-tint px-[13px] py-[11px]">
                      <span className="flex min-w-0 items-center gap-[9px]">
                        <Wallet size={18} className="shrink-0 text-accent-dark" />
                        <span>
                          <span className="block text-[12.5px] font-extrabold text-accent-dark">Pay with wallet</span>
                          <span className="block text-[11.5px] text-muted">Balance {formatMoney(wallet.balance)}</span>
                        </span>
                      </span>
                      <Switch checked={wallet.useAtCheckout} onChange={toggleWalletCheckout} />
                    </div>
                  ) : undefined
                }
                cta={
                  <Button className="mt-4 w-full" onClick={() => router.push("/checkout")}>
                    Proceed to checkout →
                  </Button>
                }
              />
            </div>
            <CouponBox />
            <ExclusiveOffers />
          </div>
        ) : null}
      </div>
    </div>
  );
}
