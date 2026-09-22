import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { getAppSettings, updateAppSettings } from './app-settings.controller';

const router = Router();

router.get('/', requirePermission(PERMISSIONS.ADMIN_CONFIG_READ), getAppSettings);
router.put('/', requirePermission(PERMISSIONS.ADMIN_CONFIG_WRITE), updateAppSettings);

export default router;
