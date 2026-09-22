/**
 * Seeds dark stores + test riders for end-to-end testing of the order
 * routing / dispatch / realtime pipeline.
 *
 * Usage:  npx ts-node -r tsconfig-paths/register scripts/seed-darkstores-and-riders.ts
 *
 * Idempotent — matches existing stores by `code` and riders by `id`.
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error('MONGO_URI is not set in .env');

// ─── Minimal inline schemas ─────────────────────────────────────────────────

const DarkStoreSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    address: { line1: String, line2: String, city: String, state: String, pincode: String },
    serviceRadius: { type: Number, default: 5 },
    isActive: { type: Boolean, default: true },
    operatingHours: { open: String, close: String },
    avgPickPackTime: { type: Number, default: 5 },
    contactPhone: { type: String, default: '' },
  },
  { timestamps: true, collection: 'dark_stores' },
);
DarkStoreSchema.index({ location: '2dsphere' });

const LocationSchema = new mongoose.Schema({ lat: Number, lng: Number }, { _id: false });
const CapacitySchema = new mongoose.Schema({ currentLoad: Number, maxLoad: Number }, { _id: false });
const RiderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: String,
    avatarInitials: String,
    status: String,
    currentOrderId: { type: String, default: null },
    location: LocationSchema,
    capacity: CapacitySchema,
    avgEtaMins: Number,
    rating: Number,
    zone: { type: String, default: null },
    homeStoreId: { type: mongoose.Schema.Types.ObjectId, ref: 'DarkStore', default: null },
  },
  { timestamps: true, collection: 'riders' },
);

// ─── Seed data ──────────────────────────────────────────────────────────────
// Four Chennai neighbourhoods with real-ish coordinates + 5km delivery radius.

const STORES = [
  {
    code: 'DS-Adyar-01',
    name: 'Adyar Dark Store',
    lat: 13.0067,
    lng: 80.2571,
    address: { line1: '1st Main Rd', line2: '', city: 'Chennai', state: 'TN', pincode: '600020' },
    contactPhone: '+919000000001',
  },
  {
    code: 'DS-Velachery-01',
    name: 'Velachery Dark Store',
    lat: 12.9760,
    lng: 80.2211,
    address: { line1: 'Vijayanagar', line2: '', city: 'Chennai', state: 'TN', pincode: '600042' },
    contactPhone: '+919000000002',
  },
  {
    code: 'DS-Nungambakkam-01',
    name: 'Nungambakkam Dark Store',
    lat: 13.0604,
    lng: 80.2413,
    address: { line1: 'Sterling Rd', line2: '', city: 'Chennai', state: 'TN', pincode: '600034' },
    contactPhone: '+919000000003',
  },
  {
    code: 'DS-Anna-Nagar-01',
    name: 'Anna Nagar Dark Store',
    lat: 13.0850,
    lng: 80.2101,
    address: { line1: '2nd Ave', line2: '', city: 'Chennai', state: 'TN', pincode: '600040' },
    contactPhone: '+919000000004',
  },
];

async function main() {
  await mongoose.connect(MONGO_URI!);
  console.log('[seed] Connected to Mongo');

  const DarkStore = mongoose.model('DarkStore', DarkStoreSchema);
  const Rider = mongoose.model('RiderOperational', RiderSchema);

  // Upsert stores
  const savedStores: Array<{ _id: mongoose.Types.ObjectId; code: string }> = [];
  for (const s of STORES) {
    const doc = await DarkStore.findOneAndUpdate(
      { code: s.code },
      {
        $set: {
          name: s.name,
          location: { type: 'Point', coordinates: [s.lng, s.lat] },
          address: s.address,
          serviceRadius: 5,
          isActive: true,
          operatingHours: { open: '06:00', close: '23:00' },
          avgPickPackTime: 5,
          contactPhone: s.contactPhone,
        },
      },
      { upsert: true, new: true },
    ).lean();
    savedStores.push({ _id: doc!._id as mongoose.Types.ObjectId, code: s.code });
    console.log(`[seed] store ${s.code} → ${doc!._id}`);
  }

  // Upsert 2 riders per store
  let riderNum = 1;
  for (const store of savedStores) {
    for (let i = 0; i < 2; i++) {
      const id = `RIDER-${String(riderNum).padStart(4, '0')}`;
      riderNum++;
      const name = `Test Rider ${riderNum - 1}`;
      await Rider.findOneAndUpdate(
        { id },
        {
          $set: {
            name,
            avatarInitials: name.slice(0, 2).toUpperCase(),
            status: 'online',
            capacity: { currentLoad: 0, maxLoad: 5 },
            avgEtaMins: 15,
            rating: 4.5,
            homeStoreId: store._id,
          },
        },
        { upsert: true, new: true },
      );
      console.log(`[seed] rider ${id} → homeStore=${store.code}`);
    }
  }

  console.log('[seed] Done.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
