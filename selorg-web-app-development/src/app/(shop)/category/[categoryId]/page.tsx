import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError } from "@/services/api";
import { categoryService } from "@/services/categoryService";
import type { Category } from "@/types";
import { CategoryClient } from "./CategoryClient";

/** Always hit the live catalog — never serve a stale static 404 from a prior build. */
export const dynamic = "force-dynamic";

async function loadCategory(categoryId: string) {
  try {
    return await categoryService.getBySlug(categoryId, { limit: 50, sort: "sortOrder" });
  } catch (err) {
    // Genuine missing slug → 404. Network / 5xx must not look like "category not found".
    if (err instanceof ApiError && err.status === 404) return undefined;
    console.error(`[category/${categoryId}] getBySlug failed:`, err);
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}): Promise<Metadata> {
  const { categoryId } = await params;
  const real = await loadCategory(categoryId).catch(() => undefined);
  return { title: real ? real.category.name : "Category" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;

  // Catalog comes only from `GET /categories/:slug/products`. An unknown slug is a 404.
  const real = await loadCategory(categoryId);
  if (!real) notFound();

  const category: Category = {
    id: real.category.id,
    slug: real.category.slug,
    name: real.category.name,
    photoId: 0,
    bg: "#eef4e6",
    subs: real.subcategories.map((s) => s.name),
    photo: real.category.bannerImage || real.category.imageUrl || "",
  };

  return (
    <CategoryClient
      category={category}
      products={real.products}
      subcategories={real.subcategories.map((s) => ({
        name: s.name,
        slug: s.slug,
        bannerImage: s.bannerImage || s.imageUrl || "",
      }))}
    />
  );
}
