import type { AdminAuthUser } from '../types/express';
import { AppError } from './AppError';
import { normalizeRoleKey } from '../config/permissions';

/** Dashboard login roles that are limited to assigned dark store(s). */
const STORE_SCOPED_ROLES = new Set([
  'darkstore',
  'dark_store_manager',
  'store_manager',
]);

/** Roles that see every store / zone. */
const GLOBAL_ROLES = new Set(['admin', 'super_admin', 'superadmin', 'operations_admin', 'operations']);

export function isGlobalAdmin(user?: AdminAuthUser | null): boolean {
  if (!user) return false;
  const role = normalizeRoleKey(user.role || user.roleId);
  if (GLOBAL_ROLES.has(role)) return true;
  if ((user.permissions || []).includes('*')) return true;
  return false;
}

export function isStoreScopedUser(user?: AdminAuthUser | null): boolean {
  if (!user || isGlobalAdmin(user)) return false;
  const role = normalizeRoleKey(user.role || user.roleId);
  if (STORE_SCOPED_ROLES.has(role)) return true;
  // Any non-global user with explicit store assignment is treated as store-scoped.
  return getAssignedStoreKeys(user).length > 0;
}

export function getAssignedStoreKeys(user?: AdminAuthUser | null): string[] {
  if (!user) return [];
  const keys = [...(user.assignedStores || [])];
  if (user.primaryStoreId) keys.unshift(String(user.primaryStoreId));
  return [...new Set(keys.map((k) => String(k || '').trim()).filter(Boolean))];
}

/**
 * Throws when a store-scoped user tries to touch a store outside their assignment.
 * Global admins and unscoped roles pass through.
 */
export function assertStoreAccess(user: AdminAuthUser | undefined, storeKey: string | undefined | null): void {
  assertAnyStoreAccess(user, storeKey);
}

/** Pass when any of the candidate keys (id, code, hub) matches an assigned store. */
export function assertAnyStoreAccess(
  user: AdminAuthUser | undefined,
  ...storeKeys: Array<string | undefined | null>
): void {
  if (!user || !isStoreScopedUser(user)) return;
  const allowed = getAssignedStoreKeys(user);
  if (!allowed.length) {
    throw AppError.forbidden('No dark store is assigned to this account. Ask an admin to set your store scope.', 'STORE_SCOPE_REQUIRED');
  }
  const candidates = storeKeys.map((k) => String(k || '').trim()).filter(Boolean);
  if (!candidates.length) {
    throw AppError.forbidden('Store id is required for this action.', 'STORE_SCOPE_REQUIRED');
  }
  if (!candidates.some((key) => storeKeyMatches(allowed, key))) {
    throw AppError.forbidden('You can only access data for your assigned dark store.', 'STORE_SCOPE_DENIED');
  }
}

export function storeKeyMatches(allowed: string[], candidate: string): boolean {
  const c = String(candidate || '').trim().toLowerCase();
  if (!c) return false;
  return allowed.some((a) => {
    const x = String(a).trim().toLowerCase();
    return x === c;
  });
}

/**
 * Mongo filter fragment for DarkStore documents. Returns null when the caller is not store-scoped
 * (i.e. they may see every store).
 */
export function darkStoreListFilter(user?: AdminAuthUser | null): Record<string, unknown> | null {
  if (!isStoreScopedUser(user || undefined)) return null;
  const keys = getAssignedStoreKeys(user);
  if (!keys.length) {
    // Force empty result set rather than leaking all stores.
    return { _id: null };
  }
  const objectIds = keys.filter((k) => /^[a-f0-9]{24}$/i.test(k));
  const codes = keys.filter((k) => !/^[a-f0-9]{24}$/i.test(k));
  const or: Record<string, unknown>[] = [];
  if (objectIds.length) or.push({ _id: { $in: objectIds } });
  if (codes.length) {
    or.push({ code: { $in: codes } });
    or.push({ code: { $in: codes.map((c) => c.toUpperCase()) } });
  }
  return or.length ? { $or: or } : { _id: null };
}

/**
 * Mongo filter fragment for CustomerOrder (and similar) documents keyed by store / hub.
 */
export function orderStoreScopeFilter(user?: AdminAuthUser | null): Record<string, unknown> | null {
  if (!isStoreScopedUser(user || undefined)) return null;
  const keys = getAssignedStoreKeys(user);
  if (!keys.length) return { _id: null };
  const objectIds = keys.filter((k) => /^[a-f0-9]{24}$/i.test(k));
  const codes = keys.filter((k) => !/^[a-f0-9]{24}$/i.test(k));
  const or: Record<string, unknown>[] = [];
  if (objectIds.length) {
    or.push({ storeId: { $in: objectIds } });
    or.push({ darkStoreId: { $in: objectIds } });
  }
  if (codes.length) {
    const upper = codes.map((c) => c.toUpperCase());
    or.push({ offerHubKey: { $in: [...codes, ...upper] } });
    or.push({ hubKey: { $in: [...codes, ...upper] } });
    or.push({ storeCode: { $in: [...codes, ...upper] } });
  }
  return or.length ? { $or: or } : { _id: null };
}
