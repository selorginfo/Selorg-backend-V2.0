"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Tag, Ticket, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useUI } from "@/context/UIContext";
import { useCouponList } from "@/hooks/useCouponList";
import { contentService, type FaqItem } from "@/services/contentService";
import { OffersPageSkeleton } from "@/components/ui/page-skeletons";
import type { Coupon } from "@/types";

function headline(c: Coupon): string {
  if (c.flat) return `₹${c.flat} OFF`;
  if (c.pct) return `${c.pct}% OFF`;
  return c.desc;
}

function offerKind(c: Coupon): string {
  if (c.pct) return "EXTRA";
  if (c.flat) return "FLAT";
  return "OFFER";
}

function minOrderLine(c: Coupon): string {
  return c.min ? `On orders above ₹${c.min}` : "No minimum order";
}

function useOffersFaq(): FaqItem[] {
  const [faq, setFaq] = useState<FaqItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    contentService
      .getFaq("Offers")
      .then((result) => {
        if (!cancelled) setFaq(result.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return faq;
}

export function OffersClient() {
  const router = useRouter();
  const { authReady, auth } = useAuth();
  const { couponApplied, setCoupon, applyCoupon, totals } = useCart();
  const { showToast } = useUI();
  const { coupons, loading: couponsLoading } = useCouponList(totals.sub);
  const faq = useOffersFaq();

  const isLoggedIn = authReady && auth.loggedIn;

  if (couponsLoading) {
    return <OffersPageSkeleton />;
  }

  return (
    <div className="wrap pb-9 pt-3 min-[861px]:pt-[18px]">
      <div className="mb-5 flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-end min-[900px]:justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-accent-dark min-[861px]:hidden"
          >
            <ArrowLeft size={18} /> Back
          </button>
          <h1 className="font-sans text-[26px] font-extrabold tracking-[-0.8px] min-[861px]:text-[32px]">
            Offers &amp; Deals
          </h1>
          <p className="mt-1 max-w-[520px] text-[14px] text-muted">
            Save more with exclusive coupons, discounts &amp; cashback.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 min-[560px]:gap-3">
          <div className="rounded-2xl border border-line bg-white px-3 py-3 min-[560px]:px-4">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted">
              <Tag size={13} className="text-accent-dark" />
              <span>Available offers</span>
            </div>
            <div className="mt-1 text-[20px] font-extrabold text-ink min-[560px]:text-[22px]">
              {coupons.length}
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-white px-3 py-3 min-[560px]:px-4">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted">
              <Ticket size={13} className="text-accent-dark" />
              <span>Coupon codes</span>
            </div>
            <div className="mt-1 text-[20px] font-extrabold text-ink min-[560px]:text-[22px]">
              {coupons.length}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 min-[941px]:grid-cols-[220px_minmax(0,1fr)] min-[941px]:gap-6">
        <aside className="flex flex-col gap-3">
          <div className="rounded-2xl border border-line bg-white p-2">
            <div className="flex w-full items-center justify-between rounded-xl bg-accent-tint px-3.5 py-3 text-left text-[13.5px] font-bold text-accent-dark">
              <span>Coupon codes</span>
              <span className="tabular-nums">{coupons.length}</span>
            </div>
          </div>

          {!isLoggedIn ? (
            <div className="rounded-2xl border border-line bg-white p-4">
              <div className="mb-1 flex items-center gap-2 text-[14px] font-extrabold text-ink">
                <User size={16} className="text-accent-dark" /> Exclusive for you
              </div>
              <p className="mb-3 text-[12.5px] text-muted">
                Sign in for faster checkout and personalized deals.
              </p>
              <Link
                href="/auth"
                className="flex h-11 items-center justify-center rounded-xl bg-accent text-[13px] font-extrabold text-white"
              >
                Login / Sign up
              </Link>
            </div>
          ) : null}
        </aside>

        <div className="min-w-0 flex flex-col gap-6">
          <section>
            <div className="mb-3.5 flex items-end justify-between gap-3">
              <h2 className="font-sans text-[20px] font-extrabold tracking-[-0.5px] min-[861px]:text-[22px]">
                Exclusive coupon codes
              </h2>
              {coupons.length > 0 ? (
                <span className="text-[12.5px] font-bold text-muted">{coupons.length} available</span>
              ) : null}
            </div>

            {coupons.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-8 text-center text-sm text-muted">
                No coupon codes available right now. Check back soon.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 min-[1100px]:grid-cols-4">
                {coupons.map((c) => {
                  const applied = couponApplied?.code === c.code;
                  const head = headline(c);
                  return (
                    <div
                      key={c.code}
                      className="flex flex-col rounded-2xl border border-line bg-white p-4 shadow-[0_8px_20px_-16px_rgba(40,60,20,0.35)]"
                    >
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-muted">
                        {offerKind(c)}
                      </div>
                      <div className="mt-1 font-sans text-[22px] font-extrabold tracking-[-0.5px] text-accent-dark">
                        {head}
                      </div>
                      <div className="mt-1 text-[12.5px] text-muted">{minOrderLine(c)}</div>
                      {head !== c.desc ? (
                        <div className="mt-1 line-clamp-2 text-[12px] text-[#5a6b47]">{c.desc}</div>
                      ) : null}

                      <div className="mt-4 flex items-center gap-2">
                        <div className="min-w-0 flex-1 truncate rounded-[10px] border border-dashed border-line px-2.5 py-2.5 text-center text-[12px] font-extrabold tracking-[0.5px] text-ink">
                          {c.code}
                        </div>
                        {applied ? (
                          <span className="shrink-0 rounded-full bg-accent-tint px-3 py-2 text-[12px] font-extrabold text-accent-dark">
                            Applied
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setCoupon(c.code);
                              void navigator.clipboard?.writeText(c.code);
                              applyCoupon(c.code);
                              showToast(`${c.code} copied`);
                            }}
                            className="shrink-0 rounded-full bg-accent-tint px-3 py-2 text-[12px] font-bold text-accent-dark"
                          >
                            Copy Code
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {faq.length > 0 ? (
            <section>
              <h2 className="mb-3.5 font-sans text-[20px] font-extrabold tracking-[-0.5px] min-[861px]:text-[22px]">
                How offers work
              </h2>
              <div className="rounded-app border border-line bg-white px-5 py-1.5 min-[861px]:px-[22px]">
                {faq.map((f, i) => (
                  <div
                    key={f.id}
                    className={i < faq.length - 1 ? "border-b border-line py-4" : "py-4"}
                  >
                    <div className="text-[14.5px] font-extrabold">{f.question}</div>
                    <p className="mt-1.5 text-[13.5px] leading-[1.65] text-muted">{f.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
