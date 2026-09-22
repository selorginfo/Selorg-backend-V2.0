import mongoose, { Schema, Document, Types } from 'mongoose';
import crypto from 'crypto';

export interface IIntegration extends Document {
  name: string;
  service: string;
  apiKey: string;
  isActive: boolean;
  endpoint?: string;
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationSchema = new Schema<IIntegration>(
  {
    name: { type: String, required: true },
    service: { type: String, required: true },
    apiKey: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    endpoint: { type: String },
    lastSync: { type: Date },
  },
  { timestamps: true },
);

export const Integration =
  (mongoose.models.Integration as mongoose.Model<IIntegration>) || mongoose.model<IIntegration>('Integration', IntegrationSchema);

export interface IIntegrationWebhook extends Document {
  integrationId: Types.ObjectId;
  event: string;
  url: string;
  method: 'POST' | 'GET' | 'PUT';
  status: 'active' | 'inactive' | 'failed';
  headers: Map<string, string>;
  lastTriggered?: Date;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  retryPolicy: string;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationWebhookSchema = new Schema<IIntegrationWebhook>(
  {
    integrationId: { type: Schema.Types.ObjectId, ref: 'Integration', required: true },
    event: { type: String, required: true },
    url: { type: String, required: true },
    method: { type: String, enum: ['POST', 'GET', 'PUT'], default: 'POST' },
    status: { type: String, enum: ['active', 'inactive', 'failed'], default: 'active' },
    headers: { type: Map, of: String, default: {} },
    lastTriggered: { type: Date },
    totalCalls: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    retryPolicy: { type: String, default: '3 retries with exponential backoff' },
  },
  { timestamps: true },
);
IntegrationWebhookSchema.index({ integrationId: 1 });
IntegrationWebhookSchema.index({ event: 1 });

export const IntegrationWebhook =
  (mongoose.models.IntegrationWebhook as mongoose.Model<IIntegrationWebhook>) ||
  mongoose.model<IIntegrationWebhook>('IntegrationWebhook', IntegrationWebhookSchema);

export interface IIntegrationApiKey extends Document {
  integrationId: Types.ObjectId;
  name: string;
  keyPrefix?: string;
  keyHash: string;
  environment: 'production' | 'sandbox';
  status: 'active' | 'expired' | 'revoked';
  permissions: string[];
  lastUsed?: Date;
  expiresAt?: Date;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationApiKeySchema = new Schema<IIntegrationApiKey>(
  {
    integrationId: { type: Schema.Types.ObjectId, ref: 'Integration', required: true },
    name: { type: String, required: true },
    keyPrefix: { type: String },
    keyHash: { type: String, required: true },
    environment: { type: String, enum: ['production', 'sandbox'], default: 'production' },
    status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active' },
    permissions: [{ type: String }],
    lastUsed: { type: Date },
    expiresAt: { type: Date },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
IntegrationApiKeySchema.index({ integrationId: 1 });
IntegrationApiKeySchema.index({ status: 1 });

export const IntegrationApiKey =
  (mongoose.models.IntegrationApiKey as mongoose.Model<IIntegrationApiKey>) ||
  mongoose.model<IIntegrationApiKey>('IntegrationApiKey', IntegrationApiKeySchema);

export function generateIntegrationApiKey(): { plain: string; keyPrefix: string; keyHash: string } {
  const plain = `sk_${crypto.randomBytes(24).toString('hex')}`;
  const keyPrefix = `${plain.slice(0, 12)}••••••••`;
  const keyHash = crypto.createHash('sha256').update(plain).digest('hex');
  return { plain, keyPrefix, keyHash };
}

export interface IIntegrationLog extends Document {
  integrationId: Types.ObjectId;
  method: string;
  endpoint: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationLogSchema = new Schema<IIntegrationLog>(
  {
    integrationId: { type: Schema.Types.ObjectId, ref: 'Integration', required: true },
    method: { type: String, required: true },
    endpoint: { type: String, required: true },
    statusCode: { type: Number, required: true },
    responseTime: { type: Number, default: 0 },
    requestSize: { type: Number, default: 0 },
    responseSize: { type: Number, default: 0 },
    success: { type: Boolean, default: true },
    errorMessage: { type: String },
  },
  { timestamps: true },
);
IntegrationLogSchema.index({ integrationId: 1 });
IntegrationLogSchema.index({ createdAt: -1 });
IntegrationLogSchema.index({ success: 1 });

export const IntegrationLog =
  (mongoose.models.IntegrationLog as mongoose.Model<IIntegrationLog>) ||
  mongoose.model<IIntegrationLog>('IntegrationLog', IntegrationLogSchema);
