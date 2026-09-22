import { Router } from 'express';
import { authenticateCustomer } from '../../middleware/auth.middleware';
import * as supportController from './support.controller';
import { supportAttachmentUpload, supportUploadErrorHandler } from './support-upload.middleware';

/** Customer support routes — mounted at /api/v1/customer/support. Requires customer auth. */
const router = Router();

router.get('/tickets/active', authenticateCustomer, supportController.getActiveChatTicket);
router.get('/tickets', authenticateCustomer, supportController.listMyTickets);
router.post('/tickets', authenticateCustomer, supportAttachmentUpload, supportUploadErrorHandler, supportController.createTicket);
router.post('/tickets/:ticketId/reopen', authenticateCustomer, supportController.reopenTicket);
router.get('/tickets/:ticketId/messages', authenticateCustomer, supportController.getTicketMessages);
router.post(
  '/tickets/:ticketId/messages',
  authenticateCustomer,
  supportAttachmentUpload,
  supportUploadErrorHandler,
  supportController.sendMessage,
);

export default router;

/**
 * Public (unauthenticated) ticket-creation route, ported from legacy top-level
 * `support/routes/supportRoutes.js` — mounted at /api/v1/support, used by customer and rider
 * apps that create a ticket without a signed-in session.
 */
export const publicRouter = Router();
publicRouter.post('/tickets', supportController.createPublicTicket);
