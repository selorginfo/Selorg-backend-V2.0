import { Router } from 'express';
import { authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import * as cmsAdminController from './cms.admin.controller';

const router = Router();
router.use(authenticateAdmin, requireRole('admin', 'super_admin'));

router.get('/overview', cmsAdminController.getOverview);

// Bulk upload stubs
router.post('/upload/sku-master', cmsAdminController.uploadSkuMaster);
router.post('/upload/cms-pages', cmsAdminController.uploadCmsPages);
router.post('/upload/content-hub-master', cmsAdminController.uploadContentHubMaster);
router.get('/import-jobs/content-hub/:jobId', cmsAdminController.getContentHubImportJob);
router.get('/import-history/content-hub', cmsAdminController.listContentHubImportRuns);
router.post('/consolidate-catalog-taxonomy', cmsAdminController.consolidateCatalogTaxonomy);

// Pages CRUD
router.get('/pages', cmsAdminController.listPages);
router.get('/pages/:id', cmsAdminController.getPage);
router.post('/pages', cmsAdminController.createPage);
router.put('/pages/:id', cmsAdminController.updatePage);
router.delete('/pages/:id', cmsAdminController.deletePage);

// Collections CRUD
router.get('/collections', cmsAdminController.listCollections);
router.post('/collections', cmsAdminController.createCollection);
router.put('/collections/:id', cmsAdminController.updateCollection);
router.delete('/collections/:id', cmsAdminController.deleteCollection);

// Media
router.get('/media', cmsAdminController.listMedia);
router.post('/media', cmsAdminController.createMedia);
router.delete('/media/:id', cmsAdminController.deleteMedia);

// Banners
router.get('/banners', cmsAdminController.listBanners);
router.post('/banners', cmsAdminController.createBanner);
router.put('/banners/:id', cmsAdminController.updateBanner);
router.delete('/banners/:id', cmsAdminController.deleteBanner);

// Home Sections
router.get('/home-sections', cmsAdminController.listHomeSections);
router.post('/home-sections', cmsAdminController.createHomeSection);
router.put('/home-sections/:id', cmsAdminController.updateHomeSection);
router.delete('/home-sections/:id', cmsAdminController.deleteHomeSection);

// Buttons
router.get('/buttons', cmsAdminController.listButtons);
router.post('/buttons', cmsAdminController.createButton);
router.put('/buttons/:id', cmsAdminController.updateButton);
router.delete('/buttons/:id', cmsAdminController.deleteButton);

export default router;
