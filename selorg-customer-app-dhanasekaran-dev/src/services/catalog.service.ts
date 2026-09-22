import SelorgApi from '../api';
import { unwrapApiData, unwrapApiList } from '../utils/apiResponse';
import { normalizeCategory, normalizeProduct } from '../utils/catalogMappers';

/**
 * Catalog: products, categories, home content.
 * All endpoints map to selorg-service /api/v1/customer routes.
 * Responses are unwrapped from `{ success, data }` envelopes.
 */

export interface ApiProduct {
  _id: string;
  name: string;
  price?: number;
  mrp?: number;
  originalPrice?: number;
  images?: string[];
  imageUrl?: string;
  thumbnailUrl?: string;
  cardImageUrl?: string;
  brand?: string;
  status?: string;
  isActive?: boolean;
  isSaleable?: boolean;
  featured?: boolean;
  stockQuantity?: number;
  stock?: number | boolean;
  uom?: string;
  size?: string;
  quantity?: string;
  categoryId?: string;
  subcategoryId?: string;
  rating?: number | { average?: number };
  variants?: Array<{ id?: string; size?: string; price?: number; originalPrice?: number; imageUrl?: string }>;
  bgColor?: string;
  soldCount?: number;
}

export interface ApiProductDetail {
  product?: ApiProduct;
  variants?: Array<{ id: string; size?: string; price?: number; originalPrice?: number; imageUrl?: string }>;
  relatedProducts?: ApiProduct[];
}

export interface ApiCategory {
  _id: string;
  name: string;
  image?: string;
  bgColor?: string;
  slug?: string;
  isActive?: boolean;
  children?: ApiCategory[];
  subs?: string[];
}

export interface SearchResult {
  products: ApiProduct[];
  meta?: { total: number; page: number; limit: number };
}

export interface HomeSectionDefinition {
  key: string;
  label?: string;
}

export interface HomePayload {
  config?: {
    searchPlaceholder?: string;
    deliveryLabel?: string;
    categorySectionTitle?: string;
    trendingSearches?: string[];
  };
  sectionDefinitions?: HomeSectionDefinition[];
  sections?: Record<string, unknown>;
  categories?: ApiCategory[];
  promoBlocks?: unknown[];
  defaultAddress?: unknown;
}

export interface CollectionPayload {
  title?: string;
  name?: string;
  slug?: string;
  products: ApiProduct[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

function mapProducts(raw: unknown): ApiProduct[] {
  return unwrapApiList<Record<string, unknown>>(raw).map(normalizeProduct);
}

export const catalogApi = {
  // ── Products ────────────────────────────────────────────────────────────────

  searchProducts: async (params: {
    q?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<SearchResult> => {
    const res = await SelorgApi.get('/products/search', { query: params });
    const data = unwrapApiData<Record<string, unknown>>(res);
    const products = mapProducts(data?.products ?? data);
    const pagination = (data?.pagination ?? data?.meta) as SearchResult['meta'];
    return { products, meta: pagination };
  },

  searchSuggestions: async (q: string): Promise<string[]> => {
    const res = await SelorgApi.get('/products/search/suggestions', { query: { q } });
    const data = unwrapApiData<unknown>(res);
    if (Array.isArray(data)) return data as string[];
    if (data && typeof data === 'object' && Array.isArray((data as { suggestions?: string[] }).suggestions)) {
      return (data as { suggestions: string[] }).suggestions;
    }
    return [];
  },

  getTrendingSearches: async (): Promise<string[]> => {
    const res = await SelorgApi.get('/products/search/trending');
    const data = unwrapApiData<unknown>(res);
    return Array.isArray(data) ? (data as string[]) : [];
  },

  getProductDetail: async (id: string, storeId?: string): Promise<ApiProductDetail> => {
    const res = await SelorgApi.get(`/products/${id}`, { query: storeId ? { storeId } : undefined });
    const data = unwrapApiData<Record<string, unknown>>(res);
    const product = data?.product ? normalizeProduct(data.product as Record<string, unknown>) : undefined;
    const variants = Array.isArray(data?.variants) ? data.variants : [];
    const relatedProducts = mapProducts(data?.relatedProducts);
    return { product, variants, relatedProducts };
  },

  // ── Categories ──────────────────────────────────────────────────────────────

  getCategories: async (params?: { isActive?: boolean; page?: number; limit?: number }): Promise<ApiCategory[]> => {
    const res = await SelorgApi.get('/categories', { query: params });
    return unwrapApiList<Record<string, unknown>>(res).map(normalizeCategory);
  },

  getCategory: async (slugOrId: string): Promise<ApiCategory> => {
    const res = await SelorgApi.get(`/categories/${slugOrId}`);
    const data = unwrapApiData<Record<string, unknown>>(res);
    const raw = (data?.category ?? data) as Record<string, unknown>;
    const cat = normalizeCategory(raw);
    const subs = data?.subcategories;
    if (Array.isArray(subs)) {
      cat.children = subs.map(s => normalizeCategory(s as Record<string, unknown>));
    }
    return cat;
  },

  getCategoryProducts: async (
    slug: string,
    params?: { page?: number; limit?: number; subcategory?: string },
  ): Promise<SearchResult> => {
    const res = await SelorgApi.get(`/categories/${slug}/products`, { query: params });
    const data = unwrapApiData<Record<string, unknown>>(res);
    const products = mapProducts(data?.products ?? data);
    const pagination = data?.pagination as SearchResult['meta'];
    return { products, meta: pagination };
  },

  getCategorySubcategories: async (slug: string): Promise<ApiCategory[]> => {
    const res = await SelorgApi.get(`/categories/${slug}/subcategories`);
    return unwrapApiList<Record<string, unknown>>(res).map(normalizeCategory);
  },

  /**
   * `/categories` returns no children, so fan out to the per-category
   * subcategory route and attach them. One failing category degrades to "no
   * subcategories" instead of blanking the whole list.
   */
  getCategoriesWithSubcategories: async (params?: {
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ApiCategory[]> => {
    const categories = await catalogApi.getCategories(params);
    return Promise.all(
      categories.map(async category => {
        try {
          const children = await catalogApi.getCategorySubcategories(
            category.slug || category._id,
          );
          return { ...category, children, subs: children.map(c => c.name) };
        } catch {
          return category;
        }
      }),
    );
  },

  // ── Collections ─────────────────────────────────────────────────────────

  getCollection: async (slug: string, params?: { page?: number; limit?: number }): Promise<CollectionPayload> => {
    const res = await SelorgApi.get(`/collections/${slug}`, { query: params });
    const data = unwrapApiData<Record<string, unknown>>(res);
    return {
      title: (data?.name as string) || (data?.title as string),
      name: data?.name as string,
      slug: (data?.slug as string) || slug,
      products: mapProducts(data?.products),
      pagination: data?.pagination as CollectionPayload['pagination'],
    };
  },

  // ── Home ────────────────────────────────────────────────────────────────────

  getHome: async (): Promise<HomePayload> => {
    const res = await SelorgApi.get('/home');
    const data = unwrapApiData<HomePayload>(res);
    const sections = data?.sections || {};
    const sectionCategories = sections.section_categories ?? sections.categories;
    const categories = Array.isArray(sectionCategories)
      ? (sectionCategories as Record<string, unknown>[]).map(normalizeCategory)
      : data.categories;
    return { ...data, sections, categories };
  },

  getSectionProducts: async (key: string, params?: { page?: number; limit?: number }): Promise<ApiProduct[]> => {
    const res = await SelorgApi.get(`/sections/${key}/products`, { query: params });
    const data = unwrapApiData<Record<string, unknown>>(res);
    return mapProducts(data?.products ?? data);
  },
};
