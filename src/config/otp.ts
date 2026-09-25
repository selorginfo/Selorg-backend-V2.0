/**
 * SMS/OTP provider configuration — env-driven (the old backend's file-based
 * `src/config.json` vendor config was dropped; everything here comes from env vars).
 * Provider order: generic HTTP `smsvendor` URL -> MSG91 -> Fast2SMS -> Twilio.
 */
export interface OtpConfig {
  smsVendorUrl: string;
  smsParamMobile: string;
  smsParamMessage: string;
  smsCountryCode: string;
  smsPrependCountryCode: boolean;
  smsMethod: 'GET' | 'POST';
  smsMessageTemplate: string;
  otpBypassNumbers: string[];
  otpDevMode: boolean;
}

export function loadOtpConfig(): OtpConfig {
  // Accept True/False/TRUE etc. — Windows .env often uses capitalised booleans.
  const rawDev = String(process.env.OTP_DEV_MODE || '')
    .trim()
    .toLowerCase();
  const envDevTrue = rawDev === '1' || rawDev === 'true';
  const envDevFalse = rawDev === '0' || rawDev === 'false';
  // Explicit False must win. Only fall back to NODE_ENV when the var is unset.
  const otpDevMode = envDevTrue ? true : envDevFalse ? false : process.env.NODE_ENV === 'development';

  let paramMobile = (process.env.SMS_PARAM_MOBILE || 'to_mobileno').trim();
  let paramMessage = (process.env.SMS_PARAM_MESSAGE || 'sms_text').trim();
  if (paramMobile.toLowerCase() === 'mobile') paramMobile = 'to_mobileno';
  if (paramMessage.toLowerCase() === 'message') paramMessage = 'sms_text';

  return {
    smsVendorUrl: (process.env.SMS_VENDOR_URL || '').trim(),
    smsParamMobile: paramMobile,
    smsParamMessage: paramMessage,
    smsCountryCode: (process.env.SMS_COUNTRY_CODE || '91').trim(),
    smsPrependCountryCode: process.env.SMS_PREPEND_COUNTRY_CODE === 'true',
    smsMethod: (process.env.SMS_METHOD || '').toUpperCase() === 'POST' ? 'POST' : 'GET',
    smsMessageTemplate: (process.env.SMS_MESSAGE_TEMPLATE || '').trim(),
    otpBypassNumbers: (process.env.OTP_BYPASS_NUMBERS || '')
      .split(',')
      .map((n) => n.replace(/\D/g, '').slice(-10))
      .filter(Boolean),
    otpDevMode,
  };
}

export function getTwilioConfig() {
  return {
    accountSid: (process.env.TWILIO_ACCOUNT_SID || '').trim(),
    authToken: (process.env.TWILIO_AUTH_TOKEN || '').trim(),
    phoneNumber: (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_SMS_FROM || process.env.TWILIO_FROM || '').trim(),
    whatsappFrom: (process.env.TWILIO_WHATSAPP_FROM || '').trim(),
  };
}

export function getMsg91Config() {
  return {
    authKey: (process.env.MSG91_AUTH_KEY || '').trim(),
    sender: (process.env.MSG91_SENDER || '').trim(),
    templateId: (process.env.MSG91_TEMPLATE_ID || '').trim(),
  };
}

export function getFast2SmsConfig() {
  return {
    apiKey: (process.env.FAST2SMS_API_KEY || '').trim(),
    route: (process.env.FAST2SMS_ROUTE || 'q').trim(),
  };
}
