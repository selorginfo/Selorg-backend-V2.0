/**
 * Cross-app smoke: verifies auth + one core activity path per consumer against live :3333.
 * Usage: node scripts/_test-cross-app-smoke.mjs
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const BASE = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3333";
const ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL || "hemanathc0112@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD || "Selorg@2024";
const CUSTOMER_PHONE = (process.env.OTP_TEST_MOBILE || "9698790921").slice(-10);
const CUSTOMER_OTP = process.env.OTP_TEST_OTP || "8790";
const PICKER_PHONE = "9698790922";
const RIDER_PHONE = "9698790923";
const HHD_PHONE = "9698790924";
const FIXED_OTP = "8790";

async function http(method, p, token, body, extraHeaders = {}) {
  const h = { Accept: "application/json", ...extraHeaders };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined && method !== "GET" && method !== "DELETE") {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + p, { method, headers: h, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text: text.slice(0, 200) };
}

function ok(label, res, accept = (s) => s >= 200 && s < 500 && s !== 501) {
  const pass = accept(res.status);
  console.log(`${pass ? "PASS" : "FAIL"} ${label} -> ${res.status}`);
  if (!pass) console.log("  ", res.text);
  return pass;
}

async function withDb(fn) {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI missing");
  await mongoose.connect(uri);
  try {
    return await fn(mongoose.connection.db);
  } finally {
    await mongoose.disconnect();
  }
}

/** After send-otp stores an OTP, overwrite with a known code so verify can run without SMS. */
async function plantPickerOtp(phone) {
  await withDb(async (db) => {
    const now = new Date();
    await db.collection("picker_otps").updateOne(
      { identifier: phone },
      {
        $set: {
          identifier: phone,
          otp: FIXED_OTP,
          expiresAt: new Date(now.getTime() + 10 * 60000),
          attempts: 0,
          verified: false,
          sendCount: 1,
          windowStartedAt: now,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  });
}

/** Ops endpoints require PickerUser.status === ACTIVE (not PENDING onboarding). */
async function activateWorkforceUser(phone, workforceRole) {
  await withDb(async (db) => {
    const now = new Date();
    await db.collection("picker_users").updateOne(
      { phone },
      {
        $set: {
          status: "ACTIVE",
          workforceRole: workforceRole || "picker",
          approvedAt: now,
          updatedAt: now,
        },
      },
    );
  });
}

async function plantHhdOtp(phone) {
  await withDb(async (db) => {
    const now = new Date();
    const coll = db.collection("hhd_otps");
    await coll.deleteMany({ identifier: phone, isUsed: false });
    await coll.insertOne({
      identifier: phone,
      mobile: phone,
      channel: "sms",
      otp: FIXED_OTP,
      expiresAt: new Date(now.getTime() + 10 * 60000),
      isUsed: false,
      attemptCount: 0,
      lastSentAt: now,
      createdAt: now,
      updatedAt: now,
    });
  });
}

const results = [];

results.push(ok("INFRA health", await http("GET", "/health")));

const login = await http("POST", "/api/v1/admin/auth/login", null, {
  email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "admin",
});
results.push(ok("DASHBOARD login", login));
const adminToken = login.json?.data?.token;
results.push(ok("DASHBOARD orders", await http("GET", "/api/v1/admin/orders?limit=5", adminToken)));
results.push(ok("DASHBOARD picker approvals", await http("GET", "/api/v1/admin/picker/approvals", adminToken)));
results.push(ok("DASHBOARD riders live", await http("GET", "/api/v1/rider/dispatch/map/riders", adminToken)));
results.push(ok("DASHBOARD darkstore summary", await http("GET", "/api/v1/darkstore/dashboard/summary", adminToken)));
results.push(ok("DASHBOARD customers", await http("GET", "/api/v1/admin/customers?limit=5", adminToken)));
results.push(ok("DASHBOARD api catalog probe", await http("GET", "/api/v1/shared/analytics/rider-performance", adminToken)));

const custSend = await http("POST", "/api/v1/customer/auth/send-otp", null, {
  phoneNumber: CUSTOMER_PHONE, preferredChannel: "sms",
});
results.push(ok("CUSTOMER send-otp", custSend));
const sessionId = custSend.json?.data?.sessionId;
const custVerify = await http("POST", "/api/v1/customer/auth/verify-otp", null, {
  sessionId, otp: CUSTOMER_OTP,
});
results.push(ok("CUSTOMER verify-otp", custVerify));
const customerToken = custVerify.json?.data?.accessToken || custVerify.json?.data?.token;
if (customerToken) {
  results.push(ok("CUSTOMER home", await http("GET", "/api/v1/customer/home", customerToken)));
  results.push(ok("CUSTOMER search", await http("GET", "/api/v1/customer/products/search?q=milk&limit=5", customerToken)));
  results.push(ok("CUSTOMER cart", await http("GET", "/api/v1/customer/cart", customerToken)));
}

async function workforceAuth(label, phone, client) {
  const headers = client ? { "x-selorg-client": client } : {};
  const send = await http("POST", "/api/v1/picker/auth/send-otp", null, { phone }, headers);
  results.push(ok(`${label} send-otp`, send));
  await plantPickerOtp(phone);
  const verify = await http(
    "POST",
    "/api/v1/picker/auth/verify-otp",
    null,
    { phone, otp: FIXED_OTP, ...(client === "rider" ? { workforceRole: "rider" } : {}) },
    headers,
  );
  results.push(ok(`${label} verify-otp`, verify));
  await activateWorkforceUser(phone, client === "rider" ? "rider" : "picker");
  return verify.json?.data?.token;
}

const pickerToken = await workforceAuth("PICKER", PICKER_PHONE);
if (pickerToken) {
  results.push(ok("PICKER profile", await http("GET", "/api/v1/picker/user/profile", pickerToken)));
  results.push(ok("PICKER onboarding", await http("GET", "/api/v1/picker/onboarding/state", pickerToken)));
  results.push(ok("PICKER shifts", await http("GET", "/api/v1/picker/shifts/available", pickerToken)));
}

const riderToken = await workforceAuth("RIDER", RIDER_PHONE, "rider");
if (riderToken) {
  results.push(ok("RIDER profile", await http("GET", "/api/v1/picker/user/profile", riderToken)));
  results.push(ok("RIDER shared-orders", await http("GET", "/api/v1/picker/shared-orders", riderToken), (s) => s >= 200 && s < 300));
}

const hhdSend = await http("POST", "/api/v1/hhd/auth/send-otp", null, { mobile: HHD_PHONE });
results.push(ok("HHD send-otp", hhdSend, (s) => s === 200 || s === 429));
await plantHhdOtp(HHD_PHONE);
const hhdVerify = await http("POST", "/api/v1/hhd/auth/verify-otp", null, { mobile: HHD_PHONE, otp: FIXED_OTP });
results.push(ok("HHD verify-otp", hhdVerify));
const hhdToken = hhdVerify.json?.data?.token;
if (hhdToken) {
  results.push(ok("HHD dashboard", await http("GET", "/api/v1/hhd/dashboard", hhdToken)));
  results.push(ok("HHD current order", await http("GET", "/api/v1/hhd/orders/current", hhdToken)));
  results.push(ok("HHD tasks", await http("GET", "/api/v1/hhd/tasks", hhdToken)));
}

const failed = results.filter((r) => !r).length;
console.log("\n=== CROSS-APP SMOKE ===");
console.log(`checks=${results.length} fail=${failed}`);
process.exit(failed ? 1 : 0);
