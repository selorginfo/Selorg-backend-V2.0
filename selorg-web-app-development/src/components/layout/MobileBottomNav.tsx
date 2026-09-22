"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LayoutGrid, Package, ShoppingCart, User, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useCategories } from "@/context/CategoriesContext";
import { useMounted } from "@/hooks/useMounted";
import { categoryHref } from "@/lib/categories";
import { cn } from "@/lib/cn";

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useMounted();
  const { totals } = useCart();
  const { authReady, auth } = useAuth();
  const { categories, loading } = useCategories();
  const [catsOpen, setCatsOpen] = useState(false);

  // Gate on mounted so SSR + hydration always emit /auth; swap after mount.
  const accountHref =
    mounted && authReady && auth.loggedIn ? "/account/profile" : "/auth";

  useEffect(() => {
    setCatsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!catsOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [catsOpen]);

  const isHome = pathname === "/";
  const isOrders = pathname.startsWith("/orders");
  const isAccount = pathname.startsWith("/account") || pathname.startsWith("/auth");
  const isCategory = pathname.startsWith("/category");
  const isCart = pathname.startsWith("/cart");

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 overflow-visible border-t border-line bg-white min-[861px]:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className="relative mx-auto flex h-[64px] max-w-[1680px] items-center justify-between px-2">
          <TabLink href="/" label="Home" active={isHome} icon={<Home size={22} />} />

          <button
            type="button"
            onClick={() => setCatsOpen(true)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold",
              isCategory || catsOpen ? "text-accent-dark" : "text-muted",
            )}
          >
            <LayoutGrid size={22} />
            Categories
          </button>

          <Link
            href="/cart"
            aria-label="Open cart"
            className="flex w-[72px] shrink-0 flex-col items-center justify-center"
          >
            <span
              className={cn(
                "relative -mt-7 mb-1 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_24px_-8px_rgba(68,106,32,0.65)]",
                isCart ? "bg-accent-dark" : "bg-accent",
              )}
            >
              <ShoppingCart size={22} />
              {mounted && totals.count > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-warn px-1 text-[10px] font-extrabold text-white">
                  {totals.count > 9 ? "9+" : totals.count}
                </span>
              ) : null}
            </span>
            <span className={cn("text-[11px] font-bold", isCart ? "text-accent-dark" : "text-muted")}>
              Cart
            </span>
          </Link>

          <TabLink href="/orders" label="Orders" active={isOrders} icon={<Package size={22} />} />

          <TabLink href={accountHref} label="Account" active={isAccount} icon={<User size={22} />} />
        </div>
      </nav>

      {catsOpen ? (
        <div className="fixed inset-0 z-[60] min-[861px]:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close categories"
            onClick={() => setCatsOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-hidden rounded-t-[22px] bg-white shadow-2xl animate-drawerIn">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <h2 className="text-[16px] font-extrabold">All Categories</h2>
              <button
                type="button"
                onClick={() => setCatsOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-tint text-accent-dark"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[calc(78dvh-60px)] overflow-y-auto p-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
              {loading ? (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 9 }, (_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 p-2">
                      <span className="h-14 w-14 animate-pulse rounded-2xl bg-line/50" />
                      <span className="h-2.5 w-16 animate-pulse rounded bg-line/40" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {categories.map((c, i) => (
                    <button
                      key={`${c.id}-${i}`}
                      type="button"
                      onClick={() => {
                        setCatsOpen(false);
                        router.push(categoryHref(c));
                      }}
                      className="flex flex-col items-center gap-2 rounded-2xl p-2.5 text-center hover:bg-accent-tint"
                    >
                      <span
                        className="relative h-14 w-14 overflow-hidden rounded-2xl border border-line"
                        style={{ background: c.bg }}
                      >
                        <Image src={c.photo} alt="" fill sizes="56px" className="object-cover" />
                      </span>
                      <span className="line-clamp-2 text-[12px] font-bold leading-tight text-ink">
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TabLink({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold",
        active ? "text-accent-dark" : "text-muted",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
