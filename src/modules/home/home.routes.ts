import { Router } from 'express';
import { authenticateAdmin, optionalCustomerAuth } from '../../middleware/auth.middleware';
import * as homeController from './home.controller';

const router = Router();
const adminRouter = Router();

// Public: GET /home → full home feed payload
router.get('/', optionalCustomerAuth, homeController.getHome);

// Admin CMS routes
adminRouter.use(authenticateAdmin);

// Config
adminRouter.get('/config', homeController.getConfig);
adminRouter.put('/config', homeController.updateConfig);
adminRouter.post('/config/reset', homeController.resetConfig);

// Section definitions
adminRouter.get('/section-definitions', homeController.listSectionDefinitions);
adminRouter.post('/section-definitions', homeController.createSectionDefinition);
adminRouter.post('/section-definitions/reorder', homeController.reorderSectionDefinitions);
adminRouter.put('/section-definitions/:id', homeController.updateSectionDefinition);
adminRouter.delete('/section-definitions/:id', homeController.deleteSectionDefinition);

// Home sections (product lists)
adminRouter.get('/sections', homeController.listSections);
adminRouter.post('/sections', homeController.createSection);
adminRouter.post('/sections/reorder', homeController.reorderSections);
adminRouter.put('/sections/:id', homeController.updateSection);
adminRouter.delete('/sections/:id', homeController.deleteSection);
adminRouter.patch('/sections/:id/products', homeController.updateSectionProducts);

// Lifestyle items
adminRouter.get('/lifestyle', homeController.listLifestyle);
adminRouter.post('/lifestyle', homeController.createLifestyle);
adminRouter.post('/lifestyle/reorder', homeController.reorderLifestyle);
adminRouter.put('/lifestyle/:id', homeController.updateLifestyle);
adminRouter.delete('/lifestyle/:id', homeController.deleteLifestyle);

// Promo blocks
adminRouter.get('/promoblocks', homeController.listPromoBlocks);
adminRouter.post('/promoblocks', homeController.createPromoBlock);
adminRouter.post('/promoblocks/reorder', homeController.reorderPromoBlocks);
adminRouter.put('/promoblocks/:id', homeController.updatePromoBlock);
adminRouter.delete('/promoblocks/:id', homeController.deletePromoBlock);

// Preview
adminRouter.get('/preview', homeController.getBootstrapPreview);

// Config extras
adminRouter.get('/config/list', homeController.listHomeConfigs);
adminRouter.post('/config', homeController.upsertHomeConfig);
adminRouter.delete('/config', homeController.deleteHomeConfig);

// Categories management
adminRouter.get('/categories', homeController.listCategoriesAdmin);
adminRouter.get('/categories/:id/children', homeController.listCategoryChildren);
adminRouter.post('/categories', homeController.createCategoryAdmin);
adminRouter.post('/categories/reorder', homeController.reorderCategoriesAdmin);
adminRouter.put('/categories/:id', homeController.updateCategoryAdmin);
adminRouter.delete('/categories/:id', homeController.deleteCategoryAdmin);

// Banners management
adminRouter.get('/banners', homeController.listBannersAdmin);
adminRouter.post('/banners', homeController.createBannerAdmin);
adminRouter.post('/banners/reorder', homeController.reorderBannersAdmin);
adminRouter.put('/banners/:id', homeController.updateBannerAdmin);
adminRouter.delete('/banners/:id', homeController.deleteBannerAdmin);

// Upload
adminRouter.post('/upload-product-image', homeController.uploadProductImage);

// Products management
adminRouter.get('/products', homeController.listProductsAdmin);
adminRouter.get('/products/:id', homeController.getProductByIdAdmin);
adminRouter.get('/products/:id/variants', homeController.getProductVariantsAdmin);
adminRouter.post('/products', homeController.createProductAdmin);
adminRouter.patch('/products/bulk', homeController.bulkUpdateProductsAdmin);
adminRouter.patch('/products/bulk-status', homeController.bulkUpdateProductStatusAdmin);
adminRouter.put('/products/:id', homeController.updateProductAdmin);
adminRouter.patch('/products/:id/status', homeController.patchProductStatusAdmin);
adminRouter.post('/products/:id/publish', homeController.publishProductAdmin);
adminRouter.delete('/products/:id', homeController.deleteProductAdmin);

// Attributes
adminRouter.get('/attributes', homeController.listAttributes);
adminRouter.post('/attributes', homeController.createAttribute);
adminRouter.put('/attributes/:id', homeController.updateAttribute);
adminRouter.delete('/attributes/:id', homeController.deleteAttribute);

export { adminRouter };
export default router;
