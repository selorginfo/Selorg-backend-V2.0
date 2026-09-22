"use client";

import { Leaf, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { PRICE_BANDS, RATING_BANDS, type ProductFilters } from "@/lib/products";
import type { Category } from "@/types";

const MARK_BASE =
  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-accent text-[11px] text-white";

function Mark({ checked }: { checked: boolean }) {
  return <span className={cn(MARK_BASE, checked ? "bg-accent" : "bg-white")}>{checked ? "✓" : ""}</span>;
}

export interface CategoryFilterCounts {
  all: number;
  subcat: Record<string, number>;
  price: Record<string, number>;
  rating: Record<number, number>;
  inStock: number;
  onOffer: number;
}

export function CategoryFilters({
  category,
  filters,
  setFilters,
  counts,
  hasRatings = true,
  hasSubcategories = true,
  bare = false,
}: {
  category: Category;
  filters: ProductFilters;
  setFilters: (filters: ProductFilters) => void;
  counts: CategoryFilterCounts;
  /** selorg-service has no rating field on real products — hide this block rather than show a dead-end filter. */
  hasRatings?: boolean;
  /** Some real category responses don't link products back to a subcategory — hide the list rather than show a dead-end filter. */
  hasSubcategories?: boolean;
  /** Drop the card chrome when the panel is already inside a surface (the mobile filter sheet). */
  bare?: boolean;
}) {
  const hasFilters =
    !!filters.subcat ||
    filters.prices.length > 0 ||
    filters.inStockOnly ||
    filters.offerOnly ||
    !!filters.minRating;

  const togglePrice = (id: string) => {
    setFilters({
      ...filters,
      prices: filters.prices.includes(id)
        ? filters.prices.filter((p) => p !== id)
        : [...filters.prices, id],
    });
  };

  return (
    <div className={cn(bare ? "" : "rounded-app border border-line bg-white p-[14px]")}>
      {bare ? null : (
        <div className="flex items-center gap-2 px-1 pb-2.5 text-[14px] font-extrabold">
          <Leaf size={15} className="text-accent-dark" />
          {category.name}
        </div>
      )}

      <div className="mb-[14px] flex flex-col gap-0.5 border-b border-line pb-3">
        <button
          onClick={() => setFilters({ ...filters, subcat: null })}
          className={cn(
            "flex items-center justify-between gap-[9px] rounded-[9px] px-[9px] py-2 text-left text-[12.5px]",
            filters.subcat === null
              ? "bg-accent-tint font-extrabold text-accent-dark"
              : "font-semibold text-ink hover:bg-black/5",
          )}
        >
          All products
          <span className="text-[11px] text-muted">{counts.all}</span>
        </button>
        {hasSubcategories
          ? category.subs.map((sub) => (
              <button
                key={sub}
                onClick={() => setFilters({ ...filters, subcat: filters.subcat === sub ? null : sub })}
                className={cn(
                  "flex items-center justify-between gap-[9px] rounded-[9px] px-[9px] py-2 text-left text-[12.5px]",
                  filters.subcat === sub
                    ? "bg-accent-tint font-extrabold text-accent-dark"
                    : "font-semibold text-ink hover:bg-black/5",
                )}
              >
                {sub}
                <span className="text-[11px] text-muted">{counts.subcat[sub] ?? 0}</span>
              </button>
            ))
          : null}
      </div>

      <div
        className={cn(
          "mb-[14px] flex items-center px-1",
          bare ? "justify-end" : "justify-between",
        )}
      >
        {bare ? null : <span className="text-[15px] font-extrabold">Filters</span>}
        {hasFilters ? (
          <button
            onClick={() =>
              setFilters({ subcat: null, prices: [], inStockOnly: false, offerOnly: false, minRating: null })
            }
            className="text-[12.5px] font-bold text-warn"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="mb-[18px]">
        <div className="mb-2.5 text-[13px] font-bold">Price</div>
        <div className="flex flex-col gap-2">
          {PRICE_BANDS.map((band) => {
            const checked = filters.prices.includes(band.id);
            return (
              <button
                key={band.id}
                onClick={() => togglePrice(band.id)}
                className={cn(
                  "flex items-center gap-[9px] text-left text-[13px] font-semibold",
                  checked ? "text-accent-dark" : "text-ink",
                )}
              >
                <Mark checked={checked} />
                {band.label}
                <span className="ml-auto text-[11px] text-muted">{counts.price[band.id] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {hasRatings ? (
        <div className="mb-[18px] border-t border-line pt-4">
          <div className="mb-2.5 text-[13px] font-bold">Customer rating</div>
          <div className="flex flex-col gap-2">
            {RATING_BANDS.map((r) => {
              const checked = filters.minRating === r;
              return (
                <button
                  key={r}
                  onClick={() => setFilters({ ...filters, minRating: checked ? null : r })}
                  className={cn(
                    "flex items-center gap-[9px] text-[13px] font-semibold",
                    checked ? "text-accent-dark" : "text-ink",
                  )}
                >
                  <Mark checked={checked} />
                  <span className="flex shrink-0 gap-px">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={i < r ? "fill-star text-star" : "fill-none text-line"}
                      />
                    ))}
                  </span>
                  <span className="whitespace-nowrap">{r} &amp; up</span>
                  <span className="ml-auto text-[11px] text-muted">{counts.rating[r] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="border-t border-line pt-4">
        <div className="mb-2.5 text-[13px] font-bold">Availability &amp; offers</div>
        <div className="flex flex-col gap-[9px]">
          <button
            onClick={() => setFilters({ ...filters, inStockOnly: !filters.inStockOnly })}
            className="flex items-center gap-[9px] text-[13px] font-semibold"
          >
            <Mark checked={filters.inStockOnly} />
            In stock only
            <span className="ml-auto text-[11px] text-muted">{counts.inStock}</span>
          </button>
          <button
            onClick={() => setFilters({ ...filters, offerOnly: !filters.offerOnly })}
            className="flex items-center gap-[9px] text-[13px] font-semibold"
          >
            <Mark checked={filters.offerOnly} />
            On offer
            <span className="ml-auto text-[11px] text-muted">{counts.onOffer}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
