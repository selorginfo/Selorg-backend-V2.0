/**
 * Live HTTP API audit against running selorg-service.
 * Does not print secrets/tokens/OTPs. Writes JSON results.
 *
 * Usage: node scripts/live-api-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3333';
const OUT = path.join(ROOT, 'docs', 'live-api-audit-results.json');

const TEST_PHONE = process.env.OTP_TEST_MOBILE || '9698790921';
const TEST_OTP = process.env.OTP_TEST_OTP || '8790';
const ADMIN_EMAIL = process.env.AUDIT_ADMIN_EMAIL || 'superadmin@selorg.com';
const ADMIN_PASSWORD = process.env.AUDIT_ADMIN_PASSWORD || 'Selorg@2024';

const results = [];
let customerToken = null;
let pickerToken = null;
let hhdToken = null;
let adminToken = null;
let lastOrderId = null;
let lastCartSnapshot = null;

function mask(s) {
  if (!s) return s;
  const str = String(s);
  if (str.length <= 8) return '***';
  return `${str.slice(0, 4)}…${str.slice(-4)}`;
}

function classify(http, expectedOk, notes, body) {
  if (expectedOk === 'auth_check') {
    if (http === 401 || http === 403) return 'PASS';
    if (http >= 200 && http < 300) return 'FAIL';
    return 'PARTIAL';
  }
  if (expectedOk === true) {
    if (http >= 200 && http < 300) return 'PASS';
    if (http === 404 || http === 409 || http === 422) return 'PARTIAL';
    if (http === 401 || http === 403) return 'PARTIAL';
    if (http >= 500) return 'FAIL';
    return 'PARTIAL';
  }
  if (expectedOk === false) {
    if (http >= 400 && http < 500) return 'PASS';
    if (http >= 200 && http < 300) return 'FAIL';
    return 'PARTIAL';
  }
  return 'NOT_TESTED';
}

async function req(method, endpoint, { body, token, headers = {}, expectOk = true, test = 'happy', module = '' } = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE}${endpoint}`;
  const h = { Accept: 'application/json', ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;

  let http = 0;
  let actual = '';
  let json = null;
  let errMsg = '';
  try {
    const res = await fetch(url, {
      method,
      headers: h,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    http = res.status;
    const text = await res.text();
    try {
      json = JSON.parse(text);
      actual = JSON.stringify(json).slice(0, 400);
    } catch {
      actual = text.slice(0, 400);
    }
  } catch (e) {
    errMsg = e.message;
    actual = `NETWORK_ERROR: ${errMsg}`;
    http = 0;
  }

  // Strip secrets from stored actual
  actual = actual
    .replace(/"(token|accessToken|refreshToken|otp|password|authorization)"\s*:\s*"[^"]*"/gi, '"$1":"***"')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***');

  const status = http === 0 ? 'BLOCKED' : classify(http, expectOk, test, json);
  const row = {
    method,
    endpoint,
    module,
    test,
    expected: expectOk === true ? '2xx success / valid business response' : expectOk === false ? '4xx client error' : String(expectOk),
    actual: actual || '(empty)',
    http,
    status,
    notes: errMsg || '',
  };
  results.push(row);
  process.stdout.write(`${status.padEnd(10)} ${String(http).padEnd(4)} ${method.padEnd(6)} ${endpoint} [${test}]\n`);
  return { http, json, status, row };
}

async function waitHealthy(retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function main() {
  console.log(`Auditing ${BASE}`);
  const up = await waitHealthy();
  if (!up) {
    console.error('Server not healthy — aborting live tests');
    results.push({
      method: 'GET',
      endpoint: '/health',
      module: 'health',
      test: 'server-up',
      expected: '200',
      actual: 'unreachable',
      http: 0,
      status: 'BLOCKED',
      notes: 'Backend not reachable on AUDIT_BASE_URL',
    });
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ summary: summarize(), results }, null, 2));
    process.exit(2);
  }

  // ── Health ──────────────────────────────────────────────────────────────
  await req('GET', '/health', { module: 'health', test: 'health' });
  await req('GET', '/healthz', { module: 'health', test: 'healthz' });
  await req('GET', '/health/db', { module: 'health', test: 'health-db' });
  await req('GET', '/health/ready', { module: 'health', test: 'health-ready' });

  // ── Negative: missing auth ──────────────────────────────────────────────
  await req('GET', '/api/v1/customer/user/profile', { expectOk: 'auth_check', module: 'user', test: 'missing-auth' });
  await req('GET', '/api/v1/customer/orders', { expectOk: 'auth_check', module: 'orders', test: 'missing-auth' });
  await req('GET', '/api/v1/customer/cart', { expectOk: 'auth_check', module: 'cart', test: 'missing-auth' });
  await req('GET', '/api/v1/picker/user/profile', { expectOk: 'auth_check', module: 'picker', test: 'missing-auth' });
  await req('GET', '/api/v1/picker/shared-orders', { expectOk: 'auth_check', module: 'picker', test: 'missing-auth' });
  await req('GET', '/api/v1/hhd/orders', { expectOk: 'auth_check', module: 'hhd', test: 'missing-auth' });
  await req('GET', '/api/v1/admin/users/me', { expectOk: 'auth_check', module: 'admin', test: 'missing-auth' });
  await req('GET', '/api/v1/rider/dispatch/unassigned', { expectOk: 'auth_check', module: 'rider', test: 'missing-auth' });

  // ── Negative: invalid token ─────────────────────────────────────────────
  await req('GET', '/api/v1/customer/user/profile', {
    token: 'invalid.jwt.token',
    expectOk: 'auth_check',
    module: 'user',
    test: 'invalid-token',
  });
  await req('GET', '/api/v1/admin/users/me', {
    token: 'invalid.jwt.token',
    expectOk: 'auth_check',
    module: 'admin',
    test: 'invalid-token',
  });
  await req('GET', '/api/v1/picker/user/profile', {
    token: 'invalid.jwt.token',
    expectOk: 'auth_check',
    module: 'picker',
    test: 'invalid-token',
  });

  // ── Negative: validation ────────────────────────────────────────────────
  await req('POST', '/api/v1/customer/auth/send-otp', {
    body: {},
    expectOk: false,
    module: 'auth',
    test: 'empty-payload',
  });
  await req('POST', '/api/v1/customer/auth/send-otp', {
    body: { phoneNumber: '123' },
    expectOk: false,
    module: 'auth',
    test: 'invalid-phone',
  });
  await req('POST', '/api/v1/customer/auth/verify-otp', {
    body: {},
    expectOk: false,
    module: 'auth',
    test: 'empty-verify',
  });
  await req('POST', '/api/v1/admin/auth/login', {
    body: {},
    expectOk: false,
    module: 'admin',
    test: 'empty-login',
  });
  await req('POST', '/api/v1/admin/auth/login', {
    body: { email: 'nobody@example.com', password: 'wrong-password' },
    expectOk: false,
    module: 'admin',
    test: 'bad-credentials',
  });

  // ── Public customer catalog ─────────────────────────────────────────────
  await req('GET', '/api/v1/customer/categories', { module: 'categories', test: 'list' });
  await req('GET', '/api/v1/customer/products?page=1&limit=5', { module: 'products', test: 'list' });
  await req('GET', '/api/v1/customer/banners', { module: 'banners', test: 'list' });
  await req('GET', '/api/v1/customer/faq', { module: 'faq', test: 'list' });
  await req('GET', '/api/v1/customer/home', { module: 'home', test: 'home' });
  await req('GET', '/api/v1/customer/bootstrap', { module: 'bootstrap', test: 'bootstrap' });
  await req('GET', '/api/v1/customer/app-config', { module: 'app-config', test: 'config' });
  await req('GET', '/api/v1/customer/legal/terms', { module: 'legal', test: 'terms' });
  await req('GET', '/api/v1/customer/delivery/estimate?lat=13.0067&lng=80.257', { module: 'delivery', test: 'estimate' });
  await req('GET', '/api/v1/customer/locations?lat=13.0067&lng=80.257', { module: 'locations', test: 'nearby' });
  await req('GET', '/api/v1/customer/search?q=tomato', { module: 'products', test: 'search' });
  await req('GET', '/api/v1/customer/collections', { module: 'collections', test: 'list' });
  await req('GET', '/api/v1/customer/onboarding', { module: 'onboarding', test: 'list' });
  await req('GET', '/api/v1/customer/pages', { module: 'pages', test: 'list' });
  await req('GET', '/api/v1/shared/health', { module: 'shared', test: 'shared-health' });
  await req('GET', '/api/v1/picker/config', { module: 'picker', test: 'public-config' });
  await req('GET', '/api/v1/picker/faq', { module: 'picker', test: 'faq' });
  await req('GET', '/api/v1/picker/legal/terms', { module: 'picker', test: 'terms' });
  await req('GET', '/api/v1/picker/samples', { module: 'picker', test: 'samples-public-stub' });

  // ── Stub / mock surface checks ──────────────────────────────────────────
  await req('GET', '/api/v1/admin/system/instances', {
    token: 'x',
    expectOk: 'auth_check',
    module: 'admin',
    test: 'stub-requires-auth',
  });

  // ── Customer auth (fixed test OTP in non-prod) ──────────────────────────
  const sendOtp = await req('POST', '/api/v1/customer/auth/send-otp', {
    body: { phoneNumber: TEST_PHONE, channel: 'sms', intent: 'login' },
    module: 'auth',
    test: 'send-otp',
  });
  // Non-prod may return 200 even if SMS fails when test OTP is allowed
  const verify = await req('POST', '/api/v1/customer/auth/verify-otp', {
    body: { phoneNumber: TEST_PHONE, otp: TEST_OTP, channel: 'sms' },
    module: 'auth',
    test: 'verify-otp',
  });
  customerToken =
    verify.json?.data?.token ||
    verify.json?.data?.accessToken ||
    verify.json?.token ||
    verify.json?.accessToken ||
    null;
  if (!customerToken && verify.json?.data?.tokens?.accessToken) {
    customerToken = verify.json.data.tokens.accessToken;
  }
  if (!customerToken) {
    // try signup intent if login failed
    await req('POST', '/api/v1/customer/auth/send-otp', {
      body: { phoneNumber: TEST_PHONE, channel: 'sms', intent: 'signup' },
      module: 'auth',
      test: 'send-otp-signup',
    });
    const verify2 = await req('POST', '/api/v1/customer/auth/verify-otp', {
      body: { phoneNumber: TEST_PHONE, otp: TEST_OTP, channel: 'sms' },
      module: 'auth',
      test: 'verify-otp-signup',
    });
    customerToken =
      verify2.json?.data?.token ||
      verify2.json?.data?.accessToken ||
      verify2.json?.data?.tokens?.accessToken ||
      null;
  }

  if (customerToken) {
    await req('GET', '/api/v1/customer/user/profile', { token: customerToken, module: 'user', test: 'profile' });
    await req('GET', '/api/v1/customer/addresses', { token: customerToken, module: 'addresses', test: 'list' });
    await req('GET', '/api/v1/customer/cart', { token: customerToken, module: 'cart', test: 'get' });
    await req('GET', '/api/v1/customer/orders', { token: customerToken, module: 'orders', test: 'list' });
    await req('GET', '/api/v1/customer/wallet', { token: customerToken, module: 'wallet', test: 'get' });
    await req('GET', '/api/v1/customer/coupons', { token: customerToken, module: 'coupons', test: 'list' });
    await req('GET', '/api/v1/customer/notifications', { token: customerToken, module: 'notifications', test: 'list' });
    await req('GET', '/api/v1/customer/refunds', { token: customerToken, module: 'refunds', test: 'list' });
    await req('GET', '/api/v1/customer/payments/methods', { token: customerToken, module: 'payments', test: 'methods' });
    await req('GET', '/api/v1/customer/support/tickets', { token: customerToken, module: 'support', test: 'tickets' });

    // Invalid ID
    await req('GET', '/api/v1/customer/orders/000000000000000000000000', {
      token: customerToken,
      expectOk: false,
      module: 'orders',
      test: 'nonexistent-id',
    });
    await req('GET', '/api/v1/customer/orders/not-an-id', {
      token: customerToken,
      expectOk: false,
      module: 'orders',
      test: 'invalid-id',
    });

    // Cart mutation with invalid product
    await req('POST', '/api/v1/customer/cart/items', {
      token: customerToken,
      body: {},
      expectOk: false,
      module: 'cart',
      test: 'empty-add',
    });
    await req('POST', '/api/v1/customer/cart/items', {
      token: customerToken,
      body: { productId: '000000000000000000000000', quantity: 1 },
      expectOk: false,
      module: 'cart',
      test: 'bad-product',
    });

    // Try add real product if catalog has one
    const products = await req('GET', '/api/v1/customer/products?page=1&limit=1', {
      module: 'products',
      test: 'pick-product',
    });
    const product =
      products.json?.data?.products?.[0] ||
      products.json?.data?.items?.[0] ||
      products.json?.data?.[0] ||
      null;
    const productId = product?._id || product?.id || product?.productId;
    if (productId) {
      const add = await req('POST', '/api/v1/customer/cart/items', {
        token: customerToken,
        body: { productId, quantity: 1 },
        module: 'cart',
        test: 'add-item',
      });
      lastCartSnapshot = add.json;
      const orderAttempt = await req('POST', '/api/v1/customer/orders', {
        token: customerToken,
        body: {
          paymentMethod: { methodType: 'cash', instrument: 'COD', displayLabel: 'Cash', paymentMode: 'cod' },
          deliveryType: 'standard',
        },
        module: 'orders',
        test: 'create-order',
      });
      lastOrderId =
        orderAttempt.json?.data?.order?._id ||
        orderAttempt.json?.data?._id ||
        orderAttempt.json?.data?.orderId ||
        null;
      if (lastOrderId) {
        await req('GET', `/api/v1/customer/orders/${lastOrderId}`, {
          token: customerToken,
          module: 'orders',
          test: 'get-created-order',
        });
      }
    } else {
      results.push({
        method: 'POST',
        endpoint: '/api/v1/customer/orders',
        module: 'orders',
        test: 'create-order',
        expected: 'order created',
        actual: 'No catalog product available to seed cart',
        http: 0,
        status: 'BLOCKED',
        notes: 'Prerequisite catalog data missing',
      });
    }
  } else {
    results.push({
      method: 'POST',
      endpoint: '/api/v1/customer/auth/verify-otp',
      module: 'auth',
      test: 'customer-customer-token',
      expected: 'token issued',
      actual: `send=${sendOtp.http} verify=${verify.http}`,
      http: verify.http,
      status: 'BLOCKED',
      notes: 'Could not obtain customer JWT via test OTP flow',
    });
  }

  // Cross-module token misuse: customer token on admin
  if (customerToken) {
    await req('GET', '/api/v1/admin/users/me', {
      token: customerToken,
      expectOk: 'auth_check',
      module: 'admin',
      test: 'customer-token-on-admin',
    });
    await req('GET', '/api/v1/picker/user/profile', {
      token: customerToken,
      expectOk: 'auth_check',
      module: 'picker',
      test: 'customer-token-on-picker',
    });
  }

  // ── Admin auth ──────────────────────────────────────────────────────────
  const adminLogin = await req('POST', '/api/v1/admin/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    module: 'admin',
    test: 'login',
  });
  adminToken =
    adminLogin.json?.data?.token ||
    adminLogin.json?.data?.accessToken ||
    adminLogin.json?.token ||
    null;

  if (adminToken) {
    await req('GET', '/api/v1/admin/users/me', { token: adminToken, module: 'admin', test: 'me' });
    await req('GET', '/api/v1/admin/customers?page=1&limit=5', { token: adminToken, module: 'admin', test: 'customers' });
    await req('GET', '/api/v1/admin/orders?page=1&limit=5', { token: adminToken, module: 'admin', test: 'orders' });
    await req('GET', '/api/v1/rider/dispatch/unassigned', { token: adminToken, module: 'rider', test: 'dispatch-unassigned' });
    await req('GET', '/api/v1/admin/analytics/revenue', { token: adminToken, module: 'admin', test: 'analytics-revenue' });
    await req('GET', '/api/v1/admin/system/instances', { token: adminToken, module: 'admin', test: 'system-instances-stub' });
    await req('GET', '/api/v1/admin/system/cache/stats', { token: adminToken, module: 'admin', test: 'cache-stats-stub' });
    await req('GET', '/api/v1/admin/applications', { token: adminToken, module: 'admin', test: 'applications-stub' });
    await req('GET', '/api/v1/darkstore/stores', { token: adminToken, module: 'darkstore', test: 'stores' });
    await req('GET', '/api/v1/warehouse/inventory', { token: adminToken, module: 'warehouse', test: 'inventory' });
    await req('GET', '/api/v1/admin/vendor/vendors', { token: adminToken, module: 'vendor', test: 'vendors' });
    await req('GET', '/api/v1/admin/finance/overview', { token: adminToken, module: 'finance', test: 'overview' });
    await req('GET', '/api/v1/admin/picker/pickers', { token: adminToken, module: 'picker', test: 'admin-pickers' });
    await req('GET', '/api/v1/admin/staff', { token: adminToken, module: 'staff', test: 'list' });
    await req('GET', '/api/v1/logistics/analytics/overview', { token: adminToken, module: 'logistics', test: 'analytics' });

    // Role / foreign token: admin on picker-protected (should fail if aud enforced)
    await req('GET', '/api/v1/picker/shared-orders', {
      token: adminToken,
      expectOk: 'auth_check',
      module: 'picker',
      test: 'admin-token-on-picker',
    });
  } else {
    results.push({
      method: 'POST',
      endpoint: '/api/v1/admin/auth/login',
      module: 'admin',
      test: 'obtain-admin-token',
      expected: 'token',
      actual: `http=${adminLogin.http}`,
      http: adminLogin.http,
      status: 'BLOCKED',
      notes: 'Admin login failed — check seed-superadmin credentials',
    });
  }

  // ── Picker / rider mobile auth ──────────────────────────────────────────
  const pickerSend = await req('POST', '/api/v1/picker/auth/send-otp', {
    body: { phone: TEST_PHONE },
    module: 'picker',
    test: 'send-otp',
  });
  // Picker may not support fixed test OTP — attempt verify anyway; mark BLOCKED if fails
  const pickerVerify = await req('POST', '/api/v1/picker/auth/verify-otp', {
    body: { phone: TEST_PHONE, otp: TEST_OTP },
    module: 'picker',
    test: 'verify-otp',
  });
  pickerToken =
    pickerVerify.json?.data?.token ||
    pickerVerify.json?.data?.accessToken ||
    pickerVerify.json?.data?.tokens?.accessToken ||
    null;

  if (pickerToken) {
    await req('GET', '/api/v1/picker/user/profile', { token: pickerToken, module: 'picker', test: 'profile' });
    await req('GET', '/api/v1/picker/home', { token: pickerToken, module: 'picker', test: 'home' });
    await req('GET', '/api/v1/picker/wallet', { token: pickerToken, module: 'picker', test: 'wallet' });
    await req('GET', '/api/v1/picker/shared-orders', { token: pickerToken, module: 'picker', test: 'shared-orders' });
    await req('GET', '/api/v1/picker/onboarding/state', { token: pickerToken, module: 'picker', test: 'onboarding' });
    await req('GET', '/api/v1/picker/shifts/available', { token: pickerToken, module: 'picker', test: 'shifts' });
    await req('GET', '/api/v1/picker/cash/summary', { token: pickerToken, module: 'picker', test: 'cash-summary' });
    await req('GET', '/api/v1/picker/bulk/batch', { token: pickerToken, module: 'picker', test: 'bulk-batch' });
  } else {
    results.push({
      method: 'POST',
      endpoint: '/api/v1/picker/auth/verify-otp',
      module: 'picker',
      test: 'obtain-picker-token',
      expected: 'picker JWT',
      actual: `send=${pickerSend.http} verify=${pickerVerify.http}`,
      http: pickerVerify.http,
      status: 'BLOCKED',
      notes: 'Picker/rider OTP requires real SMS delivery (no fixed test OTP). sendHttp=' + pickerSend.http,
    });
  }

  // ── HHD auth ────────────────────────────────────────────────────────────
  const hhdSend = await req('POST', '/api/v1/hhd/auth/send-otp', {
    body: { phone: TEST_PHONE },
    module: 'hhd',
    test: 'send-otp',
  });
  const hhdVerify = await req('POST', '/api/v1/hhd/auth/verify-otp', {
    body: { phone: TEST_PHONE, otp: TEST_OTP },
    module: 'hhd',
    test: 'verify-otp',
  });
  hhdToken =
    hhdVerify.json?.data?.token ||
    hhdVerify.json?.data?.accessToken ||
    hhdVerify.json?.token ||
    null;
  if (hhdToken) {
    await req('GET', '/api/v1/hhd/orders', { token: hhdToken, module: 'hhd', test: 'orders' });
    await req('GET', '/api/v1/hhd/dashboard', { token: hhdToken, module: 'hhd', test: 'dashboard' });
    await req('GET', '/api/v1/hhd/users/me', { token: hhdToken, module: 'hhd', test: 'me' });
  } else {
    results.push({
      method: 'POST',
      endpoint: '/api/v1/hhd/auth/verify-otp',
      module: 'hhd',
      test: 'obtain-hhd-token',
      expected: 'hhd JWT',
      actual: `send=${hhdSend.http} verify=${hhdVerify.http}`,
      http: hhdVerify.http,
      status: 'BLOCKED',
      notes: 'HHD OTP requires real SMS / seeded HHD user',
    });
  }

  // ── Diag (non-prod) ─────────────────────────────────────────────────────
  await req('GET', '/api/v1/diag/order-flow', { module: 'diag', test: 'order-flow' });
  await req('GET', '/api/v1/diag/hubs', { module: 'diag', test: 'hubs' });

  // ── Didit stub ──────────────────────────────────────────────────────────
  await req('POST', '/api/v1/picker/didit/webhook', {
    body: { event: 'test' },
    module: 'picker',
    test: 'didit-webhook-stub',
  });

  // ── Malformed JSON ──────────────────────────────────────────────────────
  {
    const url = `${BASE}/api/v1/customer/auth/send-otp`;
    let http = 0;
    let actual = '';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not-json',
      });
      http = res.status;
      actual = (await res.text()).slice(0, 300);
    } catch (e) {
      actual = e.message;
    }
    results.push({
      method: 'POST',
      endpoint: '/api/v1/customer/auth/send-otp',
      module: 'auth',
      test: 'malformed-json',
      expected: '4xx',
      actual,
      http,
      status: http >= 400 && http < 500 ? 'PASS' : http >= 200 && http < 300 ? 'FAIL' : 'PARTIAL',
      notes: '',
    });
    process.stdout.write(`${results[results.length - 1].status.padEnd(10)} ${String(http).padEnd(4)} POST   /api/v1/customer/auth/send-otp [malformed-json]\n`);
  }

  const summary = summarize();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        base: BASE,
        generatedAt: new Date().toISOString(),
        tokensObtained: {
          customer: Boolean(customerToken),
          admin: Boolean(adminToken),
          picker: Boolean(pickerToken),
          hhd: Boolean(hhdToken),
        },
        lastOrderId: lastOrderId ? mask(String(lastOrderId)) : null,
        summary,
        results,
      },
      null,
      2,
    ),
  );
  console.log('\nSUMMARY', summary);
  console.log('Wrote', OUT);
}

function summarize() {
  const s = { PASS: 0, FAIL: 0, PARTIAL: 0, BLOCKED: 0, NOT_TESTED: 0, total: results.length };
  for (const r of results) s[r.status] = (s[r.status] || 0) + 1;
  return s;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
