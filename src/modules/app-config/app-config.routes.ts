import { Router } from 'express';
import { optionalCustomerAuth, authenticateAdmin } from '../../middleware/auth.middleware';
import * as ctrl from './app-config.controller';

const router = Router();
const adminRouter = Router();

// Public — GET app config for customer app startup
router.get('/', optionalCustomerAuth, ctrl.getPublicConfig);

// Admin CRUD for app config
adminRouter.get('/', authenticateAdmin, ctrl.adminGetConfig);
adminRouter.put('/', authenticateAdmin, ctrl.adminUpdateConfig);
adminRouter.put('/section/:section', authenticateAdmin, ctrl.adminUpdateSection);
adminRouter.post('/reset', authenticateAdmin, ctrl.adminResetConfig);

// Admin cancellation policies
adminRouter.get('/cancellation-policies', authenticateAdmin, ctrl.listPolicies);
adminRouter.post('/cancellation-policies', authenticateAdmin, ctrl.createPolicy);
adminRouter.get('/cancellation-policies/:id', authenticateAdmin, ctrl.getPolicyById);
adminRouter.put('/cancellation-policies/:id', authenticateAdmin, ctrl.updatePolicy);
adminRouter.delete('/cancellation-policies/:id', authenticateAdmin, ctrl.deletePolicy);

// Standalone cancellation policy admin router (mounted at /admin/cancellation-policies)
export const cancellationPolicyAdminRouter = Router();
cancellationPolicyAdminRouter.use(authenticateAdmin);
cancellationPolicyAdminRouter.get('/', ctrl.listPolicies);
cancellationPolicyAdminRouter.get('/:id', ctrl.getPolicyById);
cancellationPolicyAdminRouter.post('/', ctrl.createPolicy);
cancellationPolicyAdminRouter.put('/:id', ctrl.updatePolicy);
cancellationPolicyAdminRouter.delete('/:id', ctrl.deletePolicy);

export { adminRouter };
export default router;
