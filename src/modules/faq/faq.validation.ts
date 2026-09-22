import { z } from 'zod';

export const listFaqQuerySchema = z.object({
  category: z.string().trim().optional(),
});

export const adminListFaqQuerySchema = z.object({
  category: z.string().trim().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export const submitFaqFeedbackSchema = z.object({
  helpful: z.union([z.boolean(), z.enum(['true', 'false', '1', '0', 'yes', 'no'])]),
});
export type SubmitFaqFeedbackInput = z.infer<typeof submitFaqFeedbackSchema>;

export const createFaqSchema = z.object({
  question: z.string().trim().min(1, 'question is required'),
  answer: z.string().trim().min(1, 'answer is required'),
  order: z.number().optional(),
  category: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});
export type CreateFaqInput = z.infer<typeof createFaqSchema>;

export const updateFaqSchema = createFaqSchema.partial();
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;
