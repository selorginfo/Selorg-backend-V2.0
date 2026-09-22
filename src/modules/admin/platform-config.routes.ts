import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import * as platformConfigController from './platform-config.controller';

const router = Router();

router.get('/', requirePermission(PERMISSIONS.ADMIN_CONFIG_READ), platformConfigController.list);
router.get('/:key', requirePermission(PERMISSIONS.ADMIN_CONFIG_READ), platformConfigController.getOne);
router.put('/:key', requirePermission(PERMISSIONS.ADMIN_CONFIG_WRITE), platformConfigController.upsert);
router.delete('/:key', requirePermission(PERMISSIONS.ADMIN_CONFIG_WRITE), platformConfigController.remove);

export default router;
