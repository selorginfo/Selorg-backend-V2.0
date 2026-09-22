import type { DialCodeOption, TrustBadge } from "@/types";

/**
 * Fallback checkout pricing — matches selorg-service's own hardcoded defaults
 * (`deliveryPricing.service.ts`) for when `AppConfigContext` hasn't loaded yet.
 * Once `/customer/bootstrap` config loads, its `appConfig.checkout` values take over.
 */
export const FREE_DELIVERY_THRESHOLD = 499;
export const DELIVERY_FEE = 40;
export const HANDLING_FEE = 5;

export const TOAST_DURATION_MS = 1800;
export const BANNER_ROTATE_MS = 4500;
export const TRACK_TICK_MS = 10000;
export const TRACK_PROGRESS_STEP = 0.006;
export const TRACK_PROGRESS_CAP = 0.995;

export const WALLET_MAX_TOPUP = 20000;
/** @deprecated No product minimum — kept so leftover imports don't break the build. Prefer amount > 0. */
export const WALLET_MIN_TOPUP = 1;
export const WALLET_PRESETS = [200, 500, 1000, 2000] as const;

export const ORDER_STATUS_STEPS = [
  "Placed",
  "Confirmed",
  "Packed",
  "Out for delivery",
  "Delivered",
] as const;

export const DIAL_CODES: DialCodeOption[] = [
  { iso: "IN", c: "India", d: "+91", flag: "🇮🇳" },
  { iso: "AE", c: "UAE", d: "+971", flag: "🇦🇪" },
  { iso: "SG", c: "Singapore", d: "+65", flag: "🇸🇬" },
  { iso: "GB", c: "United Kingdom", d: "+44", flag: "🇬🇧" },
  { iso: "US", c: "United States", d: "+1", flag: "🇺🇸" },
  { iso: "AU", c: "Australia", d: "+61", flag: "🇦🇺" },
  { iso: "MY", c: "Malaysia", d: "+60", flag: "🇲🇾" },
  { iso: "QA", c: "Qatar", d: "+974", flag: "🇶🇦" },
  { iso: "SA", c: "Saudi Arabia", d: "+966", flag: "🇸🇦" },
];

export const SORT_OPTIONS = [
  { id: "popular", label: "Popularity" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "rating", label: "Customer Rating" },
  { id: "discount", label: "Discount" },
] as const;

export type SortOptionId = (typeof SORT_OPTIONS)[number]["id"];

/** Storefront trust badges. Presentational copy with no backend equivalent —
 *  selorg-service exposes no endpoint for these. Icons live in PromoStrip. */
export const TRUST: TrustBadge[] = [
  { title: "Farm Fresh", sub: "Sourced daily" },
  { title: "100% Organic", sub: "Certified produce" },
  { title: "Fast Delivery", sub: "In minutes" },
  { title: "Easy Returns", sub: "No questions asked" },
  { title: "Secure Payments", sub: "Safe & protected" },
  { title: "24/7 Support", sub: "Always here" },
];
