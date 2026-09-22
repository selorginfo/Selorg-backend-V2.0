import type { ApiCategory, ApiProduct } from '../services/catalog.service';

/** Normalize product id fields (`id` vs `_id`) from selorg-service. */
export function normalizeProduct(raw: Record<string, unknown>): ApiProduct {
  const id = String(raw._id ?? raw.id ?? '');
  return {
    ...(raw as unknown as ApiProduct),
    _id: id,
  };
}

/** Normalize category id and image fields from selorg-service. */
export function normalizeCategory(raw: Record<string, unknown>): ApiCategory {
  const id = String(raw._id ?? raw.id ?? '');
  const subs = raw.subcategories ?? raw.children ?? raw.subs;
  return {
    ...(raw as unknown as ApiCategory),
    _id: id,
    image:
      (raw.image as string) ||
      (raw.imageUrl as string) ||
      (raw.thumbnailUrl as string) ||
      (raw.cardImageUrl as string),
    slug: (raw.slug as string) || id,
    children: Array.isArray(subs)
      ? (subs as Record<string, unknown>[]).map(normalizeCategory)
      : (raw.children as ApiCategory[] | undefined),
    subs: Array.isArray(subs) && !raw.children
      ? (subs as ApiCategory[]).map(c => c.name || String(c))
      : (raw.subs as string[] | undefined),
  };
}

/** `collections_deal_in_lowest_price` → `deal-in-lowest-price` */
export function sectionKeyToCollectionSlug(sectionKey: string): string {
  if (sectionKey.startsWith('collections_')) {
    return sectionKey.replace(/^collections_/, '').replace(/_/g, '-');
  }
  return sectionKey.replace(/_/g, '-');
}

export function isCollectionSectionKey(key: string): boolean {
  return key.startsWith('collections_');
}
