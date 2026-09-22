import { z } from 'zod';

export const updateIntegrationSchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  config: z.object({ environment: z.string().optional() }).optional(),
});
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;

export const toggleIntegrationSchema = z.object({
  status: z.enum(['active', 'inactive']),
});
export type ToggleIntegrationInput = z.infer<typeof toggleIntegrationSchema>;

export const createWebhookSchema = z.object({
  integrationId: z.string().trim().min(1, 'integrationId is required'),
  integrationName: z.string().trim().optional(),
  event: z.string().trim().min(1, 'event is required'),
  url: z.string().trim().min(1, 'url is required'),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const createApiKeySchema = z.object({
  integrationId: z.string().trim().min(1, 'integrationId is required'),
  integrationName: z.string().trim().optional(),
  name: z.string().trim().min(1, 'name is required'),
  environment: z.enum(['production', 'sandbox']).optional(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
