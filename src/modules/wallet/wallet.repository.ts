import mongoose from 'mongoose';
import { CustomerWallet, ICustomerWallet } from './wallet.model';
import { WalletTransaction, IWalletTransaction, WalletTransactionSource } from './wallet-transaction.model';

export async function findWalletByCustomerId(customerId: string | mongoose.Types.ObjectId, session: mongoose.ClientSession | null = null): Promise<ICustomerWallet | null> {
  const query = CustomerWallet.findOne({ customerId });
  if (session) query.session(session);
  return query;
}

export async function createWallet(customerId: string | mongoose.Types.ObjectId, session: mongoose.ClientSession | null = null): Promise<ICustomerWallet> {
  const created = await CustomerWallet.create([{ customerId, balance: 0 }], session ? { session } : undefined);
  return created[0];
}

export async function findExistingTransaction(
  customerId: string | mongoose.Types.ObjectId,
  source: WalletTransactionSource,
  referenceId: string,
  session: mongoose.ClientSession | null = null,
): Promise<{ amount: number } | null> {
  const query = WalletTransaction.findOne({ customerId, source, referenceId: String(referenceId) });
  if (session) query.session(session);
  return query.lean();
}

export async function createTransaction(
  doc: {
    walletId: mongoose.Types.ObjectId;
    customerId: string | mongoose.Types.ObjectId;
    type: 'credit' | 'debit';
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    source: WalletTransactionSource;
    referenceId?: string;
    referenceType?: string;
    description?: string;
  },
  session: mongoose.ClientSession | null = null,
): Promise<IWalletTransaction> {
  const created = await WalletTransaction.create([doc], session ? { session } : undefined);
  return created[0];
}

/** Atomic conditional debit — prevents overdraft under concurrent checkouts. */
export async function conditionalDebit(
  customerId: string | mongoose.Types.ObjectId,
  amount: number,
  session: mongoose.ClientSession | null = null,
): Promise<ICustomerWallet | null> {
  return CustomerWallet.findOneAndUpdate(
    { customerId, isActive: true, balance: { $gte: amount } },
    { $inc: { balance: -amount }, $set: { lastTransactionAt: new Date() } },
    { new: true, ...(session ? { session } : {}) },
  );
}

export async function creditBalance(
  walletId: mongoose.Types.ObjectId,
  amount: number,
  session: mongoose.ClientSession | null = null,
): Promise<ICustomerWallet | null> {
  return CustomerWallet.findOneAndUpdate(
    { _id: walletId },
    { $inc: { balance: amount }, $set: { lastTransactionAt: new Date() } },
    { new: true, ...(session ? { session } : {}) },
  );
}

export async function listTransactions(walletId: mongoose.Types.ObjectId, skip: number, limit: number) {
  return WalletTransaction.find({ walletId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
}

export async function countTransactions(walletId: mongoose.Types.ObjectId): Promise<number> {
  return WalletTransaction.countDocuments({ walletId });
}
