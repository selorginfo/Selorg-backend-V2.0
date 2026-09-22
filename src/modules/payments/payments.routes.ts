import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateCustomer } from '../../middleware/auth.middleware';
import * as controller from './payments.controller';
import {
  addPaymentMethodSchema,
  updatePaymentMethodSchema,
  createWorldlineSessionSchema,
  completeWorldlinePaymentSchema,
  abortWorldlinePaymentSchema,
} from './payments.validation';

const router = Router();

// Worldline / Paynimo returnUrl — NO auth, this is the gateway's own callback/redirect target.
router.all('/worldline/return', controller.worldlineReturn);

router.get('/methods', authenticateCustomer, controller.getMethods);
router.post('/methods', authenticateCustomer, validate(addPaymentMethodSchema), controller.addPaymentMethod);
router.put('/methods/:id', authenticateCustomer, validate(updatePaymentMethodSchema), controller.updatePaymentMethod);
router.delete('/methods/:id', authenticateCustomer, controller.removePaymentMethod);
router.post('/methods/:id/default', authenticateCustomer, controller.setDefaultMethod);

// Worldline / Paynimo (backend-led session, app-verified complete, status polling).
router.post('/worldline/session', authenticateCustomer, validate(createWorldlineSessionSchema), controller.createWorldlineSession);
router.post('/worldline/complete', authenticateCustomer, validate(completeWorldlinePaymentSchema), controller.completeWorldlinePayment);
router.post('/worldline/abort', authenticateCustomer, validate(abortWorldlinePaymentSchema), controller.abortWorldlinePayment);
router.get('/worldline/status', authenticateCustomer, controller.getWorldlineStatus);

// NOT ported: `paymentRetryController`/`paymentRetryService` (retry-status/retry/record-failure
// endpoints) and the Type O `getTransactionStatusPostTxn` gateway-initiated status-query
// endpoint — see module doc comment in worldline.service.ts and the migration memory for why.

export default router;
