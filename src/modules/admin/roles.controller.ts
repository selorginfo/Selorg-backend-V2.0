import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as rolesService from './roles.service';
import type {
  CreateRoleInput,
  UpdateRoleInput,
  CreateRoleFromTemplateInput,
  UpdateRoleMatrixInput,
  ImportRoleConfigInput,
} from './admin.validation';

export async function getRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roleType, accessScope, isActive } = req.query as Record<string, string | undefined>;
    const data = await rolesService.getRoles({ roleType, accessScope, isActive: isActive !== undefined ? isActive === 'true' : undefined });
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function getRoleById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await rolesService.getRoleById(req.params.id);
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function createRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await rolesService.createRole({ ...(req.body as CreateRoleInput), createdBy: req.user?.userId });
    res.status(201).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await rolesService.updateRole(req.params.id, req.body as UpdateRoleInput);
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function deleteRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await rolesService.deleteRole(req.params.id);
    res.json(ResponseFormatter.success(null, 'Role deleted successfully'));
  } catch (err) {
    next(err);
  }
}

export async function getRoleTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await rolesService.getRoleTemplates();
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function createRoleFromTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await rolesService.createRoleFromTemplate({ ...(req.body as CreateRoleFromTemplateInput), createdBy: req.user?.userId });
    res.status(201).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function updateRoleMatrix(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await rolesService.updateRoleMatrix(req.params.id, { ...(req.body as UpdateRoleMatrixInput), actorId: req.user?.userId });
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function exportRoleConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await rolesService.exportRoleConfig(req.params.id, req.user?.userId);
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function importRoleConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await rolesService.importRoleConfig({ ...(req.body as ImportRoleConfigInput), actorId: req.user?.userId });
    res.status(201).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}
