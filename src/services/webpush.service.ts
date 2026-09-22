/**
 * Browser Web Push (VAPID) delivery for Chrome/Edge.
 * Env (backend only — never expose the private key to the frontend):
 *   WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, WEB_PUSH_CONTACT_EMAIL
 */
import webpush from 'web-push';
import { logger } from '../utils/logger';

let configured = false;
let configureError: string | null = null;

/** Normalizes a VAPID contact to a single mailto: URI. Accepts bare email or "mailto:" prefixed. */
export function normalizeVapidContact(raw?: string | null): string {
  const fallback = 'mailto:admin@selorg.com';
  let value = String(raw || '').trim();
  if (!value) return fallback;
  while (/^mailto:/i.test(value)) {
    value = value.replace(/^mailto:/i, '').trim();
  }
  if (!value || !value.includes('@')) return fallback;
  return `mailto:${value}`;
}

function ensureConfigured(): boolean {
  if (configured) return true;
  if (configureError) return false;

  const publicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '').trim();
  if (!publicKey || !privateKey) {
    configureError = 'missing_vapid_keys';
    logger.warn('Web Push not configured — set WEB_PUSH_VAPID_PUBLIC_KEY and WEB_PUSH_VAPID_PRIVATE_KEY');
    return false;
  }

  const subject = normalizeVapidContact(process.env.WEB_PUSH_CONTACT_EMAIL);
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    logger.info('Web Push VAPID configured', { subject });
    return true;
  } catch (err) {
    configureError = (err as Error).message;
    logger.error('Web Push VAPID configuration failed', { error: (err as Error).message });
    return false;
  }
}

export function getPublicVapidKey(): string | null {
  return String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim() || null;
}

export function isWebPushConfigured(): boolean {
  return Boolean(String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim() && String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '').trim());
}

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface WebPushPayload {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  icon?: string;
  badge?: string;
}

export interface WebPushResult {
  sent: boolean;
  configured?: boolean;
  error?: string;
  statusCode?: number;
  gone?: boolean;
}

export async function sendWebPush(subscription: WebPushSubscription, payload: WebPushPayload): Promise<WebPushResult> {
  if (!ensureConfigured()) {
    return { sent: false, configured: false, error: configureError || 'web_push_not_configured' };
  }
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return { sent: false, error: 'invalid_subscription' };
  }

  const body = JSON.stringify({
    title: payload.title || 'Selorg',
    body: payload.body || '',
    data: payload.data || {},
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/badge-72.png',
  });

  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
      body,
      { TTL: 60 * 60 * 12, urgency: 'high' },
    );
    return { sent: true };
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    logger.warn('Web Push delivery failed', { endpoint: String(subscription.endpoint).slice(0, 80), statusCode, error: (err as Error).message });
    return { sent: false, error: (err as Error).message, statusCode, gone: statusCode === 404 || statusCode === 410 };
  }
}
