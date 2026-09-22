import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  scopes: z.array(z.string()).min(1, 'scopes (non-empty array) is required'),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const toggleMaintenanceModeSchema = z.object({
  enabled: z.boolean(),
});
export type ToggleMaintenanceModeInput = z.infer<typeof toggleMaintenanceModeSchema>;
