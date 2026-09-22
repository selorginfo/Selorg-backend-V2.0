import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomerAddress extends Document {
  userId: mongoose.Types.ObjectId;
  label: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<ICustomerAddress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'CustomerUser', required: true },
    label: { type: String, default: 'Home' },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    landmark: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    latitude: { type: Number },
    longitude: { type: Number },
    isDefault: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
addressSchema.index({ userId: 1 });
addressSchema.index({ userId: 1, isDefault: 1 });
addressSchema.index({ latitude: 1, longitude: 1 });

export const CustomerAddress =
  (mongoose.models.CustomerAddress as mongoose.Model<ICustomerAddress>) ||
  mongoose.model<ICustomerAddress>('CustomerAddress', addressSchema, 'customer_addresses');
