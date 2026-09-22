import type { Category } from "@/types";

/** Route segment for a category — prefers API slug, falls back to id. */
export function categorySlug(category: Pick<Category, "id" | "slug">): string {
  return category.slug || category.id;
}

export function categoryHref(category: Pick<Category, "id" | "slug">): string {
  return `/category/${encodeURIComponent(categorySlug(category))}`;
}
