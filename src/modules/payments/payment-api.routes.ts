import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateCustomer } from '../../middleware/auth.middleware';
import {
  initiateStandalonePayment,
  paymentCallback,
  getPaymentStatus,
  getTransactionStatusPostTxn,
} from './payment-api.controller';

const router = Router();

// Strict rate limit for payment initiation (anti-abuse)
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many payment requests' } },
});

// POST /api/payment/initiate — requires customer JWT
router.post('/initiate', paymentLimiter, authenticateCustomer, initiateStandalonePayment);

// POST /api/payment/callback — app/SDK posts gateway payload, requires customer JWT
router.post('/callback', authenticateCustomer, paymentCallback);

// GET /api/payment/status/:orderId — requires customer JWT
router.get('/status/:orderId', authenticateCustomer, getPaymentStatus);

// POST /api/payment/transaction-status — Type O gateway-initiated query, no auth
router.post('/transaction-status', getTransactionStatusPostTxn);

export default router;
