import mongoose, { Document, Schema } from 'mongoose';
import { CATEGORY_LIST, NotificationCategory } from './notifications.constants';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  read: boolean;
  category: NotificationCategory;
  data: Record<string, unknown>;
  dedupeKey: string | null;
  suppressed: boolean;
  deliveryStatus: 'pending' | 'partial' | 'delivered' | 'failed' | 'skipped';
  retryCount: number;
  failureReason: string | null;
  channelsAttempted: string[];
  channelsDelivered: string[];
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'CustomerUser', required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    read: { type: Boolean, default: false },
    category: { type: String, enum: CATEGORY_LIST, default: 'system', index: true },
    data: { type: Schema.Types.Mixed, default: {} },
    dedupeKey: { type: String, default: null },
    suppressed: { type: Boolean, default: false },
    deliveryStatus: { type: String, enum: ['pending', 'partial', 'delivered', 'failed', 'skipped'], default: 'pending' },
    retryCount: { type: Number, default: 0 },
    failureReason: { type: String, default: null },
    channelsAttempted: [{ type: String }],
    channelsDelivered: [{ type: String }],
  },
  { timestamps: true },
);
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, suppressed: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });

export const Notification =
  (mongoose.models.CustomerNotification as mongoose.Model<INotification>) ||
  mongoose.model<INotification>('CustomerNotification', notificationSchema, 'customer_notifications');

export interface IPushToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: 'ios' | 'android' | 'web';
  tokenType?: 'expo' | 'fcm';
  active: boolean;
  webSubscription?: { endpoint?: string; expirationTime: number | null; keys?: { p256dh?: string; auth?: string } };
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const pushTokenSchema = new Schema<IPushToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'CustomerUser', required: true },
    token: { type: String, required: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], default: 'android' },
    tokenType: { type: String, enum: ['expo', 'fcm'], default: undefined },
    active: { type: Boolean, default: true },
    webSubscription: {
      endpoint: { type: String },
      expirationTime: { type: Number, default: null },
      keys: { p256dh: { type: String }, auth: { type: String } },
    },
    userAgent: { type: String, default: null },
  },
  { timestamps: true },
);
pushTokenSchema.index({ userId: 1, token: 1 }, { unique: true });
pushTokenSchema.index({ userId: 1, active: 1 });
pushTokenSchema.index({ platform: 1, active: 1 });
pushTokenSchema.index({ tokenType: 1, active: 1 });

export const PushToken =
  (mongoose.models.CustomerPushToken as mongoose.Model<IPushToken>) ||
  mongoose.model<IPushToken>('CustomerPushToken', pushTokenSchema, 'customer_push_tokens');
