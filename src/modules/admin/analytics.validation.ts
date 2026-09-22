import { z } from 'zod';

export const rangeQuerySchema = z.object({
  range: z.enum(['24h', '7d', '30d', '90d']).optional(),
});
export type RangeQuery = z.infer<typeof rangeQuerySchema>;

export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'json']).optional(),
  range: z.enum(['24h', '7d', '30d', '90d']).optional(),
  report: z.enum(['orders-by-hour', 'financial-summary', 'overview']).optional(),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;

export const customReportSchema = z.object({
  dimensions: z.array(z.enum(['hour', 'day', 'month', 'year', 'city'])).optional(),
  metrics: z.array(z.enum(['revenue', 'orders'])).optional(),
  filters: z.record(z.unknown()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
export type CustomReportInput = z.infer<typeof customReportSchema>;

export const pickerDrilldownQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type PickerDrilldownQuery = z.infer<typeof pickerDrilldownQuerySchema>;
