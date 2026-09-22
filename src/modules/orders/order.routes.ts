import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateCustomer, authenticateAdmin } from '../../middleware/auth.middleware';
import * as orderController from './order.controller';
import { cancelOrderSchema, createOrderSchema, listOrdersQuerySchema, rateOrderSchema, updateOrderStatusSchema, verifyOrderOtpSchema } from './order.validation';

const router = Router();

router.get('/active', authenticateCustomer, orderController.active);
router.get('/', authenticateCustomer, validate(listOrdersQuerySchema, 'query'), orderController.list);
router.get('/:id', authenticateCustomer, orderController.getDetail);
router.post('/', authenticateCustomer, validate(createOrderSchema), orderController.create);
router.post('/:id/cancel', authenticateCustomer, validate(cancelOrderSchema), orderController.cancel);
router.get('/:id/can-cancel', authenticateCustomer, orderController.canCancel);
router.get('/:id/status', authenticateCustomer, orderController.status);
router.get('/:id/tracking', authenticateCustomer, orderController.tracking);
router.post('/:id/rate', authenticateCustomer, validate(rateOrderSchema), orderController.rate);
router.post('/:id/verify-otp', authenticateCustomer, validate(verifyOrderOtpSchema), orderController.verifyOtp);
// Dashboard/rider status transition — admin-authenticated, matches legacy `authenticateToken` on this route.
router.put('/:id/update-status', authenticateAdmin, validate(updateOrderStatusSchema), orderController.updateStatus);
router.post('/:id/reorder', authenticateCustomer, orderController.reorder);

// ─── Admin-authenticated sub-router ──────────────────────────────────────────
// Mounted separately at /api/v1/admin/orders (see app.ts).
export const adminOrderRouter = Router();
adminOrderRouter.get('/', authenticateAdmin, orderController.adminList);
adminOrderRouter.get('/:id', authenticateAdmin, orderController.adminGetDetail);
adminOrderRouter.get('/:id/logs', authenticateAdmin, orderController.adminGetLogs);
adminOrderRouter.put('/:id/update-status', authenticateAdmin, validate(updateOrderStatusSchema), orderController.updateStatus);

export default router;
