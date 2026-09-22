import { Router } from 'express';
import { authenticateCustomer } from '../../middleware/auth.middleware';
import { invoice } from './invoice.controller';

const router = Router();

router.get('/:id/invoice', authenticateCustomer, invoice);

export default router;
