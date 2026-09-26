import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateCustomer, authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import * as orderController from './order.controller';
import { cancelOrderSchema, createOrderSchema, listOrdersQuerySchema, rateOrderSchema, updateOrderStatusSchema, verifyOrderOtpSchema } from './order.validation';
import { rejectClientPriceEdits } from './order-pricing-guard';

const router = Router();

router.get('/active', authenticateCustomer, orderController.active);
router.get('/', authenticateCustomer, validate(listOrdersQuerySchema, 'query'), orderController.list);
router.get('/:id', authenticateCustomer, orderController.getDetail);
router.post('/', authenticateCustomer, rejectClientPriceEdits, validate(createOrderSchema), orderController.create);
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
const ORDER_READ_ROLES = [
  'admin',
  'super_admin',
  'superadmin',
  'darkstore',
  'dark_store_manager',
  'dark store manager',
  'store_manager',
  'operations_admin',
  'operations admin',
  'operations',
  'ops',
  'customer_support',
  'customer support',
  'support',
  'warehouse',
  'warehouse_manager',
  'warehouse manager',
] as const;

export const adminOrderRouter = Router();
adminOrderRouter.use(authenticateAdmin);
// Read access for store managers and ops. Mutations stay limited to admin roles below.
adminOrderRouter.get('/', requireRole(...ORDER_READ_ROLES), orderController.adminList);
adminOrderRouter.get('/:id/logs', requireRole(...ORDER_READ_ROLES), orderController.adminGetLogs);
adminOrderRouter.get('/:id', requireRole(...ORDER_READ_ROLES), orderController.adminGetDetail);
adminOrderRouter.use(requireRole('admin', 'super_admin'));
adminOrderRouter.put('/:id/update-status', validate(updateOrderStatusSchema), orderController.updateStatus);
adminOrderRouter.post('/:id/notes', orderController.adminAddNote);
adminOrderRouter.post('/:id/reassign-picker', orderController.adminReassignPicker);
adminOrderRouter.post('/:id/reassign-rider', orderController.adminReassignRider);
adminOrderRouter.post('/:id/contact', orderController.adminContactCustomer);
adminOrderRouter.post('/:id/refund', orderController.adminInitiateRefund);

export default router;
