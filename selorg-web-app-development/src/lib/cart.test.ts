import { describe, expect, it } from "vitest";
import { calculateTotals, getCartLines } from "./cart";
import type { Product } from "@/types";

const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Test Apple",
    cat: "fruits",
    sub: "Test",
    unit: "1 kg",
    price: 100,
    mrp: 120,
    rating: 4.5,
    sold: 10,
    bg: "#fff",
    brand: "Test",
    stock: true,
    best: false,
    only: 0,
    organic: true,
    discount: 17,
    photo: "",
    photos: [],
    variants: [
      { label: "1 kg", price: 100, mrp: 120 },
      { label: "Value pack", price: 180, mrp: 220 },
    ],
  },
];

describe("getCartLines", () => {
  it("resolves cart map entries to product/variant lines", () => {
    const lines = getCartLines({ p1: 2 }, {}, PRODUCTS);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ qty: 2, lineTotal: 200, lineMrpTotal: 240 });
  });

  it("skips zero/negative quantities and unknown product ids", () => {
    expect(getCartLines({ p1: 0, missing: 3 }, {}, PRODUCTS)).toHaveLength(0);
  });

  it("respects the selected variant index", () => {
    const lines = getCartLines({ p1: 1 }, { p1: 1 }, PRODUCTS);
    expect(lines[0]?.lineTotal).toBe(180);
  });
});

describe("calculateTotals", () => {
  const lines = getCartLines({ p1: 1 }, {}, PRODUCTS);

  it("charges delivery fee below the free-delivery threshold", () => {
    const totals = calculateTotals(lines, null, false, 0);
    expect(totals.sub).toBe(100);
    expect(totals.discount).toBe(20);
    expect(totals.delivery).toBe(40);
    expect(totals.handling).toBe(5);
    expect(totals.grand).toBe(145);
  });

  it("waives delivery fee at/above the free-delivery threshold", () => {
    const bigLines = getCartLines({ p1: 3 }, { p1: 1 }, PRODUCTS); // 3 x 180 = 540
    const totals = calculateTotals(bigLines, null, false, 0);
    expect(totals.sub).toBe(540);
    expect(totals.delivery).toBe(0);
  });

  it("applies a coupon, capped at the cart subtotal", () => {
    const totals = calculateTotals(lines, { code: "BIG50", amount: 500 }, false, 0);
    expect(totals.couponAmt).toBe(100);
    expect(totals.payable).toBe(45); // 100 - 100 + 40 delivery + 5 handling
  });

  it("uses wallet balance up to the payable amount, never going negative", () => {
    const totals = calculateTotals(lines, null, true, 1000);
    expect(totals.walletUsed).toBe(totals.payable);
    expect(totals.grand).toBe(0);
  });

  it("returns zeroed totals for an empty cart", () => {
    const totals = calculateTotals([], null, true, 500);
    expect(totals.sub).toBe(0);
    expect(totals.delivery).toBe(0);
    expect(totals.handling).toBe(0);
    expect(totals.walletUsed).toBe(0);
  });
});
