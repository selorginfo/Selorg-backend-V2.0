export interface ProductVariant {
  label: string;
  price: number;
  mrp: number;
  /** selorg-service's real variant identifier (cart/order APIs need this, not the array index). */
  variantId?: string;
}

export interface Product {
  id: string;
  name: string;
  cat: string;
  sub: string;
  unit: string;
  price: number;
  mrp: number;
  /** Optional rating when the catalog provides one. */
  rating?: number;
  /** Optional sales count when the catalog provides one. */
  sold?: number;
  bg: string;
  brand: string;
  stock: boolean;
  best: boolean;
  only: number;
  /** Optional organic flag when the catalog provides one. */
  organic?: boolean;
  discount: number;
  photo: string;
  /** Gallery images for PDP (primary first). Falls back to `[photo]` when API sends one. */
  photos: string[];
  variants: ProductVariant[];
  /** Long-form copy from `GET /products/:id` (`description.*`). Absent on list/card
   *  responses, which don't carry these fields. */
  about?: string;
  healthBenefits?: string;
  nutrition?: string;
  origin?: string;
  /** e.g. "10-min delivery" — `deliveryInfo` on the detail response. */
  deliveryInfo?: string;
  /** e.g. "7 days" — built from the detail response's `shelfLife` object. */
  shelfLife?: string;
}

export interface Category {
  id: string;
  name: string;
  photoId: number;
  bg: string;
  subs: string[];
  photo: string;
  /** Route segment for category pages (`/category/:slug`). Falls back to `id`. */
  slug?: string;
}

export interface PromoTile {
  emoji: string;
  title: string;
  sub: string;
  bg: string;
}

export interface TrustBadge {
  title: string;
  sub: string;
}

export interface Coupon {
  code: string;
  desc: string;
  cond: string;
  pct?: number;
  max?: number;
  flat?: number;
  min: number;
}

export interface Banner {
  title: string;
  big: string;
  sub: string;
  bg: string;
  cat: string;
}

export interface AppliedCoupon {
  code: string;
  amount: number;
}
