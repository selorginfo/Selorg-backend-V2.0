import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as platformConfigService from '../../services/platformConfig.service';

function actor(req: Request): string {
  return String(req.user?.userId || req.user?.email || '');
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const prefix = req.query.prefix ? String(req.query.prefix) : undefined;
    const items = await platformConfigService.listConfigs({ prefix });
    res.json(ResponseFormatter.success(items, 'Platform configs loaded'));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { key } = req.params;
    const doc = await platformConfigService.getConfigDoc(key);
    if (!doc) {
      res.status(404).json(ResponseFormatter.notFound('PlatformConfig', key));
      return;
    }
    res.json(ResponseFormatter.success(doc, 'OK'));
  } catch (err) {
    next(err);
  }
}

export async function upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { key } = req.params;
    const { value, valueType, description } = req.body || {};
    const doc = await platformConfigService.upsertConfig(key, { value, valueType, description }, actor(req));
    res.json(ResponseFormatter.success(doc, 'Config saved'));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    if (e.statusCode === 400) {
      res.status(400).json(ResponseFormatter.validationError([{ field: 'key', message: e.message }]));
      return;
    }
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { key } = req.params;
    await platformConfigService.deleteConfig(key);
    res.json(ResponseFormatter.success({ key }, 'Config deleted'));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    if (e.statusCode === 400) {
      res.status(400).json(ResponseFormatter.validationError([{ field: 'key', message: e.message }]));
      return;
    }
    next(err);
  }
}
