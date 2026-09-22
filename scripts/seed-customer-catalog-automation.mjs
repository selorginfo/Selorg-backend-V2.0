/**
 * Minimal deterministic catalog + store seed for customer-app Playwright automation.
 * Idempotent upserts by stable codes/slugs (safe to re-run).
 *
 * Usage (from selorg-service):
 *   node scripts/seed-customer-catalog-automation.mjs
 *
 * Category/product labels use dummy-* prefixes so catalogHygiene hides them from
 * customer-facing webapp/home APIs. Prefer real Master Sheet data for demos.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Windows/Node SRV lookup can fail with ECONNREFUSED while system DNS works.
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
dns.setDefaultResultOrder?.("ipv4first");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error("MONGO_URI is not set in selorg-service/.env");

const STORE_CODE = "AUTO-CHN-CENTRAL-01";
const CAT_SLUG = "dummy-organic-staples";
const SUB_SLUG = "dummy-fresh-dairy";
const PRODUCT_SKU = "AUTO-MILK-1L";

// Matches Playwright Chennai fixture coords (13.0827, 80.2707).
const STORE_LAT = 13.0827;
const STORE_LNG = 80.2707;

async function connectMongo(uri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
    return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!uri.startsWith("mongodb+srv://") || !/querySrv|ECONNREFUSED|ENOTFOUND/i.test(msg)) {
      throw err;
    }
    // Convert mongodb+srv → standard mongodb:// using public DNS SRV records.
    const { Resolver } = await import("node:dns/promises");
    const resolver = new Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1"]);
    const m = uri.match(/^mongodb\+srv:\/\/([^@]+)@([^/?]+)(\/[^?]*)?(\?.*)?$/);
    if (!m) throw err;
    const [, auth, host, dbPath = "/", query = ""] = m;
    const records = await resolver.resolveSrv(`_mongodb._tcp.${host}`);
    const hosts = records.map((r) => `${r.name}:${r.port}`).join(",");
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    if (!params.has("ssl")) params.set("ssl", "true");
    if (!params.has("authSource")) params.set("authSource", "admin");
    if (!params.has("retryWrites")) params.set("retryWrites", "true");
    const direct = `mongodb://${auth}@${hosts}${dbPath || "/"}?${params.toString()}`;
    console.warn("seed: mongodb+srv SRV failed; retrying with direct hosts");
    await mongoose.connect(direct, { serverSelectionTimeoutMS: 20000 });
  }
}

await connectMongo(MONGO_URI);
const db = mongoose.connection.db;

const stores = db.collection("dark_stores");
const categories = db.collection("customer_categories");
const products = db.collection("customer_products");
const inventory = db.collection("store_inventory");

const now = new Date();

await stores.updateOne(
  { code: STORE_CODE },
  {
    $set: {
      name: "Chennai Central Dark Store",
      code: STORE_CODE,
      location: { type: "Point", coordinates: [STORE_LNG, STORE_LAT] },
      address: {
        line1: "Anna Salai",
        line2: "",
        city: "Chennai",
        state: "TN",
        pincode: "600002",
      },
      serviceRadius: 15,
      isActive: true,
      operatingHours: { open: "06:00", close: "23:59" },
      avgPickPackTime: 5,
      contactPhone: "+919876543210",
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  },
  { upsert: true },
);
const storeDoc = await stores.findOne({ code: STORE_CODE });
const storeId = storeDoc._id;
console.log("store:", String(storeId), STORE_CODE);

await categories.updateOne(
  { slug: CAT_SLUG },
  {
    $set: {
      name: "Dummy Organic Staples",
      slug: CAT_SLUG,
      description: "Automation catalog category (hidden from customers)",
      level: 1,
      parentId: null,
      isActive: false,
      order: 1,
      hierarchyCodes: ["ORG"],
      imageUrl: "",
      thumbnailUrl: "",
      cardImageUrl: "",
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  },
  { upsert: true },
);
const catDoc = await categories.findOne({ slug: CAT_SLUG });
const categoryId = catDoc._id;
console.log("category:", String(categoryId), CAT_SLUG);

await categories.updateOne(
  { slug: SUB_SLUG },
  {
    $set: {
      name: "Dummy Fresh Dairy",
      slug: SUB_SLUG,
      description: "Automation catalog subcategory (hidden from customers)",
      level: 2,
      parentId: categoryId,
      isActive: false,
      order: 1,
      hierarchyCodes: ["ORG-DAIRY"],
      imageUrl: "",
      thumbnailUrl: "",
      cardImageUrl: "",
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  },
  { upsert: true },
);
const subDoc = await categories.findOne({ slug: SUB_SLUG });
const subcategoryId = subDoc._id;
console.log("subcategory:", String(subcategoryId), SUB_SLUG);

await products.updateOne(
  { sku: PRODUCT_SKU },
  {
    $set: {
      name: "Dummy Farm Fresh Milk 1L",
      sku: PRODUCT_SKU,
      classification: "Style",
      isActive: false,
      isSaleable: false,
      isPurchasable: false,
      isStocked: true,
      status: "active",
      price: 62,
      mrp: 70,
      originalPrice: 70,
      gstRate: 0,
      taxPercent: 0,
      size: "1 L",
      quantity: "1 L",
      uom: "L",
      stockQuantity: 100,
      stock: 100,
      categoryId,
      subcategoryId,
      images: [],
      imageUrl: "",
      thumbnailUrl: "",
      cardImageUrl: "",
      searchKeywords: ["milk", "dairy", "organic", "farm fresh"],
      searchKeywordsNormalized: "milk dairy organic farm fresh",
      tag: "Dairy",
      brand: "Selorg Farms",
      deliveryInfo: "10-min delivery",
      maxOrderLimit: 10,
      sortOrder: 1,
      deletedAt: null,
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  },
  { upsert: true },
);
const productDoc = await products.findOne({ sku: PRODUCT_SKU });
const productId = productDoc._id;
console.log("product:", String(productId), PRODUCT_SKU);

await inventory.updateOne(
  { storeId, productId },
  {
    $set: {
      storeId,
      productId,
      quantity: 100,
      reservedQty: 0,
      isAvailable: true,
      lowStockThreshold: 5,
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  },
  { upsert: true },
);
console.log("inventory: store×product qty=100");

// Ensure 2dsphere index exists for store assign $near queries.
try {
  await stores.createIndex({ location: "2dsphere" });
} catch {
  /* already exists */
}

await mongoose.disconnect();
console.log("seed-customer-catalog-automation: OK");
console.log(
  JSON.stringify(
    {
      storeId: String(storeId),
      categoryId: String(categoryId),
      subcategoryId: String(subcategoryId),
      productId: String(productId),
      sku: PRODUCT_SKU,
    },
    null,
    2,
  ),
);
