import mongoose, { Document, Schema } from 'mongoose';

export interface IFeatureFlag extends Document {
  name: string;
  key: string;
  description: string;
  isEnabled: boolean;
  category: 'core' | 'experimental' | 'beta' | 'premium';
  requiresRestart: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>(
  {
    name: { type: String, required: true },
    key: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    isEnabled: { type: Boolean, default: false },
    category: { type: String, enum: ['core', 'experimental', 'beta', 'premium'], default: 'core' },
    requiresRestart: { type: Boolean, default: false },
  },
  { timestamps: true },
);

FeatureFlagSchema.index({ key: 1 }, { unique: true });

export const FeatureFlag =
  (mongoose.models.FeatureFlag as mongoose.Model<IFeatureFlag>) ||
  mongoose.model<IFeatureFlag>('FeatureFlag', FeatureFlagSchema);
