"use client";

import Image from "next/image";
import Link from "next/link";
import { useCategories } from "@/context/CategoriesContext";
import { categoryHref } from "@/lib/categories";
import { cn } from "@/lib/cn";

// "About Us"/"Careers" used to point at `/pages/*`, which is neither a route in
// this app nor a published slug on `GET /pages/:slug`. Only real destinations here.
const COMPANY_LINKS = [
  { label: "Help & Support", href: "/help" },
  { label: "Policies", href: "/policies" },
  { label: "FAQ", href: "/faq" },
];

const APP_STORE_URL = "https://apps.apple.com/app/selorg";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.selorg.com";

function StoreBadges({ className }: { className?: string }) {
  const badgeClass =
    "relative block h-[40px] w-[135px] shrink-0 overflow-hidden rounded-[5px] leading-none transition-opacity hover:opacity-90";
  const imageClass = "object-fill";

  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", className)}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download on the App Store"
        className={badgeClass}
      >
        <Image
          src="/badges/app-store.svg"
          alt="Download on the App Store"
          fill
          sizes="135px"
          className={imageClass}
          unoptimized
        />
      </a>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get it on Google Play"
        className={badgeClass}
      >
        <Image
          src="/badges/google-play.png"
          alt="Get it on Google Play"
          fill
          sizes="135px"
          className={imageClass}
        />
      </a>
    </div>
  );
}

export function Footer({ className }: { className?: string } = {}) {
  // The Shop column used to hardcode slugs (`dairy`, `rice`, `dryfruits`) that
  // no category actually uses, so four of five links 404'd. Take the first few
  // real categories instead.
  const { categories } = useCategories();
  const shopLinks = [
    ...categories.slice(0, 4).map((c) => ({ label: c.name, href: categoryHref(c) })),
    { label: "Coupons & Offers", href: "/offers" },
  ];

  return (
    <footer className={cn("mt-5 w-full bg-[#20241c] text-[#c9ccc0]", className)}>
      {/* Compact mobile footer — full multi-column stays desktop */}
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-4 py-6 min-[861px]:hidden">
        <div className="flex items-center gap-3">
          <Image src="/selorg-logo.png" alt="Selorg" width={40} height={40} className="rounded-xl" />
          <p className="text-[12.5px] leading-relaxed text-[#9ba093]">
            Farm-fresh organic groceries, delivered fast.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[12.5px]">
          {[...COMPANY_LINKS, { label: "Offers", href: "/offers" }].map((l) => (
            <Link key={l.label} href={l.href} prefetch={false} className="hover:text-white">
              {l.label}
            </Link>
          ))}
        </div>
        <StoreBadges />
        <div className="border-t border-[#333a2c] pt-3 text-[11px] text-[#8a8f81]" suppressHydrationWarning>
          © {new Date().getFullYear()} Selorg. All rights reserved.
        </div>
      </div>

      <div className="mx-auto hidden w-full max-w-[1680px] grid-cols-1 gap-9 px-4 pb-5 pt-11 sm:grid-cols-2 sm:px-8 min-[861px]:grid lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div>
          <Image src="/selorg-logo.png" alt="Selorg" width={58} height={58} className="mb-3.5 rounded-[15px]" />
          <p className="max-w-[280px] text-[13px] leading-relaxed text-[#9ba093]">
            Farm-fresh, 100% organic groceries delivered to your door in minutes. Sourced
            responsibly, priced honestly.
          </p>
        </div>

        <div>
          <div className="mb-3 text-sm font-extrabold text-white">Shop</div>
          <div className="flex flex-col gap-2.5 text-[13px]">
            {shopLinks.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                prefetch={false}
                className="text-[#c9ccc0] hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 text-sm font-extrabold text-white">Company</div>
          <div className="flex flex-col gap-2.5 text-[13px]">
            {COMPANY_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                prefetch={false}
                className="text-[#c9ccc0] hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 text-sm font-extrabold text-white">Get the app</div>
          <p className="mb-3 text-[13px] leading-relaxed text-[#9ba093]">
            Fresh deals, faster checkout.
          </p>
          <StoreBadges />
        </div>
      </div>

      <div className="mx-auto hidden w-full max-w-[1680px] flex-wrap items-center justify-between gap-2 border-t border-[#333a2c] px-4 py-[18px] text-xs text-[#8a8f81] sm:px-8 min-[861px]:flex">
        <span suppressHydrationWarning>© {new Date().getFullYear()} Selorg. All rights reserved.</span>
        <span>Secure Payments · Fast Delivery · 24/7 Support</span>
      </div>
    </footer>
  );
}
