import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateCustomer } from '../../middleware/auth.middleware';
import * as controller from './wallet.controller';
import { debitForCheckoutSchema, initiateTopUpSchema } from './wallet.validation';

const router = Router();

router.get('/balance', authenticateCustomer, controller.getBalance);
router.get('/transactions', authenticateCustomer, controller.getTransactions);
router.post('/top-up/session', authenticateCustomer, validate(initiateTopUpSchema), controller.initiateTopUp);
router.post('/credit', authenticateCustomer, controller.creditForTopUp);
router.post('/debit', authenticateCustomer, validate(debitForCheckoutSchema), controller.debitForCheckout);

export default router;
