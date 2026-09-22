import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateCustomer } from '../../middleware/auth.middleware';
import * as authController from './auth.controller';
import {
  sendOtpSchema,
  verifyOtpSchema,
  resendOtpSchema,
  logoutSchema,
  sendLinkPhoneOtpSchema,
  verifyLinkPhoneOtpSchema,
} from './auth.validation';

const router = Router();

/**
 * @openapi
 * /auth/send-otp:
 *   post:
 *     summary: Send a login OTP via SMS, WhatsApp, or email
 *     tags: [Auth]
 */
router.post('/send-otp', validate(sendOtpSchema), authController.sendOtp);

/**
 * @openapi
 * /auth/verify-otp:
 *   post:
 *     summary: Verify a login OTP and receive an access token
 *     tags: [Auth]
 */
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtpController);

router.post('/resend-otp', validate(resendOtpSchema), authController.resendOtp);
router.post('/logout', validate(logoutSchema), authController.logout);

// Authenticated: link/verify a phone number to the current account.
router.post('/link-phone/send-otp', authenticateCustomer, validate(sendLinkPhoneOtpSchema), authController.sendLinkPhoneOtp);
router.post('/link-phone/verify-otp', authenticateCustomer, validate(verifyLinkPhoneOtpSchema), authController.verifyLinkPhoneOtp);

export default router;
