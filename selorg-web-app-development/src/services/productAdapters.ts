/**
 * Shared backend → frontend Product/Category normalization.
 *
 * selorg-service's product schema (src/modules/products/products.model.ts) has
 * NO real `rating`/`sold` fields — `toProduct` fills stable placeholders so
 * cards and sort remain useful. "Was price" is inconsistently named `mrp`
 * (categories/:slug/products, collections) vs `originalPrice` (products/:id
 * variants, categories/:id). This module is the single place that reconciles
 * those differences — see API_CONTRACT.md for the full per-endpoint field audit.
 */
import type { Product, ProductVariant } from "@/types";

export interface BackendVariantRow {
  id?: string;
  productId?: string;
  name?: string;
  size?: string;
  price?: number;
  originalPrice?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  cardImageUrl?: string;
  images?: string[];
}

/** Common shape returned by category/search/collection product-card listings. */
export interface BackendProductCard {
  id?: string;
  _id?: string;
  name: string;
  sku?: string;
  brand?: string;
  price: number;
  mrp?: number;
  originalPrice?: number;
  discount?: string;
  size?: string;
  quantity?: string;
  uom?: string;
  tag?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  cardImageUrl?: string;
  images?: string[];
  variants?: BackendVariantRow[];
  stock?: number;
  stockQuantity?: number;
  availableStock?: number;
  storeStock?: number;
  catalogStockQuantity?: number;
  isSaleable?: boolean;
  isActive?: boolean;
  status?: string;
  maxOrderLimit?: number | null;
  categoryId?: string;
  subcategoryId?: string;
  /** Human-readable L2 name when the list endpoint resolves it. */
  subcategoryName?: string;
  featured?: boolean;
  // Detail-only fields (`GET /products/:id`); absent from card listings.
  description?: {
    about?: string;
    healthBenefits?: string;
    nutrition?: string;
    originOfPlace?: string;
    raw?: string;
  };
  shelfLife?: { value?: number; type?: string };
  deliveryInfo?: string;
  countryOfOrigin?: string;
}

const BG_PALETTE = [
  "#ffe6dc", "#e7f2d8", "#f2efe4", "#e8f0fb", "#f5e8f5",
  "#fef3cd", "#e0f7fa", "#fce4ec", "#e8eaf6", "#f3e5f5",
];

function stableColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
  }
  return BG_PALETTE[hash % BG_PALETTE.length]!;
}

/** Stable placeholder rating — catalog has no review system yet. Range 4.0–4.9. */
function dummyRating(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return Math.round((4 + (hash % 10) / 10) * 10) / 10;
}

/** Stable placeholder sold count for sort/popularity display. */
function dummySold(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  }
  return 40 + (hash % 960);
}

/** Prefer a real subcategory label; never surface a bare Mongo ObjectId on the card. */
function resolveSubcategoryLabel(raw: BackendProductCard): string {
  const named = raw.subcategoryName?.trim();
  if (named) return named;
  const sub = String(raw.subcategoryId || "").trim();
  if (sub && !/^[a-f0-9]{24}$/i.test(sub)) return sub;
  return "";
}

/** Backend never returns a boolean "in stock" flag — always a live numeric quantity.
 *  Only `availableStock` (real-time store stock) gates availability; the catalog-level
 *  `stockQuantity`/`stock` fields default to 0 when stock tracking isn't configured,
 *  which must not mark every product as out-of-stock before inventory is set up. */
function resolveStockOk(raw: BackendProductCard): boolean {
  if (raw.isActive === false || raw.isSaleable === false) return false;
  if (raw.status === "inactive" || raw.status === "draft") return false;
  if (typeof raw.availableStock === "number") return raw.availableStock > 0;
  // No availableStock → stock tracking not configured; treat as available.
  return true;
}

/** `mrp` (categories/:slug/products, collections) vs `originalPrice` (products/:id, categories/:id) — normalize to one. */
function resolveMrp(raw: { mrp?: number; originalPrice?: number }, price: number): number {
  return Number(raw.mrp ?? raw.originalPrice ?? price);
}

function resolvePhoto(raw: { imageUrl?: string; thumbnailUrl?: string; cardImageUrl?: string; images?: string[] }): string {
  return resolvePhotos(raw)[0] || "/selorg-logo.png";
}

/** Deduped gallery list — primary `imageUrl` first, then card/thumb/extra images. */
function resolvePhotos(raw: {
  imageUrl?: string;
  thumbnailUrl?: string;
  cardImageUrl?: string;
  images?: string[];
}): string[] {
  const urls: string[] = [];
  const push = (value?: string) => {
    const url = typeof value === "string" ? value.trim() : "";
    if (url && !urls.includes(url)) urls.push(url);
  };
  push(raw.imageUrl);
  if (Array.isArray(raw.images)) raw.images.forEach(push);
  push(raw.cardImageUrl);
  push(raw.thumbnailUrl);
  return urls.length ? urls : ["/selorg-logo.png"];
}

/**
 * Description fields arrive with their own label baked into the value
 * ("About - Red kavuni rice is…", "Origin of Place - It is cultivated…"), which
 * would read as a duplicate heading once the UI adds its own label.
 */
function stripLabel(value: string | undefined): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  const stripped = text.replace(/^[A-Za-z][A-Za-z ]{0,24}\s+-\s+/, "").trim();
  return stripped || undefined;
}

/** `shelfLife` is an object of warehouse counters; only render it when actually set. */
function toShelfLife(raw: BackendProductCard["shelfLife"]): string | undefined {
  const value = Number(raw?.value ?? 0);
  if (!value) return undefined;
  const unit = raw?.type?.trim() || "days";
  return `${value} ${unit}`;
}

function toVariants(raw: BackendProductCard, unit: string, price: number, mrp: number): ProductVariant[] {
  if (Array.isArray(raw.variants) && raw.variants.length > 0) {
    return raw.variants.map((v) => ({
      label: v.size || v.name || unit,
      price: Number(v.price ?? price),
      mrp: resolveMrp(v, Number(v.price ?? price)),
      variantId: v.id || v.productId,
    }));
  }
  return [{ label: unit, price, mrp, variantId: String(raw.id ?? raw._id ?? "") }];
}

export function toProduct(raw: BackendProductCard): Product {
  const id = String(raw.id ?? raw._id ?? "");
  const price = Number(raw.price ?? 0);
  const mrp = resolveMrp(raw, price);
  const unit = raw.size || raw.quantity || raw.uom || "1 unit";
  const stock = resolveStockOk(raw);
  const availableQty = raw.availableStock ?? raw.stockQuantity ?? raw.stock ?? 0;

  return {
    id,
    name: raw.name || "",
    cat: String(raw.categoryId || ""),
    sub: resolveSubcategoryLabel(raw),
    unit,
    price,
    mrp,
    // Catalog has no review fields yet — stable placeholders so cards/sort stay useful.
    rating: dummyRating(id),
    sold: dummySold(id),
    bg: stableColor(id),
    brand: raw.brand || "",
    stock,
    best: Boolean(raw.featured),
    only: stock && availableQty > 0 && availableQty <= 5 ? availableQty : 0,
    discount: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0,
    photo: resolvePhoto(raw),
    photos: resolvePhotos(raw),
    variants: toVariants(raw, unit, price, mrp),
    about: stripLabel(raw.description?.about),
    healthBenefits: stripLabel(raw.description?.healthBenefits),
    nutrition: stripLabel(raw.description?.nutrition),
    origin: stripLabel(raw.description?.originOfPlace) || raw.countryOfOrigin || undefined,
    deliveryInfo: raw.deliveryInfo?.trim() || undefined,
    shelfLife: toShelfLife(raw.shelfLife),
  };
}

export function toVariantRow(v: BackendVariantRow, fallbackUnit: string): ProductVariant {
  return {
    label: v.size || v.name || fallbackUnit,
    price: Number(v.price ?? 0),
    mrp: Number(v.originalPrice ?? v.price ?? 0),
    variantId: v.id || v.productId,
  };
}
