import { z } from 'zod';

export const debitForCheckoutSchema = z.object({
  amount: z.union([z.number(), z.string()]).optional(),
  orderId: z.string().trim().min(1, 'orderId is required'),
});
export type DebitForCheckoutInput = z.infer<typeof debitForCheckoutSchema>;

export const initiateTopUpSchema = z.object({
  amount: z.union([z.number(), z.string()]),
  platform: z.enum(['android', 'ios', 'web']).optional(),
  algo: z.string().trim().optional(),
  consumerEmailId: z.string().trim().optional(),
  consumerMobileNo: z.string().trim().optional(),
  paymentMode: z.string().trim().optional(),
  checkoutOrigin: z.string().trim().optional(),
});
export type InitiateTopUpInput = z.infer<typeof initiateTopUpSchema>;

export const getTransactionsQuerySchema = z.object({
  page: z.string().trim().optional(),
  limit: z.string().trim().optional(),
});
export type GetTransactionsQuery = z.infer<typeof getTransactionsQuerySchema>;
