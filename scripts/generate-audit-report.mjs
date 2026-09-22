/**
 * Generates BACKEND_ARCHITECTURE_API_POSTMAN_AUDIT.md from inventory + live results.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSV = path.join(ROOT, 'docs', 'endpoint-inventory.tsv');
const LIVE = path.join(ROOT, 'docs', 'live-api-audit-results.json');
const OUT = path.join(ROOT, 'BACKEND_ARCHITECTURE_API_POSTMAN_AUDIT.md');

function parseTsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split('\t');
  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = line.split('\t');
    const row = {};
    header.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
}

const inventory = parseTsv(fs.readFileSync(TSV, 'utf8'));
const live = fs.existsSync(LIVE) ? JSON.parse(fs.readFileSync(LIVE, 'utf8')) : { results: [], summary: {} };

// Manual deep-test results collected during this audit (evidence-backed).
const deepTests = [
  { method: 'GET', endpoint: '/health', test: 'health', expected: '200 healthy', actual: '200 {"status":"healthy","service":"selorg-service"}', http: 200, status: 'PASS', notes: 'Live' },
  { method: 'GET', endpoint: '/health/db', test: 'db', expected: '200 healthy', actual: '200 status=healthy pool present', http: 200, status: 'PASS', notes: 'Mongo connected' },
  { method: 'GET', endpoint: '/health/ready', test: 'ready', expected: '200 ready', actual: '200 ready', http: 200, status: 'PASS', notes: '' },
  { method: 'POST', endpoint: '/api/v1/customer/auth/send-otp', test: 'send-otp', expected: '200 + sessionId', actual: '200 deliveryStatus=sent sessionId issued', http: 200, status: 'PASS', notes: 'Real provider path (non-prod)' },
  { method: 'POST', endpoint: '/api/v1/customer/auth/verify-otp', test: 'verify-with-sessionId+testOtp', expected: '200 + JWT', actual: '200 token issued for test mobile', http: 200, status: 'PASS', notes: 'Requires sessionId (not phoneNumber)' },
  { method: 'POST', endpoint: '/api/v1/customer/auth/verify-otp', test: 'verify-without-sessionId', expected: '422', actual: '422 validation', http: 422, status: 'PASS', notes: 'Negative validation' },
  { method: 'GET', endpoint: '/api/v1/customer/user/profile', test: 'authed-profile', expected: '200 profile', actual: '200 phoneNumber masked customer exists', http: 200, status: 'PASS', notes: 'Real DB customer' },
  { method: 'GET', endpoint: '/api/v1/customer/user/profile', test: 'missing-auth', expected: '401', actual: '401', http: 401, status: 'PASS', notes: '' },
  { method: 'GET', endpoint: '/api/v1/customer/cart', test: 'get-cart', expected: '200', actual: '200 empty then 1 item after add', http: 200, status: 'PASS', notes: '' },
  { method: 'POST', endpoint: '/api/v1/customer/cart/items', test: 'add-known-product', expected: '200 cart item', actual: '200 product Banganapalli Jackfruit qty=1 total=69', http: 200, status: 'PASS', notes: 'productId from prior order' },
  { method: 'POST', endpoint: '/api/v1/customer/cart/items', test: 'empty-body', expected: '4xx', actual: '422', http: 422, status: 'PASS', notes: '' },
  { method: 'POST', endpoint: '/api/v1/customer/cart/items', test: 'bad-product', expected: '4xx', actual: '400', http: 400, status: 'PASS', notes: '' },
  { method: 'GET', endpoint: '/api/v1/customer/orders', test: 'list', expected: '200 orders', actual: '200 includes ORD-20260909-00441', http: 200, status: 'PASS', notes: 'customer_orders' },
  { method: 'GET', endpoint: '/api/v1/customer/orders/:id', test: 'detail', expected: '200', actual: '200 orderNumber ORD-20260909-00441', http: 200, status: 'PASS', notes: '' },
  { method: 'GET', endpoint: '/api/v1/customer/orders/000000000000000000000000', test: 'missing', expected: '404', actual: '404', http: 404, status: 'PASS', notes: '' },
  { method: 'POST', endpoint: '/api/v1/customer/orders', test: 'create-without-items', expected: '422 items required', actual: '422 (schema requires items[])', http: 422, status: 'PASS', notes: 'Does not auto-checkout cart alone' },
  { method: 'POST', endpoint: '/api/v1/customer/orders', test: 'create-with-items', expected: '201 order created', actual: '201 ORD-20260911-00470 id=6aa3ae59… product Jackfruit total path real DB', http: 201, status: 'PASS', notes: 'Requires items[] + addressId' },
  { method: 'GET', endpoint: '/api/v1/customer/products', test: 'list', expected: 'catalog list OR documented absence', actual: '404 — no GET / route; only /search and /:id', http: 404, status: 'FAIL', notes: 'Missing list endpoint on products.routes.ts' },
  { method: 'GET', endpoint: '/api/v1/customer/banners', test: 'list', expected: 'banner list', actual: '404 — only GET /:id mounted', http: 404, status: 'FAIL', notes: 'Customer banner list missing' },
  { method: 'GET', endpoint: '/api/v1/customer/products/search?q=tomato', test: 'search', expected: '200 results', actual: '200 ~9 products', http: 200, status: 'PASS', notes: '' },
  { method: 'GET', endpoint: '/api/v1/customer/wallet', test: 'root', expected: 'balance or 404 documented', actual: '404; balance at /wallet/balance', http: 404, status: 'PARTIAL', notes: 'Path mismatch vs naive clients' },
  { method: 'GET', endpoint: '/api/v1/customer/wallet/balance', test: 'balance', expected: '200', actual: '200 balance=500 INR', http: 200, status: 'PASS', notes: 'Real wallet doc' },
  { method: 'GET', endpoint: '/api/v1/customer/home', test: 'home', expected: '200', actual: '200 sectionDefinitions present', http: 200, status: 'PASS', notes: '' },
  { method: 'GET', endpoint: '/api/v1/customer/bootstrap', test: 'bootstrap', expected: '200', actual: '200', http: 200, status: 'PASS', notes: '' },
  { method: 'POST', endpoint: '/api/v1/admin/auth/login', test: 'bad-creds', expected: '401', actual: '401', http: 401, status: 'PASS', notes: '' },
  { method: 'POST', endpoint: '/api/v1/admin/auth/login', test: 'valid-login', expected: '200 token', actual: '200 token issued', http: 200, status: 'PASS', notes: 'Seeded dashboard login user; token masked' },
  { method: 'GET', endpoint: '/api/v1/admin/users/me', test: 'me', expected: '200', actual: '200', http: 200, status: 'PASS', notes: '' },
  { method: 'GET', endpoint: '/api/v1/admin/users/me', test: 'customer-token', expected: '401/403', actual: '403', http: 403, status: 'PASS', notes: 'Foreign token rejected' },
  { method: 'GET', endpoint: '/api/v1/admin/orders', test: 'list', expected: '200 customer_orders', actual: '200 ORD-20260910-00469 status=pending', http: 200, status: 'PASS', notes: '' },
  { method: 'GET', endpoint: '/api/v1/rider/dispatch/unassigned', test: 'dispatch', expected: 'live customer_orders ready-for-rider', actual: '200 but ORD-20260331-00001 status=new from legacy orders collection', http: 200, status: 'FAIL', notes: 'Split-brain: dispatch ≠ customer_orders spine' },
  { method: 'GET', endpoint: '/api/v1/admin/system/instances', test: 'stub', expected: 'real instances or 501', actual: '200 hardcoded [{id:1,status:running,host:localhost}]', http: 200, status: 'FAIL', notes: 'Hardcoded stub success' },
  { method: 'GET', endpoint: '/api/v1/admin/system/cache/stats', test: 'stub', expected: 'redis stats or honest empty', actual: '200 hits:0 misses:0 keys:0', http: 200, status: 'PARTIAL', notes: 'Stub/placeholder stats' },
  { method: 'GET', endpoint: '/api/v1/admin/applications', test: 'stub', expected: 'real integrations', actual: '200 data:[]', http: 200, status: 'PARTIAL', notes: 'Empty stub list' },
  { method: 'GET', endpoint: '/api/v1/admin/analytics/revenue', test: 'analytics', expected: '200', actual: '200 category breakdown Fruits etc', http: 200, status: 'PASS', notes: 'Returns numeric data' },
  { method: 'GET', endpoint: '/api/v1/admin/picker/pickers', test: 'list', expected: '200', actual: '200 data=[] total=0', http: 200, status: 'PASS', notes: 'Empty but real query' },
  { method: 'GET', endpoint: '/api/v1/picker/user/profile', test: 'admin-token', expected: '401', actual: '401', http: 401, status: 'PASS', notes: 'Audience isolation works admin→picker' },
  { method: 'POST', endpoint: '/api/v1/picker/auth/send-otp', test: 'send', expected: '200', actual: '200 deliveryStatus=sent', http: 200, status: 'PASS', notes: 'phone field required' },
  { method: 'POST', endpoint: '/api/v1/picker/auth/verify-otp', test: 'fixed-test-otp', expected: 'token or 4xx', actual: '400 invalid OTP (no fixed test OTP for picker)', http: 400, status: 'BLOCKED', notes: 'Requires real SMS OTP' },
  { method: 'POST', endpoint: '/api/v1/hhd/auth/send-otp', test: 'send-mobile', expected: '200', actual: '200 deliveryStatus=sent', http: 200, status: 'PASS', notes: 'mobile field' },
  { method: 'POST', endpoint: '/api/v1/hhd/auth/verify-otp', test: 'fixed-test-otp', expected: 'token or 4xx', actual: 'blocked without real OTP / HHD user', http: 400, status: 'BLOCKED', notes: 'No customer-style fixed OTP' },
  { method: 'GET', endpoint: '/api/v1/picker/samples', test: 'public-stub', expected: 'auth or removed', actual: '200 unauthenticated stub samples', http: 200, status: 'PARTIAL', notes: 'Public mock surface' },
  { method: 'POST', endpoint: '/api/v1/picker/didit/webhook', test: 'stub', expected: 'verified signature', actual: '200 received:true no verification', http: 200, status: 'PARTIAL', notes: 'Unauthenticated stub' },
  { method: 'GET', endpoint: '/api/v1/diag/order-flow', test: 'diag', expected: '200 debug', actual: '200 customerOrder pending riderStage=null', http: 200, status: 'PASS', notes: 'Non-prod only' },
  { method: 'POST', endpoint: '/api/v1/customer/auth/send-otp', test: 'malformed-json', expected: '4xx', actual: '500', http: 500, status: 'FAIL', notes: 'Malformed JSON not mapped to 400' },
  { method: 'SERVICE', endpoint: 'e2e-order-spine.ts', test: 'order-lifecycle', expected: 'TC1-TC5 pass', actual: 'PASS HHD-RACE, TC1 delivered, TC2-TC5 pass', http: 0, status: 'PASS', notes: 'Service-level spine against live Mongo; FCM notify-handover warn' },
];

// Merge live script results (first pass) with deep tests; prefer deep for same method+endpoint+test
const mergedTests = [];
const seen = new Set();
for (const t of deepTests) {
  const k = `${t.method}|${t.endpoint}|${t.test}`;
  seen.add(k);
  mergedTests.push(t);
}
for (const t of live.results || []) {
  const k = `${t.method}|${t.endpoint}|${t.test}`;
  if (seen.has(k)) continue;
  mergedTests.push(t);
}

const counts = { PASS: 0, FAIL: 0, PARTIAL: 0, BLOCKED: 0, NOT_TESTED: 0 };
for (const t of mergedTests) counts[t.status] = (counts[t.status] || 0) + 1;

const testedUnique = new Set(mergedTests.filter((t) => t.status !== 'NOT_TESTED').map((t) => `${t.method} ${t.endpoint}`));
const discovered = inventory.length;
const uniquePaths = new Set(inventory.map((r) => `${r.METHOD} ${r.FULL_PATH}`)).size;

// Endpoint inventory status: map known tested endpoints; rest NOT_TESTED
function inventoryStatus(row) {
  const key = `${row.METHOD} ${row.FULL_PATH}`;
  const hits = mergedTests.filter((t) => `${t.method} ${t.endpoint}` === key || t.endpoint.split('?')[0] === row.FULL_PATH && t.method === row.METHOD);
  if (!hits.length) {
    // prefix fuzzy for param routes tested with concrete ids
    const fuzzy = mergedTests.find((t) => t.method === row.METHOD && row.FULL_PATH.includes(':') && t.endpoint.startsWith(row.FULL_PATH.split('/:')[0]));
    if (fuzzy) return fuzzy.status;
    return 'NOT_TESTED';
  }
  if (hits.some((h) => h.status === 'FAIL')) return 'FAIL';
  if (hits.some((h) => h.status === 'PARTIAL')) return 'PARTIAL';
  if (hits.some((h) => h.status === 'BLOCKED')) return 'BLOCKED';
  if (hits.some((h) => h.status === 'PASS')) return 'PASS';
  return 'NOT_TESTED';
}

const invStatusCounts = { PASS: 0, FAIL: 0, PARTIAL: 0, BLOCKED: 0, NOT_TESTED: 0 };
const invRows = inventory.map((r, i) => {
  const status = inventoryStatus(r);
  invStatusCounts[status]++;
  return {
    n: i + 1,
    method: r.METHOD,
    endpoint: r.FULL_PATH,
    module: r.MODULE,
    auth: r.AUTH,
    role: r.ROLE,
    controller: r.CONTROLLER_HANDLER,
    service: r.SERVICE,
    status,
    notes: r.NOTES || '',
  };
});

// For report honesty: most inventory is NOT_TESTED; tested counts come from mergedTests
const overallScore = 64;

const md = [];
const push = (s = '') => md.push(s);

push('# Backend Architecture & API Postman Audit');
push('');
push(`**Generated:** ${new Date().toISOString()}`);
push(`**Repository:** \`selorg-service\` (Selorg V1.3)`);
push(`**Primary truth:** source routes in \`src/app.ts\` + \`src/modules/**/**.routes.ts\``);
push(`**Live base URL tested:** \`http://127.0.0.1:3333\``);
push(`**Postman MCP:** unavailable this session — verification performed via equivalent HTTP (\`fetch\`/Invoke-WebRequest) against the running server.`);
push('');

push('## 1. Executive Summary');
push('');
push('The modular Express/TypeScript rewrite is structurally sound (app/server split, domain modules, Zod validation on core flows, response envelope, security middleware). **It is not fully production-ready.** Live verification found a **server boot blocker** (undefined picker route handlers — safely fixed), **split-brain admin rider dispatch** reading a legacy `orders` collection while the live spine uses `customer_orders`, multiple **hardcoded/stub admin endpoints**, missing customer **product/banner list** routes, and **JWT/OTP isolation gaps**. The customer→HHD→rider order spine passes service-level e2e (`e2e-order-spine.ts`: TC1–TC5 PASS).');
push('');
push(`| Metric | Value |`);
push(`|--------|------:|`);
push(`| Architecture status | **NEEDS IMPROVEMENT** (critical issues present) |`);
push(`| Architecture score | **${overallScore}/100** |`);
push(`| Endpoints discovered (mounted) | **${discovered}** |`);
push(`| Unique METHOD+PATH | **${uniquePaths}** |`);
push(`| HTTP tests executed (cases) | **${mergedTests.length}** |`);
push(`| Unique endpoints exercised | **${testedUnique.size}** |`);
push(`| PASS / FAIL / PARTIAL / BLOCKED / NOT_TESTED (test cases) | **${counts.PASS} / ${counts.FAIL} / ${counts.PARTIAL} / ${counts.BLOCKED} / ${counts.NOT_TESTED}** |`);
push(`| Inventory rows still NOT_TESTED | **${invStatusCounts.NOT_TESTED}** |`);
push('');

push('## 2. Repository / Environment Tested');
push('');
push('| Item | Value |');
push('|------|-------|');
push('| Path | `C:\\Users\\lmbac\\Desktop\\Selorg V1.3\\selorg-service` |');
push('| Branch | `dhanasekaran/dev` (at audit start) |');
push('| Runtime | Node v20.20.2, `npm run dev` (ts-node-dev) |');
push('| Port | 3333 |');
push('| NODE_ENV | development (from `.env`) |');
push('| Database | MongoDB Atlas DB `selorg_test_02` (host masked) |');
push('| Redis | Optional; in-memory fallback observed |');
push('| Inventory artifact | `docs/endpoint-inventory.tsv` |');
push('| Live results artifact | `docs/live-api-audit-results.json` |');
push('');
push('Safe fix applied during audit (required to boot server): removed broken duplicate picker route registrations referencing undefined handlers `depositCash`, `startBulkDelivery`, `markBulkStopDelivered`, `markBulkStopFailed` in `src/modules/picker/picker.routes.ts`. Canonical validated routes already existed.');
push('');

push('## 3. Architecture Assessment');
push('');
push('### Structure');
push('- `src/server.ts` — env validation, DB connect, listen, realtime init.');
push('- `src/app.ts` — Express factory, middleware, mounts, Swagger, error handlers.');
push('- `src/modules/*` — domain modules (customer, picker/rider-app, hhd, rider-admin, admin, warehouse, …).');
push('- `src/middleware`, `src/services`, `src/database`, `src/utils`, `src/events`, `src/realtime` — shared cross-cutting.');
push('');
push('### Module separation (verified)');
push('| Actor | Mount | Auth | Evidence |');
push('|-------|-------|------|----------|');
push('| Customer | `/api/v1/customer/*` | `authenticateCustomer` | JWT issued via `/customer/auth/verify-otp`; profile/orders work |');
push('| Rider mobile | `/api/v1/picker/*` | `authenticatePicker` (`aud: picker`) | Admin JWT → picker profile returns **401** |');
push('| HHD | `/api/v1/hhd/*` | `protect` (HHD JWT) | Unauthed `/hhd/orders` → **401** |');
push('| Admin dashboard rider ops | `/api/v1/rider/*` | `authenticateAdmin` | Unauthed dispatch → **401**; with admin JWT → **200** |');
push('| Admin | `/api/v1/admin/*` | `authenticateAdmin` + RBAC | Login + `/users/me` **200** |');
push('| Customer delivery ETA | `/api/v1/customer/delivery/*` | public/partial | Separate from rider delivery |');
push('');
push('**Verdict:** Responsibilities are mostly separated by mount prefix. Rider **mobile** intentionally reuses picker infrastructure (`PickerUser`, picker JWT). Admin `/rider` is dashboard dispatch/HR — naming is confusing but not returning picker DTOs on `/rider`. The critical defect is **data-source split**, not payload mixing.');
push('');
push('### Strengths');
push('- Consistent API envelope via `apiEnvelopeMiddleware` / `ResponseFormatter`.');
push('- Security stack: Helmet, mongo-sanitize, HPP, xss-clean, CORS, rate limit on `/api/v1`.');
push('- Zod `validate` middleware on auth, orders, picker core routes.');
push('- Real order spine in `fulfillment.service.ts` + picker order service; e2e spine PASS.');
push('- Health endpoints (`/health`, `/health/db`, `/health/ready`) work against live Mongo.');
push('');
push('### Weaknesses');
push('- Dual order collections (`customer_orders` vs legacy `orders`) for dispatch.');
push('- Stub/hardcoded admin system/integration endpoints.');
push('- HHD JWT shares `JWT_SECRET` without audience (crossover risk).');
push('- In-memory token blocklist / login lockout (multi-instance unsafe).');
push('- Missing eslint config; typecheck fails; no Jest tests.');
push('- Boot was broken until undefined route handlers removed.');
push('');

push('## 4. Architecture Score');
push('');
push('| Dimension | Score | Notes |');
push('|-----------|------:|-------|');
push('| Folder/module architecture | 78 | Clear modules; picker/rider naming debt |');
push('| API design | 70 | Versioned `/api/v1`; gaps in catalog list routes; dual mounts |');
push('| Authentication/authorization | 58 | Audience checks partial; HHD/admin secret overlap |');
push('| Validation | 74 | Strong on picker/auth/orders; weaker on many admin/rider routes |');
push('| Error handling | 78 | Global handler good; malformed JSON → 500 |');
push('| Database architecture | 62 | Indexes on spine; split collections; limited transactions |');
push('| Integration architecture | 65 | OTP/SMS chain real; FCM not dispatched; stubs elsewhere |');
push('| Security | 55 | Middleware present; stubs, Math.random OTP, CORS open in non-prod |');
push('| Maintainability | 66 | Large surface (1600+ routes); stubs/TODOs; duplicate mounts |');
push('| Production readiness | 58 | Spine works; dispatch/stubs/boot/JWT issues block trust |');
push('| **Overall** | **64** | NEEDS IMPROVEMENT |');
push('');

push('## 5. Module-by-Module Assessment');
push('');
push('| Module | Endpoints | Assessment | Evidence |');
push('|--------|----------:|------------|----------|');
push('| health | 4 | PASS | Live 200 healthy/db/ready |');
push('| auth (customer) | 6 | PASS (test OTP in non-prod) | sessionId+OTP → JWT; empty body 422 |');
push('| user/cart/orders/addresses | ~32 | Core PASS; create needs items[] | Live list/detail/cart add |');
push('| products | 14 | PARTIAL/FAIL list | GET `/products` 404; search works |');
push('| banners | 6 | FAIL customer list | GET `/banners` 404; only `/:id` |');
push('| home/bootstrap/faq/legal | many | PASS public reads | 200 responses |');
push('| wallet | 5 | PARTIAL root path | `/wallet` 404; `/wallet/balance` 200 |');
push('| picker (rider app) | 184 | Auth gate PASS; OTP BLOCKED | send-otp 200; verify needs SMS; samples stub |');
push('| hhd | 42 | Auth gate PASS; OTP BLOCKED | send-otp 200; verify needs SMS/user |');
push('| rider (admin) | 120 | Auth PASS; dispatch FAIL correctness | Unassigned returns legacy ORD-20260331 |');
push('| admin | 294 | Mixed | Login/me/orders PASS; system instances FAIL stub |');
push('| darkstore/warehouse/vendor/finance | 600+ | Mostly NOT_TESTED | Auth required; spot checks 404 path mismatches |');
push('| diag | 4 | PASS non-prod | order-flow/hubs 200 |');
push('| payments | 13+ | NOT_TESTED / BLOCKED | Gateway credentials / redirects |');
push('');

push('## 6. Complete Endpoint Inventory');
push('');
push(`Source scan produced **${discovered}** mounted endpoints (**${uniquePaths}** unique METHOD+PATH). Full machine-readable copy: \`docs/endpoint-inventory.tsv\`.`);
push('');
push('Status column below reflects **live verification where performed**; otherwise `NOT_TESTED`. Do not treat `NOT_TESTED` as PASS.');
push('');
push('| # | Method | Endpoint | Module | Auth | Role | Controller | Service | Status | Notes |');
push('|---|--------|----------|--------|------|------|------------|---------|--------|-------|');
for (const r of invRows) {
  push(`| ${r.n} | ${r.method} | \`${r.endpoint}\` | ${r.module} | ${r.auth} | ${r.role} | ${r.controller} | ${r.service} | ${r.status} | ${String(r.notes).replace(/\|/g, '/')} |`);
}
push('');

push('## 7. Postman/API Test Results');
push('');
push('Postman MCP server was unavailable; tests used direct HTTP against the running backend (equivalent to Postman).');
push('');
push('| # | Method | Endpoint | Test | Expected | Actual | HTTP | Status | Notes |');
push('|---|--------|----------|------|----------|--------|------|--------|-------|');
mergedTests.forEach((t, i) => {
  push(`| ${i + 1} | ${t.method} | \`${t.endpoint}\` | ${t.test} | ${String(t.expected).replace(/\|/g, '/')} | ${String(t.actual).replace(/\|/g, '/').slice(0, 180)} | ${t.http} | ${t.status} | ${String(t.notes || '').replace(/\|/g, '/')} |`);
});
push('');

push('## 8. Negative Test Results');
push('');
push('| Case | Endpoint | Expected | Actual | Status |');
push('|------|----------|----------|--------|--------|');
push('| Missing auth | GET `/customer/user/profile` | 401 | 401 | PASS |');
push('| Missing auth | GET `/customer/orders` | 401 | 401 | PASS |');
push('| Missing auth | GET `/picker/shared-orders` | 401 | 401 | PASS |');
push('| Missing auth | GET `/hhd/orders` | 401 | 401 | PASS |');
push('| Missing auth | GET `/admin/users/me` | 401 | 401 | PASS |');
push('| Missing auth | GET `/rider/dispatch/unassigned` | 401 | 401 | PASS |');
push('| Invalid token | GET `/customer/user/profile` | 401 | 401 | PASS |');
push('| Invalid token | GET `/admin/users/me` | 401/403 | 403 | PASS |');
push('| Customer token on admin | GET `/admin/users/me` | 401/403 | 403 | PASS |');
push('| Admin token on picker | GET `/picker/user/profile` | 401 | 401 | PASS |');
push('| Empty OTP payload | POST `/customer/auth/send-otp` `{}` | 4xx | 422 | PASS |');
push('| Invalid phone | POST `/customer/auth/send-otp` | 4xx | 400 | PASS |');
push('| Empty verify | POST `/customer/auth/verify-otp` | 4xx | 422 | PASS |');
push('| Empty admin login | POST `/admin/auth/login` | 4xx | 422 | PASS |');
push('| Bad admin credentials | POST `/admin/auth/login` | 401 | 401 | PASS |');
push('| Empty cart add | POST `/customer/cart/items` | 4xx | 422 | PASS |');
push('| Bad product id | POST `/customer/cart/items` | 4xx | 400 | PASS |');
push('| Missing order | GET `/customer/orders/000…000` | 404 | 404 | PASS |');
push('| Invalid order id | GET `/customer/orders/bad-id` | 4xx/404 | 404 | PASS |');
push('| Create order without items | POST `/customer/orders` | 422 | 422 | PASS |');
push('| Malformed JSON body | POST `/customer/auth/send-otp` | 4xx | **500** | **FAIL** |');
push('');

push('## 9. Order Lifecycle Verification');
push('');
push('### Service-level spine (`src/scripts/e2e-order-spine.ts`) — live Mongo');
push('');
push('| Case | Result | Evidence |');
push('|------|--------|----------|');
push('| HHD-RACE | PASS | 3 accepts → 1 success, 2 `ORDER_ALREADY_ASSIGNED` |');
push('| TC1 deliver | PASS | Order delivered after handover → rider accept → complete |');
push('| TC2 invalid bag / wrong status | PASS | `INVALID_BAG_QR` + `WRONG_STATUS`, order unchanged |');
push('| TC3 double handover | PASS | 409 `ALREADY_HANDED_OVER` |');
push('| TC4 rider race | PASS | 3 riders → 1 success, 2 `ORDER_ALREADY_ASSIGNED` |');
push('| TC5 cancel paths | PASS | cancel at confirmed / picking / offered |');
push('');
push('Observed transition evidence (logs): `completeHandover` sets `riderStage: offered`, `offerHubKey: DS-Adyar-01`, customer status `getting-packed`.');
push('');
push('### HTTP API path (partial)');
push('1. Customer auth → JWT — **PASS**');
push('2. Cart add product — **PASS** (HTTP 200, total 69)');
push('3. Customer create order via HTTP — **PASS**: `items[]` + `addressId` → **201** `ORD-20260911-00470`; payment-only body correctly **422**');
push('4. Admin orders list shows live `customer_orders` — **PASS**');
push('5. Admin rider dispatch unassigned — **FAIL** for spine correctness: returns legacy `ORD-20260331-00001` / `status=new` while admin customer orders show `ORD-20260910-00469` / `pending`');
push('6. Picker/HHD HTTP accept/complete — **BLOCKED** (no fixed OTP; SMS required)');
push('');
push('### Propagation map');
push('```');
push('customer_orders (Order) → fulfillment.createHhdPickTicket → HHDOrder/HHDItem');
push('  → HHD rack scan → fulfillment.completeHandover (riderStage=offered)');
push('  → GET /api/v1/picker/shared-orders → accept/complete → delivered');
push('```');
push('Parallel broken path: `GET /api/v1/rider/dispatch/unassigned` → `dispatch.service.ts` → collection `orders` (legacy).');
push('');

push('## 10. Database / Data Integrity Findings');
push('');
push('| Finding | Severity | Evidence |');
push('|---------|----------|----------|');
push('| Dual order collections | P0 | Dispatch uses `orders`; spine uses `customer_orders` (`order.model.ts` collection name) |');
push('| Dispatch synthetic coordinates | P0 | `dispatch.service.ts` hashes address into fake lat/lng when missing |');
push('| Inventory reserve not fully transactional with all side effects | P2 | `fulfillment.service.ts` loops |');
push('| Hardcoded hub `DS-Adyar-01` | P2 | `orders.service.ts` / `fulfillment.service.ts` |');
push('| Indexes present on spine | OK | `customer_orders` pickerId+riderStage, offerHubKey indexes |');
push('| E2E cleanup race warning | P3 | `notify-handover failed: Client must be connected...` after tests |');
push('');

push('## 11. Authentication & Authorization Findings');
push('');
push('| Finding | Severity | Evidence |');
push('|---------|----------|----------|');
push('| Customer JWT works | OK | verify-otp → profile/orders 200 |');
push('| Admin JWT works | OK | login → users/me 200 |');
push('| Admin rejects picker aud | OK | source `FOREIGN_TOKEN_AUDIENCES` |');
push('| Admin rejects customer token | OK | live 403 |');
push('| Picker rejects admin token | OK | live 401 |');
push('| HHD JWT no audience; same JWT_SECRET | P0 | `hhd.models.ts` signs `{id}`; admin accepts `decoded.id` |');
push('| Customer fixed test OTP in non-prod | P1 | `ALLOW_CUSTOMER_TEST_OTP` or non-production default |');
push('| Picker/HHD no fixed test OTP | OK/BLOCKED for tests | verify returns 400 with 8790 |');
push('| In-memory token blocklist | P1 | `utils/auth.ts` |');
push('| In-memory admin login lockout | P3 | `admin-login-lockout.ts` |');
push('');

push('## 12. Security Findings');
push('');
push('| Finding | Severity | Evidence |');
push('|---------|----------|----------|');
push('| Rate limit on `/api/v1` | OK | `app.ts` express-rate-limit |');
push('| Helmet/sanitize/HPP/xss | OK | `app.ts` |');
push('| Non-prod CORS allows any origin | P1 | `config/cors.ts` |');
push('| Delivery OTP via Math.random | P1 | `fulfillment.service.ts` |');
push('| HHD OTP via Math.random | P1 | `hhd.models.ts` |');
push('| Unauthenticated `/picker/samples` | P1 | live 200 |');
push('| Unauthenticated Didit webhook stub | P1 | live 200 `{received:true}` |');
push('| Malformed JSON → 500 | P2 | live POST send-otp with `{not-json` |');
push('| Diag routes non-prod only | OK | `app.ts` `!isProduction` |');
push('| Secrets in report | N/A | Masked; do not commit `.env` |');
push('');

push('## 13. Mock/Dummy/Hardcoded Data Findings');
push('');
push('| Location | Behavior | Live evidence |');
push('|----------|----------|---------------|');
push('| `GET /api/v1/admin/system/instances` | Hardcoded running localhost instance | HTTP 200 `[{id:"1",status:"running",host:"localhost"}]` |');
push('| `GET /api/v1/admin/system/cache/stats` | Stub zeros | HTTP 200 hits/misses/keys 0 |');
push('| `GET /api/v1/admin/applications` | Empty stub | HTTP 200 `data:[]` |');
push('| `GET/POST /api/v1/picker/samples` | Sample CRUD stub | HTTP 200 unauthenticated |');
push('| `POST /api/v1/picker/didit/webhook` | Ack-only stub | HTTP 200 |');
push('| `dispatch.service.ts` | Fake coords/distance | Code evidence |');
push('| `store-warehouse.service.ts` performance | Hardcoded zeros | Code evidence |');
push('| `logistics.admin.controller.ts` | Analytics placeholders | Code evidence |');
push('| `pricing.service.ts` | Flash/bundle/tax placeholders | Code evidence |');
push('');

push('## 14. Critical Issues');
push('');
push('### P0 — Critical');
push('');
push('1. **Server failed to boot (fixed)** — `picker.routes.ts` referenced undefined handlers → `Route.post() requires a callback function but got a [object Undefined]`. **Fix applied:** removed duplicate broken registrations. Architecture change? No.');
push('2. **Admin rider dispatch split-brain** — `src/modules/rider/dispatch.service.ts` reads legacy `orders`; live spine is `customer_orders`. Live: dispatch `ORD-20260331-00001` vs admin orders `ORD-20260910-00469`. Architecture change? Yes (unify model).');
push('3. **HHD JWT / admin JWT crossover risk** — shared secret, no `aud` on HHD tokens. Architecture change? Small (secrets + audience).');
push('4. **Synthetic dispatch coordinates** — fake lat/lng from address hash. Architecture change? No (fix logic).');
push('');
push('### P1 — High');
push('');
push('1. Delivery/HHD OTP `Math.random()` — `fulfillment.service.ts`, `hhd.models.ts`.');
push('2. Customer test OTP enabled outside production by default.');
push('3. In-memory token blocklist / multi-instance logout broken.');
push('4. Non-prod CORS allow-all.');
push('5. Public picker samples + Didit webhook stubs.');
push('6. Missing customer `GET /products` list and `GET /banners` list routes (404).');
push('7. FCM not dispatched on fulfillment notify.');
push('');
push('### P2 — Medium');
push('');
push('1. Malformed JSON returns 500 instead of 400.');
push('2. Hardcoded Adyar hub for all orders.');
push('3. Logistics/admin analytics placeholders.');
push('4. Duplicate `/api/v1/admin/picker` mounts (31 path pairs).');
push('5. Typecheck failures (auth.controller, exceljs/xlsx types, firebase-admin paths).');
push('6. No ESLint config file.');
push('');
push('### P3 — Low');
push('');
push('1. HHD photo base URL default port mismatch.');
push('2. Empty domain event listeners.');
push('3. Admin lockout in-memory.');
push('4. Picker/rider naming confusion in docs/API paths.');
push('');

push('## 15. Failed Endpoints');
push('');
push('| Method | Endpoint | Why FAIL |');
push('|--------|----------|----------|');
push('| GET | `/api/v1/customer/products` | No list route mounted (404) |');
push('| GET | `/api/v1/customer/banners` | No list route mounted (404) |');
push('| GET | `/api/v1/rider/dispatch/unassigned` | Returns legacy collection data, not live spine |');
push('| GET | `/api/v1/admin/system/instances` | Hardcoded stub success |');
push('| POST | `/api/v1/customer/auth/send-otp` (malformed JSON) | Returns 500 instead of 4xx |');
push('| BOOT | `/api/v1/picker/*` router load | Was FAIL pre-fix (undefined handlers); fixed |');
push('');

push('## 16. Blocked Endpoints');
push('');
push('| Area | Reason |');
push('|------|--------|');
push('| Picker auth verify + all active picker operational routes | Real SMS OTP required (no fixed test OTP) |');
push('| HHD auth verify + protected HHD ops | Real SMS OTP / seeded HHD user required |');
push('| Payment capture / Worldline full flow | Gateway credentials + redirect environment |');
push('| Most warehouse/vendor/finance/darkstore write paths | Admin path discovery + fixture data; not fully exercised this run |');
push('| ~' + invStatusCounts.NOT_TESTED + ' inventory endpoints | Volume — not all 1600+ routes HTTP-tested; classified NOT_TESTED honestly |');
push('');

push('## 17. Recommended Fixes');
push('');
push('### Safe fixes (no architecture redesign)');
push('- Keep the picker route undefined-handler cleanup (already applied).');
push('- Map malformed JSON to 400 in error middleware.');
push('- Replace `Math.random()` OTP with `crypto`/`generateOtp()`.');
push('- Auth-gate or remove `/picker/samples` and verify Didit webhook signatures.');
push('- Add customer `GET /banners` list and product list/search contract docs alignment.');
push('- Stop returning hardcoded system instances; return 501 or real data.');
push('');
push('### Architecture changes');
push('- Point `dispatch.service.ts` at `CustomerOrder` / `customer_orders` (`riderStage`, `offerHubKey`).');
push('- Introduce `HHD_JWT_SECRET` + `aud: "hhd"`; reject unknown audiences in admin auth.');
push('- Move token blocklist + login lockout to Redis when enabled.');
push('- Resolve dual `/admin/picker` mount handlers to a single router.');
push('');
push('### Environment/configuration changes');
push('- Set `ALLOW_CUSTOMER_TEST_OTP=false` outside controlled test envs.');
push('- Configure Redis for multi-instance deployments.');
push('- Add `.eslintrc` or remove broken lint script.');
push('- Fix typecheck deps (`exceljs`/`xlsx` types, firebase-admin import paths).');
push('- Ensure SMS DLT providers configured for picker/HHD OTP in staging.');
push('');

push('## 18. Final Verdict');
push('');
push('| Question | Answer |');
push('|----------|--------|');
push('| Is backend architecture correct? | **Mostly — NEEDS IMPROVEMENT** with critical dispatch/JWT issues |');
push('| Is API architecture correct? | **Partially** — versioning/modules OK; catalog gaps + stubs + dual mounts |');
push('| Endpoints discovered | **' + discovered + '** |');
push('| Endpoints / cases tested | **' + testedUnique.size + ' unique endpoints / ' + mergedTests.length + ' test cases** |');
push('| PASS | **' + counts.PASS + '** (test cases) |');
push('| FAIL | **' + counts.FAIL + '** |');
push('| PARTIAL | **' + counts.PARTIAL + '** |');
push('| BLOCKED | **' + counts.BLOCKED + '** |');
push('| NOT_TESTED | **' + counts.NOT_TESTED + '** test cases; **' + invStatusCounts.NOT_TESTED + '** inventory rows |');
push('| Overall score | **' + overallScore + '/100** |');
push('| Production readiness | **Not ready** until P0 dispatch unification + JWT isolation + stub removal |');
push('');
push('### Top 5 issues');
push('1. Rider admin dispatch reads legacy `orders` (not `customer_orders`).');
push('2. HHD/admin JWT secret/audience isolation missing.');
push('3. Hardcoded/stub admin system endpoints returning fake success.');
push('4. Boot-breaking undefined route handlers (fixed) — indicates weak route/controller contract checks.');
push('5. Weak OTP entropy (`Math.random`) + public stub surfaces (`samples`, Didit).');
push('');
push('### Build / lint / test results');
push('| Check | Result |');
push('|-------|--------|');
push('| `npm run typecheck` | **FAIL** — errors in `auth.controller.ts`, `products.admin.controller.ts` (exceljs/xlsx), `fcm.service.ts` (firebase-admin paths) |');
push('| `npm run lint` | **FAIL** — no ESLint config file in repo |');
push('| `npm test` | **PASS (vacuous)** — Jest: “No tests found”, exit 0 |');
push('| `e2e-order-spine.ts` | **PASS** TC1–TC5 + HHD-RACE |');
push('');
push('---');
push('');
push('*End of audit. Secrets, JWTs, OTPs, and credentials intentionally masked.*');

fs.writeFileSync(OUT, md.join('\n'), 'utf8');
console.log('Wrote', OUT);
console.log('discovered', discovered, 'unique', uniquePaths);
console.log('testCases', counts);
console.log('inventoryStatus', invStatusCounts);
console.log('overall', overallScore);
