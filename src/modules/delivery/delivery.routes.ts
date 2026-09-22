import { Router } from 'express';
import { optionalCustomerAuth } from '../../middleware/auth.middleware';
import { getDeliveryEstimate, getDeliveryFee, getDeliverySlots } from './delivery.controller';

const router = Router();

router.get('/estimate', optionalCustomerAuth, getDeliveryEstimate);
router.get('/fee', optionalCustomerAuth, getDeliveryFee);
router.get('/slots', optionalCustomerAuth, getDeliverySlots);

export default router;
