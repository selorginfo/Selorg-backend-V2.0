/**
 * One-shot: create / reset a Super Admin login.
 * Usage: npx ts-node -r tsconfig-paths/register scripts/create-superadmin-login.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error('MONGO_URI is not set in .env');

const SUPER_ADMIN = {
  name: 'Selorg Super Admin',
  email: 'superadmin@selorg.com',
  password: 'Selorg@Admin2026',
  role: 'admin',
};

async function run() {
  await mongoose.connect(MONGO_URI as string);
  console.log('Connected to MongoDB');

  const DashboardLoginUser =
    mongoose.models.User ||
    mongoose.model(
      'User',
      new mongoose.Schema(
        {
          email: { type: String, required: true, unique: true },
          password: { type: String, required: true },
          name: { type: String },
          role: { type: String, default: 'admin' },
          assignedStores: [{ type: String }],
          primaryStoreId: { type: String },
        },
        { timestamps: true },
      ),
    );

  const AdminDirectoryUser =
    (mongoose.models.AdminUser as mongoose.Model<any>) ||
    mongoose.model(
      'AdminUser',
      new mongoose.Schema(
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
      ),
    );

  const hashed = await bcrypt.hash(SUPER_ADMIN.password, 10);

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
  console.log(`Dashboard login upserted: ${SUPER_ADMIN.email}`);

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
  console.log(`Admin directory upserted: ${SUPER_ADMIN.email}`);

  console.log('\n--- Super Admin credentials ---');
  console.log(`Email    : ${SUPER_ADMIN.email}`);
  console.log(`Password : ${SUPER_ADMIN.password}`);
  console.log(`Sign in as: Super Admin`);
  console.log('-------------------------------\n');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
