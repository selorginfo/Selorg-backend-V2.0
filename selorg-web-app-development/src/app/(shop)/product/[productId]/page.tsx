import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError } from "@/services/api";
import { productService } from "@/services/productService";
import { ProductClient } from "./ProductClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<Metadata> {
  const { productId } = await params;
  const real = await productService.getById(productId).catch(() => undefined);
  return { title: real ? real.name : "Product" };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;

  // Same rule as the category page: an id the catalog API doesn't know is a 404,
  // not a demo product. Network/5xx must not be disguised as "not found".
  let real: Awaited<ReturnType<typeof productService.getWithRelated>>;
  try {
    real = await productService.getWithRelated(productId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    console.error(`[product/${productId}] getWithRelated failed:`, err);
    throw err;
  }
  if (!real.product) notFound();

  return <ProductClient product={real.product} related={real.related} />;
}
