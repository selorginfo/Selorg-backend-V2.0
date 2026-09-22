import mongoose, { Document, Schema } from 'mongoose';

export interface IDarkStore extends Document {
  name: string;
  code: string;
  warehouseId?: mongoose.Types.ObjectId | null;
  location: { type: 'Point'; coordinates: [number, number] };
  address: { line1: string; line2: string; city: string; state: string; pincode: string };
  serviceRadius: number;
  isActive: boolean;
  operatingHours: { open: string; close: string };
  avgPickPackTime: number;
  contactPhone: string;
  createdAt: Date;
  updatedAt: Date;
}

const darkStoreSchema = new Schema<IDarkStore>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation', default: null, index: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    address: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
    },
    serviceRadius: { type: Number, default: 5 }, // km
    isActive: { type: Boolean, default: true },
    operatingHours: {
      open: { type: String, default: '06:00' },
      close: { type: String, default: '23:00' },
    },
    avgPickPackTime: { type: Number, default: 5 }, // minutes
    contactPhone: { type: String, default: '' },
  },
  { timestamps: true },
);

darkStoreSchema.index({ location: '2dsphere' });
darkStoreSchema.index({ isActive: 1 });

export const DarkStore =
  (mongoose.models.DarkStore as mongoose.Model<IDarkStore>) ||
  mongoose.model<IDarkStore>('DarkStore', darkStoreSchema, 'dark_stores');

// ─── Dark Store Staff ─────────────────────────────────────────────────────────

export interface IDarkStoreStaff extends Document {
  darkStoreId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  role: 'manager' | 'picker' | 'delivery_boy';
  shift: 'morning' | 'afternoon' | 'evening' | 'night' | 'full_day';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DarkStoreStaffSchema = new Schema<IDarkStoreStaff>(
  {
    darkStoreId: { type: Schema.Types.ObjectId, ref: 'DarkStore', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '', trim: true },
    role: { type: String, required: true, enum: ['manager', 'picker', 'delivery_boy'], index: true },
    shift: { type: String, required: true, enum: ['morning', 'afternoon', 'evening', 'night', 'full_day'], default: 'morning' },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, collection: 'darkstore_staff' },
);

// one email per store
DarkStoreStaffSchema.index({ darkStoreId: 1, email: 1 }, { unique: true });
DarkStoreStaffSchema.index({ darkStoreId: 1, role: 1 });

export const DarkStoreStaff =
  (mongoose.models.DarkStoreStaff as mongoose.Model<IDarkStoreStaff>) ||
  mongoose.model<IDarkStoreStaff>('DarkStoreStaff', DarkStoreStaffSchema, 'darkstore_staff');
