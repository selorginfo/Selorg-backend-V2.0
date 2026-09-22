import mongoose, { Document, Schema } from 'mongoose';

// ─── Campaign ─────────────────────────────────────────────────────────────────

export interface ICampaign extends Document {
  name: string;
  tagline: string;
  status: 'Active' | 'Pending Review' | 'Scheduled' | 'Paused' | 'Draft' | 'Archived' | 'Stopped' | 'Ended';
  period: string;
  endsAt?: Date;
  target: string;
  scope: string;
  type: string;
  owner: { name: string; initial: string };
  kpi?: { label?: string; value?: string; trend?: 'up' | 'down' | 'neutral' };
  pendingDetails?: { waitingOn?: string; sla?: string };
  rules?: { discountLogic?: string; minOrder?: string; segment?: string; stackable?: boolean };
  skus?: Array<{ sku?: string; name?: string; category?: string; basePrice?: number; promoPrice?: number }>;
  region?: 'na' | 'eu' | 'all';
  channel?: 'online' | 'store' | 'all';
  campaignCategory?: 'promo' | 'clearance';
  performance?: { revenue?: number; uplift?: number; roi?: number; discountDepth?: number; orders?: number };
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    name: { type: String, required: true },
    tagline: { type: String, required: true },
    status: {
      type: String,
      enum: ['Active', 'Pending Review', 'Scheduled', 'Paused', 'Draft', 'Archived', 'Stopped', 'Ended'],
      default: 'Draft',
    },
    period: { type: String, required: true },
    endsAt: { type: Date },
    target: { type: String, required: true },
    scope: { type: String, required: true },
    type: { type: String, required: true },
    owner: {
      name: { type: String, required: true },
      initial: { type: String, required: true },
    },
    kpi: {
      label: String,
      value: String,
      trend: { type: String, enum: ['up', 'down', 'neutral'] },
    },
    pendingDetails: {
      waitingOn: String,
      sla: String,
    },
    rules: {
      discountLogic: { type: String, default: 'Flat 20% Off' },
      minOrder: { type: String, default: '$0.00' },
      segment: { type: String, default: 'All Customers' },
      stackable: { type: Boolean, default: false },
    },
    skus: [
      {
        sku: String,
        name: String,
        category: String,
        basePrice: Number,
        promoPrice: Number,
      },
    ],
    region: { type: String, enum: ['na', 'eu', 'all'], default: 'na' },
    channel: { type: String, enum: ['online', 'store', 'all'], default: 'all' },
    campaignCategory: { type: String, enum: ['promo', 'clearance'], default: 'promo' },
    performance: {
      revenue: Number,
      uplift: Number,
      roi: Number,
      discountDepth: Number,
      orders: Number,
    },
  },
  { timestamps: true },
);

CampaignSchema.index({ status: 1, createdAt: -1 });
CampaignSchema.index({ status: 1, endsAt: 1 });
CampaignSchema.index({ type: 1, status: 1 });

export const Campaign =
  (mongoose.models.Campaign as mongoose.Model<ICampaign>) ||
  mongoose.model<ICampaign>('Campaign', CampaignSchema);

// ─── SKU ──────────────────────────────────────────────────────────────────────

export interface ISKU extends Document {
  code: string;
  name: string;
  category: string;
  brand: string;
  cost?: number;
  basePrice?: number;
  sellingPrice?: number;
  competitorAvg?: number;
  margin?: number;
  marginStatus?: 'healthy' | 'warning' | 'critical';
  marginReviewed?: boolean;
  stock?: number;
  visibility?: Record<string, 'Visible' | 'Hidden'>;
  imageUrl?: string;
  tags?: string[];
  history?: Array<{ date?: string; price?: number; competitor?: number }>;
  createdAt: Date;
  updatedAt: Date;
}

const SKUSchema = new Schema<ISKU>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    brand: { type: String, required: true },
    cost: { type: Number, default: 0 },
    basePrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    competitorAvg: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    marginStatus: { type: String, enum: ['healthy', 'warning', 'critical'], default: 'healthy' },
    marginReviewed: { type: Boolean, default: false },
    stock: { type: Number, default: 0 },
    visibility: {
      type: Schema.Types.Mixed,
      default: { 'North America': 'Hidden', 'Europe (West)': 'Hidden', APAC: 'Hidden' },
    },
    imageUrl: { type: String },
    tags: [{ type: String }],
    history: [{ date: String, price: Number, competitor: Number }],
  },
  { timestamps: true },
);

SKUSchema.index({ code: 1 });
SKUSchema.index({ category: 1, marginStatus: 1 });
SKUSchema.index({ stock: 1 });
SKUSchema.index({ name: 'text', code: 'text' });

export const SKU =
  (mongoose.models.MerchSKU as mongoose.Model<ISKU>) ||
  mongoose.model<ISKU>('MerchSKU', SKUSchema);

// ─── Collection ───────────────────────────────────────────────────────────────

export interface ICollection extends Document {
  name: string;
  description?: string;
  type: 'Seasonal' | 'Thematic' | 'Bundle/Combo' | 'Brand';
  status: 'Live' | 'Draft' | 'Scheduled' | 'Archived';
  tags?: string[];
  skus?: mongoose.Types.ObjectId[];
  imageUrl?: string;
  region?: string;
  owner?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CollectionSchema = new Schema<ICollection>(
  {
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, required: true, enum: ['Seasonal', 'Thematic', 'Bundle/Combo', 'Brand'] },
    status: { type: String, required: true, enum: ['Live', 'Draft', 'Scheduled', 'Archived'], default: 'Draft' },
    tags: [{ type: String }],
    skus: [{ type: Schema.Types.ObjectId, ref: 'MerchSKU' }],
    imageUrl: { type: String },
    region: { type: String, default: 'North America' },
    owner: { type: String, default: 'Sarah J.' },
  },
  { timestamps: true },
);

export const Collection =
  (mongoose.models.MerchCollection as mongoose.Model<ICollection>) ||
  mongoose.model<ICollection>('MerchCollection', CollectionSchema);

// ─── DynamicPrice ─────────────────────────────────────────────────────────────

export interface IDynamicPrice extends Document {
  priceId: string;
  sku: string;
  basePrice: number;
  currentPrice: number;
  priceHistory?: Array<{ price?: number; appliedDate?: Date; reason?: string; ruleApplied?: string }>;
  pricingFactors?: {
    demandLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    inventoryLevel?: number;
    competitorPrice?: number;
    elasticity?: number;
    marginPercentage?: number;
  };
  lastCalculatedAt?: Date;
  nextReviewDate?: Date;
  isOptimized?: boolean;
  optimizationScore?: number;
  regionSpecific?: Array<{ region?: string; adjustedPrice?: number }>;
  customerSegmentPrices?: Array<{ segmentId?: mongoose.Types.ObjectId; segmentName?: string; price?: number }>;
  createdAt: Date;
  updatedAt: Date;
}

const DynamicPriceSchema = new Schema<IDynamicPrice>(
  {
    priceId: { type: String, required: true, unique: true },
    sku: { type: String, required: true },
    basePrice: { type: Number, required: true },
    currentPrice: { type: Number, required: true },
    priceHistory: [{ price: Number, appliedDate: Date, reason: String, ruleApplied: String }],
    pricingFactors: {
      demandLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      inventoryLevel: Number,
      competitorPrice: Number,
      elasticity: Number,
      marginPercentage: Number,
    },
    lastCalculatedAt: Date,
    nextReviewDate: Date,
    isOptimized: { type: Boolean, default: false },
    optimizationScore: Number,
    regionSpecific: [{ region: String, adjustedPrice: Number }],
    customerSegmentPrices: [
      { segmentId: Schema.Types.ObjectId, segmentName: String, price: Number },
    ],
  },
  { timestamps: true, collection: 'dynamic_prices' },
);

DynamicPriceSchema.index({ sku: 1 });
DynamicPriceSchema.index({ priceId: 1 });
DynamicPriceSchema.index({ lastCalculatedAt: -1 });

export const DynamicPrice =
  (mongoose.models.DynamicPrice as mongoose.Model<IDynamicPrice>) ||
  mongoose.model<IDynamicPrice>('DynamicPrice', DynamicPriceSchema, 'dynamic_prices');

// ─── PriceChange ──────────────────────────────────────────────────────────────

export interface IPriceChange extends Document {
  sku: string;
  productName: string;
  category: string;
  currentPrice: number;
  proposedPrice: number;
  marginImpact: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const PriceChangeSchema = new Schema<IPriceChange>(
  {
    sku: { type: String, required: true },
    productName: { type: String, required: true },
    category: { type: String, required: true },
    currentPrice: { type: Number, required: true },
    proposedPrice: { type: Number, required: true },
    marginImpact: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    requestedBy: { type: String, required: true },
  },
  { timestamps: true },
);

PriceChangeSchema.index({ status: 1, createdAt: -1 });
PriceChangeSchema.index({ sku: 1 });

export const PriceChange =
  (mongoose.models.PriceChange as mongoose.Model<IPriceChange>) ||
  mongoose.model<IPriceChange>('PriceChange', PriceChangeSchema);

// ─── PriceRule ────────────────────────────────────────────────────────────────

export interface IPriceRule extends Document {
  name: string;
  description?: string;
  type?: 'base' | 'geo' | 'time' | 'campaign';
  scope?: 'region' | 'zone' | 'store';
  pricingMethod?: 'fixed' | 'cost-plus' | 'competitor';
  marginMin?: number;
  marginMax?: number;
  startDate?: Date;
  endDate?: Date;
  status?: 'active' | 'pending' | 'expired' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const PriceRuleSchema = new Schema<IPriceRule>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['base', 'geo', 'time', 'campaign'], default: 'base' },
    scope: { type: String, enum: ['region', 'zone', 'store'], default: 'region' },
    pricingMethod: { type: String, enum: ['fixed', 'cost-plus', 'competitor'], default: 'fixed' },
    marginMin: Number,
    marginMax: Number,
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ['active', 'pending', 'expired', 'inactive'], default: 'pending' },
  },
  { timestamps: true, collection: 'price_rules' },
);

PriceRuleSchema.index({ status: 1, type: 1 });

export const PriceRule =
  (mongoose.models.PriceRule as mongoose.Model<IPriceRule>) ||
  mongoose.model<IPriceRule>('PriceRule', PriceRuleSchema, 'price_rules');

// ─── SurgeRule ────────────────────────────────────────────────────────────────

export interface ISurgeRule extends Document {
  name: string;
  description?: string;
  type: 'time_based' | 'demand_based' | 'zone_based' | 'event_based';
  multiplier: number;
  conditions?: {
    timeSlots?: Array<{ start?: string; end?: string; days?: string[] }>;
    zones?: mongoose.Types.ObjectId[];
    demandThreshold?: number;
    eventType?: string;
  };
  applicableCategories?: string[];
  applicableProducts?: string[];
  priority?: number;
  status: 'active' | 'inactive' | 'scheduled';
  startDate: Date;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const timeSlotSchema = new Schema({ start: String, end: String, days: [String] }, { _id: false });

const SurgeRuleSchema = new Schema<ISurgeRule>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      required: true,
      enum: ['time_based', 'demand_based', 'zone_based', 'event_based'],
    },
    multiplier: { type: Number, required: true, min: 1, max: 5 },
    conditions: {
      timeSlots: [timeSlotSchema],
      zones: [{ type: Schema.Types.ObjectId, ref: 'Zone' }],
      demandThreshold: Number,
      eventType: String,
    },
    applicableCategories: [String],
    applicableProducts: [String],
    priority: { type: Number, default: 1 },
    status: { type: String, required: true, enum: ['active', 'inactive', 'scheduled'], default: 'active' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
  },
  { timestamps: true, collection: 'surge_rules' },
);

SurgeRuleSchema.index({ status: 1 });
SurgeRuleSchema.index({ type: 1 });
SurgeRuleSchema.index({ startDate: 1, endDate: 1 });

export const SurgeRule =
  (mongoose.models.SurgeRule as mongoose.Model<ISurgeRule>) ||
  mongoose.model<ISurgeRule>('SurgeRule', SurgeRuleSchema, 'surge_rules');

// ─── SurgeConfig ──────────────────────────────────────────────────────────────

export interface ISurgeConfig extends Document {
  key: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SurgeConfigSchema = new Schema<ISurgeConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'surge_config' },
);

export const SurgeConfig =
  (mongoose.models.SurgeConfig as mongoose.Model<ISurgeConfig>) ||
  mongoose.model<ISurgeConfig>('SurgeConfig', SurgeConfigSchema, 'surge_config');

// ─── DiscountCampaign ─────────────────────────────────────────────────────────

export interface IDiscountCampaign extends Document {
  name: string;
  description?: string;
  discountType: 'percentage' | 'flat' | 'buy_x_get_y';
  discountValue: number;
  buyXGetYValue?: number;
  minOrderValue?: number;
  maxDiscount?: number | null;
  applicableCategories?: string[];
  applicableProducts?: string[];
  startDate: Date;
  endDate: Date;
  usageLimit?: number | null;
  usageCount?: number;
  stackable?: boolean;
  status: 'active' | 'scheduled' | 'expired' | 'paused';
  createdAt: Date;
  updatedAt: Date;
}

const DiscountCampaignSchema = new Schema<IDiscountCampaign>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    discountType: { type: String, required: true, enum: ['percentage', 'flat', 'buy_x_get_y'] },
    discountValue: { type: Number, required: true, min: 0 },
    buyXGetYValue: Number,
    minOrderValue: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: null },
    applicableCategories: [String],
    applicableProducts: [String],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    usageLimit: { type: Number, default: null },
    usageCount: { type: Number, default: 0 },
    stackable: { type: Boolean, default: false },
    status: { type: String, required: true, enum: ['active', 'scheduled', 'expired', 'paused'], default: 'active' },
  },
  { timestamps: true, collection: 'discount_campaigns' },
);

DiscountCampaignSchema.index({ status: 1, startDate: 1, endDate: 1 });
DiscountCampaignSchema.index({ applicableCategories: 1 });

export const DiscountCampaign =
  (mongoose.models.DiscountCampaign as mongoose.Model<IDiscountCampaign>) ||
  mongoose.model<IDiscountCampaign>('DiscountCampaign', DiscountCampaignSchema, 'discount_campaigns');

// ─── FlashSale ────────────────────────────────────────────────────────────────

export interface IFlashSale extends Document {
  name: string;
  description?: string;
  products?: Array<{ sku: string; name?: string; originalPrice: number; salePrice: number; discount?: number; stockLimit?: number; soldCount?: number }>;
  startDate: Date;
  endDate: Date;
  status?: 'upcoming' | 'active' | 'ended';
  visibility?: 'public' | 'members_only';
  createdAt: Date;
  updatedAt: Date;
}

const flashSaleProductSchema = new Schema(
  {
    sku: { type: String, required: true },
    name: { type: String, default: '' },
    originalPrice: { type: Number, required: true },
    salePrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    stockLimit: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const FlashSaleSchema = new Schema<IFlashSale>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    products: [flashSaleProductSchema],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['upcoming', 'active', 'ended'], default: 'upcoming' },
    visibility: { type: String, enum: ['public', 'members_only'], default: 'public' },
  },
  { timestamps: true, collection: 'flash_sales' },
);

FlashSaleSchema.index({ status: 1, startDate: 1, endDate: 1 });

export const FlashSale =
  (mongoose.models.FlashSale as mongoose.Model<IFlashSale>) ||
  mongoose.model<IFlashSale>('FlashSale', FlashSaleSchema, 'flash_sales');

// ─── Bundle ───────────────────────────────────────────────────────────────────

export interface IBundle extends Document {
  name: string;
  description?: string;
  products?: Array<{ sku: string; name?: string; quantity: number; price: number }>;
  totalOriginalPrice: number;
  bundlePrice: number;
  savings?: number;
  savingsPercent?: number;
  imageUrl?: string;
  stockLimit?: number | null;
  soldCount?: number;
  status: 'active' | 'inactive';
  featured?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bundleProductSchema = new Schema(
  {
    sku: { type: String, required: true },
    name: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
  },
  { _id: false },
);

const BundleSchema = new Schema<IBundle>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    products: [bundleProductSchema],
    totalOriginalPrice: { type: Number, required: true },
    bundlePrice: { type: Number, required: true },
    savings: { type: Number, default: 0 },
    savingsPercent: { type: Number, default: 0 },
    imageUrl: { type: String, default: '' },
    stockLimit: { type: Number, default: null },
    soldCount: { type: Number, default: 0 },
    status: { type: String, required: true, enum: ['active', 'inactive'], default: 'active' },
    featured: { type: Boolean, default: false },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  { timestamps: true, collection: 'bundles' },
);

BundleSchema.index({ status: 1 });
BundleSchema.index({ featured: 1 });

export const Bundle =
  (mongoose.models.Bundle as mongoose.Model<IBundle>) ||
  mongoose.model<IBundle>('Bundle', BundleSchema, 'bundles');

// ─── MerchAlert ───────────────────────────────────────────────────────────────

export interface IMerchAlert extends Document {
  type: 'Pricing' | 'Stock' | 'Campaign' | 'System';
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  status?: 'New' | 'In Progress' | 'Resolved' | 'Snoozed' | 'Dismissed';
  region?: string;
  resolutionNote?: string;
  linkedEntities?: {
    skus?: string[];
    campaigns?: Array<{ id?: string; name?: string }>;
    store?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MerchAlertSchema = new Schema<IMerchAlert>(
  {
    type: { type: String, enum: ['Pricing', 'Stock', 'Campaign', 'System'], required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    severity: { type: String, enum: ['critical', 'warning', 'info'], required: true },
    status: { type: String, enum: ['New', 'In Progress', 'Resolved', 'Snoozed', 'Dismissed'], default: 'New' },
    region: String,
    resolutionNote: String,
    linkedEntities: {
      skus: [String],
      campaigns: [{ id: String, name: String }],
      store: String,
    },
  },
  { timestamps: true },
);

MerchAlertSchema.index({ status: 1, severity: 1, createdAt: -1 });
MerchAlertSchema.index({ type: 1, status: 1 });
MerchAlertSchema.index({ region: 1 });

export const MerchAlert =
  (mongoose.models.MerchAlert as mongoose.Model<IMerchAlert>) ||
  mongoose.model<IMerchAlert>('MerchAlert', MerchAlertSchema);

// ─── AnalyticsRecord ──────────────────────────────────────────────────────────

export interface IAnalyticsRecord extends Document {
  type?: string;
  entityId?: string;
  entityName?: string;
  metricDate?: string;
  revenue?: number;
  uplift?: number;
  roi?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AnalyticsRecordSchema = new Schema<IAnalyticsRecord>(
  {
    type: String,
    entityId: String,
    entityName: String,
    metricDate: String,
    revenue: Number,
    uplift: Number,
    roi: Number,
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'merch_analytics_records' },
);

AnalyticsRecordSchema.index({ type: 1, metricDate: -1 });
AnalyticsRecordSchema.index({ entityId: 1 });

export const AnalyticsRecord =
  (mongoose.models.AnalyticsRecord as mongoose.Model<IAnalyticsRecord>) ||
  mongoose.model<IAnalyticsRecord>('AnalyticsRecord', AnalyticsRecordSchema, 'merch_analytics_records');

// ─── MerchComplianceCheck ─────────────────────────────────────────────────────

export interface IComplianceCheck extends Document {
  type?: string;
  title?: string;
  description?: string;
  requestedBy?: string;
  status?: 'Pending' | 'Approved' | 'Rejected';
  riskLevel?: string;
  region?: string;
  details?: Record<string, unknown>;
  slaDeadline?: Date;
  comments?: Array<{ user?: string; text?: string; timestamp?: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const ComplianceCheckSchema = new Schema<IComplianceCheck>(
  {
    type: String,
    title: String,
    description: String,
    requestedBy: String,
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    riskLevel: String,
    region: String,
    details: { type: Schema.Types.Mixed },
    slaDeadline: Date,
    comments: [{ user: String, text: String, timestamp: Date }],
  },
  { timestamps: true, collection: 'merch_approval_requests' },
);

ComplianceCheckSchema.index({ status: 1 });
ComplianceCheckSchema.index({ type: 1, status: 1 });

export const MerchComplianceCheck =
  (mongoose.models.MerchComplianceCheck as mongoose.Model<IComplianceCheck>) ||
  mongoose.model<IComplianceCheck>('MerchComplianceCheck', ComplianceCheckSchema, 'merch_approval_requests');

// ─── StockConflict ────────────────────────────────────────────────────────────

export interface IStockConflict extends Document {
  sku: string;
  name: string;
  category: string;
  region: string;
  severity?: 'High' | 'Medium' | 'Low';
  availableStock: number;
  committedStock: number;
  shortfall: number;
  status?: 'Open' | 'Resolved' | 'In Progress';
  createdAt: Date;
  updatedAt: Date;
}

const StockConflictSchema = new Schema<IStockConflict>(
  {
    sku: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    region: { type: String, required: true },
    severity: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    availableStock: { type: Number, required: true },
    committedStock: { type: Number, required: true },
    shortfall: { type: Number, required: true },
    status: { type: String, enum: ['Open', 'Resolved', 'In Progress'], default: 'Open' },
  },
  { timestamps: true },
);

StockConflictSchema.index({ status: 1, severity: 1 });
StockConflictSchema.index({ sku: 1 });
StockConflictSchema.index({ region: 1, status: 1 });

export const StockConflict =
  (mongoose.models.StockConflict as mongoose.Model<IStockConflict>) ||
  mongoose.model<IStockConflict>('StockConflict', StockConflictSchema);

// ─── PromoUplift ──────────────────────────────────────────────────────────────

export interface IPromoUplift extends Document {
  month: string;
  uplift: number;
  revenue: number;
  campaignsCount: number;
  topCategory: string;
  createdAt: Date;
  updatedAt: Date;
}

const PromoUpliftSchema = new Schema<IPromoUplift>(
  {
    month: { type: String, required: true },
    uplift: { type: Number, required: true },
    revenue: { type: Number, required: true },
    campaignsCount: { type: Number, required: true },
    topCategory: { type: String, required: true },
  },
  { timestamps: true },
);

export const PromoUplift =
  (mongoose.models.PromoUplift as mongoose.Model<IPromoUplift>) ||
  mongoose.model<IPromoUplift>('PromoUplift', PromoUpliftSchema);

// ─── PricingCoupon ────────────────────────────────────────────────────────────

export interface IPricingCoupon extends Document {
  code: string;
  name?: string;
  description?: string;
  discountType: string;
  discountValue: number;
  minOrderValue?: number;
  minOrderAmount?: number;
  maxDiscount?: number | null;
  maxDiscountAmount?: number | null;
  discountOn?: string;
  applicableCategories?: string[];
  applicableProducts?: string[];
  applicableSkuIds?: string[];
  usageLimit?: number | null;
  usagePerUser?: number;
  usageCount?: number;
  isFirstOrderOnly?: boolean;
  isStackable?: boolean;
  excludeSaleItems?: boolean;
  targetSegment?: string;
  targetUserIds?: string[];
  targetZones?: string[];
  paymentRestriction?: string;
  startDate: Date;
  endDate: Date;
  validFrom?: Date | null;
  validTo?: Date | null;
  status: 'active' | 'paused' | 'expired';
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PricingCouponSchema = new Schema<IPricingCoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    discountType: { type: String, required: true, default: 'percentage' },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0 },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: null },
    maxDiscountAmount: { type: Number, default: null },
    discountOn: { type: String, default: 'CART_TOTAL' },
    applicableCategories: [String],
    applicableProducts: [String],
    applicableSkuIds: [String],
    usageLimit: { type: Number, default: null },
    usagePerUser: { type: Number, default: 1 },
    usageCount: { type: Number, default: 0 },
    isFirstOrderOnly: { type: Boolean, default: false },
    isStackable: { type: Boolean, default: false },
    excludeSaleItems: { type: Boolean, default: true },
    targetSegment: { type: String, default: 'ALL_USERS' },
    targetUserIds: [String],
    targetZones: [String],
    paymentRestriction: { type: String, default: 'ALL' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    status: { type: String, required: true, enum: ['active', 'paused', 'expired'], default: 'active' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'customer_coupons' },
);

PricingCouponSchema.index({ code: 1 });
PricingCouponSchema.index({ status: 1, startDate: 1, endDate: 1 });
PricingCouponSchema.index({ isActive: 1 });

export const PricingCoupon =
  (mongoose.models.PricingCoupon as mongoose.Model<IPricingCoupon>) ||
  mongoose.model<IPricingCoupon>('PricingCoupon', PricingCouponSchema, 'customer_coupons');

// ─── Allocation ───────────────────────────────────────────────────────────────

export interface IAllocation extends Document {
  skuId: mongoose.Types.ObjectId;
  locationId: string;
  locationName: string;
  allocated?: number;
  target?: number;
  onHand?: number;
  inTransit?: number;
  safetyStock?: number;
  history?: Array<{ week?: string; demand?: number; stock?: number; recordedAt?: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const AllocationSchema = new Schema<IAllocation>(
  {
    skuId: { type: Schema.Types.ObjectId, ref: 'MerchSKU', required: true },
    locationId: { type: String, required: true },
    locationName: { type: String, required: true },
    allocated: { type: Number, default: 0 },
    target: { type: Number, default: 0 },
    onHand: { type: Number, default: 0 },
    inTransit: { type: Number, default: 0 },
    safetyStock: { type: Number, default: 0 },
    history: [{ week: String, demand: Number, stock: Number, recordedAt: { type: Date, default: Date.now } }],
  },
  { timestamps: true },
);

AllocationSchema.index({ skuId: 1, locationId: 1 }, { unique: true });

export const Allocation =
  (mongoose.models.Allocation as mongoose.Model<IAllocation>) ||
  mongoose.model<IAllocation>('Allocation', AllocationSchema);

// ─── AllocationAlert ──────────────────────────────────────────────────────────

export interface IAllocationAlert extends Document {
  skuId?: mongoose.Types.ObjectId;
  sku: string;
  location: string;
  locationId?: string;
  allocationId?: mongoose.Types.ObjectId;
  type?: 'low_stock' | 'expiry';
  severity?: 'critical' | 'warning' | 'info';
  message: string;
  batch?: string;
  time?: string;
  status?: 'active' | 'dismissed';
  createdAt: Date;
  updatedAt: Date;
}

const AllocationAlertSchema = new Schema<IAllocationAlert>(
  {
    skuId: { type: Schema.Types.ObjectId, ref: 'MerchSKU' },
    sku: { type: String, required: true },
    location: { type: String, required: true },
    locationId: String,
    allocationId: { type: Schema.Types.ObjectId, ref: 'Allocation' },
    type: { type: String, enum: ['low_stock', 'expiry'], default: 'low_stock' },
    severity: { type: String, enum: ['critical', 'warning', 'info'], default: 'warning' },
    message: { type: String, required: true },
    batch: String,
    time: String,
    status: { type: String, enum: ['active', 'dismissed'], default: 'active' },
  },
  { timestamps: true },
);

export const AllocationAlert =
  (mongoose.models.AllocationAlert as mongoose.Model<IAllocationAlert>) ||
  mongoose.model<IAllocationAlert>('AllocationAlert', AllocationAlertSchema);

// ─── AllocationRule ───────────────────────────────────────────────────────────

export interface IAllocationRule extends Document {
  ruleId: string;
  ruleName: string;
  priority: number;
  applicableProducts?: string[];
  allocationStrategy: 'FIFO' | 'LIFO' | 'CLOSEST_DC' | 'CHEAPEST' | 'FASTEST';
  minStockThreshold?: number;
  maxAllocationPerCycle: number;
  leadTimeTarget?: number;
  costOptimization?: boolean;
  constraints?: Array<{ warehouseId?: mongoose.Types.ObjectId; maxAllocation?: number; holdbackPercentage?: number }>;
  isActive?: boolean;
  createdBy?: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AllocationRuleSchema = new Schema<IAllocationRule>(
  {
    ruleId: { type: String, required: true, unique: true },
    ruleName: { type: String, required: true },
    priority: { type: Number, required: true },
    applicableProducts: [String],
    allocationStrategy: { type: String, enum: ['FIFO', 'LIFO', 'CLOSEST_DC', 'CHEAPEST', 'FASTEST'], required: true },
    minStockThreshold: { type: Number, default: 0 },
    maxAllocationPerCycle: { type: Number, required: true },
    leadTimeTarget: Number,
    costOptimization: { type: Boolean, default: false },
    constraints: [
      { warehouseId: Schema.Types.ObjectId, maxAllocation: Number, holdbackPercentage: Number },
    ],
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
  },
  { timestamps: true, collection: 'allocation_rules' },
);

AllocationRuleSchema.index({ priority: 1 });
AllocationRuleSchema.index({ ruleId: 1 });

export const AllocationRule =
  (mongoose.models.AllocationRule as mongoose.Model<IAllocationRule>) ||
  mongoose.model<IAllocationRule>('AllocationRule', AllocationRuleSchema, 'allocation_rules');

// ─── Zone ─────────────────────────────────────────────────────────────────────

export interface IZone extends Document {
  name: string;
  code?: string;
  cityId: mongoose.Types.ObjectId;
  type?: string;
  status?: string;
  isVisible?: boolean;
  color?: string;
  areaSqKm?: number;
  promoCount?: number;
  defaultCapacity?: number;
  points?: Array<{ x: number; y: number }>;
  polygon?: Array<{ lat: number; lng: number }>;
  center?: { lat?: number; lng?: number };
  city?: string;
  region?: string;
  settings?: {
    deliveryFee?: number;
    minOrderValue?: number;
    maxDeliveryRadius?: number;
    estimatedDeliveryTime?: number;
    surgeMultiplier?: number;
    maxCapacity?: number;
    priority?: number;
    availableSlots?: string[];
  };
  analytics?: {
    areaSize?: number;
    population?: number;
    activeOrders?: number;
    totalOrders?: number;
    dailyOrders?: number;
    revenue?: number;
    avgDeliveryTime?: number;
    riderCount?: number;
    capacityUsage?: number;
    customerSatisfaction?: number;
  };
  createdBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ZoneSchema = new Schema<IZone>(
  {
    name: { type: String, required: true },
    code: { type: String, sparse: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'City', required: true },
    type: { type: String, default: 'standard' },
    status: { type: String, default: 'active' },
    isVisible: { type: Boolean, default: true },
    color: { type: String, default: '#3b82f6' },
    areaSqKm: { type: Number, default: 0 },
    promoCount: { type: Number, default: 0 },
    defaultCapacity: Number,
    points: [{ x: Number, y: Number }],
    polygon: [{ lat: Number, lng: Number }],
    center: { lat: Number, lng: Number },
    city: String,
    region: String,
    settings: {
      deliveryFee: { type: Number, default: 39 },
      minOrderValue: { type: Number, default: 149 },
      maxDeliveryRadius: { type: Number, default: 5 },
      estimatedDeliveryTime: { type: Number, default: 30 },
      surgeMultiplier: { type: Number, default: 1.0 },
      maxCapacity: { type: Number, default: 100 },
      priority: { type: Number, default: 5 },
      availableSlots: [String],
    },
    analytics: {
      areaSize: { type: Number, default: 0 },
      population: { type: Number, default: 0 },
      activeOrders: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      dailyOrders: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
      avgDeliveryTime: { type: Number, default: 0 },
      riderCount: { type: Number, default: 0 },
      capacityUsage: { type: Number, default: 0 },
      customerSatisfaction: { type: Number, default: 0 },
    },
    createdBy: String,
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

ZoneSchema.pre('validate', function (next) {
  if (!this.center && Array.isArray(this.polygon) && this.polygon.length > 0) {
    const sum = this.polygon.reduce(
      (acc, point) => ({ lat: acc.lat + Number(point.lat || 0), lng: acc.lng + Number(point.lng || 0) }),
      { lat: 0, lng: 0 },
    );
    this.center = { lat: sum.lat / this.polygon.length, lng: sum.lng / this.polygon.length };
  }
  next();
});

ZoneSchema.index({ cityId: 1 });
ZoneSchema.index({ status: 1 });
ZoneSchema.index({ city: 1 });
ZoneSchema.index({ code: 1 }, { unique: true, sparse: true });

export const Zone =
  (mongoose.models.Zone as mongoose.Model<IZone>) ||
  mongoose.model<IZone>('Zone', ZoneSchema);

// ─── OpsIncident ──────────────────────────────────────────────────────────────

export interface IOpsIncident extends Document {
  incidentNumber: string;
  type: 'store_outage' | 'payment_gateway' | 'maps_api' | 'warehouse' | 'rider_shortage';
  severity: 'critical' | 'warning' | 'stable';
  title: string;
  description: string;
  startTime?: Date;
  resolvedAt?: Date | null;
  status?: 'ongoing' | 'resolved';
  impact?: string | null;
  affectedOrders?: number | null;
  affectedCustomers?: number | null;
  storeId?: string | null;
  storeName?: string | null;
  outageReason?: string | null;
  estimatedResolution?: Date | null;
  actionsTaken?: string | null;
  integrationType?: string | null;
  integrationName?: string | null;
  timeline?: Array<{ timestamp: Date; event: string }>;
  actions?: Array<{ id: string; label: string; type?: 'primary' | 'secondary' | 'danger' }>;
  cityId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OpsIncidentSchema = new Schema<IOpsIncident>(
  {
    incidentNumber: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['store_outage', 'payment_gateway', 'maps_api', 'warehouse', 'rider_shortage'],
      required: true,
    },
    severity: { type: String, enum: ['critical', 'warning', 'stable'], required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    startTime: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    status: { type: String, enum: ['ongoing', 'resolved'], default: 'ongoing' },
    impact: { type: String, default: null },
    affectedOrders: { type: Number, default: null },
    affectedCustomers: { type: Number, default: null },
    storeId: { type: String, default: null },
    storeName: { type: String, default: null },
    outageReason: { type: String, default: null },
    estimatedResolution: { type: Date, default: null },
    actionsTaken: { type: String, default: null },
    integrationType: { type: String, default: null },
    integrationName: { type: String, default: null },
    timeline: [{ timestamp: Date, event: String }],
    actions: [{ id: String, label: String, type: { type: String, enum: ['primary', 'secondary', 'danger'], default: 'secondary' } }],
    cityId: { type: String, default: 'default' },
  },
  { timestamps: true, collection: 'ops_incidents' },
);

OpsIncidentSchema.index({ status: 1, type: 1 });
OpsIncidentSchema.index({ severity: 1 });
OpsIncidentSchema.index({ startTime: -1 });
OpsIncidentSchema.index({ cityId: 1 });

export const OpsIncident =
  (mongoose.models.OpsIncident as mongoose.Model<IOpsIncident>) ||
  mongoose.model<IOpsIncident>('OpsIncident', OpsIncidentSchema, 'ops_incidents');

// ─── OpsIntegrationHealth ─────────────────────────────────────────────────────

export interface IOpsIntegrationHealth extends Document {
  serviceKey: string;
  displayName: string;
  provider: string;
  status?: 'stable' | 'latency' | 'outage' | 'unknown';
  lastCheckedAt?: Date;
  latencyMs?: number | null;
  message?: string | null;
  cityId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OpsIntegrationHealthSchema = new Schema<IOpsIntegrationHealth>(
  {
    serviceKey: { type: String, required: true },
    displayName: { type: String, required: true },
    provider: { type: String, required: true },
    status: { type: String, enum: ['stable', 'latency', 'outage', 'unknown'], default: 'unknown' },
    lastCheckedAt: { type: Date, default: Date.now },
    latencyMs: { type: Number, default: null },
    message: { type: String, default: null },
    cityId: { type: String, default: 'default' },
  },
  { timestamps: true, collection: 'ops_integration_health' },
);

OpsIntegrationHealthSchema.index({ serviceKey: 1, cityId: 1 }, { unique: true });

export const OpsIntegrationHealth =
  (mongoose.models.OpsIntegrationHealth as mongoose.Model<IOpsIntegrationHealth>) ||
  mongoose.model<IOpsIntegrationHealth>('OpsIntegrationHealth', OpsIntegrationHealthSchema, 'ops_integration_health');

// ─── OpsException ─────────────────────────────────────────────────────────────

export interface IOpsException extends Document {
  exceptionNumber: string;
  type: 'rto_risk' | 'pickup_delay' | 'payment_failed' | 'delivery_delay' | 'customer_unreachable';
  orderId: string;
  title: string;
  description: string;
  riderId?: string | null;
  riderName?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  zoneId?: string | null;
  priority?: 'high' | 'medium' | 'low';
  status?: 'open' | 'resolved' | 'escalated';
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
  resolution?: string | null;
  cityId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OpsExceptionSchema = new Schema<IOpsException>(
  {
    exceptionNumber: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['rto_risk', 'pickup_delay', 'payment_failed', 'delivery_delay', 'customer_unreachable'],
      required: true,
    },
    orderId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    riderId: { type: String, default: null },
    riderName: { type: String, default: null },
    storeId: { type: String, default: null },
    storeName: { type: String, default: null },
    zoneId: { type: String, default: null },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    status: { type: String, enum: ['open', 'resolved', 'escalated'], default: 'open' },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
    resolution: { type: String, default: null },
    cityId: { type: String, default: 'default' },
  },
  { timestamps: true, collection: 'ops_exceptions' },
);

OpsExceptionSchema.index({ status: 1, type: 1 });
OpsExceptionSchema.index({ orderId: 1 });
OpsExceptionSchema.index({ createdAt: -1 });
OpsExceptionSchema.index({ cityId: 1 });

export const OpsException =
  (mongoose.models.OpsException as mongoose.Model<IOpsException>) ||
  mongoose.model<IOpsException>('OpsException', OpsExceptionSchema, 'ops_exceptions');

// ─── OpsDispatchConfig ────────────────────────────────────────────────────────

export interface IOpsDispatchConfig extends Document {
  cityId?: string;
  status?: 'running' | 'paused' | 'error';
  lastRestart?: Date;
  slaTargetMinutes?: number;
  config?: {
    algorithm?: string;
    riderSelection?: string;
    batchingEnabled?: boolean;
    surgePricingEnabled?: boolean;
  };
  updatedBy?: string | null;
  activityLog?: Array<{ timestamp?: Date; action: string; message?: string; status?: string; userId?: string | null }>;
  createdAt: Date;
  updatedAt: Date;
}

const OpsDispatchConfigSchema = new Schema<IOpsDispatchConfig>(
  {
    cityId: { type: String, default: 'default', unique: true },
    status: { type: String, enum: ['running', 'paused', 'error'], default: 'running' },
    lastRestart: { type: Date, default: Date.now },
    slaTargetMinutes: { type: Number, default: 15 },
    config: {
      algorithm: { type: String, default: 'nearest_available' },
      riderSelection: { type: String, default: 'proximity' },
      batchingEnabled: { type: Boolean, default: true },
      surgePricingEnabled: { type: Boolean, default: true },
    },
    updatedBy: { type: String, default: null },
    activityLog: [
      {
        timestamp: { type: Date, default: Date.now },
        action: { type: String, required: true },
        message: { type: String, default: '' },
        status: { type: String, default: 'running' },
        userId: { type: String, default: null },
      },
    ],
  },
  { timestamps: true, collection: 'ops_dispatch_config' },
);

export const OpsDispatchConfig =
  (mongoose.models.OpsDispatchConfig as mongoose.Model<IOpsDispatchConfig>) ||
  mongoose.model<IOpsDispatchConfig>('OpsDispatchConfig', OpsDispatchConfigSchema, 'ops_dispatch_config');

// ─── OpsSurgeConfig ───────────────────────────────────────────────────────────

export interface IOpsSurgeConfig extends Document {
  cityId?: string;
  active?: boolean;
  globalMultiplier?: number;
  zoneMultipliers?: Record<string, unknown>;
  startTime?: Date | null;
  estimatedEnd?: Date | null;
  reason?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const OpsSurgeConfigSchema = new Schema<IOpsSurgeConfig>(
  {
    cityId: { type: String, default: 'default', unique: true },
    active: { type: Boolean, default: false },
    globalMultiplier: { type: Number, default: 1.0, min: 1.0, max: 3.0 },
    zoneMultipliers: { type: Schema.Types.Mixed, default: {} },
    startTime: { type: Date, default: null },
    estimatedEnd: { type: Date, default: null },
    reason: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, collection: 'ops_surge_config' },
);

export const OpsSurgeConfig =
  (mongoose.models.OpsSurgeConfig as mongoose.Model<IOpsSurgeConfig>) ||
  mongoose.model<IOpsSurgeConfig>('OpsSurgeConfig', OpsSurgeConfigSchema, 'ops_surge_config');

// ─── OpsSlaConfig ─────────────────────────────────────────────────────────────

export interface IOpsSlaConfig extends Document {
  cityId?: string;
  targetMinutes?: number;
  zoneOverrides?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const OpsSlaConfigSchema = new Schema<IOpsSlaConfig>(
  {
    cityId: { type: String, default: 'default', unique: true },
    targetMinutes: { type: Number, default: 15 },
    zoneOverrides: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'ops_sla_config' },
);

export const OpsSlaConfig =
  (mongoose.models.OpsSlaConfig as mongoose.Model<IOpsSlaConfig>) ||
  mongoose.model<IOpsSlaConfig>('OpsSlaConfig', OpsSlaConfigSchema, 'ops_sla_config');
