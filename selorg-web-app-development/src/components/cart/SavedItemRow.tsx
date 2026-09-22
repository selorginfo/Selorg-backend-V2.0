"use client";

import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { formatMoney } from "@/lib/money";
import { productDisplayName } from "@/lib/products";
import type { CartLine } from "@/types";

export function SavedItemRow({ line }: { line: CartLine }) {
  const { moveToCart } = useCart();
  const displayName = productDisplayName(line.product.name);

  return (
    <div className="flex items-center gap-3.5 rounded-[14px] border border-line bg-white px-4 py-3">
      <div className="relative h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[11px] bg-[#f6f6f0]">
        <Image src={line.product.photo} alt={displayName} fill sizes="56px" className="object-cover" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm font-bold">{displayName}</span>
        <span className="text-[12.5px] text-muted">
          {line.variant.label} · {formatMoney(line.product.price)}
        </span>
      </div>
      <button
        onClick={() => moveToCart(line.product.id)}
        className="rounded-[10px] border-[1.5px] border-accent bg-accent-tint px-4 py-[9px] text-[12.5px] font-bold text-accent-dark"
      >
        Move to cart
      </button>
    </div>
  );
}
