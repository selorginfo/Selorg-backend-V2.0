import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { PERMISSIONS } from '../../config/permissions';
import * as controller from './notification-campaign.controller';
import {
  createTemplateSchema,
  updateTemplateSchema,
  createCampaignSchema,
  updateCampaignStatusSchema,
  createAutomationSchema,
  updateAutomationSchema,
  retryFailedBatchSchema,
} from './notification-campaign.validation';

const router = Router();

/** Reads: notification_campaigns.read — writes/sends/retries: notification_campaigns.write. Legacy had no fine-grained gate here. */
router.use((req: Request, res: Response, next: NextFunction) => {
  const readOnly = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const permission = readOnly ? PERMISSIONS.NOTIFICATION_CAMPAIGNS_READ : PERMISSIONS.NOTIFICATION_CAMPAIGNS_WRITE;
  return requirePermission(permission)(req, res, next);
});

router.get('/templates', controller.listTemplates);
router.post('/templates', validate(createTemplateSchema), controller.createTemplate);
router.put('/templates/:id', validate(updateTemplateSchema), controller.updateTemplate);
router.delete('/templates/:id', controller.deleteTemplate);

router.get('/campaigns', controller.listCampaigns);
router.get('/campaigns/:id', controller.getCampaignById);
router.post('/campaigns', validate(createCampaignSchema), controller.createCampaign);
router.put('/campaigns/:id', validate(updateCampaignStatusSchema), controller.updateCampaignStatus);

router.get('/scheduled', controller.listScheduled);

router.get('/automation', controller.listAutomation);
router.post('/automation', validate(createAutomationSchema), controller.createAutomation);
router.put('/automation/:id', validate(updateAutomationSchema), controller.updateAutomation);

router.get('/analytics', controller.getAnalytics);
router.get('/history', controller.listHistory);
router.post('/history/:id/retry', controller.retryHistory);
router.post('/history/retry-failed', validate(retryFailedBatchSchema), controller.retryFailedBatch);
router.get('/channels', controller.getChannels);
router.get('/timeseries', controller.getTimeSeries);

export default router;
