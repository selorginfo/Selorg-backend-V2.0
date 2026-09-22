import mongoose, { Document, Schema, Types } from 'mongoose';

// ─── Constants ──────────────────────────────────────────────────────────────

export const ORDER_TYPES = ['VENDOR_TO_WAREHOUSE', 'WAREHOUSE_TO_DARKSTORE'] as const;
export const PROVIDERS = ['PORTER', 'SHADOWFAX', 'LOADSHARE'] as const;
export const ORDER_STATUSES = [
  'CREATED',
  'DRIVER_ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
  'FAILED',
] as const;
export const HISTORY_SOURCES = ['INTERNAL', 'WEBHOOK', 'MANUAL'] as const;

export type OrderType = (typeof ORDER_TYPES)[number];
export type Provider = (typeof PROVIDERS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type HistorySource = (typeof HISTORY_SOURCES)[number];

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ILocation {
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
}

export interface IItem {
  name: string;
  quantity: number;
  weight?: number;
}

export interface IDriverInfo {
  name?: string;
  phone?: string;
  vehicleNumber?: string;
  vehicleType?: string;
}

export interface ILogisticsOrder extends Document {
  referenceId: string;
  type: OrderType;
  provider: Provider;
  providerOrderId?: string;
  status: OrderStatus;
  pickup: ILocation;
  drop: ILocation;
  items: IItem[];
  vehicleType: string;
  scheduledTime?: Date;
  assignedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  estimatedFare?: number;
  actualFare?: number;
  distanceKm?: number;
  driverInfo?: IDriverInfo;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProviderOrder extends Document {
  logisticsOrderId: Types.ObjectId;
  provider: string;
  providerOrderId?: string;
  rawRequest?: unknown;
  rawResponse?: unknown;
  status?: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderStatusHistory extends Document {
  logisticsOrderId: Types.ObjectId;
  status: string;
  message?: string;
  location?: { lat?: number; lng?: number };
  eventTime: Date;
  source: HistorySource;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWebhookEvent extends Document {
  provider: string;
  payload: unknown;
  signature: string;
  processed: boolean;
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILogisticsProviderConfig extends Document {
  name: string;
  isActive: boolean;
  priority: number;
  apiBaseUrl?: string;
  credentialsEncrypted: string;
  vehicleTypeMapping: Map<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILogisticsMetric extends Document {
  eventId: string;
  eventType: string;
  logisticsOrderId?: Types.ObjectId;
  referenceId?: string;
  status?: string;
  provider?: string;
  orderType?: string;
  estimatedFare?: number;
  actualFare?: number;
  distanceKm?: number;
  costPerKm?: number;
  slaBreached: boolean;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const locationSub = {
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
};

const itemSub = {
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  weight: { type: Number, default: 0 },
};

const driverInfoSub = {
  name: String,
  phone: String,
  vehicleNumber: String,
  vehicleType: String,
};

// ─── LogisticsOrder ──────────────────────────────────────────────────────────

const logisticsOrderSchema = new Schema<ILogisticsOrder>(
  {
    referenceId: { type: String, required: true, index: true },
    type: { type: String, enum: ORDER_TYPES, required: true, index: true },
    provider: { type: String, enum: PROVIDERS, required: true, index: true },
    providerOrderId: { type: String, index: true, sparse: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'CREATED', index: true },
    pickup: { type: locationSub, required: true },
    drop: { type: locationSub, required: true },
    items: { type: [itemSub], default: [] },
    vehicleType: { type: String, default: 'mini_truck' },
    scheduledTime: Date,
    assignedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date,
    estimatedFare: Number,
    actualFare: Number,
    distanceKm: Number,
    driverInfo: driverInfoSub,
  },
  { timestamps: true },
);

logisticsOrderSchema.index({ status: 1, provider: 1 });
logisticsOrderSchema.index({ createdAt: -1 });
logisticsOrderSchema.index({ scheduledTime: 1, status: 1 });

export const LogisticsOrder =
  (mongoose.models.LogisticsOrder as mongoose.Model<ILogisticsOrder>) ||
  mongoose.model<ILogisticsOrder>('LogisticsOrder', logisticsOrderSchema);

// ─── ProviderOrder ───────────────────────────────────────────────────────────

const providerOrderSchema = new Schema<IProviderOrder>(
  {
    logisticsOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'LogisticsOrder',
      required: true,
      index: true,
    },
    provider: { type: String, required: true, index: true },
    providerOrderId: { type: String, index: true },
    rawRequest: { type: Schema.Types.Mixed },
    rawResponse: { type: Schema.Types.Mixed },
    status: { type: String, enum: ORDER_STATUSES },
  },
  { timestamps: true },
);

providerOrderSchema.index({ provider: 1, providerOrderId: 1 }, { sparse: true });

export const ProviderOrder =
  (mongoose.models.ProviderOrder as mongoose.Model<IProviderOrder>) ||
  mongoose.model<IProviderOrder>('ProviderOrder', providerOrderSchema);

// ─── OrderStatusHistory ──────────────────────────────────────────────────────

const orderStatusHistorySchema = new Schema<IOrderStatusHistory>(
  {
    logisticsOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'LogisticsOrder',
      required: true,
      index: true,
    },
    status: { type: String, required: true },
    message: { type: String },
    location: {
      lat: Number,
      lng: Number,
    },
    eventTime: { type: Date, default: Date.now },
    source: { type: String, enum: HISTORY_SOURCES, default: 'INTERNAL' },
  },
  { timestamps: true },
);

export const OrderStatusHistory =
  (mongoose.models.OrderStatusHistory as mongoose.Model<IOrderStatusHistory>) ||
  mongoose.model<IOrderStatusHistory>('OrderStatusHistory', orderStatusHistorySchema);

// ─── WebhookEvent ─────────────────────────────────────────────────────────────

const webhookEventSchema = new Schema<IWebhookEvent>(
  {
    provider: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    signature: { type: String, default: '' },
    processed: { type: Boolean, default: false, index: true },
    processingError: { type: String },
  },
  { timestamps: true },
);

webhookEventSchema.index({ processed: 1, createdAt: 1 });

export const WebhookEvent =
  (mongoose.models.WebhookEvent as mongoose.Model<IWebhookEvent>) ||
  mongoose.model<IWebhookEvent>('WebhookEvent', webhookEventSchema);

// ─── LogisticsProviderConfig ─────────────────────────────────────────────────

const logisticsProviderConfigSchema = new Schema<ILogisticsProviderConfig>(
  {
    name: { type: String, required: true, unique: true, uppercase: true, trim: true },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 100, index: true },
    apiBaseUrl: { type: String },
    credentialsEncrypted: { type: String, default: '' },
    vehicleTypeMapping: { type: Map, of: String, default: {} },
  },
  { timestamps: true },
);

logisticsProviderConfigSchema.index({ isActive: 1, priority: 1 });

export const LogisticsProviderConfig =
  (mongoose.models.LogisticsProviderConfig as mongoose.Model<ILogisticsProviderConfig>) ||
  mongoose.model<ILogisticsProviderConfig>('LogisticsProviderConfig', logisticsProviderConfigSchema);

// ─── LogisticsMetric ─────────────────────────────────────────────────────────

const logisticsMetricSchema = new Schema<ILogisticsMetric>(
  {
    eventId: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    logisticsOrderId: { type: Schema.Types.ObjectId, ref: 'LogisticsOrder', index: true },
    referenceId: String,
    status: String,
    provider: String,
    orderType: String,
    estimatedFare: Number,
    actualFare: Number,
    distanceKm: Number,
    costPerKm: Number,
    slaBreached: { type: Boolean, default: false },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

logisticsMetricSchema.index({ recordedAt: -1 });

export const LogisticsMetric =
  (mongoose.models.LogisticsMetric as mongoose.Model<ILogisticsMetric>) ||
  mongoose.model<ILogisticsMetric>('LogisticsMetric', logisticsMetricSchema);
