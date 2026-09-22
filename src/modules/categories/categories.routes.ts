import { Router } from 'express';
import { authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import * as categoriesController from './categories.controller';
import { categoryDetailQuerySchema, categoryProductsQuerySchema } from './categories.validation';

const router = Router();

router.get('/', categoriesController.listCategories);
router.get('/:slug/products', validate(categoryProductsQuerySchema, 'query'), categoriesController.getCategoryProductsBySlug);
router.get('/:slug/subcategories', categoriesController.getSubcategoriesByCategorySlug);
router.get('/:id', validate(categoryDetailQuerySchema, 'query'), categoriesController.getCategoryDetail);

export const adminRouter = Router();
adminRouter.use(authenticateAdmin, requireRole('admin', 'super_admin'));
adminRouter.get('/', categoriesController.listCategories);
adminRouter.get('/all', categoriesController.listAllCategories);
adminRouter.get('/:id/children', categoriesController.getSubcategoriesByCategorySlug);
adminRouter.post('/', categoriesController.createCategory);
adminRouter.put('/:id', categoriesController.updateCategory);
adminRouter.delete('/:id', categoriesController.deleteCategory);
adminRouter.post('/reorder', categoriesController.reorderCategories);

export default router;
