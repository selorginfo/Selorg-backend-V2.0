import mongoose, { Document, Schema } from 'mongoose';

export type WalletTransactionSource =
  | 'refund'
  | 'cashback'
  | 'promotional'
  | 'goodwill'
  | 'order_payment'
  | 'manual_credit'
  | 'manual_debit'
  | 'expiry'
  | 'payment_topup';

export interface IWalletTransaction extends Document {
  walletId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  type: 'credit' | 'debit';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  source: WalletTransactionSource;
  referenceId?: string;
  referenceType?: 'order' | 'refund' | 'promotion' | 'support_ticket' | 'manual' | 'payment';
  description: string;
  expiresAt: Date | null;
  isExpired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    walletId: { type: Schema.Types.ObjectId, ref: 'CustomerWallet', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'CustomerUser', required: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    source: {
      type: String,
      enum: ['refund', 'cashback', 'promotional', 'goodwill', 'order_payment', 'manual_credit', 'manual_debit', 'expiry', 'payment_topup'],
      required: true,
    },
    referenceId: { type: String },
    referenceType: { type: String, enum: ['order', 'refund', 'promotion', 'support_ticket', 'manual', 'payment'] },
    description: { type: String, default: '' },
    expiresAt: { type: Date, default: null },
    isExpired: { type: Boolean, default: false },
  },
  { timestamps: true },
);

walletTransactionSchema.index({ walletId: 1, createdAt: -1 });
walletTransactionSchema.index({ customerId: 1, createdAt: -1 });
walletTransactionSchema.index({ source: 1 });
/** Idempotent ledger rows keyed by source + reference (top-up txn, order debit, void refund). */
walletTransactionSchema.index(
  { customerId: 1, source: 1, referenceId: 1 },
  {
    name: 'wallet_ledger_idempotency_v2',
    unique: true,
    partialFilterExpression: {
      source: { $in: ['payment_topup', 'order_payment', 'refund'] },
      referenceId: { $type: 'string', $gt: '' },
    },
  },
);

export const WalletTransaction =
  (mongoose.models.WalletTransaction as mongoose.Model<IWalletTransaction>) ||
  mongoose.model<IWalletTransaction>('WalletTransaction', walletTransactionSchema);
