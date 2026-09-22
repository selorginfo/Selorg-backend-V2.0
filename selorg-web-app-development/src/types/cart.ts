import type { Product, ProductVariant } from "./product";

export type CartMap = Record<string, number>;
export type CartVariantMap = Record<string, number>;

export interface CartLine {
  product: Product;
  variant: ProductVariant;
  variantIndex: number;
  qty: number;
  lineTotal: number;
  lineMrpTotal: number;
}

export interface CartTotals {
  count: number;
  sub: number;
  mrpSum: number;
  discount: number;
  couponAmt: number;
  delivery: number;
  handling: number;
  payable: number;
  walletUsed: number;
  grand: number;
  savings: number;
  hasCoupon: boolean;
  usesWallet: boolean;
  hasSavings: boolean;
  belowFree: boolean;
  amtToFree: number;
  freeDeliveryThreshold: number;
}
