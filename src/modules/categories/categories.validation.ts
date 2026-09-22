import { z } from 'zod';

export const categoryDetailQuerySchema = z.object({
  subCategoryId: z.string().trim().optional(),
});
export type CategoryDetailQuery = z.infer<typeof categoryDetailQuerySchema>;

export const categoryProductsQuerySchema = z.object({
  sort: z.enum(['sortOrder', 'price_asc', 'price_desc', 'name_asc', 'newest']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  inStock: z.string().optional(),
  subcategory: z.string().trim().optional(),
  storeId: z.string().trim().optional(),
});
export type CategoryProductsQuery = z.infer<typeof categoryProductsQuerySchema>;
