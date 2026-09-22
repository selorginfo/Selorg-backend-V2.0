import mongoose, { Document, Schema, Types } from 'mongoose';
import { CATEGORY_LIST } from '../notifications/notifications.constants';

// --- NotificationTemplate ----------------------------------------------------------------

export interface INotificationTemplate extends Document {
  name: string;
  title: string;
  body: string;
  category: 'transactional' | 'promotional' | 'system' | 'order' | 'offers' | 'wallet' | 'welcome';
  channels: string[];
  variables: string[];
  imageUrl?: string;
  deepLink?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'inactive';
  totalSent: number;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationTemplateSchema = new Schema<INotificationTemplate>(
  {
    name: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    category: { type: String, enum: ['transactional', 'promotional', 'system', 'order', 'offers', 'wallet', 'welcome'], default: 'promotional' },
    channels: [{ type: String, enum: ['push', 'sms', 'email', 'whatsapp', 'in-app'] }],
    variables: [{ type: String }],
    imageUrl: { type: String },
    deepLink: { type: String },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    totalSent: { type: Number, default: 0 },
    lastUsed: { type: Date },
  },
  { timestamps: true, collection: 'admin_notification_templates' },
);

NotificationTemplateSchema.index({ status: 1 });
NotificationTemplateSchema.index({ category: 1 });

NotificationTemplateSchema.set('toJSON', {
  transform(_doc, ret: Record<string, unknown>) {
    ret.id = (ret._id as { toString(): string }).toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const NotificationTemplate =
  (mongoose.models.NotificationTemplate as mongoose.Model<INotificationTemplate>) ||
  mongoose.model<INotificationTemplate>('NotificationTemplate', NotificationTemplateSchema);

// --- NotificationCampaign ----------------------------------------------------------------

export interface INotificationCampaign extends Document {
  name: string;
  templateId: Types.ObjectId;
  templateName?: string;
  segment: 'all' | 'vip' | 'new' | 'inactive' | 'custom';
  customSegmentQuery?: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
  channels: string[];
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  targetUsers: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationCampaignSchema = new Schema<INotificationCampaign>(
  {
    name: { type: String, required: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'NotificationTemplate', required: true },
    templateName: { type: String },
    segment: { type: String, enum: ['all', 'vip', 'new', 'inactive', 'custom'], default: 'all' },
    customSegmentQuery: { type: String },
    status: { type: String, enum: ['draft', 'scheduled', 'active', 'paused', 'completed'], default: 'draft' },
    channels: [{ type: String, enum: ['push', 'sms', 'email', 'whatsapp', 'in-app'] }],
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    targetUsers: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    openedCount: { type: Number, default: 0 },
    clickedCount: { type: Number, default: 0 },
    deliveryRate: { type: Number, default: 0 },
    openRate: { type: Number, default: 0 },
    clickRate: { type: Number, default: 0 },
    createdBy: { type: String },
  },
  { timestamps: true, collection: 'admin_notification_campaigns' },
);

NotificationCampaignSchema.index({ status: 1 });
NotificationCampaignSchema.index({ templateId: 1 });
NotificationCampaignSchema.index({ scheduledAt: 1 });

NotificationCampaignSchema.set('toJSON', {
  transform(_doc, ret: Record<string, unknown>) {
    ret.id = (ret._id as { toString(): string }).toString();
    ret.templateId = (ret.templateId as { toString?: () => string } | undefined)?.toString?.() ?? ret.templateId;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const NotificationCampaign =
  (mongoose.models.NotificationCampaign as mongoose.Model<INotificationCampaign>) ||
  mongoose.model<INotificationCampaign>('NotificationCampaign', NotificationCampaignSchema);

// --- NotificationScheduled ----------------------------------------------------------------

export interface INotificationScheduled extends Document {
  campaignId?: Types.ObjectId;
  campaignName?: string;
  templateName?: string;
  scheduledAt: Date;
  targetUsers: number;
  channels: string[];
  recurring?: 'daily' | 'weekly' | 'monthly';
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationScheduledSchema = new Schema<INotificationScheduled>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'NotificationCampaign' },
    campaignName: { type: String },
    templateName: { type: String },
    scheduledAt: { type: Date, required: true },
    targetUsers: { type: Number, default: 0 },
    channels: [{ type: String, enum: ['push', 'sms', 'email', 'whatsapp', 'in-app'] }],
    recurring: { type: String, enum: ['daily', 'weekly', 'monthly'] },
    status: { type: String, enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'], default: 'pending' },
    createdBy: { type: String },
  },
  { timestamps: true, collection: 'admin_notification_scheduled' },
);

NotificationScheduledSchema.index({ status: 1, scheduledAt: 1 });

NotificationScheduledSchema.set('toJSON', {
  transform(_doc, ret: Record<string, unknown>) {
    ret.id = (ret._id as { toString(): string }).toString();
    ret.campaignId = (ret.campaignId as { toString?: () => string } | undefined)?.toString?.() ?? ret.campaignId;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const NotificationScheduled =
  (mongoose.models.NotificationScheduled as mongoose.Model<INotificationScheduled>) ||
  mongoose.model<INotificationScheduled>('NotificationScheduled', NotificationScheduledSchema);

// --- NotificationAutomation ----------------------------------------------------------------

export interface INotificationAutomation extends Document {
  name: string;
  trigger: string;
  templateId: Types.ObjectId;
  templateName?: string;
  delay: number;
  channels: string[];
  conditions?: string;
  status: 'active' | 'inactive';
  totalTriggered: number;
  successRate: number;
  createdAt: Date;
  updatedAt: Date;
}

const AUTOMATION_TRIGGERS = [
  'order_placed', 'order_confirmed', 'order_packed', 'order_on_way', 'order_delivered', 'order_cancelled',
  'payment_success', 'payment_failed', 'wallet_credit', 'wallet_debit', 'refund_initiated', 'refund_completed',
  'support_reply', 'user_signup', 'cart_abandoned', 'system_announcement',
];

const NotificationAutomationSchema = new Schema<INotificationAutomation>(
  {
    name: { type: String, required: true },
    trigger: { type: String, enum: AUTOMATION_TRIGGERS, required: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'NotificationTemplate', required: true },
    templateName: { type: String },
    delay: { type: Number, default: 0 },
    channels: [{ type: String, enum: ['push', 'sms', 'email', 'whatsapp', 'in-app'] }],
    conditions: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    totalTriggered: { type: Number, default: 0 },
    successRate: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'admin_notification_automation' },
);

NotificationAutomationSchema.index({ status: 1 });
NotificationAutomationSchema.index({ trigger: 1 });

NotificationAutomationSchema.set('toJSON', {
  transform(_doc, ret: Record<string, unknown>) {
    ret.id = (ret._id as { toString(): string }).toString();
    ret.templateId = (ret.templateId as { toString?: () => string } | undefined)?.toString?.() ?? ret.templateId;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const NotificationAutomation =
  (mongoose.models.NotificationAutomation as mongoose.Model<INotificationAutomation>) ||
  mongoose.model<INotificationAutomation>('NotificationAutomation', NotificationAutomationSchema);

// --- NotificationHistory ----------------------------------------------------------------

export interface INotificationHistory extends Document {
  userId?: string;
  userName?: string;
  templateName?: string;
  title?: string;
  body?: string;
  category?: string | null;
  channel?: 'push' | 'sms' | 'email' | 'whatsapp' | 'in-app' | 'web-push';
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'bounced' | 'skipped' | 'pending';
  sentAt: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  failureReason?: string;
  retryCount: number;
  notificationId?: Types.ObjectId;
  campaignId?: Types.ObjectId;
  dedupeKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationHistorySchema = new Schema<INotificationHistory>(
  {
    userId: { type: String },
    userName: { type: String },
    templateName: { type: String },
    title: { type: String },
    body: { type: String },
    category: { type: String, enum: [...CATEGORY_LIST, null], default: null },
    channel: { type: String, enum: ['push', 'sms', 'email', 'whatsapp', 'in-app', 'web-push'] },
    status: { type: String, enum: ['sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced', 'skipped', 'pending'], default: 'sent' },
    sentAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date },
    openedAt: { type: Date },
    clickedAt: { type: Date },
    failureReason: { type: String },
    retryCount: { type: Number, default: 0 },
    notificationId: { type: Schema.Types.ObjectId, ref: 'CustomerNotification' },
    campaignId: { type: Schema.Types.ObjectId, ref: 'NotificationCampaign' },
    dedupeKey: { type: String, default: null },
  },
  { timestamps: true, collection: 'admin_notification_history' },
);

NotificationHistorySchema.index({ userId: 1, sentAt: -1 });
NotificationHistorySchema.index({ templateName: 1 });
NotificationHistorySchema.index({ status: 1 });
NotificationHistorySchema.index({ channel: 1 });
NotificationHistorySchema.index({ category: 1 });
NotificationHistorySchema.index({ sentAt: -1 });
NotificationHistorySchema.index({ campaignId: 1, status: 1 });
NotificationHistorySchema.index({ status: 1, retryCount: 1 });

NotificationHistorySchema.set('toJSON', {
  transform(_doc, ret: Record<string, unknown>) {
    ret.id = (ret._id as { toString(): string }).toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const NotificationHistory =
  (mongoose.models.NotificationHistory as mongoose.Model<INotificationHistory>) ||
  mongoose.model<INotificationHistory>('NotificationHistory', NotificationHistorySchema);
