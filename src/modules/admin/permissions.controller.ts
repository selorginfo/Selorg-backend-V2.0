import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as permissionsService from './permissions.service';
import type { CreatePermissionInput, UpdatePermissionInput } from './admin.validation';

export async function getPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { module, category, isActive } = req.query as Record<string, string | undefined>;
    const data = await permissionsService.getPermissions({ module, category, isActive: isActive !== undefined ? isActive === 'true' : undefined });
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function getPermissionsMatrix(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await permissionsService.getPermissionsMatrix();
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function getPermissionById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await permissionsService.getPermissionById(req.params.id);
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function createPermission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await permissionsService.createPermission({ ...(req.body as CreatePermissionInput), actorId: req.user?.userId });
    res.status(201).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function updatePermission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await permissionsService.updatePermission(req.params.id, { ...(req.body as UpdatePermissionInput), actorId: req.user?.userId });
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function deletePermission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await permissionsService.deletePermission(req.params.id, req.user?.userId);
    res.json(ResponseFormatter.success(null, 'Permission deleted successfully'));
  } catch (err) {
    next(err);
  }
}
