import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { optionalCustomerAuth, authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import * as onboardingController from './onboarding.controller';
import {
  createOnboardingPageSchema,
  updateOnboardingPageSchema,
  reorderOnboardingPagesSchema,
  uploadOnboardingImageSchema,
} from './onboarding.validation';

const router = Router();

router.get('/pages', onboardingController.getPages);
router.get('/pages/:pageNumber', onboardingController.getPageByNumber);
router.post('/complete', optionalCustomerAuth, onboardingController.completeOnboarding);
router.get('/status', optionalCustomerAuth, onboardingController.getStatus);

export const adminRouter = Router();
const adminAuth = [authenticateAdmin, requireRole('admin', 'super_admin')];

adminRouter.get('/', ...adminAuth, onboardingController.adminList);
adminRouter.post('/', ...adminAuth, validate(createOnboardingPageSchema), onboardingController.adminCreate);
adminRouter.put('/reorder', ...adminAuth, validate(reorderOnboardingPagesSchema), onboardingController.adminReorder);
adminRouter.put('/:id', ...adminAuth, validate(updateOnboardingPageSchema), onboardingController.adminUpdate);
adminRouter.delete('/:id', ...adminAuth, onboardingController.adminRemove);
adminRouter.post('/:id/image', ...adminAuth, validate(uploadOnboardingImageSchema), onboardingController.adminUploadImage);

export default router;
