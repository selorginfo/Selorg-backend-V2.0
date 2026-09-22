import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { getPublicVapidKey, isWebPushConfigured } from '../../services/webpush.service';
import * as notificationsRepo from './notifications.repository';
import { INotification } from './notifications.model';
import { CATEGORY_LIST, CHANNELS, DEFAULT_CATEGORY_CHANNELS, defaultCategoriesPreferences, NotificationCategory, NotificationChannel } from './notifications.constants';
import type { UpdatePreferencesInput } from './notifications.validation';

// --- Preferences -----------------------------------------------------------

export interface NotificationPreferences {
  push: boolean;
  inApp: boolean;
  sms: boolean;
  whatsapp: boolean;
  email: boolean;
  dnd: boolean;
  dndStartHour: number;
  dndEndHour: number;
  categories: Record<NotificationCategory, Record<NotificationChannel, boolean>>;
}

function clampHour(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const h = Math.floor(n);
  if (h < 0 || h > 23) return fallback;
  return h;
}

function normalizeCategoryChannels(raw: unknown): Record<NotificationChannel, boolean> {
  const base = { ...DEFAULT_CATEGORY_CHANNELS };
  if (!raw || typeof raw !== 'object') return base;
  const record = raw as Record<string, unknown>;
  for (const ch of CHANNELS) {
    if (typeof record[ch] === 'boolean') base[ch] = record[ch] as boolean;
  }
  return base;
}

function normalizeCategories(raw: unknown): Record<NotificationCategory, Record<NotificationChannel, boolean>> {
  const defaults = defaultCategoriesPreferences();
  if (!raw || typeof raw !== 'object') return defaults;
  const record = raw as Record<string, unknown>;
  for (const cat of CATEGORY_LIST) {
    if (record[cat] && typeof record[cat] === 'object') {
      defaults[cat] = normalizeCategoryChannels(record[cat]);
    }
  }
  return defaults;
}

function normalizePreferences(raw: unknown): NotificationPreferences {
  const base: NotificationPreferences = {
    push: true,
    inApp: true,
    sms: true,
    whatsapp: true,
    email: true,
    dnd: false,
    dndStartHour: 22,
    dndEndHour: 7,
    categories: defaultCategoriesPreferences(),
  };
  if (!raw || typeof raw !== 'object') return base;
  const record = raw as Record<string, unknown>;
  for (const key of ['push', 'inApp', 'sms', 'whatsapp', 'email', 'dnd'] as const) {
    if (typeof record[key] === 'boolean') base[key] = record[key] as boolean;
  }
  base.dndStartHour = clampHour(record.dndStartHour, 22);
  base.dndEndHour = clampHour(record.dndEndHour, 7);
  base.categories = normalizeCategories(record.categories);
  return base;
}

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const user = await notificationsRepo.findNotificationPreferences(userId);
  return normalizePreferences(user?.notificationPreferences);
}

/** Deactivates every registered push token so no device keeps receiving pushes after Push is turned off. */
export async function deactivateAllPushTokens(userId: string): Promise<number> {
  try {
    const result = await notificationsRepo.deactivateAllTokens(userId);
    const modified = result.modifiedCount ?? 0;
    if (modified > 0) logger.info('Deactivated push tokens after preference disable', { userId, deactivated: modified });
    return modified;
  } catch (err) {
    logger.warn('Failed to deactivate push tokens', { userId, error: (err as Error).message });
    return 0;
  }
}

/** Re-enables previously deactivated tokens when Push is turned back on. */
export async function reactivateAllPushTokens(userId: string): Promise<number> {
  try {
    const result = await notificationsRepo.reactivateAllTokens(userId);
    const modified = result.modifiedCount ?? 0;
    if (modified > 0) logger.info('Reactivated push tokens after preference enable', { userId, reactivated: modified });
    return modified;
  } catch (err) {
    logger.warn('Failed to reactivate push tokens', { userId, error: (err as Error).message });
    return 0;
  }
}

function mergeCategoryPatch(existing: unknown, patch: unknown): Record<NotificationCategory, Record<NotificationChannel, boolean>> {
  const categories = normalizeCategories(existing);
  if (!patch || typeof patch !== 'object') return categories;
  const record = patch as Record<string, unknown>;
  for (const cat of CATEGORY_LIST) {
    if (record[cat] && typeof record[cat] === 'object') {
      categories[cat] = normalizeCategoryChannels({ ...categories[cat], ...(record[cat] as object) });
    }
  }
  return categories;
}

export async function updatePreferences(userId: string, patch: UpdatePreferencesInput): Promise<{ preferences?: NotificationPreferences; error?: string }> {
  const previous = await getPreferences(userId);
  const updates: Record<string, unknown> = {};
  for (const key of ['push', 'inApp', 'sms', 'whatsapp', 'email', 'dnd'] as const) {
    if (typeof patch[key] === 'boolean') updates[`notificationPreferences.${key}`] = patch[key];
  }
  if (patch.dndStartHour !== undefined) updates['notificationPreferences.dndStartHour'] = clampHour(patch.dndStartHour, previous.dndStartHour);
  if (patch.dndEndHour !== undefined) updates['notificationPreferences.dndEndHour'] = clampHour(patch.dndEndHour, previous.dndEndHour);
  if (patch.categories && typeof patch.categories === 'object') {
    updates['notificationPreferences.categories'] = mergeCategoryPatch(previous.categories, patch.categories);
  }
  if (Object.keys(updates).length === 0) return { error: 'No valid preference fields provided' };

  const user = await notificationsRepo.updateNotificationPreferences(userId, updates);
  if (!user) return { error: 'User not found' };

  const preferences = normalizePreferences(user.notificationPreferences);
  if (preferences.push === false) {
    await deactivateAllPushTokens(userId);
  } else if (previous.push === false && preferences.push === true) {
    await reactivateAllPushTokens(userId);
  }

  return { preferences };
}

/** Resolves whether a specific channel is allowed for a category (global toggle AND category matrix; push also requires DND off). */
export function isChannelAllowedForCategory(preferences: unknown, category: string, channel: NotificationChannel): boolean {
  const prefs = normalizePreferences(preferences);
  if (!(CHANNELS as readonly string[]).includes(channel)) return false;

  if (channel === 'push') {
    if (prefs.dnd) return false;
    if (prefs.push === false) return false;
  } else if (prefs[channel] === false) {
    return false;
  }

  const catKey = (CATEGORY_LIST as string[]).includes(category) ? (category as NotificationCategory) : 'system';
  const catPrefs = prefs.categories?.[catKey] || DEFAULT_CATEGORY_CHANNELS;
  return catPrefs[channel] !== false;
}

// --- Inbox ---------------------------------------------------------------

function toInboxResponse(doc: Pick<INotification, '_id' | 'title' | 'body' | 'read' | 'category' | 'data' | 'createdAt' | 'deliveryStatus'>) {
  return {
    id: String(doc._id),
    title: doc.title,
    body: doc.body,
    read: Boolean(doc.read),
    category: doc.category || (doc.data as { category?: string })?.category || 'system',
    data: doc.data || {},
    createdAt: doc.createdAt,
    deliveryStatus: doc.deliveryStatus,
  };
}

export async function listByUserId(userId: string, page = 1, limit = 50, filter: { category?: string; unreadOnly?: boolean } = {}) {
  const skip = (Math.max(1, page) - 1) * limit;
  const category = filter.category && (CATEGORY_LIST as string[]).includes(filter.category) ? (filter.category as NotificationCategory) : undefined;
  const [list, total, unread] = await notificationsRepo.listNotifications(userId, skip, limit, { category, unreadOnly: filter.unreadOnly });
  return {
    data: list.map((d) => toInboxResponse(d as unknown as INotification)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    unreadCount: unread,
  };
}

export async function markRead(userId: string, notificationId: string) {
  const updated = await notificationsRepo.updateReadState(userId, notificationId, true);
  if (!updated) throw AppError.notFound('Notification');
  return toInboxResponse(updated as unknown as INotification);
}

export async function markUnread(userId: string, notificationId: string) {
  const updated = await notificationsRepo.updateReadState(userId, notificationId, false);
  if (!updated) throw AppError.notFound('Notification');
  return toInboxResponse(updated as unknown as INotification);
}

export async function markAllRead(userId: string) {
  await notificationsRepo.markAllRead(userId);
}

export async function removeOne(userId: string, notificationId: string) {
  const deleted = await notificationsRepo.deleteNotification(userId, notificationId);
  if (!deleted) throw AppError.notFound('Notification');
  return toInboxResponse(deleted as unknown as INotification);
}

export async function getUnreadCount(userId: string) {
  return notificationsRepo.getUnreadCount(userId);
}

export function vapidPublicKey() {
  const key = getPublicVapidKey();
  if (!key || !isWebPushConfigured()) throw new AppError('Web Push is not configured on the server', 503, 'WEB_PUSH_NOT_CONFIGURED');
  return { publicKey: key };
}

// --- Push tokens -------------------------------------------------------------

function isExpoToken(token: string): boolean {
  return typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
}

/** Resolves the persisted tokenType: only `expo` | `fcm` (per product requirements). */
function resolveTokenType({ token, tokenType, provider, platform }: { token: string; tokenType?: string; provider?: string; platform: string }): 'expo' | 'fcm' | undefined {
  if (platform === 'web') return undefined;
  const raw = String(tokenType || provider || '').trim().toLowerCase();
  if (raw === 'expo') return 'expo';
  if (raw === 'fcm' || raw === 'apns') return 'fcm';
  if (isExpoToken(token)) return 'expo';
  if (platform === 'ios' || platform === 'android') return 'fcm';
  return undefined;
}

export async function registerToken(userId: string, input: { token: string; platform?: string; tokenType?: string; provider?: string }) {
  const preferences = await getPreferences(userId);
  if (preferences.push === false) {
    throw new AppError('Push notifications are disabled. Enable them in settings first.', 403, 'PUSH_DISABLED');
  }

  const allowedPlatforms = new Set(['ios', 'android', 'web']);
  const resolvedPlatform = allowedPlatforms.has(input.platform || '') ? (input.platform as string) : 'android';
  const resolvedTokenType = resolveTokenType({ token: input.token, tokenType: input.tokenType, provider: input.provider, platform: resolvedPlatform });

  const update: Record<string, unknown> = { userId, token: input.token, platform: resolvedPlatform, active: true };
  if (resolvedTokenType) update.tokenType = resolvedTokenType;

  await notificationsRepo.upsertPushToken(userId, input.token, update);
  return { tokenType: resolvedTokenType || null };
}

export async function registerWebPush(userId: string, body: { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string }; expirationTime?: number | null }; endpoint?: string; keys?: { p256dh?: string; auth?: string }; expirationTime?: number | null; userAgent?: string }, headerUserAgent?: string) {
  const preferences = await getPreferences(userId);
  if (preferences.push === false) {
    throw new AppError('Push notifications are disabled. Enable them in settings first.', 403, 'PUSH_DISABLED');
  }

  const subscription = body.subscription || body;
  const endpoint = subscription.endpoint;
  const keys = subscription.keys;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw AppError.badRequest('Valid Web Push subscription (endpoint + keys) is required');
  }

  await notificationsRepo.upsertPushToken(userId, endpoint, {
    userId,
    token: endpoint,
    platform: 'web',
    active: true,
    webSubscription: { endpoint, expirationTime: subscription.expirationTime ?? null, keys: { p256dh: keys.p256dh, auth: keys.auth } },
    userAgent: body.userAgent || headerUserAgent || null,
  });
}

export async function removeToken(userId: string, token: string) {
  await notificationsRepo.deactivateToken(userId, token);
}

export async function removeAllTokens(userId: string) {
  return deactivateAllPushTokens(userId);
}
