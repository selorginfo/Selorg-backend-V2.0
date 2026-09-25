import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateCustomer, authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
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
// Dashboard status transition — admin role required (never accept a customer JWT).
router.put('/:id/update-status', authenticateAdmin, requireRole('admin', 'super_admin'), validate(updateOrderStatusSchema), orderController.updateStatus);
router.post('/:id/reorder', authenticateCustomer, orderController.reorder);

// ─── Admin-authenticated sub-router ──────────────────────────────────────────
// Mounted separately at /api/v1/admin/orders (see app.ts).
// MUST requireRole — authenticateAdmin alone is not enough when JWT_SECRET is shared
// with customer tokens (CUSTOMER_JWT_SECRET unset).
export const adminOrderRouter = Router();
adminOrderRouter.use(authenticateAdmin, requireRole('admin', 'super_admin'));
adminOrderRouter.get('/', orderController.adminList);
adminOrderRouter.get('/:id', orderController.adminGetDetail);
adminOrderRouter.get('/:id/logs', orderController.adminGetLogs);
adminOrderRouter.put('/:id/update-status', validate(updateOrderStatusSchema), orderController.updateStatus);
adminOrderRouter.post('/:id/notes', orderController.adminAddNote);
adminOrderRouter.post('/:id/reassign-picker', orderController.adminReassignPicker);
adminOrderRouter.post('/:id/reassign-rider', orderController.adminReassignRider);
adminOrderRouter.post('/:id/contact', orderController.adminContactCustomer);
adminOrderRouter.post('/:id/refund', orderController.adminInitiateRefund);

export default router;
