/**
 * Campaign dispatch — fans a campaign out to its audience across the configured channels and
 * records one NotificationHistory row per user/channel so the analytics, channel-performance and
 * history endpoints in notification-campaign.service.ts report real numbers.
 *
 * Previously `createCampaign` created the campaign record and only logged a warning, so an
 * "active" campaign never reached a single customer while the dashboard showed it as running.
 *
 * Channel support is bounded by what this service actually has a provider for:
 *   in-app  → CustomerNotification document (always available)
 *   push    → FCM via services/fcm.service (needs FIREBASE_* env)
 *   email   → services/email.service (needs SMTP/SES env)
 *   sms     → recorded as `skipped`; services/sms.service only exposes OTP-templated senders
 *   whatsapp→ recorded as `skipped`; same reason
 * Unsupported channels are written as `skipped` with a reason rather than counted as sent.
 */
import mongoose from 'mongoose';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/AppError';
import { CustomerUser, ICustomerUser } from '../auth/auth.model';
import { Order } from '../orders/order.model';
import { Notification, PushToken } from '../notifications/notifications.model';
import { CATEGORY_LIST } from '../notifications/notifications.constants';
import { sendToTokens } from '../../services/fcm.service';
import { sendTransactionalEmail } from '../../services/email.service';
import {
  NotificationCampaign,
  NotificationHistory,
  INotificationTemplate,
} from './notification-campaign.model';

/** Channels this service can actually deliver. */
const DELIVERABLE_CHANNELS = new Set(['in-app', 'push', 'email']);

/** FCM multicast caps at 500 tokens per request. */
const FCM_BATCH_SIZE = 500;

const VIP_MIN_DELIVERED_ORDERS = Math.max(1, Number(process.env.CAMPAIGN_VIP_MIN_ORDERS) || 10);
const NEW_CUSTOMER_DAYS = Math.max(1, Number(process.env.CAMPAIGN_NEW_CUSTOMER_DAYS) || 30);
const INACTIVE_DAYS = Math.max(1, Number(process.env.CAMPAIGN_INACTIVE_DAYS) || 60);

type AudienceUser = Pick<ICustomerUser, 'name' | 'email' | 'phoneNumber' | 'notificationPreferences'> & {
  _id: mongoose.Types.ObjectId;
};

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Resolve the customer ids for a campaign segment.
 *
 * `custom` is rejected: the campaign schema stores no filter criteria for it, so there is no
 * way to know who was intended — silently falling back to "everyone" would be the worst
 * possible default for a promotional blast.
 */
async function resolveAudience(segment: string): Promise<AudienceUser[]> {
  const base = { status: 'active' as const };
  const projection = 'name email phoneNumber notificationPreferences';

  switch (segment) {
    case 'all':
      return CustomerUser.find(base, projection).lean<AudienceUser[]>();

    case 'new':
      return CustomerUser.find({ ...base, createdAt: { $gte: daysAgo(NEW_CUSTOMER_DAYS) } }, projection).lean<
        AudienceUser[]
      >();

    case 'vip': {
      const vipIds = await Order.aggregate<{ _id: mongoose.Types.ObjectId }>([
        { $match: { status: 'delivered' } },
        { $group: { _id: '$userId', delivered: { $sum: 1 } } },
        { $match: { delivered: { $gte: VIP_MIN_DELIVERED_ORDERS } } },
        { $project: { _id: 1 } },
      ]);
      if (!vipIds.length) return [];
      return CustomerUser.find({ ...base, _id: { $in: vipIds.map((v) => v._id) } }, projection).lean<AudienceUser[]>();
    }

    case 'inactive': {
      const recentlyOrdered = await Order.distinct('userId', { createdAt: { $gte: daysAgo(INACTIVE_DAYS) } });
      return CustomerUser.find({ ...base, _id: { $nin: recentlyOrdered } }, projection).lean<AudienceUser[]>();
    }

    case 'custom':
      throw new AppError(
        'The "custom" segment has no stored filter criteria, so its audience cannot be resolved. Pick a defined segment.',
        400,
        'CAMPAIGN_SEGMENT_UNRESOLVABLE',
      );

    default:
      throw new AppError(`Unknown campaign segment "${segment}"`, 400, 'CAMPAIGN_SEGMENT_UNKNOWN');
  }
}

/** Substitute `{{variable}}` placeholders from the recipient's own fields. */
function renderTemplate(text: string, user: AudienceUser): string {
  if (!text) return '';
  const values: Record<string, string> = {
    name: user.name || 'there',
    firstName: (user.name || 'there').split(' ')[0] || 'there',
    email: user.email || '',
    phone: user.phoneNumber || '',
  };
  return text.replace(/\{\{([^}]+)\}\}/g, (match, rawKey: string) => {
    const key = rawKey.trim();
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key]! : match;
  });
}

/** Map a template category onto the customer notification category enum. */
function resolveCategory(category?: string): string {
  const candidate = String(category || 'system');
  return (CATEGORY_LIST as readonly string[]).includes(candidate) ? candidate : 'system';
}

function prefersChannel(user: AudienceUser, channel: string): boolean {
  const prefs = user.notificationPreferences;
  if (!prefs) return true;
  switch (channel) {
    case 'push':
      return prefs.push !== false;
    case 'in-app':
      return prefs.inApp !== false;
    case 'email':
      return prefs.email !== false;
    default:
      return true;
  }
}

interface HistoryRow {
  userId: string;
  userName?: string;
  templateName?: string;
  title: string;
  body: string;
  category: string | null;
  channel: 'push' | 'sms' | 'email' | 'whatsapp' | 'in-app' | 'web-push';
  status: 'sent' | 'failed' | 'skipped';
  failureReason?: string;
  campaignId: mongoose.Types.ObjectId;
  sentAt: Date;
}

export interface DispatchResult {
  targetUsers: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Deliver `template` to every user in `campaign.segment` over `campaign.channels`.
 * Never throws for a single recipient — per-recipient outcomes are recorded in history.
 */
export async function dispatchCampaign(
  campaignId: mongoose.Types.ObjectId | string,
  template: INotificationTemplate,
  segment: string,
  channels: string[],
): Promise<DispatchResult> {
  const campaignObjectId = new mongoose.Types.ObjectId(String(campaignId));
  const audience = await resolveAudience(segment);
  const category = resolveCategory(template.category);
  const history: HistoryRow[] = [];
  const result: DispatchResult = { targetUsers: audience.length, sent: 0, failed: 0, skipped: 0 };

  // Push is batched across the whole audience rather than per-user, so collect tokens first.
  const pushQueue: Array<{ user: AudienceUser; title: string; body: string }> = [];

  for (const user of audience) {
    const title = renderTemplate(template.title || template.name || '', user);
    const body = renderTemplate(template.body || '', user);

    for (const channel of channels) {
      const row = {
        userId: String(user._id),
        userName: user.name,
        templateName: template.name,
        title,
        body,
        category,
        campaignId: campaignObjectId,
        sentAt: new Date(),
      };

      if (!DELIVERABLE_CHANNELS.has(channel)) {
        history.push({
          ...row,
          channel: channel as HistoryRow['channel'],
          status: 'skipped',
          failureReason: `No ${channel} provider is configured in this service`,
        });
        result.skipped++;
        continue;
      }

      if (!prefersChannel(user, channel)) {
        history.push({
          ...row,
          channel: channel as HistoryRow['channel'],
          status: 'skipped',
          failureReason: 'Recipient opted out of this channel',
        });
        result.skipped++;
        continue;
      }

      try {
        if (channel === 'in-app') {
          await Notification.create({
            userId: user._id,
            title,
            body,
            category,
            data: { campaignId: String(campaignObjectId), ...(template.deepLink ? { deepLink: template.deepLink } : {}) },
            deliveryStatus: 'delivered',
            channelsAttempted: ['in-app'],
            channelsDelivered: ['in-app'],
          });
          history.push({ ...row, channel: 'in-app', status: 'sent' });
          result.sent++;
        } else if (channel === 'email') {
          if (!user.email) {
            history.push({ ...row, channel: 'email', status: 'skipped', failureReason: 'No email address on file' });
            result.skipped++;
            continue;
          }
          const outcome = await sendTransactionalEmail({ to: user.email, subject: title, text: body });
          if (outcome.sent) {
            history.push({ ...row, channel: 'email', status: 'sent' });
            result.sent++;
          } else {
            history.push({
              ...row,
              channel: 'email',
              status: 'failed',
              failureReason: outcome.userMessage || 'Email provider rejected the message',
            });
            result.failed++;
          }
        } else if (channel === 'push') {
          pushQueue.push({ user, title, body });
        }
      } catch (err) {
        history.push({
          ...row,
          channel: channel as HistoryRow['channel'],
          status: 'failed',
          failureReason: (err as Error).message,
        });
        result.failed++;
      }
    }
  }

  if (pushQueue.length > 0) {
    await dispatchPushQueue(pushQueue, template, campaignObjectId, category, history, result);
  }

  if (history.length > 0) {
    // History is best-effort reporting; a write failure must not lose the fact that we sent.
    await NotificationHistory.insertMany(history, { ordered: false }).catch((err) => {
      logger.warn('[NotificationCampaign] history write failed', { error: (err as Error).message });
    });
  }

  return result;
}

/** Resolve tokens per recipient and multicast in FCM-sized batches. */
async function dispatchPushQueue(
  queue: Array<{ user: AudienceUser; title: string; body: string }>,
  template: INotificationTemplate,
  campaignId: mongoose.Types.ObjectId,
  category: string,
  history: HistoryRow[],
  result: DispatchResult,
): Promise<void> {
  const userIds = queue.map((q) => q.user._id);
  const tokens = await PushToken.find({ userId: { $in: userIds }, active: true }, 'userId token').lean();

  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens) {
    const key = String(t.userId);
    const list = tokensByUser.get(key) ?? [];
    list.push(t.token);
    tokensByUser.set(key, list);
  }

  // One flat token list, but remember which user each token belongs to so per-user history is accurate.
  const flat: Array<{ userId: string; token: string; entry: (typeof queue)[number] }> = [];
  for (const entry of queue) {
    const key = String(entry.user._id);
    const userTokens = tokensByUser.get(key);
    if (!userTokens?.length) {
      history.push({
        userId: key,
        userName: entry.user.name,
        templateName: template.name,
        title: entry.title,
        body: entry.body,
        category,
        channel: 'push',
        status: 'skipped',
        failureReason: 'No active push token registered',
        campaignId,
        sentAt: new Date(),
      });
      result.skipped++;
      continue;
    }
    for (const token of userTokens) flat.push({ userId: key, token, entry });
  }

  for (let i = 0; i < flat.length; i += FCM_BATCH_SIZE) {
    const batch = flat.slice(i, i + FCM_BATCH_SIZE);
    // A multicast returns only a success count, so per-token attribution isn't available;
    // treat the batch uniformly and record the batch-level outcome per recipient.
    let successCount = 0;
    let batchError: string | null = null;
    try {
      successCount = await sendToTokens(
        batch.map((b) => b.token),
        {
          title: batch[0]!.entry.title,
          body: batch[0]!.entry.body,
          ...(template.imageUrl ? { imageUrl: template.imageUrl } : {}),
          data: { campaignId: String(campaignId), ...(template.deepLink ? { deepLink: template.deepLink } : {}) },
        },
      );
    } catch (err) {
      batchError = (err as Error).message;
    }

    const delivered = batchError ? 0 : successCount;
    batch.forEach((item, idx) => {
      const ok = idx < delivered;
      history.push({
        userId: item.userId,
        userName: item.entry.user.name,
        templateName: template.name,
        title: item.entry.title,
        body: item.entry.body,
        category,
        channel: 'push',
        status: ok ? 'sent' : 'failed',
        ...(ok ? {} : { failureReason: batchError || 'FCM did not accept this token' }),
        campaignId,
        sentAt: new Date(),
      });
      if (ok) result.sent++;
      else result.failed++;
    });
  }
}

/**
 * Run a campaign in the background and reconcile its status.
 *
 * Dispatch can take a long time for a large audience, so the HTTP request that created the
 * campaign must not wait for it. Errors are captured onto the campaign record so the dashboard
 * can show a failed campaign instead of one stuck at "active" forever.
 */
export function dispatchCampaignInBackground(
  campaignId: mongoose.Types.ObjectId | string,
  template: INotificationTemplate,
  segment: string,
  channels: string[],
): void {
  setImmediate(() => {
    void (async () => {
      try {
        const result = await dispatchCampaign(campaignId, template, segment, channels);
        await NotificationCampaign.updateOne(
          { _id: campaignId },
          {
            $set: {
              status: 'completed',
              completedAt: new Date(),
              targetUsers: result.targetUsers,
              sentCount: result.sent,
            },
          },
        );
        logger.info('[NotificationCampaign] dispatch complete', { campaignId: String(campaignId), ...result });
      } catch (err) {
        await NotificationCampaign.updateOne({ _id: campaignId }, { $set: { status: 'paused' } }).catch(() => {});
        logger.error('[NotificationCampaign] dispatch failed', {
          campaignId: String(campaignId),
          error: (err as Error).message,
        });
      }
    })();
  });
}

/** Re-send a single previously failed/skipped history row. */
export async function resendHistoryRow(historyId: string): Promise<boolean> {
  const row = await NotificationHistory.findById(historyId).lean();
  if (!row) throw AppError.notFound('Notification history entry', historyId);
  if (!row.channel || !DELIVERABLE_CHANNELS.has(row.channel)) {
    throw new AppError(
      `Cannot retry a ${row.channel || 'unknown'} notification — no provider is configured for that channel.`,
      422,
      'CHANNEL_NOT_DELIVERABLE',
    );
  }
  if (!row.userId || !mongoose.isValidObjectId(row.userId)) {
    throw new AppError('History entry has no valid recipient to retry', 422, 'RETRY_NO_RECIPIENT');
  }

  const user = await CustomerUser.findById(row.userId, 'name email phoneNumber notificationPreferences').lean<
    AudienceUser | null
  >();
  if (!user) throw AppError.notFound('Customer', String(row.userId));

  const title = row.title || '';
  const body = row.body || '';
  let sent = false;
  let failureReason: string | undefined;

  try {
    if (row.channel === 'in-app') {
      await Notification.create({
        userId: user._id,
        title,
        body,
        category: resolveCategory(row.category ?? undefined),
        deliveryStatus: 'delivered',
        channelsAttempted: ['in-app'],
        channelsDelivered: ['in-app'],
      });
      sent = true;
    } else if (row.channel === 'email') {
      if (!user.email) failureReason = 'No email address on file';
      else {
        const outcome = await sendTransactionalEmail({ to: user.email, subject: title, text: body });
        sent = outcome.sent;
        failureReason = outcome.sent ? undefined : outcome.userMessage || 'Email provider rejected the message';
      }
    } else if (row.channel === 'push') {
      const tokens = await PushToken.find({ userId: user._id, active: true }, 'token').lean();
      if (!tokens.length) failureReason = 'No active push token registered';
      else {
        const count = await sendToTokens(
          tokens.map((t) => t.token),
          { title, body },
        );
        sent = count > 0;
        failureReason = sent ? undefined : 'FCM did not accept any token';
      }
    }
  } catch (err) {
    failureReason = (err as Error).message;
  }

  await NotificationHistory.updateOne(
    { _id: historyId },
    {
      $set: {
        status: sent ? 'sent' : 'failed',
        sentAt: new Date(),
        failureReason: failureReason ?? '',
      },
      $inc: { retryCount: 1 },
    },
  );

  return sent;
}

/** Re-send a batch of failed rows, optionally scoped to one campaign. */
export async function resendFailedBatch(opts: { campaignId?: string | null; limit?: number }): Promise<{
  attempted: number;
  sent: number;
  failed: number;
}> {
  const limit = Math.min(Math.max(1, Number(opts.limit) || 100), 500);
  const query: Record<string, unknown> = { status: { $in: ['failed', 'bounced'] } };
  if (opts.campaignId) {
    if (!mongoose.isValidObjectId(opts.campaignId)) {
      throw new AppError('Invalid campaignId', 400, 'INVALID_CAMPAIGN_ID');
    }
    query.campaignId = new mongoose.Types.ObjectId(opts.campaignId);
  }

  const rows = await NotificationHistory.find(query, '_id').sort({ sentAt: -1 }).limit(limit).lean();
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      if (await resendHistoryRow(String(row._id))) sent++;
      else failed++;
    } catch {
      // Non-retryable rows (unsupported channel, deleted customer) count as failures.
      failed++;
    }
  }
  return { attempted: rows.length, sent, failed };
}
