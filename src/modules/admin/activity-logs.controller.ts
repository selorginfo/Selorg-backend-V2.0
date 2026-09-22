import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as activityLogsService from './activity-logs.service';

function requesterIp(req: Request): string | undefined {
  return req.ip || req.socket?.remoteAddress || String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
}

export async function getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, limit } = req.query as Record<string, string | undefined>;
    res.json(ResponseFormatter.success(await activityLogsService.getSessions(userId, limit ? parseInt(limit, 10) : 50)));
  } catch (err) {
    next(err);
  }
}

export async function revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await activityLogsService.revokeSession(
      req.params.id,
      req.user?.userId,
      req.user?.email || req.user?.name,
      (req.body as { reason?: string } | undefined)?.reason,
      requesterIp(req),
      req.get('user-agent'),
    );
    res.json(ResponseFormatter.success(result, 'Session revoked successfully'));
  } catch (err) {
    next(err);
  }
}

export async function getAccessLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, action, status, startDate, endDate, page, limit } = req.query as Record<string, string | undefined>;
    const result = await activityLogsService.getAccessLogs({ userId, action, status: status as 'failed' | 'success' | undefined, startDate, endDate, page, limit });
    res.json({ success: true, data: result.data, meta: result.meta });
  } catch (err) {
    next(err);
  }
}

export async function listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { module, action, severity, user, search, startDate, endDate, page, limit } = req.query as Record<string, string | undefined>;
    const result = await activityLogsService.listAuditLogs({ module, action, severity, user, search, startDate, endDate, page, limit });
    res.json({ success: true, data: result.data, meta: result.meta });
  } catch (err) {
    next(err);
  }
}

export async function getAuditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await activityLogsService.getAuditLog(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await activityLogsService.getAuditLogStats()));
  } catch (err) {
    next(err);
  }
}
