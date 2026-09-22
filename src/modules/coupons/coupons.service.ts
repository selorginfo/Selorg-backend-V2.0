import mongoose from 'mongoose';
import { computeDeliveryFee, getDeliveryPricingConfig } from '../../services/deliveryPricing.service';
import { Order } from '../orders/order.model';
import * as couponsRepository from './coupons.repository';
import { IPricingCoupon, PricingCoupon } from './coupon.model';

/**
 * Coupon validation + listing, faithfully ported from legacy `couponsService.js`. Only the
 * read/validate/record-redemption surface cart/pricing/orders need — full admin CRUD for
 * coupons is a later, separate module.
 */

export interface CartItemForValidation {
  productId?: string | null;
  sku_id?: string | null;
  skuId?: string | null;
  category?: string | null;
  price: number;
  qty?: number;
  quantity?: number;
  isOnSale?: boolean;
}

export interface CouponValidationResult {
  valid: boolean;
  error_code?: string;
  min_required?: number;
  allowed?: string;
  discount_amount?: number;
  coupon_type?: string;
  display_name?: string;
  is_cashback?: boolean;
  cashback_value?: number;
}

function toUpper(value: unknown, fallback = ''): string {
  const v = String(value ?? '').trim();
  return v ? v.toUpperCase() : fallback;
}

/** Same single delivery-fee rule the pricing engine bills with. */
export async function deriveDeliveryFee(cartValue = 0): Promise<number> {
  const config = await getDeliveryPricingConfig();
  return computeDeliveryFee(Number(cartValue) || 0, config);
}

export function mapCouponForCustomer(coupon: IPricingCoupon | (Record<string, unknown> & { _id?: unknown })) {
  const c = coupon as unknown as Record<string, unknown>;
  const discountType = String(c.discountType || '').toUpperCase();
  const bannerImageUrl = String(c.bannerImageUrl || '').trim();
  return {
    _id: c._id,
    code: c.code,
    displayName: c.name || c.code,
    title: c.name || c.code,
    description: c.description || '',
    couponType: c.discountType,
    discountType: c.discountType,
    discountValue: c.discountValue || 0,
    minOrderValue: c.minOrderValue ?? c.minOrderAmount ?? 0,
    maxDiscountCap: c.maxDiscount ?? c.maxDiscountAmount ?? null,
    startDate: c.startDate || c.validFrom || null,
    endDate: c.endDate || c.validTo || null,
    usageLimit: c.usageLimit ?? null,
    usagePerUser: c.usagePerUser ?? 1,
    usageCount: c.usageCount ?? 0,
    applicableCategories: c.applicableCategories || [],
    applicableProducts: c.applicableProducts || [],
    applicableSkuIds: c.applicableSkuIds || [],
    targetZones: c.targetZones || [],
    paymentRestriction: c.paymentRestriction || 'ALL',
    showInSections: c.showInSections || ['COUPON_LIST'],
    priorityRank: c.priorityRank ?? 10,
    bannerImageUrl: bannerImageUrl || null,
    termsAndConditions: c.termsAndConditions || '',
    status: c.status,
    isActive: c.isActive !== false && String(c.status || '').toLowerCase() === 'active',
    isCashback: discountType === 'CASHBACK',
  };
}

/** Server-side coupon validation, ported field-for-field from legacy `validateCoupon`. */
export async function validateCoupon(
  couponCode: string,
  userId: string | mongoose.Types.ObjectId,
  cartItems: CartItemForValidation[],
  cartValue: number,
  paymentMethod: string,
  zone: string,
  deliveryFee: number,
): Promise<CouponValidationResult> {
  const now = new Date();

  const coupon = await couponsRepository.findByCode(couponCode);
  if (!coupon) return { valid: false, error_code: 'INVALID_CODE' };

  const status = String(coupon.status || '').toUpperCase();
  if (status !== 'ACTIVE' && coupon.status !== 'active') {
    return { valid: false, error_code: 'COUPON_INACTIVE' };
  }

  const start = coupon.startDate || coupon.validFrom;
  const end = coupon.endDate || coupon.validTo;

  if (start && now < new Date(start)) return { valid: false, error_code: 'COUPON_NOT_VALID_NOW' };
  if (end && now > new Date(end)) return { valid: false, error_code: 'COUPON_NOT_VALID_NOW' };

  if (coupon.validDays && coupon.validDays.length > 0) {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const today = days[now.getDay()];
    if (!coupon.validDays.includes(today)) return { valid: false, error_code: 'COUPON_NOT_VALID_NOW' };
  }

  if (coupon.validTimeSlots && coupon.validTimeSlots.length > 0) {
    const hhmm = now.getHours() * 60 + now.getMinutes();
    const inSlot = coupon.validTimeSlots.some((slot) => {
      const [fh, fm] = slot.from.split(':').map(Number);
      const [th, tm] = slot.to.split(':').map(Number);
      return hhmm >= fh * 60 + fm && hhmm <= th * 60 + tm;
    });
    if (!inSlot) return { valid: false, error_code: 'COUPON_NOT_VALID_NOW' };
  }

  if (coupon.isFirstOrderOnly) {
    const priorOrdersCount = await Order.countDocuments({
      userId: new mongoose.Types.ObjectId(String(userId)),
      status: 'delivered',
    });
    if (priorOrdersCount > 0) return { valid: false, error_code: 'NOT_ELIGIBLE' };
  }

  if (coupon.targetSegment === 'NEW_USERS') {
    const totalOrders = await Order.countDocuments({ userId: new mongoose.Types.ObjectId(String(userId)) });
    if (totalOrders > 0) return { valid: false, error_code: 'NOT_ELIGIBLE' };
  }

  if (coupon.targetSegment === 'LAPSED_30D') {
    const lastOrder = await Order.findOne({ userId: new mongoose.Types.ObjectId(String(userId)) })
      .sort({ createdAt: -1 })
      .lean();
    if (lastOrder) {
      const daysSince = (now.getTime() - new Date(lastOrder.createdAt).getTime()) / 86400000;
      if (daysSince < 30) return { valid: false, error_code: 'NOT_ELIGIBLE' };
    }
  }

  if (coupon.targetSegment === 'SPECIFIC_USER_IDS') {
    if (!coupon.targetUserIds || !coupon.targetUserIds.includes(String(userId))) return { valid: false, error_code: 'NOT_ELIGIBLE' };
  }

  if (coupon.targetZones && coupon.targetZones.length > 0) {
    if (!coupon.targetZones.includes(zone)) return { valid: false, error_code: 'NOT_ELIGIBLE' };
  }

  let qualifyingValue = cartValue;
  const minOrderValue = coupon.minOrderValue || coupon.minOrderAmount || 0;

  if (coupon.discountOn === 'CATEGORY' && coupon.applicableCategories && coupon.applicableCategories.length > 0) {
    qualifyingValue = cartItems
      .filter((item) => !coupon.excludeSaleItems || !item.isOnSale)
      .filter((item) => coupon.applicableCategories.includes(String(item.category)))
      .reduce((sum, item) => sum + item.price * (item.qty || item.quantity || 0), 0);
  }

  if (coupon.discountOn === 'SPECIFIC_SKU' && coupon.applicableSkuIds && coupon.applicableSkuIds.length > 0) {
    qualifyingValue = cartItems
      .filter((item) => !coupon.excludeSaleItems || !item.isOnSale)
      .filter((item) => coupon.applicableSkuIds.includes(String(item.skuId || item.sku_id)))
      .reduce((sum, item) => sum + item.price * (item.qty || item.quantity || 0), 0);
  }

  if (qualifyingValue < minOrderValue) return { valid: false, error_code: 'MIN_ORDER_NOT_MET', min_required: minOrderValue };

  const totalLimit = coupon.usageLimit || 0;
  const currentUsage = coupon.usageCount || 0;
  if (totalLimit > 0 && currentUsage >= totalLimit) return { valid: false, error_code: 'COUPON_EXHAUSTED' };

  const userUsageCount = await couponsRepository.countUserRedemptions(coupon._id as mongoose.Types.ObjectId, String(userId));

  const perUserLimit = coupon.usagePerUser || 1;
  if (userUsageCount >= perUserLimit) return { valid: false, error_code: 'COUPON_EXHAUSTED' };

  const paymentRestriction = String(coupon.paymentRestriction || 'ALL').toUpperCase();
  const normalizedPaymentMethod = toUpper(paymentMethod, 'ALL');
  if (normalizedPaymentMethod !== 'ALL' && paymentRestriction !== 'ALL' && paymentRestriction !== normalizedPaymentMethod) {
    return { valid: false, error_code: 'PAYMENT_METHOD_NOT_ELIGIBLE', allowed: paymentRestriction };
  }

  let discountAmount = 0;
  const discountType = coupon.discountType;
  const discountValue = coupon.discountValue || 0;
  const maxCap = coupon.maxDiscount || coupon.maxDiscountAmount || undefined;

  if (discountType === 'FLAT_DISCOUNT' || discountType === 'fixed' || discountType === 'flat') {
    discountAmount = discountValue;
  } else if (discountType === 'PERCENTAGE' || discountType === 'percentage' || discountType === 'percent') {
    discountAmount = (qualifyingValue * discountValue) / 100;
    if (maxCap) discountAmount = Math.min(discountAmount, maxCap);
  } else if (discountType === 'FREE_DELIVERY' || discountType === 'free_delivery') {
    discountAmount = Math.min(deliveryFee, maxCap || deliveryFee);
  } else if (discountType === 'CASHBACK') {
    discountAmount = 0; // credited post-delivery
  } else if (discountType === 'TIERED_FLAT') {
    const tier = (coupon.tiers || [])
      .filter((t) => qualifyingValue >= (t.minOrder ?? 0))
      .sort((a, b) => (b.minOrder ?? 0) - (a.minOrder ?? 0))[0];
    discountAmount = tier ? tier.discountAmount ?? 0 : 0;
  } else if (discountType === 'BOGO') {
    const eligible = cartItems.filter((i) => (coupon.applicableSkuIds || []).includes(String(i.skuId || i.sku_id)));
    const cheapest = eligible.sort((a, b) => a.price - b.price)[0];
    discountAmount = cheapest ? cheapest.price : 0;
  }

  discountAmount = Math.min(discountAmount, qualifyingValue);

  return {
    valid: true,
    discount_amount: parseFloat(discountAmount.toFixed(2)),
    coupon_type: discountType,
    display_name: coupon.name || coupon.code,
    is_cashback: discountType === 'CASHBACK',
    cashback_value: discountType === 'CASHBACK' ? discountValue : 0,
  };
}

/** List active coupons for the customer app. */
export async function listActiveCoupons(
  params: {
    userId?: string;
    cartValue?: number;
    zone?: string;
    paymentMethod?: string;
    cartItems?: CartItemForValidation[];
  } = {},
) {
  const { userId, cartValue = 0, zone = '', paymentMethod = 'ALL', cartItems = [] } = params;

  const coupons = await couponsRepository.findActiveWindowCoupons();

  const normalizedUserId = userId && mongoose.Types.ObjectId.isValid(String(userId)) ? String(userId) : null;
  const deliveryFee = await deriveDeliveryFee(cartValue);
  const annotatedCoupons: Array<ReturnType<typeof mapCouponForCustomer> & { eligible: boolean; ineligibilityReason: string | null }> = [];

  for (const coupon of coupons) {
    const mapped = mapCouponForCustomer(coupon);
    if (!normalizedUserId) {
      annotatedCoupons.push({ ...mapped, eligible: true, ineligibilityReason: null });
      continue;
    }
    const validation = await validateCoupon(
      String(coupon.code),
      normalizedUserId,
      Array.isArray(cartItems) ? cartItems : [],
      Number(cartValue) || 0,
      paymentMethod || 'ALL',
      zone || '',
      deliveryFee,
    );
    annotatedCoupons.push({
      ...mapped,
      eligible: !!validation.valid,
      ineligibilityReason: validation.valid ? null : validation.error_code || 'NOT_ELIGIBLE',
    });
  }

  return annotatedCoupons;
}

export interface RedeemCouponParams {
  couponCode: string;
  userId: string;
  orderId: string;
  cartItems?: CartItemForValidation[];
  cartValue?: number;
  paymentMethod?: string;
  zone?: string;
  deliveryFee?: number;
}

/**
 * Redeem a coupon for an order — re-validates inside a transaction to prevent race
 * conditions, increments usageCount, and records a CouponRedemption. Faithfully ported
 * from legacy `couponsController.redeem`. Callers that already run inside a transaction
 * (e.g. orders.service.ts order creation) should apply the equivalent inline rather than
 * nesting sessions.
 */
export async function redeemCoupon(params: RedeemCouponParams): Promise<{ success: boolean; discount_applied?: number } & CouponValidationResult> {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await validateCoupon(
      params.couponCode,
      params.userId,
      params.cartItems || [],
      Number(params.cartValue) || 0,
      params.paymentMethod || 'ALL',
      params.zone || '',
      Number(params.deliveryFee) || 0,
    );

    if (!result.valid) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, ...result };
    }

    const normalizedCode = String(params.couponCode || '').toUpperCase();
    const coupon = await PricingCoupon.findOne({ code: normalizedCode }).session(session);
    if (!coupon) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, valid: false, error_code: 'INVALID_CODE' };
    }

    await PricingCoupon.updateOne({ _id: coupon._id }, { $inc: { usageCount: 1 } }).session(session);

    await couponsRepository.recordRedemptionInSession(
      {
        couponId: coupon._id as mongoose.Types.ObjectId,
        userId: new mongoose.Types.ObjectId(String(params.userId)),
        orderId: new mongoose.Types.ObjectId(String(params.orderId)),
        discountApplied: result.discount_amount || 0,
      },
      session,
    );

    await session.commitTransaction();
    session.endSession();

    return { success: true, discount_applied: result.discount_amount, ...result };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// --- Admin CRUD ------------------------------------------------------------------------

export interface AdminCreateCouponInput {
  code: string;
  name?: string;
  description?: string;
  discountType?: string;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number | null;
  validFrom?: string | Date;
  validTo?: string | Date;
  isActive?: boolean;
  usageLimit?: number | null;
}

export async function adminListCoupons(params: { search?: string; isActive?: boolean; page?: number; limit?: number }) {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const skip = (page - 1) * limit;
  const [items, total] = await couponsRepository.adminList({ search: params.search, isActive: params.isActive }, skip, limit);
  return { items, total, page, limit };
}

export async function adminGetCoupon(id: string) {
  return couponsRepository.findById(id);
}

export async function adminCreateCoupon(input: AdminCreateCouponInput) {
  const code = input.code.toUpperCase();
  const existing = await couponsRepository.findByCode(code);
  if (existing) {
    const err = new Error('Coupon code already exists') as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }
  return couponsRepository.create({
    code,
    name: input.name || code,
    description: input.description,
    discountType: input.discountType || 'percent',
    discountValue: input.discountValue,
    minOrderValue: input.minOrderAmount || 0,
    minOrderAmount: input.minOrderAmount || 0,
    maxDiscount: input.maxDiscountAmount ?? null,
    maxDiscountAmount: input.maxDiscountAmount ?? null,
    startDate: input.validFrom || new Date(),
    endDate: input.validTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    validFrom: input.validFrom || null,
    validTo: input.validTo || null,
    isActive: input.isActive !== false,
    status: input.isActive === false ? 'paused' : 'active',
    usageLimit: input.usageLimit || null,
  });
}

export async function adminUpdateCoupon(id: string, body: Record<string, unknown>) {
  const payload = { ...body };
  delete payload._id;
  if (typeof payload.code === 'string') payload.code = payload.code.toUpperCase();
  if (payload.minOrderAmount !== undefined && payload.minOrderValue === undefined) payload.minOrderValue = payload.minOrderAmount;
  if (payload.maxDiscountAmount !== undefined && payload.maxDiscount === undefined) payload.maxDiscount = payload.maxDiscountAmount;
  if (payload.validFrom !== undefined && payload.startDate === undefined) payload.startDate = payload.validFrom;
  if (payload.validTo !== undefined && payload.endDate === undefined) payload.endDate = payload.validTo;
  if (payload.isActive !== undefined && payload.status === undefined) payload.status = payload.isActive ? 'active' : 'paused';
  const updated = await couponsRepository.updateById(id, payload);
  if (!updated) {
    const err = new Error('Coupon not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  return updated;
}

export async function adminDeleteCoupon(id: string) {
  const deleted = await couponsRepository.deleteById(id);
  if (!deleted) {
    const err = new Error('Coupon not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
}

export async function adminStats() {
  return couponsRepository.stats();
}

/** Ported from legacy `couponStatusJob.js` — plain function, not scheduled here (no cron/worker in this repo yet). */
export async function runCouponStatusJob() {
  return couponsRepository.processCouponStatusUpdates();
}
