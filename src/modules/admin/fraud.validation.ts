import { z } from 'zod';

export const listAlertsQuerySchema = z.object({
  status: z.string().trim().optional(),
  severity: z.string().trim().optional(),
  type: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});
export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;

export const createBlockedEntitySchema = z.object({
  type: z.enum(['email', 'phone', 'ip', 'device', 'user']),
  value: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  isPermanent: z.boolean().optional(),
  expiresAt: z.string().optional(),
  relatedAlerts: z.array(z.string()).optional(),
  notes: z.string().optional(),
});
export type CreateBlockedEntityInput = z.infer<typeof createBlockedEntitySchema>;

export const updateChargebackSchema = z.object({
  status: z.enum(['received', 'under_review', 'accepted', 'disputed', 'won', 'lost']).optional(),
  merchantNotes: z.string().optional(),
  evidence: z.array(z.string()).optional(),
});
export type UpdateChargebackInput = z.infer<typeof updateChargebackSchema>;
