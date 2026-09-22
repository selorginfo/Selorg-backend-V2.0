import mongoose, { Schema, Document } from 'mongoose';

/**
 * Shared dashboard login credential store — ported from legacy `vendor/models/User.js`.
 * Despite the path, this is NOT vendor-specific: admin/darkstore/warehouse/rider/finance/
 * merch/production/vendor dashboards all authenticate against this same `users` collection
 * (see legacy `admin/services/authService.js`). Kept faithful to the legacy collection name
 * so a future dashboard login port (vendor, darkstore, etc.) reads/writes the same rows.
 *
 * Registered as mongoose model `'User'` (not `'AdminUser'`) to match legacy — the separate
 * `AdminUser` model (see `admin-directory.model.ts`) is the HR/employee-directory record,
 * a different collection kept in sync via `admin-users.service.ts`.
 */
export interface IDashboardLoginUser extends Document {
  email: string;
  password: string;
  name?: string;
  role: string;
  assignedStores: string[];
  primaryStoreId?: string;
  hubKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const DashboardLoginUserSchema = new Schema<IDashboardLoginUser>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String },
    role: { type: String, default: 'admin' },
    assignedStores: [{ type: String }],
    primaryStoreId: { type: String },
    hubKey: { type: String, trim: true },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const DashboardLoginUser =
  (mongoose.models.User as mongoose.Model<IDashboardLoginUser>) ||
  mongoose.model<IDashboardLoginUser>('User', DashboardLoginUserSchema);
