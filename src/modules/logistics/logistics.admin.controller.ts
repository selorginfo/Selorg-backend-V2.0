import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import * as providerConfigService from './logistics.provider-config.service';
import * as analytics from './logistics.analytics.service';

/**
 * GET /admin/providers
 * Lists all logistics provider configurations sorted by priority.
 */
export async function listProviders(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await providerConfigService.listConfigs();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /admin/providers/:id
 * Updates isActive and/or priority on a single provider config.
 */
export async function patchProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as { isActive?: boolean; priority?: number };
    const patch: { isActive?: boolean; priority?: number } = {};
    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive;
    if (typeof body.priority === 'number') patch.priority = body.priority;

    const data = await providerConfigService.updateConfig(req.params.id, patch);
    if (!data) {
      throw new AppError('Provider config not found', 404, 'NOT_FOUND');
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /admin/providers/:id/reorder
 * Moves a provider config up or down in the priority order.
 * Body: { direction: 'up' | 'down' }
 */
export async function reorderProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { direction } = req.body as { direction: 'up' | 'down' };
    const data = await providerConfigService.reorderConfig(req.params.id, direction);
    if (!data) {
      throw new AppError('Provider config not found', 404, 'NOT_FOUND');
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /admin/analytics/cost-per-route
 * Aggregated cost-per-km from LogisticsOrder (fare / distanceKm).
 */
export async function costPerRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const data = await analytics.getCostPerRoute(from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /admin/analytics/sla-breaches
 * Orders / metric rows that breached the scheduledTime + 4h SLA window.
 */
export async function slaBreaches(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await analytics.getSlaBreaches();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /admin/analytics/kpis
 * Live KPIs from LogisticsOrder aggregations.
 */
export async function kpis(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const data = await analytics.getLogisticsKpis(from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
