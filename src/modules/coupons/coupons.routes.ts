import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import {
  authenticateCustomer,
  optionalCustomerAuth,
  authenticateAdmin,
  requireRole,
  requirePermission,
} from '../../middleware/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import * as couponsController from './coupons.controller';
import { validateCouponSchema, redeemCouponSchema, createCouponSchema } from './coupons.validation';

const router = Router();

// Public, but optional auth so a signed-in caller gets per-user eligibility and
// per-user usage limits instead of being treated as an anonymous cart.
router.get('/', optionalCustomerAuth, couponsController.list);
router.post('/validate', optionalCustomerAuth, validate(validateCouponSchema), couponsController.validate);
router.post('/redeem', authenticateCustomer, validate(redeemCouponSchema), couponsController.redeem);

export const adminRouter = Router();
const pricingRead = [authenticateAdmin, requireRole('admin', 'super_admin'), requirePermission(PERMISSIONS.PRICING_READ)];
const pricingWrite = [authenticateAdmin, requireRole('admin', 'super_admin'), requirePermission(PERMISSIONS.PRICING_OVERRIDE)];

adminRouter.get('/', ...pricingRead, couponsController.adminList);
adminRouter.get('/stats', ...pricingRead, couponsController.adminStats);
adminRouter.get('/:id', ...pricingRead, couponsController.adminGetById);
adminRouter.post('/', ...pricingWrite, validate(createCouponSchema), couponsController.adminCreate);
adminRouter.put('/:id', ...pricingWrite, couponsController.adminUpdate);
adminRouter.delete('/:id', ...pricingWrite, couponsController.adminRemove);

export default router;
