/**
 * Lab helper: mark picker/rider users ACTIVE so ops APIs (shared-orders, etc.) work.
 * Usage: node scripts/activate-workforce-users.mjs [phone...]
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const phones = process.argv.slice(2).length
  ? process.argv.slice(2).map((p) => String(p).slice(-10))
  : ["9698790922", "9698790923"];

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("MONGO_URI missing");
  process.exit(1);
}

await mongoose.connect(uri);
const now = new Date();
for (const phone of phones) {
  const role = phone.endsWith("3") ? "rider" : "picker";
  const r = await mongoose.connection.db.collection("picker_users").updateOne(
    { phone },
    { $set: { status: "ACTIVE", workforceRole: role, approvedAt: now, updatedAt: now } },
  );
  console.log(`${phone} (${role}): matched=${r.matchedCount} modified=${r.modifiedCount}`);
}
await mongoose.disconnect();
