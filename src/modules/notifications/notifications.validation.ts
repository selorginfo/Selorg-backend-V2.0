import { z } from 'zod';
import { CATEGORY_LIST } from './notifications.constants';

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  category: z.enum(CATEGORY_LIST as [string, ...string[]]).optional(),
  unread: z.enum(['1', 'true', '0', 'false']).optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

const categoryChannelsSchema = z.object({
  push: z.boolean().optional(),
  inApp: z.boolean().optional(),
  sms: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
  email: z.boolean().optional(),
});

export const updatePreferencesSchema = z.object({
  push: z.boolean().optional(),
  inApp: z.boolean().optional(),
  sms: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
  email: z.boolean().optional(),
  dnd: z.boolean().optional(),
  dndStartHour: z.number().optional(),
  dndEndHour: z.number().optional(),
  categories: z.record(z.string(), categoryChannelsSchema).optional(),
});
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export const registerPushTokenSchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  tokenType: z.enum(['expo', 'fcm']).optional(),
  provider: z.string().optional(),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

export const registerWebPushSchema = z
  .object({
    subscription: z
      .object({
        endpoint: z.string().trim().min(1),
        expirationTime: z.number().nullable().optional(),
        keys: z.object({ p256dh: z.string().trim().min(1), auth: z.string().trim().min(1) }),
      })
      .optional(),
    endpoint: z.string().trim().optional(),
    keys: z.object({ p256dh: z.string().trim().min(1), auth: z.string().trim().min(1) }).optional(),
    expirationTime: z.number().nullable().optional(),
    userAgent: z.string().optional(),
  })
  .passthrough();
export type RegisterWebPushInput = z.infer<typeof registerWebPushSchema>;

export const removeTokenSchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
});
export type RemoveTokenInput = z.infer<typeof removeTokenSchema>;
