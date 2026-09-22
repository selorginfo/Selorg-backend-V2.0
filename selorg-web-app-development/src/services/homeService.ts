import { apiGet, ApiError } from "./api";
import { toProduct, type BackendProductCard } from "./productAdapters";
import type { Product } from "@/types";

/**
 * selorg-service's home screen is entirely CMS-curated: `/customer/home`
 * returns an ordered `sectionDefinitions` list + a `sections` map (categories/
 * banners/lifestyle resolved inline). Product carousels are NOT inlined —
 * each must be fetched separately via `/sections/:key/products`. There is no
 * "bestsellers"/"flash deals" concept computed from sales data anywhere in
 * the backend; those are just section labels an admin configured.
 */

export interface HomeCategory {
  _id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  cardImageUrl?: string;
  emoji?: string;
}

export interface HomeBanner {
  _id: string;
  slot: string;
  presentationMode: "single" | "carousel";
  title?: string;
  /** Small uppercase eyebrow above the headline in the prototype hero/promo cards.
   *  Optional everywhere — admins can leave it unset and the line simply collapses. */
  kicker?: string;
  subtitle?: string;
  imageUrl?: string;
  /** Some CMS / mastersheet rows only populate bannerImageUrl — treat as imageUrl fallback. */
  bannerImageUrl?: string;
  videoUrl?: string;
  link?: string;
  redirectType?: string;
  redirectValue?: string;
}

export interface HomeLifestyleItem {
  _id: string;
  name?: string;
  title?: string;
  imageUrl: string;
  link?: string;
  redirectType?: string;
  redirectValue?: string;
}

export interface HomeSectionDefinition {
  key: string;
  label: string;
}

export interface HomePayload {
  config: {
    searchPlaceholder: string;
    deliveryLabel: string;
    categorySectionTitle: string;
    trendingSearches: string[];
    /** Bumped after Master Sheet sync — useful for client cache keys. */
    contentRevision?: number;
    lastMastersheetSyncAt?: string | null;
  };
  sectionDefinitions: HomeSectionDefinition[];
  sections: Record<string, HomeCategory[] | HomeBanner[] | HomeLifestyleItem[] | undefined>;
  promoBlocks: unknown[];
}

export type SectionProductsResult = {
  title: string;
  products: Product[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

function dedupeProducts(products: Product[]): Product[] {
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

export const homeService = {
  /** GET /customer/home — auth optional; identical content for guests/logged-in. */
  async getHome(): Promise<HomePayload | undefined> {
    try {
      return await apiGet<HomePayload>("/home");
    } catch (err) {
      console.error("[homeService.getHome]", err);
      return undefined;
    }
  },

  /**
   * GET /sections/:key/products — fetches a home carousel's products.
   * Prefer HomeSection / CMS section products first (mastersheet writes these).
   * `collections_*` keys also try `/collections/:slug` when the section endpoint 404s.
   * Returns `null` only for a genuine 404 (key is not a product section).
   * Throws on other HTTP/network failures so callers can surface an error state.
   */
  async getSectionProducts(
    key: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<SectionProductsResult | null> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    const qs = query.toString();

    try {
      const result = await apiGet<{
        title: string;
        products: BackendProductCard[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/sections/${encodeURIComponent(key)}/products${qs ? `?${qs}` : ""}`);
      return {
        title: result.title,
        products: dedupeProducts((result.products ?? []).map(toProduct)),
        pagination: result.pagination,
      };
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        console.error(`[homeService.getSectionProducts] ${key}`, err);
        throw err;
      }
    }

    if (key.startsWith("collections_")) {
      // Strip prefix and convert underscores to hyphens to get the collection slug.
      const slug = key.slice("collections_".length).replace(/_/g, "-");
      try {
        const result = await apiGet<{
          name: string;
          products: BackendProductCard[];
          pagination: { page: number; limit: number; total: number; totalPages: number };
        }>(`/collections/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`);
        return {
          title: result.name,
          products: dedupeProducts((result.products ?? []).map(toProduct)),
          pagination: result.pagination,
        };
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        console.error(`[homeService.getSectionProducts] collection/${slug}`, err);
        throw err;
      }
    }

    return null;
  },
};
