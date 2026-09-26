import mongoose from 'mongoose';
import { PickerUser, type PickerLanguage } from './picker.models';
import {
  PickerPushToken, PickerCancelReason, DEFAULT_CANCEL_REASONS,
} from './picker.rider.models';
import { AppError } from '../../utils/AppError';
import { pickerConfig, PICKER_LANGUAGE_CATALOG } from './picker.config';
import { longDateDisplay } from './picker.format';
import * as faqService from '../faq/faq.service';
import * as legalRepo from '../legal/legal.repository';
import * as supportRepo from '../support/support.repository';
import * as chatService from '../support-chat/support-chat.service';
import { getActiveAssignment } from './picker.shift.service';

/**
 * Config, settings, support, FAQ and legal surfaces the rider app consumes
 * (APIs 49–60). Reuses the existing FAQ, legal and support modules rather than
 * inventing a parallel stack.
 */

const DEFAULT_PREFERENCES = {
  pushNotifications: true,
  locationSharing: true,
  orderSoundAlerts: true,
  language: 'en' as PickerLanguage,
  shiftReminders: true,
  payoutAlerts: true,
  incentiveUpdates: false,
};

function compareVersions(a: string, b: string): number {
  const pa = String(a).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

function toPreferencesDto(user: { preferences?: Record<string, unknown> } | null) {
  const prefs = user?.preferences || {};
  const pushNotifications = prefs.pushNotifications !== false;
  const locationSharing = prefs.locationSharing !== false;
  const orderSoundAlerts = prefs.orderSoundAlerts !== false;
  const shiftReminders = prefs.shiftReminders !== false;
  const payoutAlerts = prefs.payoutAlerts !== false;
  const incentiveUpdates = prefs.incentiveUpdates === true;
  return {
    pushNotifications,
    locationSharing,
    orderSoundAlerts,
    language: (prefs.language as PickerLanguage) || DEFAULT_PREFERENCES.language,
    shiftReminders,
    payoutAlerts,
    incentiveUpdates,
    push: pushNotifications,
    shiftRem: shiftReminders,
    payout: payoutAlerts,
    incentive: incentiveUpdates,
    sound: orderSoundAlerts,
    updatedAt: prefs.updatedAt ? new Date(prefs.updatedAt as Date).toISOString() : new Date().toISOString(),
  };
}

type PreferencePatch = Partial<{
  pushNotifications: boolean;
  locationSharing: boolean;
  orderSoundAlerts: boolean;
  language: PickerLanguage;
  shiftReminders: boolean;
  payoutAlerts: boolean;
  incentiveUpdates: boolean;
  push: boolean;
  shiftRem: boolean;
  payout: boolean;
  incentive: boolean;
  sound: boolean;
}>;

function mapPreferencePatch(input: PreferencePatch): Partial<typeof DEFAULT_PREFERENCES> {
  const mapped: Partial<typeof DEFAULT_PREFERENCES> = {};
  if (typeof input.pushNotifications === 'boolean') mapped.pushNotifications = input.pushNotifications;
  if (typeof input.push === 'boolean') mapped.pushNotifications = input.push;
  if (typeof input.locationSharing === 'boolean') mapped.locationSharing = input.locationSharing;
  if (typeof input.orderSoundAlerts === 'boolean') mapped.orderSoundAlerts = input.orderSoundAlerts;
  if (typeof input.sound === 'boolean') mapped.orderSoundAlerts = input.sound;
  if (typeof input.shiftReminders === 'boolean') mapped.shiftReminders = input.shiftReminders;
  if (typeof input.shiftRem === 'boolean') mapped.shiftReminders = input.shiftRem;
  if (typeof input.payoutAlerts === 'boolean') mapped.payoutAlerts = input.payoutAlerts;
  if (typeof input.payout === 'boolean') mapped.payoutAlerts = input.payout;
  if (typeof input.incentiveUpdates === 'boolean') mapped.incentiveUpdates = input.incentiveUpdates;
  if (typeof input.incentive === 'boolean') mapped.incentiveUpdates = input.incentive;
  if (input.language) mapped.language = input.language;
  return mapped;
}

// ─── APIs 49–50 ───────────────────────────────────────────────────────────────

export async function getPreferences(pickerId: string) {
  const user = (await PickerUser.findById(pickerId).select('preferences').lean()) as any;
  if (!user) throw AppError.notFound('Picker');
  return toPreferencesDto(user);
}

export async function updatePreferences(
  pickerId: string,
  input: PreferencePatch,
) {
  const user = await PickerUser.findById(pickerId).select('preferences isOnline');
  if (!user) throw AppError.notFound('Picker');

  const mapped = mapPreferencePatch(input);

  if (mapped.locationSharing === false && user.isOnline) {
    const active = await getActiveAssignment(pickerId);
    if (active) {
      throw new AppError(
        'Go offline before turning off location sharing.',
        409,
        'LOCATION_REQUIRED_WHILE_ONLINE',
      );
    }
  }

  const next = {
    ...DEFAULT_PREFERENCES,
    ...(user.preferences || {}),
    ...mapped,
    updatedAt: new Date(),
  };
  user.preferences = next as typeof user.preferences;
  await user.save();
  return toPreferencesDto({ preferences: next });
}

// ─── API 51 ───────────────────────────────────────────────────────────────────

export async function registerPushToken(
  pickerId: string,
  input: { token: string; platform: 'ios' | 'android'; deviceId?: string; appVersion?: string },
) {
  const pickerOid = new mongoose.Types.ObjectId(pickerId);
  const existing = await PickerPushToken.findOne({ token: input.token });
  if (existing) {
    existing.pickerId = pickerOid;
    existing.platform = input.platform;
    existing.deviceId = input.deviceId;
    existing.appVersion = input.appVersion;
    existing.isActive = true;
    existing.lastSeenAt = new Date();
    await existing.save();
    return { registered: true, tokenId: String(existing._id) };
  }

  if (input.deviceId) {
    await PickerPushToken.updateMany(
      { pickerId: pickerOid, deviceId: input.deviceId },
      { $set: { isActive: false } },
    );
  }

  const created = await PickerPushToken.create({
    pickerId: pickerOid,
    token: input.token,
    platform: input.platform,
    deviceId: input.deviceId,
    appVersion: input.appVersion,
    isActive: true,
    lastSeenAt: new Date(),
  });
  return { registered: true, tokenId: String(created._id) };
}

// ─── API 52 ───────────────────────────────────────────────────────────────────

export function getPublicConfig(query: { platform?: string; appVersion?: string } = {}) {
  const min = pickerConfig.minSupportedVersion;
  const latest = pickerConfig.latestVersion;
  const forceUpdate = query.appVersion ? compareVersions(query.appVersion, min) < 0 : false;
  return {
    otpLength: pickerConfig.otpLength,
    otpResendSeconds: pickerConfig.otpResendSeconds,
    codDepositLimit: pickerConfig.codDepositLimit,
    support: {
      phone: pickerConfig.supportPhone,
      email: pickerConfig.supportEmail,
      hours: pickerConfig.supportHours,
      emailSlaHours: pickerConfig.supportEmailSlaHours,
    },
    app: {
      minSupportedVersion: min,
      latestVersion: latest,
      forceUpdate,
      updateUrl: pickerConfig.updateUrl,
    },
    features: {
      bulkDelivery: pickerConfig.bulkDeliveryEnabled,
      emailLogin: pickerConfig.emailLoginEnabled,
    },
    locationPingSeconds: pickerConfig.locationPingSeconds,
    languages: PICKER_LANGUAGE_CATALOG,
  };
}

// ─── API 53 ───────────────────────────────────────────────────────────────────

export async function getCancelReasons(context: 'standard' | 'bulk') {
  let reasons = await PickerCancelReason.find({ context, isActive: true }).sort({ order: 1 }).lean();
  if (reasons.length === 0) {
    reasons = DEFAULT_CANCEL_REASONS.filter((r) => r.context === context) as typeof reasons;
  }
  return {
    context,
    reasons: reasons.map((r) => ({
      id: r.reasonId,
      label: r.label,
      subtitle: r.subtitle ?? null,
      requiresNote: Boolean(r.requiresNote),
      order: r.order,
    })),
  };
}

// ─── API 54 ───────────────────────────────────────────────────────────────────

export async function listFaqs(params: { category?: string; limit: number }) {
  const result = await faqService.listPublicFaqs(params.category);
  const faqs = result.items.slice(0, params.limit).map((item) => ({
    id: item.id,
    q: item.question,
    a: item.answer,
    category: item.category || null,
    order: item.order,
  }));
  return { faqs };
}

// ─── APIs 55–56 ───────────────────────────────────────────────────────────────

const TICKET_CATEGORY_MAP: Record<string, 'order' | 'payment' | 'delivery' | 'account' | 'technical' | 'feedback'> = {
  payment: 'payment',
  order: 'order',
  account: 'account',
  app: 'technical',
  other: 'feedback',
};

export async function listSupportTickets(
  pickerId: string,
  params: { status: string; page: number; limit: number },
) {
  const query: Record<string, unknown> = { customerId: String(pickerId), channel: 'rider_app' };
  if (params.status !== 'all') query.status = params.status;

  const skip = (params.page - 1) * params.limit;
  const [rows, total] = await Promise.all([
    (await import('../support/support-ticket.model')).SupportTicket
      .find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(params.limit)
      .lean(),
    (await import('../support/support-ticket.model')).SupportTicket.countDocuments(query),
  ]);

  const ids = rows.map((t: { _id: mongoose.Types.ObjectId }) => t._id);
  const noteCounts = await supportRepo.countNonInternalNotesByTicketIds(ids);

  const tickets = rows.map((t: any) => ({
    id: String(t._id),
    subject: t.subject,
    category: t.category || null,
    status: t.status,
    orderId: t.orderId ? String(t.orderId) : null,
    lastMessageAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
    unreadCount: 0,
    createdAt: new Date(t.createdAt).toISOString(),
    ticketNumber: t.ticketNumber,
    noteCount: noteCounts[String(t._id)] || 0,
  }));

  return { tickets, total, page: params.page, limit: params.limit, totalPages: Math.max(1, Math.ceil(total / params.limit)) };
}

export async function createSupportTicket(
  pickerId: string,
  input: { subject: string; message: string; category?: string; orderId?: string; batchId?: string },
) {
  const user = (await PickerUser.findById(pickerId).select('name email phone phoneIsPlaceholder').lean()) as any;
  if (!user) throw AppError.notFound('Picker');

  if (input.orderId) {
    const { Order } = await import('../orders/order.model');
    const order = await Order.findById(input.orderId).select('pickerId').lean();
    if (order && String((order as any).pickerId || '') !== pickerId) {
      throw new AppError('That order does not belong to you.', 403, 'ORDER_NOT_OWNED');
    }
  }

  const recent = await (await import('../support/support-ticket.model')).SupportTicket.countDocuments({
    customerId: String(pickerId),
    channel: 'rider_app',
    createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
  });
  if (recent >= 5) {
    throw new AppError('Too many tickets in a short period. Please wait before raising another.', 429, 'TOO_MANY_TICKETS');
  }

  const { ticket } = await supportRepo.createTicket(
    {
      subject: input.subject,
      description: input.message,
      category: TICKET_CATEGORY_MAP[input.category || 'other'] || 'feedback',
      channel: 'rider_app',
      customerId: String(pickerId),
      customerName: user.name || 'Rider',
      customerEmail: user.email || 'rider@selorg.in',
      customerPhone: user.phoneIsPlaceholder ? '' : user.phone || '',
      orderNumber: input.orderId,
      tags: input.batchId ? [`batch:${input.batchId}`] : [],
    },
    undefined,
    undefined,
  );

  return {
    id: String(ticket._id),
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: new Date(ticket.createdAt).toISOString(),
    estimatedResponseHours: pickerConfig.supportEmailSlaHours,
  };
}

// ─── APIs 57–58 ───────────────────────────────────────────────────────────────

export async function getChatMessages(
  pickerId: string,
  params: { since?: Date; limit: number },
) {
  const user = (await PickerUser.findById(pickerId).select('name phone phoneIsPlaceholder').lean()) as any;
  const conversation = await getOrCreatePickerConversation(pickerId, user);
  const messages = await chatService.listMessages(conversation.conversationId as string, { limit: params.limit });
  const filtered = params.since
    ? messages.filter((m) => new Date(m.createdAt).getTime() >= params.since!.getTime())
    : messages;

  return {
    conversationId: conversation.conversationId,
    status: conversation.status === 'resolved' ? 'closed' : 'open',
    agentOnline: false,
    messages: filtered.map((m) => ({
      id: m.messageId,
      me: m.senderType === 'rider',
      text: m.body,
      senderName: m.senderName || null,
      createdAt: new Date(m.createdAt).toISOString(),
      readAt: m.readByAdmin && m.senderType === 'rider' ? new Date(m.createdAt).toISOString() : null,
    })),
    unreadCount: conversation.riderUnreadCount || 0,
  };
}

export async function sendChatMessage(
  pickerId: string,
  input: { text: string; orderId?: string; batchId?: string; clientMessageId?: string },
) {
  const user = (await PickerUser.findById(pickerId).select('name phone phoneIsPlaceholder').lean()) as any;
  const conversation = await getOrCreatePickerConversation(pickerId, user);
  if (conversation.status === 'resolved') {
    throw new AppError('This conversation is closed. Please raise a ticket.', 409, 'CONVERSATION_CLOSED');
  }

  const result = await chatService.sendMessage({
    conversationId: conversation.conversationId as string,
    senderType: 'rider',
    senderId: pickerId,
    senderName: user?.name || 'Rider',
    body: input.text,
    clientMessageId: input.clientMessageId,
  });

  return {
    id: result.message.messageId,
    clientMessageId: result.message.clientMessageId,
    me: true,
    text: result.message.body,
    createdAt: new Date(result.message.createdAt).toISOString(),
    conversationId: result.message.conversationId,
  };
}

async function getOrCreatePickerConversation(pickerId: string, user: { name?: string; phone?: string; phoneIsPlaceholder?: boolean } | null) {
  const existing = await (await import('../support-chat/support-conversation.model')).SupportConversation
    .findOne({ riderId: pickerId })
    .lean();
  if (existing) return existing as Record<string, unknown>;

  const { SupportConversation } = await import('../support-chat/support-conversation.model');
  const { randomUUID } = await import('crypto');
  const created = await SupportConversation.create({
    conversationId: `sc-${randomUUID()}`,
    riderId: pickerId,
    riderName: user?.name || 'Rider',
    riderPhone: user?.phoneIsPlaceholder ? '' : user?.phone || '',
    status: 'open',
  });
  return created.toObject() as unknown as Record<string, unknown>;
}

// ─── APIs 59–60 ───────────────────────────────────────────────────────────────

function parseSections(content: string): Array<{ h: string; b: string }> {
  const trimmed = String(content || '').trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.every((s) => s && (s.h || s.heading))) {
      return parsed.map((s) => ({ h: String(s.h || s.heading), b: String(s.b || s.body || '') }));
    }
  } catch {
    // not JSON — fall through to markdown/plain splitting
  }

  const blocks = trimmed.split(/\n(?=#{1,3}\s)/);
  if (blocks.length > 1) {
    return blocks.map((block) => {
      const [first, ...rest] = block.split('\n');
      return { h: first.replace(/^#{1,3}\s*/, '').trim(), b: rest.join('\n').trim() };
    }).filter((s) => s.h || s.b);
  }

  const numbered = trimmed.split(/\n(?=\d+\.\s)/);
  if (numbered.length > 1) {
    return numbered.map((block) => {
      const [first, ...rest] = block.split('\n');
      return { h: first.replace(/^\d+\.\s*/, '').trim(), b: rest.join('\n').trim() };
    }).filter((s) => s.h);
  }

  return [{ h: '', b: trimmed }];
}

async function loadLegal(type: 'terms' | 'privacy', version?: string) {
  const filter = version
    ? { type, version, appTarget: { $in: ['picker', 'rider'] } }
    : { type, isCurrent: true, appTarget: { $in: ['picker', 'rider'] } };
  let doc = await (await import('../legal/legal.model')).LegalDocument.findOne(filter).lean();
  if (!doc) {
    doc = await legalRepo.findCurrentOrVersioned(type, version);
  }
  if (!doc) {
    throw new AppError(`${type === 'terms' ? 'Terms of Service' : 'Privacy Policy'} not found.`, 404, 'DOCUMENT_NOT_FOUND');
  }
  const sections = parseSections(doc.content);
  const effective = doc.effectiveDate || doc.lastUpdated;
  const updated = doc.lastUpdated || doc.effectiveDate;
  return {
    version: doc.version,
    title: doc.title,
    effectiveDate: effective,
    lastUpdated: updated,
    effectiveDateDisplay: effective ? `Effective ${longDateDisplay(new Date(effective))}` : null,
    lastUpdatedDisplay: updated ? `Last updated ${longDateDisplay(new Date(updated))}` : null,
    sections: sections.map((s) => ({ h: s.h || doc.title, b: s.b })),
    contentHtml: doc.contentFormat === 'html' ? doc.content : null,
  };
}

export function getLegalTerms(version?: string) {
  return loadLegal('terms', version);
}

export function getLegalPrivacy(version?: string) {
  return loadLegal('privacy', version);
}

export async function getLegalConfig() {
  const config = await legalRepo.getLoginLegalConfig();
  return config?.loginLegal || {
    preamble: "By continuing, you agree to Selorg's ",
    terms: { label: 'Terms of Service', type: 'in_app', url: null },
    privacy: { label: 'Privacy Policy', type: 'in_app', url: null },
    connector: ' & ',
  };
}

export async function postHeartbeat(pickerId: string, batteryLevel?: number) {
  const now = new Date();
  await PickerUser.updateOne(
    { _id: pickerId },
    { $set: { lastSeenAt: now, ...(batteryLevel != null ? { batteryLevel } : {}) } },
  );
  // Opportunistically mark other riders offline when their heartbeat is stale.
  void markStaleRidersOffline().catch(() => undefined);
  return { ok: true, ts: now.toISOString() };
}

/** Riders with no heartbeat for this many ms are treated as offline (default 90s). */
const STALE_ONLINE_MS = Number(process.env.RIDER_STALE_ONLINE_MS || 90_000);

export async function markStaleRidersOffline(): Promise<{ markedOffline: number }> {
  const cutoff = new Date(Date.now() - STALE_ONLINE_MS);
  const result = await PickerUser.updateMany(
    {
      isOnline: true,
      $or: [
        { lastSeenAt: { $lt: cutoff } },
        { lastSeenAt: null },
        { lastSeenAt: { $exists: false } },
      ],
    },
    { $set: { isOnline: false, onlineSince: null } },
  );
  return { markedOffline: result.modifiedCount || 0 };
}

export async function postPresencePing(pickerId: string) {
  return postHeartbeat(pickerId);
}

export async function getPerformanceSummary(pickerId: string) {
  const user = (await PickerUser.findById(pickerId)
    .select('totalTrips onTimeDeliveries lateDeliveries ratingSum ratingCount')
    .lean()) as any;
  if (!user) throw AppError.notFound('Picker');
  const rated = (user.onTimeDeliveries || 0) + (user.lateDeliveries || 0);
  return {
    totalTrips: user.totalTrips || 0,
    onTimePercent: rated === 0 ? 100 : Math.round(((user.onTimeDeliveries || 0) / rated) * 1000) / 10,
    rating: user.ratingCount >= pickerConfig.minRatedTripsForRating
      ? Math.round((user.ratingSum / user.ratingCount) * 10) / 10
      : null,
    ratingCount: user.ratingCount || 0,
  };
}
