import { describe, expect, it } from "vitest";
import { decorateOrder, isLiveTrackableOrder } from "./orders";
import type { Order } from "@/types";

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: "SEL1",
    date: "1 Jan 2026",
    status: "Confirmed",
    statusIndex: 1,
    eta: "Arriving in 12 min",
    delivery: 0,
    discount: 0,
    sub: 100,
    total: 100,
    payment: "UPI",
    paymentStatus: "paid",
    addr: { type: "Home", name: "Test", line: "Line", area: "Area" },
    items: [],
    ...overrides,
  };
}

describe("isLiveTrackableOrder", () => {
  it("is true only for paid or COD in-flight orders", () => {
    expect(isLiveTrackableOrder(makeOrder({ paymentStatus: "paid" }))).toBe(true);
    expect(isLiveTrackableOrder(makeOrder({ paymentStatus: "cod_pending" }))).toBe(true);
    expect(isLiveTrackableOrder(makeOrder({ paymentStatus: "pending" }))).toBe(false);
    expect(isLiveTrackableOrder(makeOrder({ paymentStatus: "failed" }))).toBe(false);
    expect(isLiveTrackableOrder(makeOrder({ paymentStatus: undefined }))).toBe(false);
  });

  it("excludes cancelled and delivered orders", () => {
    expect(
      isLiveTrackableOrder(makeOrder({ status: "Cancelled", statusIndex: -1, paymentStatus: "paid" })),
    ).toBe(false);
    expect(
      isLiveTrackableOrder(makeOrder({ status: "Delivered", statusIndex: 4, paymentStatus: "paid" })),
    ).toBe(false);
  });
});

describe("decorateOrder", () => {
  it("allows cancellation for Placed/Confirmed/Packed (statusIndex 0-2)", () => {
    for (const statusIndex of [0, 1, 2]) {
      expect(decorateOrder(makeOrder({ statusIndex })).canCancel).toBe(true);
    }
  });

  it("disallows cancellation once out for delivery or delivered", () => {
    for (const statusIndex of [3, 4]) {
      expect(decorateOrder(makeOrder({ statusIndex })).canCancel).toBe(false);
    }
  });

  it("marks a cancelled order as non-cancellable with no active/done timeline steps", () => {
    const decorated = decorateOrder(makeOrder({ status: "Cancelled", statusIndex: -1 }));
    expect(decorated.cancelled).toBe(true);
    expect(decorated.canCancel).toBe(false);
    expect(decorated.timeline.every((s) => !s.done && !s.active)).toBe(true);
  });

  it("marks the correct timeline steps done/active", () => {
    const decorated = decorateOrder(makeOrder({ statusIndex: 2 }));
    expect(decorated.timeline.map((s) => s.done)).toEqual([true, true, true, false, false]);
    expect(decorated.timeline.map((s) => s.active)).toEqual([false, false, true, false, false]);
  });

  it("colors delivered orders green and everything else in-progress amber (except cancelled)", () => {
    expect(decorateOrder(makeOrder({ status: "Delivered", statusIndex: 4 })).statusColor).toBe("#5E8C3A");
    expect(decorateOrder(makeOrder({ status: "Cancelled", statusIndex: -1 })).statusColor).toBe("#e4572e");
    expect(decorateOrder(makeOrder({ statusIndex: 1 })).statusColor).toBe("#c98a3a");
  });
});
