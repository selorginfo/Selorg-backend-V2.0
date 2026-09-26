import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import * as repo from './admin.repository';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { cacheService } from '../../utils/cache';
import { recordAuditLog } from '../../services/audit.service';
import {
  sendAdminUserOtpEmail,
  sendAdminUserCreatedEmail,
  sendAdminCreationConfirmationEmail,
  sendAdminPasswordResetEmail,
} from './admin-user-emails';

const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

const DASHBOARD_ROLES = ['darkstore', 'production', 'merch', 'rider', 'finance', 'warehouse', 'admin', 'vendor'];

/**
 * Map a directory Role display name (or template key) onto the dashboard login role
 * stored in the shared `users` collection.
 */
function getDashboardRole(roleName?: string | null): string | null {
  if (!roleName) return null;
  const r = roleName.toLowerCase().trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (DASHBOARD_ROLES.includes(r.replace(/\s+/g, ''))) {
    // rare collapsed form
  }
  if (DASHBOARD_ROLES.includes(roleName.toLowerCase().trim())) return roleName.toLowerCase().trim();
  if (r.includes('dark store') || r.includes('darkstore') || r === 'store manager') return 'darkstore';
  if (r.includes('warehouse')) return 'warehouse';
  if (r.includes('production')) return 'production';
  if (r.includes('merch') || r.includes('catalog')) return 'merch';
  if (r.includes('rider')) return 'rider';
  if (r.includes('finance')) return 'finance';
  if (r.includes('vendor')) return 'vendor';
  if (r.includes('super admin') || r === 'admin' || r.includes('operations admin')) return 'admin';
  if (r.includes('admin')) return 'admin';
  return null;
}

function accessLevelFor(accessScope?: string): string {
  if (accessScope === 'global') return 'Full Access';
  if (accessScope === 'zone') return 'Zone Limited';
  return 'Store Limited';
}

function scopeLabelFor(user: Record<string, any>, role?: Record<string, any> | null): string {
  const stores: string[] = Array.isArray(user.assignedStores) ? user.assignedStores.filter(Boolean) : [];
  const primary = user.primaryStoreId ? String(user.primaryStoreId) : '';
  if (stores.length) return stores.join(', ');
  if (primary) return primary;
  if (role?.accessScope === 'store') return 'Unassigned store';
  if (role?.accessScope === 'zone') return 'Zone Limited';
  if (role?.accessScope === 'global' || !role) return 'Global';
  return accessLevelFor(role?.accessScope);
}

function formatDirectoryUser(user: Record<string, any>, role?: Record<string, any> | null) {
  const roleName = role?.name || user.roleName || user.role || '—';
  const statusRaw = String(user.status || 'active').toLowerCase();
  const accountStatus =
    statusRaw === 'inactive' || statusRaw === 'suspended' || statusRaw === 'deactivated'
      ? 'deactivated'
      : statusRaw === 'invited'
        ? 'invited'
        : 'active';
  const twoFa = user.twoFactorEnabled ? 'On' : 'Off';
  return {
    ...user,
    id: String(user._id || user.id),
    _id: undefined,
    password: undefined,
    role: roleName,
    roleName,
    scope: scopeLabelFor(user, role),
    accessLevel: accessLevelFor(role?.accessScope),
    accessScope: role?.accessScope || 'global',
    assignedStores: user.assignedStores || [],
    primaryStoreId: user.primaryStoreId || '',
    moduleCount: String(Array.isArray(role?.permissions) ? new Set(role.permissions.map((p: string) => String(p).split('.')[0])).size : user.permissions?.length || 0),
    sensitiveRights: Array.isArray(role?.permissions)
      ? role.permissions.filter((p: string) => /refund|delete|approve|assign/i.test(p)).slice(0, 3).join(', ') || '—'
      : '—',
    lastLogin: user.lastLogin ? new Date(user.lastLogin).toLocaleString('en-IN') : '—',
    twoFactor: twoFa,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    accountStatus,
    flagged: !user.twoFactorEnabled && accountStatus === 'active',
    status:
      accountStatus === 'active'
        ? { label: 'Active', tone: 'green' }
        : accountStatus === 'invited'
          ? { label: 'Invited', tone: 'amber' }
          : { label: 'Deactivated', tone: 'grey' },
    avatar: deriveAvatar(user.name),
  };
}

async function requireStoreAssignmentIfNeeded(
  role: Record<string, any> | null,
  assignedStores?: string[],
  primaryStoreId?: string,
): Promise<void> {
  if (!role || role.accessScope !== 'store') return;
  const stores = (assignedStores || []).map((s) => String(s).trim()).filter(Boolean);
  const primary = String(primaryStoreId || '').trim();
  if (!stores.length && !primary) {
    throw new AppError(
      'Dark Store Manager (and other store-scoped roles) require at least one assigned dark store.',
      400,
      'STORE_ASSIGNMENT_REQUIRED',
    );
  }
}

function deriveAvatar(name?: string | null): string {
  return (
    (name || 'U')
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U'
  );
}

async function invalidateUsersCache(): Promise<void> {
  await cacheService.delPattern('cache:/api/v1/admin/users*').catch(() => undefined);
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  const randomBytes = crypto.randomBytes(12);
  let plain = '';
  for (let i = 0; i < 12; i++) plain += chars[randomBytes[i] % chars.length];
  return `${plain}A1`;
}

async function applyPasswordReset(
  user: Awaited<ReturnType<typeof repo.findDirectoryUserByIdRaw>>,
  plainPassword: string,
  sendEmail: boolean,
): Promise<void> {
  if (!user) return;
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  user.password = hashedPassword;
  await user.save();

  const dashboardRole = getDashboardRole(user.role);
  if (dashboardRole) {
    try {
      await repo.upsertDashboardLogin(user.email, { password: hashedPassword }, { upsert: false });
    } catch (err) {
      logger.warn('Failed to sync password reset to dashboard login', { email: user.email, error: (err as Error).message });
    }
  }

  if (sendEmail) {
    await sendAdminPasswordResetEmail({ to: user.email, name: user.name, temporaryPassword: plainPassword });
  }
}

export async function getUsers(filter: repo.AdminDirectoryFilter) {
  const users = await repo.findDirectoryUsers(filter);
  return users.map((u) => formatDirectoryUser(u, (u as any).roleId));
}

export async function getUserById(id: string) {
  const user = await repo.findDirectoryUserById(id);
  if (!user) throw AppError.notFound('User', id);
  return formatDirectoryUser(user, (user as any).roleId);
}

export async function getCurrentUserProfile(userId?: string, email?: string) {
  let user: Awaited<ReturnType<typeof repo.findDirectoryUserById>> | null = null;
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    user = (await repo.findDirectoryUserById(userId)) as any;
  }
  if (!user && email) {
    const raw = await repo.findDirectoryUserByEmail(email.toLowerCase());
    user = raw ? (raw.toObject() as any) : null;
  }
  if (!user) throw AppError.notFound('User');

  let role: Record<string, any> | null = null;
  const roleIdValue = (user as any).roleId?.toString?.() || (user as any).roleId;
  if (roleIdValue && mongoose.Types.ObjectId.isValid(roleIdValue)) {
    role = await repo.findRoleById(roleIdValue);
  }
  return formatDirectoryUser(user as Record<string, any>, role);
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  department?: string;
  roleId?: string;
  reportingManagerId?: string;
  location?: string[];
  twoFactorEnabled?: boolean;
  startDate?: string;
  notes?: string;
  assignedStores?: string[];
  primaryStoreId?: string;
  emailVerifiedToken?: string;
}

export async function createUser(input: CreateUserInput, createdByEmail?: string) {
  const email = input.email.toLowerCase();
  const existing = await repo.findDirectoryUserByEmail(email);
  if (existing) throw AppError.conflict('User with this email already exists', 'USER_EXISTS');

  if (input.emailVerifiedToken) {
    const verification = await repo.findVerifiedUnconsumedVerification(email, input.emailVerifiedToken);
    if (!verification) {
      throw AppError.badRequest('Email verification is invalid or expired. Please verify the email again.');
    }
    verification.consumedAt = new Date();
    await verification.save();
  }

  let role: Record<string, any> | null = null;
  if (input.roleId) {
    role = await repo.findRoleByIdRaw(input.roleId);
    if (!role) throw AppError.notFound('Role', input.roleId);
  }

  const assignedStores = (input.assignedStores || []).map((s) => String(s).trim()).filter(Boolean);
  const primaryStoreId = String(input.primaryStoreId || assignedStores[0] || '').trim();
  await requireStoreAssignmentIfNeeded(role, assignedStores, primaryStoreId);

  const hashedPassword = await bcrypt.hash(input.password, 10);
  const created = await repo.createDirectoryUser({
    email,
    password: hashedPassword,
    name: input.name,
    department: input.department || '',
    roleId: input.roleId ? (input.roleId as any) : null,
    role: role?.name || undefined,
    permissions: role?.permissions || [],
    reportingManagerId: input.reportingManagerId ? (input.reportingManagerId as any) : undefined,
    location: input.location || [],
    twoFactorEnabled: Boolean(input.twoFactorEnabled),
    startDate: input.startDate ? new Date(input.startDate) : new Date(),
    notes: input.notes || '',
    assignedStores,
    primaryStoreId,
    status: 'active',
    emailVerified: Boolean(input.emailVerifiedToken),
  });

  const dashboardRole = getDashboardRole(role?.name);
  if (dashboardRole) {
    try {
      await repo.upsertDashboardLogin(
        email,
        {
          password: hashedPassword,
          name: created.name,
          role: dashboardRole,
          assignedStores,
          primaryStoreId,
        },
        { upsert: true },
      );
      logger.info('Synced user to dashboard login', { email, dashboardRole });
    } catch (err) {
      logger.warn('Failed to sync user to dashboard login', { email, error: (err as Error).message });
    }
  }

  await recordAuditLog({ module: 'admin', action: 'user_create', entityType: 'User', entityId: created._id.toString(), details: { email } });
  await invalidateUsersCache();

  const roleName = role?.name || 'N/A';
  void sendAdminUserCreatedEmail({ to: email, name: created.name, roleName, department: created.department });
  void sendAdminCreationConfirmationEmail({
    to: createdByEmail,
    createdUserEmail: email,
    createdUserName: created.name,
    roleName,
    department: created.department,
  });

  const obj = created.toObject() as Record<string, any>;
  return formatDirectoryUser(obj, role);
}

export async function sendCreateUserOtp(email: string, requestedByUserId?: string, requestedByEmail?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await repo.findDirectoryUserByEmail(normalizedEmail);
  if (existing) throw AppError.conflict('User with this email already exists', 'USER_EXISTS');

  const otp = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const otpHash = crypto
    .createHash('sha256')
    .update(`${normalizedEmail}|${otp}|${process.env.OTP_HASH_SECRET || 'selorg-admin-otp'}`)
    .digest('hex');

  const verification = await repo.createEmailVerification({
    email: normalizedEmail,
    otpHash,
    requestedByUserId: requestedByUserId || null,
    expiresAt,
  });

  try {
    await sendAdminUserOtpEmail({ to: normalizedEmail, otp, expiresInMinutes: OTP_EXPIRY_MINUTES, requestedByEmail });
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      await repo.deleteVerification(verification._id.toString()).catch(() => undefined);
      throw new AppError('Unable to send OTP email. Please verify SMTP settings and try again.', 502, 'EMAIL_DELIVERY_FAILED');
    }
    logger.warn('SMTP unavailable in non-production; OTP verification kept for devOtp flow', { email: normalizedEmail, error: (err as Error).message });
  }

  await recordAuditLog({ module: 'admin', action: 'user_create_otp_sent', entityType: 'UserEmailVerification', entityId: verification._id.toString(), details: { email: normalizedEmail } });

  const payload: Record<string, unknown> = { verificationRequestId: verification._id.toString(), expiresAt: expiresAt.toISOString() };
  if (process.env.NODE_ENV !== 'production') payload.devOtp = otp;
  return payload;
}

export async function verifyCreateUserOtp(email: string, otp: string, verificationRequestId: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const verification = await repo.findValidVerification(normalizedEmail, verificationRequestId);
  if (!verification) throw AppError.badRequest('OTP request is invalid or expired. Please resend OTP.', undefined);
  if (verification.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError('Maximum OTP attempts exceeded. Please resend OTP.', 429, 'OTP_ATTEMPTS_EXCEEDED');
  }

  const computedHash = crypto
    .createHash('sha256')
    .update(`${normalizedEmail}|${String(otp).trim()}|${process.env.OTP_HASH_SECRET || 'selorg-admin-otp'}`)
    .digest('hex');
  if (verification.otpHash !== computedHash) {
    verification.attempts += 1;
    await verification.save();
    throw AppError.badRequest('Invalid OTP', undefined);
  }

  verification.verifiedAt = new Date();
  await verification.save();
  await recordAuditLog({ module: 'admin', action: 'user_create_otp_verified', entityType: 'UserEmailVerification', entityId: verification._id.toString(), details: { email: normalizedEmail } });

  return { emailVerifiedToken: verification._id.toString(), email: normalizedEmail };
}

export interface UpdateUserInput {
  name?: string;
  department?: string;
  roleId?: string;
  status?: string;
  reportingManagerId?: string;
  location?: string[];
  notes?: string;
  assignedStores?: string[];
  primaryStoreId?: string;
  twoFactorEnabled?: boolean;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await repo.findDirectoryUserByIdRaw(id);
  if (!user) throw AppError.notFound('User', id);

  let role: Record<string, any> | null = null;
  if (input.roleId && input.roleId !== user.roleId?.toString()) {
    role = await repo.findRoleByIdRaw(input.roleId);
    if (!role) throw AppError.notFound('Role', input.roleId);
  } else if (user.roleId) {
    role = await repo.findRoleByIdRaw(user.roleId.toString());
  }

  if (input.name) user.name = input.name;
  if (input.department !== undefined) user.department = input.department;
  if (input.roleId) {
    user.roleId = input.roleId as any;
    user.role = role?.name;
    user.permissions = role?.permissions || [];
  }
  if (input.status) user.status = input.status as any;
  if (input.reportingManagerId !== undefined) user.reportingManagerId = input.reportingManagerId as any;
  if (input.location !== undefined) user.location = input.location;
  if (input.notes !== undefined) user.notes = input.notes;
  if (input.assignedStores !== undefined) user.assignedStores = input.assignedStores;
  if (input.primaryStoreId !== undefined) {
    user.primaryStoreId = input.primaryStoreId;
  } else if (input.assignedStores !== undefined && input.assignedStores.length && !user.primaryStoreId) {
    user.primaryStoreId = input.assignedStores[0];
  }
  if (input.twoFactorEnabled !== undefined) user.twoFactorEnabled = input.twoFactorEnabled;

  await requireStoreAssignmentIfNeeded(role, user.assignedStores || [], user.primaryStoreId || '');

  await user.save();

  const dashboardRole = getDashboardRole(user.role);
  if (dashboardRole) {
    try {
      await repo.upsertDashboardLogin(
        user.email,
        { name: user.name, role: dashboardRole, assignedStores: user.assignedStores || [], primaryStoreId: user.primaryStoreId || '' },
        { upsert: true },
      );
    } catch (err) {
      logger.warn('Failed to sync user update to dashboard login', { email: user.email, error: (err as Error).message });
    }
  }

  const updatedRole = user.roleId ? await repo.findRoleByIdRaw(user.roleId.toString()) : null;
  await recordAuditLog({ module: 'admin', action: 'user_update', entityType: 'User', entityId: id, details: { email: user.email } });
  await invalidateUsersCache();

  return formatDirectoryUser(user.toObject() as Record<string, any>, updatedRole);
}

export async function deleteUser(id: string) {
  const user = await repo.findDirectoryUserByIdRaw(id);
  if (!user) throw AppError.notFound('User', id);
  await repo.deleteDirectoryUser(id);
  await recordAuditLog({ module: 'admin', action: 'user_delete', entityType: 'User', entityId: id, severity: 'critical', details: { email: user.email } });
  await invalidateUsersCache();
}

export async function assignRole(
  id: string,
  roleId: string,
  opts?: { assignedStores?: string[]; primaryStoreId?: string },
) {
  const user = await repo.findDirectoryUserByIdRaw(id);
  if (!user) throw AppError.notFound('User', id);
  const role = await repo.findRoleByIdRaw(roleId);
  if (!role) throw AppError.notFound('Role', roleId);

  if (opts?.assignedStores !== undefined) {
    user.assignedStores = opts.assignedStores.map((s) => String(s).trim()).filter(Boolean);
  }
  if (opts?.primaryStoreId !== undefined) {
    user.primaryStoreId = opts.primaryStoreId;
  } else if (opts?.assignedStores?.length && !user.primaryStoreId) {
    user.primaryStoreId = opts.assignedStores[0];
  }

  await requireStoreAssignmentIfNeeded(role, user.assignedStores || [], user.primaryStoreId || '');

  user.roleId = roleId as any;
  user.role = role.name;
  user.permissions = role.permissions;
  await user.save();

  const dashboardRole = getDashboardRole(role.name);
  if (dashboardRole) {
    try {
      await repo.upsertDashboardLogin(
        user.email,
        {
          name: user.name,
          role: dashboardRole,
          assignedStores: user.assignedStores || [],
          primaryStoreId: user.primaryStoreId || '',
        },
        { upsert: true },
      );
    } catch (err) {
      logger.warn('Failed to sync role assign to dashboard login', { email: user.email, error: (err as Error).message });
    }
  }

  await recordAuditLog({ module: 'admin', action: 'role_assign', entityType: 'User', entityId: id, details: { roleId: String(roleId), roleName: role.name } });
  await invalidateUsersCache();

  return formatDirectoryUser(user.toObject() as Record<string, any>, role);
}

export async function resetPassword(id: string, sendEmail: boolean) {
  const user = await repo.findDirectoryUserByIdRaw(id);
  if (!user) throw AppError.notFound('User', id);

  const plainPassword = generateTempPassword();
  await applyPasswordReset(user, plainPassword, sendEmail);

  await recordAuditLog({ module: 'admin', action: 'user_password_reset', entityType: 'User', entityId: id, details: { email: user.email, emailSent: sendEmail } });
  await invalidateUsersCache();

  return { newPassword: plainPassword, message: 'Password has been reset', emailSent: sendEmail };
}

export interface BulkUserActionInput {
  action: 'activate' | 'deactivate' | 'assign_role' | 'update' | 'reset_password';
  userIds: string[];
  roleId?: string;
  updates?: { status?: string; department?: string; notes?: string };
  sendEmail?: boolean;
}

export async function bulkUserAction(input: BulkUserActionInput) {
  let role: Record<string, any> | null = null;
  if (input.action === 'assign_role') {
    if (!input.roleId) throw AppError.badRequest('roleId is required for assign_role action');
    role = await repo.findRoleByIdRaw(input.roleId);
    if (!role) throw AppError.notFound('Role', input.roleId);
  }
  if (input.action === 'update' && (!input.updates || typeof input.updates !== 'object')) {
    throw AppError.badRequest('updates object is required for update action');
  }

  const results: { updated: number; failed: number; errors: Array<{ userId: string; error: string }>; passwords: Array<{ userId: string; email: string; newPassword: string }> } = {
    updated: 0,
    failed: 0,
    errors: [],
    passwords: [],
  };

  for (const id of input.userIds) {
    try {
      const user = await repo.findDirectoryUserByIdRaw(id);
      if (!user) {
        results.failed++;
        results.errors.push({ userId: id, error: 'User not found' });
        continue;
      }

      if (input.action === 'activate') {
        user.status = 'active';
      } else if (input.action === 'deactivate') {
        user.status = 'inactive';
      } else if (input.action === 'assign_role' && role) {
        user.roleId = input.roleId as any;
        user.role = role.name;
        user.permissions = role.permissions;
      } else if (input.action === 'update' && input.updates) {
        if (input.updates.status) user.status = input.updates.status as any;
        if (input.updates.department !== undefined) user.department = input.updates.department;
        if (input.updates.notes !== undefined) user.notes = input.updates.notes;
      } else if (input.action === 'reset_password') {
        const plainPassword = generateTempPassword();
        await applyPasswordReset(user, plainPassword, input.sendEmail !== false);
        results.passwords.push({ userId: id, email: user.email, newPassword: plainPassword });
      }

      if (input.action !== 'reset_password') await user.save();
      results.updated++;

      const auditAction = input.action === 'assign_role' ? 'role_assign' : input.action === 'reset_password' ? 'user_password_reset' : 'user_update';
      await recordAuditLog({
        module: 'admin',
        action: auditAction,
        entityType: 'User',
        entityId: id,
        details: { action: input.action, email: user.email, roleId: input.action === 'assign_role' ? input.roleId : undefined, updates: input.action === 'update' ? input.updates : undefined },
      });
    } catch (err) {
      results.failed++;
      results.errors.push({ userId: id, error: (err as Error).message });
    }
  }

  await invalidateUsersCache();
  return results;
}
