import {
  clientPriceEditError,
  exceedsOpenOrderLimit,
  findClientPriceEdits,
  isPositivePrice,
  matchOrderPayment,
  moneyEquals,
  payableAmount,
  pricingFromOrder,
} from './order-pricing-guard';

const lock = {
  lines: [
    { productId: 'p1', variantId: 'v1', quantity: 2, unitPrice: 40 },
    { productId: 'p2', variantId: '', quantity: 1, unitPrice: 25.5 },
  ],
  itemTotal: 105.5,
  totalTax: 5,
  handlingCharge: 2,
  deliveryFee: 20,
  deliveryTip: 10,
  discount: 15,
  walletDeduction: 0,
  onlineAmountDue: 0,
  totalBill: 122.5,
};

function orderWith(overrides: Record<string, unknown> = {}) {
  return {
    items: lock.lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      price: line.unitPrice,
    })),
    ...lock,
    pricingLock: lock,
    ...overrides,
  };
}

describe('order pricing guard', () => {
  it('blocks a client price on the order or on a line', () => {
    expect(findClientPriceEdits({ items: [{ productId: 'p1', quantity: 1 }], deliveryTip: 10 })).toEqual([]);
    expect(findClientPriceEdits({ totalBill: 1, items: [{ productId: 'p1', price: 0 }] })).toEqual([
      'totalBill',
      'items.0.price',
    ]);
    expect(clientPriceEditError({ amount: 10 })?.statusCode).toBe(429);
  });

  it('rejects a zero item price and more than 3 open orders', () => {
    expect(isPositivePrice(0)).toBe(false);
    expect(isPositivePrice(0.004)).toBe(false);
    expect(isPositivePrice(12)).toBe(true);
    expect(exceedsOpenOrderLimit(2)).toBe(false);
    expect(exceedsOpenOrderLimit(3)).toBe(true);
  });

  it('matches placement pricing to the payment amount', () => {
    expect(moneyEquals(10.1, 10.1)).toBe(true);
    expect(payableAmount(lock)).toBe(122.5);
    expect(matchOrderPayment(orderWith(), 122.5)).toBeNull();
    expect(payableAmount(pricingFromOrder(orderWith({ walletDeduction: 100, onlineAmountDue: 22.5 })))).toBe(22.5);
  });

  it('returns 429 when the confirmed amount or a line price differs', () => {
    expect(matchOrderPayment(orderWith(), 1)?.statusCode).toBe(429);
    const edited = orderWith();
    edited.items[0].price = 1;
    expect(matchOrderPayment(edited, 122.5)?.code).toBe('PRICING_MISMATCH');
    const zeroed = orderWith();
    zeroed.items[0].price = 0;
    zeroed.itemTotal = 25.5;
    zeroed.pricingLock = { ...lock, itemTotal: 25.5, lines: lock.lines.map((line, i) => (i === 0 ? { ...line, unitPrice: 0 } : line)) };
    expect(matchOrderPayment(zeroed, 122.5)?.code).toBe('ZERO_PRICE');
  });
});
