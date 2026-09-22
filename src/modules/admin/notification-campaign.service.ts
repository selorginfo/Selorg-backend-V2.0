import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import {
  NotificationTemplate,
  INotificationTemplate,
  NotificationCampaign,
  NotificationScheduled,
  NotificationAutomation,
  INotificationAutomation,
  NotificationHistory,
} from './notification-campaign.model';
import {
  dispatchCampaignInBackground,
  resendFailedBatch,
  resendHistoryRow,
} from './notification-campaign.dispatch';

/** Extract `{{variable}}` placeholders from a template body. */
export function extractVariables(body?: string): string[] {
  if (!body || typeof body !== 'string') return [];
  const matches = body.match(/\{\{([^}]+)\}\}/g);
  return matches ? [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))] : [];
}

function toTemplate(t: INotificationTemplate) {
  const o = t.toJSON() as Record<string, unknown>;
  return { ...o, variables: t.variables?.length ? t.variables : extractVariables(t.body), lastUsed: t.lastUsed || null };
}

// --- Templates ---------------------------------------------------------------------------

export async function listTemplates() {
  const templates = await NotificationTemplate.find().sort({ createdAt: -1 });
  return templates.map(toTemplate);
}

export interface CreateTemplatePayload {
  name?: string;
  title?: string;
  body?: string;
  category?: string;
  channels?: string[];
  variables?: string[];
  imageUrl?: string;
  deepLink?: string;
  priority?: string;
  status?: string;
}

export async function createTemplate(payload: CreateTemplatePayload) {
  const vars = payload.variables?.length ? payload.variables : extractVariables(payload.body);
  const template = await NotificationTemplate.create({
    name: payload.name || 'New Template',
    title: payload.title || '',
    body: payload.body || '',
    category: payload.category || 'promotional',
    channels: Array.isArray(payload.channels) && payload.channels.length ? payload.channels : ['push'],
    variables: vars,
    imageUrl: payload.imageUrl,
    deepLink: payload.deepLink,
    priority: payload.priority || 'medium',
    status: payload.status || 'active',
  });
  return toTemplate(template);
}

export async function updateTemplate(id: string, patch: Record<string, unknown>) {
  const template = await NotificationTemplate.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true });
  if (!template) return null;
  return toTemplate(template);
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const result = await NotificationTemplate.findByIdAndDelete(id);
  return !!result;
}

// --- Campaigns ---------------------------------------------------------------------------

function toCampaign(c: Record<string, unknown> & { templateId?: unknown; templateName?: string; _id?: unknown }) {
  const templateRef = c.templateId as { _id?: unknown; toString?: () => string; name?: string } | undefined;
  return {
    ...c,
    id: (c._id as { toString(): string }).toString(),
    _id: undefined,
    templateId: templateRef?._id?.toString?.() || templateRef?.toString?.() || templateRef,
    templateName: c.templateName || templateRef?.name || 'N/A',
  };
}

export async function listCampaigns() {
  const campaigns = await NotificationCampaign.find().populate('templateId', 'name').sort({ createdAt: -1 }).lean();
  return campaigns.map(toCampaign);
}

export async function getCampaignById(id: string) {
  const campaign = await NotificationCampaign.findById(id).populate('templateId', 'name').lean();
  if (!campaign) return null;
  return toCampaign(campaign);
}

export interface CreateCampaignPayload {
  name: string;
  templateId: string;
  templateName?: string;
  segment?: string;
  channels?: string[];
  scheduleType?: string;
  scheduledAt?: string;
}

export async function createCampaign(payload: CreateCampaignPayload, createdBy: string) {
  const template = await NotificationTemplate.findById(payload.templateId);
  if (!template) throw AppError.notFound('Template', payload.templateId);

  const isImmediate = payload.scheduleType === 'immediate' || !payload.scheduleType;
  if (!isImmediate && !payload.scheduledAt) {
    throw AppError.badRequest('Schedule date and time is required for scheduled campaigns');
  }

  const campaignChannels =
    Array.isArray(payload.channels) && payload.channels.length > 0
      ? payload.channels
      : template.channels?.length > 0
        ? template.channels
        : ['push'];

  const campaign = await NotificationCampaign.create({
    name: payload.name.trim(),
    templateId: payload.templateId,
    templateName: payload.templateName || template.name,
    segment: payload.segment || 'all',
    channels: campaignChannels,
    status: isImmediate ? 'active' : 'scheduled',
    scheduledAt: isImmediate ? undefined : payload.scheduledAt ? new Date(payload.scheduledAt) : undefined,
    startedAt: isImmediate ? new Date() : undefined,
    createdBy,
  });

  if (!isImmediate && payload.scheduledAt) {
    await NotificationScheduled.create({
      campaignId: campaign._id,
      campaignName: campaign.name,
      templateName: campaign.templateName,
      scheduledAt: new Date(payload.scheduledAt),
      targetUsers: 0,
      channels: campaign.channels,
      status: 'pending',
      createdBy,
    });
  } else if (isImmediate) {
    // Fan out in the background: a large audience takes far longer than an HTTP request should.
    // The campaign stays `active` until dispatch reconciles it to `completed` (or `paused` on
    // failure), so the dashboard reflects real progress instead of a permanently "active" record.
    dispatchCampaignInBackground(campaign._id, template, campaign.segment, campaign.channels);
  }

  return campaign.toJSON();
}

export async function updateCampaignStatus(id: string, status: string): Promise<boolean> {
  const campaign = await NotificationCampaign.findByIdAndUpdate(id, { $set: { status } }, { new: true });
  return !!campaign;
}

// --- Scheduled -----------------------------------------------------------------------------

export async function listScheduled() {
  const scheduled = await NotificationScheduled.find({ status: { $in: ['pending', 'processing'] } }).sort({ scheduledAt: 1 }).lean();
  return scheduled.map((s) => ({ ...s, id: s._id.toString(), _id: undefined, campaignId: s.campaignId?.toString() }));
}

// --- Automation ------------------------------------------------------------------------------

function toAutomation(r: Record<string, unknown> & { templateId?: unknown; templateName?: string; _id?: unknown }) {
  const templateRef = r.templateId as { _id?: unknown; toString?: () => string; name?: string } | undefined;
  return {
    ...r,
    id: (r._id as { toString(): string }).toString(),
    _id: undefined,
    templateId: templateRef?._id?.toString?.() || templateRef?.toString?.(),
    templateName: r.templateName || templateRef?.name || 'N/A',
  };
}

export async function listAutomation() {
  const rules = await NotificationAutomation.find().populate('templateId', 'name').sort({ createdAt: -1 }).lean();
  return rules.map(toAutomation);
}

export interface CreateAutomationPayload {
  name: string;
  trigger?: string;
  templateId: string;
  delay?: number | string;
  channels: string[];
  conditions?: string;
  status?: string;
}

export async function createAutomation(payload: CreateAutomationPayload) {
  const template = await NotificationTemplate.findById(payload.templateId);
  if (!template) throw AppError.notFound('Template', payload.templateId);

  const rule = await NotificationAutomation.create({
    name: payload.name || 'New Rule',
    trigger: payload.trigger || 'order_placed',
    templateId: payload.templateId,
    templateName: template.name,
    delay: typeof payload.delay === 'number' ? payload.delay : parseInt(String(payload.delay), 10) || 0,
    channels: payload.channels,
    conditions: payload.conditions,
    status: payload.status || 'active',
  });
  return rule.toJSON();
}

export interface UpdateAutomationPayload {
  status?: string;
  name?: string;
  trigger?: string;
  templateId?: string;
  delay?: number | string;
  channels?: string[];
  conditions?: string;
}

export async function updateAutomation(id: string, payload: UpdateAutomationPayload): Promise<{ statusOnly: true } | { statusOnly: false; data: ReturnType<typeof toAutomation> } | null> {
  const rule = await NotificationAutomation.findById(id);
  if (!rule) return null;

  const isFullUpdate =
    payload.name !== undefined ||
    payload.trigger !== undefined ||
    payload.templateId !== undefined ||
    payload.delay !== undefined ||
    payload.channels !== undefined ||
    payload.conditions !== undefined;

  if (!isFullUpdate) {
    if (payload.status === undefined) throw AppError.badRequest('No fields to update');
    rule.status = payload.status as INotificationAutomation['status'];
    await rule.save();
    return { statusOnly: true };
  }

  if (payload.name !== undefined) {
    if (!payload.name.trim()) throw AppError.badRequest('Rule name is required');
    rule.name = payload.name.trim();
  }
  if (payload.trigger !== undefined) rule.trigger = payload.trigger;
  if (payload.templateId !== undefined) {
    const template = await NotificationTemplate.findById(payload.templateId);
    if (!template) throw AppError.notFound('Template', payload.templateId);
    rule.templateId = template._id as typeof rule.templateId;
    rule.templateName = template.name;
  }
  if (payload.delay !== undefined) {
    rule.delay = typeof payload.delay === 'number' ? payload.delay : parseInt(String(payload.delay), 10) || 0;
  }
  if (payload.channels !== undefined) {
    if (!Array.isArray(payload.channels) || payload.channels.length === 0) {
      throw AppError.badRequest('At least one channel is required');
    }
    rule.channels = payload.channels;
  }
  if (payload.conditions !== undefined) rule.conditions = payload.conditions;
  if (payload.status !== undefined) rule.status = payload.status as INotificationAutomation['status'];

  await rule.save();

  const populated = await NotificationAutomation.findById(rule._id).populate('templateId', 'name').lean();
  return { statusOnly: false, data: toAutomation(populated as never) };
}

// --- Analytics ---------------------------------------------------------------------------

export async function getAnalytics() {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const history = await NotificationHistory.find({ sentAt: { $gte: last24h } }).lean();
  const totalSent = history.length;
  const totalDelivered = history.filter((h) => ['delivered', 'opened', 'clicked'].includes(h.status)).length;
  const totalOpened = history.filter((h) => ['opened', 'clicked'].includes(h.status)).length;
  const totalClicked = history.filter((h) => h.status === 'clicked').length;
  const failedCount = history.filter((h) => h.status === 'failed' || h.status === 'bounced').length;
  return {
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 1000) / 10 : 0,
    openRate: totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 1000) / 10 : 0,
    clickRate: totalDelivered > 0 ? Math.round((totalClicked / totalDelivered) * 1000) / 10 : 0,
    avgDeliveryTime: 2.3,
    failedCount,
    bounceRate: totalSent > 0 ? Math.round((failedCount / totalSent) * 1000) / 10 : 0,
  };
}

// --- History -------------------------------------------------------------------------------

export interface ListHistoryFilter {
  status?: string;
  channel?: string;
  campaignId?: string;
}

export async function listHistory(filter: ListHistoryFilter) {
  const query: Record<string, string> = {};
  if (filter.status) query.status = filter.status;
  if (filter.channel) query.channel = filter.channel;
  if (filter.campaignId) query.campaignId = filter.campaignId;
  const history = await NotificationHistory.find(query).sort({ sentAt: -1 }).limit(500).lean();
  return history.map((h) => ({ ...h, id: h._id.toString(), _id: undefined }));
}

export async function retryHistory(id: string): Promise<{ sent: boolean }> {
  return { sent: await resendHistoryRow(id) };
}

export async function retryFailedBatch(opts: { campaignId?: string | null; limit?: number }): Promise<{
  attempted: number;
  sent: number;
  failed: number;
}> {
  return resendFailedBatch(opts);
}

// --- Channel performance -------------------------------------------------------------------

export async function getChannels() {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const history = await NotificationHistory.find({ sentAt: { $gte: last24h } }).lean();
  const channels = ['push', 'sms', 'email', 'whatsapp', 'in-app'];
  return channels.map((ch) => {
    const byCh = history.filter((h) => h.channel === ch);
    const sent = byCh.length;
    const delivered = byCh.filter((h) => ['sent', 'delivered', 'opened', 'clicked'].includes(h.status)).length;
    const opened = byCh.filter((h) => ['opened', 'clicked'].includes(h.status)).length;
    const clicked = byCh.filter((h) => h.status === 'clicked').length;
    return {
      channel: ch,
      sent,
      delivered,
      opened,
      clicked,
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0,
      openRate: delivered > 0 ? Math.round((opened / delivered) * 1000) / 10 : 0,
      clickRate: delivered > 0 ? Math.round((clicked / delivered) * 1000) / 10 : 0,
    };
  });
}

// --- Time series -----------------------------------------------------------------------------

export async function getTimeSeries() {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const history = await NotificationHistory.find({ sentAt: { $gte: last24h } }).lean();
  const buckets = new Map<string, { timestamp: string; sent: number; delivered: number; opened: number; clicked: number }>();
  for (let i = 0; i < 24; i++) {
    const d = new Date(last24h);
    d.setHours(d.getHours() + i, 0, 0, 0);
    const key = d.toISOString();
    buckets.set(key, { timestamp: key, sent: 0, delivered: 0, opened: 0, clicked: 0 });
  }
  for (const h of history) {
    const d = new Date(h.sentAt);
    d.setMinutes(0, 0, 0);
    const key = d.toISOString();
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.sent += 1;
    if (['sent', 'delivered', 'opened', 'clicked'].includes(h.status)) bucket.delivered += 1;
    if (['opened', 'clicked'].includes(h.status)) bucket.opened += 1;
    if (h.status === 'clicked') bucket.clicked += 1;
  }
  return [...buckets.values()].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
