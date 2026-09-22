/**
 * TEST INFRASTRUCTURE ONLY — not part of the application.
 * Starts an ephemeral local MongoDB (mongodb-memory-server) and writes the
 * backend `.env` used by the automation run, then stays alive.
 * Prints sentinel line:  MONGO_READY <uri>
 */
import { MongoMemoryReplSet } from "mongodb-memory-server";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Single-node replica set: the order/payment services use MongoDB transactions,
// which standalone mongod rejects ("Transaction numbers are only allowed on a
// replica set member or mongos").
const mongod = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
  instance: {
    port: 27017,
    dbName: "selorg_test",
  },
});

const uri = mongod.getUri("selorg_test");

const jwt = crypto.randomBytes(48).toString("hex");
const customerJwt = crypto.randomBytes(48).toString("hex");
const pickerJwt = crypto.randomBytes(48).toString("hex");

const env = [
  "NODE_ENV=development",
  "PORT=3333",
  "HOST=127.0.0.1",
  `MONGO_URI=${uri}`,
  `JWT_SECRET=${jwt}`,
  `CUSTOMER_JWT_SECRET=${customerJwt}`,
  `PICKER_JWT_SECRET=${pickerJwt}`,
  "ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173",
  "API_VERSION=1.0.0",
  "DISABLE_REDIS=true",
  "REDIS_ENABLED=false",
  "DISABLE_CACHE=true",
  "ENABLE_SWAGGER=true",
  "OTP_DEV_MODE=true",
  "ALLOW_CUSTOMER_TEST_OTP=true",
  "OTP_TEST_MOBILE=9698790921",
  "OTP_TEST_OTP=8790",
  "RATE_LIMIT_WINDOW_MS=60000",
  "RATE_LIMIT_MAX_REQUESTS=5000",
  "WORLDLINE_ENABLED=0",
  "FRONTEND_URL=http://localhost:5173",
  "CUSTOMER_WEB_URL=http://localhost:5173",
  "",
].join("\n");

fs.writeFileSync(path.join(root, ".env"), env, "utf8");

console.log(`MONGO_READY ${uri}`);
console.log("ENV_WRITTEN .env");

process.on("SIGINT", async () => {
  await mongod.stop();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await mongod.stop();
  process.exit(0);
});
