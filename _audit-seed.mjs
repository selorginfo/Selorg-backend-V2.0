/**
 * Seeds the two pieces of data the audit cannot otherwise exercise
 * (an active coupon, and a funded wallet on the test account) and can undo it.
 *   node seed-testdata.mjs up
 *   node seed-testdata.mjs down
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";

const SERVICE_DIR = "c:/Users/lmbac/Desktop/Selorg V1.3/selorg-service";
dotenv.config({ path: path.join(SERVICE_DIR, ".env") });

const MODE = process.argv[2] || "up";
const COUPON_CODE = "AUDITTEST50";
const TEST_PHONE = "9698790921";

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;

const user = await db.collection("customer_users").findOne({ phoneNumber: TEST_PHONE });
if (!user) throw new Error("test customer not found");
console.log("customer:", String(user._id));

const COUPONS = "customer_coupons";
const WALLETS = "customerwallets";

if (MODE === "up") {
  await db.collection(COUPONS).deleteMany({ code: COUPON_CODE });
  const now = new Date();
  const ins = await db.collection(COUPONS).insertOne({
    code: COUPON_CODE,
    name: "Audit Test 50 Off",
    description: "Temporary coupon created by the API audit",
    discountType: "FLAT_DISCOUNT",
    discountValue: 50,
    minOrderValue: 40,
    minOrderAmount: 40,
    maxDiscount: null,
    maxDiscountAmount: null,
    discountOn: "CART_TOTAL",
    applicableCategories: [],
    applicableProducts: [],
    applicableSkuIds: [],
    tiers: [],
    bogoMinQty: 2,
    usageLimit: null,
    usagePerUser: 100,
    usageCount: 0,
    isFirstOrderOnly: false,
    startDate: new Date(now.getTime() - 86400000),
    endDate: new Date(now.getTime() + 7 * 86400000),
    validFrom: new Date(now.getTime() - 86400000),
    validTo: new Date(now.getTime() + 7 * 86400000),
    isActive: true,
    status: "active",
    paymentRestriction: "ALL",
    targetZones: [],
    showInSections: ["COUPON_LIST"],
    priorityRank: 1,
    createdAt: now,
    updatedAt: now,
  });
  console.log("coupon inserted:", COUPON_CODE, String(ins.insertedId));

  const w = await db.collection(WALLETS).findOne({ customerId: user._id });
  console.log("wallet before:", w ? { _id: String(w._id), balance: w.balance } : null);
  if (w) {
    await db.collection(WALLETS).updateOne({ _id: w._id }, { $set: { balance: 500, isActive: true } });
    console.log("wallet balance set to 500 (was", w.balance, ")");
  } else {
    console.log("!! no wallet doc for test customer");
  }
} else {
  await db.collection(COUPONS).deleteMany({ code: COUPON_CODE });
  const w = await db.collection(WALLETS).findOne({ customerId: user._id });
  if (w) {
    await db.collection(WALLETS).updateOne({ _id: w._id }, { $set: { balance: 0 } });
    console.log("wallet balance reset to 0 (was", w.balance, ")");
  }
  console.log("coupon removed:", COUPON_CODE);
}

await mongoose.disconnect();
