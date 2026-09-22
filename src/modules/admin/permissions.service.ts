import * as repo from './admin.repository';
import { AppError } from '../../utils/AppError';
import { cacheService } from '../../utils/cache';
import { recordAuditLog } from '../../services/audit.service';

async function invalidatePermissionsCache(): Promise<void> {
  await cacheService.delPattern('cache:/api/v1/admin/permissions*').catch(() => undefined);
}
async function invalidateRolesCache(): Promise<void> {
  await cacheService.delPattern('cache:/api/v1/admin/roles*').catch(() => undefined);
}

function formatPermission(perm: Record<string, any>) {
  const { _id, ...rest } = perm;
  return { ...rest, id: String(_id) };
}

export async function getPermissions(filter: repo.PermissionFilter) {
  const permissions = await repo.findPermissions(filter);
  return permissions.map(formatPermission);
}

export async function getPermissionsMatrix() {
  const permissions = await repo.findActivePermissionsSorted();
  const modulesMap: Record<string, unknown[]> = {};
  for (const permission of permissions) {
    const moduleName = permission.module || 'general';
    if (!modulesMap[moduleName]) modulesMap[moduleName] = [];
    modulesMap[moduleName].push({
      id: String(permission._id),
      name: permission.name,
      displayName: permission.displayName,
      description: permission.description || '',
      action: permission.action || 'view',
      riskLevel: permission.riskLevel || 'low',
      dependsOn: permission.dependsOn || [],
    });
  }
  return { modules: Object.entries(modulesMap).map(([module, entries]) => ({ module, permissions: entries })) };
}

export async function getPermissionById(id: string) {
  const permission = await repo.findPermissionById(id);
  if (!permission) throw AppError.notFound('Permission', id);
  return formatPermission(permission);
}

export interface CreatePermissionInput {
  name: string;
  displayName: string;
  module: string;
  description?: string;
  category?: string;
  action?: string;
  riskLevel?: string;
  dependsOn?: string[];
  actorId?: string;
}

export async function createPermission(input: CreatePermissionInput) {
  const name = input.name.toLowerCase();
  const existing = await repo.findPermissionByName(name);
  if (existing) throw AppError.conflict('Permission with this name already exists', 'PERMISSION_EXISTS');

  const permission = await repo.createPermission({
    name,
    displayName: input.displayName,
    module: input.module,
    description: input.description || '',
    category: (input.category as any) || 'read',
    action: input.action || 'view',
    riskLevel: (input.riskLevel as any) || 'low',
    dependsOn: input.dependsOn || [],
  });

  await invalidatePermissionsCache();
  await recordAuditLog({
    module: 'admin',
    action: 'permission_created',
    entityType: 'permission',
    entityId: permission._id.toString(),
    userId: input.actorId,
    details: { name: permission.name, module: permission.module },
  });

  return formatPermission(permission.toObject() as Record<string, any>);
}

export interface UpdatePermissionInput {
  displayName?: string;
  module?: string;
  description?: string;
  category?: string;
  action?: string;
  riskLevel?: string;
  dependsOn?: string[];
  isActive?: boolean;
  actorId?: string;
}

export async function updatePermission(id: string, input: UpdatePermissionInput) {
  const permission = await repo.findPermissionByIdRaw(id);
  if (!permission) throw AppError.notFound('Permission', id);

  if (input.displayName) permission.displayName = input.displayName;
  if (input.module) permission.module = input.module;
  if (input.description !== undefined) permission.description = input.description;
  if (input.category) permission.category = input.category as any;
  if (input.action) permission.action = input.action;
  if (input.riskLevel) permission.riskLevel = input.riskLevel as any;
  if (input.dependsOn) permission.dependsOn = input.dependsOn;
  if (input.isActive !== undefined) permission.isActive = input.isActive;

  await permission.save();
  await invalidatePermissionsCache();
  await recordAuditLog({
    module: 'admin',
    action: 'permission_updated',
    entityType: 'permission',
    entityId: permission._id.toString(),
    userId: input.actorId,
    details: { name: permission.name, module: permission.module },
  });

  return formatPermission(permission.toObject() as Record<string, any>);
}

export async function deletePermission(id: string, actorId?: string) {
  const permission = await repo.findPermissionByIdRaw(id);
  if (!permission) throw AppError.notFound('Permission', id);

  const rolesUsing = await repo.findRolesUsingPermission(permission.name);
  if (rolesUsing.length > 0) {
    throw AppError.conflict(
      `Cannot delete: assigned to ${rolesUsing.length} role(s): ${rolesUsing.map((r) => r.name).join(', ')}`,
      'PERMISSION_IN_USE',
    );
  }

  await repo.deletePermission(id);
  await invalidatePermissionsCache();
  await invalidateRolesCache();
  await recordAuditLog({
    module: 'admin',
    action: 'permission_deleted',
    entityType: 'permission',
    entityId: id,
    userId: actorId,
    details: { name: permission.name, module: permission.module },
  });
}
