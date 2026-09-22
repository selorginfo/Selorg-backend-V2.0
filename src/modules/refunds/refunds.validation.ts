import { z } from 'zod';

const VALID_REASON_CODES = [
  'item_damaged',
  'expired',
  'late_delivery',
  'wrong_item',
  'customer_cancelled',
  'other',
] as const;

export const createRefundRequestSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  reasonCode: z.enum(VALID_REASON_CODES),
  reasonText: z.string().trim().min(1, 'reasonText is required'),
  amount: z.number().positive().optional(),
  currency: z.string().trim().min(1).optional(),
});
export type CreateRefundRequestInput = z.infer<typeof createRefundRequestSchema>;
