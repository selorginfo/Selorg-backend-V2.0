import { z } from 'zod';

export const createAuditSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  type: z.enum(['internal', 'external', 'regulatory', 'third-party']).optional(),
  auditor: z.string().trim().min(1, 'auditor is required'),
  auditorOrg: z.string().trim().optional(),
  scheduledDate: z.string().optional(),
  scope: z.array(z.string()).optional(),
});
export type CreateAuditInput = z.infer<typeof createAuditSchema>;

export const updateFindingStatusSchema = z.object({
  status: z.enum(['open', 'in-progress', 'resolved', 'accepted-risk']),
});
export type UpdateFindingStatusInput = z.infer<typeof updateFindingStatusSchema>;

export const uploadDocumentBodySchema = z.object({
  name: z.string().trim().optional(),
  type: z.string().trim().optional(),
  category: z.string().trim().optional(),
  description: z.string().trim().optional(),
});
export type UploadDocumentBodyInput = z.infer<typeof uploadDocumentBodySchema>;
