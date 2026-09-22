import { Router } from 'express';
import { optionalCustomerAuth } from '../../middleware/auth.middleware';
import { getBootstrap } from './bootstrap.controller';

const router = Router();

router.get('/', optionalCustomerAuth, getBootstrap);

export default router;
