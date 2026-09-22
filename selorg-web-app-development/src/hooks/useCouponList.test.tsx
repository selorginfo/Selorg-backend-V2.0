import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";

const list = vi.hoisted(() => ({
  resolve: (): Promise<unknown[]> => new Promise(() => {}),
}));
vi.mock("@/services/couponService", () => ({
  couponService: { list: () => list.resolve() },
}));

const { useCouponList } = await import("@/hooks/useCouponList");

function Probe() {
  const { coupons } = useCouponList();
  return <div>{coupons.map((c) => c.code).join(",")}</div>;
}

describe("useCouponList", () => {
  it("renders nothing until GET /coupons answers, so SSR and hydration agree", async () => {
    list.resolve = () => new Promise(() => {});
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Probe />);
    document.body.appendChild(container);
    expect(container.textContent).toBe("");

    const recoverable: string[] = [];
    await act(async () => {
      hydrateRoot(container, <Probe />, {
        onRecoverableError: (e) => recoverable.push(String(e)),
      });
    });

    expect(recoverable.filter((e) => /hydrat/i.test(e))).toEqual([]);
    expect(container.textContent).toBe("");
  });

  it("renders exactly the coupons the backend returned — never a static fallback", async () => {
    list.resolve = async () => [
      { _id: "1", code: "REALCODE", displayName: "Real Coupon", discountType: "FLAT_DISCOUNT", discountValue: 50, minOrderValue: 100, eligible: true, ineligibilityReason: null },
    ];
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      hydrateRoot(container, <Probe />, { onRecoverableError: () => {} });
    });
    expect(container.textContent).toBe("REALCODE");
  });

  it("shows an empty strip when the backend has no active coupons", async () => {
    list.resolve = async () => [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      hydrateRoot(container, <Probe />, { onRecoverableError: () => {} });
    });
    expect(container.textContent).toBe("");
  });
});
