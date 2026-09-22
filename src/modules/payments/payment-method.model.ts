import mongoose, { Document, Schema } from 'mongoose';

/** Ported field-for-field from legacy `customer-backend/models/PaymentMethod.js`. */
export interface IPaymentMethod extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'card' | 'upi' | 'wallet';
  last4: string;
  brand: string;
  cardholderName: string;
  upiId: string;
  walletName: string;
  isDefault: boolean;
  meta: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentMethodSchema = new Schema<IPaymentMethod>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'CustomerUser', required: true },
    type: { type: String, enum: ['card', 'upi', 'wallet'], required: true },
    last4: { type: String, default: '' },
    brand: { type: String, default: '' },
    cardholderName: { type: String, default: '' },
    upiId: { type: String, default: '' },
    walletName: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

paymentMethodSchema.index({ userId: 1 });
paymentMethodSchema.index({ userId: 1, isDefault: 1 });

export const PaymentMethod =
  (mongoose.models.CustomerPaymentMethod as mongoose.Model<IPaymentMethod>) ||
  mongoose.model<IPaymentMethod>('CustomerPaymentMethod', paymentMethodSchema, 'customer_payment_methods');
