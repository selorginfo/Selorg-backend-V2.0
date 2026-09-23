import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { authenticatePicker, authenticatePickerAllowSuspended, requireActivePicker, requireWorkforceRole } from './picker.auth.middleware';
import { pickerDocumentUpload, pickerPhotoUpload, pickerUploadErrorHandler } from './picker.upload.middleware';
import * as v from './picker.rider.validation';
import * as ctrl from './picker.controller';

const router = Router();
const authed = [authenticatePicker];
const active = [authenticatePicker, requireActivePicker];
const riderAuthed = [authenticatePicker, requireWorkforceRole('rider')];
const pickerAuthed = [authenticatePicker, requireWorkforceRole('picker')];

// â”€â”€â”€ Auth (public) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/auth/check-account', validate(v.checkAccountSchema), ctrl.checkAccount);
router.post('/auth/check-registration', validate(v.checkRegistrationSchema), ctrl.checkRegistration);
router.post('/auth/send-registration-otp', validate(v.sendRegistrationOtpSchema), ctrl.sendRegistrationOtp);
router.post('/auth/resend-registration-otp', validate(v.sendRegistrationOtpSchema), ctrl.resendRegistrationOtp);
router.post('/auth/verify-registration-otp', validate(v.verifyRegistrationOtpSchema), ctrl.verifyRegistrationOtp);
router.post('/auth/send-otp', validate(v.sendOtpSchema), ctrl.sendOtp);
router.post('/auth/resend-otp', validate(v.sendOtpSchema), ctrl.resendOtp);
router.post('/auth/verify-otp', validate(v.verifyOtpSchema), ctrl.verifyOtp);
router.post('/auth/send-otp-email', validate(v.sendOtpEmailSchema), ctrl.sendOtpEmail);
router.post('/auth/resend-otp-email', validate(v.sendOtpEmailSchema), ctrl.resendOtpEmail);
router.post('/auth/verify-otp-email', validate(v.verifyOtpEmailSchema), ctrl.verifyOtpEmail);
router.post('/auth/logout', ...authed, ctrl.logout);
router.post('/auth/refresh', ...authed, ctrl.refreshToken);

// â”€â”€â”€ Config / legal / FAQ (public) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/config', validate(v.appConfigQuerySchema, 'query'), ctrl.getPublicConfig);
router.get('/config/cancel-reasons', ...authed, validate(v.cancelReasonsQuerySchema, 'query'), ctrl.getCancelReasons);
router.get('/legal/config', ctrl.getLegalConfig);
router.get('/legal/terms', validate(v.legalQuerySchema, 'query'), ctrl.getLegalTerms);
router.get('/legal/privacy', validate(v.legalQuerySchema, 'query'), ctrl.getLegalPrivacy);
router.get('/faq', validate(v.listFaqQuerySchema, 'query'), ctrl.listFAQ);

// â”€â”€â”€ Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/user/profile/link-status', ...pickerAuthed, ctrl.getLinkStatus);
router.get('/user/profile/contract', ...pickerAuthed, ctrl.getUserContract);
router.put('/user/profile/contract', ...pickerAuthed, ctrl.updateUserContract);
router.get('/user/profile/employment', ...pickerAuthed, ctrl.getEmployment);
router.put('/user/profile/employment', ...pickerAuthed, ctrl.updateEmployment);
router.get('/user/profile/overview', ...pickerAuthed, ctrl.getProfileOverview);
router.get('/user/profile', ...pickerAuthed, ctrl.getProfile);
router.put('/user/profile', ...pickerAuthed, validate(v.workforceUpdateProfileSchema), ctrl.updateProfile);
router.put('/user/location-type', ...pickerAuthed, validate(v.setLocationTypeSchema), ctrl.setLocationType);
router.put('/user/upi', ...pickerAuthed, validate(v.setUpiSchema), ctrl.setUpi);
router.get('/profile', ...riderAuthed, ctrl.getRiderProfile);
router.put('/profile', ...riderAuthed, validate(v.updateProfileSchema), ctrl.updateRiderProfile);

// â”€â”€â”€ Onboarding â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/onboarding/state', authenticatePickerAllowSuspended, ctrl.getOnboardingState);
router.post('/onboarding/submit', ...authed, validate(v.submitOnboardingSchema), ctrl.submitOnboarding);
router.post('/onboarding/kit-ack', ...authed, validate(v.kitAckSchema), ctrl.acknowledgeKit);

// â”€â”€â”€ Shifts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/shifts/available', ...authed, validate(v.listShiftsQuerySchema, 'query'), ctrl.listAvailableShifts);
router.get('/shifts/readiness', ...authed, ctrl.getShiftReadiness);
router.get('/shifts/my', ...authed, ctrl.getMyShifts);
router.post('/shifts/select', ...authed, validate(v.selectShiftSchema), ctrl.selectShift);
router.post('/shifts/deselect', ...authed, validate(v.deselectShiftSchema), ctrl.deselectShift);
router.post('/shifts/start', ...active, validate(v.startShiftSchema), ctrl.startShift);
router.post('/shifts/end', ...active, validate(v.endShiftSchema), ctrl.endShift);
router.post('/shifts/go-online', ...active, validate(v.goOnlineSchema), ctrl.goOnline);
router.post('/shifts/go-offline', ...active, validate(v.goOfflineSchema), ctrl.goOffline);
router.post('/shifts/:shiftId/start', ...active, validate(v.startShiftSchema), ctrl.startShift);
router.post('/shifts/:shiftId/end', ...active, validate(v.endShiftSchema), ctrl.endShift);
router.post('/shifts/break/start', ...active, ctrl.startBreak);
router.post('/shifts/break/end', ...active, ctrl.endBreak);

// â”€â”€â”€ Attendance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/attendance/summary', ...authed, validate(v.attendanceQuerySchema, 'query'), ctrl.getAttendanceSummary);
router.get('/attendance/stats', ...authed, validate(v.attendanceQuerySchema, 'query'), ctrl.getAttendanceStats);
router.post('/attendance/punch-in', ...active, ctrl.punchIn);
router.post('/attendance/punch-out', ...active, ctrl.punchOut);
router.get('/attendance', ...authed, validate(v.attendanceQuerySchema, 'query'), ctrl.getAttendance);

// â”€â”€â”€ Dashboard / incentives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Home is the landing tab for any signed-in picker (including PENDING users the
// app routes to Main). Shift start / punch-in still require an ACTIVE account.
router.get('/home/summary', ...authed, validate(v.homeSummaryQuerySchema, 'query'), ctrl.getHomeSummary);
router.get('/dashboard/today', ...active, validate(v.dayQuerySchema, 'query'), ctrl.getDashboardToday);
router.get('/incentives/today', ...active, validate(v.dayQuerySchema, 'query'), ctrl.getIncentivesToday);

// â”€â”€â”€ Wallet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/wallet/balance', ...authed, ctrl.getWalletBalance);
router.get('/wallet/earnings-breakdown', ...authed, validate(v.earningsSummaryQuerySchema, 'query'), ctrl.getEarningsBreakdown);
router.get('/wallet/history', ...authed, validate(v.dailyEarningsQuerySchema, 'query'), ctrl.getWalletHistory);
router.get('/wallet/transactions/:transactionId', ...authed, ctrl.getTransactionById);
router.get('/wallet/withdrawal-requests/:requestId', ...authed, ctrl.getWithdrawalRequest);
router.get('/wallet/transactions', ...authed, validate(v.walletTransactionsQuerySchema, 'query'), ctrl.getTransactions);
router.get('/wallet', ...authed, ctrl.getWallet);
router.post('/wallet/withdraw', ...authed, validate(v.withdrawSchema), ctrl.requestWithdrawal);
router.post('/wallet/deposit', ...active, validate(v.recordDepositSchema), ctrl.recordCashDeposit);

// â”€â”€â”€ Floating cash â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/cash/summary', ...active, ctrl.getCashSummary);
router.get('/cash/transactions', ...active, validate(v.cashTransactionsQuerySchema, 'query'), ctrl.listCashTransactions);
router.post('/cash/deposits', ...active, validate(v.recordDepositSchema), ctrl.recordCashDeposit);

// â”€â”€â”€ Documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/documents/upload', ...authed, pickerDocumentUpload, pickerUploadErrorHandler, ctrl.uploadDocument);
router.get('/documents', ...authed, ctrl.listDocuments);
router.post('/documents', ...authed, pickerDocumentUpload, pickerUploadErrorHandler, validate(v.uploadDocumentSchema), ctrl.uploadDocument);
router.post('/uploads', ...authed, pickerDocumentUpload, pickerUploadErrorHandler, ctrl.uploadFile);

// â”€â”€â”€ Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/notifications', ...authed, ctrl.getNotifications);
router.put('/notifications/read-all', ...authed, ctrl.markAllNotificationsRead);
router.put('/notifications/:notificationId/read', ...authed, ctrl.markNotificationRead);

// â”€â”€â”€ Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/settings/preferences', ...authed, ctrl.getPreferences);
router.put('/settings/preferences', ...authed, validate(v.updatePreferencesSchema), ctrl.updatePreferences);

// â”€â”€â”€ Bank Accounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/bank/verify', ...authed, validate(v.verifyBankSchema), ctrl.verifyBankAccount);
router.get('/bank/accounts', ...authed, ctrl.listBankAccounts);
router.post('/bank/accounts', ...authed, validate(v.addBankAccountSchema), ctrl.addBankAccount);
router.put('/bank/accounts/:accountId', ...authed, ctrl.updateBankAccount);
router.put('/bank/accounts/:accountId/set-default', ...authed, ctrl.setBankAccountDefault);
router.post('/bank/accounts/:accountId/delete', ...authed, ctrl.deleteBankAccount);
router.get('/bank-accounts', ...authed, ctrl.listBankAccounts);
router.post('/bank-accounts', ...authed, ctrl.addBankAccount);

// â”€â”€â”€ Training â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/training/videos', ctrl.listTrainingVideos);
router.get('/training/videos/:videoId', ...authed, ctrl.getTrainingVideoById);
router.put('/training/watch-progress', ...authed, validate(v.updateTrainingProgressSchema), ctrl.trackWatchProgress);
router.post('/training/complete/:videoId', ...authed, ctrl.completeTrainingVideo);
router.post('/training/modules/:moduleId/complete', ...authed, ctrl.completeTrainingModule);
router.get('/training/user-progress', ...authed, ctrl.getTrainingUserProgress);
router.get('/training/progress', ...authed, ctrl.getTrainingProgress);
router.put('/training/progress', ...authed, validate(v.updateTrainingProgressSchema), ctrl.updateTrainingProgress);
router.post('/training/assessment', ...authed, ctrl.submitTrainingAssessment);

// â”€â”€â”€ Work Locations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/work-locations', validate(v.listWorkLocationsQuerySchema, 'query'), ctrl.listWorkLocations);

// â”€â”€â”€ Locations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/locations/current', ...authed, ctrl.getCurrentLocation);
router.post('/locations/nearest', ...authed, ctrl.getNearestLocation);
router.post('/locations/validate', ...authed, ctrl.validateLocation);
router.post('/locations/set', ...authed, ctrl.setUserLocation);
router.post('/locations/track', ...authed, validate(v.trackLocationSchema), ctrl.trackUserLocation);
router.post('/locations/ensure-darkstore-verification', ...authed, ctrl.ensureDarkstoreVerification);
router.post('/locations/set-darkstore-from-current', ...authed, ctrl.setDarkstoreFromCurrentLocation);
router.post('/locations/save-darkstore-gps', ...authed, ctrl.saveDarkstoreGps);
router.get('/stores/nearby', ...authed, validate(v.listWorkLocationsQuerySchema, 'query'), ctrl.getStoresNearby);
router.get('/locations/:locationId', ...authed, ctrl.getLocationById);
router.get('/locations', ...authed, ctrl.getLocations);

// â”€â”€â”€ Performance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/performance/summary', ...authed, ctrl.getPerformanceSummary);
router.get('/performance/history', ...authed, ctrl.getPerformanceHistory);
router.get('/performance', ...authed, ctrl.getPerformance);

// â”€â”€â”€ Dark Store Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/dark-store-login', ...authed, ctrl.registerAtDarkStore);
router.get('/store-otp', ...authed, ctrl.getStoreOtp);

// â”€â”€â”€ Devices â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/devices/assigned', ...authed, ctrl.getAssignedDevice);
router.post('/devices/collection-complete', ...authed, ctrl.acknowledgeDeviceCollection);
router.post('/devices/upload-condition-photo', ...authed, ctrl.uploadDeviceConditionPhoto);
router.post('/devices/return', ...authed, ctrl.returnDevice);

// â”€â”€â”€ Manager â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/manager/request-otp', ...authed, ctrl.requestManagerOtp);
router.post('/manager/verify-otp', ...authed, validate(v.managerOtpSchema), ctrl.verifyManagerOtp);

// â”€â”€â”€ Approval â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/approval/verify-location-otp', ...authed, ctrl.verifyLocationOtp);

// â”€â”€â”€ Heartbeat / presence / push â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/heartbeat', ...authed, ctrl.postHeartbeat);
router.post('/presence/ping', ...authed, ctrl.postPresencePing);
router.post('/push-token', ...authed, validate(v.registerPushTokenSchema), ctrl.registerPushToken);

// â”€â”€â”€ Account â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/account/delete-request', ...authed, validate(v.deleteAccountSchema), ctrl.requestAccountDeletion);

// â”€â”€â”€ Samples â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/samples', ctrl.listSamples);
router.get('/samples/:id', ctrl.getSampleById);
router.post('/samples', ctrl.createSample);

// NOTE: Legacy duplicate wallet/bulk registrations referencing undefined handlers
// (depositCash, startBulkDelivery, markBulkStop*) were removed. Canonical routes:
// POST /wallet/deposit (above), and /bulk/* block below with validation + active gate.


// â”€â”€â”€ Shared Orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/shared-orders/completed', ...active, validate(v.deliveryHistoryQuerySchema, 'query'), ctrl.getCompletedSharedOrders);
router.get('/shared-orders/assignorders', ...active, validate(v.listAvailableOrdersQuerySchema, 'query'), ctrl.getAssignOrders);
router.post('/shared-orders/:orderId/proof-photo', ...active, pickerPhotoUpload, pickerUploadErrorHandler, validate(v.orderIdParamSchema, 'params'), validate(v.proofPhotoSchema), ctrl.uploadOrderProofPhoto);
router.get('/shared-orders/:orderId', ...active, validate(v.orderIdParamSchema, 'params'), ctrl.getSharedOrder);
router.put('/shared-orders/:orderId/status', ...active, validate(v.orderIdParamSchema, 'params'), validate(v.updateOrderStatusSchema), ctrl.updateSharedOrderStatus);
router.post('/shared-orders/:orderId/complete', ...active, validate(v.orderIdParamSchema, 'params'), validate(v.completeOrderSchema), ctrl.completeSharedOrder);
router.get('/shared-orders', ...active, validate(v.listAvailableOrdersQuerySchema, 'query'), ctrl.getSharedOrders);

// â”€â”€â”€ Bulk delivery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/bulk/batch', ...active, validate(v.bulkBatchQuerySchema, 'query'), ctrl.getBulkBatch);
router.post('/bulk/bag/load', ...active, validate(v.loadBagSchema), ctrl.loadBulkBag);
router.post('/bulk/start', ...active, validate(v.startBulkSchema), ctrl.startBulkBatch);
router.post('/bulk/stops/:stopId/arrive', ...active, validate(v.stopIdParamSchema, 'params'), validate(v.arriveStopSchema), ctrl.arriveBulkStop);
router.post('/bulk/stops/:stopId/proof-photo', ...active, pickerPhotoUpload, pickerUploadErrorHandler, validate(v.stopIdParamSchema, 'params'), validate(v.proofPhotoSchema), ctrl.uploadBulkStopPhoto);
router.post('/bulk/stops/:stopId/deliver', ...active, validate(v.stopIdParamSchema, 'params'), validate(v.deliverStopSchema), ctrl.deliverBulkStop);
router.post('/bulk/stops/:stopId/fail', ...active, validate(v.stopIdParamSchema, 'params'), validate(v.failStopSchema), ctrl.failBulkStop);
router.get('/bulk/batches/:batchId', ...active, validate(v.batchIdParamSchema, 'params'), ctrl.getBulkBatchDetail);
router.get('/bulk/batches', ...active, validate(v.listBulkBatchesQuerySchema, 'query'), ctrl.listBulkBatches);

// â”€â”€â”€ Issues â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/issues', ...authed, validate(v.reportIssueSchema), ctrl.reportIssue);

// â”€â”€â”€ Verify â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/verify/face', ...authed, validate(v.faceVerifySchema), ctrl.verifyFace);

// â”€â”€â”€ Didit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/didit/session', ...authed, ctrl.createDiditSession);
router.get('/didit/status', ...authed, ctrl.getDiditStatus);
router.post('/didit/webhook', ctrl.handleDiditWebhook);

// â”€â”€â”€ Support â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/support/tickets', ...authed, validate(v.listTicketsQuerySchema, 'query'), ctrl.listSupportTickets);
router.post('/support/tickets', ...authed, validate(v.createTicketSchema), ctrl.createSupportTicket);
router.get('/support/chat/messages', ...authed, validate(v.chatMessagesQuerySchema, 'query'), ctrl.getChatMessages);
router.post('/support/chat/messages', ...authed, validate(v.sendChatMessageSchema), ctrl.sendChatMessage);

export const pickerRouter = router;

// â”€â”€â”€ Admin Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const adminRouter = Router();

// Picker listing and approvals
adminRouter.get('/approvals', authenticateAdmin, ctrl.adminListPickers);
adminRouter.post('/approvals/:id/decision', authenticateAdmin, ctrl.adminDecidePickerApproval);
adminRouter.get('/pickers', authenticateAdmin, ctrl.adminListPickers);
adminRouter.put('/pickers/:pickerId/approve', authenticateAdmin, ctrl.adminApprovePicker);
adminRouter.put('/pickers/:pickerId/reject', authenticateAdmin, ctrl.adminRejectPicker);
adminRouter.patch('/pickers/:id/status', authenticateAdmin, ctrl.adminUpdatePickerStatus);
adminRouter.patch('/pickers/:pickerId/assignment', authenticateAdmin, ctrl.adminUpdateAssignment);
adminRouter.post('/pickers/:pickerId/push', authenticateAdmin, ctrl.adminSendPickerPush);
adminRouter.get('/pickers/:id/action-logs', authenticateAdmin, ctrl.adminGetPickerActionLogs);
adminRouter.get('/pickers/:id/training-progress', authenticateAdmin, ctrl.adminGetPickerTrainingProgress);
adminRouter.get('/pickers/:id/face-verification', authenticateAdmin, ctrl.adminGetFaceVerification);
adminRouter.post('/pickers/:id/link-hhd', authenticateAdmin, ctrl.adminLinkHHD);
adminRouter.delete('/pickers/:id/link-hhd', authenticateAdmin, ctrl.adminUnlinkHHD);
adminRouter.patch('/pickers/:id/documents/review', authenticateAdmin, ctrl.adminReviewDocument);
adminRouter.patch('/pickers/:id/bank/:accountId/review', authenticateAdmin, ctrl.adminReviewBankAccount);
adminRouter.patch('/pickers/:id/upi/review', authenticateAdmin, ctrl.adminReviewUpiPayout);
adminRouter.patch('/pickers/:id/face-verification/override', authenticateAdmin, ctrl.adminOverrideFaceVerification);
adminRouter.get('/pickers/:id', authenticateAdmin, ctrl.adminGetPickerById);

// Payout method verification (bank + UPI)
adminRouter.get('/payout-verifications', authenticateAdmin, ctrl.adminListPayoutVerifications);

// Withdrawals
adminRouter.get('/withdrawals', authenticateAdmin, ctrl.adminListWithdrawals);
adminRouter.put('/withdrawals/:requestId/process', authenticateAdmin, ctrl.adminProcessWithdrawal);

// Attendance
adminRouter.get('/attendance/export', authenticateAdmin, ctrl.adminExportAttendance);
adminRouter.get('/attendance/live', authenticateAdmin, ctrl.adminLiveAttendance);
adminRouter.get('/attendance', authenticateAdmin, ctrl.adminGetAttendanceByMonth);

// Devices
adminRouter.get('/devices', authenticateAdmin, ctrl.adminListDevices);
adminRouter.post('/devices/assign', authenticateAdmin, ctrl.adminAssignDevice);
adminRouter.delete('/devices/:deviceId/unassign', authenticateAdmin, ctrl.adminUnassignDevice);

// Documents
adminRouter.put('/documents/:documentId/review', authenticateAdmin, ctrl.adminReviewDocument);

// Agencies
adminRouter.get('/agencies', authenticateAdmin, ctrl.adminListAgencies);
adminRouter.post('/agencies', authenticateAdmin, ctrl.adminCreateAgency);
adminRouter.post('/agencies/:agencyId/deactivate', authenticateAdmin, ctrl.adminDeactivateAgency);
adminRouter.post('/agencies/:agencyId/activate', authenticateAdmin, ctrl.adminActivateAgency);

// Store shift slots
adminRouter.get('/stores/:storeId/shift-slots', authenticateAdmin, ctrl.adminListStoreShiftSlots);
adminRouter.post('/stores/:storeId/shift-slots', authenticateAdmin, ctrl.adminCreateStoreShiftSlot);

// OT requests
adminRouter.get('/ot-requests', authenticateAdmin, ctrl.adminListOtRequests);
adminRouter.post('/ot-requests/:requestId/decision', authenticateAdmin, ctrl.adminDecideOtRequest);

// Shift change requests
adminRouter.get('/shift-change-requests', authenticateAdmin, ctrl.adminListShiftChangeRequests);
adminRouter.post('/shift-change-requests/:requestId/decision', authenticateAdmin, ctrl.adminDecideShiftChangeRequest);

// Shift reassign
adminRouter.post('/shifts/:shiftId/reassign', authenticateAdmin, ctrl.adminReassignPickerShift);

export { adminRouter as pickerAdminRouter };
export default pickerRouter;
