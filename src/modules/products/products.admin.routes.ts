import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth.middleware';
import * as adminProductsController from './products.admin.controller';

const router = Router();

router.use(authenticateAdmin);

router.get('/bulk-upload/template', adminProductsController.downloadTemplate);
router.get('/', adminProductsController.listProducts);
router.get('/:id', adminProductsController.getProduct);
router.post('/', adminProductsController.createProduct);
router.put('/:id', adminProductsController.updateProduct);
router.delete('/:id', adminProductsController.deleteProduct);
router.post('/upload-image', adminProductsController.uploadImageMiddleware, adminProductsController.uploadProductImage);
router.post('/bulk-upload', adminProductsController.uploadMiddleware, adminProductsController.bulkUpload);

export default router;
