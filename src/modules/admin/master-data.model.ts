import mongoose, { Schema, Document } from 'mongoose';

const CITY_CODE_REGEX = /^[A-Z]{3}$/;

export interface ICity extends Document {
  code: string;
  name: string;
  state?: string;
  country: string;
  isActive: boolean;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const CitySchema = new Schema<ICity>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: CITY_CODE_REGEX },
    name: { type: String, required: true },
    state: { type: String },
    country: { type: String, default: 'India' },
    isActive: { type: Boolean, default: true },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);
CitySchema.pre('validate', function cityPreValidate(next) {
  if (this.code) this.code = String(this.code).trim().toUpperCase();
  next();
});
CitySchema.index({ code: 1 }, { unique: true });
CitySchema.index({ isActive: 1 });

export const City = (mongoose.models.City as mongoose.Model<ICity>) || mongoose.model<ICity>('City', CitySchema);

const ZONE_TYPES = ['Serviceable', 'Exclusion', 'Priority', 'Promo-Only', 'standard', 'express', 'no-service', 'premium', 'surge'];
const ZONE_STATUSES = ['Active', 'Inactive', 'Pending', 'active', 'inactive', 'testing'];

export interface IZone extends Document {
  name: string;
  code?: string;
  cityId: mongoose.Types.ObjectId;
  type: string;
  status: string;
  isVisible: boolean;
  color: string;
  areaSqKm: number;
  promoCount: number;
  defaultCapacity?: number;
  points?: Array<{ x: number; y: number }>;
  polygon?: Array<{ lat: number; lng: number }>;
  center?: { lat?: number; lng?: number };
  city?: string;
  region?: string;
  settings?: Record<string, unknown>;
  analytics?: Record<string, unknown>;
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
    type: { type: String, enum: ZONE_TYPES, default: 'standard' },
    status: { type: String, enum: ZONE_STATUSES, default: 'active' },
    isVisible: { type: Boolean, default: true },
    color: { type: String, default: '#3b82f6' },
    areaSqKm: { type: Number, default: 0 },
    promoCount: { type: Number, default: 0 },
    defaultCapacity: { type: Number },
    points: [{ x: { type: Number, required: true }, y: { type: Number, required: true } }],
    polygon: [{ lat: { type: Number, required: true }, lng: { type: Number, required: true } }],
    center: { lat: { type: Number }, lng: { type: Number } },
    city: { type: String },
    region: { type: String },
    settings: {
      deliveryFee: { type: Number, default: 39 },
      minOrderValue: { type: Number, default: 149 },
      maxDeliveryRadius: { type: Number, default: 5 },
      estimatedDeliveryTime: { type: Number, default: 30 },
      surgeMultiplier: { type: Number, default: 1.0 },
      maxCapacity: { type: Number, default: 100 },
      priority: { type: Number, default: 5 },
      availableSlots: [{ type: String }],
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
    createdBy: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);
ZoneSchema.pre('validate', function zonePreValidate(next) {
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

export const Zone = (mongoose.models.Zone as mongoose.Model<IZone>) || mongoose.model<IZone>('Zone', ZoneSchema);

export interface IVehicleType extends Document {
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleTypeSchema = new Schema<IVehicleType>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);
VehicleTypeSchema.index({ code: 1 }, { unique: true });
VehicleTypeSchema.index({ isActive: 1 });

export const VehicleType =
  (mongoose.models.VehicleType as mongoose.Model<IVehicleType>) || mongoose.model<IVehicleType>('VehicleType', VehicleTypeSchema);

export interface ISkuUnit extends Document {
  code: string;
  name: string;
  baseUnit?: string;
  conversionFactor?: number;
  isActive: boolean;
  sortOrder: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SkuUnitSchema = new Schema<ISkuUnit>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    baseUnit: { type: String },
    conversionFactor: { type: Number },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);
SkuUnitSchema.index({ code: 1 }, { unique: true });
SkuUnitSchema.index({ isActive: 1 });

export const SkuUnit = (mongoose.models.SkuUnit as mongoose.Model<ISkuUnit>) || mongoose.model<ISkuUnit>('SkuUnit', SkuUnitSchema);
