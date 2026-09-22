import { z } from 'zod';

export const productDetailQuerySchema = z.object({
  storeId: z.string().trim().optional(),
});
export type ProductDetailQuery = z.infer<typeof productDetailQuerySchema>;

export const productSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'q must be at least 2 characters'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().trim().optional(),
  storeId: z.string().trim().optional(),
});
export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;

export const searchSuggestionsQuerySchema = z.object({
  q: z.string().trim().default(''),
});
export type SearchSuggestionsQuery = z.infer<typeof searchSuggestionsQuerySchema>;
