import Image from "next/image";
import Link from "next/link";
import { Bell, LayoutGrid, Search, ShoppingCart, Tag, User } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Context-free header markup used for SSR + the client's first hydration paint.
 * Must stay free of auth/cart/categories/delivery reads so server HTML and the
 * hydration pass are identical. `Header` swaps this for the live header after mount.
 */
export function HeaderStaticChrome({
  hideMobileCategoryStrip = false,
}: {
  hideMobileCategoryStrip?: boolean;
}) {
  return (
    <div className="relative z-40 shrink-0">
      <header className="border-b border-line bg-white">
        <div className="wrap hidden h-[70px] items-center gap-4 min-[861px]:flex">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image
              src="/selorg-logo.png"
              alt="Selorg"
              width={56}
              height={56}
              className="rounded-2xl object-cover"
              priority
              loading="eager"
              unoptimized
            />
          </Link>

          <div className="shrink-0">
            <div className="flex max-w-[220px] items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-left">
              <span className="flex min-w-0 flex-col items-start">
                <span className="text-[11px] font-semibold text-muted">
                  Delivery in <b className="text-accent-dark">soon</b>
                </span>
                <span className="max-w-[200px] truncate text-[13.5px] font-bold">Set your location</span>
              </span>
            </div>
          </div>

          <div className="relative min-w-0 flex-1">
            <div className="relative min-w-0 flex-1">
              <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-muted" />
              <input
                readOnly
                placeholder="Search for products…"
                className="h-[44px] w-full rounded-[13px] border-[1.5px] border-line bg-white pl-[42px] pr-4 text-sm font-medium outline-none min-[861px]:h-[46px]"
                autoComplete="off"
                tabIndex={-1}
                aria-hidden
              />
            </div>
          </div>

          <Link
            href="/offers"
            className="flex shrink-0 flex-col items-center gap-0.5 px-1.5 text-[11px] font-bold text-warn"
          >
            <Tag size={18} />
            Offers
          </Link>
          <Link
            href="/account/notifications"
            className="relative flex shrink-0 flex-col items-center gap-0.5 px-1.5 text-[11px] font-semibold text-ink"
          >
            <Bell size={18} />
            Alerts
          </Link>
          <Link href="/account/profile" className="flex shrink-0 items-center gap-2 px-1">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent-tint text-sm font-extrabold text-accent-dark">
              <User size={16} />
            </span>
            <span className="text-[13.5px] font-bold">Account</span>
          </Link>

          <span className="relative flex h-[46px] shrink-0 items-center gap-2 rounded-[13px] bg-accent px-[18px] text-sm font-bold text-white">
            <ShoppingCart size={18} />
            <span>Cart</span>
          </span>
        </div>

        <div className="wrap flex flex-col gap-2.5 overflow-visible py-2.5 min-[861px]:hidden">
          <div className="relative z-10 flex items-center gap-2.5 overflow-visible">
            <Link href="/" className="flex shrink-0 items-center">
              <Image
                src="/selorg-logo.png"
                alt="Selorg"
                width={44}
                height={44}
                className="rounded-[14px] object-cover"
                priority
                loading="eager"
                unoptimized
              />
            </Link>
            <div className="relative min-w-0 flex-1">
              <div className="flex w-full max-w-full items-center gap-1.5 rounded-[10px] bg-accent-tint px-2.5 py-2 text-left text-xs font-bold text-accent-dark">
                <span className="min-w-0 flex-1 truncate">Set your location</span>
              </div>
            </div>
            <Link
              href="/auth"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-dark"
              aria-label="Account"
            >
              <User size={16} />
            </Link>
          </div>

          <div className="relative min-w-0 flex-1">
            <div className="flex items-center gap-0">
              <div className="relative min-w-0 flex-1">
                <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-muted" />
                <input
                  readOnly
                  placeholder="Search for products…"
                  className="h-[44px] w-full rounded-[13px] border-[1.5px] border-line bg-white pl-[42px] pr-4 text-sm font-medium outline-none focus:border-accent min-[861px]:h-[46px]"
                  autoComplete="off"
                  tabIndex={-1}
                  aria-hidden
                />
              </div>
              <span className="ml-2 hidden h-[44px] shrink-0 items-center rounded-[13px] bg-accent px-3.5 text-[13px] font-extrabold text-white min-[480px]:inline-flex">
                Search
              </span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "wrap no-scrollbar flex items-stretch gap-3 overflow-x-auto border-t border-line pb-2.5 pt-2.5 min-[861px]:hidden",
            hideMobileCategoryStrip && "hidden",
          )}
        >
          <Link href="/" className="flex w-[58px] shrink-0 flex-col items-center gap-1.5">
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-accent text-white">
              <LayoutGrid size={22} />
            </span>
            <span className="max-w-[58px] truncate text-center text-[11px] font-bold text-accent-dark">All</span>
          </Link>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={`cat-skeleton-${i}`} className="flex w-[58px] shrink-0 flex-col items-center gap-1.5">
              <span className="h-[52px] w-[52px] animate-pulse rounded-[14px] bg-line/50" />
              <span className="h-2.5 w-10 animate-pulse rounded bg-line/40" />
            </div>
          ))}
        </div>
      </header>
    </div>
  );
}
