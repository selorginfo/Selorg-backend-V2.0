/**
 * TEST INFRASTRUCTURE ONLY.
 *
 * Joins three inputs into the per-app API report:
 *   1. backend route inventory      (API_ENDPOINT_INVENTORY.tsv)
 *   2. full backend audit results   (test-output/full-api-audit.json)
 *   3. dashboard frontend call sites(../selorg-admin-dashboard-develoment/test-output/frontend-api-calls.json)
 *
 * Also re-tests the dashboard's own 122 call sites live so the dashboard gets a
 * pass/fail verdict on its real integration surface, not just on the namespaces
 * it could theoretically reach.
 *
 * Usage:  node scripts/_test-build-api-report.mjs
 * Output: API_ENDPOINTS_BY_APP_TEST_REPORT.md (+ per-app path lists)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WORKSPACE = path.join(ROOT, "..");
const DASH = path.join(WORKSPACE, "selorg-admin-dashboard-develoment");
dotenv.config({ path: path.join(ROOT, ".env") });

const BASE = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3333";
const audit = JSON.parse(fs.readFileSync(path.join(ROOT, "test-output", "full-api-audit.json"), "utf8"));
const fe = JSON.parse(fs.readFileSync(path.join(DASH, "test-output", "frontend-api-calls.json"), "utf8"));

const OUT_DIR = path.join(ROOT, "test-output");
const LIST_DIR = path.join(OUT_DIR, "api-paths-by-app");

// ─── 1. Live re-test of the dashboard's own call sites ───────────────────────

async function http(method, p, token, body) {
  const h = { Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined && method !== "GET" && method !== "DELETE") {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 20000);
  try {
    const res = await fetch(BASE + p, { method, headers: h, body: payload, signal: ac.signal });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text: text.slice(0, 200) };
  } catch (e) {
    return { status: 0, json: null, text: String(e.message || e) };
  } finally { clearTimeout(t); }
}

const login = await http("POST", "/api/v1/admin/auth/login", null, {
  email: process.env.ADMIN_TEST_EMAIL || "hemanathc0112@gmail.com",
  password: process.env.ADMIN_TEST_PASSWORD || "Selorg@2024",
  role: "admin",
});
const ADMIN_TOKEN = login.json?.data?.token || null;
if (!ADMIN_TOKEN) console.warn("WARN: admin login failed; dashboard live re-test will be BLOCKED");

const ids = audit.resolvedIds || {};
const OID = "6aae0000cafad5450dae0000";
function fillFe(p) {
  // Frontend paths carry `:param` placeholders from the extractor.
  let i = 0;
  return p.replace(/:param|:[A-Za-z0-9_]+/g, () => {
    i++;
    if (/product/i.test(p)) return ids.productId || OID;
    if (/order/i.test(p)) return ids.orderId || OID;
    if (/categor/i.test(p)) return ids.categoryId || OID;
    if (/customer/i.test(p)) return ids.customerId || OID;
    if (/store|darkstore/i.test(p)) return ids.storeId || OID;
    if (/user/i.test(p)) return ids.userId || OID;
    return OID;
  });
}

function isRouteMissing(res) {
  const msg = String(res.json?.message || res.json?.error?.message || res.text || "");
  return res.status === 404 && /^Route #\S+ not found/i.test(msg);
}
function classifyLive(res) {
  const code = res.json?.error?.appCode || "";
  if (res.status === 0) return { verdict: "BLOCKED", reason: "network error" };
  if (res.status === 429) return { verdict: "BLOCKED", reason: "rate limited" };
  if (res.status === 503) return { verdict: "BLOCKED", reason: "external provider not configured" };
  if (code === "AUTH_TOKEN_REVOKED") {
    return { verdict: "BLOCKED", reason: "test session token was revoked — result not trustworthy" };
  }
  if (isRouteMissing(res)) return { verdict: "FAIL", reason: "endpoint does not exist in backend (404)" };
  if (res.status === 501) return { verdict: "FAIL", reason: "501 NOT_IMPLEMENTED" };
  if (res.status >= 500) return { verdict: "FAIL", reason: `${res.status} server error` };
  return { verdict: "PASS", reason: `${res.status}` };
}

// ─── 2. Backend inventory + app classification (same rules as the audit) ─────

const results = audit.results;
const byKey = new Map(results.map((r) => [`${r.m} ${r.path}`, r]));
const norm = (p) => p.replace(/:[A-Za-z0-9_]+/g, ":p").replace(/\/+$/, "");
const backendNorm = new Map();
for (const r of results) {
  const k = `${r.m} ${norm(r.path)}`;
  if (!backendNorm.has(k)) backendNorm.set(k, r);
}

// `/auth/logout` revokes the bearer token it is called with, so it must run last
// or every subsequent call in the sweep answers AUTH_TOKEN_REVOKED.
const feCalls = fe.calls
  .filter((c) => !(c.files || []).every((f) => String(f).includes("dashboardApiCatalog.json")))
  .slice()
  .sort((a, b) =>
  Number(/\/auth\/logout$/.test(a.path)) - Number(/\/auth\/logout$/.test(b.path)));

const feTested = [];
for (const c of feCalls) {
  const k = `${c.method} ${norm(c.path)}`;
  const match = backendNorm.get(k) || null;
  const tested = fillFe(c.path);
  const res = ADMIN_TOKEN
    ? await http(c.method, tested, ADMIN_TOKEN, c.method === "GET" || c.method === "DELETE" ? undefined : {})
    : { status: 0, json: null, text: "no admin token" };
  const v = classifyLive(res);
  feTested.push({
    ...c, testedPath: tested, status: res.status, verdict: v.verdict, reason: v.reason,
    existsInBackend: Boolean(match),
    backendAuth: match?.auth || null,
    body: res.text,
  });
}

// ─── 3. Group + emit ─────────────────────────────────────────────────────────

const APP_ORDER = ["CUSTOMER_APP", "PICKER_APP", "RIDER_APP", "WORKFORCE_SHARED", "HHD_APP", "DASHBOARD", "INFRA"];
const APP_LABEL = {
  CUSTOMER_APP: "Customer App",
  PICKER_APP: "Picker App (picker-only routes)",
  RIDER_APP: "Rider App (rider-only routes)",
  WORKFORCE_SHARED: "Picker + Rider shared workforce routes",
  HHD_APP: "HHD App (handheld device)",
  DASHBOARD: "Admin Dashboard (all admin-facing namespaces)",
  INFRA: "Infrastructure / health / diagnostics",
};

const grouped = {};
for (const r of results) (grouped[r.app] ||= []).push(r);

function tallyOf(rows) {
  const t = { total: rows.length, PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0 };
  for (const r of rows) t[r.verdict] = (t[r.verdict] || 0) + 1;
  return t;
}

fs.mkdirSync(LIST_DIR, { recursive: true });

// Per-app full path lists (one file per app).
for (const app of APP_ORDER) {
  const rows = (grouped[app] || []).slice().sort((a, b) => a.path.localeCompare(b.path) || a.m.localeCompare(b.m));
  if (!rows.length) continue;
  const lines = [
    `# ${APP_LABEL[app]} — ${rows.length} endpoints`, "",
    "| # | Method | Path | Auth | Result | HTTP | Note |",
    "|---|--------|------|------|--------|------|------|",
    ...rows.map((r, i) =>
      `| ${i + 1} | ${r.m} | \`${r.path}\` | ${r.fam} | ${r.verdict} | ${r.status ?? "-"} | ${(r.reason || "").replace(/\|/g, "/")} |`),
  ];
  fs.writeFileSync(path.join(LIST_DIR, `${app}.md`), lines.join("\n"));
}

// Dashboard frontend call-site list.
{
  const rows = feTested.slice().sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  const lines = [
    `# Dashboard frontend call sites — ${rows.length} distinct endpoints`, "",
    "| # | Method | Path | Exists in backend | Result | HTTP | Source file |",
    "|---|--------|------|-------------------|--------|------|-------------|",
    ...rows.map((r, i) =>
      `| ${i + 1} | ${r.method} | \`${r.path}\` | ${r.existsInBackend ? "yes" : "NO"} | ${r.verdict} | ${r.status} | ${r.files[0]} |`),
  ];
  fs.writeFileSync(path.join(LIST_DIR, "DASHBOARD_FRONTEND_CALLS.md"), lines.join("\n"));
}

const feTally = tallyOf(feTested);
const summary = {
  generatedAt: new Date().toISOString(),
  backendTotal: results.length,
  perApp: Object.fromEntries(APP_ORDER.filter((a) => grouped[a]).map((a) => [a, tallyOf(grouped[a])])),
  dashboardFrontend: { ...feTally, missingInBackend: feTested.filter((r) => !r.existsInBackend).length },
  failCategories: results.filter((r) => r.verdict === "FAIL")
    .reduce((a, r) => (a[r.category || "OTHER"] = (a[r.category || "OTHER"] || 0) + 1, a), {}),
};
fs.writeFileSync(path.join(OUT_DIR, "api-report-summary.json"),
  JSON.stringify({ ...summary, dashboardFrontendCalls: feTested }, null, 2));

// ─── Console ─────────────────────────────────────────────────────────────────

const pad = (s, n) => String(s).padStart(n);
console.log("\n================ BACKEND API TOTALS BY APP ================");
console.log("APP".padEnd(42), pad("TOTAL", 6), pad("PASS", 6), pad("FAIL", 6), pad("BLOCK", 6), pad("SKIP", 5));
for (const a of APP_ORDER) {
  if (!grouped[a]) continue;
  const t = tallyOf(grouped[a]);
  console.log(APP_LABEL[a].padEnd(42), pad(t.total, 6), pad(t.PASS, 6), pad(t.FAIL, 6), pad(t.BLOCKED, 6), pad(t.SKIPPED, 5));
}
const g = tallyOf(results);
console.log("-".repeat(80));
console.log("BACKEND TOTAL".padEnd(42), pad(g.total, 6), pad(g.PASS, 6), pad(g.FAIL, 6), pad(g.BLOCKED, 6), pad(g.SKIPPED, 5));

console.log("\n========== DASHBOARD FRONTEND INTEGRATION SURFACE ==========");
console.log("distinct endpoints called by the SPA:", feTally.total);
console.log("PASS", feTally.PASS, "| FAIL", feTally.FAIL, "| BLOCKED", feTally.BLOCKED);
console.log("called but missing in backend:", summary.dashboardFrontend.missingInBackend);

console.log("\n=============== FAILURE CATEGORIES (backend) ===============");
for (const [k, v] of Object.entries(summary.failCategories).sort((a, b) => b[1] - a[1])) {
  console.log(pad(v, 5), k);
}
console.log("\npath lists ->", LIST_DIR);
