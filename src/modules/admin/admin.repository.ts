import { DashboardLoginUser, IDashboardLoginUser } from './admin-login.model';
import { AdminDirectoryUser, IAdminDirectoryUser } from './admin-directory.model';
import { Role, IRole } from './role.model';
import { Permission, IPermission } from './permission.model';
import { UserEmailVerification } from './user-email-verification.model';

// --- Dashboard login (shared credential row, legacy `vendor/models/User.js`) -----------

export function findDashboardLoginByEmail(email: string) {
  return DashboardLoginUser.findOne({ email: email.toLowerCase().trim() });
}

export function upsertDashboardLogin(
  email: string,
  set: Partial<Pick<IDashboardLoginUser, 'password' | 'name' | 'role' | 'assignedStores' | 'primaryStoreId'>>,
  opts: { upsert: boolean },
) {
  return DashboardLoginUser.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    opts.upsert ? { email: email.toLowerCase().trim(), ...set } : { $set: set },
    { upsert: opts.upsert, runValidators: true },
  );
}

// --- Admin directory (employee record, legacy `admin/models/User.js`) ------------------

export interface AdminDirectoryFilter {
  status?: string;
  roleId?: string;
  department?: string;
  search?: string;
}

export function findDirectoryUsers(filter: AdminDirectoryFilter) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.roleId) query.roleId = filter.roleId;
  if (filter.department) query.department = filter.department;
  if (filter.search) {
    query.$or = [
      { name: { $regex: filter.search, $options: 'i' } },
      { email: { $regex: filter.search, $options: 'i' } },
    ];
  }
  return AdminDirectoryUser.find(query)
    .populate('roleId', 'name description accessScope')
    .populate('reportingManagerId', 'name email')
    .sort({ createdAt: -1 })
    .lean();
}

export function findDirectoryUserById(id: string) {
  return AdminDirectoryUser.findById(id)
    .populate('roleId', 'name description permissions accessScope')
    .populate('reportingManagerId', 'name email')
    .lean();
}

export function findDirectoryUserByIdRaw(id: string) {
  return AdminDirectoryUser.findById(id);
}

export function findDirectoryUserByEmail(email: string) {
  return AdminDirectoryUser.findOne({ email: email.toLowerCase() });
}

export function createDirectoryUser(data: Partial<IAdminDirectoryUser>) {
  return AdminDirectoryUser.create(data);
}

export function deleteDirectoryUser(id: string) {
  return AdminDirectoryUser.findByIdAndDelete(id);
}

// --- Roles -------------------------------------------------------------------------------

export interface RoleFilter {
  roleType?: string;
  accessScope?: string;
  isActive?: boolean;
}

export function findRoles(filter: RoleFilter) {
  const query: Record<string, unknown> = {};
  if (filter.roleType) query.roleType = filter.roleType;
  if (filter.accessScope) query.accessScope = filter.accessScope;
  if (filter.isActive !== undefined) query.isActive = filter.isActive;
  return Role.find(query).populate('createdBy', 'name email').lean();
}

export function findRoleById(id: string) {
  return Role.findById(id).populate('createdBy', 'name email').lean();
}

export function findRoleByIdRaw(id: string) {
  return Role.findById(id);
}

export function findRoleByName(name: string) {
  return Role.findOne({ name });
}

export function createRole(data: Partial<IRole>) {
  return Role.create(data);
}

export function deleteRole(id: string) {
  return Role.findByIdAndDelete(id);
}

export function findRoleTemplates() {
  return Role.find({ isTemplate: true, isActive: true }).sort({ isSystemTemplate: -1, name: 1 }).lean();
}

export function findRoleTemplateBy(filter: { _id?: string; templateKey?: string }) {
  const query: Record<string, unknown> = { isTemplate: true, isActive: true };
  if (filter._id) query._id = filter._id;
  if (filter.templateKey) query.templateKey = filter.templateKey;
  return Role.findOne(query).lean();
}

export function countActiveUsersForRole(roleId: string) {
  return AdminDirectoryUser.countDocuments({ roleId, status: 'active' });
}

export function countAllUsersForRole(roleId: string) {
  return AdminDirectoryUser.countDocuments({ roleId });
}

// --- Permissions -------------------------------------------------------------------------

export interface PermissionFilter {
  module?: string;
  category?: string;
  isActive?: boolean;
}

export function findPermissions(filter: PermissionFilter) {
  const query: Record<string, unknown> = {};
  if (filter.module) query.module = filter.module;
  if (filter.category) query.category = filter.category;
  if (filter.isActive !== undefined) query.isActive = filter.isActive;
  return Permission.find(query).sort({ module: 1, displayName: 1 }).lean();
}

export function findActivePermissionsSorted() {
  return Permission.find({ isActive: true }).sort({ module: 1, action: 1, displayName: 1 }).lean();
}

export function findPermissionById(id: string) {
  return Permission.findById(id).lean();
}

export function findPermissionByIdRaw(id: string) {
  return Permission.findById(id);
}

export function findPermissionByName(name: string) {
  return Permission.findOne({ name: name.toLowerCase() });
}

export function findPermissionsByNames(names: string[]) {
  return Permission.find({ name: { $in: names }, isActive: true }).select('name').lean();
}

export function createPermission(data: Partial<IPermission>) {
  return Permission.create(data);
}

export function deletePermission(id: string) {
  return Permission.findByIdAndDelete(id);
}

export function findRolesUsingPermission(permissionName: string) {
  return Role.find({ permissions: permissionName, isActive: true }).select('name').lean();
}

// --- Email verification (admin user-creation OTP) -----------------------------------------

export function createEmailVerification(data: {
  email: string;
  otpHash: string;
  requestedByUserId?: string | null;
  expiresAt: Date;
}) {
  return UserEmailVerification.create(data);
}

export function findValidVerification(email: string, verificationId: string) {
  return UserEmailVerification.findOne({
    _id: verificationId,
    email,
    expiresAt: { $gt: new Date() },
    consumedAt: null,
  });
}

export function findVerifiedUnconsumedVerification(email: string, verificationId: string) {
  return UserEmailVerification.findOne({
    _id: verificationId,
    email,
    verifiedAt: { $ne: null },
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  });
}

export function deleteVerification(id: string) {
  return UserEmailVerification.deleteOne({ _id: id });
}
