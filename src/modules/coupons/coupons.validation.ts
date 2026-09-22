import { z } from 'zod';

export const validateCouponSchema = z.object({
  coupon_code: z.string().min(1),
  user_id: z.string().optional(),
  cart_items: z.array(z.record(z.any())).optional(),
  cart_value: z.union([z.number(), z.string()]).optional(),
  payment_method: z.string().optional(),
  zone: z.string().optional(),
  delivery_fee: z.union([z.number(), z.string()]).optional(),
});
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;

export const redeemCouponSchema = z.object({
  coupon_code: z.string().min(1),
  user_id: z.string().optional(),
  order_id: z.string().min(1),
  cart_items: z.array(z.record(z.any())).optional(),
  cart_value: z.union([z.number(), z.string()]).optional(),
  payment_method: z.string().optional(),
  zone: z.string().optional(),
  delivery_fee: z.union([z.number(), z.string()]).optional(),
});
export type RedeemCouponInput = z.infer<typeof redeemCouponSchema>;

export const createCouponSchema = z.object({
  code: z.string().trim().min(1, 'code is required'),
  name: z.string().trim().optional(),
  description: z.string().trim().optional(),
  discountType: z.string().optional(),
  discountValue: z.number(),
  minOrderAmount: z.number().optional(),
  maxDiscountAmount: z.number().nullable().optional(),
  validFrom: z.union([z.string(), z.date()]).optional(),
  validTo: z.union([z.string(), z.date()]).optional(),
  isActive: z.boolean().optional(),
  usageLimit: z.number().nullable().optional(),
});
export type CreateCouponInput = z.infer<typeof createCouponSchema>;

export const updateCouponSchema = z.record(z.any());
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
