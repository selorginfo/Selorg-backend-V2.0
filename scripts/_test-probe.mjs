/**
 * TEST INFRASTRUCTURE ONLY.
 *
 * Probes specific endpoints with a real admin token and prints status + message.
 *
 * Usage: node scripts/_test-probe.mjs GET /api/v1/admin/picker/approvals [METHOD PATH ...]
 *        node scripts/_test-probe.mjs --file probe-list.txt
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env") });
const BASE = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3333";

async function adminToken() {
  const r = await fetch(`${BASE}/api/v1/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.ADMIN_TEST_EMAIL || "hemanathc0112@gmail.com",
      password: process.env.ADMIN_TEST_PASSWORD || "Selorg@2024",
      role: "admin",
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j?.data?.token) throw new Error(`admin login failed (${r.status}): ${j?.message || ""}`);
  return j.data.token;
}

const args = process.argv.slice(2);
let pairs = [];
if (args[0] === "--file") {
  pairs = fs.readFileSync(args[1], "utf8").trim().split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => l.trim().split(/\s+/));
} else {
  for (let i = 0; i < args.length; i += 2) pairs.push([args[i], args[i + 1]]);
}

const token = await adminToken();
let pass = 0, fail = 0;
for (const [method, p] of pairs) {
  const init = { method, headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } };
  if (method !== "GET" && method !== "DELETE") {
    init.headers["Content-Type"] = "application/json";
    init.body = "{}";
  }
  const r = await fetch(BASE + p, init);
  const j = await r.json().catch(() => ({}));
  const msg = String(j?.message || j?.error?.message || "ok").replace(/\s+/g, " ").slice(0, 80);
  const bad = r.status === 501 || r.status >= 500 || /^Route #/.test(msg);
  if (bad) fail++; else pass++;
  console.log(`${bad ? "FAIL" : "ok  "} ${String(r.status).padEnd(4)} ${method.padEnd(6)} ${p}  | ${msg}`);
}
console.log(`\n${pass} ok, ${fail} failing`);
