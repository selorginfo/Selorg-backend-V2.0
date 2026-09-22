"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppConfig } from "@/context/AppConfigContext";
import { productService } from "@/services/productService";
import type { Product } from "@/types";

export function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { searchPlaceholder } = useAppConfig();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [products, setProducts] = useState<Product[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(initialQuery.trim().length >= 2);
  const lastFetchedQuery = useRef<string | null>(null);

  useEffect(() => {
    productService.getTrendingSearches().then(setTrending).catch(() => undefined);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    setSearched(true);
    if (trimmed.length < 2) {
      setProducts([]);
      return;
    }
    setLoading(true);
    try {
      const results = await productService.search(trimmed, { limit: 48 });
      setProducts(results);
      lastFetchedQuery.current = trimmed;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery.trim().length >= 2 && lastFetchedQuery.current !== initialQuery.trim()) {
      void runSearch(initialQuery);
    }
  }, [initialQuery, runSearch]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
    void runSearch(trimmed);
  };

  return (
    <div className="wrap pb-14 pt-5">
      <div className="mb-3 text-[12.5px] text-muted">
        <Link href="/">Home</Link>
        <span className="mx-1.5">/</span>
        <span>Search</span>
      </div>

      <h1 className="mb-4 text-2xl font-extrabold tracking-[-0.6px]">Search products</h1>

      <form onSubmit={onSubmit} className="relative mb-6 max-w-2xl">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-[46px] w-full rounded-[13px] border-[1.5px] border-line bg-white pl-[42px] pr-4 text-sm font-medium outline-none focus:border-accent"
          autoFocus
        />
      </form>

      {!searched && trending.length > 0 ? (
        <div className="mb-6">
          <div className="mb-2 text-sm font-bold text-muted">Trending searches</div>
          <div className="flex flex-wrap gap-2">
            {trending.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setQuery(term);
                  router.push(`/search?q=${encodeURIComponent(term)}`);
                  void runSearch(term);
                }}
                className="rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold hover:bg-accent-tint"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="pgrid">
          {Array.from({ length: 12 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : searched && products.length === 0 ? (
        <EmptyState
          icon={Search}
          title={query.trim().length < 2 ? "Type at least 2 characters" : "No products found"}
          subtitle={
            query.trim().length < 2
              ? "Enter a product name to search the catalog."
              : `We couldn't find anything matching "${query.trim()}".`
          }
        />
      ) : (
        <ProductGrid products={products} variant="full" />
      )}
    </div>
  );
}
