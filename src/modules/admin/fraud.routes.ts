import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { PERMISSIONS } from '../../config/permissions';
import * as controller from './fraud.controller';
import { listAlertsQuerySchema, createBlockedEntitySchema, updateChargebackSchema } from './fraud.validation';

const router = Router();

/** Reads: fraud.read — writes (alert updates, blocking, rule toggles, chargeback updates): fraud.write. Legacy had no gate here. */
router.use((req: Request, res: Response, next: NextFunction) => {
  const readOnly = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const permission = readOnly ? PERMISSIONS.FRAUD_READ : PERMISSIONS.FRAUD_WRITE;
  return requirePermission(permission)(req, res, next);
});

router.get('/alerts', validate(listAlertsQuerySchema, 'query'), controller.listAlerts);
router.get('/alerts/:id', controller.getAlert);
router.patch('/alerts/:id', controller.updateAlert);

router.get('/blocked', controller.listBlockedEntities);
router.post('/blocked', validate(createBlockedEntitySchema), controller.createBlockedEntity);
router.delete('/blocked/:id', controller.unblockEntity);

router.get('/rules', controller.listFraudRules);
router.patch('/rules/:id/toggle', controller.toggleFraudRule);

router.get('/risk-profiles', controller.listRiskProfiles);
router.get('/patterns', controller.listFraudPatterns);
router.get('/investigations', controller.listInvestigations);

router.get('/chargebacks', controller.listChargebacks);
router.patch('/chargebacks/:id', validate(updateChargebackSchema), controller.updateChargeback);

router.get('/metrics', controller.getMetrics);

export default router;
