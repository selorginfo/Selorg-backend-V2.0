"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Leaf, PackageX, SlidersHorizontal } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { ProductGrid } from "@/components/product/ProductGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoryFilters } from "@/components/category/CategoryFilters";
import { CategoryRightRail } from "@/components/category/CategoryRightRail";
import { Modal } from "@/components/ui/Modal";
import { SafeRemoteImage } from "@/components/ui/SafeRemoteImage";
import { useAppConfig } from "@/context/AppConfigContext";
import { useDelivery } from "@/context/DeliveryContext";
import { filterProducts, sortProducts, PRICE_BANDS, RATING_BANDS, type ProductFilters } from "@/lib/products";
import { SORT_OPTIONS, type SortOptionId } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import type { Category, Product } from "@/types";

const EMPTY_FILTERS: ProductFilters = {
  subcat: null,
  prices: [],
  inStockOnly: false,
  offerOnly: false,
  minRating: null,
};

export type CategorySubBanner = {
  name: string;
  slug: string;
  bannerImage?: string;
};

export function CategoryClient({
  category,
  products,
  subcategories = [],
}: {
  category: Category;
  products: Product[];
  /** Master-sheet subcategory banners — used when a subcategory filter is active. */
  subcategories?: CategorySubBanner[];
}) {
  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortOptionId>("popular");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { pricing } = useAppConfig();
  const { promiseText } = useDelivery();
  const etaLine = promiseText ? `Delivered in ${promiseText}` : "Fast delivery";

  const list = useMemo(
    () => sortProducts(filterProducts(products, filters), sort),
    [filters, products, sort],
  );

  const hasRatings = useMemo(() => products.some((p) => p.rating != null), [products]);

  const activeFilterCount =
    (filters.subcat ? 1 : 0) +
    filters.prices.length +
    (filters.inStockOnly ? 1 : 0) +
    (filters.offerOnly ? 1 : 0) +
    (filters.minRating ? 1 : 0);

  // Some real category responses don't link products back to a subcategory
  // (see categoryService.getBySlug) — filtering by one would then silently
  // return zero results, so hide the whole block rather than show a dead end.
  const hasSubcategories = useMemo(
    () => category.subs.some((sub) => products.some((p) => p.sub === sub)),
    [category.subs, products],
  );

  const counts = useMemo(() => {
    const subcat: Record<string, number> = {};
    for (const p of products) subcat[p.sub] = (subcat[p.sub] ?? 0) + 1;

    const price: Record<string, number> = {};
    for (const band of PRICE_BANDS) {
      price[band.id] = products.filter((p) => band.test(p.price)).length;
    }

    const rating: Record<number, number> = {};
    for (const r of RATING_BANDS) {
      rating[r] = products.filter((p) => (p.rating ?? 0) >= r).length;
    }

    return {
      all: products.length,
      subcat,
      price,
      rating,
      inStock: products.filter((p) => p.stock).length,
      onOffer: products.filter((p) => p.discount > 0).length,
    };
  }, [products]);

  /** Selected subcategory → its Master Sheet banner; else category photo. */
  const bannerSrc = useMemo(() => {
    if (filters.subcat) {
      const match = subcategories.find(
        (s) => s.name === filters.subcat || s.slug === filters.subcat,
      );
      if (match?.bannerImage?.trim()) return match.bannerImage.trim();
    }
    return category.photo?.trim() || "";
  }, [filters.subcat, subcategories, category.photo]);

  return (
    <div className="wrap pb-14 pt-5">
      <div className="mb-3 text-[12.5px] text-muted">
        <Link href="/" className="cursor-pointer">
          Home
        </Link>{" "}
        <span className="opacity-50">/</span>{" "}
        {filters.subcat ? (
          <>
            <button
              onClick={() => setFilters({ ...filters, subcat: null })}
              className="cursor-pointer text-accent-dark"
            >
              {category.name}
            </button>{" "}
            <span className="opacity-50">/</span> <b className="text-ink">{filters.subcat}</b>
          </>
        ) : (
          <b className="text-ink">{category.name}</b>
        )}
      </div>

      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h1 className="font-sans text-[28px] font-extrabold tracking-[-0.7px]">{category.name}</h1>
          <div className="mt-0.5 text-[13px] text-muted">
            {products.length} products &middot; {etaLine}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen(true)}
            className="flex h-[42px] items-center gap-2 rounded-[11px] border-[1.5px] border-line bg-white px-3.5 text-[13.5px] font-bold min-[941px]:hidden"
          >
            <SlidersHorizontal size={15} className="text-accent-dark" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-extrabold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          <span className="hidden text-[13px] font-semibold text-muted xs:inline">Sort by</span>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortOptionId)}>
            {SORT_OPTIONS.filter((s) => hasRatings || s.id !== "rating").map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* `.catShell` from the design source: 210px sidebar from 941px, 252px + a
          320px right rail from 1221px. This was using `.listing`'s 238px at both. */}
      <div className="grid grid-cols-1 items-start gap-[22px] min-[941px]:grid-cols-[210px_minmax(0,1fr)] min-[1221px]:grid-cols-[252px_minmax(0,1fr)_320px] min-[1221px]:gap-[26px]">
        <div className="hidden min-[941px]:sticky min-[941px]:top-4 min-[941px]:block min-[941px]:max-h-[calc(100dvh-6rem)] min-[941px]:self-start min-[941px]:overflow-y-auto">
          <CategoryFilters
            category={category}
            filters={filters}
            setFilters={setFilters}
            counts={counts}
            hasRatings={hasRatings}
            hasSubcategories={hasSubcategories}
          />
        </div>

        <div className="min-w-0">
          <div className="relative mb-[18px] flex min-h-[210px] items-stretch overflow-hidden rounded-[16px] bg-[#eef4e6]">
            <SafeRemoteImage
              src={bannerSrc || undefined}
              alt={filters.subcat ? `${filters.subcat} banner` : category.name}
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover"
              fallbackClassName="object-contain opacity-40 p-10"
              priority
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(95deg,rgba(24,38,12,.93) 0%,rgba(24,38,12,.78) 42%,rgba(24,38,12,.18) 72%,rgba(24,38,12,.05) 100%)",
              }}
            />
            <div className="relative flex max-w-[620px] flex-col justify-center gap-0.5 px-[30px] py-7 text-white">
              <div className="flex items-center gap-[7px] text-[11.5px] font-extrabold tracking-[1.4px] opacity-90">
                <Leaf size={13} /> 100% CERTIFIED ORGANIC
              </div>
              {filters.subcat ? (
                <div className="mt-2.5 text-[12.5px] font-bold opacity-80">{category.name} /</div>
              ) : null}
              <div className="font-sans text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.03] tracking-[-1.2px]">
                {filters.subcat ?? category.name}
              </div>
              <div className="mt-2 max-w-[430px] text-sm leading-[1.5] opacity-95">
                Handpicked, quality-checked and delivered to your door
                {promiseText ? ` in ${promiseText}` : " fast"}.
              </div>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <span className="rounded-[20px] bg-white px-[15px] py-2 text-[12.5px] font-extrabold text-accent-dark">
                  {products.length} products
                </span>
                <span className="rounded-[20px] border border-white/30 bg-white/[.18] px-[15px] py-2 text-[12.5px] font-bold text-white">
                  Free delivery over {formatMoney(pricing.freeDeliveryThreshold)}
                </span>
                <span className="rounded-[20px] border border-white/30 bg-white/[.18] px-[15px] py-2 text-[12.5px] font-bold text-white">
                  Farm fresh daily
                </span>
              </div>
            </div>
          </div>

          {list.length === 0 ? (
            <EmptyState
              icon={PackageX}
              title="No products match your filters"
              subtitle="Try removing a filter or two."
              action={
                hasActiveFilters(filters) ? (
                  <button
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="rounded-xl bg-accent px-[22px] py-[11px] text-sm font-bold text-white"
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <ProductGrid products={list} variant="full" />
          )}
        </div>

        <CategoryRightRail />
      </div>

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        className="max-h-[85vh] overflow-y-auto"
      >
        <div>
          <CategoryFilters
            bare
            category={category}
            filters={filters}
            setFilters={setFilters}
            counts={counts}
            hasRatings={hasRatings}
            hasSubcategories={hasSubcategories}
          />
          <button
            onClick={() => setFiltersOpen(false)}
            className="mt-4 h-[50px] w-full rounded-[13px] bg-accent text-[15px] font-extrabold text-white"
          >
            Show {list.length} products
          </button>
        </div>
      </Modal>
    </div>
  );
}

function hasActiveFilters(filters: ProductFilters) {
  return (
    !!filters.subcat ||
    filters.prices.length > 0 ||
    filters.inStockOnly ||
    filters.offerOnly ||
    !!filters.minRating
  );
}
