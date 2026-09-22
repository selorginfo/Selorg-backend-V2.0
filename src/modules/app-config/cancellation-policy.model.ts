import mongoose, { Document, Schema } from 'mongoose';

export interface ICancellationPolicy extends Document {
  name: string;
  isActive: boolean;
  allowedStatuses: ('pending' | 'confirmed' | 'getting-packed')[];
  freeWindowMinutes: number;
  cancellationFeePercent: number;
  maxCancellationFee: number;
  maxCancellationsPerDay: number;
  maxCancellationsPerWeek: number;
  customerCanCancel: boolean;
  supportCanCancel: boolean;
  autoRefundOnCancel: boolean;
  refundMethod: 'original_payment' | 'wallet' | 'manual';
  appliesTo: 'all' | 'cod' | 'online' | 'wallet';
  createdAt: Date;
  updatedAt: Date;
}

const cancellationPolicySchema = new Schema<ICancellationPolicy>(
  {
    name: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    allowedStatuses: [{ type: String, enum: ['pending', 'confirmed', 'getting-packed'] }],
    freeWindowMinutes: { type: Number, default: 2 },
    cancellationFeePercent: { type: Number, default: 0 },
    maxCancellationFee: { type: Number, default: 0 },
    maxCancellationsPerDay: { type: Number, default: 10 },
    maxCancellationsPerWeek: { type: Number, default: 10 },
    customerCanCancel: { type: Boolean, default: true },
    supportCanCancel: { type: Boolean, default: true },
    autoRefundOnCancel: { type: Boolean, default: true },
    refundMethod: { type: String, enum: ['original_payment', 'wallet', 'manual'], default: 'original_payment' },
    appliesTo: { type: String, enum: ['all', 'cod', 'online', 'wallet'], default: 'all' },
  },
  { timestamps: true },
);

export const CancellationPolicy =
  (mongoose.models.CancellationPolicy as mongoose.Model<ICancellationPolicy>) ||
  mongoose.model<ICancellationPolicy>('CancellationPolicy', cancellationPolicySchema, 'customer_cancellation_policies');
