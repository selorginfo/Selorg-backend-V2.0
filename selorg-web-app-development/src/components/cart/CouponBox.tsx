"use client";

import { useCart } from "@/context/CartContext";
import { useUI } from "@/context/UIContext";
import { useCouponList } from "@/hooks/useCouponList";

export function CouponBox() {
  const { coupon, setCoupon, couponApplied, applyCoupon, removeCoupon, totals } = useCart();
  const { showToast } = useUI();
  const { coupons } = useCouponList(totals.sub);

  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-[18px]">
      <h3 className="mb-2.5 text-sm font-extrabold">Apply coupon</h3>

      {couponApplied ? (
        <div className="flex items-center justify-between rounded-[11px] border border-dashed border-accent bg-accent-tint px-[14px] py-[11px]">
          <span className="text-[13px] font-extrabold text-accent-dark">✓ {couponApplied.code} applied</span>
          <button onClick={removeCoupon} className="text-xs font-bold text-warn">
            Remove
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="Enter code"
              className="h-11 flex-1 rounded-[11px] border-[1.5px] border-line px-3.5 text-sm font-semibold uppercase outline-none focus:border-accent"
            />
            <button
              onClick={() => applyCoupon()}
              className="rounded-[11px] bg-accent-dark px-[18px] text-[13.5px] font-bold text-white"
            >
              Apply
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {coupons.map((c) => (
              <button
                key={c.code}
                onClick={() => {
                  setCoupon(c.code);
                  void navigator.clipboard?.writeText(c.code);
                  showToast(`Copied ${c.code}`);
                }}
                className="rounded-[7px] border border-dashed border-[#c9ccc0] bg-[#f4f4ef] px-[9px] py-[5px] text-[11px] font-extrabold tracking-wide"
              >
                {c.code}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
