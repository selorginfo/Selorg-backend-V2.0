import { apiGet } from "./api";
import type { Category, Product } from "@/types";
import { toProduct, type BackendProductCard } from "./productAdapters";

// ── Backend shapes (selorg-service `categories` module — verified against
// src/modules/categories/{categories.routes,categories.controller,categories.model}.ts) ──

interface BackendCategoryListRow {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  cardImageUrl?: string;
  emoji?: string;
  order?: number;
}

interface BackendSubcategoryRow {
  _id: string;
  name: string;
  slug: string;
  emoji?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  cardImageUrl?: string;
  bannerImage?: string | null;
  bannerId?: string | null;
  bannerVideo?: string | null;
  youtubeUrl?: string | null;
  productCount?: number;
}

/** GET /categories/:slug/products response (list-with-pagination shape). */
interface CategorySlugProductsResponse {
  category: {
    _id: string;
    name: string;
    slug: string;
    imageUrl?: string;
    emoji?: string;
    bannerImage?: string | null;
  };
  subcategories: BackendSubcategoryRow[];
  products: BackendProductCard[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** GET /categories/:id response (richer detail shape, different field names — see audit). */
interface CategoryIdDetailResponse {
  category: { id: string; name: string; slug: string; imageUrl?: string; thumbnailUrl?: string; cardImageUrl?: string };
  subcategories: BackendSubcategoryRow[];
  banners: unknown[];
  products: BackendProductCard[];
}

function toCategory(raw: BackendCategoryListRow): Category {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    photoId: 0,
    bg: "#eef4e6",
    subs: [],
    photo: raw.imageUrl || raw.cardImageUrl || raw.thumbnailUrl || "",
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const id = item.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

export type CategorySort = "sortOrder" | "price_asc" | "price_desc" | "name_asc" | "newest";

export interface CategoryProductsParams {
  sort?: CategorySort;
  page?: number;
  limit?: number;
  inStock?: boolean;
  subcategory?: string;
}

export interface CategoryProductsResult {
  category: { id: string; name: string; slug: string; imageUrl: string; bannerImage?: string };
  subcategories: {
    id: string;
    name: string;
    slug: string;
    productCount: number;
    imageUrl: string;
    bannerImage?: string;
    bannerId?: string;
  }[];
  products: Product[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const categoryService = {
  /** GET /categories — top-level category list (id, name, slug, images, emoji). */
  async getCategories(): Promise<Category[]> {
    const result = await apiGet<BackendCategoryListRow[]>("/categories");
    return dedupeById((result ?? []).map(toCategory));
  },

  /** GET /categories/:slug/products — real category browse endpoint (pagination + filters + subcategories). */
  async getBySlug(slug: string, params: CategoryProductsParams = {}): Promise<CategoryProductsResult> {
    const query = new URLSearchParams();
    if (params.sort) query.set("sort", params.sort);
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.inStock) query.set("inStock", "true");
    if (params.subcategory) query.set("subcategory", params.subcategory);
    const qs = query.toString();

    const result = await apiGet<CategorySlugProductsResponse>(
      `/categories/${encodeURIComponent(slug)}/products${qs ? `?${qs}` : ""}`,
    );

    // This endpoint's product cards now carry subcategoryName when known.
    // Keep the id→name remap as a fallback for older payloads that only had subcategoryId.
    const subNameById = new Map(result.subcategories.map((s) => [s._id, s.name]));
    const products = result.products.map((raw) => {
      const p = toProduct({
        ...raw,
        subcategoryName:
          raw.subcategoryName ||
          (raw.subcategoryId ? subNameById.get(raw.subcategoryId) : undefined) ||
          undefined,
      });
      return {
        ...p,
        cat: result.category._id,
        sub: p.sub || subNameById.get(raw.subcategoryId || "") || "",
      };
    });

    return {
      category: {
        id: result.category._id,
        name: result.category.name,
        slug: result.category.slug,
        imageUrl: result.category.imageUrl || "",
        bannerImage: result.category.bannerImage || undefined,
      },
      subcategories: result.subcategories.map((s) => ({
        id: s._id,
        name: s.name,
        slug: s.slug,
        productCount: s.productCount ?? 0,
        imageUrl: s.imageUrl || s.cardImageUrl || s.thumbnailUrl || "",
        bannerImage: s.bannerImage || undefined,
        bannerId: s.bannerId || undefined,
      })),
      products,
      pagination: result.pagination,
    };
  },

  /** GET /categories/:id — detail view (used when only a Mongo id is known, e.g. deep link). */
  async getById(id: string): Promise<{ category: Category; products: Product[] } | undefined> {
    try {
      const result = await apiGet<CategoryIdDetailResponse>(`/categories/${id}`);
      if (!result?.category) return undefined;
      return {
        category: {
          id: result.category.id,
          slug: result.category.slug,
          name: result.category.name,
          photoId: 0,
          bg: "#eef4e6",
          subs: result.subcategories.map((s) => s.name),
          photo: result.category.imageUrl || result.category.cardImageUrl || "",
        },
        products: (result.products ?? []).map(toProduct),
      };
    } catch {
      return undefined;
    }
  },
};
