import { Router } from 'express';
import { authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import { getPage } from './pages.controller';
import { listPages, createPage, updatePage, deletePage, getPage as getPageAdmin } from './cms.admin.controller';

const router = Router();

router.get('/:slug', getPage);

export const adminRouter = Router();
adminRouter.use(authenticateAdmin, requireRole('admin', 'super_admin'));
adminRouter.get('/', listPages);
adminRouter.get('/:id', getPageAdmin);
adminRouter.post('/', createPage);
adminRouter.put('/:id', updatePage);
adminRouter.delete('/:id', deletePage);

export default router;
