import mongoose, { Document, Schema } from 'mongoose';

// ─── CustomerFeatureFlag ──────────────────────────────────────────────────────

export interface ICustomerFeatureFlag extends Document {
  key: string;
  value: unknown;
  platform: 'ios' | 'android' | 'web' | 'all';
  minAppVersion?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const featureFlagSchema = new Schema<ICustomerFeatureFlag>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, default: true },
    platform: { type: String, enum: ['ios', 'android', 'web', 'all'], default: 'all' },
    minAppVersion: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

featureFlagSchema.index({ key: 1, isActive: 1 });
featureFlagSchema.index({ platform: 1 });

export const CustomerFeatureFlag =
  (mongoose.models.CustomerFeatureFlag as mongoose.Model<ICustomerFeatureFlag>) ||
  mongoose.model<ICustomerFeatureFlag>('CustomerFeatureFlag', featureFlagSchema, 'customer_feature_flags');

// ─── CustomerFlowConfig ───────────────────────────────────────────────────────

export interface ICustomerFlowConfig extends Document {
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const flowConfigSchema = new Schema<ICustomerFlowConfig>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

flowConfigSchema.index({ key: 1 });

export const CustomerFlowConfig =
  (mongoose.models.CustomerFlowConfig as mongoose.Model<ICustomerFlowConfig>) ||
  mongoose.model<ICustomerFlowConfig>('CustomerFlowConfig', flowConfigSchema, 'customer_flow_configs');

// ─── CustomerPromotionRule ────────────────────────────────────────────────────

export interface ICustomerPromotionRule extends Document {
  name: string;
  type: 'percentage' | 'flat' | 'bogo' | 'free_delivery';
  targetType: 'product' | 'collection' | 'cart';
  targetId?: mongoose.Types.ObjectId;
  targetModel?: string;
  discountValue: number;
  minCartValue: number;
  maxDiscountCap?: number;
  autoApply: boolean;
  couponCode?: string;
  schedule?: { startDate?: Date; endDate?: Date };
  usageLimit?: number;
  perUserLimit?: number;
  usageCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const promotionRuleSchema = new Schema<ICustomerPromotionRule>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['percentage', 'flat', 'bogo', 'free_delivery'], default: 'percentage' },
    targetType: { type: String, enum: ['product', 'collection', 'cart'], default: 'cart' },
    targetId: { type: Schema.Types.ObjectId, refPath: 'targetModel', default: null },
    targetModel: { type: String, enum: ['CustomerProduct', 'CustomerCollection', null], default: null },
    discountValue: { type: Number, required: true, min: 0 },
    minCartValue: { type: Number, default: 0 },
    maxDiscountCap: { type: Number, default: null },
    autoApply: { type: Boolean, default: false },
    couponCode: { type: String, default: null, sparse: true },
    schedule: {
      startDate: Date,
      endDate: Date,
    },
    usageLimit: { type: Number, default: null },
    perUserLimit: { type: Number, default: null },
    usageCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

promotionRuleSchema.index({ isActive: 1, 'schedule.startDate': 1, 'schedule.endDate': 1 });
promotionRuleSchema.index({ couponCode: 1 }, { sparse: true });

export const CustomerPromotionRule =
  (mongoose.models.CustomerPromotionRule as mongoose.Model<ICustomerPromotionRule>) ||
  mongoose.model<ICustomerPromotionRule>('CustomerPromotionRule', promotionRuleSchema, 'customer_promotion_rules');
