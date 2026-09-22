import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateCustomer, authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import * as faqController from './faq.controller';
import { listFaqQuerySchema, adminListFaqQuerySchema, submitFaqFeedbackSchema, createFaqSchema, updateFaqSchema } from './faq.validation';

const router = Router();

router.get('/', validate(listFaqQuerySchema, 'query'), faqController.list);
router.get('/categories', faqController.listCategories);
router.post('/:id/feedback', authenticateCustomer, validate(submitFaqFeedbackSchema), faqController.submitFeedback);

export const adminRouter = Router();
const adminAuth = [authenticateAdmin, requireRole('admin', 'super_admin')];

adminRouter.get('/', ...adminAuth, validate(adminListFaqQuerySchema, 'query'), faqController.adminList);
adminRouter.get('/categories', ...adminAuth, faqController.listCategories);
adminRouter.get('/:id', ...adminAuth, faqController.adminGetById);
adminRouter.post('/', ...adminAuth, validate(createFaqSchema), faqController.adminCreate);
adminRouter.put('/:id', ...adminAuth, validate(updateFaqSchema), faqController.adminUpdate);
adminRouter.delete('/:id', ...adminAuth, faqController.adminDelete);

export default router;
