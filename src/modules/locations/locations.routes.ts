import { Router } from 'express';
import { optionalCustomerAuth } from '../../middleware/auth.middleware';
import { suggestions, approximate, reverse, placeDetails } from './locations.controller';

const router = Router();

router.get('/suggestions', optionalCustomerAuth, suggestions);
router.get('/approximate', optionalCustomerAuth, approximate);
router.get('/reverse', optionalCustomerAuth, reverse);
router.get('/place-details', optionalCustomerAuth, placeDetails);

export default router;
