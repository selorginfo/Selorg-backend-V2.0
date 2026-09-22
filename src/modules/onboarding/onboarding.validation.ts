import { z } from 'zod';

export const completeOnboardingSchema = z.object({});

export const createOnboardingPageSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  description: z.string().trim().min(1, 'description is required'),
  imageUrl: z.string().trim().optional(),
  ctaText: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});
export type CreateOnboardingPageInput = z.infer<typeof createOnboardingPageSchema>;

export const updateOnboardingPageSchema = z.object({
  title: z.string().trim().optional(),
  description: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  ctaText: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  order: z.number().optional(),
  pageNumber: z.number().optional(),
});
export type UpdateOnboardingPageInput = z.infer<typeof updateOnboardingPageSchema>;

export const reorderOnboardingPagesSchema = z.object({
  order: z.array(z.string().trim().min(1)).min(1, 'order must be a non-empty array of page IDs'),
});
export type ReorderOnboardingPagesInput = z.infer<typeof reorderOnboardingPagesSchema>;

export const uploadOnboardingImageSchema = z.object({
  image: z.string().trim().min(1, 'image (base64) is required'),
});
export type UploadOnboardingImageInput = z.infer<typeof uploadOnboardingImageSchema>;
