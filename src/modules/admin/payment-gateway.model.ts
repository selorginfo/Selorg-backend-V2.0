import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentGateway extends Document {
  name: string;
  provider: 'razorpay' | 'paytm' | 'stripe' | 'phonepe' | 'cod';
  isActive: boolean;
  apiKey: string;
  secretKey: string;
  merchantId?: string;
  transactionFee: number;
  transactionFeeType: 'percentage' | 'flat';
  minAmount: number;
  maxAmount: number;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentGatewaySchema = new Schema<IPaymentGateway>(
  {
    name: { type: String, required: true },
    provider: { type: String, enum: ['razorpay', 'paytm', 'stripe', 'phonepe', 'cod'], required: true },
    isActive: { type: Boolean, default: true },
    apiKey: { type: String, default: '' },
    secretKey: { type: String, default: '' },
    merchantId: { type: String },
    transactionFee: { type: Number, default: 0 },
    transactionFeeType: { type: String, enum: ['percentage', 'flat'], default: 'percentage' },
    minAmount: { type: Number, default: 0 },
    maxAmount: { type: Number, default: 100000 },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const PaymentGateway =
  (mongoose.models.PaymentGateway as mongoose.Model<IPaymentGateway>) ||
  mongoose.model<IPaymentGateway>('PaymentGateway', PaymentGatewaySchema);
