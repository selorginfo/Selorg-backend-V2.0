import type {
  AppliedCoupon,
  CartLine,
  CartMap,
  CartTotals,
  CartVariantMap,
  Product,
} from "@/types";
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, HANDLING_FEE } from "./constants";

export function variantOf(product: Product, variantIndex?: number) {
  return product.variants[variantIndex ?? 0] ?? product.variants[0]!;
}

export function getCartLines(
  cart: CartMap,
  cartVariant: CartVariantMap,
  products: Product[],
): CartLine[] {
  const lines: CartLine[] = [];
  for (const [productId, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const product = products.find((p) => p.id === productId);
    if (!product) continue;
    const variantIndex = cartVariant[productId] ?? 0;
    const variant = variantOf(product, variantIndex);
    lines.push({
      product,
      variant,
      variantIndex,
      qty,
      lineTotal: variant.price * qty,
      lineMrpTotal: variant.mrp * qty,
    });
  }
  return lines;
}

/** Pricing knobs — override with live values from AppConfigContext (real
 *  selorg-service checkout config) once it has loaded; defaults match the
 *  backend's own hardcoded fallback so the cart page matches what order-create
 *  will actually charge even before the config request resolves. */
export interface PricingConfig {
  freeDeliveryThreshold: number;
  deliveryFee: number;
  handlingFee: number;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
  deliveryFee: DELIVERY_FEE,
  handlingFee: HANDLING_FEE,
};

export function calculateTotals(
  lines: CartLine[],
  couponApplied: AppliedCoupon | null,
  walletUseAtCheckout: boolean,
  walletBalance: number,
  pricing: PricingConfig = DEFAULT_PRICING_CONFIG,
): CartTotals {
  const { freeDeliveryThreshold, deliveryFee, handlingFee } = pricing;
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const sub = lines.reduce((s, l) => s + l.lineTotal, 0);
  const mrpSum = lines.reduce((s, l) => s + l.lineMrpTotal, 0);
  const discount = mrpSum - sub;

  const couponAmt = couponApplied ? Math.min(couponApplied.amount, sub) : 0;

  const delivery = sub === 0 || sub >= freeDeliveryThreshold ? 0 : deliveryFee;
  const handling = sub > 0 ? handlingFee : 0;

  const payable = Math.max(0, sub - couponAmt + delivery + handling);
  const walletUsed =
    walletUseAtCheckout && sub > 0 ? Math.min(walletBalance, payable) : 0;
  const grand = Math.max(0, payable - walletUsed);

  const belowFree = sub > 0 && sub < freeDeliveryThreshold;

  return {
    count,
    sub,
    mrpSum,
    discount,
    couponAmt,
    delivery,
    handling,
    payable,
    walletUsed,
    grand,
    savings: discount + couponAmt,
    hasCoupon: couponAmt > 0,
    usesWallet: walletUsed > 0,
    hasSavings: discount + couponAmt > 0,
    belowFree,
    amtToFree: Math.max(0, freeDeliveryThreshold - sub),
    freeDeliveryThreshold,
  };
}
