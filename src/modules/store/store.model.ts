import mongoose, { Document, Schema } from 'mongoose';

const DAY_KEYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export interface IStore extends Document {
  code?: string;
  name: string;
  type: 'store' | 'dark_store' | 'warehouse';
  address: string;
  cityId?: mongoose.Types.ObjectId;
  zoneId?: mongoose.Types.ObjectId;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  coordinatesCapturedAt?: Date;
  coordinatesSource: 'device_gps' | 'admin';
  x?: number;
  y?: number;
  zones: string[];
  status: 'active' | 'offline' | 'inactive' | 'maintenance';
  serviceStatus?: 'Full' | 'Partial' | 'None';
  deliveryRadius: number;
  maxCapacity: number;
  currentLoad: number;
  phone?: string;
  email?: string;
  managerId?: mongoose.Types.ObjectId;
  operationalHours?: Map<string, { open: string; close: string; isOpen: boolean }>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const storeSchema = new Schema<IStore>(
  {
    code: { type: String, unique: true, sparse: true, trim: true, uppercase: true, maxlength: 20, match: /^[A-Z0-9-]+$/ },
    name: { type: String, required: true },
    type: { type: String, enum: ['store', 'dark_store', 'warehouse'], required: true, default: 'store' },

    address: { type: String, required: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'City' },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone' },
    state: { type: String },
    pincode: { type: String },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    coordinatesCapturedAt: { type: Date },
    coordinatesSource: { type: String, enum: ['device_gps', 'admin'], default: 'admin' },
    x: { type: Number },
    y: { type: Number },
    zones: [{ type: String }],

    status: { type: String, enum: ['active', 'offline', 'inactive', 'maintenance'], default: 'active' },
    serviceStatus: { type: String, enum: ['Full', 'Partial', 'None'] },
    deliveryRadius: { type: Number, default: 5, min: 1, max: 100 },
    maxCapacity: { type: Number, default: 100 },
    currentLoad: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator(this: IStore, v: number) {
          if (v == null) return true;
          if (this.maxCapacity == null) return true;
          return Number(v) <= Number(this.maxCapacity);
        },
        message: 'currentLoad cannot exceed maxCapacity',
      },
    },

    phone: { type: String },
    email: { type: String, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    managerId: { type: Schema.Types.ObjectId, ref: 'AdminUser' },

    operationalHours: {
      type: Map,
      of: { open: String, close: String, isOpen: Boolean },
      default: () => new Map(),
      validate: {
        validator(value: Map<string, { open: string; close: string; isOpen: boolean }>) {
          if (!value) return true;
          const entries = value instanceof Map ? Object.fromEntries(value) : value;
          const keys = Object.keys(entries);
          if (keys.length === 0) return true;
          const hasAllDays = DAY_KEYS.every((day) => Object.prototype.hasOwnProperty.call(entries, day));
          if (!hasAllDays) return false;
          return DAY_KEYS.every((day) => {
            const slot = (entries as Record<string, { open?: unknown; close?: unknown; isOpen?: unknown }>)[day];
            return slot && typeof slot.open === 'string' && typeof slot.close === 'string' && typeof slot.isOpen === 'boolean';
          });
        },
        message: 'operationalHours must include Monday-Sunday with open, close, and isOpen',
      },
    },

    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

storeSchema.pre('validate', function storePreValidate(next) {
  if (this.code) {
    this.code = String(this.code).trim().toUpperCase();
  }
  next();
});

storeSchema.index({ code: 1 }, { unique: true });
storeSchema.index({ cityId: 1, status: 1 });
storeSchema.index({ zoneId: 1 });
storeSchema.index({ type: 1, status: 1 });
storeSchema.index({ name: 'text', code: 'text', address: 'text' });

export const Store = (mongoose.models.Store as mongoose.Model<IStore>) || mongoose.model<IStore>('Store', storeSchema);
