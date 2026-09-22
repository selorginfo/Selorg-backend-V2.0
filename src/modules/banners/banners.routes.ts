import { Router } from 'express';
import { authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import * as bannersController from './banners.controller';

const router = Router();
// List must be registered before `/:id` so GET /api/v1/customer/banners resolves.
router.get('/', bannersController.listBanners);
router.get('/:id', bannersController.getBannerById);

export const adminRouter = Router();
adminRouter.use(authenticateAdmin, requireRole('admin', 'super_admin'));
adminRouter.get('/', bannersController.listBanners);
adminRouter.post('/', bannersController.createBanner);
adminRouter.post('/reorder', bannersController.reorderBanners);
adminRouter.put('/:id', bannersController.updateBanner);
adminRouter.delete('/:id', bannersController.deleteBanner);

export default router;
