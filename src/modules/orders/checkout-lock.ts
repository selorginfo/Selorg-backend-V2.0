import { decryptPayload, encryptPayload } from '../../utils/payload-crypto';

const LOCK_TTL_MS = 15 * 60 * 1000;

export interface CheckoutLockItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

/** Server-issued commercial snapshot — clients cannot forge this without the secret. */
export interface CheckoutLockPayload {
  v: 1;
  userId: string;
  items: CheckoutLockItem[];
  couponCode: string | null;
  deliveryTip: number;
  paymentMethodType: string;
  itemTotal: number;
  discount: number;
  deliveryFee: number;
  handlingCharge: number;
  totalBill: number;
  iat: number;
  exp: number;
}

function lockSecret(): string {
  const secret = process.env.CHECKOUT_LOCK_SECRET || process.env.JWT_SECRET || '';
  if (!secret) throw new Error('CHECKOUT_LOCK_SECRET (or JWT_SECRET) is required for checkout locks');
  return secret;
}

export function issueCheckoutLock(
  input: Omit<CheckoutLockPayload, 'v' | 'iat' | 'exp'> & { ttlMs?: number },
): string {
  const now = Date.now();
  const payload: CheckoutLockPayload = {
    v: 1,
    userId: input.userId,
    items: input.items,
    couponCode: input.couponCode ? String(input.couponCode).trim().toUpperCase() : null,
    deliveryTip: Math.max(0, Number(input.deliveryTip) || 0),
    paymentMethodType: input.paymentMethodType || 'cash',
    itemTotal: Number(input.itemTotal) || 0,
    discount: Number(input.discount) || 0,
    deliveryFee: Number(input.deliveryFee) || 0,
    handlingCharge: Number(input.handlingCharge) || 0,
    totalBill: Number(input.totalBill) || 0,
    iat: now,
    exp: now + (input.ttlMs ?? LOCK_TTL_MS),
  };
  return encryptPayload(payload, lockSecret());
}

export function verifyCheckoutLock(
  token: string,
  userId: string,
): { ok: true; payload: CheckoutLockPayload } | { ok: false; error: string } {
  const payload = decryptPayload<CheckoutLockPayload>(token, lockSecret());
  if (!payload || payload.v !== 1) {
    return { ok: false, error: 'Invalid or tampered checkout lock' };
  }
  if (String(payload.userId) !== String(userId)) {
    return { ok: false, error: 'Checkout lock does not belong to this account' };
  }
  if (!payload.exp || Date.now() > payload.exp) {
    return { ok: false, error: 'Checkout lock expired — refresh checkout and try again' };
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return { ok: false, error: 'Checkout lock has no items' };
  }
  return { ok: true, payload };
}
