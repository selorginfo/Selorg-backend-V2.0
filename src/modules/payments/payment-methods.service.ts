import mongoose from 'mongoose';
import { PaymentMethod, IPaymentMethod } from './payment-method.model';

/** Ported field-for-field from legacy `customer-backend/services/paymentsService.js`. */

function toResponse(doc: IPaymentMethod | Record<string, unknown>) {
  const o = (doc as IPaymentMethod).toObject ? (doc as IPaymentMethod).toObject() : (doc as Record<string, unknown>);
  const meta = (o.meta as Record<string, unknown>) || {};
  return {
    id: String(o._id),
    type: o.type,
    last4: o.last4,
    brand: o.brand || '',
    cardholderName: o.cardholderName || '',
    expiryMonth: meta.expiryMonth || '',
    expiryYear: meta.expiryYear || '',
    upiId: o.upiId,
    walletName: o.walletName,
    isDefault: Boolean(o.isDefault),
  };
}

export async function listByUserId(userId: string) {
  const list = await PaymentMethod.find({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ isDefault: -1, createdAt: 1 })
    .lean();
  return list.map(toResponse);
}

function detectCardBrand(cardNumber: string): string {
  const num = String(cardNumber).replace(/\s/g, '');
  if (/^4/.test(num)) return 'Visa';
  if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return 'Mastercard';
  if (/^6(?:011|5)/.test(num)) return 'RuPay';
  if (/^3[47]/.test(num)) return 'Amex';
  return 'Card';
}

export interface AddPaymentMethodInput {
  type?: 'card' | 'upi' | 'wallet';
  cardNumber?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cardholderName?: string;
  upiId?: string;
  walletName?: string;
}

export async function addMethod(userId: string, body: AddPaymentMethodInput) {
  const { type, cardNumber, expiryMonth, expiryYear, cardholderName, upiId, walletName } = body || {};
  const last4 = cardNumber ? String(cardNumber).replace(/\s/g, '').slice(-4) : upiId ? String(upiId).slice(-4) || '' : '';
  const brand = cardNumber ? detectCardBrand(cardNumber) : '';
  const count = await PaymentMethod.countDocuments({ userId: new mongoose.Types.ObjectId(userId) });
  const isDefault = count === 0;
  const doc = await PaymentMethod.create({
    userId: new mongoose.Types.ObjectId(userId),
    type: type || 'upi',
    last4: last4 || '',
    brand,
    cardholderName: cardholderName || '',
    upiId: upiId || '',
    walletName: walletName || '',
    isDefault,
    meta: expiryMonth && expiryYear ? { expiryMonth, expiryYear } : {},
  });
  if (isDefault) {
    await PaymentMethod.updateMany({ userId: new mongoose.Types.ObjectId(userId), _id: { $ne: doc._id } }, { $set: { isDefault: false } });
  }
  return toResponse(doc);
}

export interface UpdatePaymentMethodInput {
  cardNumber?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cardholderName?: string;
}

export async function updateMethod(userId: string, methodId: string, body: UpdatePaymentMethodInput) {
  const method = await PaymentMethod.findOne({ _id: methodId, userId: new mongoose.Types.ObjectId(userId) });
  if (!method) return null;
  const { cardNumber, expiryMonth, expiryYear, cardholderName } = body || {};
  if (cardNumber) {
    method.last4 = String(cardNumber).replace(/\s/g, '').slice(-4);
    method.brand = detectCardBrand(cardNumber);
  }
  if (cardholderName !== undefined) method.cardholderName = cardholderName;
  if (expiryMonth && expiryYear) {
    method.meta = { ...method.meta, expiryMonth, expiryYear };
  }
  await method.save();
  return toResponse(method);
}

export async function removeMethod(userId: string, methodId: string): Promise<boolean> {
  const deleted = (await PaymentMethod.findOneAndDelete({ _id: methodId, userId: new mongoose.Types.ObjectId(userId) })) as unknown as IPaymentMethod | null;
  if (deleted && deleted.isDefault) {
    const next = await PaymentMethod.findOne({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: 1 });
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }
  return !!deleted;
}

export async function setDefault(userId: string, methodId: string) {
  const method = await PaymentMethod.findOne({ _id: methodId, userId: new mongoose.Types.ObjectId(userId) });
  if (!method) return null;
  await PaymentMethod.updateMany({ userId: new mongoose.Types.ObjectId(userId) }, { $set: { isDefault: false } });
  method.isDefault = true;
  await method.save();
  return toResponse(method);
}
