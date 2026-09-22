import { z } from 'zod';

export const addPaymentMethodSchema = z.object({
  type: z.enum(['card', 'upi', 'wallet']).optional(),
  cardNumber: z.string().trim().optional(),
  expiryMonth: z.string().trim().optional(),
  expiryYear: z.string().trim().optional(),
  cardholderName: z.string().trim().optional(),
  upiId: z.string().trim().optional(),
  walletName: z.string().trim().optional(),
});
export type AddPaymentMethodInput = z.infer<typeof addPaymentMethodSchema>;

export const updatePaymentMethodSchema = z.object({
  cardNumber: z.string().trim().optional(),
  expiryMonth: z.string().trim().optional(),
  expiryYear: z.string().trim().optional(),
  cardholderName: z.string().trim().optional(),
});
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;

export const createWorldlineSessionSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId is required'),
  platform: z.enum(['android', 'ios', 'web'], { errorMap: () => ({ message: 'platform must be android, ios, or web' }) }),
  algo: z.string().trim().optional(),
  consumerEmailId: z.string().trim().optional(),
  consumerMobileNo: z.string().trim().optional(),
  paymentMode: z.string().trim().optional(),
  checkoutOrigin: z.string().trim().optional(),
});
export type CreateWorldlineSessionInput = z.infer<typeof createWorldlineSessionSchema>;

export const completeWorldlinePaymentSchema = z.object({
  orderId: z.string().trim().optional(),
  txnId: z.string().trim().optional(),
  response: z.record(z.unknown(), { required_error: 'response object is required' }),
  debug: z.unknown().optional(),
});
export type CompleteWorldlinePaymentInput = z.infer<typeof completeWorldlinePaymentSchema>;

export const abortWorldlinePaymentSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId is required'),
  txnId: z.string().trim().min(1, 'txnId is required'),
  reason: z.string().trim().optional(),
});
export type AbortWorldlinePaymentInput = z.infer<typeof abortWorldlinePaymentSchema>;

export const getWorldlineStatusQuerySchema = z.object({
  orderId: z.string().trim().min(1, 'orderId query param is required'),
});
export type GetWorldlineStatusQuery = z.infer<typeof getWorldlineStatusQuerySchema>;
