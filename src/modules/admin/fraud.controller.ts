import type { Request, Response, NextFunction } from 'express';
import * as service from './fraud.service';
import type { ListAlertsQuery, CreateBlockedEntityInput, UpdateChargebackInput } from './fraud.validation';

export async function listAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as unknown as ListAlertsQuery;
    const { data, meta } = await service.listAlerts(q);
    res.json({ success: true, data, meta });
  } catch (err) {
    next(err);
  }
}

export async function getAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getAlert(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function updateAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.updateAlert(req.params.id, req.body || {}) });
  } catch (err) {
    next(err);
  }
}

export async function listBlockedEntities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listBlockedEntities() });
  } catch (err) {
    next(err);
  }
}

export async function createBlockedEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as CreateBlockedEntityInput;
    const blockedBy = req.user?.userId || 'system';
    const blockedByName = req.user?.email || 'System';
    const data = await service.createBlockedEntity(body, blockedBy, blockedByName);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function unblockEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.unblockEntity(req.params.id);
    res.json({ success: true, message: 'Entity unblocked' });
  } catch (err) {
    next(err);
  }
}

export async function listFraudRules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listFraudRules() });
  } catch (err) {
    next(err);
  }
}

export async function toggleFraudRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.toggleFraudRule(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function listRiskProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listRiskProfiles() });
  } catch (err) {
    next(err);
  }
}

export async function listFraudPatterns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listFraudPatterns() });
  } catch (err) {
    next(err);
  }
}

export async function listInvestigations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listInvestigations() });
  } catch (err) {
    next(err);
  }
}

export async function listChargebacks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listChargebacks() });
  } catch (err) {
    next(err);
  }
}

export async function updateChargeback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await service.updateChargeback(req.params.id, req.body as UpdateChargebackInput);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getMetrics() });
  } catch (err) {
    next(err);
  }
}
