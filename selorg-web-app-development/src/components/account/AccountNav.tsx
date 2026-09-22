"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  FileText,
  Headphones,
  LogOut,
  MapPin,
  Package,
  RefreshCw,
  User,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/account/profile", label: "My Profile", Icon: User },
  { href: "/account/orders", label: "My Orders", Icon: Package },
  { href: "/account/addresses", label: "Saved Addresses", Icon: MapPin },
  { href: "/account/wallet", label: "Selorg Wallet", Icon: Wallet },
  { href: "/account/notifications", label: "Notifications", Icon: Bell },
  { href: "/account/refunds", label: "Refunds", Icon: RefreshCw },
  { href: "/account/help", label: "Help & Support", Icon: Headphones },
  { href: "/account/policies", label: "Policies", Icon: FileText },
];

export function AccountNav() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const { openModal } = useUI();

  return (
    <aside className="rounded-app border border-line bg-white p-4 min-[861px]:sticky min-[861px]:top-4 min-[861px]:self-start">
      <div className="mb-3 flex items-center gap-3 border-b border-line pb-4">
        <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-accent text-lg font-extrabold text-white">
          {profile.name.charAt(0)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-extrabold">{profile.name}</div>
          <div className="truncate text-xs text-muted">{profile.phone}</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href !== "/account/profile" && pathname.startsWith(href));
          return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-bold",
              active ? "bg-accent-tint text-accent-dark" : "text-ink hover:bg-black/5",
            )}
          >
            <Icon size={17} className="shrink-0" /> {label}
          </Link>
          );
        })}
      </nav>

      <button
        onClick={() => openModal({ type: "logout" })}
        className="mt-2 flex w-full items-center gap-2.5 rounded-xl border-t border-line px-3 pb-1 pt-3.5 text-left text-[13.5px] font-bold text-warn"
      >
        <LogOut size={16} /> Log out
      </button>
    </aside>
  );
}
