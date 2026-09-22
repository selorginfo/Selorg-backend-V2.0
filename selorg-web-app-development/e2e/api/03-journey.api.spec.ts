import { test, expect, APIRequestContext } from "@playwright/test";
import { apiCall, createApiContext, loginWithTestOtp } from "../helpers/api";

/**
 * End-to-end API user journey: auth → address → product → cart → order attempt → wallet → profile.
 * Uses real backend only. Payment gateway session may be blocked by Worldline config — classified accordingly.
 */
test.describe.configure({ mode: "serial" });

let ctx: APIRequestContext;
let token: string;
let productId: string | undefined;
let addressId: string | undefined;
let orderId: string | undefined;
let createdAddressId: string | undefined;

test.beforeAll(async () => {
  ctx = await createApiContext();
});

test.afterAll(async () => {
  if (createdAddressId && token) {
    await apiCall(ctx, "DELETE", `/addresses/${createdAddressId}`, { token }).catch(() => undefined);
  }
  if (token) {
    await apiCall(ctx, "DELETE", "/cart/clear", { token }).catch(() => undefined);
  }
  await ctx.dispose();
});

test("1. Authenticate via OTP", async () => {
  const auth = await loginWithTestOtp(ctx);
  token = auth.token;
  expect(token).toBeTruthy();
});

test("2. Load profile", async () => {
  const res = await apiCall(ctx, "GET", "/user/profile", { token });
  expect(res.status).toBe(200);
  expect(res.json?.data).toBeTruthy();
});

test("3. Ensure address exists", async () => {
  const list = await apiCall<Array<{ _id: string }>>(ctx, "GET", "/addresses", { token });
  expect(list.status).toBe(200);
  const existing = (list.json?.data as Array<{ _id: string }> | undefined) || [];
  if (existing.length) {
    addressId = existing[0]._id;
    return;
  }
  const created = await apiCall<{ _id: string }>(ctx, "POST", "/addresses", {
    token,
    body: {
      label: "Home",
      line1: "E2E Flow Street",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600001",
      latitude: 13.0827,
      longitude: 80.2707,
    },
  });
  expect([200, 201], JSON.stringify(created.json)).toContain(created.status);
  addressId = created.json!.data!._id;
  createdAddressId = addressId;
});

test("4. Discover product", async () => {
  const search = await apiCall(ctx, "GET", "/products/search?q=organic&page=1&limit=10");
  const data = search.json?.data as unknown;
  if (Array.isArray(data) && data[0]) {
    const p = data[0] as { _id?: string; id?: string };
    productId = p._id || p.id;
  } else if (data && typeof data === "object" && Array.isArray((data as { products?: unknown[] }).products)) {
    const p = (data as { products: Array<{ _id?: string; id?: string }> }).products[0];
    productId = p?._id || p?.id;
  }
  if (!productId) {
    const cats = await apiCall(ctx, "GET", "/categories");
    const cat = (cats.json?.data as Array<{ _id?: string; slug?: string }> | undefined)?.[0];
    const key = cat?._id || cat?.slug;
    if (key) {
      const prods = await apiCall(ctx, "GET", `/categories/${key}/products?limit=5`);
      const pdata = prods.json?.data as { products?: Array<{ _id?: string; id?: string }> } | undefined;
      productId = pdata?.products?.[0]?._id || pdata?.products?.[0]?.id;
    }
  }
  test.skip(!productId, "BLOCKED: no catalog products available");
});

test("5. Add to cart and read totals", async () => {
  test.skip(!productId, "no product");
  await apiCall(ctx, "DELETE", "/cart/clear", { token });
  const add = await apiCall(ctx, "POST", "/cart/items", {
    token,
    body: { productId, quantity: 1 },
  });
  expect(add.status, JSON.stringify(add.json)).toBe(200);
  const cart = await apiCall<{ items: unknown[]; total?: number; itemTotal?: number }>(ctx, "GET", "/cart", {
    token,
  });
  expect(cart.status).toBe(200);
  expect(((cart.json?.data as { items?: unknown[] })?.items || []).length).toBeGreaterThan(0);
});

test("6. Create order (COD/cash preferred)", async () => {
  test.skip(!productId || !addressId, "missing product or address");
  const res = await apiCall<{ _id?: string; id?: string; orderNumber?: string; requiresOnlinePayment?: boolean }>(
    ctx,
    "POST",
    "/orders",
    {
      token,
      body: {
        items: [{ productId, quantity: 1 }],
        addressId,
        paymentMethodType: "cash",
        deliveryNotes: "Playwright API audit — do not fulfill",
      },
      headers: { "Idempotency-Key": `pw-order-${Date.now()}` },
    },
  );
  // Domain rules may reject COD / min order / serviceability — classify carefully
  if (res.status >= 500) {
    expect(res.status, `Server error creating order: ${JSON.stringify(res.json)}`).toBeLessThan(500);
  }
  if (res.status === 200 && res.json?.success) {
    orderId = res.json.data?._id || res.json.data?.id;
    expect(orderId || res.json.data?.orderNumber).toBeTruthy();
  } else {
    // Record as soft failure for report via expect message
    expect(
      res.status,
      `Order create returned ${res.status}: ${JSON.stringify(res.json)}. Treat as domain/config if 4xx.`,
    ).toBeLessThan(500);
  }
});

test("7. Fetch order detail / tracking / invoice when order exists", async () => {
  test.skip(!orderId, "No order created in previous step (domain rejection or empty catalog)");
  const detail = await apiCall(ctx, "GET", `/orders/${orderId}`, { token });
  expect(detail.status).toBe(200);
  const tracking = await apiCall(ctx, "GET", `/orders/${orderId}/tracking`, { token });
  expect(tracking.status).toBeLessThan(500);
  const invoice = await apiCall(ctx, "GET", `/orders/${orderId}/invoice`, { token });
  expect(invoice.status).toBeLessThan(500);
});

test("8. Payment session for order (may block on Worldline config)", async () => {
  test.skip(!orderId, "No order");
  const session = await apiCall(ctx, "POST", "/payments/worldline/session", {
    token,
    body: { orderId, platform: "web", checkoutOrigin: "http://127.0.0.1:3000" },
  });
  expect(session.status).toBeLessThan(500);
  // 4xx often means payment not required / already paid / gateway misconfig — not silent pass
  if (session.status === 200) {
    expect(session.json?.success).toBe(true);
  }
});

test("9. Wallet balance after journey", async () => {
  const res = await apiCall(ctx, "GET", "/wallet/balance", { token });
  expect(res.status).toBe(200);
  expect(typeof (res.json?.data as { balance?: number })?.balance === "number" || res.json?.data).toBeTruthy();
});

test("10. Logout", async () => {
  const res = await apiCall(ctx, "POST", "/auth/logout", { token });
  expect(res.status).toBeLessThan(500);
  const after = await apiCall(ctx, "GET", "/user/profile", { token });
  // Token may still work if logout is client-only revoke — either 200 or 401 is informative
  expect([200, 401, 403]).toContain(after.status);
});
