import type { Request } from 'express';
import { AppError } from '../../utils/AppError';
import { APPROVE_ACTIONS, CATALOG_WRITE, DELIVERY_ROUTES, FINANCE_WRITE, STALL_ROUTES, canDelete } from './ops-catalog';

export type OpsAct = 'view' | 'mutate' | 'delete' | 'approve';

function roleKey(req: Request): string {
  const raw = String(req.user?.role || req.user?.roleId || '').trim().toLowerCase();
  return raw.replace(/[_-]+/g, ' ');
}

/**
 * Mirrors the dashboard matrix. JWT role `admin` is the operations admin that already
 * passed the admin router gate, so it keeps full access. Named roles are narrowed.
 */
export function assertOpsAccess(req: Request, route: string, act: OpsAct, actionLabel?: string): void {
  const role = roleKey(req);
  if (!role) {
    throw AppError.forbidden('A role is required for this action');
  }
  const full = role === 'super admin' || role === 'superadmin' || role === 'operations admin' || role === 'admin';
  if (act === 'delete' && role !== 'super admin' && role !== 'superadmin' && role !== 'operations admin' && role !== 'admin') {
    throw AppError.forbidden('Delete is limited to Super Admin and Operations Admin');
  }
  if (full) return;

  if (DELIVERY_ROUTES.has(route)) {
    if (role === 'rider manager' && act !== 'delete') return;
    throw AppError.forbidden('This role cannot use Delivery');
  }

  if (STALL_ROUTES.has(route)) {
    if (act === 'delete') throw AppError.forbidden('Delete is limited to Super Admin and Operations Admin');
    if (role === 'finance admin') {
      if (act === 'view') return;
      if (actionLabel && APPROVE_ACTIONS.test(actionLabel) && !FINANCE_WRITE.has(route)) {
        throw AppError.forbidden('Finance Admin cannot approve this record');
      }
      if (FINANCE_WRITE.has(route)) return;
      throw AppError.forbidden('Finance Admin can edit stall employees, incentive rules and earnings only');
    }
    if (role === 'catalog manager' || role === 'marketing manager') {
      if (act === 'view') return;
      if (CATALOG_WRITE.has(route)) return;
      throw AppError.forbidden('Catalog Manager can edit areas, stalls, advertisements and samples only');
    }
    throw AppError.forbidden('This role cannot use Container Stalls');
  }

  throw AppError.forbidden('Unknown ops route');
}

export function assertCanDelete(req: Request, route: string): void {
  if (!canDelete(route)) throw AppError.forbidden('This record cannot be deleted');
  assertOpsAccess(req, route, 'delete');
}

export function actor(req: Request): string {
  return req.user?.name || req.user?.email || 'Admin';
}
