/**
 * Firebase Cloud Messaging (FCM) service — firebase-admin v14 (modular API).
 *
 * Env vars required (from your selorg-15948 Firebase project):
 *   FIREBASE_PROJECT_ID       — e.g. selorg-15948
 *   FIREBASE_CLIENT_EMAIL     — service account email
 *   FIREBASE_PRIVATE_KEY      — private key (with literal \n between lines)
 *
 * Generate: Firebase Console → selorg-15948 → Project Settings
 *           → Service Accounts → Generate new private key
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { logger } from '../utils/logger';

let _app: App | null = null;

function getApp(): App | null {
  if (_app) return _app;
  if (getApps().length) { _app = getApps()[0]; return _app; }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    logger.warn('[FCM] Firebase credentials not configured — FCM push disabled');
    return null;
  }

  try {
    const privateKey = rawKey.replace(/\\n/g, '\n');
    _app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    logger.info('[FCM] Firebase Admin initialised', { projectId });
  } catch (err) {
    logger.error('[FCM] Init failed', { error: (err as Error).message });
  }

  return _app;
}

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

/**
 * Send a data-only FCM message to one or more device tokens.
 * Data-only lets the app's background handler show a custom notification
 * with countdown timers and BigPicture images.
 * Returns the count of successful sends.
 */
export async function sendToTokens(tokens: string[], payload: FcmPayload): Promise<number> {
  if (tokens.length === 0) return 0;
  const app = getApp();
  if (!app) return 0;

  const data: Record<string, string> = {
    title: payload.title,
    body: payload.body,
    ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    ...(payload.data || {}),
  };

  const message: MulticastMessage = {
    tokens,
    data,
    android: { priority: 'high' },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: { aps: { contentAvailable: true, sound: 'push.mp3', badge: 1 } },
    },
  };

  try {
    const result = await getMessaging(app).sendEachForMulticast(message);
    const failed = result.responses.filter(r => !r.success);
    if (failed.length) {
      logger.warn('[FCM] Some tokens failed', {
        total: tokens.length,
        failed: failed.length,
        sample: failed.slice(0, 2).map(r => r.error?.message),
      });
    }
    return result.successCount;
  } catch (err) {
    logger.error('[FCM] sendEachForMulticast error', { error: (err as Error).message });
    return 0;
  }
}
