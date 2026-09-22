import { Router } from 'express';
import { authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import { getCollection } from './collections.controller';
import { listCollections, createCollection, updateCollection, deleteCollection } from '../pages/cms.admin.controller';

const router = Router();

router.get('/:slug', getCollection);

export const adminRouter = Router();
adminRouter.use(authenticateAdmin, requireRole('admin', 'super_admin'));
adminRouter.get('/', listCollections);
adminRouter.post('/', createCollection);
adminRouter.put('/:id', updateCollection);
adminRouter.delete('/:id', deleteCollection);

export default router;
