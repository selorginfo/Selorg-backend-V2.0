"use client";

import { useUI } from "@/context/UIContext";
import { useCouponList } from "@/hooks/useCouponList";

export function CouponStrip() {
  const { showToast } = useUI();
  const { coupons } = useCouponList();

  if (coupons.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 pdp:grid-cols-3">
      {coupons.map((c, i) => (
        <div
          key={`${c.code}-${i}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-app border-[1.5px] border-dashed border-accent bg-accent-tint px-5 py-[18px]"
        >
          <div className="min-w-0">
            <div className="text-base font-extrabold text-accent-dark">{c.desc}</div>
            <div className="mt-0.5 text-[12.5px] text-muted">{c.cond}</div>
            <div className="mt-2 inline-block rounded-[7px] bg-white px-2.5 py-1 text-xs font-extrabold tracking-[1px]">
              {c.code}
            </div>
          </div>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(c.code);
              showToast(`${c.code} copied`);
            }}
            className="shrink-0 whitespace-nowrap rounded-[10px] bg-accent px-3.5 py-[9px] text-[12.5px] font-bold text-white"
          >
            Copy code
          </button>
        </div>
      ))}
    </div>
  );
}
