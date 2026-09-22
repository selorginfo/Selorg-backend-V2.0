import { z } from 'zod';

export const acceptLegalSchema = z
  .object({
    termsVersion: z.string().trim().min(1).optional(),
    privacyVersion: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.termsVersion != null || data.privacyVersion != null, {
    message: 'termsVersion or privacyVersion required',
    path: ['termsVersion'],
  });
export type AcceptLegalInput = z.infer<typeof acceptLegalSchema>;

export const legalDocQuerySchema = z.object({
  version: z.string().trim().optional(),
  v: z.string().trim().optional(),
});

export const listLegalDocsQuerySchema = z.object({
  type: z.enum(['terms', 'privacy', 'license']).optional(),
});

export const createLegalDocSchema = z.object({
  type: z.enum(['terms', 'privacy', 'license']),
  version: z.string().trim().min(1),
  title: z.string().trim().min(1),
  effectiveDate: z.string().trim().optional(),
  lastUpdated: z.string().trim().optional(),
  contentFormat: z.enum(['plain', 'html', 'markdown']).optional(),
  content: z.string().min(1),
  isCurrent: z.boolean().optional(),
});
export type CreateLegalDocInput = z.infer<typeof createLegalDocSchema>;

export const updateLegalDocSchema = createLegalDocSchema.partial();
export type UpdateLegalDocInput = z.infer<typeof updateLegalDocSchema>;

export const updateLegalConfigSchema = z
  .object({
    loginLegal: z
      .object({
        preamble: z.string().optional(),
        terms: z
          .object({
            label: z.string().optional(),
            type: z.enum(['in_app', 'url']).optional(),
            url: z.string().nullable().optional(),
          })
          .optional(),
        privacy: z
          .object({
            label: z.string().optional(),
            type: z.enum(['in_app', 'url']).optional(),
            url: z.string().nullable().optional(),
          })
          .optional(),
        connector: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();
export type UpdateLegalConfigInput = z.infer<typeof updateLegalConfigSchema>;
