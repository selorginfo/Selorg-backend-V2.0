/**
 * Single source of truth for the cart/checkout delivery-fee business rule:
 *
 *   deliveryFee = 0                     when itemTotal >= freeDeliveryThreshold
 *   deliveryFee = flat configured fee   otherwise (plus a flat handling charge)
 *
 * The rule intentionally does NOT depend on authentication state or address —
 * guests and logged-in users must always see the same charge for the same cart.
 *
 * Value resolution order (per field):
 *   1. AppConfig.checkout (admin-managed, key 'default') when set to a value > 0
 *   2. PRICING_* environment variables
 *   3. Hardcoded defaults (fee ₹40, free above ₹499, handling ₹5)
 *
 * A stored value of 0 is treated as "not configured" (falls through to env),
 * because the historical AppConfig document defaults to 0 while orders have
 * always been charged with the engine's env defaults. To make delivery
 * effectively free, set freeDeliveryMinAmount to 1.
 */

const ENV_FREE_DELIVERY_THRESHOLD = Number(process.env.PRICING_FREE_DELIVERY_THRESHOLD || 499);
const ENV_DELIVERY_FEE = Number(process.env.PRICING_DELIVERY_FEE || 40);
const ENV_HANDLING_CHARGE = Number(process.env.PRICING_HANDLING_CHARGE || 5);

const CACHE_TTL_MS = 60 * 1000;

export interface DeliveryPricingConfig {
  deliveryFee: number;
  freeDeliveryThreshold: number;
  handlingCharge: number;
}

interface CheckoutConfigShape {
  deliveryFee?: number;
  freeDeliveryMinAmount?: number;
  handlingCharge?: number;
}

let cached: DeliveryPricingConfig | null = null;
let cachedAt = 0;

function positiveOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function resolveFromCheckout(checkout: CheckoutConfigShape = {}): DeliveryPricingConfig {
  return {
    deliveryFee: positiveOr(checkout.deliveryFee, ENV_DELIVERY_FEE),
    freeDeliveryThreshold: positiveOr(checkout.freeDeliveryMinAmount, ENV_FREE_DELIVERY_THRESHOLD),
    handlingCharge: positiveOr(checkout.handlingCharge, ENV_HANDLING_CHARGE),
  };
}

function envDefaults(): DeliveryPricingConfig {
  return {
    deliveryFee: ENV_DELIVERY_FEE,
    freeDeliveryThreshold: ENV_FREE_DELIVERY_THRESHOLD,
    handlingCharge: ENV_HANDLING_CHARGE,
  };
}

/** Effective delivery pricing config (cached ~60s; pricing runs on every cart read). Never throws. */
export async function getDeliveryPricingConfig(): Promise<DeliveryPricingConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;
  try {
    const { AppConfig } = await import('../modules/app-config/app-config.model');
    const doc = await AppConfig.findOne({ key: 'default' }).select('checkout').lean();
    cached = resolveFromCheckout(doc?.checkout);
  } catch {
    cached = envDefaults();
  }
  cachedAt = now;
  return cached;
}

/** Delivery fee for a given item total under the single business rule. */
export function computeDeliveryFee(itemTotal: number, config: DeliveryPricingConfig): number {
  const total = Number(itemTotal) || 0;
  if (total <= 0) return 0; // empty / zero-value cart: no fee
  return total >= config.freeDeliveryThreshold ? 0 : config.deliveryFee;
}

/** Drop the memoized config (call after admin updates AppConfig.checkout). */
export function invalidateDeliveryPricingCache(): void {
  cached = null;
  cachedAt = 0;
}

/**
 * Overwrite an app-config object's checkout block with the EFFECTIVE pricing values the
 * engine bills with, so clients (guest carts included) always display the same fee the
 * backend charges.
 */
export function applyEffectiveCheckoutPricing<T extends { checkout?: CheckoutConfigShape }>(appConfigObj: T): T {
  if (!appConfigObj || typeof appConfigObj !== 'object') return appConfigObj;
  const effective = resolveFromCheckout(appConfigObj.checkout || {});
  appConfigObj.checkout = {
    ...(appConfigObj.checkout || {}),
    deliveryFee: effective.deliveryFee,
    freeDeliveryMinAmount: effective.freeDeliveryThreshold,
    handlingCharge: effective.handlingCharge,
  };
  return appConfigObj;
}
