import * as repo from './admin.repository';
import { AppError } from '../../utils/AppError';
import { cacheService } from '../../utils/cache';
import { recordAuditLog } from '../../services/audit.service';

const ROLE_IMPORT_SCHEMA_VERSION = '1.0.0';

function normalizePermissionNames(values: string[] = []): string[] {
  return Array.from(new Set(values.filter(Boolean).map((v) => String(v).trim().toLowerCase()).filter(Boolean)));
}

async function invalidateRolesCache(): Promise<void> {
  await cacheService.delPattern('cache:/api/v1/admin/roles*').catch(() => undefined);
}

function formatRole(role: Record<string, any>, userCount: number) {
  const { _id, ...rest } = role;
  return { ...rest, id: String(_id), userCount };
}

export async function getRoles(filter: repo.RoleFilter) {
  const roles = await repo.findRoles(filter);
  return Promise.all(roles.map(async (r) => formatRole(r, await repo.countActiveUsersForRole(String(r._id)))));
}

export async function getRoleById(id: string) {
  const role = await repo.findRoleById(id);
  if (!role) throw AppError.notFound('Role', id);
  const userCount = await repo.countActiveUsersForRole(id);
  return formatRole(role, userCount);
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  roleType?: string;
  permissions: string[];
  accessScope?: string;
  createdBy?: string;
}

export async function createRole(input: CreateRoleInput) {
  if (!input.permissions?.length) throw AppError.badRequest('Name and at least one permission are required');
  const existing = await repo.findRoleByName(input.name);
  if (existing) throw AppError.conflict('Role with this name already exists', 'ROLE_EXISTS');

  const role = await repo.createRole({
    name: input.name,
    description: input.description || '',
    roleType: (input.roleType as any) || 'custom',
    permissions: input.permissions,
    accessScope: (input.accessScope as any) || 'global',
    createdBy: input.createdBy as any,
  });

  await invalidateRolesCache();
  const obj = role.toObject() as Record<string, any>;
  return formatRole(obj, 0);
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  roleType?: string;
  permissions?: string[];
  accessScope?: string;
  isActive?: boolean;
}

export async function updateRole(id: string, input: UpdateRoleInput) {
  const role = await repo.findRoleByIdRaw(id);
  if (!role) throw AppError.notFound('Role', id);

  if (role.roleType === 'system' && (input.roleType || input.name)) {
    throw AppError.forbidden('System roles cannot be modified', 'SYSTEM_ROLE_PROTECTED');
  }
  if (input.name && input.name !== role.name) {
    const existing = await repo.findRoleByName(input.name);
    if (existing) throw AppError.conflict('Role with this name already exists', 'ROLE_EXISTS');
  }

  if (input.name) role.name = input.name;
  if (input.description !== undefined) role.description = input.description;
  if (input.roleType && role.roleType !== 'system') role.roleType = input.roleType as any;
  if (input.permissions) role.permissions = input.permissions;
  if (input.accessScope) role.accessScope = input.accessScope as any;
  if (input.isActive !== undefined) role.isActive = input.isActive;

  await role.save();
  const userCount = await repo.countActiveUsersForRole(id);
  await invalidateRolesCache();

  return formatRole(role.toObject() as Record<string, any>, userCount);
}

export async function deleteRole(id: string) {
  const role = await repo.findRoleByIdRaw(id);
  if (!role) throw AppError.notFound('Role', id);
  if (role.roleType === 'system') throw AppError.forbidden('System roles cannot be deleted', 'SYSTEM_ROLE_PROTECTED');

  const userCount = await repo.countAllUsersForRole(id);
  if (userCount > 0) {
    throw AppError.conflict(`Cannot delete role. ${userCount} user(s) are assigned to this role`, 'ROLE_IN_USE');
  }

  await repo.deleteRole(id);
  await invalidateRolesCache();
}

export function getRoleTemplates() {
  return repo.findRoleTemplates().then((templates) => templates.map((t) => ({ ...t, id: String(t._id) })));
}

export interface CreateRoleFromTemplateInput {
  name: string;
  templateId?: string;
  templateKey?: string;
  description?: string;
  accessScope?: string;
  createdBy?: string;
}

export async function createRoleFromTemplate(input: CreateRoleFromTemplateInput) {
  if (!input.templateId && !input.templateKey) throw AppError.badRequest('Name and templateId/templateKey are required');

  const existing = await repo.findRoleByName(input.name.trim());
  if (existing) throw AppError.conflict('Role with this name already exists', 'ROLE_EXISTS');

  const templateRole = await repo.findRoleTemplateBy(
    input.templateId ? { _id: input.templateId } : { templateKey: String(input.templateKey).trim().toLowerCase() },
  );
  if (!templateRole) throw AppError.notFound('Role template');

  const role = await repo.createRole({
    name: input.name.trim(),
    description: input.description ?? templateRole.description ?? '',
    roleType: 'custom',
    permissions: templateRole.permissions || [],
    accessScope: (input.accessScope || templateRole.accessScope || 'global') as any,
    riskLevel: (templateRole.riskLevel || 'medium') as any,
    createdBy: input.createdBy as any,
  });

  await recordAuditLog({
    module: 'admin',
    action: 'role_created_from_template',
    entityType: 'role',
    entityId: role._id.toString(),
    userId: input.createdBy,
    details: { roleName: role.name, templateRoleId: String(templateRole._id), templateKey: templateRole.templateKey || null },
  });
  await invalidateRolesCache();

  return formatRole(role.toObject() as Record<string, any>, 0);
}

export interface UpdateRoleMatrixInput {
  permissions: string[];
  accessScope?: string;
  riskLevel?: string;
  actorId?: string;
}

export async function updateRoleMatrix(id: string, input: UpdateRoleMatrixInput) {
  const role = await repo.findRoleByIdRaw(id);
  if (!role) throw AppError.notFound('Role', id);

  const normalizedPermissions = normalizePermissionNames(input.permissions);
  if (!normalizedPermissions.length) throw AppError.badRequest('At least one permission is required');

  const knownPermissions = await repo.findPermissionsByNames(normalizedPermissions);
  const knownSet = new Set(knownPermissions.map((p) => p.name));
  const unknown = normalizedPermissions.filter((p) => !knownSet.has(p));
  if (unknown.length) throw AppError.badRequest(`Unknown permission(s): ${unknown.join(', ')}`, undefined);

  role.permissions = normalizedPermissions;
  if (input.accessScope) role.accessScope = input.accessScope as any;
  if (input.riskLevel) role.riskLevel = input.riskLevel as any;
  await role.save();

  await recordAuditLog({
    module: 'admin',
    action: 'role_matrix_updated',
    entityType: 'role',
    entityId: role._id.toString(),
    userId: input.actorId,
    details: { roleName: role.name, permissionsCount: normalizedPermissions.length, accessScope: role.accessScope, riskLevel: role.riskLevel },
  });
  await invalidateRolesCache();

  const userCount = await repo.countActiveUsersForRole(id);
  return formatRole(role.toObject() as Record<string, any>, userCount);
}

export async function exportRoleConfig(id: string, actorId?: string) {
  const role = await repo.findRoleById(id);
  if (!role) throw AppError.notFound('Role', id);

  const payload = {
    schemaVersion: ROLE_IMPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    role: {
      name: role.name,
      description: role.description || '',
      accessScope: role.accessScope || 'global',
      riskLevel: role.riskLevel || 'medium',
      permissions: role.permissions || [],
    },
  };

  await recordAuditLog({
    module: 'admin',
    action: 'role_config_exported',
    entityType: 'role',
    entityId: String(role._id),
    userId: actorId,
    details: { roleName: role.name, schemaVersion: ROLE_IMPORT_SCHEMA_VERSION },
  });

  return payload;
}

export interface ImportRoleConfigInput {
  role: { name: string; description?: string; accessScope?: string; riskLevel?: string; permissions?: string[] };
  overwrite?: boolean;
  actorId?: string;
}

export async function importRoleConfig(input: ImportRoleConfigInput) {
  const roleName = String(input.role?.name || '').trim();
  const normalizedPermissions = normalizePermissionNames(input.role?.permissions || []);
  if (!roleName || !normalizedPermissions.length) {
    throw AppError.badRequest('role.name and at least one permission are required');
  }

  const knownPermissions = await repo.findPermissionsByNames(normalizedPermissions);
  const knownSet = new Set(knownPermissions.map((p) => p.name));
  const unknown = normalizedPermissions.filter((p) => !knownSet.has(p));
  if (unknown.length) throw AppError.badRequest(`Unknown permission(s): ${unknown.join(', ')}`, undefined);

  let role = await repo.findRoleByName(roleName);
  if (role && !input.overwrite) {
    throw AppError.conflict('Role exists already. Set overwrite=true to replace it.', 'ROLE_EXISTS');
  }

  if (!role) {
    role = await repo.createRole({
      name: roleName,
      description: String(input.role.description || ''),
      roleType: 'custom',
      permissions: normalizedPermissions,
      accessScope: (input.role.accessScope || 'global') as any,
      riskLevel: (input.role.riskLevel || 'medium') as any,
      createdBy: input.actorId as any,
    });
  } else {
    role.description = String(input.role.description || role.description || '');
    role.permissions = normalizedPermissions;
    if (input.role.accessScope) role.accessScope = input.role.accessScope as any;
    if (input.role.riskLevel) role.riskLevel = input.role.riskLevel as any;
    await role.save();
  }

  await recordAuditLog({
    module: 'admin',
    action: 'role_config_imported',
    entityType: 'role',
    entityId: role._id.toString(),
    userId: input.actorId,
    details: { roleName: role.name, overwrite: Boolean(input.overwrite), permissionsCount: normalizedPermissions.length },
  });
  await invalidateRolesCache();

  const userCount = await repo.countActiveUsersForRole(role._id.toString());
  return formatRole(role.toObject() as Record<string, any>, userCount);
}
