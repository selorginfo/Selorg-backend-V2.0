import mongoose, { Document, Schema, Types } from 'mongoose';
import crypto from 'crypto';

/**
 * General-purpose API key management (System Config screen) — distinct from
 * `IntegrationApiKey` (integration.model.ts), which is scoped to a single Integration.
 * Registered as mongoose model `'ApiKey'`, matching legacy `admin/models/ApiKey.js`.
 */
export interface ISystemApiKey extends Document {
  keyId: string;
  name: string;
  keyHash: string;
  createdBy?: Types.ObjectId;
  scopes: string[];
  status: 'active' | 'revoked';
  lastUsed?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SystemApiKeySchema = new Schema<ISystemApiKey>(
  {
    keyId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    keyHash: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    scopes: [{ type: String }],
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    lastUsed: { type: Date },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

SystemApiKeySchema.index({ keyId: 1 }, { unique: true });
SystemApiKeySchema.index({ status: 1 });

export function generateSystemApiKey(): { plain: string; keyId: string; keyHash: string } {
  const plain = `sk_${crypto.randomBytes(32).toString('hex')}`;
  const keyId = `${plain.slice(0, 12)}...${plain.slice(-4)}`;
  const keyHash = crypto.createHash('sha256').update(plain).digest('hex');
  return { plain, keyId, keyHash };
}

export const SystemApiKey =
  (mongoose.models.ApiKey as mongoose.Model<ISystemApiKey>) ||
  mongoose.model<ISystemApiKey>('ApiKey', SystemApiKeySchema);
