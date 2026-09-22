import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomerWallet extends Document {
  customerId: mongoose.Types.ObjectId;
  balance: number;
  pendingCredits: number;
  currency: string;
  isActive: boolean;
  lastTransactionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const customerWalletSchema = new Schema<ICustomerWallet>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'CustomerUser', required: true, unique: true },
    balance: { type: Number, default: 0, min: 0 },
    pendingCredits: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    isActive: { type: Boolean, default: true },
    lastTransactionAt: { type: Date, default: null },
  },
  { timestamps: true },
);

customerWalletSchema.index({ customerId: 1 });

export const CustomerWallet =
  (mongoose.models.CustomerWallet as mongoose.Model<ICustomerWallet>) ||
  mongoose.model<ICustomerWallet>('CustomerWallet', customerWalletSchema);
