/**
 * Run once to bootstrap the super-admin account.
 * Usage:  npx ts-node -r tsconfig-paths/register scripts/seed-superadmin.ts
 *
 * The script is idempotent — running it again updates the password but never
 * creates a duplicate record.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error('MONGO_URI is not set in .env');

// ─── Minimal inline schemas (avoids importing the full app bundle) ────────────

const DashboardLoginUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String },
    role: { type: String, default: 'admin' },
    assignedStores: [{ type: String }],
    primaryStoreId: { type: String },
  },
  { timestamps: true },
);

const AdminDirectoryUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    role: { type: String },
    permissions: [{ type: String }],
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    emailVerified: { type: Boolean, default: true },
    twoFactorEnabled: { type: Boolean, default: false },
    location: [{ type: String }],
    assignedStores: [{ type: String }],
  },
  { timestamps: true },
);

const DashboardLoginUser =
  mongoose.models.User ??
  mongoose.model('User', DashboardLoginUserSchema);

const AdminDirectoryUser =
  (mongoose.models.AdminUser as mongoose.Model<any>) ??
  mongoose.model('AdminUser', AdminDirectoryUserSchema);

// ─── Super-admin account details ─────────────────────────────────────────────

const SUPER_ADMIN = {
  name: 'Hemanath C',
  email: 'hemanathc0112@gmail.com',
  password: 'Selorg@2024',   // ← change after first login
  role: 'admin',             // 'admin' maps to 'Super Admin' in the frontend
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(MONGO_URI as string);
  console.log('Connected to MongoDB');

  const hashed = await bcrypt.hash(SUPER_ADMIN.password, 10);

  // 1. Upsert DashboardLoginUser (the collection the auth service queries)
  await DashboardLoginUser.findOneAndUpdate(
    { email: SUPER_ADMIN.email },
    {
      email: SUPER_ADMIN.email,
      password: hashed,
      name: SUPER_ADMIN.name,
      role: SUPER_ADMIN.role,
      assignedStores: [],
      primaryStoreId: '',
    },
    { upsert: true, new: true, runValidators: true },
  );
  console.log(`✓ DashboardLoginUser upserted for ${SUPER_ADMIN.email}`);

  // 2. Upsert AdminDirectoryUser (the HR-style record shown in User Management)
  await AdminDirectoryUser.findOneAndUpdate(
    { email: SUPER_ADMIN.email },
    {
      email: SUPER_ADMIN.email,
      password: hashed,
      name: SUPER_ADMIN.name,
      department: 'Technology',
      role: SUPER_ADMIN.role,
      permissions: ['*'],
      status: 'active',
      emailVerified: true,
      twoFactorEnabled: false,
      location: [],
      assignedStores: [],
    },
    { upsert: true, new: true, runValidators: true },
  );
  console.log(`✓ AdminDirectoryUser upserted for ${SUPER_ADMIN.email}`);

  console.log('\n Super-admin ready:');
  console.log(`   Email    : ${SUPER_ADMIN.email}`);
  console.log(`   Password : ${SUPER_ADMIN.password}`);
  console.log(`   Role     : ${SUPER_ADMIN.role} (Super Admin)\n`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
