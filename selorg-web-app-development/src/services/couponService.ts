import { apiGet, apiPost } from "./api";

/**
 * selorg-service's coupon endpoints use snake_case body fields — a genuine
 * inconsistency vs. the rest of the (camelCase) API, confirmed in
 * src/modules/coupons/coupons.controller.ts — not a typo to "fix" here.
 */

export interface CouponListItem {
  _id: string;
  code: string;
  displayName?: string;
  title?: string;
  description?: string;
  discountType: string;
  discountValue: number;
  minOrderValue?: number;
  maxDiscountCap?: number;
  eligible: boolean;
  ineligibilityReason: string | null;
}

export interface CouponValidateSuccess {
  valid: true;
  discount_amount: number;
  coupon_type: string;
  display_name: string;
  is_cashback: boolean;
  cashback_value: number;
}

export type CouponErrorCode =
  | "INVALID_CODE"
  | "COUPON_INACTIVE"
  | "COUPON_NOT_VALID_NOW"
  | "NOT_ELIGIBLE"
  | "MIN_ORDER_NOT_MET"
  | "COUPON_EXHAUSTED"
  | "PAYMENT_METHOD_NOT_ELIGIBLE";

export interface CouponValidateFailure {
  valid: false;
  error_code: CouponErrorCode;
  min_required?: number;
  allowed?: string;
}

export type CouponValidateResult = CouponValidateSuccess | CouponValidateFailure;

export interface ValidateCouponInput {
  couponCode: string;
  cartValue: number;
  cartItems?: { productId: string; categoryId?: string; sku?: string; price: number; quantity: number }[];
  paymentMethod?: string;
  zone?: string;
  deliveryFee?: number;
}

export const couponService = {
  /** GET /coupons — list of coupons with per-user eligibility, when a session exists. */
  async list(cartValue?: number): Promise<CouponListItem[]> {
    const query = cartValue ? `?cart_value=${cartValue}` : "";
    try {
      const result = await apiGet<{ coupons: CouponListItem[] }>(`/coupons${query}`);
      return result.coupons ?? [];
    } catch {
      return [];
    }
  },

  /** POST /coupons/validate — the real validation engine (see API_CONTRACT.md for the exact rule order). */
  async validate(input: ValidateCouponInput): Promise<CouponValidateResult> {
    return apiPost<CouponValidateResult>("/coupons/validate", {
      coupon_code: input.couponCode,
      cart_value: input.cartValue,
      cart_items: input.cartItems,
      payment_method: input.paymentMethod,
      zone: input.zone,
      delivery_fee: input.deliveryFee,
    });
  },
};

/** Human-readable message per error code, mirroring the local mock's toast copy. */
export function couponErrorMessage(result: CouponValidateFailure, code: string): string {
  switch (result.error_code) {
    case "INVALID_CODE":
      return "Invalid coupon code";
    case "MIN_ORDER_NOT_MET":
      return result.min_required
        ? `Add ₹${result.min_required} more to use ${code}`
        : "This order doesn't meet the coupon's minimum value";
    case "COUPON_EXHAUSTED":
      return "This coupon has reached its usage limit";
    case "COUPON_INACTIVE":
    case "COUPON_NOT_VALID_NOW":
      return "This coupon isn't valid right now";
    case "PAYMENT_METHOD_NOT_ELIGIBLE":
      return result.allowed ? `This coupon only works with ${result.allowed}` : "This coupon isn't valid for the selected payment method";
    case "NOT_ELIGIBLE":
    default:
      return "You're not eligible for this coupon";
  }
}
