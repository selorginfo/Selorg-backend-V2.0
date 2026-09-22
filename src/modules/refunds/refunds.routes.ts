import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateCustomer } from '../../middleware/auth.middleware';
import * as controller from './refunds.controller';
import { createRefundRequestSchema } from './refunds.validation';

const router = Router();

router.get('/', authenticateCustomer, controller.list);
router.post('/request', authenticateCustomer, validate(createRefundRequestSchema), controller.createRequest);
router.get('/:id/details', authenticateCustomer, controller.getDetails);
router.get('/:id', authenticateCustomer, controller.getById);

export default router;
