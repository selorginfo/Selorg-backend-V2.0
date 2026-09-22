import { Router } from 'express';
import { authenticateAdmin, authenticateCustomer } from '../../middleware/auth.middleware';
import * as controller from './support-chat.controller';

// ─── Rider routes (authenticated via customer JWT) ────────────────────────────
const riderRouter = Router();

riderRouter.get('/conversation', authenticateCustomer, controller.riderGetConversation);
riderRouter.get('/conversation/messages', authenticateCustomer, controller.riderGetMessages);
riderRouter.post('/conversation/messages', authenticateCustomer, controller.riderSendMessage);
riderRouter.post('/conversation/read', authenticateCustomer, controller.riderMarkRead);

// ─── Admin routes (authenticated via admin JWT) ───────────────────────────────
const adminRouter = Router();

adminRouter.use(authenticateAdmin);

adminRouter.get('/conversations', controller.adminListConversations);
adminRouter.get('/conversations/:id/context', controller.adminGetConversationContext);
adminRouter.get('/conversations/:id', controller.adminGetConversation);
adminRouter.post('/conversations/:id/messages', controller.adminSendMessage);
adminRouter.post('/conversations/:id/read', controller.adminMarkRead);
adminRouter.patch('/conversations/:id/status', controller.adminUpdateStatus);

export { riderRouter, adminRouter };
export default riderRouter;
