"use client";

import { useEffect, useState } from "react";
import { couponService, type CouponListItem } from "@/services/couponService";
import type { Coupon } from "@/types";

function toDisplayCoupon(c: CouponListItem): Coupon {
  const desc =
    c.displayName ||
    c.title ||
    c.description ||
    (c.discountType === "percentage" ? `${c.discountValue}% off` : `₹${c.discountValue} off`);
  const cond = c.minOrderValue ? `Min order ₹${c.minOrderValue}` : "No minimum order";
  // Carry the discount shape through so the offers page can render the same
  // "₹50 OFF" / "10% OFF" headline the design uses. Purely presentational —
  // the value still comes straight from the coupon payload.
  const shape =
    c.discountType === "percentage"
      ? { pct: c.discountValue }
      : c.discountValue != null
        ? { flat: c.discountValue }
        : {};
  return { code: c.code, desc, cond, min: c.minOrderValue ?? 0, ...shape };
}

/**
 * Real `GET /coupons` list, for guests and signed-in users alike — the endpoint
 * is public. There is deliberately no static fallback: showing a demo coupon the
 * backend has never heard of only produces an "Invalid coupon code" toast when
 * the customer tries to apply it.
 */
export function useCouponList(cartValue?: number): { coupons: Coupon[]; loading: boolean } {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    couponService.list(cartValue).then((list) => {
      if (cancelled) return;
      setCoupons(list.map(toDisplayCoupon));
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setCoupons([]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [cartValue]);

  return { coupons, loading };
}
