"use client";

import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { useCategories } from "@/context/CategoriesContext";
import { SafeRemoteImage } from "@/components/ui/SafeRemoteImage";
import { categoryHref } from "@/lib/categories";

export function HomeSidebar() {
  const { categories, loading } = useCategories();

  return (
    <aside className="hidden min-[941px]:sticky min-[941px]:top-0 min-[941px]:flex min-[941px]:max-h-[calc(100dvh-5.5rem)] min-[941px]:flex-col min-[941px]:self-start">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex shrink-0 items-center gap-2 bg-accent px-4 py-[13px] text-sm font-extrabold text-white">
          <LayoutGrid size={16} />
          All Categories
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto p-1.5">
          {loading
            ? Array.from({ length: 8 }, (_, i) => (
                <div key={`cat-skeleton-${i}`} className="flex items-center gap-2.5 px-2.5 py-2">
                  <span className="h-[30px] w-[30px] shrink-0 animate-pulse rounded-full bg-line/50" />
                  <span className="h-3 w-24 animate-pulse rounded bg-line/50" />
                </div>
              ))
            : null}
          {categories.map((c, i) => (
            <Link
              key={`${c.id}-${i}`}
              href={categoryHref(c)}
              prefetch={false}
              className="flex min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-ink hover:bg-accent-tint"
            >
              <span
                className="relative h-[30px] w-[30px] shrink-0 overflow-hidden rounded-full"
                style={{ background: c.bg }}
              >
                {c.photo ? (
                  <SafeRemoteImage src={c.photo} alt="" fill sizes="30px" className="object-cover" fallbackClassName="object-contain opacity-40 p-1" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
