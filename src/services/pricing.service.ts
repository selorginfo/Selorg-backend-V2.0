import { logger } from '../utils/logger';
import { validateCoupon } from '../modules/coupons/coupons.service';
import { Product } from '../modules/products/products.model';
import { computeDeliveryFee, getDeliveryPricingConfig } from './deliveryPricing.service';

/**
 * Central pricing engine, ported field-for-field from legacy `pricingEngineService.js`
 * (itself an intentionally read-only "phase-1 skeleton": flash sales / bundles / promotion
 * rules / tax are placeholders upstream too — not something this port added).
 */

const PRICING_VERSION = 'v1';

export type PricingMode = 'cart' | 'checkout' | 'order' | 'invoice';

export interface PricingCartItemInput {
  lineId?: string;
  productId?: string | null;
  variantId?: string | null;
  quantity?: number;
  baseUnitPrice?: number;
}

export interface CalculatePricingInput {
  userId?: string | null;
  cartItems?: PricingCartItemInput[];
  couponCode?: string | null;
  zone?: string | null;
  paymentMethod?: string | null;
  mode?: PricingMode;
}

interface PricingTotals {
  itemTotal: number;
  discount: number;
  deliveryFee: number;
  handlingCharge: number;
  tax: number;
  finalAmount: number;
}

interface PricingLineItem {
  lineId: string;
  productId: string | null;
  variantId: string | null;
  quantity: number;
  baseUnitPrice: number;
  effectiveUnitPrice: number;
  unitPrice?: number;
  lineBaseTotal: number;
  lineDiscountTotal: number;
  lineTaxTotal: number;
  lineFinalTotal: number;
  metadata: Record<string, unknown>;
}

interface AppliedCoupon {
  code: string;
  couponId?: string | null;
  status: 'applied' | 'invalid';
  reason?: string;
  discountType?: string;
  discountValue?: number;
  amount?: number;
  source?: string;
}

interface PricingContext {
  input: {
    userId: string | null;
    cartItems: PricingCartItemInput[];
    couponCode: string | null;
    zone: string | null;
    paymentMethod: string | null;
    mode: PricingMode;
  };
  items: PricingLineItem[];
  adjustments: Array<{ type: string; code: string; amount: number; couponId?: string }>;
  totals: PricingTotals;
  appliedCoupon: AppliedCoupon | null;
  pricingVersion: string;
  diagnostics: { startedAt: string; completedAt?: string; warnings: string[] };
}

export interface PricingResult {
  items: PricingLineItem[];
  adjustments: PricingContext['adjustments'];
  totals: PricingTotals;
  appliedCoupon: AppliedCoupon | null;
  pricingVersion: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeMode(mode: unknown): PricingMode {
  const allowed = new Set(['cart', 'checkout', 'order', 'invoice']);
  const normalized = String(mode || '').toLowerCase();
  return (allowed.has(normalized) ? normalized : 'cart') as PricingMode;
}

function summarizeCartItems(cartItems: unknown) {
  const safeItems = Array.isArray(cartItems) ? (cartItems as PricingCartItemInput[]) : [];
  const itemCount = safeItems.reduce((sum, it) => sum + Math.max(0, toNumber(it.quantity, 0)), 0);
  const lineCount = safeItems.length;
  const productCount = new Set(safeItems.map((it) => String(it.productId || ''))).size;
  return { lineCount, itemCount, productCount };
}

function debugLog(stage: string, context: Partial<PricingContext> | undefined, extra: Record<string, unknown> = {}) {
  const safeContext = context || ({} as Partial<PricingContext>);
  const safeInput = safeContext.input || ({} as PricingContext['input']);
  const summary = summarizeCartItems(safeInput.cartItems);
  const payload = {
    ts: nowIso(),
    stage,
    mode: safeInput.mode || 'cart',
    userId: safeInput.userId || null,
    couponCode: safeInput.couponCode || null,
    zone: safeInput.zone || null,
    paymentMethod: safeInput.paymentMethod || null,
    cartSummary: summary,
    totals: {
      itemTotal: toNumber(safeContext?.totals?.itemTotal, 0),
      discount: toNumber(safeContext?.totals?.discount, 0),
      deliveryFee: toNumber(safeContext?.totals?.deliveryFee, 0),
      handlingCharge: toNumber(safeContext?.totals?.handlingCharge, 0),
      tax: toNumber(safeContext?.totals?.tax, 0),
      finalAmount: toNumber(safeContext?.totals?.finalAmount, 0),
    },
    adjustmentsCount: Array.isArray(safeContext.adjustments) ? safeContext.adjustments.length : 0,
    ...extra,
  };
  logger.debug('[pricing-engine]', payload);
}

function ensureZeroTotals(totals: Partial<PricingTotals> | undefined): PricingTotals {
  const safeTotals = totals || {};
  return {
    itemTotal: toNumber(safeTotals.itemTotal, 0),
    discount: toNumber(safeTotals.discount, 0),
    deliveryFee: toNumber(safeTotals.deliveryFee, 0),
    handlingCharge: toNumber(safeTotals.handlingCharge, 0),
    tax: toNumber(safeTotals.tax, 0),
    finalAmount: toNumber(safeTotals.finalAmount, 0),
  };
}

async function computeBaseDeliveryFee(itemTotal: number): Promise<number> {
  const config = await getDeliveryPricingConfig();
  return computeDeliveryFee(toNumber(itemTotal, 0), config);
}

function buildInitialContext(input: CalculatePricingInput): PricingContext {
  const normalized: PricingContext['input'] = {
    userId: input?.userId || null,
    cartItems: Array.isArray(input?.cartItems) ? input.cartItems! : [],
    couponCode: input?.couponCode ? String(input.couponCode).trim().toUpperCase() : null,
    zone: input?.zone || null,
    paymentMethod: input?.paymentMethod || null,
    mode: normalizeMode(input?.mode),
  };

  return {
    input: normalized,
    items: normalized.cartItems.map((line, idx) => ({
      lineId: line.lineId || `line_${idx + 1}`,
      productId: line.productId || null,
      variantId: line.variantId || null,
      quantity: Math.max(1, toNumber(line.quantity, 1)),
      baseUnitPrice: toNumber(line.baseUnitPrice, 0),
      effectiveUnitPrice: toNumber(line.baseUnitPrice, 0),
      lineBaseTotal: 0,
      lineDiscountTotal: 0,
      lineTaxTotal: 0,
      lineFinalTotal: 0,
      metadata: { source: 'input' },
    })),
    adjustments: [],
    totals: { itemTotal: 0, discount: 0, deliveryFee: 0, handlingCharge: 0, tax: 0, finalAmount: 0 },
    appliedCoupon: null,
    pricingVersion: PRICING_VERSION,
    diagnostics: { startedAt: nowIso(), warnings: [] },
  };
}

async function getBasePrices(context: PricingContext): Promise<PricingContext> {
  const next: PricingContext = { ...context, items: Array.isArray(context.items) ? [...context.items] : [] };
  const resolvedItems = await Promise.all(
    next.items.map(async (item) => {
      const quantity = Math.max(1, toNumber(item.quantity, 1));
      let unitPrice = toNumber(item.baseUnitPrice, 0);
      let gstRate = 0;
      let source = 'fallback_input';

      try {
        if (item.productId) {
          const product = await Product.findById(item.productId).lean();
          if (product) {
            unitPrice = toNumber(product.price, unitPrice);
            gstRate = toNumber(product.gstRate, 0);
            source = 'product';
            if (Array.isArray(product.variants) && product.variants.length) {
              const variant = (product.variants as Array<{ _id?: unknown; price?: number }>).find(
                (v) => String(v._id) === String(item.variantId),
              );
              if (variant) {
                unitPrice = toNumber(variant.price, unitPrice);
                source = 'variant';
              }
            }
          }
        }
      } catch {
        source = 'fallback_error';
      }

      const lineBaseTotal = unitPrice * quantity;
      return {
        ...item,
        quantity,
        unitPrice,
        baseUnitPrice: unitPrice,
        effectiveUnitPrice: unitPrice,
        lineBaseTotal,
        lineDiscountTotal: 0,
        lineTaxTotal: 0,
        lineFinalTotal: lineBaseTotal,
        metadata: { ...(item.metadata || {}), source, gstRate },
      };
    }),
  );
  next.items = resolvedItems;
  next.totals = {
    ...ensureZeroTotals(next.totals),
    itemTotal: resolvedItems.reduce((sum, item) => sum + toNumber(item.lineBaseTotal, 0), 0),
  };
  debugLog('getBasePrices', next, { resolvedItems: resolvedItems.length });
  return next;
}

async function applyFlashSales(context: PricingContext): Promise<PricingContext> {
  const next: PricingContext = { ...context, totals: ensureZeroTotals(context.totals) };
  // Placeholder: no flash sale computation in phase-1 (legacy behavior, not a gap here).
  debugLog('applyFlashSales', next, { applied: false, reason: 'placeholder' });
  return next;
}

async function applyBundles(context: PricingContext): Promise<PricingContext> {
  const next: PricingContext = { ...context, totals: ensureZeroTotals(context.totals) };
  debugLog('applyBundles', next, { applied: false, reason: 'placeholder' });
  return next;
}

async function applyPromotionRules(context: PricingContext): Promise<PricingContext> {
  const next: PricingContext = { ...context, totals: ensureZeroTotals(context.totals) };
  debugLog('applyPromotionRules', next, { applied: false, reason: 'placeholder' });
  return next;
}

async function applyCoupon(context: PricingContext): Promise<PricingContext> {
  const next: PricingContext = { ...context, totals: ensureZeroTotals(context.totals) };
  const couponCode = next.input.couponCode;
  if (!couponCode) {
    debugLog('applyCoupon', next, { appliedCoupon: null, reason: 'no_coupon_code' });
    return next;
  }

  const itemTotal = toNumber(next.totals.itemTotal, 0);
  const deliveryFeeForValidation = await computeBaseDeliveryFee(itemTotal);
  try {
    const { findByCode } = await import('../modules/coupons/coupons.repository');
    const coupon = await findByCode(couponCode);
    if (!coupon) {
      next.appliedCoupon = { code: couponCode, status: 'invalid', reason: 'not_found' };
      debugLog('applyCoupon', next, { appliedCoupon: next.appliedCoupon });
      return next;
    }

    const cartItemsForValidation = (next.items || []).map((item) => ({
      productId: item.productId || null,
      sku_id: item.variantId || null,
      skuId: item.variantId || null,
      category: (item.metadata?.category as string) || null,
      price: toNumber(item.baseUnitPrice ?? item.unitPrice, 0),
      qty: toNumber(item.quantity, 1),
      quantity: toNumber(item.quantity, 1),
      isOnSale: false,
    }));
    const validation = await validateCoupon(
      String(coupon.code),
      next.input.userId || '',
      cartItemsForValidation,
      itemTotal,
      next.input.paymentMethod || 'ALL',
      next.input.zone || '',
      deliveryFeeForValidation,
    );

    if (!validation.valid) {
      next.appliedCoupon = { code: String(coupon.code), status: 'invalid', reason: validation.error_code || 'not_eligible' };
      debugLog('applyCoupon', next, { appliedCoupon: next.appliedCoupon });
      return next;
    }

    const discountAmount = Math.max(0, toNumber(validation.discount_amount, 0));

    next.adjustments = Array.isArray(next.adjustments) ? [...next.adjustments] : [];
    next.adjustments.push({
      type: 'COUPON',
      code: String(coupon.code),
      amount: discountAmount,
      couponId: coupon._id ? String(coupon._id) : undefined,
    });
    next.totals.discount = toNumber(next.totals.discount, 0) + discountAmount;
    next.appliedCoupon = {
      code: String(coupon.code),
      couponId: coupon._id ? String(coupon._id) : null,
      status: 'applied',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      amount: discountAmount,
      source: 'couponsService.validateCoupon',
    };
  } catch {
    next.appliedCoupon = { code: couponCode, status: 'invalid', reason: 'lookup_failed' };
  }
  debugLog('applyCoupon', next, {
    appliedCoupon: next.appliedCoupon ? { code: next.appliedCoupon.code, status: next.appliedCoupon.status } : null,
  });
  return next;
}

async function applyFees(context: PricingContext): Promise<PricingContext> {
  const itemTotal = toNumber(context.totals?.itemTotal, 0);
  const hasBillableItems = itemTotal > 0;
  const config = await getDeliveryPricingConfig();
  const baseDeliveryFee = hasBillableItems ? computeDeliveryFee(itemTotal, config) : 0;
  const handlingCharge = hasBillableItems ? config.handlingCharge : 0;
  const next: PricingContext = {
    ...context,
    totals: { ...ensureZeroTotals(context.totals), deliveryFee: baseDeliveryFee, handlingCharge },
  };
  debugLog('applyFees', next, {
    freeDeliveryThreshold: config.freeDeliveryThreshold,
    defaultDeliveryFee: config.deliveryFee,
    handlingCharge,
  });
  return next;
}

async function applyTax(context: PricingContext): Promise<PricingContext> {
  const next: PricingContext = { ...context, totals: { ...ensureZeroTotals(context.totals), tax: 0 } }; // Placeholder for phase-1
  debugLog('applyTax', next, { taxPolicy: 'placeholder' });
  return next;
}

async function finalizeTotals(context: PricingContext): Promise<PricingContext> {
  const safeItems = Array.isArray(context.items) ? context.items : [];
  const safeTotals = ensureZeroTotals(context.totals);
  const itemTotal = toNumber(safeTotals.itemTotal, 0) || safeItems.reduce((sum, item) => sum + toNumber(item.lineBaseTotal ?? item.lineFinalTotal, 0), 0);
  const discount = toNumber(safeTotals.discount, 0) || safeItems.reduce((sum, item) => sum + toNumber(item.lineDiscountTotal, 0), 0);
  const deliveryFee = toNumber(safeTotals.deliveryFee, 0);
  const handlingCharge = toNumber(safeTotals.handlingCharge, 0);
  const tax = toNumber(safeTotals.tax, 0);
  const finalAmount = Math.max(0, itemTotal - discount + deliveryFee + handlingCharge + tax);

  const next: PricingContext = {
    ...context,
    totals: { itemTotal, discount, deliveryFee, handlingCharge, tax, finalAmount },
    diagnostics: { ...context.diagnostics, completedAt: nowIso() },
  };

  debugLog('finalizeTotals', next, { completed: true });
  return next;
}

export function compareWithLegacy(cartData: { itemTotal?: number; finalAmount?: number; totalBill?: number }, engineTotals: Partial<PricingTotals>) {
  const oldItemTotal = toNumber(cartData?.itemTotal, 0);
  const oldFinal = toNumber(cartData?.finalAmount ?? cartData?.totalBill, 0);
  const safeEngineTotals = ensureZeroTotals(engineTotals);
  const newItemTotal = safeEngineTotals.itemTotal;
  const newFinal = safeEngineTotals.finalAmount;
  const itemTotalDiff = newItemTotal - oldItemTotal;
  const finalDiff = newFinal - oldFinal;
  const itemTotalDiffPct = oldItemTotal > 0 ? Math.abs(itemTotalDiff / oldItemTotal) * 100 : 0;
  const finalDiffPct = oldFinal > 0 ? Math.abs(finalDiff / oldFinal) * 100 : 0;
  let severity: 'info' | 'warning' | 'error' = 'info';
  if (itemTotalDiffPct > 5 || finalDiffPct > 5) {
    severity = 'error';
  } else if (itemTotalDiffPct > 1 || finalDiffPct > 1) {
    severity = 'warning';
  }

  debugLog(
    'compareWithLegacy',
    { input: { userId: null, cartItems: [], couponCode: null, zone: null, paymentMethod: null, mode: 'cart' }, totals: safeEngineTotals, adjustments: [] },
    {
      severity,
      oldItemTotal,
      newItemTotal,
      oldFinal,
      newFinal,
      itemTotalDiff,
      finalDiff,
      itemTotalDiffPct: Number(itemTotalDiffPct.toFixed(2)),
      finalDiffPct: Number(finalDiffPct.toFixed(2)),
    },
  );
}

/** Main pricing orchestrator. */
export async function calculatePricing(input: CalculatePricingInput): Promise<PricingResult> {
  let context = buildInitialContext(input);
  debugLog('start', context, { message: 'Pricing calculation started' });

  if (!Array.isArray(context.items) || context.items.length === 0) {
    context = await finalizeTotals({ ...context, items: [], totals: ensureZeroTotals(context.totals) });

    return {
      items: [],
      adjustments: Array.isArray(context.adjustments) ? context.adjustments : [],
      totals: ensureZeroTotals(context.totals),
      appliedCoupon: context.appliedCoupon || null,
      pricingVersion: PRICING_VERSION,
    };
  }

  context = await getBasePrices(context);
  context = await applyFlashSales(context);
  context = await applyBundles(context);
  context = await applyPromotionRules(context);
  context = await applyCoupon(context);
  context = await applyFees(context);
  context = await applyTax(context);
  context = await finalizeTotals(context);

  return {
    items: Array.isArray(context.items) ? context.items : [],
    adjustments: Array.isArray(context.adjustments) ? context.adjustments : [],
    totals: ensureZeroTotals(context.totals),
    appliedCoupon: context.appliedCoupon,
    pricingVersion: PRICING_VERSION,
  };
}
