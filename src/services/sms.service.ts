import http from 'http';
import https from 'https';
import { loadOtpConfig, getTwilioConfig, getMsg91Config, getFast2SmsConfig } from '../config/otp';
import { logger } from '../utils/logger';

export type OtpErrorCode =
  | 'SMS_INVALID_NUMBER'
  | 'SMS_DLT_NOT_APPROVED'
  | 'SMS_INSUFFICIENT_BALANCE'
  | 'SMS_DAILY_LIMIT'
  | 'SMS_CARRIER_BLOCK'
  | 'SMS_AUTH_FAILURE'
  | 'SMS_TIMEOUT'
  | 'SMS_GATEWAY_ERROR'
  | 'SMS_GATEWAY_CONTRACT_ERROR'
  | 'SMS_SENDER_NOT_PROVISIONED'
  | 'SMS_EMPTY_BODY';

export interface SmsResult {
  sent: boolean;
  channel?: string;
  provider?: string;
  errorCode?: OtpErrorCode;
  userMessage?: string;
  internalLog?: string;
  configured?: boolean;
  /** Raw provider error code (e.g. Twilio 21608), for operator diagnostics. */
  providerErrorCode?: string;
}

// Per-provider HTTP timeout. Kept short so a slow/unreachable gateway can't stall
// the OTP flow — delivery runs in the background anyway (see auth.service.sendOtp).
const SMS_TIMEOUT_MS = Math.max(
  3000,
  Math.min(12000, parseInt(process.env.SMS_TIMEOUT_MS || '8000', 10)),
);
const MAX_DEBUG_BODY_LENGTH = 2000;
let lastSmsResult: SmsResult | null = null;

/** Classify a gateway response/error into an error code + user-facing message. */
function classifySmsError(provider: string, statusCode: number | null, body: string, errMessage?: string | null): SmsResult {
  const raw = (body || '').trim();
  const lower = raw.toLowerCase();
  const code = statusCode || 0;

  if (errMessage && /timeout/i.test(errMessage)) {
    return {
      sent: false,
      errorCode: 'SMS_TIMEOUT',
      userMessage: 'SMS service is taking too long. Please try again in a moment.',
      internalLog: `[SMS] ${provider} timeout: ${errMessage}`,
    };
  }
  if (/number\s*is\s*required|atleast\s*one\s*number|at\s+least\s+one\s+number|required\s+to\s+send\s+message/i.test(lower)) {
    return {
      sent: false,
      errorCode: 'SMS_GATEWAY_CONTRACT_ERROR',
      userMessage: 'SMS gateway expects different parameters. Check SMS_PARAM_MOBILE / SMS_PARAM_MESSAGE.',
      internalLog: `[SMS] ${provider} contract error status=${code} body=${raw.slice(0, 200)}`,
    };
  }
  if (code === 401 || /unauthorized|invalid\s*(auth)?\s*key|authentication\s*failed|auth\s*failed/i.test(lower)) {
    return {
      sent: false,
      errorCode: 'SMS_AUTH_FAILURE',
      userMessage: 'SMS service configuration error. Please contact support.',
      internalLog: `[SMS] ${provider} auth failure status=${code} body=${raw.slice(0, 200)}`,
    };
  }
  // The sender itself isn't cleared to reach this destination: Twilio trial accounts
  // reject every number that isn't on the console's verified list (21608), and accounts
  // without the destination region / A2P registration enabled reject whole countries
  // (21408, 21606, 21612, 30034). The body mentions "number", so without this branch the
  // check below misreads an account-provisioning problem as bad user input and tells the
  // customer to correct a number that was perfectly valid.
  const provisioningCode = raw.match(/\b(21608|21408|21606|21612|30034|30032)\b/)?.[1];
  if (
    provisioningCode ||
    /trial\s*account|unverified\s*number|the\s*number\s*\S+\s*is\s*unverified|permission\s*to\s*send.*not\s*enabled|not\s*enabled\s*for\s*the\s*region/i.test(
      raw,
    )
  ) {
    return {
      sent: false,
      errorCode: 'SMS_SENDER_NOT_PROVISIONED',
      providerErrorCode: provisioningCode,
      userMessage: 'OTP delivery is not enabled for this number yet. Please contact support.',
      internalLog:
        `[SMS] ${provider} sender not provisioned for destination (code=${provisioningCode || 'n/a'} status=${code}). ` +
        `The account/sender cannot deliver to this destination — upgrade the account, enable the destination region, ` +
        `or switch to a DLT-registered Indian provider. body=${raw.slice(0, 300)}`,
    };
  }

  const invalidNumberFailure =
    /invalid\s*(mobile|number|phone)/i.test(lower) ||
    /(valid\s*(mobile|number|phone)\s*(is\s*)?required|enter\s*a?\s*valid\s*(mobile|number|phone))/i.test(lower) ||
    (code >= 400 && code < 500 && /\b(mobile|number|phone)\b/i.test(lower));
  if (invalidNumberFailure) {
    return {
      sent: false,
      errorCode: 'SMS_INVALID_NUMBER',
      userMessage: 'SMS could not be sent to this number. Please check the number and try again.',
      internalLog: `[SMS] ${provider} invalid number status=${code} body=${raw.slice(0, 200)}`,
    };
  }
  if (/dlt|template\s*not\s*approved|entity\s*id|template\s*id|pe\s*id|principal\s*entity|template\s*not\s*registered/i.test(lower)) {
    return {
      sent: false,
      errorCode: 'SMS_DLT_NOT_APPROVED',
      userMessage: 'OTP service is not fully set up for this sender. Please contact support.',
      internalLog: `[SMS] ${provider} DLT/template issue status=${code} body=${raw.slice(0, 200)}`,
    };
  }
  if (/insufficient|low\s*balance|balance\s*is\s*zero|no\s*credit|out\s*of\s*balance|recharge|top\s*up/i.test(lower)) {
    return {
      sent: false,
      errorCode: 'SMS_INSUFFICIENT_BALANCE',
      userMessage: 'SMS service temporarily unavailable. Please try again later.',
      internalLog: `[SMS] ${provider} insufficient balance status=${code} body=${raw.slice(0, 200)}`,
    };
  }
  if (/daily\s*limit|limit\s*exceeded|quota\s*exceeded|max\s*sms|per\s*day\s*limit/i.test(lower)) {
    return {
      sent: false,
      errorCode: 'SMS_DAILY_LIMIT',
      userMessage: 'SMS limit reached. Please try again tomorrow.',
      internalLog: `[SMS] ${provider} daily limit status=${code} body=${raw.slice(0, 200)}`,
    };
  }
  if (/ndnc|blocked|carrier|rejected\s*by\s*operator|operator\s*reject|dnd|do\s*not\s*disturb/i.test(lower)) {
    return {
      sent: false,
      errorCode: 'SMS_CARRIER_BLOCK',
      userMessage: 'SMS could not be delivered to this number. Try another number or contact support.',
      internalLog: `[SMS] ${provider} carrier/block status=${code} body=${raw.slice(0, 200)}`,
    };
  }
  return {
    sent: false,
    errorCode: 'SMS_GATEWAY_ERROR',
    userMessage: 'Unable to send OTP. Please try again in a few minutes.',
    internalLog: `[SMS] ${provider} gateway error status=${code} err=${errMessage || ''} body=${raw.slice(0, 200)}`,
  };
}

function setLastSmsError(provider: string, statusCode: number | null, body: string, errMessage?: string | null) {
  lastSmsResult = classifySmsError(provider, statusCode, (body || '').slice(0, MAX_DEBUG_BODY_LENGTH), errMessage);
}

export function getLastSmsResult(): SmsResult | null {
  return lastSmsResult;
}

let activeOtpMessageTemplate: string | null = null;

/** When set, overrides the default OTP message template for the current send. */
export function withOtpMessageTemplate<T>(template: string | null, fn: () => Promise<T>): Promise<T> {
  const prev = activeOtpMessageTemplate;
  activeOtpMessageTemplate = template || null;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      activeOtpMessageTemplate = prev;
    });
}

function buildOtpMessage(otp: string): string {
  const cfg = loadOtpConfig();
  const template =
    activeOtpMessageTemplate ||
    (cfg.smsMessageTemplate && cfg.smsMessageTemplate.length > 0 ? cfg.smsMessageTemplate : null) ||
    'Your Selorg verification code is {otp}. Valid for 5 minutes. Do not share.';
  return String(template).replace(/\{otp\}/gi, otp).replace(/\{#var#\}/gi, otp);
}

function normalizeMobileForVendor(phone: string): string {
  // SpearUC / Indian DLT gateways expect exactly 10 digits (see OTP_PROCESS_WORKFLOW.md).
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function toE164India(phone: string): string | null {
  const digits = normalizeMobileForVendor(phone);
  if (digits.length === 10 && /^[5-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits.length === 10 ? `+91${digits}` : null;
}

const MAX_REDIRECTS = 2;
const SMS_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; SelorgService-SMS/1.0)', Accept: '*/*' };

function httpRequestWithRedirects(
  method: 'GET' | 'POST',
  url: string,
  bodyStr: string | null,
  redirectCount = 0,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (e) {
      reject(new Error(`Invalid URL: ${(e as Error).message}`));
      return;
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const headers: Record<string, string | number> = { ...SMS_HEADERS };
    if (method === 'POST' && bodyStr) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = Buffer.byteLength(bodyStr, 'utf8');
    }
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers,
        timeout: SMS_TIMEOUT_MS,
      },
      (res) => {
        const isRedirect = (res.statusCode ?? 0) >= 301 && (res.statusCode ?? 0) <= 308;
        const location = res.headers.location;
        if (isRedirect && location && redirectCount < MAX_REDIRECTS) {
          const nextUrl = location.startsWith('/')
            ? `${parsed.protocol}//${parsed.host}${location}`
            : /^https?:\/\//i.test(location)
              ? location
              : new URL(location, url).href;
          res.resume();
          httpRequestWithRedirects(method, nextUrl, bodyStr, redirectCount + 1).then(resolve).catch(reject);
          return;
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
      },
    );
    req.on('error', reject);
    req.setTimeout(SMS_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (method === 'POST' && bodyStr) req.write(bodyStr, 'utf8');
    req.end();
  });
}

function isConfigVendorSuccess(statusCode: number, body: string): boolean {
  if (statusCode < 200 || statusCode >= 300) return false;
  const raw = (body || '').trim();
  const lower = raw.toLowerCase();
  try {
    const j = JSON.parse(raw);
    const s = String(j?.status ?? j?.result ?? j?.Status ?? j?.Result ?? j?.data?.status ?? '').toLowerCase();
    const code = j?.status_code ?? j?.statusCode ?? j?.data?.status_code;
    if (s === 'fail' || s === 'error' || s === 'failure' || code === 0 || code === '0') return false;
    if (s === 'success' || s === 'sent' || s === 'ok') return true;
    if (typeof j === 'object' && (j.status !== undefined || j.result !== undefined || j.Status !== undefined)) return false;
  } catch {
    // Not JSON — fall through to text heuristics.
  }
  if (raw === '') return true;
  if (/\b(success|sent|ok|delivered|message\s+sent)\b/.test(lower)) return true;
  if (/^\s*{\s*"?(status|result)"?\s*:\s*"(fail|error)"\s*}/.test(lower)) return false;
  if (/^(error|invalid|failed|denied):\s*/im.test(raw)) return false;
  if (/\b(status|result)\s*[=:]\s*["']?(fail|error)["']?\b/.test(lower)) return false;
  if (raw.length < 80 && /\b(fail|error|invalid|denied|reject|insufficient|balance)\b/.test(lower)) return false;
  return true;
}

/** Generic HTTP SMS gateway configured via SMS_VENDOR_URL (param names via SMS_PARAM_MOBILE/MESSAGE).
 *  Matches OTP_PROCESS_WORKFLOW.md: GET {smsvendor}to_mobileno={10dig}&sms_text={msg}
 *  Success only when gateway body reports status === "success".
 */
async function sendViaConfigSms(phone: string, otp: string): Promise<SmsResult> {
  const cfg = loadOtpConfig();
  if (!cfg.smsVendorUrl) return { sent: false };

  const baseClean = cfg.smsVendorUrl.replace(/&+$/, '');
  const msg = buildOtpMessage(otp);
  const digits = normalizeMobileForVendor(phone);
  if (digits.length !== 10 || /^0+$/.test(digits)) {
    return {
      sent: false,
      errorCode: 'SMS_INVALID_NUMBER',
      userMessage: 'Invalid phone number.',
      internalLog: `[SMS] config_smsvendor rejected non-10-digit mobile (${digits})`,
    };
  }
  const mobile = (cfg.smsPrependCountryCode && cfg.smsCountryCode ? cfg.smsCountryCode : '') + digits;
  const sep = baseClean.includes('?') ? '&' : '?';
  const usePost = cfg.smsMethod === 'POST';

  const buildUrl = (mobileVal: string) =>
    `${baseClean}${sep}${cfg.smsParamMobile}=${encodeURIComponent(mobileVal)}&${cfg.smsParamMessage}=${encodeURIComponent(msg)}`;
  const buildBody = (mobileVal: string) => {
    const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, '+');
    return `${cfg.smsParamMobile}=${enc(mobileVal)}&${cfg.smsParamMessage}=${enc(msg)}`;
  };

  try {
    const r = usePost
      ? await httpRequestWithRedirects('POST', buildUrl(mobile), buildBody(mobile))
      : await httpRequestWithRedirects('GET', buildUrl(mobile), null);

    if (isConfigVendorSuccess(r.statusCode, r.body)) {
      lastSmsResult = { sent: true, provider: 'config_smsvendor', channel: 'sms' };
      return { sent: true, provider: 'config_smsvendor', channel: 'sms' };
    }
    setLastSmsError('config_smsvendor', r.statusCode, r.body);
    return { ...(lastSmsResult as SmsResult) };
  } catch (err) {
    setLastSmsError('config_smsvendor', null, '', (err as Error)?.message);
    return { ...(lastSmsResult as SmsResult) };
  }
}

/** MSG91 SendOTP (India, DLT template-based). */
async function sendViaMsg91(phone: string, otp: string, otpExpiryMinutes = 5): Promise<SmsResult> {
  const { authKey, sender, templateId } = getMsg91Config();
  if (!authKey) return { sent: false };
  const digits = normalizeMobileForVendor(phone);
  if (digits.length !== 10 || !/^[5-9]/.test(digits)) return { sent: false };
  const mobile = `91${digits}`;
  const message = `Your verification code is ${otp}. Valid for ${otpExpiryMinutes} min.`;
  const params = new URLSearchParams({
    authkey: authKey,
    mobile,
    otp: String(otp),
    sender: sender || 'SMSIND',
    message,
    otp_expiry: String(otpExpiryMinutes),
    otp_length: '4',
  });
  if (templateId) params.set('otp_template_id', templateId);

  try {
    const r = await httpRequestWithRedirects('GET', `https://api.msg91.com/api/sendotp.php?${params.toString()}`, null);
    const j = JSON.parse(r.body);
    const ok = String(j?.type || j?.Type || '').toLowerCase() === 'success';
    if (ok) {
      lastSmsResult = { sent: true, provider: 'msg91' };
      return { sent: true, provider: 'msg91' };
    }
    setLastSmsError('MSG91', r.statusCode, r.body, j?.message || j?.Message || null);
    return { ...(lastSmsResult as SmsResult) };
  } catch (err) {
    setLastSmsError('MSG91', null, '', (err as Error)?.message);
    return { ...(lastSmsResult as SmsResult) };
  }
}

/** Fast2SMS – India. route=otp (DLT) or q (Quick SMS). */
async function sendViaFast2SMS(phone: string, otp: string): Promise<SmsResult> {
  const { apiKey, route } = getFast2SmsConfig();
  if (!apiKey) return { sent: false };
  const numbers = phone.length === 10 ? phone : phone.replace(/\D/g, '').replace(/^0/, '91');
  const quickMsg = buildOtpMessage(otp);
  const body =
    route === 'otp'
      ? JSON.stringify({ route: 'otp', numbers, variables_values: otp, flash: 0 })
      : JSON.stringify({ route: 'q', message: quickMsg, numbers, flash: 0 });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'www.fast2sms.com',
        path: '/dev/bulkV2',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: apiKey, 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (j?.return === true) {
              lastSmsResult = { sent: true, provider: 'fast2sms' };
              resolve({ sent: true, provider: 'fast2sms' });
            } else {
              setLastSmsError('Fast2SMS', res.statusCode ?? null, data, j?.message || null);
              resolve({ ...(lastSmsResult as SmsResult) });
            }
          } catch {
            setLastSmsError('Fast2SMS', res.statusCode ?? null, data, 'Parse error');
            resolve({ ...(lastSmsResult as SmsResult) });
          }
        });
      },
    );
    req.on('error', (err) => {
      setLastSmsError('Fast2SMS', null, '', err?.message);
      resolve({ ...(lastSmsResult as SmsResult) });
    });
    req.setTimeout(SMS_TIMEOUT_MS, () => {
      req.destroy();
      setLastSmsError('Fast2SMS', null, '', 'Request timeout');
      resolve({ ...(lastSmsResult as SmsResult) });
    });
    req.write(body);
    req.end();
  });
}

async function twilioSend(to: string, from: string, body: string, provider: string): Promise<SmsResult> {
  const { accountSid: sid, authToken: token } = getTwilioConfig();
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const payload = new URLSearchParams({ To: to, From: from, Body: body }).toString();

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.twilio.com',
        path: `/2010-04-01/Accounts/${sid}/Messages.json`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          const ok = (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300;
          let parsed: Record<string, unknown> | null = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            // ignore parse error
          }
          const msgStatus = String(parsed?.status ?? '').toLowerCase();
          const msgErrorCode = parsed?.error_code ?? null;

          // A 2xx only means Twilio accepted the message for queueing. It still stamps a
          // terminal `status` of failed/undelivered (plus an error_code) on requests it
          // rejects outright, so trusting the HTTP code alone reports undelivered OTPs as sent.
          if (ok && msgStatus !== 'failed' && msgStatus !== 'undelivered' && !msgErrorCode) {
            lastSmsResult = { sent: true, provider };
            resolve({ sent: true, provider });
            return;
          }

          const errMessage =
            (parsed?.message as string) ?? (parsed?.error_message as string) ?? (parsed?.more_info as string) ?? undefined;
          setLastSmsError(
            provider,
            res.statusCode ?? null,
            // Fold the terminal status/error_code into the body so classifySmsError sees them
            // even when the HTTP layer reported success.
            ok ? `${data} status=${msgStatus} error_code=${msgErrorCode ?? ''}` : data,
            errMessage,
          );
          resolve({ ...(lastSmsResult as SmsResult) });
        });
      },
    );
    req.on('error', (err) => {
      setLastSmsError(provider, null, '', err?.message);
      resolve({ ...(lastSmsResult as SmsResult) });
    });
    req.setTimeout(SMS_TIMEOUT_MS, () => {
      req.destroy();
      setLastSmsError(provider, null, '', 'Request timeout');
      resolve({ ...(lastSmsResult as SmsResult) });
    });
    req.write(payload);
    req.end();
  });
}

async function sendViaTwilio(phone: string, otp: string): Promise<SmsResult> {
  const { accountSid: sid, authToken: token, phoneNumber: from } = getTwilioConfig();
  if (!sid || !token || !from) return { sent: false };
  const to = toE164India(phone);
  if (!to) {
    setLastSmsError('Twilio', null, '', 'Invalid phone format');
    return { ...(lastSmsResult as SmsResult) };
  }
  return twilioSend(to, from, buildOtpMessage(otp), 'twilio');
}

async function sendViaTwilioWhatsApp(phone: string, otp: string): Promise<SmsResult> {
  const { accountSid: sid, authToken: token, whatsappFrom } = getTwilioConfig();
  if (!sid || !token || !whatsappFrom) {
    return {
      sent: false,
      userMessage: 'WhatsApp OTP is not configured on the server.',
      internalLog: '[WhatsApp] TWILIO_WHATSAPP_FROM missing',
    };
  }
  const e164 = toE164India(phone);
  if (!e164) {
    setLastSmsError('Twilio WhatsApp', null, '', 'Invalid phone format');
    return { ...(lastSmsResult as SmsResult) };
  }
  const to = `whatsapp:${e164}`;
  const from = whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom.replace(/^whatsapp:/i, '')}`;
  const result = await twilioSend(to, from, buildOtpMessage(otp), 'twilio_whatsapp');
  return result.sent ? { ...result, channel: 'whatsapp' } : result;
}

/**
 * Send OTP via SMS. Provider order: generic HTTP vendor (SMS_VENDOR_URL) -> MSG91 -> Fast2SMS -> Twilio.
 * Returns `{ sent, errorCode?, userMessage?, internalLog? }` for failure diagnostics.
 */
export async function sendOtpSms(phone: string, otp: string, otpExpiryMinutes = 5): Promise<SmsResult> {
  const trimmed = normalizeMobileForVendor(phone);
  if (!trimmed) {
    return { sent: false, errorCode: 'SMS_INVALID_NUMBER', userMessage: 'Invalid phone number.', internalLog: '[SMS] Invalid phone for send' };
  }
  lastSmsResult = null;

  try {
    let attempted: SmsResult | null = null;

    const cfg = loadOtpConfig();
    if (cfg.smsVendorUrl) {
      const r = await sendViaConfigSms(trimmed, otp);
      if (r.sent) return r;
      attempted = r;
    }
    if (getMsg91Config().authKey) {
      const r = await sendViaMsg91(trimmed, otp, otpExpiryMinutes);
      if (r.sent) return r;
      attempted = r;
    }
    if (getFast2SmsConfig().apiKey) {
      const r = await sendViaFast2SMS(trimmed, otp);
      if (r.sent) return r;
      attempted = r;
    }
    const twilioCfg = getTwilioConfig();
    if (twilioCfg.accountSid && twilioCfg.authToken && twilioCfg.phoneNumber) {
      const r = await sendViaTwilio(trimmed, otp);
      if (r.sent) return r;
      attempted = r;
    }
    // A provider was configured and actually tried — surface its real failure reason
    // instead of the misleading "not configured" message below.
    if (attempted) return attempted;

    logger.info(`[SMS] No provider configured — OTP for ${trimmed}: ${otp}`);
    return {
      sent: false,
      userMessage: 'SMS provider not configured. Contact support.',
      internalLog: '[SMS] No provider configured — OTP logged to server console',
    };
  } catch (err) {
    setLastSmsError('sendOtpSms', null, '', (err as Error)?.message);
    return getLastSmsResult() ?? { sent: false, userMessage: 'Unable to send OTP. Please try again.' };
  }
}

/** Send OTP via WhatsApp (Twilio). Falls back to SMS if WhatsApp is not configured. */
export async function sendOtpWhatsApp(phone: string, otp: string): Promise<SmsResult> {
  const trimmed = normalizeMobileForVendor(phone);
  if (!trimmed) {
    return { sent: false, errorCode: 'SMS_INVALID_NUMBER', userMessage: 'Invalid phone number.' };
  }
  lastSmsResult = null;
  const twilioCfg = getTwilioConfig();
  if (twilioCfg.accountSid && twilioCfg.authToken && twilioCfg.whatsappFrom) {
    return sendViaTwilioWhatsApp(trimmed, otp);
  }
  logger.warn(`[WhatsApp] Not configured — falling back to SMS for ${trimmed}`);
  const sms = await sendOtpSms(trimmed, otp);
  return { ...sms, channel: 'sms' };
}
