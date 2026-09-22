"use client";

import { Tag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCouponList } from "@/hooks/useCouponList";

export function ExclusiveOffers() {
  const { couponApplied, setCoupon, applyCoupon, totals } = useCart();
  const { coupons } = useCouponList(totals.sub);

  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-[18px]">
      <h3 className="mb-3 text-sm font-extrabold">Exclusive offers for you</h3>
      <div className="flex flex-col gap-3">
        {coupons.map((c) => {
          const applied = couponApplied?.code === c.code;
          return (
            <div key={c.code} className="flex items-center gap-2.5">
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent-tint">
                <Tag size={15} className="text-accent-dark" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-extrabold tracking-[0.4px]">{c.code}</div>
                <div className="text-[11.5px] text-muted">
                  {c.desc} · {c.cond}
                </div>
              </div>
              {applied ? (
                <span className="text-xs font-extrabold text-accent-dark">Applied</span>
              ) : (
                <button
                  onClick={() => {
                    setCoupon(c.code);
                    applyCoupon(c.code);
                  }}
                  className="text-[12.5px] font-extrabold text-accent-dark"
                >
                  Apply
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
