import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getAdminJwtSecret, getCustomerJwtSecret, tokenBlocklist } from '../utils/auth';
import { getDefaultPermissionsForRole, userHasAllPermissions } from '../config/permissions';
import { logger } from '../utils/logger';
import { ResponseFormatter } from '../utils/response';
import { CustomerUser } from '../modules/auth/auth.model';
import type { AdminAuthUser } from '../types/express';

/** Throws on startup if JWT_SECRET is missing or too weak. Call once during bootstrap. */
export function validateJWTSecret(): void {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required. Generate one: openssl rand -base64 32');
  }
  if (secret.length < 32) {
    throw new Error(
      `JWT_SECRET must be at least 32 characters long. Current length: ${secret.length}. Generate one: openssl rand -base64 32`,
    );
  }
}

/**
 * Audiences that belong to a different auth domain. Rider tokens are signed with
 * `aud: 'picker'`; when `PICKER_JWT_SECRET` is not configured separately they share
 * the admin secret and would otherwise verify here, granting a rider the default
 * permissions of an admin role. The claim check keeps the domains disjoint
 * regardless of secret configuration.
 */
const FOREIGN_TOKEN_AUDIENCES = new Set(['picker']);

function hasForeignAudience(payload: jwt.JwtPayload): boolean {
  if (!payload?.aud) return false;
  return ([] as string[]).concat(payload.aud as string | string[]).some((aud) => FOREIGN_TOKEN_AUDIENCES.has(aud));
}

function sendAuthError(res: Response, req: Request, status: number, code: string, message: string) {
  res.status(status).json({
    success: false,
    error: { code, message },
    meta: { requestId: req.id, timestamp: new Date().toISOString() },
  });
}

/**
 * Dashboard/admin JWT auth. Verifies the Bearer token, checks the revocation
 * list, and attaches `req.user` (roles + RBAC permissions).
 */
export function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  try {
    const cookieToken = (req.cookies as Record<string, string | undefined>)?.selorg_admin_token;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
    const token = cookieToken || bearerToken;

    if (!token) {
      sendAuthError(res, req, 401, 'AUTH_TOKEN_REQUIRED', 'Access token required. Please log in.');
      return;
    }
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, getAdminJwtSecret()) as jwt.JwtPayload;
    } catch (jwtError) {
      logger.warn('JWT verification failed', { error: (jwtError as Error).message, requestId: req.id, path: req.path });
      const message =
        (jwtError as Error).name === 'TokenExpiredError'
          ? 'Token has expired. Please refresh your token.'
          : 'Invalid or malformed token. Please provide a valid token.';
      sendAuthError(res, req, 403, 'AUTH_TOKEN_INVALID', message);
      return;
    }

    if (hasForeignAudience(decoded)) {
      logger.warn('Rejected foreign-audience token at admin auth', { aud: decoded.aud, requestId: req.id, path: req.path });
      sendAuthError(res, req, 403, 'AUTH_TOKEN_INVALID', 'This token is not valid for the dashboard API.');
      return;
    }

    if (tokenBlocklist.has(token)) {
      sendAuthError(res, req, 403, 'AUTH_TOKEN_REVOKED', 'Token has been revoked. Please log in again.');
      return;
    }

    // Shared JWT_SECRET: reject workforce/picker tokens on admin routes.
    const typ = String(decoded.typ || decoded.tokenType || '').toLowerCase();
    const claimRole = String(decoded.role || decoded.roleId || '').toLowerCase();
    if (typ === 'picker' || claimRole === 'picker' || claimRole === 'workforce_picker' || (decoded.sid && !decoded.email)) {
      sendAuthError(res, req, 403, 'AUTH_WRONG_AUDIENCE', 'Picker tokens cannot access admin APIs.');
      return;
    }

    const assignedStores: string[] = Array.isArray(decoded.assignedStores) ? decoded.assignedStores : [];
    const primaryStoreId = decoded.primaryStoreId || '';
    const defaultWarehouseKey =
      String(process.env.DASHBOARD_WAREHOUSE_KEY || '').trim() ||
      String(process.env.DASHBOARD_HUB_KEY || '').trim() ||
      'chennai-hub';
    const warehouseKey =
      String(decoded.warehouseKey || '').trim() ||
      String(decoded.hubKey || '').trim() ||
      String(primaryStoreId || '').trim() ||
      String(assignedStores[0] || '').trim() ||
      defaultWarehouseKey;
    const hubKey =
      String(decoded.hubKey || '').trim() ||
      String(primaryStoreId || '').trim() ||
      String(assignedStores[0] || '').trim() ||
      '';

    let permissions: string[] = Array.isArray(decoded.permissions) ? [...decoded.permissions] : [];
    if (permissions.length === 0) {
      permissions = getDefaultPermissionsForRole(decoded.role || decoded.roleId);
    }

    const user: AdminAuthUser = {
      userId: decoded.userId || decoded.id || '',
      email: decoded.email,
      roleId: decoded.roleId || decoded.role,
      role: decoded.role,
      name: decoded.name || '',
      permissions,
      assignedStores,
      primaryStoreId,
      warehouseKey,
      hubKey,
    };
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error', { error: (error as Error).message, requestId: req.id, path: req.path });
    sendAuthError(res, req, 500, 'AUTH_ERROR', 'Authentication service error');
  }
}

/** Must run after authenticateAdmin. `requireRole('admin', 'super_admin')`. */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendAuthError(res, req, 401, 'AUTH_REQUIRED', 'Authentication required');
      return;
    }
    const userRole = req.user.role || req.user.roleId;
    const hasAccess = allowedRoles.includes(userRole || '') || allowedRoles.includes('*') || req.user.role === 'super_admin';
    if (!hasAccess) {
      logger.warn('Access denied', { userId: req.user.userId, userRole, requiredRoles: allowedRoles, path: req.path });
      sendAuthError(res, req, 403, 'ACCESS_DENIED', `Access denied. Required role: ${allowedRoles.join(' or ')}`);
      return;
    }
    next();
  };
}

/** Must run after authenticateAdmin. `requirePermission('orders.refund')`. */
export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendAuthError(res, req, 401, 'AUTH_REQUIRED', 'Authentication required');
      return;
    }
    const hasPermission = userHasAllPermissions(req.user.permissions || [], requiredPermissions);
    if (!hasPermission) {
      logger.warn('Permission denied', { userId: req.user.userId, requiredPermissions, path: req.path });
      sendAuthError(res, req, 403, 'PERMISSION_DENIED', `Permission denied. Required: ${requiredPermissions.join(', ')}`);
      return;
    }
    next();
  };
}

// --- Customer (storefront) auth --------------------------------------------

async function resolveCustomerFromToken(token: string): Promise<{ _id: string; profile?: Record<string, unknown> } | null | 'blocked' | 'wrong_audience'> {
  const payload = jwt.verify(token, getCustomerJwtSecret()) as jwt.JwtPayload;
  const typ = String(payload.typ || payload.tokenType || '').toLowerCase();
  const role = String(payload.role || payload.roleId || '').toLowerCase();
  if (typ === 'picker' || role === 'picker' || role === 'workforce_picker') {
    return 'wrong_audience';
  }
  if (!payload?.sub || !mongoose.Types.ObjectId.isValid(String(payload.sub))) return null;

  const result: { _id: string; profile?: Record<string, unknown> } = { _id: String(payload.sub) };
  const profile = await CustomerUser.findById(payload.sub).lean();
  if (profile) {
    if (profile.status === 'blocked') return 'blocked';
    result.profile = profile as unknown as Record<string, unknown>;
  }
  return result;
}

/** Required customer auth: verifies the Bearer JWT and attaches `req.customer`. */
export async function authenticateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  const deny = (status: number, message: string, appCode: string) => {
    res.status(status).json(ResponseFormatter.error(message, status, null, { appCode }));
  };
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      deny(401, 'Authentication required. Please sign in.', 'AUTH_TOKEN_REQUIRED');
      return;
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      deny(401, 'Invalid authorization format. Expected a Bearer token.', 'AUTH_TOKEN_INVALID');
      return;
    }
    const token = parts[1];

    let resolved;
    try {
      resolved = await resolveCustomerFromToken(token);
    } catch (jwtErr) {
      const expired = (jwtErr as Error)?.name === 'TokenExpiredError';
      deny(
        401,
        expired ? 'Your session has expired. Please sign in again.' : 'Invalid authentication token.',
        expired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID',
      );
      return;
    }
    if (tokenBlocklist.has(token)) {
      deny(401, 'This session has been revoked. Please sign in again.', 'AUTH_TOKEN_REVOKED');
      return;
    }
    if (resolved === 'blocked') {
      deny(403, 'Your account has been blocked. Please contact support.', 'ACCOUNT_BLOCKED');
      return;
    }
    if (resolved === 'wrong_audience') {
      deny(401, 'Token is not valid for the customer API.', 'AUTH_WRONG_AUDIENCE');
      return;
    }
    if (!resolved) {
      deny(401, 'Invalid authentication token.', 'AUTH_TOKEN_INVALID');
      return;
    }
    req.customer = resolved;
    next();
  } catch (err) {
    logger.error('Customer auth middleware error', { error: (err as Error).message });
    res.status(500).json(ResponseFormatter.error('Internal server error', 500));
  }
}

/** Attaches `req.customer` when a valid customer JWT is present; never blocks the request. */
export async function optionalCustomerAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  req.customer = undefined;
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next();
    const parts = String(authHeader).split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) return next();
    const token = parts[1];

    let resolved;
    try {
      resolved = await resolveCustomerFromToken(token);
    } catch {
      return next();
    }
    if (tokenBlocklist.has(token) || resolved === 'blocked' || resolved === 'wrong_audience' || !resolved) return next();
    req.customer = resolved;
    next();
  } catch (err) {
    logger.warn('optionalCustomerAuth error', { error: (err as Error).message });
    req.customer = undefined;
    next();
  }
}
