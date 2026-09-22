"use client";

import { SafeRemoteImage } from "@/components/ui/SafeRemoteImage";
import Link from "next/link";
import { Heart, Leaf, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatMoney } from "@/lib/money";
import { productDisplayName } from "@/lib/products";
import { QuantityStepper } from "@/components/product/QuantityStepper";
import type { CartLine } from "@/types";

export function CartItemRow({ line }: { line: CartLine }) {
  const { increment, decrement, removeItem, saveForLater } = useCart();
  const hasDiscount = line.variant.mrp > line.variant.price;
  const displayName = productDisplayName(line.product.name);

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-app border border-line bg-white p-4">
      <Link
        href={`/product/${line.product.id}`}
        className="relative h-[70px] w-[70px] shrink-0 overflow-hidden rounded-[14px] bg-[#f6f6f0] xs:h-[82px] xs:w-[82px]"
      >
        <SafeRemoteImage src={line.product.photo} alt={displayName} fill sizes="82px" className="object-cover" fallbackClassName="object-contain opacity-40 p-2" />
      </Link>
      <div className="min-w-[150px] flex-1">
        <Link href={`/product/${line.product.id}`} className="text-[15px] font-extrabold leading-[1.25] text-ink">
          {line.product.name}
        </Link>
        <div className="mt-[2px] text-[12.5px] text-muted">
          {line.variant.label} · {line.product.brand}
        </div>
        <div className="mt-[6px] inline-flex items-center gap-[5px] text-[11.5px] font-bold text-accent-dark">
          <Leaf size={12} /> Assured Organic
        </div>
        <div className="mt-[6px] flex items-center gap-2">
          <span className="text-[15px] font-extrabold">{formatMoney(line.variant.price)}</span>
          {hasDiscount ? (
            <span className="text-[12.5px] text-muted line-through">{formatMoney(line.variant.mrp)}</span>
          ) : null}
          {hasDiscount ? (
            <span className="text-xs font-bold text-accent-dark">
              You save {formatMoney(line.variant.mrp - line.variant.price)}
            </span>
          ) : null}
        </div>
        <div className="mt-[10px] flex gap-[14px]">
          <button
            onClick={() => saveForLater(line.product.id)}
            className="inline-flex items-center gap-[5px] text-[12.5px] font-bold text-accent-dark"
          >
            <Heart size={12} /> Save for later
          </button>
          <button
            onClick={() => removeItem(line.product.id)}
            className="inline-flex items-center gap-[5px] text-[12.5px] font-bold text-warn"
          >
            <Trash2 size={12} /> Remove
          </button>
        </div>
      </div>
      <div className="ml-auto flex flex-col items-end gap-[10px]">
        <QuantityStepper
          qty={line.qty}
          size="sm"
          onInc={() => increment(line.product.id)}
          onDec={() => decrement(line.product.id)}
          disableInc={line.qty >= 6}
        />
        {line.qty >= 6 && (
          <span className="text-[11px] font-semibold text-warn">Max limit reached</span>
        )}
        <span className="text-base font-extrabold">{formatMoney(line.lineTotal)}</span>
      </div>
    </div>
  );
}
