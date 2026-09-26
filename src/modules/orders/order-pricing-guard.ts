import type { NextFunction, Request, Response } from 'express';
import { ResponseFormatter } from '../../utils/response';

/** In-progress customer orders. Delivered and cancelled orders do not count. */
export const OPEN_ORDER_STATUSES = ['pending', 'confirmed', 'getting-packed', 'on-the-way', 'arrived'] as const;

export const MAX_OPEN_ORDERS = 3;

export const PRICING_MISMATCH_MESSAGE = 'Order pricing does not match. Please place the order again.';
export const CLIENT_PRICE_MESSAGE = 'Item price cannot be edited in the order request.';
export const ZERO_PRICE_MESSAGE = 'Item price cannot be zero.';
export const TOO_MANY_ORDERS_MESSAGE = 'You cannot place more than 3 orders at the same time.';

export interface OrderFlowError {
  error: string;
  statusCode: number;
  code: string;
}

export interface PricingLine {
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
}

/** Frozen at placement and compared again when payment is confirmed. */
export interface PricingLock {
  lines: PricingLine[];
  itemTotal: number;
  totalTax: number;
  handlingCharge: number;
  deliveryFee: number;
  deliveryTip: number;
  discount: number;
  walletDeduction: number;
  onlineAmountDue: number;
  totalBill: number;
}

const ITEM_PRICE_KEYS = new Set([
  'price',
  'unitPrice',
  'itemPrice',
  'sellingPrice',
  'originalPrice',
  'mrp',
  'taxAmount',
  'lineTotal',
  'itemTotal',
  'amount',
]);

const ORDER_PRICE_KEYS = new Set([
  'price',
  'itemTotal',
  'subtotal',
  'total',
  'totalBill',
  'amount',
  'amountInr',
  'discount',
  'deliveryFee',
  'handlingCharge',
  'totalTax',
  'tax',
  'walletDeduction',
  'onlineAmountDue',
  'finalAmount',
  'grandTotal',
]);

export function roundMoney(amount: unknown): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

export function moneyEquals(a: unknown, b: unknown): boolean {
  return roundMoney(a) === roundMoney(b);
}

export function isPositivePrice(price: unknown): boolean {
  return roundMoney(price) > 0;
}

export function exceedsOpenOrderLimit(openCount: number): boolean {
  return openCount >= MAX_OPEN_ORDERS;
}

export function tooManyOpenOrdersError(): OrderFlowError {
  return { error: TOO_MANY_ORDERS_MESSAGE, statusCode: 429, code: 'TOO_MANY_OPEN_ORDERS' };
}

export function zeroPriceError(productName?: string): OrderFlowError {
  const name = String(productName || '').trim();
  return {
    error: name ? `${name} price cannot be zero.` : ZERO_PRICE_MESSAGE,
    statusCode: 400,
    code: 'ZERO_PRICE',
  };
}

export function pricingMismatchError(): OrderFlowError {
  return { error: PRICING_MISMATCH_MESSAGE, statusCode: 429, code: 'PRICING_MISMATCH' };
}

/** Paths the client used to send a price. Empty when the payload leaves pricing to the server. */
export function findClientPriceEdits(body: unknown): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  const record = body as Record<string, unknown>;
  const hits: string[] = [];
  for (const key of Object.keys(record)) {
    if (ORDER_PRICE_KEYS.has(key)) hits.push(key);
  }
  if (!Array.isArray(record.items)) return hits;
  record.items.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    for (const key of Object.keys(item as Record<string, unknown>)) {
      if (ITEM_PRICE_KEYS.has(key) || ORDER_PRICE_KEYS.has(key)) hits.push(`items.${index}.${key}`);
    }
  });
  return hits;
}

export function clientPriceEditError(body: unknown): OrderFlowError | null {
  if (!findClientPriceEdits(body).length) return null;
  return { error: CLIENT_PRICE_MESSAGE, statusCode: 429, code: 'PRICING_MISMATCH' };
}

/** Reject create-order and payment-session bodies that include a client price. */
export function rejectClientPriceEdits(req: Request, res: Response, next: NextFunction): void {
  const blocked = clientPriceEditError(req.body);
  if (!blocked) {
    next();
    return;
  }
  res.status(blocked.statusCode).json(ResponseFormatter.error(blocked.error, blocked.statusCode));
}

export function statusCodeOf(result: unknown, fallback = 400): number {
  if (result && typeof result === 'object' && 'statusCode' in result) {
    const code = Number((result as { statusCode?: number }).statusCode);
    if (code >= 400 && code < 600) return code;
  }
  return fallback;
}

function asOrderRecord(order: unknown): Record<string, unknown> {
  if (!order || typeof order !== 'object') return {};
  const doc = order as { toObject?: () => Record<string, unknown> };
  if (typeof doc.toObject === 'function') return doc.toObject();
  return order as Record<string, unknown>;
}

function lineFrom(raw: unknown): PricingLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const productId = String(item.productId || '');
  const variantId = String(item.variantId || '');
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.price);
  if (!productId || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice)) return null;
  return { productId, variantId, quantity, unitPrice };
}

export function pricingFromOrder(order: unknown): PricingLock {
  const record = asOrderRecord(order);
  const lines = Array.isArray(record.items)
    ? record.items.map(lineFrom).filter((line): line is PricingLine => line != null)
    : [];
  return {
    lines,
    itemTotal: roundMoney(record.itemTotal),
    totalTax: roundMoney(record.totalTax),
    handlingCharge: roundMoney(record.handlingCharge),
    deliveryFee: roundMoney(record.deliveryFee),
    deliveryTip: roundMoney(record.deliveryTip),
    discount: roundMoney(record.discount),
    walletDeduction: roundMoney(record.walletDeduction),
    onlineAmountDue: roundMoney(record.onlineAmountDue),
    totalBill: roundMoney(record.totalBill),
  };
}

export function buildPricingLock(input: PricingLock): PricingLock {
  return {
    lines: input.lines.map((line) => ({
      productId: String(line.productId),
      variantId: String(line.variantId || ''),
      quantity: line.quantity,
      unitPrice: roundMoney(line.unitPrice),
    })),
    itemTotal: roundMoney(input.itemTotal),
    totalTax: roundMoney(input.totalTax),
    handlingCharge: roundMoney(input.handlingCharge),
    deliveryFee: roundMoney(input.deliveryFee),
    deliveryTip: roundMoney(input.deliveryTip),
    discount: roundMoney(input.discount),
    walletDeduction: roundMoney(input.walletDeduction),
    onlineAmountDue: roundMoney(input.onlineAmountDue),
    totalBill: roundMoney(input.totalBill),
  };
}

/** Gateway charge: the online remainder after wallet, otherwise the full bill. */
export function payableAmount(lock: Pick<PricingLock, 'walletDeduction' | 'onlineAmountDue' | 'totalBill'>): number {
  if (roundMoney(lock.walletDeduction) > 0) return roundMoney(lock.onlineAmountDue);
  return roundMoney(lock.totalBill);
}

function locksEqual(expected: PricingLock, actual: PricingLock): boolean {
  const fields: Array<keyof Omit<PricingLock, 'lines'>> = [
    'itemTotal',
    'totalTax',
    'handlingCharge',
    'deliveryFee',
    'deliveryTip',
    'discount',
    'walletDeduction',
    'onlineAmountDue',
    'totalBill',
  ];
  if (fields.some((field) => !moneyEquals(expected[field], actual[field]))) return false;
  if (expected.lines.length !== actual.lines.length) return false;
  return expected.lines.every((line, index) => {
    const other = actual.lines[index];
    return (
      line.productId === other.productId &&
      line.variantId === other.variantId &&
      line.quantity === other.quantity &&
      moneyEquals(line.unitPrice, other.unitPrice)
    );
  });
}

function storedLock(order: unknown): PricingLock | null {
  const record = asOrderRecord(order);
  const lock = record.pricingLock;
  if (!lock || typeof lock !== 'object') return null;
  const raw = lock as Partial<PricingLock>;
  if (!Array.isArray(raw.lines) || raw.totalBill == null) return null;
  return buildPricingLock(raw as PricingLock);
}

/**
 * Compare the order written at placement with the amount about to be charged or confirmed.
 * A difference is a pricing mismatch (HTTP 429). A zero line price is rejected separately.
 */
export function matchOrderPayment(order: unknown, chargedAmount: number): OrderFlowError | null {
  const current = pricingFromOrder(order);
  if (!current.lines.length) return pricingMismatchError();

  for (const line of current.lines) {
    if (!isPositivePrice(line.unitPrice)) return zeroPriceError();
  }

  const summed = roundMoney(current.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
  if (!moneyEquals(summed, current.itemTotal)) return pricingMismatchError();

  const locked = storedLock(order);
  if (locked && !locksEqual(locked, current)) return pricingMismatchError();

  if (!moneyEquals(chargedAmount, payableAmount(current))) return pricingMismatchError();
  return null;
}
