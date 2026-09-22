import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Admin/employee directory record — ported from legacy `admin/models/User.js`.
 * This is distinct from `admin-login.model.ts`'s `DashboardLoginUser`: this is the
 * HR-style record shown in the admin panel's User Management UI (department, reporting
 * manager, location, notes); `DashboardLoginUser` is the actual login credential row that
 * gets upserted in lockstep by `admin-users.service.ts` whenever this record's role is one
 * of the dashboard-role set (see legacy `getDashboardRole`).
 */
export interface IAdminDirectoryUser extends Document {
  email: string;
  password: string;
  name: string;
  department?: string;
  roleId?: Types.ObjectId;
  role?: string;
  permissions: string[];
  status: 'active' | 'inactive' | 'suspended';
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  reportingManagerId?: Types.ObjectId;
  location: string[];
  startDate?: Date;
  lastLogin?: Date;
  notes?: string;
  assignedStores: string[];
  primaryStoreId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AdminDirectoryUserSchema = new Schema<IAdminDirectoryUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', index: true },
    role: { type: String, index: true },
    permissions: [{ type: String }],
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active', index: true },
    emailVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    reportingManagerId: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    location: [{ type: String }],
    startDate: { type: Date },
    lastLogin: { type: Date },
    notes: { type: String },
    assignedStores: [{ type: String }],
    primaryStoreId: { type: String },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

AdminDirectoryUserSchema.index({ status: 1, roleId: 1 });
AdminDirectoryUserSchema.index({ email: 1, status: 1 });
AdminDirectoryUserSchema.index({ department: 1, status: 1 });

export const AdminDirectoryUser =
  (mongoose.models.AdminUser as mongoose.Model<IAdminDirectoryUser>) ||
  mongoose.model<IAdminDirectoryUser>('AdminUser', AdminDirectoryUserSchema);
