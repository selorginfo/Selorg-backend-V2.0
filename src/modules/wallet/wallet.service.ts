import mongoose from 'mongoose';
import { CustomerWallet, ICustomerWallet } from './wallet.model';
import { WalletTransaction } from './wallet-transaction.model';
import * as walletRepo from './wallet.repository';

/**
 * Ported from legacy `customer-backend/services/walletService.js`. All balance mutations go
 * through this module — never write `CustomerWallet.balance` directly elsewhere (see
 * `debitWalletForOrder`'s atomic conditional-update comment for why).
 */

export const MAX_TOP_UP_AMOUNT = Number(process.env.WALLET_MAX_TOP_UP_AMOUNT) || 10000;

export function roundInr(amount: unknown): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

export function voidRefundReferenceId(orderId: unknown): string {
  return `wallet-void:${String(orderId)}`;
}

export async function getOrCreateWallet(customerId: string | mongoose.Types.ObjectId, session: mongoose.ClientSession | null = null): Promise<ICustomerWallet> {
  let wallet = await walletRepo.findWalletByCustomerId(customerId, session);
  if (!wallet) {
    wallet = await walletRepo.createWallet(customerId, session);
  }
  return wallet;
}

type CreditMeta = {
  source?: 'refund' | 'cashback' | 'promotional' | 'goodwill' | 'manual_credit' | 'payment_topup';
  description?: string;
  referenceId?: string;
  referenceType?: 'order' | 'refund' | 'promotion' | 'support_ticket' | 'manual' | 'payment';
  session?: mongoose.ClientSession | null;
};

type CreditResult = { error: string } | { balance: number; credited: number; alreadyCredited?: boolean };

/**
 * Credit a customer wallet and record a transaction (shared by top-up and admin flows).
 * Top-up / manual credits are capped; refunds and order void reversals are not.
 */
export async function creditWallet(customerId: string | mongoose.Types.ObjectId, amount: unknown, meta: CreditMeta = {}): Promise<CreditResult> {
  const parsed = roundInr(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { error: 'Invalid amount' };
  }

  const { source = 'manual_credit', description = 'Wallet top-up', referenceId, referenceType = 'manual', session = null } = meta;

  const cappedSources = new Set(['payment_topup', 'manual_credit', 'promotional', 'cashback', 'goodwill']);
  if (cappedSources.has(source) && parsed > MAX_TOP_UP_AMOUNT) {
    return { error: `Amount cannot exceed ₹${MAX_TOP_UP_AMOUNT}` };
  }

  // Idempotent payment top-ups keyed by gateway txn id.
  if (source === 'payment_topup' && referenceId) {
    const existing = await walletRepo.findExistingTransaction(customerId, source, String(referenceId), session);
    if (existing) {
      const wallet = await getOrCreateWallet(customerId, session);
      return { balance: wallet.balance, credited: 0, alreadyCredited: true };
    }
  }

  // Idempotent void/cancel rollbacks keyed by order id reference.
  if (source === 'refund' && referenceId) {
    const existing = await walletRepo.findExistingTransaction(customerId, source, String(referenceId), session);
    if (existing) {
      const wallet = await getOrCreateWallet(customerId, session);
      return { balance: wallet.balance, credited: 0, alreadyCredited: true };
    }
  }

  const wallet = await getOrCreateWallet(customerId, session);
  if (!wallet.isActive) {
    return { error: 'Wallet not available' };
  }

  const credited = await walletRepo.creditBalance(wallet._id as mongoose.Types.ObjectId, parsed, session);
  if (!credited) return { error: 'Wallet not available' };
  const balanceAfter = roundInr(credited.balance);
  const balanceBefore = roundInr(balanceAfter - parsed);

  try {
    await walletRepo.createTransaction(
      {
        walletId: wallet._id as mongoose.Types.ObjectId,
        customerId,
        type: 'credit',
        amount: parsed,
        balanceBefore,
        balanceAfter,
        source,
        referenceId,
        referenceType,
        description,
      },
      session,
    );
  } catch (err) {
    if (err && ((err as { code?: number }).code === 11000 || String((err as Error)?.message || '').includes('duplicate'))) {
      // The ledger row already exists. Undo this increment with $inc so a concurrent credit is not overwritten.
      await walletRepo.creditBalance(wallet._id as mongoose.Types.ObjectId, -parsed, session);
      const fresh = await getOrCreateWallet(customerId, session);
      return { balance: fresh.balance, credited: 0, alreadyCredited: true };
    }
    await walletRepo.creditBalance(wallet._id as mongoose.Types.ObjectId, -parsed, session);
    throw err;
  }

  return { balance: balanceAfter, credited: parsed };
}

type DebitMeta = { description?: string; session?: mongoose.ClientSession | null };
type DebitResult = { error: string } | { balance: number; deducted: number; alreadyDebited: boolean };

/**
 * Atomically debit wallet for an order payment.
 * Idempotent on (customerId, source=order_payment, referenceId=orderId).
 */
export async function debitWalletForOrder(customerId: string | mongoose.Types.ObjectId, amount: unknown, orderId: unknown, meta: DebitMeta = {}): Promise<DebitResult> {
  const parsed = roundInr(amount);
  const orderRef = String(orderId || '').trim();
  if (!orderRef) return { error: 'Order id required for wallet debit' };
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { error: 'Invalid wallet debit amount' };
  }

  const { description = 'Payment for order', session = null } = meta;

  const existing = await walletRepo.findExistingTransaction(customerId, 'order_payment', orderRef, session);
  if (existing) {
    const wallet = await getOrCreateWallet(customerId, session);
    return { balance: wallet.balance, deducted: Number(existing.amount) || parsed, alreadyDebited: true };
  }

  // Atomic conditional debit — prevents overdraft under concurrent checkouts.
  const updated = await walletRepo.conditionalDebit(customerId, parsed, session);

  if (!updated) {
    const wallet = await getOrCreateWallet(customerId, session);
    if (!wallet.isActive) return { error: 'Wallet not available' };
    return { error: 'Insufficient wallet balance' };
  }

  const balanceAfter = roundInr(updated.balance);
  const balanceBefore = roundInr(balanceAfter + parsed);

  try {
    await walletRepo.createTransaction(
      {
        walletId: updated._id as mongoose.Types.ObjectId,
        customerId,
        type: 'debit',
        amount: parsed,
        balanceBefore,
        balanceAfter,
        source: 'order_payment',
        referenceId: orderRef,
        referenceType: 'order',
        description,
      },
      session,
    );
  } catch (err) {
    if (err && ((err as { code?: number }).code === 11000 || String((err as Error)?.message || '').includes('duplicate'))) {
      // Another request already wrote the ledger — reverse this debit.
      await walletRepo.creditBalance(updated._id as mongoose.Types.ObjectId, parsed, session);
      const wallet = await getOrCreateWallet(customerId, session);
      return { balance: wallet.balance, deducted: parsed, alreadyDebited: true };
    }
    // Ledger write failed after balance change — restore funds.
    await walletRepo.creditBalance(updated._id as mongoose.Types.ObjectId, parsed, session);
    throw err;
  }

  return { balance: balanceAfter, deducted: parsed, alreadyDebited: false };
}

/**
 * Refund a prior order_payment debit when online payment fails/cancels (partial wallet).
 * Idempotent via referenceId wallet-void:{orderId}.
 */
export async function refundWalletForFailedOrderPayment(
  customerId: string | mongoose.Types.ObjectId,
  amount: unknown,
  orderId: unknown,
  meta: { description?: string; session?: mongoose.ClientSession | null } = {},
): Promise<CreditResult | { skipped: true; credited: 0; reason?: string }> {
  const parsed = roundInr(amount);
  const orderRef = String(orderId || '').trim();
  if (!orderRef) return { error: 'Order id required for wallet refund' };
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { skipped: true, credited: 0 };
  }

  const { description = 'Wallet restored after payment failed', session = null } = meta;

  // Only refund if a debit exists for this order.
  const debit = await walletRepo.findExistingTransaction(customerId, 'order_payment', orderRef, session);
  if (!debit) {
    return { skipped: true, credited: 0, reason: 'no_debit' };
  }

  const refundAmount = roundInr(Math.min(parsed, Number(debit.amount) || parsed));

  return creditWallet(customerId, refundAmount, {
    source: 'refund',
    description,
    referenceId: voidRefundReferenceId(orderRef),
    referenceType: 'order',
    session,
  });
}

export async function getBalance(customerId: string): Promise<{ balance: number; pendingCredits: number; currency: string; isActive: boolean }> {
  const wallet = await getOrCreateWallet(customerId);
  return { balance: wallet.balance, pendingCredits: wallet.pendingCredits, currency: wallet.currency, isActive: wallet.isActive };
}

export async function getTransactions(customerId: string, page: number, limit: number) {
  const wallet = await CustomerWallet.findOne({ customerId });
  if (!wallet) {
    return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }
  const skip = (page - 1) * limit;
  const [transactions, total] = await Promise.all([
    walletRepo.listTransactions(wallet._id as mongoose.Types.ObjectId, skip, limit),
    walletRepo.countTransactions(wallet._id as mongoose.Types.ObjectId),
  ]);
  return { data: transactions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
}

// WalletTransaction re-exported for callers that need the raw model (e.g. controllers listing raw docs).
export { WalletTransaction };
