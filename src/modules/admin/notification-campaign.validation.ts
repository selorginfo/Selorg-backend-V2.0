import { z } from 'zod';

export const createTemplateSchema = z.object({
  name: z.string().trim().optional(),
  title: z.string().trim().optional(),
  body: z.string().optional(),
  category: z.string().trim().optional(),
  channels: z.array(z.string()).optional(),
  variables: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  deepLink: z.string().optional(),
  priority: z.string().trim().optional(),
  status: z.string().trim().optional(),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema.partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, 'Campaign name is required'),
  templateId: z.string().trim().min(1, 'templateId is required'),
  templateName: z.string().optional(),
  segment: z.string().optional(),
  channels: z.array(z.string()).optional(),
  scheduleType: z.string().optional(),
  scheduledAt: z.string().optional(),
});
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignStatusSchema = z.object({
  status: z.enum(['draft', 'scheduled', 'active', 'paused', 'completed']),
});
export type UpdateCampaignStatusInput = z.infer<typeof updateCampaignStatusSchema>;

export const createAutomationSchema = z.object({
  name: z.string().trim().min(1, 'Rule name is required'),
  trigger: z.string().optional(),
  templateId: z.string().trim().min(1, 'templateId is required'),
  delay: z.union([z.number(), z.string()]).optional(),
  channels: z.array(z.string()).min(1, 'At least one channel is required'),
  conditions: z.string().optional(),
  status: z.string().optional(),
});
export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;

export const updateAutomationSchema = z.object({
  status: z.string().optional(),
  name: z.string().optional(),
  trigger: z.string().optional(),
  templateId: z.string().optional(),
  delay: z.union([z.number(), z.string()]).optional(),
  channels: z.array(z.string()).optional(),
  conditions: z.string().optional(),
});
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;

export const retryFailedBatchSchema = z.object({
  campaignId: z.string().optional(),
  limit: z.union([z.number(), z.string()]).optional(),
});
export type RetryFailedBatchInput = z.infer<typeof retryFailedBatchSchema>;
