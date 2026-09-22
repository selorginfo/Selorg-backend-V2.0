import nodemailer, { Transporter } from 'nodemailer';
import fetch from 'node-fetch';
import { logger } from '../utils/logger';

const APP_NAME = 'Selorg';
const DEFAULT_FROM = `"${APP_NAME}" <admin@selorg.com>`;
const FAST_TIMEOUT_MS = Math.max(2000, Math.min(8000, parseInt(process.env.EMAIL_FAST_TIMEOUT_MS || '6000', 10)));
const SMTP_TIMEOUT_MS = Math.max(3000, Math.min(15000, parseInt(process.env.EMAIL_SEND_TIMEOUT_MS || '9000', 10)));

export interface EmailResult {
  sent: boolean;
  channel?: string;
  configured?: boolean;
  provider?: string;
  messageId?: string;
  userMessage?: string;
  internalError?: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  from: string;
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM || process.env.ADMIN_EMAIL_FROM || DEFAULT_FROM;
}

function parseFromAddress(raw?: string): { name: string; email: string } {
  const from = String(raw || getFromAddress()).trim();
  const named = from.match(/^"([^"]+)"\s*<([^>]+)>$/);
  if (named) return { name: named[1].trim(), email: named[2].trim() };
  const bracketed = from.match(/^([^<]+)<([^>]+)>$/);
  if (bracketed) return { name: bracketed[1].trim(), email: bracketed[2].trim() };
  return { name: APP_NAME, email: from.replace(/[<>"]/g, '') };
}

function isSmtpConfigured(): boolean {
  return !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}
function isResendConfigured(): boolean {
  return !!String(process.env.RESEND_API_KEY || '').trim();
}
function isBrevoConfigured(): boolean {
  return !!String(process.env.BREVO_API_KEY || '').trim();
}
function isSendGridConfigured(): boolean {
  return !!String(process.env.SENDGRID_API_KEY || '').trim();
}
function hasFastProvider(): boolean {
  return isResendConfigured() || isBrevoConfigured() || isSendGridConfigured();
}
export function isEmailConfigured(): boolean {
  return hasFastProvider() || isSmtpConfigured();
}

let cachedTransporter: Transporter | null = null;
let cachedTransporterKey = '';

function buildTransporterKey(): string {
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const tlsStrict = String(process.env.EMAIL_TLS_STRICT || '').toLowerCase() === 'true';
  return `${process.env.EMAIL_HOST}|${port}|${process.env.EMAIL_USER}|${tlsStrict}`;
}

function getTransporter(): Transporter | null {
  if (!isSmtpConfigured()) return null;
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const tlsStrict = String(process.env.EMAIL_TLS_STRICT || '').toLowerCase() === 'true';
  const key = buildTransporterKey();
  if (!cachedTransporter || cachedTransporterKey !== key) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port,
      secure: port === 465,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 5000,
      greetingTimeout: 4000,
      socketTimeout: SMTP_TIMEOUT_MS,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      tls: { rejectUnauthorized: tlsStrict, minVersion: 'TLSv1.2', servername: process.env.EMAIL_HOST },
    });
    cachedTransporterKey = key;
  }
  return cachedTransporter;
}

export async function warmSmtpConnection(): Promise<boolean> {
  if (!isSmtpConfigured()) return false;
  try {
    const transporter = getTransporter();
    if (!transporter) return false;
    await transporter.verify();
    logger.info('[Email] SMTP pool warmed');
    return true;
  } catch (err) {
    logger.warn(`[Email] SMTP warm-up skipped: ${(err as Error)?.message}`);
    return false;
  }
}

export function logEmailProviderStatus(): void {
  const fast = [isResendConfigured() && 'Resend', isBrevoConfigured() && 'Brevo', isSendGridConfigured() && 'SendGrid'].filter(Boolean);
  if (fast.length > 0) {
    logger.info(`[Email] Fast providers: ${fast.join(', ')}`);
  } else if (isSmtpConfigured()) {
    logger.warn('[Email] Only SMTP configured — add BREVO_API_KEY or RESEND_API_KEY for faster delivery.');
  } else {
    logger.warn('[Email] No email provider configured (SMTP/Resend/Brevo/SendGrid).');
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/**
 * Resend only accepts a `from` on a domain verified in the account. `selorg.com`
 * is NOT verified there — `otp@mineralbridge.com` is (see RESEND_VERIFIED_FROM).
 * Use the verified address but keep the human display name from the caller.
 */
function getResendFrom(payloadFrom: string): string {
  const verifiedRaw = String(
    process.env.RESEND_VERIFIED_FROM ||
      process.env.RIDER_RESEND_VERIFIED_FROM ||
      process.env.CUSTOMER_RESEND_VERIFIED_FROM ||
      '',
  ).trim();
  if (!verifiedRaw) {
    return String(process.env.RESEND_FROM || '').trim() || payloadFrom;
  }
  const verifiedEmail = parseFromAddress(verifiedRaw).email;
  const displayName = parseFromAddress(payloadFrom).name || APP_NAME;
  return `"${displayName}" <${verifiedEmail}>`;
}

async function sendViaResend(payload: EmailPayload): Promise<EmailResult | null> {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return null;
  const started = Date.now();
  const from = getResendFrom(payload.from);
  const response = await withTimeout(
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [payload.to],
        reply_to: process.env.EMAIL_REPLY_TO || 'admin@selorg.com',
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    }),
    FAST_TIMEOUT_MS,
    'Resend',
  );
  const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };
  if (!response.ok) throw new Error(body?.message || body?.error || `Resend HTTP ${response.status}`);
  logger.info(`[Email] Resend → ${payload.to} in ${Date.now() - started}ms`);
  return { sent: true, channel: 'email', configured: true, provider: 'resend', messageId: body?.id };
}

async function sendViaBrevo(payload: EmailPayload): Promise<EmailResult | null> {
  const apiKey = String(process.env.BREVO_API_KEY || '').trim();
  if (!apiKey) return null;
  const sender = parseFromAddress(payload.from);
  const started = Date.now();
  const response = await withTimeout(
    fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender,
        to: [{ email: payload.to }],
        subject: payload.subject,
        htmlContent: payload.html,
        textContent: payload.text,
      }),
    }),
    FAST_TIMEOUT_MS,
    'Brevo',
  );
  const body = (await response.json().catch(() => ({}))) as { messageId?: string; message?: string; error?: string };
  if (!response.ok) throw new Error(body?.message || body?.error || `Brevo HTTP ${response.status}`);
  logger.info(`[Email] Brevo → ${payload.to} in ${Date.now() - started}ms`);
  return { sent: true, channel: 'email', configured: true, provider: 'brevo', messageId: body?.messageId };
}

async function sendViaSendGrid(payload: EmailPayload): Promise<EmailResult | null> {
  const apiKey = String(process.env.SENDGRID_API_KEY || '').trim();
  if (!apiKey) return null;
  const from = parseFromAddress(payload.from);
  const started = Date.now();
  const response = await withTimeout(
    fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: payload.to }] }],
        from,
        subject: payload.subject,
        content: [
          { type: 'text/plain', value: payload.text },
          { type: 'text/html', value: payload.html },
        ],
      }),
    }),
    FAST_TIMEOUT_MS,
    'SendGrid',
  );
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `SendGrid HTTP ${response.status}`);
  }
  logger.info(`[Email] SendGrid → ${payload.to} in ${Date.now() - started}ms`);
  return { sent: true, channel: 'email', configured: true, provider: 'sendgrid' };
}

async function sendViaSmtp(payload: EmailPayload): Promise<EmailResult> {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, configured: false, userMessage: 'Email is not configured on the server.' };
  }
  const started = Date.now();
  const info = await withTimeout(
    transporter.sendMail({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      priority: 'high',
      headers: { 'X-Priority': '1', Importance: 'high', 'X-MSMail-Priority': 'High' },
    }),
    SMTP_TIMEOUT_MS,
    'SMTP',
  );
  logger.info(`[Email] SMTP accepted ${payload.to} in ${Date.now() - started}ms`);
  return { sent: true, channel: 'email', configured: true, provider: 'smtp', messageId: info.messageId };
}

/** Races all configured fast HTTP providers; first success wins. */
async function raceFastProviders(payload: EmailPayload): Promise<EmailResult | null> {
  const runners: Array<() => Promise<EmailResult | null>> = [];
  if (isResendConfigured()) runners.push(() => sendViaResend(payload));
  if (isBrevoConfigured()) runners.push(() => sendViaBrevo(payload));
  if (isSendGridConfigured()) runners.push(() => sendViaSendGrid(payload));
  if (runners.length === 0) return null;

  return new Promise((resolve, reject) => {
    let settled = false;
    let pending = runners.length;
    const errors: string[] = [];

    runners.forEach((run) => {
      run()
        .then((result) => {
          if (!settled && result?.sent) {
            settled = true;
            resolve(result);
          }
        })
        .catch((err) => errors.push(err?.message || String(err)))
        .finally(() => {
          pending -= 1;
          if (!settled && pending === 0) reject(new Error(errors.join(' | ') || 'All fast providers failed'));
        });
    });

    setTimeout(() => {
      if (!settled) reject(new Error(`Fast providers timed out after ${FAST_TIMEOUT_MS}ms`));
    }, FAST_TIMEOUT_MS + 500);
  });
}

function buildOtpEmailHtml(otp: string, expiresInMinutes: number, appName: string): string {
  const spacedOtp = String(otp).split('').join(' ');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;">
        <tr><td style="background-color:#EFF6FF;padding:28px 32px 22px;text-align:center;border-bottom:1px solid #DBEAFE;">
          <div style="font-size:22px;font-weight:700;color:#111827;">${appName}</div>
          <div style="font-size:14px;color:#6B7280;margin-top:6px;">Secure sign-in verification</div>
        </td></tr>
        <tr><td style="padding:32px;text-align:center;">
          <p style="margin:0 0 28px;font-size:15px;line-height:24px;color:#6B7280;">Enter this code to verify your email.</p>
          <div style="display:inline-block;border:2px solid #F2C94C;border-radius:12px;padding:18px 48px;">
            <span style="font-size:36px;font-weight:700;color:#111827;letter-spacing:12px;">${spacedOtp}</span>
          </div>
          <p style="margin:28px 0 0;font-size:13px;color:#9CA3AF;">Expires in <strong>${expiresInMinutes} minutes</strong>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildTransactionalEmailHtml(title: string, body: string, appName: string): string {
  const safeTitle = String(title || 'Notification').replace(/</g, '&lt;');
  const safeBody = String(body || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;">
        <tr><td style="background-color:#ECFDF5;padding:28px 32px 22px;text-align:center;border-bottom:1px solid #D1FAE5;">
          <div style="font-size:22px;font-weight:700;color:#111827;">${appName}</div>
          <div style="font-size:14px;color:#6B7280;margin-top:6px;">Account notification</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${safeTitle}</h1>
          <p style="margin:0;font-size:15px;line-height:24px;color:#4B5563;">${safeBody}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function dispatch(payload: EmailPayload): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return { sent: false, configured: false, userMessage: 'Email is not configured on the server.' };
  }
  if (hasFastProvider()) {
    try {
      const result = await raceFastProviders(payload);
      if (result?.sent) return result;
    } catch (err) {
      logger.warn(`[Email] Fast providers failed for ${payload.to}: ${(err as Error)?.message}`);
    }
  }
  if (isSmtpConfigured()) return sendViaSmtp(payload);
  return { sent: false, configured: true, userMessage: 'Failed to send email. Please try again.', internalError: 'No email provider available' };
}

export async function sendOtpEmail(params: {
  to: string;
  otp: string;
  expiresInMinutes?: number;
  appName?: string;
  from?: string;
}): Promise<EmailResult> {
  const { to, otp, expiresInMinutes = 5, appName = APP_NAME, from } = params;
  const payload: EmailPayload = {
    to,
    subject: `${appName} – Your verification code`,
    html: buildOtpEmailHtml(otp, expiresInMinutes, appName),
    text: `Your ${appName} verification code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
    from: from || getFromAddress(),
  };
  return dispatch(payload);
}

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  appName?: string;
  from?: string;
}): Promise<EmailResult> {
  const destination = String(params.to || '').trim();
  if (!destination || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
    return { sent: false, configured: true, userMessage: 'Invalid email address.' };
  }
  const appName = params.appName || APP_NAME;
  const payload: EmailPayload = {
    to: destination,
    subject: String(params.subject || `${appName} notification`).slice(0, 200),
    text: String(params.text || ''),
    html: params.html || buildTransactionalEmailHtml(params.subject, params.text, appName),
    from: params.from || getFromAddress(),
  };
  return dispatch(payload);
}
