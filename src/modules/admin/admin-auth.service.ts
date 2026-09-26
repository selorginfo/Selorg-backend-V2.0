import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getAdminJwtSecret, revokeToken } from '../../utils/auth';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/AppError';
import * as repo from './admin.repository';
import * as lockout from './admin-login-lockout';
import { recordAuditLog } from '../../services/audit.service';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

export interface AdminLoginResult {
  token: string;
  user: Record<string, unknown>;
}

/**
 * Ported from legacy `admin/services/authService.js#authenticateUser`. Login checks the
 * shared `DashboardLoginUser` ("users") collection, NOT the admin employee directory —
 * that's the legacy behavior (confirmed: `authService.js` requires `vendor/models/User`).
 */
export async function login(email: string, password: string, requestedRole = 'admin'): Promise<AdminLoginResult | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await repo.findDashboardLoginByEmail(normalizedEmail);
  if (!user) return null;

  const userRoleLower = user.role ? user.role.toLowerCase().trim() : '';
  // SPA sends "Operations Admin" OR underscore form "operations_admin" (authService.real.ts).
  const requestedRoleLower = (requestedRole || '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (requestedRole) {
    // Treat backend admin roles and Admin SPA console role labels as equivalent for login.
    // The SPA sends display labels like "Operations Admin" / "Super Admin"; the users
    // collection typically stores `admin` / `super_admin` / `darkstore`.
    const adminAliases = new Set(['admin', 'super_admin', 'superadmin', 'super admin']);
    const consoleRoleAliases = new Set([
      ...adminAliases,
      'operations admin',
      'rider manager',
      'warehouse manager',
      'dark store manager',
      'customer support',
      'finance admin',
      'catalog manager',
    ]);
    const userNormalized = userRoleLower.replace(/[_-]+/g, ' ');
    const userIsAdmin = adminAliases.has(userNormalized);
    const requestedIsConsoleRole = consoleRoleAliases.has(requestedRoleLower);

    // Map short dashboard-login keys onto the SPA console labels.
    const dashboardToConsole: Record<string, string> = {
      admin: 'super admin',
      super_admin: 'super admin',
      darkstore: 'dark store manager',
      warehouse: 'warehouse manager',
      rider: 'rider manager',
      finance: 'finance admin',
      merch: 'catalog manager',
      support: 'customer support',
    };
    const userAsConsole = dashboardToConsole[userRoleLower.replace(/\s+/g, '_')] || userNormalized;

    const roleMatches =
      userNormalized === requestedRoleLower ||
      userAsConsole === requestedRoleLower ||
      (userIsAdmin && requestedIsConsoleRole);
    if (!roleMatches) return null;
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;

  if (!user.role || !String(user.role).trim()) {
    throw AppError.forbidden('This account has no role assigned. Contact an administrator.');
  }

  let permissions: string[] = [];
  const directoryUser = await repo.findDirectoryUserByEmail(normalizedEmail);
  if (directoryUser?.roleId) {
    const roleDoc = await repo.findRoleByIdRaw(String(directoryUser.roleId));
    if (roleDoc?.permissions?.length) permissions = roleDoc.permissions;
  }
  if (!permissions.length && directoryUser?.permissions?.length) permissions = directoryUser.permissions;

  const adminRoles = ['admin', 'super_admin', 'Admin', 'Super Admin', 'superadmin'];
  if (adminRoles.includes(user.role)) permissions = ['*'];
  if (permissions.length === 0 && (user.role === 'admin' || user.role === 'Admin')) permissions = ['*'];

  const assignedStores = user.assignedStores || [];
  const primaryStoreId = user.primaryStoreId || assignedStores[0] || '';
  const roleNormalized = user.role ? user.role.toLowerCase().trim() : '';

  const token = jwt.sign(
    {
      id: user._id.toString(),
      userId: user._id.toString(),
      email: user.email,
      role: roleNormalized,
      name: user.name || '',
      roleId: directoryUser?.roleId ? String(directoryUser.roleId) : null,
      permissions,
      assignedStores,
      primaryStoreId,
    },
    getAdminJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );

  const userObj = user.toObject() as Record<string, unknown>;
  delete userObj.password;
  return { token, user: userObj };
}

export function checkLockout(email: string) {
  return lockout.isLocked(email);
}

export function recordFailedLogin(email: string) {
  lockout.recordFailure(email);
}

export function clearLoginAttempts(email: string) {
  lockout.clearAttempts(email);
}

export async function logAuthEvent(params: {
  action: 'login_success' | 'login_failure' | 'logout';
  userId?: string | null;
  details: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  await recordAuditLog({
    module: 'auth',
    action: params.action,
    severity: params.action === 'login_failure' ? 'warning' : 'info',
    userId: params.userId || undefined,
    details: params.details,
    ipAddress: params.ip,
    userAgent: params.userAgent,
  });
}

/** Revoke a raw JWT (adds it to the blocklist until its own expiry). */
export function logout(token?: string): void {
  if (!token) throw AppError.badRequest('Authorization Bearer token required for logout.');
  revokeToken(token);
  logger.info('Admin logout', { hasToken: true });
}
