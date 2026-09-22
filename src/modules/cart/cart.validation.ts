import { z } from 'zod';

export const getCartQuerySchema = z
  .object({
    coupon_code: z.string().trim().optional(),
    zone: z.string().trim().optional(),
    payment_method: z.string().trim().optional(),
  })
  .passthrough();
export type GetCartQuery = z.infer<typeof getCartQuerySchema>;

export const addCartItemSchema = z.object({
  productId: z.string().trim().min(1, 'productId and quantity required'),
  variantId: z.string().trim().optional(),
  quantity: z.number().int().optional(),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0),
  productId: z.string().trim().optional(),
  variantId: z.string().trim().optional(),
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const updateCartItemByProductVariantSchema = z.object({
  quantity: z.number().int().min(0),
  productId: z.string().trim().min(1, 'productId and quantity required'),
  variantId: z.string().trim().optional(),
});
export type UpdateCartItemByProductVariantInput = z.infer<typeof updateCartItemByProductVariantSchema>;

export const removeCartItemSchema = z.object({
  productId: z.string().trim().optional(),
  variantId: z.string().trim().optional(),
});
export type RemoveCartItemInput = z.infer<typeof removeCartItemSchema>;

export const mergeCartSchema = z.object({
  mergeKey: z.string().trim().min(1, 'mergeKey required'),
  items: z
    .array(
      z.object({
        productId: z.string().optional(),
        variantId: z.string().optional(),
        quantity: z.number().optional(),
      }),
    )
    .optional(),
});
export type MergeCartInput = z.infer<typeof mergeCartSchema>;
