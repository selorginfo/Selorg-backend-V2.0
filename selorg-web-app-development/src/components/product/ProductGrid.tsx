import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";

/** Drop duplicate product ids so React list keys stay unique when a CMS
 *  collection (or recently-viewed merge) accidentally repeats the same card. */
function uniqueById(products: Product[]): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const p of products) {
    const id = p.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }
  return out;
}

/** Same locked card size on home, search, category, and PDP related. */
export function ProductGrid({
  products,
  variant = "default",
}: {
  products: Product[];
  /** Kept for call-site compat — both use the same `.pgrid` scale. */
  variant?: "default" | "full";
}) {
  void variant;
  const list = uniqueById(products);
  if (list.length === 0) return null;
  return (
    <div className="pgrid">
      {list.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
