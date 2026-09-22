import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { PERMISSIONS } from '../../config/permissions';
import * as controller from './system-config.controller';
import { createApiKeySchema, toggleMaintenanceModeSchema } from './system-config.validation';

const router = Router();

/** Reads: admin.config.read — Writes/restarts/maintenance: admin.config.write. Matches legacy systemRoutes.js. */
router.use((req: Request, res: Response, next: NextFunction) => {
  const readOnly = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const permission = readOnly ? PERMISSIONS.ADMIN_CONFIG_READ : PERMISSIONS.ADMIN_CONFIG_WRITE;
  return requirePermission(permission)(req, res, next);
});

router.get('/general', controller.getGeneral);
router.put('/general', controller.updateGeneral);
router.get('/delivery', controller.getDelivery);
router.put('/delivery', controller.updateDelivery);
router.get('/notifications', controller.getNotifications);
router.put('/notifications', controller.updateNotifications);
router.get('/tax-settings', controller.getTax);
router.put('/tax-settings', controller.updateTax);
router.get('/advanced', controller.getAdvanced);
router.put('/advanced', controller.updateAdvanced);

router.get('/payment-gateways', controller.listPaymentGateways);
router.put('/payment-gateways/:id', controller.updatePaymentGateway);

router.get('/feature-flags', controller.listFeatureFlags);
router.put('/feature-flags/:id/toggle', controller.toggleFeatureFlag);

router.get('/integrations', controller.listIntegrations);
router.put('/integrations/:id', controller.updateIntegration);
router.post('/integrations/:id/test', controller.testIntegration);

router.get('/api-keys', controller.listApiKeys);
router.post('/api-keys', validate(createApiKeySchema), controller.createApiKey);
router.post('/api-keys/:id/revoke', controller.revokeApiKey);
router.post('/api-keys/:id/rotate', controller.rotateApiKey);

router.get('/cron-jobs', controller.listCronJobs);
router.post('/cron-jobs/:jobId/trigger', controller.triggerCronJob);
router.put('/cron-jobs/:jobId', controller.toggleCronJob);

router.get('/env-variables', controller.listEnvVariables);
router.put('/env-variables/:key', controller.updateEnvVariable);

router.get('/maintenance', controller.getMaintenanceMode);
router.post('/maintenance', validate(toggleMaintenanceModeSchema), controller.toggleMaintenanceMode);

export default router;
