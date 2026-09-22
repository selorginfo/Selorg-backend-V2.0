/**
 * Shared OTP delivery — same providers Customer auth uses.
 * SMS: sms.service (MSG91 → Fast2SMS → Twilio)
 * Email: email.service (Resend → Brevo → SendGrid → SMTP)
 *
 * Callers pass 10-digit Indian mobiles (sms.service converts to +91 E.164).
 * Do not pre-wrap as +91 — that mismatches MSG91/vendor formatting.
 */
import { sendOtpSms, sendOtpWhatsApp } from './sms.service';
import { sendOtpEmail, isEmailConfigured } from './email.service';
import { logger } from '../utils/logger';

export interface OtpDeliveryResult {
  sent: boolean;
  channel?: string;
  provider?: string;
  message?: string;
  errorCode?: string;
}

export async function deliverOtpToPhone(
  digits: string,
  otp: string,
  channel: string,
  otpExpiryMinutes = 5,
): Promise<OtpDeliveryResult> {
  const result =
    String(channel || 'sms').toLowerCase() === 'whatsapp'
      ? await sendOtpWhatsApp(digits, otp)
      : await sendOtpSms(digits, otp, otpExpiryMinutes);
  return {
    sent: result.sent,
    channel: result.channel,
    provider: result.provider,
    message: result.userMessage || result.internalLog,
    errorCode: result.errorCode,
  };
}

export async function deliverOtpToEmail(params: {
  email: string;
  otp: string;
  expiresInMinutes: number;
  appName: string;
  from?: string;
}): Promise<OtpDeliveryResult> {
  if (!isEmailConfigured()) {
    return {
      sent: false,
      channel: 'email',
      message: 'Email OTP is not configured on the server.',
      errorCode: 'EMAIL_NOT_CONFIGURED',
    };
  }
  const result = await sendOtpEmail({
    to: params.email,
    otp: params.otp,
    expiresInMinutes: params.expiresInMinutes,
    appName: params.appName,
    from: params.from,
  });
  return {
    sent: result.sent,
    channel: result.channel || 'email',
    provider: result.provider,
    message: result.userMessage || result.internalError,
    errorCode: result.sent ? undefined : 'EMAIL_GATEWAY_ERROR',
  };
}

/**
 * Await provider acceptance. Logs outcome. Does not invent success.
 */
export async function awaitOtpDelivery(
  label: string,
  target: string,
  start: () => Promise<OtpDeliveryResult>,
): Promise<OtpDeliveryResult> {
  try {
    const result = await start();
    if (result.sent) {
      logger.info(`[OTP] ${label} delivered to ${target} via ${result.provider || result.channel || 'provider'}`);
    } else {
      logger.warn(`[OTP] ${label} delivery to ${target} failed: ${result.message || 'unknown error'}`);
    }
    return result;
  } catch (e) {
    const message = (e as Error)?.message || 'Unable to send OTP';
    logger.error(`[OTP] ${label} delivery to ${target} threw: ${message}`);
    return { sent: false, message };
  }
}
