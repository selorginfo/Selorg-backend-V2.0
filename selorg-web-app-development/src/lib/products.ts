import type { Product } from "@/types";
import type { SortOptionId } from "./constants";

export interface DecoratedProduct extends Product {
  qty: number;
  inCart: boolean;
  canAdd: boolean;
  oos: boolean;
  hasDiscount: boolean;
  showOnly: boolean;
}

/** Mirrors the source `decorate(product)` — note `only` is a display flag only, never a hard cap. */
export function decorateProduct(
  product: Product,
  cartQty: number,
): DecoratedProduct {
  const qty = cartQty || 0;
  const oos = !product.stock;
  return {
    ...product,
    qty,
    inCart: qty > 0 && product.stock,
    canAdd: qty === 0 && product.stock,
    oos,
    hasDiscount: product.discount > 0,
    showOnly: product.stock && product.only > 0,
  };
}

export interface ProductFilters {
  subcat: string | null;
  prices: string[];
  inStockOnly: boolean;
  offerOnly: boolean;
  minRating: number | null;
}

export const PRICE_BANDS = [
  { id: "under50", label: "Under ₹50", test: (p: number) => p < 50 },
  { id: "50to150", label: "₹50 – ₹150", test: (p: number) => p >= 50 && p <= 150 },
  { id: "150to300", label: "₹150 – ₹300", test: (p: number) => p > 150 && p <= 300 },
  { id: "above300", label: "Above ₹300", test: (p: number) => p > 300 },
];

export const RATING_BANDS = [4, 3, 2] as const;

export function filterProducts(
  products: Product[],
  filters: Partial<ProductFilters>,
): Product[] {
  let list = products;
  if (filters.subcat) {
    list = list.filter((p) => p.sub === filters.subcat);
  }
  if (filters.prices && filters.prices.length > 0) {
    const bands = PRICE_BANDS.filter((b) => filters.prices!.includes(b.id));
    list = list.filter((p) => bands.some((b) => b.test(p.price)));
  }
  if (filters.inStockOnly) {
    list = list.filter((p) => p.stock);
  }
  if (filters.offerOnly) {
    list = list.filter((p) => p.discount > 0);
  }
  if (filters.minRating) {
    list = list.filter((p) => (p.rating ?? 0) >= filters.minRating!);
  }
  return list;
}

export function sortProducts(products: Product[], sort: SortOptionId): Product[] {
  const list = [...products];
  switch (sort) {
    case "price-asc":
      return list.sort((a, b) => a.price - b.price);
    case "price-desc":
      return list.sort((a, b) => b.price - a.price);
    case "rating":
      return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "discount":
      return list.sort((a, b) => b.discount - a.discount);
    case "popular":
    default:
      return list.sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0));
  }
}

/** Display title without pack size / weight (e.g. "Papaya - 1 pc (Approx. 800g - 1.5kg)" → "Papaya"). */
export function productDisplayName(name?: string | null): string {
  if (name == null || typeof name !== "string") return "";
  let s = name.trim().replace(/\s+/g, " ");

  // Parenthetical weight notes: (Approx. 800g - 1.5kg)
  s = s.replace(/\s*\([^)]*(?:approx\.?|g|kg|ml|pcs?|pack)[^)]*\)\s*$/i, "").trim();

  // Multipack: 100g * 2, 2 * 500ml pack
  s = s
    .replace(
      /\s*[-–—]?\s*\d+(\.\d+)?\s*(g|kg|ml|mL|l|L|ltr|lt|pc|pcs)?\s*\*\s*\d+(\s*[-–—]\s*)?(multipack|bundle|pack)?\s*$/i,
      "",
    )
    .trim();

  // Trailing size with unit, including ranges: 500-700g, 1 pc, 1.5 kg
  s = s
    .replace(
      /\s*[-–—]?\s*\d+(\.\d+)?(\s*[-–—]\s*\d+(\.\d+)?)?\s*(g|kg|ml|mL|l|L|ltr|lt|pc|pcs|pack)\b(\s*(bottle|pouch|jar|tin|can|tub|pack|multipack|bundle))?\s*$/i,
      "",
    )
    .trim();

  // Bare trailing number after a dash: "Jackfruit - 500"
  s = s.replace(/\s*[-–—]\s*\d+(\.\d+)?\s*$/i, "").trim();

  s = s.replace(/\s*[-–—]+\s*$/g, "").trim();
  return s || name.trim();
}
