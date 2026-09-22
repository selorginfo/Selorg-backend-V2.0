import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { PERMISSIONS } from '../../config/permissions';
import * as controller from './compliance.controller';
import { createAuditSchema, updateFindingStatusSchema } from './compliance.validation';
import { complianceDocumentUpload, complianceUploadErrorHandler } from './compliance-upload.middleware';

const router = Router();

/** Reads: compliance.read — writes/uploads/acknowledgements: compliance.write. Legacy had no gate here. */
router.use((req: Request, res: Response, next: NextFunction) => {
  const readOnly = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const permission = readOnly ? PERMISSIONS.COMPLIANCE_READ : PERMISSIONS.COMPLIANCE_WRITE;
  return requirePermission(permission)(req, res, next);
});

router.get('/documents', controller.listDocuments);
router.post('/documents', complianceDocumentUpload, complianceUploadErrorHandler, controller.uploadDocument);
router.patch('/documents/:id', complianceDocumentUpload, complianceUploadErrorHandler, controller.updateDocument);
router.delete('/documents/:id', controller.deleteDocument);

router.get('/certifications', controller.listCertifications);
router.get('/audits', controller.listAudits);
router.post('/audits', validate(createAuditSchema), controller.createAudit);
router.patch('/audits/:auditId/findings/:findingId', validate(updateFindingStatusSchema), controller.updateFindingStatus);

router.get('/policies', controller.listPolicies);
router.post('/policies/:id/acknowledge', controller.acknowledgePolicy);

router.get('/violations', controller.listViolations);
router.get('/metrics', controller.getMetrics);
router.post('/reports/generate', controller.generateReport);

export default router;
