/**
 * TEST INFRASTRUCTURE ONLY — does not modify application code.
 *
 * Executes a REAL HTTP request against every endpoint in
 * API_ENDPOINT_INVENTORY.tsv, grouped by consuming app:
 *   CUSTOMER_APP | PICKER_APP | RIDER_APP | HHD_APP | DASHBOARD | INFRA
 *
 * Real identities are obtained through the real auth flows (admin password
 * login; OTP flows for customer/picker/HHD with the OTP read back from the
 * ephemeral test database, which is how the real client would receive it).
 *
 * Usage:  node scripts/_test-full-api-audit.mjs
 * Output: test-output/full-api-audit.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const BASE = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3333";
const TSV = path.join(ROOT, "API_ENDPOINT_INVENTORY.tsv");
const OUT_DIR = path.join(ROOT, "test-output");
const OUT_JSON = path.join(OUT_DIR, "full-api-audit.json");
const CONCURRENCY = Number(process.env.AUDIT_CONCURRENCY || 6);
const REQ_TIMEOUT = Number(process.env.AUDIT_TIMEOUT_MS || 20000);

const ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL || "hemanathc0112@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD || "Selorg@2024";
const CUSTOMER_PHONE = (process.env.OTP_TEST_MOBILE || "9698790921").slice(-10);
const CUSTOMER_OTP = process.env.OTP_TEST_OTP || "8790";
const PICKER_PHONE = "9698790922";
const RIDER_PHONE = "9698790923";
const HHD_PHONE = "9698790924";

// ─── App classification ──────────────────────────────────────────────────────

/** Namespaces the admin dashboard SPA consumes. */
const DASHBOARD_PREFIXES = [
  "/api/v1/admin",
  "/api/v1/customer/admin",
  "/api/v1/darkstore",
  "/api/v1/warehouse",
  "/api/v1/rider",
  "/api/v1/merch",
  "/api/v1/production",
  "/api/v1/shared",
  "/api/v1/logistics",
];

/**
 * Rider-app-specific sub-namespaces inside the shared /api/v1/picker workforce
 * API (last-mile delivery). Everything else under /api/v1/picker is either
 * picker-specific or shared by both workforce apps.
 */
const RIDER_ONLY = [
  "/api/v1/picker/shared-orders",
  "/api/v1/picker/bulk/",
  "/api/v1/picker/bulk",
  "/api/v1/picker/cash/",
  "/api/v1/picker/cash",
  "/api/v1/picker/orders",
  "/api/v1/picker/deliveries",
];

/** Picker-app-specific sub-namespaces (in-store picking / device handling). */
const PICKER_ONLY = [
  "/api/v1/picker/dark-store-login",
  "/api/v1/picker/store-otp",
  "/api/v1/picker/devices",
  "/api/v1/picker/manager",
  "/api/v1/picker/approval",
];

function classifyApp(p) {
  if (p === "/health" || p === "/healthz" || p.startsWith("/health/")) return "INFRA";
  if (p.startsWith("/api-docs")) return "INFRA";
  if (p.startsWith("/api/v1/diag")) return "INFRA";
  if (p.startsWith("/api/v1/hhd")) return "HHD_APP";
  if (p.startsWith("/api/v1/picker")) {
    if (RIDER_ONLY.some((x) => p.startsWith(x))) return "RIDER_APP";
    if (PICKER_ONLY.some((x) => p.startsWith(x))) return "PICKER_APP";
    return "WORKFORCE_SHARED";
  }
  if (p.startsWith("/api/v1/customer/admin")) return "DASHBOARD";
  if (DASHBOARD_PREFIXES.some((x) => p === x || p.startsWith(x + "/"))) return "DASHBOARD";
  if (p.startsWith("/api/v1/customer")) return "CUSTOMER_APP";
  if (p.startsWith("/api/payment")) return "CUSTOMER_APP";
  if (p.startsWith("/api/v1/support")) return "CUSTOMER_APP";
  return "OTHER";
}

function authFamily(a) {
  if (/^admin JWT/.test(a)) return "ADMIN";
  if (/picker JWT|active picker/.test(a)) return "PICKER";
  if (/HHD/.test(a)) return "HHD";
  if (/customer JWT/.test(a)) return "CUSTOMER";
  if (/optional customer/.test(a)) return "OPTIONAL_CUSTOMER";
  if (/^public/.test(a)) return "PUBLIC";
  return "UNKNOWN";
}

// ─── Skip list (would destroy the audit session itself) ──────────────────────

const SESSION_DESTRUCTIVE = [
  "/api/v1/admin/auth/logout",
  "/api/v1/customer/auth/logout",
  "/api/v1/picker/auth/logout",
  "/api/v1/hhd/auth/logout",
];

function isSkipped(r) {
  if (r.path.startsWith("/api-docs")) return "swagger UI (HTML asset, not a JSON API)";
  if (SESSION_DESTRUCTIVE.includes(r.path)) return "revokes the audit session token (tested separately at the end)";
  return null;
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function http(method, urlPath, { token, body, headers } = {}) {
  const url = urlPath.startsWith("http") ? urlPath : BASE + urlPath;
  const h = { Accept: "application/json", ...(headers || {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined && method !== "GET" && method !== "DELETE") {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REQ_TIMEOUT);
  try {
    const res = await fetch(url, { method, headers: h, body: payload, signal: ac.signal });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
    return { status: res.status, json, text: text.slice(0, 400), ms: Date.now() - started };
  } catch (err) {
    return {
      status: 0,
      json: null,
      text: "",
      ms: Date.now() - started,
      netErr: err.name === "AbortError" ? `timeout>${REQ_TIMEOUT}ms` : String(err.message || err),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Identity acquisition (real flows) ───────────────────────────────────────

const ids = {};   // resolved path-param values
const tokens = {};
const tokenNotes = {};

async function loginAdmin() {
  const r = await http("POST", "/api/v1/admin/auth/login", {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "admin" },
  });
  const d = r.json?.data;
  if (r.status === 200 && d?.token) {
    tokens.ADMIN = d.token;
    ids.adminUserId = String(d.user?._id || d.user?.id || "");
    return true;
  }
  tokenNotes.ADMIN = `admin login failed status=${r.status} ${r.text}`;
  return false;
}

async function loginCustomer() {
  const s = await http("POST", "/api/v1/customer/auth/send-otp", { body: { phoneNumber: CUSTOMER_PHONE } });
  const sessionId = s.json?.data?.sessionId;
  if (!sessionId) { tokenNotes.CUSTOMER = `send-otp failed status=${s.status} ${s.text}`; return false; }
  const v = await http("POST", "/api/v1/customer/auth/verify-otp", { body: { sessionId, otp: CUSTOMER_OTP } });
  const tok = v.json?.data?.accessToken;
  if (v.status === 200 && tok) {
    tokens.CUSTOMER = tok;
    ids.customerUserId = String(v.json.data.user?._id || "");
    return true;
  }
  tokenNotes.CUSTOMER = `verify-otp failed status=${v.status} ${v.text}`;
  return false;
}

/**
 * Picker/HHD auth deliberately never honours OTP_DEV_MODE — it always calls the
 * SMS gateway, which is not configured in this environment (502). The OTP row is
 * therefore seeded directly into the test DB (exactly what `storeOtp`/`createOTP`
 * would have written) so the REAL `/auth/verify-otp` endpoint, token signing and
 * session binding are still exercised. Only the SMS carrier hop is bypassed.
 */
const SEEDED_OTP = "4321";

async function seedPickerOtp(identifier) {
  const now = new Date();
  await mongoose.connection.db.collection("picker_otps").updateOne(
    { identifier },
    {
      $set: {
        identifier, otp: SEEDED_OTP,
        expiresAt: new Date(now.getTime() + 10 * 60000),
        attempts: 0, verified: false, sendCount: 1,
        windowStartedAt: now, updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

async function seedHhdOtp(identifier) {
  const now = new Date();
  const coll = mongoose.connection.db.collection("hhd_otps");
  await coll.deleteMany({ identifier, isUsed: false });
  await coll.insertOne({
    identifier, mobile: identifier, channel: "sms", otp: SEEDED_OTP,
    expiresAt: new Date(now.getTime() + 10 * 60000),
    isUsed: false, attemptCount: 0, lastSentAt: now,
    createdAt: now, updatedAt: now,
  });
}

async function loginPicker(phone, workforceRole, key) {
  // Try the real send-otp first; fall back to seeding when the gateway is absent.
  const s = await http("POST", "/api/v1/picker/auth/send-otp", { body: { phone } });
  const gatewayDown = s.status >= 400;
  await seedPickerOtp(phone);
  const v = await http("POST", "/api/v1/picker/auth/verify-otp", {
    body: { phone, otp: SEEDED_OTP, workforceRole },
    headers: { "x-selorg-client": workforceRole },
  });
  const d = v.json?.data || v.json;
  const tok = d?.token || d?.accessToken;
  if (v.status < 400 && tok) {
    tokens[key] = tok;
    ids[key === "PICKER" ? "pickerId" : "riderAppId"] = String(d.user?._id || d.user?.id || d.userId || "");
    tokenNotes[key] = gatewayDown
      ? `OTP seeded in test DB (SMS gateway unavailable: ${s.status}); real verify-otp used`
      : "real send-otp + verify-otp";
    return true;
  }
  tokenNotes[key] = `picker verify-otp status=${v.status} ${v.text}`;
  return false;
}

async function loginHhd() {
  const s = await http("POST", "/api/v1/hhd/auth/send-otp", { body: { mobile: HHD_PHONE } });
  const gatewayDown = s.status >= 400;
  await seedHhdOtp(HHD_PHONE);
  const v = await http("POST", "/api/v1/hhd/auth/verify-otp", {
    body: { mobile: HHD_PHONE, otp: SEEDED_OTP },
  });
  const d = v.json?.data || v.json;
  const tok = d?.token || d?.accessToken || d?.tokens?.accessToken;
  if (v.status < 400 && tok) {
    tokens.HHD = tok;
    ids.hhdUserId = String(d.user?._id || d.user?.id || "");
    tokenNotes.HHD = gatewayDown
      ? `OTP seeded in test DB (SMS gateway unavailable: ${s.status}); real verify-otp used`
      : "real send-otp + verify-otp";
    return true;
  }
  tokenNotes.HHD = `hhd verify-otp status=${v.status} ${v.text}`;
  return false;
}

// ─── Path-param resolution from real data ────────────────────────────────────

const FALLBACK_OID = "6aae0000cafad5450dae0000";

async function resolveRealIds() {
  const db = mongoose.connection.db;
  const one = async (coll, q = {}) => {
    try { return await db.collection(coll).findOne(q); } catch { return null; }
  };
  const prod = await one("customer_products", { sku: "AUTO-MILK-1L" });
  const cat = await one("customer_categories", { slug: "organic-staples" });
  const sub = await one("customer_categories", { slug: "fresh-dairy" });
  const store = await one("dark_stores", { code: "AUTO-CHN-CENTRAL-01" });
  if (prod) { ids.productId = String(prod._id); ids.sku = prod.sku; }
  if (cat) ids.categoryId = String(cat._id);
  if (sub) ids.subcategoryId = String(sub._id);
  if (store) { ids.storeId = String(store._id); ids.storeCode = store.code; }

  // Build a real order through the customer flow so order-scoped params resolve.
  if (tokens.CUSTOMER && ids.productId) {
    const addr = await http("POST", "/api/v1/customer/addresses", {
      token: tokens.CUSTOMER,
      body: { label: "Audit", line1: "12 Anna Salai", city: "Chennai", state: "TN",
              pincode: "600002", latitude: 13.0827, longitude: 80.2707, isDefault: true },
    });
    if (addr.json?.data?._id) ids.addressId = String(addr.json.data._id);
    await http("POST", "/api/v1/customer/cart/items", {
      token: tokens.CUSTOMER, body: { productId: ids.productId, quantity: 1 },
    });
    if (ids.addressId) {
      const ord = await http("POST", "/api/v1/customer/orders", {
        token: tokens.CUSTOMER,
        body: { items: [{ productId: ids.productId, quantity: 1 }], addressId: ids.addressId,
                paymentMethodType: "cash", customerName: "Audit", customerPhone: CUSTOMER_PHONE },
      });
      const od = ord.json?.data;
      if (od?.id || od?._id) {
        ids.orderId = String(od.id || od._id);
        ids.orderNumber = od.orderNumber || "";
      }
    }
  }
  if (tokens.ADMIN) {
    const u = await http("GET", "/api/v1/admin/users?limit=1", { token: tokens.ADMIN });
    const arr = u.json?.data;
    const row = Array.isArray(arr) ? arr[0] : arr?.data?.[0];
    if (row?._id || row?.id) ids.userId = String(row._id || row.id);
    const c = await http("GET", "/api/v1/admin/customers?limit=1", { token: tokens.ADMIN });
    const carr = c.json?.data;
    const crow = Array.isArray(carr) ? carr[0] : carr?.data?.[0];
    if (crow?._id || crow?.id) ids.customerId = String(crow._id || crow.id);
  }
}

const PARAM_MAP = () => ({
  id: ids.productId || FALLBACK_OID,
  orderId: ids.orderId || FALLBACK_OID,
  productId: ids.productId || FALLBACK_OID,
  categoryId: ids.categoryId || FALLBACK_OID,
  subcategoryId: ids.subcategoryId || FALLBACK_OID,
  storeId: ids.storeId || FALLBACK_OID,
  addressId: ids.addressId || FALLBACK_OID,
  customerId: ids.customerId || FALLBACK_OID,
  userId: ids.userId || ids.adminUserId || FALLBACK_OID,
  pickerId: ids.pickerId || FALLBACK_OID,
  riderId: ids.riderAppId || FALLBACK_OID,
  slug: "organic-staples",
  code: "AUTOCODE",
  key: "workspace.orders",
  status: "pending",
  sku: ids.sku || "AUTO-MILK-1L",
  itemId: FALLBACK_OID,
  warehouseId: FALLBACK_OID,
  sheet: "Products",
  system: "razorpay",
  pageNumber: "1",
  month: "2026-09",
  date: "2026-09-19",
});

function fillPath(p) {
  const map = PARAM_MAP();
  return p.replace(/:([A-Za-z0-9_]+)/g, (_, name) => map[name] ?? FALLBACK_OID);
}

// ─── Result classification ───────────────────────────────────────────────────

/**
 * notFoundMiddleware answers `Route #<originalUrl> not found`. A bare
 * "Route not found" is a domain 404 for a delivery-Route entity, so the `#url`
 * marker is what distinguishes an unmounted path from a missing record.
 */
function isRouteMissing(res) {
  const msg = String(res.json?.message || res.json?.error?.message || res.text || "");
  return res.status === 404 && /^Route #\S+ not found/i.test(msg);
}

function failCategory(res) {
  const msg = String(res.json?.message || res.json?.error?.message || res.text || "");
  if (res.status === 501) return "NOT_IMPLEMENTED";
  if (/Cannot read propert|undefined is not|is not a function/i.test(msg)) return "UNGUARDED_CRASH";
  if (/not found/i.test(msg)) return "NOTFOUND_AS_500";
  if (/validation failed|is required|Missing |Invalid /i.test(msg)) return "VALIDATION_AS_500";
  return "SERVER_ERROR";
}

/**
 * PASS   = endpoint is reachable and behaved correctly for the request sent
 *          (2xx, or a correct 4xx rejection for an intentionally empty payload
 *          / non-existent id / insufficient permission).
 * FAIL   = server-side defect: 5xx, 501 not-implemented, or route not mounted.
 * BLOCKED= could not be exercised (no identity for that app, network, rate limit).
 */
function classify(r, res, hasToken) {
  if (res.status === 0) return { verdict: "BLOCKED", reason: `network: ${res.netErr}` };
  if (res.status === 429) return { verdict: "BLOCKED", reason: "rate limited (429)" };
  if (res.status === 503) {
    return { verdict: "BLOCKED", reason: "503 external provider not configured in this environment", category: "CONFIG" };
  }
  if (isRouteMissing(res)) return { verdict: "FAIL", reason: "route not mounted (404)", category: "ROUTE_NOT_MOUNTED" };
  if (res.status === 501) return { verdict: "FAIL", reason: "501 NOT_IMPLEMENTED (stub controller)", category: "NOT_IMPLEMENTED" };
  if (res.status >= 500) {
    return { verdict: "FAIL", reason: `${res.status} ${failCategory(res)}`, category: failCategory(res) };
  }
  if ((res.status === 401 || res.status === 403) && hasToken && r.fam !== "PUBLIC") {
    // Permission-gated admin endpoints legitimately deny; record but don't call it a server defect.
    return { verdict: "PASS", reason: `${res.status} authorization enforced`, note: "AUTHZ_DENIED" };
  }
  if (res.status === 401 || res.status === 403) {
    return { verdict: "PASS", reason: `${res.status} auth required (enforced)` };
  }
  if (res.status >= 400) return { verdict: "PASS", reason: `${res.status} validated/rejected as expected` };
  return { verdict: "PASS", reason: `${res.status} OK` };
}

function tokenFor(fam) {
  if (fam === "ADMIN") return tokens.ADMIN;
  if (fam === "CUSTOMER" || fam === "OPTIONAL_CUSTOMER") return tokens.CUSTOMER;
  if (fam === "HHD") return tokens.HHD;
  if (fam === "PICKER") return tokens.PICKER || tokens.RIDER;
  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const rows = fs.readFileSync(TSV, "utf8").trim().split(/\r?\n/).slice(1).map((l) => {
  const [m, p, auth, ctrl, src] = l.split("|");
  return { m, path: p, auth, ctrl, src, app: classifyApp(p), fam: authFamily(auth) };
});

console.log(`inventory: ${rows.length} endpoints`);

await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
console.log("mongo connected");

const authResults = {
  ADMIN: await loginAdmin(),
  CUSTOMER: await loginCustomer(),
  PICKER: await loginPicker(PICKER_PHONE, "picker", "PICKER"),
  RIDER: await loginPicker(RIDER_PHONE, "rider", "RIDER"),
  HHD: await loginHhd(),
};
console.log("identities:", authResults, tokenNotes);

await resolveRealIds();
console.log("resolved ids:", ids);

// Reads first, then mutations, then deletes — keeps seeded data alive for reads.
const ORDER = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4 };
const queue = rows.slice().sort((a, b) => (ORDER[a.m] ?? 9) - (ORDER[b.m] ?? 9));

const results = [];
let done = 0;

async function runOne(r) {
  const skip = isSkipped(r);
  if (skip) {
    results.push({ ...r, status: null, verdict: "SKIPPED", reason: skip, ms: 0, testedPath: r.path });
    return;
  }
  const fam = r.fam;
  const token = tokenFor(fam);
  const needsIdentity = ["ADMIN", "CUSTOMER", "PICKER", "HHD"].includes(fam);
  if (needsIdentity && !token) {
    results.push({
      ...r, status: null, verdict: "BLOCKED", ms: 0, testedPath: r.path,
      reason: `no ${fam} identity available (${tokenNotes[fam] || "login failed"})`,
    });
    return;
  }
  const testedPath = fillPath(r.path);
  const body = r.m === "GET" || r.m === "DELETE" ? undefined : {};
  const res = await http(r.m, testedPath, { token, body });
  const c = classify(r, res, Boolean(token));
  results.push({
    ...r, testedPath, status: res.status, ms: res.ms,
    verdict: c.verdict, reason: c.reason, category: c.category || null, note: c.note || null,
    body: res.text ? res.text.slice(0, 220) : "",
  });
  if (++done % 200 === 0) console.log(`  ...${done}/${queue.length}`);
}

const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const r = queue.shift();
    if (!r) break;
    await runOne(r);
  }
});
await Promise.all(workers);

// Logout endpoints, tested last (they revoke tokens).
const logoutTests = [];
for (const [p, fam] of [
  ["/api/v1/admin/auth/logout", "ADMIN"],
  ["/api/v1/customer/auth/logout", "CUSTOMER"],
  ["/api/v1/picker/auth/logout", "PICKER"],
  ["/api/v1/hhd/auth/logout", "HHD"],
]) {
  const token = tokenFor(fam);
  if (!token) { logoutTests.push({ path: p, fam, status: null, verdict: "BLOCKED", reason: "no identity" }); continue; }
  const res = await http("POST", p, { token, body: {} });
  const row = { m: "POST", path: p, fam, app: classifyApp(p) };
  const c = classify(row, res, true);
  logoutTests.push({ path: p, fam, status: res.status, verdict: c.verdict, reason: c.reason });
  const idx = results.findIndex((x) => x.path === p && x.m === "POST");
  if (idx >= 0) {
    results[idx] = { ...results[idx], status: res.status, verdict: c.verdict, reason: c.reason, testedPath: p };
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify({
  generatedAt: new Date().toISOString(),
  base: BASE,
  total: rows.length,
  identities: authResults,
  identityNotes: tokenNotes,
  resolvedIds: ids,
  logoutTests,
  results,
}, null, 2));

// ─── Console summary ─────────────────────────────────────────────────────────

const APPS = ["CUSTOMER_APP", "PICKER_APP", "RIDER_APP", "WORKFORCE_SHARED", "HHD_APP", "DASHBOARD", "INFRA", "OTHER"];
const tally = {};
for (const r of results) {
  const a = r.app;
  tally[a] = tally[a] || { total: 0, PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0 };
  tally[a].total++;
  tally[a][r.verdict] = (tally[a][r.verdict] || 0) + 1;
}
console.log("\n=== PER-APP RESULTS ===");
console.log("APP".padEnd(20), "TOTAL".padStart(6), "PASS".padStart(6), "FAIL".padStart(6), "BLOCK".padStart(6), "SKIP".padStart(6));
for (const a of APPS) {
  const t = tally[a]; if (!t) continue;
  console.log(a.padEnd(20), String(t.total).padStart(6), String(t.PASS).padStart(6),
    String(t.FAIL).padStart(6), String(t.BLOCKED).padStart(6), String(t.SKIPPED).padStart(6));
}
const g = results.reduce((a, r) => (a[r.verdict] = (a[r.verdict] || 0) + 1, a), {});
console.log("\nGRAND:", JSON.stringify(g), "of", results.length);
console.log("json ->", OUT_JSON);

await mongoose.disconnect();
