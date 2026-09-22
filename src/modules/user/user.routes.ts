import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateCustomer } from '../../middleware/auth.middleware';
import * as userController from './user.controller';
import * as authController from '../auth/auth.controller';
import { updateProfileSchema, changePasswordSchema, uploadAvatarSchema } from './user.validation';
import { sendLinkPhoneOtpSchema, verifyLinkPhoneOtpSchema, resendOtpSchema } from '../auth/auth.validation';

const router = Router();

router.get('/profile', authenticateCustomer, userController.getProfile);
router.put('/profile', authenticateCustomer, validate(updateProfileSchema), userController.updateProfile);
router.post('/profile/avatar', authenticateCustomer, validate(uploadAvatarSchema), userController.uploadAvatar);
router.put('/change-password', authenticateCustomer, validate(changePasswordSchema), userController.changePassword);

// Link / verify phone for email (and other) accounts that lack a verified number.
// Same handlers as /auth/link-phone/*, exposed here too for older/mobile client compatibility.
router.post('/phone/send-otp', authenticateCustomer, validate(sendLinkPhoneOtpSchema), authController.sendLinkPhoneOtp);
router.post('/phone/verify-otp', authenticateCustomer, validate(verifyLinkPhoneOtpSchema), authController.verifyLinkPhoneOtp);
router.post('/phone/resend-otp', authenticateCustomer, validate(resendOtpSchema), authController.resendOtp);

export default router;
