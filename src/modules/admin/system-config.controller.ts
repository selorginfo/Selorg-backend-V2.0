import type { Request, Response, NextFunction } from 'express';
import * as service from './system-config.service';
import type { CreateApiKeyInput, ToggleMaintenanceModeInput } from './system-config.validation';

function ok(res: Response, data: unknown) {
  res.json({ success: true, data });
}

export async function getGeneral(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.getSection('general'));
  } catch (err) {
    next(err);
  }
}

export async function updateGeneral(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.updateSection('general', req.body || {}));
  } catch (err) {
    next(err);
  }
}

export async function getDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.getSection('delivery'));
  } catch (err) {
    next(err);
  }
}

export async function updateDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.updateSection('delivery', req.body || {}));
  } catch (err) {
    next(err);
  }
}

export async function getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.getSection('notifications'));
  } catch (err) {
    next(err);
  }
}

export async function updateNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.updateSection('notifications', req.body || {}));
  } catch (err) {
    next(err);
  }
}

export async function getTax(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.getSection('tax'));
  } catch (err) {
    next(err);
  }
}

export async function updateTax(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.updateSection('tax', req.body || {}));
  } catch (err) {
    next(err);
  }
}

export async function getAdvanced(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.getSection('advanced'));
  } catch (err) {
    next(err);
  }
}

export async function updateAdvanced(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.updateSection('advanced', req.body || {}));
  } catch (err) {
    next(err);
  }
}

export async function listPaymentGateways(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.listPaymentGateways());
  } catch (err) {
    next(err);
  }
}

export async function updatePaymentGateway(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.updatePaymentGateway(req.params.id, req.body || {}));
  } catch (err) {
    next(err);
  }
}

export async function listFeatureFlags(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.listFeatureFlags());
  } catch (err) {
    next(err);
  }
}

export async function toggleFeatureFlag(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.toggleFeatureFlag(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function listIntegrations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.listIntegrationsLite());
  } catch (err) {
    next(err);
  }
}

export async function updateIntegration(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.updateIntegrationLite(req.params.id, req.body || {}));
  } catch (err) {
    next(err);
  }
}

export async function testIntegration(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const message = await service.testIntegrationLite(req.params.id);
    res.json({ success: true, message });
  } catch (err) {
    next(err);
  }
}

export async function listApiKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await service.listApiKeys());
  } catch (err) {
    next(err);
  }
}

export async function createApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, scopes } = req.body as CreateApiKeyInput;
    const { data, plainKey } = await service.createApiKey(name, scopes, req.user?.userId);
    res.status(201).json({ success: true, data, plainKey, message: 'API key created. Copy the plain key now - it will not be shown again.' });
  } catch (err) {
    next(err);
  }
}

export async function revokeApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.revokeApiKey(req.params.id);
    res.json({ success: true, message: 'API key revoked' });
  } catch (err) {
    next(err);
  }
}

export async function rotateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { data, plainKey } = await service.rotateApiKey(req.params.id);
    res.json({ success: true, data, plainKey, message: 'API key rotated. Copy the new plain key now - it will not be shown again.' });
  } catch (err) {
    next(err);
  }
}

export async function listCronJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, service.listCronJobs());
  } catch (err) {
    next(err);
  }
}

export async function triggerCronJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, message: 'Cron job triggered' });
  } catch (err) {
    next(err);
  }
}

export async function toggleCronJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function listEnvVariables(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, service.listEnvVariables());
  } catch (err) {
    next(err);
  }
}

export async function updateEnvVariable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getMaintenanceMode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { enabled } = await service.getMaintenanceMode();
    res.json({ success: true, enabled, message: '' });
  } catch (err) {
    next(err);
  }
}

export async function toggleMaintenanceMode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { enabled: requested } = req.body as ToggleMaintenanceModeInput;
    const { enabled } = await service.toggleMaintenanceMode(requested);
    res.json({ success: true, enabled });
  } catch (err) {
    next(err);
  }
}
