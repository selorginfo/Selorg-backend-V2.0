/**
 * Central permission registry — dashboard/admin RBAC.
 * Format: {domain}.{resource}.{action}
 */
export const PERMISSIONS = Object.freeze({
  ADMIN_USERS_READ: 'admin.users.read',
  ADMIN_USERS_WRITE: 'admin.users.write',
  ADMIN_ROLES_READ: 'admin.roles.read',
  ADMIN_ROLES_WRITE: 'admin.roles.write',
  ADMIN_CONFIG_READ: 'admin.config.read',
  ADMIN_CONFIG_WRITE: 'admin.config.write',

  CATALOG_PRODUCTS_READ: 'catalog.products.read',
  CATALOG_PRODUCTS_WRITE: 'catalog.products.write',
  CATALOG_CATEGORIES_READ: 'catalog.categories.read',
  CATALOG_CATEGORIES_WRITE: 'catalog.categories.write',

  INVENTORY_STOCK_READ: 'inventory.stock.read',
  INVENTORY_STOCK_WRITE: 'inventory.stock.write',
  INVENTORY_ADJUSTMENT_CREATE: 'inventory.adjustment.create',
  INVENTORY_ADJUSTMENT_APPROVE: 'inventory.adjustment.approve',

  ORDERS_READ: 'orders.read',
  ORDERS_CANCEL: 'orders.cancel',
  ORDERS_REFUND: 'orders.refund',

  DELIVERY_ASSIGN: 'delivery.assign',
  DELIVERY_TRACK_READ: 'delivery.track.read',

  PAYMENTS_READ: 'payments.read',
  PAYMENTS_REFUND: 'payments.refund',

  PRICING_READ: 'pricing.read',
  PRICING_OVERRIDE: 'pricing.override',

  MERCH_ALLOCATION_READ: 'merch.allocation.read',
  MERCH_ALLOCATION_WRITE: 'merch.allocation.write',

  WAREHOUSE_TRANSFER_READ: 'warehouse.transfer.read',
  WAREHOUSE_TRANSFER_CREATE: 'warehouse.transfer.create',
  WAREHOUSE_TRANSFER_APPROVE: 'warehouse.transfer.approve',

  ANALYTICS_REPORTS_READ: 'analytics.reports.read',

  RIDER_OPS_DISPATCH_ASSIGN: 'rider_ops.dispatch.assign',
  RIDER_OPS_DISPATCH_AUTO_ASSIGN: 'rider_ops.dispatch.auto_assign',
  RIDER_OPS_SHIFT_MANAGE: 'rider_ops.shift.manage',
  RIDER_OPS_HR_APPROVE: 'rider_ops.hr.approve',
  RIDER_OPS_AUDIT_VIEW: 'rider_ops.audit.view',
  RIDER_OPS_ANALYTICS_EXPORT: 'rider_ops.analytics.export',
  RIDER_OPS_CASH_VIEW: 'rider_ops.cash.view',

  COMPLIANCE_AUDIT_READ: 'compliance.audit.read',

  COMPLIANCE_READ: 'compliance.read',
  COMPLIANCE_WRITE: 'compliance.write',

  FRAUD_READ: 'fraud.read',
  FRAUD_WRITE: 'fraud.write',

  NOTIFICATION_CAMPAIGNS_READ: 'notification_campaigns.read',
  NOTIFICATION_CAMPAIGNS_WRITE: 'notification_campaigns.write',
});

/** Default permissions when a JWT has no `permissions` array (legacy tokens). */
const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = Object.freeze({
  super_admin: ['*'],
  superadmin: ['*'],
  admin: ['*'],
  darkstore: [
    'inventory.*',
    'orders.*',
    'catalog.products.read',
    'catalog.categories.read',
    'delivery.track.read',
    'analytics.reports.read',
    'operations.*',
  ],
  dark_store_manager: [
    'inventory.*',
    'orders.*',
    'catalog.products.read',
    'catalog.categories.read',
    'delivery.track.read',
    'analytics.reports.read',
    'operations.*',
  ],
  store_manager: ['inventory.*', 'orders.read', 'orders.cancel', 'analytics.reports.read'],
  warehouse_ops: [
    'warehouse.transfer.read',
    'warehouse.transfer.create',
    'warehouse.transfer.approve',
    'inventory.stock.read',
    'inventory.stock.write',
  ],
  category_manager: ['catalog.*'],
  support_agent: ['orders.read', 'orders.refund', 'payments.read', 'delivery.track.read'],
  finance: ['payments.*', 'orders.read', 'analytics.reports.read'],
  finance_admin: ['payments.*', 'orders.read', 'analytics.reports.read'],
  customer_support: ['orders.read', 'orders.refund', 'payments.read', 'delivery.track.read'],
  support: ['orders.read', 'orders.refund', 'payments.read', 'delivery.track.read'],
  operations_admin: ['orders.*', 'delivery.*', 'inventory.*', 'warehouse.*', 'analytics.reports.read'],
  operations: ['orders.*', 'delivery.*', 'inventory.*', 'warehouse.*', 'analytics.reports.read'],
  catalog_manager: ['catalog.*', 'pricing.read', 'analytics.reports.read'],
  catalog: ['catalog.*', 'pricing.read'],
  rider_manager: ['delivery.*', 'rider_ops.*', 'orders.read', 'analytics.reports.read'],
  warehouse_manager: ['warehouse.*', 'inventory.stock.read', 'inventory.stock.write'],
  merch: ['catalog.*', 'pricing.*', 'merch.allocation.*', 'warehouse.transfer.create', 'analytics.reports.read'],
  warehouse: ['warehouse.*', 'inventory.stock.read', 'inventory.stock.write'],
  picker: ['inventory.stock.read', 'orders.read', 'operations.picking.*'],
  rider: ['delivery.*', 'rider_ops.*', 'orders.read', 'analytics.reports.read'],
  hhd: ['inventory.stock.read', 'orders.read'],
});

export function normalizeRoleKey(role?: string | null): string {
  if (!role) return '';
  return String(role).toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
}

export function getDefaultPermissionsForRole(role?: string | null): string[] {
  const key = normalizeRoleKey(role);
  if (!key) return [];
  return [...(ROLE_DEFAULT_PERMISSIONS[key] || [])];
}

/** True if a single granted permission string satisfies `required`. Supports `*` and `prefix.*` wildcards. */
export function permissionMatches(granted: string, required: string): boolean {
  if (!granted || !required) return false;
  if (granted === '*') return true;
  if (granted === required) return true;
  if (granted.endsWith('.*')) {
    const prefix = granted.slice(0, -1);
    return required.startsWith(prefix);
  }
  return false;
}

/** Legacy seed / JWT permission names mapped to canonical permission keys. */
function legacyAliasMatches(granted: string, required: string): boolean {
  const g = String(granted);
  if (g === 'manage_roles') {
    return required === PERMISSIONS.ADMIN_ROLES_READ || required === PERMISSIONS.ADMIN_ROLES_WRITE;
  }
  if (g === 'view_users' && required === PERMISSIONS.ADMIN_USERS_READ) return true;
  if (['create_users', 'edit_users', 'delete_users'].includes(g) && required === PERMISSIONS.ADMIN_USERS_WRITE) {
    return true;
  }
  if (g === 'assign_roles' && required === PERMISSIONS.ADMIN_ROLES_WRITE) return true;
  if (g === 'view_access_logs' && required === PERMISSIONS.COMPLIANCE_AUDIT_READ) return true;
  return false;
}

export function userHasPermission(userPermissions: string[], required: string): boolean {
  if (!Array.isArray(userPermissions) || userPermissions.length === 0) return false;
  return userPermissions.some((p) => permissionMatches(p, required) || legacyAliasMatches(p, required));
}

export function userHasAllPermissions(userPermissions: string[], requiredList: string[]): boolean {
  return requiredList.every((r) => userHasPermission(userPermissions, r));
}
