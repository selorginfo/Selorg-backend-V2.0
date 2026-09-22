import mongoose, { Document, Schema } from 'mongoose';

export type PlatformConfigValueType = 'string' | 'number' | 'boolean' | 'json';

export interface IPlatformConfig extends Document {
  key: string;
  value: unknown;
  valueType: PlatformConfigValueType;
  description: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const platformConfigSchema = new Schema<IPlatformConfig>(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 256 },
    value: { type: Schema.Types.Mixed, required: true },
    valueType: { type: String, enum: ['string', 'number', 'boolean', 'json'], default: 'string' },
    description: { type: String, default: '', maxlength: 2000 },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true, collection: 'platform_configs' },
);

platformConfigSchema.index({ key: 1 }, { unique: true });

export const PlatformConfig =
  (mongoose.models.PlatformConfig as mongoose.Model<IPlatformConfig>) ||
  mongoose.model<IPlatformConfig>('PlatformConfig', platformConfigSchema);
