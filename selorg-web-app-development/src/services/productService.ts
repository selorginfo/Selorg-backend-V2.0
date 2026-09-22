import { apiGet } from "./api";
import type { Product } from "@/types";
import { toProduct, toVariantRow, type BackendProductCard, type BackendVariantRow } from "./productAdapters";

/**
 * selorg-service has NO general product-listing endpoint — browsing only
 * happens via categories (`categoryService`), curated home sections
 * (`homeService`), collections, or this module's search. See API_CONTRACT.md.
 */

interface SearchResponse {
  data: BackendProductCard[];
  meta?: { total: number; page: number; limit: number };
}

/** GET /products/:id — "never 404s": a missing/invalid id returns 200 with
 *  `{ product: { _id, isActive: false }, variants: [], relatedProducts: [] }`. */
interface ProductDetailResponse {
  product?: BackendProductCard & { isActive?: boolean };
  variants?: BackendVariantRow[];
  relatedProducts?: BackendProductCard[];
}

function isRealProduct(raw: ProductDetailResponse["product"]): raw is BackendProductCard {
  return !!raw && raw.isActive !== false && !!raw.name;
}

export const productService = {
  /** GET /products/search?q= — requires q.length >= 2 server-side. */
  async search(query: string, opts: { page?: number; limit?: number; category?: string } = {}): Promise<Product[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const params = new URLSearchParams({ q });
    if (opts.page) params.set("page", String(opts.page));
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.category) params.set("category", opts.category);
    try {
      const result = await apiGet<BackendProductCard[]>(`/products/search?${params.toString()}`);
      return (Array.isArray(result) ? result : []).map(toProduct);
    } catch {
      return [];
    }
  },

  async getSearchSuggestions(query: string): Promise<{ name: string; imageUrl?: string; price?: number }[]> {
    const q = query.trim();
    if (!q) return [];
    try {
      return await apiGet(`/products/search/suggestions?q=${encodeURIComponent(q)}`);
    } catch {
      return [];
    }
  },

  async getTrendingSearches(): Promise<string[]> {
    try {
      return await apiGet<string[]>("/products/search/trending");
    } catch {
      return [];
    }
  },

  /** GET /products/:id — returns the product, its resolved variants, and related products. */
  async getById(id: string): Promise<Product | undefined> {
    try {
      const result = await apiGet<ProductDetailResponse>(`/products/${id}`);
      if (!isRealProduct(result?.product)) return undefined;
      const product = toProduct(result!.product!);
      if (result!.variants && result!.variants.length > 0) {
        product.variants = result!.variants.map((v) => toVariantRow(v, product.unit));
      }
      return product;
    } catch {
      return undefined;
    }
  },

  async getWithRelated(id: string): Promise<{ product?: Product; related: Product[] }> {
    try {
      const result = await apiGet<ProductDetailResponse>(`/products/${id}`);
      if (!isRealProduct(result?.product)) return { product: undefined, related: [] };
      const product = toProduct(result!.product!);
      if (result!.variants && result!.variants.length > 0) {
        product.variants = result!.variants.map((v) => toVariantRow(v, product.unit));
      }
      return {
        product,
        related: (result!.relatedProducts ?? []).map(toProduct),
      };
    } catch {
      return { product: undefined, related: [] };
    }
  },
};

export type { SearchResponse };
