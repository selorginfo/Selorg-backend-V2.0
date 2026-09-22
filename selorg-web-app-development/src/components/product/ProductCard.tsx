"use client";

import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { SafeRemoteImage } from "@/components/ui/SafeRemoteImage";
import { formatDiscountPct, formatMoney } from "@/lib/money";
import { decorateProduct, productDisplayName } from "@/lib/products";
import type { Product } from "@/types";
import { QuantityStepper } from "./QuantityStepper";

/**
 * Canonical product card — sized to match PDP “You might also like”.
 * Reserved title/price slots keep every card the same height in a row.
 */
export function ProductCard({ product }: { product: Product }) {
  const { cart, addToCart, increment, decrement } = useCart();
  const decorated = decorateProduct(product, cart[product.id] ?? 0);
  const displayName = productDisplayName(product.name);

  return (
    <Link
      href={`/product/${product.id}`}
      prefetch={false}
      className="group relative flex h-full w-full min-w-0 flex-col overflow-hidden border-0 bg-white transition-all duration-150 hover:z-10 hover:shadow-[0_16px_34px_-20px_rgba(40,60,20,0.45)]"
    >
      {decorated.hasDiscount ? (
        <span className="absolute left-2 top-2 z-10 rounded-lg bg-warn px-1.5 py-[3px] text-[10px] font-extrabold text-white sm:left-2.5 sm:top-2.5 sm:px-2 sm:text-[11px]">
          {formatDiscountPct(product.discount)}
        </span>
      ) : null}

      <div className="relative aspect-square w-full shrink-0 bg-white">
        <SafeRemoteImage
          src={product.photo}
          alt={displayName}
          fill
          sizes="(max-width: 560px) 50vw, (max-width: 899px) 33vw, (max-width: 1220px) 20vw, 16vw"
          className="object-contain p-2.5"
          fallbackClassName="object-contain opacity-40 p-6"
        />
        {decorated.oos ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/72 text-[12px] font-extrabold tracking-wide text-warn sm:text-[13px]">
            OUT OF STOCK
          </div>
        ) : null}
        {decorated.showOnly ? (
          <div className="absolute inset-x-0 bottom-0 bg-white/90 px-2 py-1 text-center text-[10.5px] font-bold text-warn">
            Only {product.only} left
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5 p-2.5 pb-3 sm:p-3 sm:pb-3.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold leading-none text-muted sm:text-[11.5px]">
          <span className="inline-flex items-center gap-0.5 text-warn">
            <Star size={11} className="fill-current" strokeWidth={0} />
            {(product.rating ?? 0).toFixed(1)}
          </span>
          <span className="opacity-40">·</span>
          <span className="min-w-0 truncate">
            {product.sub?.trim() || product.unit}
          </span>
        </div>

        <div className="line-clamp-2 h-[2.56em] text-[12.5px] font-bold leading-[1.28] text-ink sm:text-[13.5px]">
          {product.name}
        </div>

        <div className="flex h-[38px] items-end justify-between gap-1.5">
          <div className="flex min-w-0 flex-col justify-end leading-tight">
            <span className="text-[14px] font-extrabold text-ink sm:text-base">
              {formatMoney(product.price)}
            </span>
            <span
              className={`text-[11px] leading-[1.2] sm:text-xs ${
                decorated.hasDiscount ? "text-muted line-through" : "invisible"
              }`}
            >
              {formatMoney(decorated.hasDiscount ? product.mrp : 0)}
            </span>
          </div>

          {decorated.oos ? (
            <button
              disabled
              className="flex h-[38px] w-[38px] shrink-0 cursor-not-allowed flex-col items-center justify-center rounded-full bg-[#eef1ea] text-[8px] font-extrabold leading-[1.05] text-[#9aa79a] sm:text-[9px]"
            >
              SOLD
              <span>OUT</span>
            </button>
          ) : decorated.inCart ? (
            <QuantityStepper
              qty={decorated.qty}
              onInc={() => increment(product.id)}
              onDec={() => decrement(product.id)}
              variant="circle"
              disableInc={decorated.qty >= 6}
            />
          ) : (
            <button
              type="button"
              aria-label={`Add ${displayName} to cart`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addToCart(product.id, undefined, product);
              }}
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-[0_6px_14px_-4px_rgba(68,106,32,0.55)] transition-transform duration-150 hover:scale-105 active:scale-95"
            >
              <Plus size={18} strokeWidth={2.8} />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
