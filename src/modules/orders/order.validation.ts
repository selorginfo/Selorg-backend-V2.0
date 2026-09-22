import { z } from 'zod';

export const listOrdersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.string().trim().optional(),
  })
  .passthrough();
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        variantId: z.string().trim().optional(),
        quantity: z.number().int().min(1).optional(),
      }),
    )
    .min(1, 'Items required'),
  addressId: z.string().trim().min(1, 'Address not found'),
  paymentMethodId: z.string().trim().optional(),
  paymentMethodType: z.enum(['card', 'upi', 'cash', 'wallet', 'digital']).optional(),
  couponCode: z.string().trim().optional(),
  deliveryTip: z.number().min(0).optional(),
  deliveryNotes: z.string().trim().optional(),
  customerName: z.string().trim().optional(),
  customerEmail: z.string().trim().optional(),
  customerPhone: z.string().trim().optional(),
  /** `now` = express; `today:slot-1` / `tomorrow:slot-2` = scheduled. */
  deliverySlotOptionId: z.string().trim().optional(),
  deliveryMode: z.enum(['express', 'scheduled']).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Accept missing/empty body (clients may POST with no JSON). */
export const cancelOrderSchema = z.preprocess(
  (val) => (val == null || typeof val !== 'object' ? {} : val),
  z.object({
    reason: z.string().trim().optional(),
  }),
);
export type CancelOrderInput = { reason?: string };

export const rateOrderSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().optional(),
});
export type RateOrderInput = z.infer<typeof rateOrderSchema>;

export const verifyOrderOtpSchema = z.object({
  otp: z.string().trim().min(1, 'OTP required'),
});
export type VerifyOrderOtpInput = z.infer<typeof verifyOrderOtpSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(['confirmed', 'getting-packed', 'on-the-way', 'arrived', 'delivered', 'cancelled']),
  actor: z.string().trim().optional(),
  note: z.string().trim().optional(),
  riderId: z.string().trim().optional(),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
