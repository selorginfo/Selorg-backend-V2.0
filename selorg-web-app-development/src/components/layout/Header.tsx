"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { SafeRemoteImage } from "@/components/ui/SafeRemoteImage";
import Link from "next/link";
import { Bell, LayoutGrid, Package, Search, ShoppingCart, Tag, User, Zap } from "lucide-react";
import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { useMounted } from "@/hooks/useMounted";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCart } from "@/context/CartContext";
import { LocationPicker } from "./LocationPicker";
import { HeaderStaticChrome } from "./HeaderStaticChrome";
import { useUI } from "@/context/UIContext";
import { useAppConfig } from "@/context/AppConfigContext";
import { useAuth } from "@/context/AuthContext";
import { useCategories } from "@/context/CategoriesContext";
import { useNotificationsInbox } from "@/context/NotificationsInboxContext";
import { useOrders } from "@/context/OrdersContext";
import { useDelivery } from "@/context/DeliveryContext";
import { categoryHref } from "@/lib/categories";
import { isLiveTrackableOrder } from "@/lib/orders";
import { productService } from "@/services/productService";
import { formatMoney } from "@/lib/money";
import { productDisplayName } from "@/lib/products";
import { cn } from "@/lib/cn";

/**
 * SSR + first client paint render context-free chrome so hydration cannot diverge
 * from auth/cart/categories/delivery. Live header mounts after `useMounted`.
 */
export function Header() {
  const mounted = useMounted();
  const pathname = usePathname();
  if (!mounted) {
    const hideMobileCategoryStrip =
      pathname.startsWith("/cart") ||
      pathname.startsWith("/orders") ||
      pathname.startsWith("/account") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/checkout");
    return <HeaderStaticChrome hideMobileCategoryStrip={hideMobileCategoryStrip} />;
  }
  return <HeaderLive />;
}

function HeaderLive() {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<
    { name: string; imageUrl?: string; price?: number }[]
  >([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const searchRefDesktop = useRef<HTMLDivElement>(null);
  const searchRefMobile = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const { totals } = useCart();
  const { openDrawer } = useUI();
  const { authReady, auth, profile } = useAuth();
  const { categories, loading: categoriesLoading } = useCategories();
  const { pricing, searchPlaceholder } = useAppConfig();
  const { unreadCount } = useNotificationsInbox();
  const { activeOrder } = useOrders();
  const { promiseText } = useDelivery();

  // Past the mount gate in `Header` — safe to branch on auth/cart here.
  const showPromo = authReady && !auth.loggedIn;
  const showAuthed = authReady && auth.loggedIn;
  const showActiveOrderBar = showAuthed && !!activeOrder && isLiveTrackableOrder(activeOrder);
  const deliveryLabel = promiseText ?? "fast delivery";
  const hideMobileCategoryStrip =
    pathname.startsWith("/cart") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/checkout");

  const initials = profile.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 1) {
      const timer = window.setTimeout(() => {
        setSuggestions([]);
        setSuggestionsLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    const startTimer = window.setTimeout(() => setSuggestionsLoading(true), 0);
    productService.getSearchSuggestions(q).then((items) => {
      if (!cancelled) {
        setSuggestions(items);
        setSuggestionsLoading(false);
        setSuggestionsOpen(true);
        setHighlightIndex(-1);
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
    };
  }, [debouncedQuery]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      const inDesktop = searchRefDesktop.current?.contains(t);
      const inMobile = searchRefMobile.current?.contains(t);
      if (!inDesktop && !inMobile) setSuggestionsOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const goToSearch = (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length >= 2) {
      setSuggestionsOpen(false);
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (highlightIndex >= 0 && suggestions[highlightIndex]) {
      goToSearch(suggestions[highlightIndex].name);
      return;
    }
    goToSearch(searchQuery);
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setSuggestionsOpen(false);
    }
  };

  const renderSearch = (
    ref: RefObject<HTMLDivElement | null>,
    opts?: { showSearchButton?: boolean },
  ) => (
    <div ref={ref} className="relative min-w-0 flex-1">
      <form onSubmit={onSearchSubmit} className="flex items-center gap-0">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSuggestionsOpen(true);
            }}
            onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
            onKeyDown={onSearchKeyDown}
            placeholder={searchPlaceholder}
            className="h-[44px] w-full rounded-[13px] border-[1.5px] border-line bg-white pl-[42px] pr-4 text-sm font-medium outline-none focus:border-accent min-[861px]:h-[46px]"
            autoComplete="off"
          />
        </div>
        {opts?.showSearchButton ? (
          <button
            type="submit"
            className="ml-2 hidden h-[44px] shrink-0 items-center rounded-[13px] bg-accent px-3.5 text-[13px] font-extrabold text-white min-[480px]:inline-flex"
          >
            Search
          </button>
        ) : null}
      </form>

      {suggestionsOpen && searchQuery.trim().length >= 1 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-[13px] border border-line bg-white shadow-lg">
          {suggestionsLoading ? (
            <div className="px-4 py-3 text-sm text-muted">Searching…</div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted">No suggestions — press Enter to search</div>
          ) : (
            suggestions.map((s, i) => (
              <button
                key={`${s.name}-${i}`}
                type="button"
                onClick={() => goToSearch(s.name)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent-tint ${
                  i === highlightIndex ? "bg-accent-tint" : ""
                }`}
              >
                <span className="flex-1 font-semibold">{productDisplayName(s.name)}</span>
                {s.price != null ? (
                  <span className="text-xs font-bold text-accent-dark">{formatMoney(s.price)}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );

  // Promo / active-order bars only exist after mount+authReady. Render the
  // wrapper only when one of them is visible so SSR and hydration both skip
  // an empty <div> (that empty node was the hydration mismatch source).
  const topBars =
    showPromo || (showActiveOrderBar && activeOrder) ? (
      <div>
        {showPromo ? (
          <div
            className="flex flex-wrap items-center justify-center gap-2.5 px-4 py-2 text-center text-[13px] font-semibold text-white"
            style={{ background: "linear-gradient(90deg, var(--color-accent-dark), var(--color-accent))" }}
          >
            <Zap size={15} className="shrink-0 fill-white" />
            <span>
              Free delivery on orders over {formatMoney(pricing.freeDeliveryThreshold)} · Fresh &amp;
              organic, delivered in {deliveryLabel}
            </span>
            <Link
              href={categories[0] ? categoryHref(categories[0]) : "/"}
              className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-accent-dark"
            >
              Shop Now
            </Link>
          </div>
        ) : null}

        {showActiveOrderBar && activeOrder ? (
          <Link
            href={`/orders/${activeOrder.id}`}
            className="flex items-center justify-center gap-2 bg-accent px-4 py-2 text-center text-[12.5px] font-bold text-white"
          >
            <Package size={14} />
            Active order · {activeOrder.status} · {activeOrder.eta}
          </Link>
        ) : null}
      </div>
    ) : null;

  // Single root (no Fragment) so null topBars cannot shift the header's
  // sibling index during hydration under Next/React 19.
  // Shop layout is a viewport shell (h-dvh) — header is shrink-0 outside
  // the scrollport, so it stays fixed without position:sticky.
  // suppressHydrationWarning: browser extensions often inject nodes/attrs
  // into the chrome before hydrate; a mismatch here used to tear down the
  // Suspense placeholders and crash React's $RS streaming runtime.
  return (
    <div className="relative z-40 shrink-0" suppressHydrationWarning>
      {topBars}

      <header className="border-b border-line bg-white" suppressHydrationWarning>
        {/* Desktop: single row */}
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
            <LocationPicker />
          </div>

          {renderSearch(searchRefDesktop)}

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
            {showAuthed && unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warn px-1 text-[10px] font-extrabold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Link>
          <Link href="/account/profile" className="flex shrink-0 items-center gap-2 px-1">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent-tint text-sm font-extrabold text-accent-dark">
              {showAuthed ? initials || "U" : <User size={16} />}
            </span>
            <span className="text-[13.5px] font-bold">
              {showAuthed ? profile.name.split(" ")[0] : "Account"}
            </span>
          </Link>

          <button
            onClick={openDrawer}
            className="relative flex h-[46px] shrink-0 items-center gap-2 rounded-[13px] bg-accent px-[18px] text-sm font-bold text-white"
          >
            <ShoppingCart size={18} />
            <span>Cart</span>
            {totals.count > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-extrabold text-accent-dark">
                {totals.count}
              </span>
            ) : null}
          </button>
        </div>

        {/* Mobile / tablet: stacked chrome */}
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
              <LocationPicker compact />
            </div>
            <Link
              href={showAuthed ? "/account/profile" : "/auth"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-dark"
              aria-label="Account"
            >
              {showAuthed ? (
                <span className="text-[12px] font-extrabold">{initials || "U"}</span>
              ) : (
                <User size={16} />
              )}
            </Link>
          </div>

          {renderSearch(searchRefMobile, { showSearchButton: true })}
        </div>

        {/* Mobile category strip — hidden on cart / orders / account flows and on desktop */}
        <div
          className={cn(
            "wrap no-scrollbar flex items-stretch gap-3 overflow-x-auto border-t border-line pb-2.5 pt-2.5 min-[861px]:hidden",
            hideMobileCategoryStrip && "hidden",
          )}
        >
          <Link
            href="/"
            className="flex w-[58px] shrink-0 flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "flex h-[52px] w-[52px] items-center justify-center rounded-[14px]",
                pathname === "/" ? "bg-accent text-white" : "bg-accent-tint text-accent-dark",
              )}
            >
              <LayoutGrid size={22} />
            </span>
            <span
              className={cn(
                "max-w-[58px] truncate text-center text-[11px] font-bold",
                pathname === "/" ? "text-accent-dark" : "text-muted",
              )}
            >
              All
            </span>
          </Link>

          {categoriesLoading
            ? Array.from({ length: 6 }, (_, i) => (
                <div key={`cat-skeleton-${i}`} className="flex w-[58px] shrink-0 flex-col items-center gap-1.5">
                  <span className="h-[52px] w-[52px] animate-pulse rounded-[14px] bg-line/50" />
                  <span className="h-2.5 w-10 animate-pulse rounded bg-line/40" />
                </div>
              ))
            : null}

          {categories.map((c, i) => {
            const href = categoryHref(c);
            const active = pathname === href;
            return (
              <Link
                key={`${c.id}-${i}`}
                href={href}
                prefetch={false}
                className="flex w-[58px] shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "relative h-[52px] w-[52px] overflow-hidden rounded-[14px] border",
                    active ? "border-accent ring-2 ring-accent/25" : "border-line",
                  )}
                  style={{ background: c.bg }}
                >
                  <SafeRemoteImage src={c.photo} alt="" fill sizes="52px" className="object-cover" fallbackClassName="object-contain opacity-40 p-1" />
                </span>
                <span
                  className={cn(
                    "max-w-[58px] truncate text-center text-[11px] font-bold leading-tight",
                    active ? "text-accent-dark" : "text-muted",
                  )}
                >
                  {c.name}
                </span>
              </Link>
            );
          })}
        </div>
      </header>
    </div>
  );
}
