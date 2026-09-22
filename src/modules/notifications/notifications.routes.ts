import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateCustomer, authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import * as notificationsController from './notifications.controller';
import {
  listNotificationsQuerySchema,
  updatePreferencesSchema,
  registerPushTokenSchema,
  registerWebPushSchema,
  removeTokenSchema,
} from './notifications.validation';

const router = Router();

router.get('/preferences', authenticateCustomer, notificationsController.getPreferencesHandler);
router.put('/preferences', authenticateCustomer, validate(updatePreferencesSchema), notificationsController.updatePreferencesHandler);
router.get('/vapid-public-key', notificationsController.vapidPublicKey);
router.get('/unread-count', authenticateCustomer, notificationsController.unreadCount);
router.get('/', authenticateCustomer, validate(listNotificationsQuerySchema, 'query'), notificationsController.list);
router.put('/read-all', authenticateCustomer, notificationsController.markAllReadHandler);
router.put('/:id/read', authenticateCustomer, notificationsController.markOneRead);
router.put('/:id/unread', authenticateCustomer, notificationsController.markOneUnread);
router.delete('/:id', authenticateCustomer, notificationsController.deleteOne);
router.post('/register-token', authenticateCustomer, validate(registerPushTokenSchema), notificationsController.registerToken);
router.post('/register-web-push', authenticateCustomer, validate(registerWebPushSchema), notificationsController.registerWebPush);
router.post('/remove-token', authenticateCustomer, validate(removeTokenSchema), notificationsController.removeToken);
router.post('/remove-all-tokens', authenticateCustomer, notificationsController.removeAllTokens);

export const adminRouter = Router();
adminRouter.use(authenticateAdmin, requireRole('admin', 'super_admin'));
adminRouter.get('/', notificationsController.adminList);
adminRouter.get('/stats', notificationsController.adminStats);
adminRouter.post('/send', notificationsController.adminSend);
adminRouter.delete('/:id', notificationsController.adminRemove);

export default router;
