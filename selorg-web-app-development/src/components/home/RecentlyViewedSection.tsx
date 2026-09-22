"use client";

import { useEffect, useState } from "react";
import { useRecentlyViewed } from "@/context/RecentlyViewedContext";
import { productService } from "@/services/productService";
import { ProductGrid } from "@/components/product/ProductGrid";
import type { Product } from "@/types";

/** Every recently-viewed id is resolved through `GET /products/:id`. Ids that
 *  the API no longer knows (delisted products, stale localStorage) are dropped
 *  rather than rendered from a local copy. */
export function RecentlyViewedSection() {
  const { recentViewedIds } = useRecentlyViewed();
  const [realProducts, setRealProducts] = useState<Record<string, Product>>({});

  const unresolvedIds = recentViewedIds.filter((id) => !realProducts[id]);
  const unresolvedKey = unresolvedIds.join(",");

  useEffect(() => {
    if (unresolvedIds.length === 0) return;
    let cancelled = false;
    Promise.all(
      unresolvedIds.map((id) => productService.getById(id).catch(() => undefined)),
    ).then((results) => {
      if (cancelled) return;
      setRealProducts((prev) => {
        const next = { ...prev };
        results.forEach((p, i) => {
          const id = unresolvedIds[i];
          if (p && id) next[id] = p;
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unresolvedKey]);

  const products = recentViewedIds
    .map((id) => realProducts[id])
    .filter((p): p is Product => !!p);

  if (products.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 font-sans text-2xl font-extrabold tracking-[-0.6px]">Recently viewed</h2>
      <ProductGrid products={products} />
    </section>
  );
}
