"use client";

import Link from "next/link";
import { Leaf, Lock, MessageCircle, Phone, RefreshCw, Truck } from "lucide-react";
import { useDelivery } from "@/context/DeliveryContext";
import { useCouponList } from "@/hooks/useCouponList";

const WHY_ITEMS_BASE = [
  { Icon: Leaf, title: "100% Organic", sub: "Certified & farm-sourced" },
  { Icon: Truck, title: "Fast delivery", sub: "Fresh, at your door" },
  { Icon: RefreshCw, title: "Easy returns", sub: "On-delivery quality check" },
  { Icon: Lock, title: "Secure payments", sub: "Safe & encrypted" },
];

export function CategoryRightRail() {
  const { promiseText } = useDelivery();
  const deliveryTitle = promiseText ? `${promiseText} delivery` : "Fast delivery";
  const WHY_ITEMS = WHY_ITEMS_BASE.map((item) =>
    item.Icon === Truck ? { ...item, title: deliveryTitle } : item,
  );

  // This card used to advertise a fabricated "SELORG10" code that `/coupons/validate`
  // rejects. Show a real coupon, or nothing at all.
  const { coupons } = useCouponList();
  const promo = coupons[0];

  return (
    <aside className="hidden min-[1221px]:sticky min-[1221px]:top-4 min-[1221px]:flex min-[1221px]:max-h-[calc(100dvh-6rem)] min-[1221px]:flex-col min-[1221px]:gap-4 min-[1221px]:self-start min-[1221px]:overflow-y-auto">
      {promo ? (
        <div className="rounded-2xl bg-[#20241c] p-5 text-white">
          <div className="font-sans text-[22px] font-extrabold tracking-[-0.5px]">
            {promo.flat ? `₹${promo.flat} OFF` : promo.pct ? `${promo.pct}% OFF` : promo.desc}
          </div>
          <div className="mt-0.5 text-[13px] opacity-85">{promo.cond}</div>
          <div className="my-3.5 rounded-[9px] border border-dashed border-white/50 px-3 py-2 text-[12.5px] font-bold">
            Use code: <b>{promo.code}</b>
          </div>
          <Link
            href="/offers"
            className="block h-[42px] w-full rounded-[11px] bg-accent text-center text-sm font-extrabold leading-[42px] text-white"
          >
            View all offers
          </Link>
        </div>
      ) : null}

      <div className="rounded-2xl border border-line bg-white p-[18px]">
        <div className="mb-3.5 text-[15px] font-extrabold">Why shop on Selorg?</div>
        <div className="flex flex-col gap-3.5">
          {WHY_ITEMS.map(({ Icon, title, sub }) => (
            <div key={title} className="flex items-start gap-[11px]">
              <Icon size={17} className="mt-0.5 shrink-0 text-accent-dark" />
              <div>
                <div className="text-[13px] font-bold">{title}</div>
                <div className="text-[11.5px] text-muted">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-[18px]">
        <div className="mb-1 text-[15px] font-extrabold">Need help?</div>
        <p className="mb-3 text-xs text-muted">We&apos;re here for you, every day.</p>
        <div className="flex flex-col gap-[9px] text-[12.5px] font-semibold">
          <Link href="/account/help#chat" className="flex items-center gap-[9px] text-accent-dark">
            <MessageCircle size={15} /> Chat with us
          </Link>
          <Link href="/account/help" className="flex items-center gap-[9px] text-accent-dark">
            <Phone size={15} /> Contact support
          </Link>
        </div>
      </div>
    </aside>
  );
}
