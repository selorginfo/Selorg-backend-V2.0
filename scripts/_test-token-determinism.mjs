/**
 * TEST INFRASTRUCTURE ONLY.
 *
 * Checks whether two consecutive admin logins mint the SAME JWT string. If they
 * do, the in-memory logout blocklist (keyed on the raw token) will reject every
 * future session for that account until the process restarts.
 *
 * Prints only booleans and claim NAMES — never token or claim values.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const BASE = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3333";
const creds = {
  email: process.env.ADMIN_TEST_EMAIL || "hemanathc0112@gmail.com",
  password: process.env.ADMIN_TEST_PASSWORD || "Selorg@2024",
  role: "admin",
};

async function login() {
  const res = await fetch(`${BASE}/api/v1/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  const j = await res.json();
  return { status: res.status, token: j?.data?.token || null };
}

const a = await login();
await new Promise((r) => setTimeout(r, 2500));
const b = await login();

if (!a.token || !b.token) {
  console.log("login failed:", a.status, b.status);
  process.exit(1);
}

const claims = (t) => Object.keys(JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()));
const hasIat = (t) => claims(t).includes("iat");
const iatDiffers = () => {
  const p = (t) => JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());
  return p(a.token).iat !== p(b.token).iat;
};

console.log("two logins 2.5s apart produced IDENTICAL token string:", a.token === b.token);
console.log("payload claim names:", claims(a.token).join(", "));
console.log("payload contains 'iat':", hasIat(a.token));
console.log("payload contains 'jti':", claims(a.token).includes("jti"));
console.log("'iat' differs between the two logins:", hasIat(a.token) ? iatDiffers() : "n/a");

// Does a brand-new token get rejected as revoked after a logout of an older one?
const probe = async (token) => {
  const r = await fetch(`${BASE}/api/v1/admin/users?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  return `${r.status} ${j?.error?.appCode || j?.message || ""}`.trim();
};
console.log("probe with token A before logout:", await probe(a.token));
const lo = await fetch(`${BASE}/api/v1/admin/auth/logout`, {
  method: "POST", headers: { Authorization: `Bearer ${a.token}` },
});
console.log("logout(A) status:", lo.status);
console.log("probe with token A after logout(A):", await probe(a.token));
console.log("probe with token B after logout(A):", await probe(b.token));
const c = await login();
console.log("probe with FRESH token C after logout(A):", await probe(c.token));
console.log("C identical to A:", c.token === a.token);
