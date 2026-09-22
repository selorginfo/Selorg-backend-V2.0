import { z } from 'zod';

export const sendOtpSchema = z
  .object({
    phoneNumber: z.string().trim().optional(),
    email: z.string().trim().email('Valid email address required').optional(),
    channel: z.enum(['sms', 'whatsapp', 'email']).optional(),
    preferredChannel: z.enum(['sms', 'whatsapp', 'email']).optional(),
    // 'login' requires an existing customer; 'signup' creates one on verify.
    // Omitted -> behaves like the previous auto-upsert (backward compatible).
    intent: z.enum(['login', 'signup']).optional(),
  })
  .refine((data) => Boolean(data.phoneNumber || data.email), {
    message: 'phoneNumber or email required',
    path: ['phoneNumber'],
  });
export type SendOtpInput = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId required'),
  otp: z.string().trim().min(1, 'otp required'),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const resendOtpSchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId required'),
});
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().trim().optional(),
});
export type LogoutInput = z.infer<typeof logoutSchema>;

export const sendLinkPhoneOtpSchema = z.object({
  phoneNumber: z.string().trim().min(1, 'phoneNumber required'),
  channel: z.enum(['sms', 'whatsapp']).optional(),
  preferredChannel: z.enum(['sms', 'whatsapp']).optional(),
});
export type SendLinkPhoneOtpInput = z.infer<typeof sendLinkPhoneOtpSchema>;

export const verifyLinkPhoneOtpSchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId required'),
  otp: z.string().trim().min(1, 'otp required'),
});
export type VerifyLinkPhoneOtpInput = z.infer<typeof verifyLinkPhoneOtpSchema>;
