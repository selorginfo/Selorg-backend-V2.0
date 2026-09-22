import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateCustomer, authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import * as legalController from './legal.controller';
import {
  acceptLegalSchema,
  listLegalDocsQuerySchema,
  createLegalDocSchema,
  updateLegalDocSchema,
  updateLegalConfigSchema,
} from './legal.validation';

const router = Router();

// --- Customer-facing (mounted at /api/v1/customer/legal) ---------------------
router.get('/config', legalController.getConfig);
router.get('/terms', legalController.getTerms);
router.get('/privacy', legalController.getPrivacy);
router.get('/license', legalController.getLicense);
router.post('/accept', authenticateCustomer, validate(acceptLegalSchema), legalController.accept);

// --- Admin (mounted at /api/v1/customer/admin/legal) --------------------------
export const adminRouter = Router();
const adminAuth = [authenticateAdmin, requireRole('admin', 'super_admin')];

adminRouter.get('/documents', ...adminAuth, validate(listLegalDocsQuerySchema, 'query'), legalController.listDocuments);
adminRouter.get('/documents/:id', ...adminAuth, legalController.getDocument);
adminRouter.post('/documents', ...adminAuth, validate(createLegalDocSchema), legalController.createDocument);
adminRouter.put('/documents/:id', ...adminAuth, validate(updateLegalDocSchema), legalController.updateDocument);
adminRouter.delete('/documents/:id', ...adminAuth, legalController.deleteDocument);
adminRouter.post('/documents/:id/set-current', ...adminAuth, legalController.setCurrentDocument);
adminRouter.get('/config', ...adminAuth, legalController.getAdminConfig);
adminRouter.put('/config', ...adminAuth, validate(updateLegalConfigSchema), legalController.updateAdminConfig);

export default router;
