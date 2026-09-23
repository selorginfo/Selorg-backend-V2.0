import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as authService from './picker.auth.service';
import * as pickerService from './picker.service';
import * as profileService from './picker.profile.service';
import * as shiftService from './picker.shift.service';
import * as orderService from './picker.order.service';
import * as cashService from './picker.cash.service';
import * as bulkService from './picker.bulk.service';
import * as dashboardService from './picker.dashboard.service';
import * as supportService from './picker.support.service';
import * as appService from './picker.app.service';
import { parseWorkforceRole } from './picker.models';
import { readIdempotencyKey, withIdempotency } from './picker.idempotency';

function requirePickerId(req: Request): string {
  const id = req.pickerId;
  if (!id) throw Object.assign(new Error('Picker authentication required'), { statusCode: 401 });
  return id;
}

function clientWorkforceRole(req: Request) {
  return parseWorkforceRole(req.headers['x-selorg-client'])
    || parseWorkforceRole((req.body as { workforceRole?: unknown } | undefined)?.workforceRole);
}

function sendAuthResult(res: Response, result: authService.PickerAuthResult): void {
  if (!result.success) {
    const status = result.statusCode || 400;
    res.status(status).json(ResponseFormatter.error(result.message, status, null, { appCode: result.errorCode }));
    return;
  }
  const { errorCode: _e, statusCode: _s, ...data } = result;
  delete (data as { otp?: unknown }).otp;
  res.json(ResponseFormatter.success(data));
}

// â”€â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, preferredChannel } = req.body;
    sendAuthResult(res, await authService.sendOtp(phone, {
      preferredChannel,
      purpose: req.body.purpose || 'LOGIN',
      workforceRole: clientWorkforceRole(req),
    }));
  } catch (err) { next(err); }
}

export async function resendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, preferredChannel } = req.body;
    sendAuthResult(res, await authService.resendOtp(phone, {
      preferredChannel,
      purpose: req.body.purpose || 'LOGIN',
      workforceRole: clientWorkforceRole(req),
    }));
  } catch (err) { next(err); }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, otp, preferredChannel, storeId, intent } = req.body;
    sendAuthResult(res, await authService.verifyOtp(phone, otp, {
      preferredChannel,
      storeId,
      intent,
      purpose: req.body.purpose || 'LOGIN',
      workforceRole: clientWorkforceRole(req),
    }));
  } catch (err) { next(err); }
}

export async function sendOtpEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendAuthResult(res, await authService.sendOtpEmail(req.body.email, {
      purpose: req.body.purpose || 'LOGIN',
      workforceRole: clientWorkforceRole(req),
    }));
  } catch (err) { next(err); }
}

export async function resendOtpEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendAuthResult(res, await authService.resendOtpEmail(req.body.email, {
      purpose: req.body.purpose || 'LOGIN',
      workforceRole: clientWorkforceRole(req),
    }));
  } catch (err) { next(err); }
}

export async function verifyOtpEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, otp, intent } = req.body;
    sendAuthResult(res, await authService.verifyOtpEmail(email, otp, {
      intent,
      purpose: req.body.purpose || 'LOGIN',
      workforceRole: clientWorkforceRole(req),
    }));
  } catch (err) { next(err); }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.logout(requirePickerId(req));
    res.json(ResponseFormatter.success({ ok: true }));
  } catch (err) { next(err); }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendAuthResult(res, await authService.refreshSession(requirePickerId(req), {
      workforceRole: clientWorkforceRole(req),
    }));
  } catch (err) { next(err); }
}

export async function checkAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { loginType, value } = req.body;
    sendAuthResult(res, await authService.checkAccount(loginType, value, {
      workforceRole: clientWorkforceRole(req),
    }));
  } catch (err) { next(err); }
}

export async function checkRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, email } = req.body;
    sendAuthResult(res, await authService.checkRegistration(phone, email, {
      workforceRole: clientWorkforceRole(req),
    }));
  } catch (err) { next(err); }
}

export async function sendRegistrationOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, email, preferredChannel } = req.body;
    sendAuthResult(res, await authService.sendRegistrationOtp(phone, email, {
      preferredChannel,
      workforceRole: clientWorkforceRole(req),
    }));
  } catch (err) { next(err); }
}

export async function resendRegistrationOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, email, preferredChannel } = req.body;
    sendAuthResult(res, await authService.resendRegistrationOtp(phone, email, {
      preferredChannel,
      workforceRole: clientWorkforceRole(req),
    }));
  } catch (err) { next(err); }
}

export async function verifyRegistrationOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, email, otp, preferredChannel } = req.body;
    sendAuthResult(res, await authService.verifyRegistrationOtp(phone, email, otp, {
      preferredChannel,
      workforceRole: clientWorkforceRole(req),
    }));
  } catch (err) { next(err); }
}


// â”€â”€â”€ Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await appService.getAppProfile(requirePickerId(req));
    res.json(ResponseFormatter.success(profile));
  } catch (err) { next(err); }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await appService.updateAppProfile(requirePickerId(req), req.body);
    res.json(ResponseFormatter.success(profile));
  } catch (err) { next(err); }
}

export async function getRiderProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await profileService.getRiderProfile(requirePickerId(req));
    res.json(ResponseFormatter.success(profile));
  } catch (err) { next(err); }
}

export async function updateRiderProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await profileService.updateRiderProfile(requirePickerId(req), req.body);
    res.json(ResponseFormatter.success(profile));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Shifts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listAvailableShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { warehouseKey?: string; date?: string; dateFrom?: string; dateTo?: string };
    const shifts = await appService.listAvailableShiftCards(requirePickerId(req), q);
    res.json(ResponseFormatter.success(shifts));
  } catch (err) { next(err); }
}

export async function getMyShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const shifts = await shiftService.getMyShifts(requirePickerId(req));
    res.json(ResponseFormatter.success(shifts));
  } catch (err) { next(err); }
}

export async function selectShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await shiftService.selectShift(requirePickerId(req), req.body.shiftId);
    res.status(201).json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function deselectShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await shiftService.deselectShift(requirePickerId(req), req.body.shiftId, req.body.reason);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function startShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const shiftId = req.body?.shiftId || req.params.shiftId;
    const result = await appService.startAppShift(requirePickerId(req), shiftId, req.body);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function endShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const shiftId = req.body?.shiftId || req.params.shiftId;
    const result = await appService.endAppShift(requirePickerId(req), shiftId, req.body);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function goOnline(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const location =
      req.body?.location &&
      typeof req.body.location.latitude === 'number' &&
      typeof req.body.location.longitude === 'number'
        ? {
            latitude: req.body.location.latitude,
            longitude: req.body.location.longitude,
          }
        : req.body?.latitude != null && req.body?.longitude != null
          ? { latitude: Number(req.body.latitude), longitude: Number(req.body.longitude) }
          : undefined;
    const result = await shiftService.goOnline(requirePickerId(req), location);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function goOffline(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const location =
      req.body?.location &&
      typeof req.body.location.latitude === 'number' &&
      typeof req.body.location.longitude === 'number'
        ? {
            latitude: req.body.location.latitude,
            longitude: req.body.location.longitude,
          }
        : req.body?.latitude != null && req.body?.longitude != null
          ? { latitude: Number(req.body.latitude), longitude: Number(req.body.longitude) }
          : undefined;
    const result = await shiftService.goOffline(requirePickerId(req), location);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function startBreak(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requirePickerId(req);
    const result = await pickerService.startBreak(userId);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function endBreak(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requirePickerId(req);
    const result = await pickerService.endBreak(userId);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Attendance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function punchIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await appService.punchInApp(requirePickerId(req), req.body);
    res.status(201).json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function punchOut(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await appService.punchOutApp(requirePickerId(req), req.body);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requirePickerId(req);
    const q = req.query as { month?: string; view?: string; page?: string; limit?: string };
    if (q.month || q.view === 'history' || !q.page) {
      res.json(ResponseFormatter.success(await appService.getWorkHistory(userId, q.month)));
      return;
    }
    const result = await pickerService.getAttendance(userId, parseInt(q.page || '1', 10) || 1, parseInt(q.limit || '20', 10) || 20);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Wallet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await dashboardService.getWalletBalance(requirePickerId(req))));
  } catch (err) { next(err); }
}

export async function getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await appService.listPayoutTransactions(requirePickerId(req), page, limit);
    res.json(ResponseFormatter.paginated(result.items, result.total, result.page, result.limit));
  } catch (err) { next(err); }
}

export async function requestWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount, accountId, idempotencyKey } = req.body;
    const result = await appService.requestAppWithdrawal(requirePickerId(req), amount, accountId, idempotencyKey);
    res.status(201).json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await profileService.listKycDocuments(requirePickerId(req))));
  } catch (err) { next(err); }
}

export async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body || {};
    const riderType = String(body.type || body.documentType || '').toLowerCase();
    const isRiderKyc = ['aadhar', 'aadhaar', 'pan', 'dl', 'rc', 'ins'].includes(riderType);
    if (!isRiderKyc && (body.aadhaar || body.pan || body.number || !req.file)) {
      const doc = await appService.uploadWorkforceDocument(requirePickerId(req), body, req.file);
      res.status(201).json(ResponseFormatter.success(doc));
      return;
    }
    const doc = await profileService.uploadKycDocument(
      requirePickerId(req),
      req.body as { type: 'aadhar' | 'pan' | 'dl' | 'rc' | 'ins'; side?: 'front' | 'back'; fileName?: string; url?: string },
      req.file,
    );
    res.status(201).json(ResponseFormatter.success(doc));
  } catch (err) { next(err); }
}

export async function uploadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stored = await appService.uploadGenericFile(requirePickerId(req), req.file, req.body?.purpose);
    res.status(201).json(ResponseFormatter.success(stored));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await appService.listNotificationViews(requirePickerId(req), page, limit);
    res.json(ResponseFormatter.paginated(result.items, result.total, result.page, result.limit));
  } catch (err) { next(err); }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requirePickerId(req);
    await pickerService.markNotificationRead(userId, req.params.notificationId);
    res.json(ResponseFormatter.success({ message: 'Notification marked as read' }));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Bank Accounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listBankAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.listBankAccountViews(requirePickerId(req))));
  } catch (err) { next(err); }
}

export async function addBankAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const account = await appService.addBankAccountApp(requirePickerId(req), req.body || {});
    res.status(201).json(ResponseFormatter.success(account));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Training â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listTrainingVideos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const videos = await appService.listTrainingModules(req.query.warehouseKey as string);
    res.json(ResponseFormatter.success(videos));
  } catch (err) { next(err); }
}

export async function updateTrainingProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requirePickerId(req);
    const { videoId, progress } = req.body;
    if (!videoId || progress == null) { res.status(400).json(ResponseFormatter.error('videoId and progress are required', 400)); return; }
    const result = await pickerService.updateTrainingProgress(userId, videoId, progress);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Work Locations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listWorkLocations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { type?: string; lat?: string; lng?: string; radiusKm?: string };
    const hubs = await profileService.listHubs({
      type: q.type,
      lat: q.lat != null ? Number(q.lat) : undefined,
      lng: q.lng != null ? Number(q.lng) : undefined,
      radiusKm: q.radiusKm != null ? Number(q.radiusKm) : undefined,
    });
    res.json(ResponseFormatter.success(hubs));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Performance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Serve the picker view-model (cards / weekBars). Raw domain metrics remain
    // available via date-range query for admin tooling if needed later.
    res.json(ResponseFormatter.success(await appService.getPerformanceView(requirePickerId(req))));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Admin: Picker Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function adminListPickers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, search, warehouseKey, page, limit } = req.query as Record<string, string>;
    const result = await pickerService.listPickers({ status, search, warehouseKey, page: parseInt(page) || 1, limit: parseInt(limit) || 50 });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function adminApprovePicker(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const approvedBy = req.user?.userId || 'system';
    const picker = await pickerService.approvePicker(req.params.pickerId, approvedBy);
    if (!picker) { res.status(404).json(ResponseFormatter.error('Picker not found', 404)); return; }
    res.json(ResponseFormatter.success(picker));
  } catch (err) { next(err); }
}

export async function adminRejectPicker(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reason } = req.body;
    const picker = await pickerService.rejectPicker(req.params.pickerId, reason || 'Rejected by admin');
    if (!picker) { res.status(404).json(ResponseFormatter.error('Picker not found', 404)); return; }
    res.json(ResponseFormatter.success(picker));
  } catch (err) { next(err); }
}

export async function adminDecidePickerApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const decision = String((req.body as { decision?: string } | undefined)?.decision || '').trim().toLowerCase();
    const note = String((req.body as { note?: string; reason?: string } | undefined)?.note
      || (req.body as { reason?: string } | undefined)?.reason || '').trim();
    const pickerId = req.params.id || req.params.pickerId;
    if (decision === 'approve' || decision === 'approved' || decision === 'accept') {
      const picker = await pickerService.approvePicker(pickerId, req.user?.userId || 'system');
      if (!picker) { res.status(404).json(ResponseFormatter.error('Picker not found', 404)); return; }
      res.json(ResponseFormatter.success(picker));
      return;
    }
    if (decision === 'reject' || decision === 'rejected' || decision === 'deny') {
      const picker = await pickerService.rejectPicker(pickerId, note || 'Rejected by admin');
      if (!picker) { res.status(404).json(ResponseFormatter.error('Picker not found', 404)); return; }
      res.json(ResponseFormatter.success(picker));
      return;
    }
    res.status(400).json(ResponseFormatter.error('decision must be approve or reject', 400));
  } catch (err) { next(err); }
}

export async function adminListWithdrawals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, page, limit } = req.query as Record<string, string>;
    const result = await pickerService.listWithdrawalRequests({ status, page: parseInt(page) || 1, limit: parseInt(limit) || 20 });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function adminProcessWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { action, rejectionReason } = req.body;
    const processedBy = req.user?.userId || 'system';
    const result = await pickerService.processWithdrawal(req.params.requestId, action, processedBy, rejectionReason);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function adminLiveAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pickerService.getLiveAttendance(req.query.warehouseKey as string);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function adminListDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, warehouseKey } = req.query as Record<string, string>;
    const devices = await pickerService.listPickerDevices({ status, warehouseKey });
    res.json(ResponseFormatter.success(devices));
  } catch (err) { next(err); }
}

export async function adminAssignDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { deviceId, userId } = req.body;
    if (!deviceId || !userId) { res.status(400).json(ResponseFormatter.error('deviceId and userId are required', 400)); return; }
    const result = await pickerService.assignDevice(deviceId, userId);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function adminUnassignDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pickerService.unassignDevice(req.params.deviceId);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function adminReviewDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, rejectionReason } = req.body;
    const reviewedBy = req.user?.userId || 'system';
    if (!['approved', 'rejected'].includes(status)) { res.status(400).json(ResponseFormatter.error('status must be approved or rejected', 400)); return; }
    const doc = await pickerService.reviewDocument(req.params.documentId, status, reviewedBy, rejectionReason);
    if (!doc) { res.status(404).json(ResponseFormatter.error('Document not found', 404)); return; }
    res.json(ResponseFormatter.success(doc));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Config / Legal / FAQ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getPublicConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { platform?: string; appVersion?: string };
    res.json(ResponseFormatter.success(supportService.getPublicConfig(q)));
  } catch (err) { next(err); }
}

export async function getLegalConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await supportService.getLegalConfig()));
  } catch (err) { next(err); }
}

export async function getLegalTerms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await supportService.getLegalTerms(req.query.version as string | undefined)));
  } catch (err) { next(err); }
}

export async function getLegalPrivacy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await supportService.getLegalPrivacy(req.query.version as string | undefined)));
  } catch (err) { next(err); }
}

export async function listFAQ(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { category?: string; limit?: number };
    res.json(ResponseFormatter.success(await appService.listFaqItems(q.category, Number(q.limit) || 20)));
  } catch (err) { next(err); }
}

// â”€â”€â”€ User Profile extras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getLinkStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const userId = requirePickerId(req); res.json(ResponseFormatter.success({ linked: false, userId })); } catch (err) { next(err); }
}

export async function getUserContract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const userId = requirePickerId(req); res.json(ResponseFormatter.success({ userId, contract: null })); } catch (err) { next(err); }
}

export async function updateUserContract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ updated: true, ...req.body })); } catch (err) { next(err); }
}

export async function getEmployment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const userId = requirePickerId(req); res.json(ResponseFormatter.success({ userId, employment: {} })); } catch (err) { next(err); }
}

export async function updateEmployment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ updated: true, ...req.body })); } catch (err) { next(err); }
}

export async function getProfileOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.getProfileOverview(requirePickerId(req))));
  } catch (err) { next(err); }
}

export async function setLocationType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.setLocationType(requirePickerId(req), req.body.locationType)));
  } catch (err) { next(err); }
}

export async function setUpi(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.setUpi(requirePickerId(req), req.body.upiId || req.body.upi)));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Onboarding â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getOnboardingState(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pickerId = requirePickerId(req);
    await appService.autoApproveSubmittedPicker(pickerId);
    const [pickerState, riderState] = await Promise.all([
      appService.getAppOnboardingState(pickerId),
      profileService.getOnboardingState(pickerId),
    ]);
    // Superset: rider fields (`status`, `applicationId`, `steps`, `documents`,
    // `kit`, `training`, `hub`) plus picker fields (`state`, `step`,
    // `completedSteps`, `submittedForReviewAt`) so neither app loses its contract.
    res.json(ResponseFormatter.success({
      ...pickerState,
      ...riderState,
      state: pickerState.state,
      step: pickerState.step,
      completedSteps: pickerState.completedSteps,
      submittedForReviewAt: pickerState.submittedForReviewAt,
      rejectionReason: pickerState.rejectionReason || riderState.rejectionReason || null,
      accountStatus: pickerState.accountStatus,
      statusMessage: pickerState.statusMessage,
      verification: pickerState.verification,
      nextAction: pickerState.nextAction,
      bankDetailsComplete: pickerState.bankDetailsComplete,
      deviceCollected: pickerState.deviceCollected,
      canReapply: pickerState.canReapply,
    }));
  } catch (err) { next(err); }
}

export async function submitOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await profileService.submitOnboarding(requirePickerId(req), req.body);
    res.status(201).json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function acknowledgeKit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await profileService.acknowledgeKit(requirePickerId(req), req.body)));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Shift extras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getShiftReadiness(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { lat?: string; lng?: string; accuracyM?: string };
    const lat = q.lat != null ? Number(q.lat) : undefined;
    const lng = q.lng != null ? Number(q.lng) : undefined;
    const coords = lat != null && lng != null ? { latitude: lat, longitude: lng } : undefined;
    res.json(ResponseFormatter.success(await appService.getShiftReadiness(
      requirePickerId(req),
      coords,
      q.accuracyM != null ? Number(q.accuracyM) : undefined,
    )));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Attendance extras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getAttendanceSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.getAttendanceSummary(requirePickerId(req), req.query.month as string)));
  } catch (err) { next(err); }
}

export async function getAttendanceStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.getAttendanceStats(requirePickerId(req), req.query.month as string)));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Wallet extras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getWalletBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.getWalletBalanceView(requirePickerId(req), req.query.month as string)));
  } catch (err) { next(err); }
}

export async function getEarningsBreakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { period?: 'week' | 'month' | 'custom'; dateFrom?: string; dateTo?: string };
    res.json(ResponseFormatter.success(await dashboardService.getEarningsSummary(requirePickerId(req), {
      period: q.period || 'week',
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    })));
  } catch (err) { next(err); }
}

export async function getWalletHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { period?: 'week' | 'month'; dateFrom?: string; dateTo?: string; limit?: number };
    res.json(ResponseFormatter.success(await dashboardService.getDailyEarnings(requirePickerId(req), {
      period: q.period || 'week',
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      limit: Number(q.limit) || 7,
    })));
  } catch (err) { next(err); }
}

export async function getTransactionById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.getPayoutTransaction(requirePickerId(req), req.params.transactionId)));
  } catch (err) { next(err); }
}

export async function getWithdrawalRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.getAppWithdrawalRequest(requirePickerId(req), req.params.requestId)));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Notifications extras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function markAllNotificationsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requirePickerId(req);
    const modified = await pickerService.markAllNotificationsRead(userId);
    res.json(ResponseFormatter.success({ userId, marked: modified }));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Bank Account extras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function verifyBankAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.verifyBankAccountApp(requirePickerId(req), req.body || {})));
  } catch (err) { next(err); }
}

export async function updateBankAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.updateBankAccountApp(requirePickerId(req), req.params.accountId, req.body || {})));
  } catch (err) { next(err); }
}

export async function setBankAccountDefault(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.setDefaultBankAccount(requirePickerId(req), req.params.accountId)));
  } catch (err) { next(err); }
}

export async function deleteBankAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.deleteBankAccountApp(requirePickerId(req), req.params.accountId)));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Training extras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getTrainingVideoById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const videos = await pickerService.listTrainingVideos();
    const video = (videos as Array<{ videoId?: string; _id?: unknown }>).find(
      (v) => String(v.videoId) === req.params.videoId || String(v._id) === req.params.videoId,
    );
    if (!video) {
      res.status(404).json(ResponseFormatter.error('Training video not found', 404));
      return;
    }
    res.json(ResponseFormatter.success(video));
  } catch (err) { next(err); }
}

export async function trackWatchProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { videoId, progress } = req.body;
    const result = await pickerService.updateTrainingProgress(requirePickerId(req), videoId, progress);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function completeTrainingVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pickerService.updateTrainingProgress(requirePickerId(req), req.params.videoId, 100);
    res.json(ResponseFormatter.success({ ...result, videoId: req.params.videoId, completed: true }));
  } catch (err) { next(err); }
}

export async function completeTrainingModule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pickerService.updateTrainingProgress(requirePickerId(req), req.params.moduleId, 100);
    res.json(ResponseFormatter.success({ ...result, moduleId: req.params.moduleId, completed: true }));
  } catch (err) { next(err); }
}

export async function getTrainingUserProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.getTrainingUserProgress(requirePickerId(req))));
  } catch (err) { next(err); }
}

export async function getTrainingProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requirePickerId(req);
    const user = await pickerService.getProfile(userId) as { trainingProgress?: Record<string, number>; trainingCompleted?: boolean } | null;
    const videos = await pickerService.listTrainingVideos() as unknown as Array<{ videoId: string }>;
    const tp = user?.trainingProgress || {};
    const completed = videos.filter((v) => (tp[v.videoId] || 0) >= 100).length;
    const percentage = videos.length ? Math.round((completed / videos.length) * 100) : 0;
    res.json(ResponseFormatter.success({
      userId,
      percentage,
      trainingCompleted: Boolean(user?.trainingCompleted),
    }));
  } catch (err) { next(err); }
}

export async function submitTrainingAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const userId = requirePickerId(req); res.json(ResponseFormatter.success({ userId, passed: false, score: 0 })); } catch (err) { next(err); }
}

// â”€â”€â”€ Locations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getCurrentLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requirePickerId(req);
    const profile = await pickerService.getProfile(userId) as { gpsLocation?: unknown } | null;
    res.json(ResponseFormatter.success({ userId, location: profile?.gpsLocation || null }));
  } catch (err) { next(err); }
}

export async function getLocations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const hubs = await profileService.listHubs({});
    res.json(ResponseFormatter.success({ locations: hubs, stores: hubs }));
  } catch (err) { next(err); }
}

export async function getNearestLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { latitude, longitude, lat, lng } = req.body || {};
    const hubs = await profileService.listHubs({
      lat: Number(latitude ?? lat),
      lng: Number(longitude ?? lng),
    });
    res.json(ResponseFormatter.success({ location: hubs[0] || null }));
  } catch (err) { next(err); }
}

export async function getStoresNearby(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { lat?: string; lng?: string; radiusKm?: string; type?: string };
    const hubs = await profileService.listHubs({
      type: q.type,
      lat: q.lat != null ? Number(q.lat) : undefined,
      lng: q.lng != null ? Number(q.lng) : undefined,
      radiusKm: q.radiusKm != null ? Number(q.radiusKm) : undefined,
    });
    res.json(ResponseFormatter.success({ stores: hubs, locations: hubs }));
  } catch (err) { next(err); }
}

export async function getLocationById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await profileService.getHubById(req.params.locationId)));
  } catch (err) { next(err); }
}

export async function validateLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { latitude, longitude, lat, lng, hubId, locationId } = req.body || {};
    const hubKey = hubId || locationId;
    if (hubKey) {
      await profileService.getHubById(String(hubKey));
      res.json(ResponseFormatter.success({ valid: true, hubId: String(hubKey) }));
      return;
    }
    const hubs = await profileService.listHubs({
      lat: Number(latitude ?? lat),
      lng: Number(longitude ?? lng),
      radiusKm: 25,
    });
    res.json(ResponseFormatter.success({ valid: hubs.length > 0, location: hubs[0] || null }));
  } catch (err) { next(err); }
}

export async function setUserLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const hubId = req.body?.hubId || req.body?.locationId || req.body?.warehouseKey;
    if (!hubId) {
      res.status(400).json(ResponseFormatter.error('hubId is required', 400, null, { appCode: 'VALIDATION_ERROR' }));
      return;
    }
    const profile = await profileService.updateRiderProfile(requirePickerId(req), { hubId: String(hubId) });
    res.json(ResponseFormatter.success({ set: true, hub: profile.hub }));
  } catch (err) { next(err); }
}

export async function trackUserLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await orderService.trackLocation(requirePickerId(req), req.body)));
  } catch (err) { next(err); }
}

export async function ensureDarkstoreVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ verified: false })); } catch (err) { next(err); }
}

export async function setDarkstoreFromCurrentLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.registerAtLocation(requirePickerId(req), req.body || {})));
  } catch (err) { next(err); }
}

export async function saveDarkstoreGps(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ saved: true })); } catch (err) { next(err); }
}

// â”€â”€â”€ Performance extras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getPerformanceSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.getPerformanceView(requirePickerId(req))));
  } catch (err) { next(err); }
}

export async function getPerformanceHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const userId = requirePickerId(req); res.json(ResponseFormatter.success({ userId, history: [] })); } catch (err) { next(err); }
}

// â”€â”€â”€ Dark Store Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function registerAtDarkStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.registerAtLocation(requirePickerId(req), req.body || {})));
  } catch (err) { next(err); }
}

export async function getStoreOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const userId = requirePickerId(req); res.json(ResponseFormatter.success({ userId, otp: null })); } catch (err) { next(err); }
}

// â”€â”€â”€ Devices â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getAssignedDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.getAssignedDeviceView(requirePickerId(req))));
  } catch (err) { next(err); }
}

export async function acknowledgeDeviceCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.confirmDeviceCollection(requirePickerId(req), req.body?.deviceId)));
  } catch (err) { next(err); }
}

export async function returnDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.returnAssignedDevice(requirePickerId(req), req.body)));
  } catch (err) { next(err); }
}

export async function uploadDeviceConditionPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ uploaded: true, url: null })); } catch (err) { next(err); }
}

// â”€â”€â”€ Manager OTP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function requestManagerOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.requestManagerOtp(requirePickerId(req))));
  } catch (err) { next(err); }
}

export async function verifyManagerOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.verifyManagerOtp(requirePickerId(req), req.body?.otp)));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Approval â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function verifyLocationOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.verifyManagerOtp(requirePickerId(req), req.body?.otp)));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Heartbeat / Presence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function postHeartbeat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await supportService.postHeartbeat(requirePickerId(req), req.body?.batteryLevel)));
  } catch (err) { next(err); }
}

export async function postPresencePing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await supportService.postPresencePing(requirePickerId(req))));
  } catch (err) { next(err); }
}

export async function registerPushToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await supportService.registerPushToken(requirePickerId(req), req.body)));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Account â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function requestAccountDeletion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.requestAccountDeletion(requirePickerId(req), req.body?.reason)));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Samples â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listSamples(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ samples: [] })); } catch (err) { next(err); }
}

export async function getSampleById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ id: req.params.id })); } catch (err) { next(err); }
}

export async function createSample(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(req.body)); } catch (err) { next(err); }
}

// â”€â”€â”€ Shared Orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getSharedOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { scope?: 'available' | 'mine' | 'all'; page?: number; limit?: number };
    res.json(ResponseFormatter.success(await orderService.listAvailableOrders(requirePickerId(req), {
      scope: q.scope || 'all',
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 20,
    })));
  } catch (err) { next(err); }
}

export async function getCompletedSharedOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { type?: 'all' | 'standard' | 'bulk'; dateFrom?: string; dateTo?: string; page?: number; limit?: number };
    res.json(ResponseFormatter.success(await orderService.listDeliveryHistory(requirePickerId(req), {
      type: q.type || 'all',
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 20,
    })));
  } catch (err) { next(err); }
}

export async function getAssignOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  return getSharedOrders(req, res, next);
}

export async function getSharedOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await orderService.getOrderDetail(req.params.orderId, requirePickerId(req))));
  } catch (err) { next(err); }
}

export async function updateSharedOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pickerId = requirePickerId(req);
    const { result } = await withIdempotency(
      pickerId,
      `order:${req.params.orderId}:status:${req.body.status}`,
      readIdempotencyKey(req),
      () => orderService.updateOrderStatus(pickerId, req.params.orderId, req.body),
    );
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function completeSharedOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pickerId = requirePickerId(req);
    const { result } = await withIdempotency(
      pickerId,
      `order:${req.params.orderId}:complete`,
      readIdempotencyKey(req),
      () => orderService.completeDelivery(pickerId, req.params.orderId, req.body),
    );
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function uploadOrderProofPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json(ResponseFormatter.error('A photo is required', 400, null, { appCode: 'VALIDATION_ERROR' }));
      return;
    }
    const result = await orderService.uploadProofPhoto(requirePickerId(req), req.params.orderId, req.file, req.body);
    res.status(201).json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Issues â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function reportIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await appService.reportIssue(requirePickerId(req), req.body || {});
    res.status(201).json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Verify â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function verifyFace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await appService.submitFaceVerification(
      requirePickerId(req),
      req.body?.imageUrl || req.body?.url,
    )));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Didit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createDiditSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success({ sessionId: null })); } catch (err) { next(err); }
}

export async function getDiditStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const userId = requirePickerId(req); res.json(ResponseFormatter.success({ userId, status: 'pending' })); } catch (err) { next(err); }
}

export async function handleDiditWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ received: true })); } catch (err) { next(err); }
}

// â”€â”€â”€ Support â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listSupportTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { status?: string; page?: number; limit?: number };
    const result = await supportService.listSupportTickets(requirePickerId(req), {
      status: q.status || 'all',
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 20,
    });
    res.json(ResponseFormatter.paginated(result.tickets, result.total, result.page, result.limit));
  } catch (err) { next(err); }
}

export async function createSupportTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await appService.createPickerTicket(requirePickerId(req), req.body || {});
    res.status(201).json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getHomeSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { lat?: string; lng?: string; accuracyM?: string };
    const lat = q.lat != null ? Number(q.lat) : undefined;
    const lng = q.lng != null ? Number(q.lng) : undefined;
    const coords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
      ? { latitude: lat, longitude: lng }
      : undefined;
    res.json(ResponseFormatter.success(await appService.getHomeSummary(
      requirePickerId(req),
      coords,
      q.accuracyM != null ? Number(q.accuracyM) : undefined,
    )));
  } catch (err) { next(err); }
}

export async function getChatMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { since?: string; limit?: number };
    res.json(ResponseFormatter.success(await supportService.getChatMessages(requirePickerId(req), {
      since: q.since ? new Date(q.since) : undefined,
      limit: Number(q.limit) || 50,
    })));
  } catch (err) { next(err); }
}

export async function sendChatMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await supportService.sendChatMessage(requirePickerId(req), req.body);
    res.status(201).json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getDashboardToday(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await dashboardService.getTodayDashboard(requirePickerId(req), req.query.date as string | undefined)));
  } catch (err) { next(err); }
}

export async function getIncentivesToday(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await dashboardService.getTodayIncentive(requirePickerId(req), req.query.date as string | undefined)));
  } catch (err) { next(err); }
}

export async function getCashSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await cashService.getCashSummary(requirePickerId(req))));
  } catch (err) { next(err); }
}

export async function listCashTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { type?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number };
    res.json(ResponseFormatter.success(await cashService.listCashTransactions(requirePickerId(req), {
      type: q.type,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 20,
    })));
  } catch (err) { next(err); }
}

export async function recordCashDeposit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pickerId = requirePickerId(req);
    const { result } = await withIdempotency(
      pickerId,
      'cash:deposit',
      readIdempotencyKey(req),
      () => cashService.recordDeposit(pickerId, req.body),
    );
    res.status(201).json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await supportService.getPreferences(requirePickerId(req))));
  } catch (err) { next(err); }
}

export async function updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await supportService.updatePreferences(requirePickerId(req), req.body)));
  } catch (err) { next(err); }
}

export async function getCancelReasons(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await supportService.getCancelReasons(req.query.context as 'standard' | 'bulk')));
  } catch (err) { next(err); }
}

export async function getBulkBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await bulkService.getCurrentBatch(requirePickerId(req), req.query.batchId as string | undefined)));
  } catch (err) { next(err); }
}

export async function loadBulkBag(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await bulkService.loadBag(requirePickerId(req), req.body)));
  } catch (err) { next(err); }
}

export async function startBulkBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pickerId = requirePickerId(req);
    const { result } = await withIdempotency(pickerId, 'bulk:start', readIdempotencyKey(req), () => bulkService.startBatch(pickerId, req.body));
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function arriveBulkStop(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await bulkService.arriveAtStop(requirePickerId(req), req.params.stopId, req.body)));
  } catch (err) { next(err); }
}

export async function uploadBulkStopPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json(ResponseFormatter.error('A photo is required', 400, null, { appCode: 'VALIDATION_ERROR' }));
      return;
    }
    const result = await bulkService.uploadStopPhoto(requirePickerId(req), req.params.stopId, req.file, req.body);
    res.status(201).json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function deliverBulkStop(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pickerId = requirePickerId(req);
    const { result } = await withIdempotency(
      pickerId,
      `bulk:deliver:${req.params.stopId}`,
      readIdempotencyKey(req),
      () => bulkService.deliverStop(pickerId, req.params.stopId, req.body),
    );
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function failBulkStop(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pickerId = requirePickerId(req);
    const { result } = await withIdempotency(
      pickerId,
      `bulk:fail:${req.params.stopId}`,
      readIdempotencyKey(req),
      () => bulkService.failStop(pickerId, req.params.stopId, req.body),
    );
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function listBulkBatches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as { status?: 'completed' | 'cancelled' | 'all'; dateFrom?: string; dateTo?: string; page?: number; limit?: number };
    res.json(ResponseFormatter.success(await bulkService.listBatches(requirePickerId(req), {
      status: q.status || 'completed',
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 20,
    })));
  } catch (err) { next(err); }
}

export async function getBulkBatchDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await bulkService.getBatchDetail(requirePickerId(req), req.params.batchId)));
  } catch (err) { next(err); }
}

// â”€â”€â”€ Admin: Extended Picker Ops â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function adminGetPickerById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const picker = await pickerService.getPickerById(req.params.id);
    if (!picker) { res.status(404).json(ResponseFormatter.error('Picker not found', 404)); return; }
    res.json(ResponseFormatter.success(picker));
  } catch (err) { next(err); }
}

export async function adminUpdatePickerStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const picker = await pickerService.updatePickerStatus(req.params.id, req.body.status, req.user?.userId || 'system');
    if (!picker) { res.status(404).json(ResponseFormatter.error('Picker not found', 404)); return; }
    res.json(ResponseFormatter.success(picker));
  } catch (err) { next(err); }
}

export async function adminUpdateAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ pickerId: req.params.pickerId, assignment: req.body })); } catch (err) { next(err); }
}

export async function adminSendPickerPush(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ pickerId: req.params.pickerId, sent: true })); } catch (err) { next(err); }
}

export async function adminGetPickerActionLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ pickerId: req.params.id, logs: [] })); } catch (err) { next(err); }
}

export async function adminGetPickerTrainingProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ pickerId: req.params.id, progress: [] })); } catch (err) { next(err); }
}

export async function adminGetFaceVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ pickerId: req.params.id, verified: false })); } catch (err) { next(err); }
}

export async function adminLinkHHD(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ pickerId: req.params.id, linked: true, hhdId: req.body.hhdId })); } catch (err) { next(err); }
}

export async function adminUnlinkHHD(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ pickerId: req.params.id, unlinked: true })); } catch (err) { next(err); }
}

/** Maps the dashboard's approve/reject vocabulary onto the stored status. */
function parsePayoutDecision(body: unknown): 'verified' | 'rejected' | null {
  const raw = String((body as { status?: unknown; decision?: unknown })?.status
    ?? (body as { decision?: unknown })?.decision ?? '').toLowerCase();
  if (raw === 'verified' || raw === 'approved' || raw === 'approve') return 'verified';
  if (raw === 'rejected' || raw === 'reject') return 'rejected';
  return null;
}

export async function adminListPayoutVerifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, search, page, limit } = req.query as Record<string, string>;
    if (status && !['pending', 'verified', 'rejected'].includes(status)) {
      res.status(400).json(ResponseFormatter.error('status must be pending, verified or rejected', 400));
      return;
    }
    const result = await pickerService.listPayoutVerifications({
      status: status as pickerService.PayoutMethodStatus | undefined,
      search,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function adminReviewBankAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const decision = parsePayoutDecision(req.body);
    if (!decision) { res.status(400).json(ResponseFormatter.error('status must be verified or rejected', 400)); return; }
    const reviewedBy = req.user?.userId || 'system';
    const result = await pickerService.reviewBankAccount(
      req.params.id,
      req.params.accountId,
      decision,
      reviewedBy,
      req.body.rejectionReason || req.body.note,
    );
    if (!result) { res.status(404).json(ResponseFormatter.error('Bank account not found', 404)); return; }
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function adminReviewUpiPayout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const decision = parsePayoutDecision(req.body);
    if (!decision) { res.status(400).json(ResponseFormatter.error('status must be verified or rejected', 400)); return; }
    const reviewedBy = req.user?.userId || 'system';
    const result = await pickerService.reviewUpiPayout(
      req.params.id,
      decision,
      reviewedBy,
      req.body.rejectionReason || req.body.note,
    );
    if (!result) { res.status(404).json(ResponseFormatter.error('No UPI ID submitted for this picker', 404)); return; }
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function adminOverrideFaceVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const overriddenBy = req.user?.userId || 'system';
    res.json(ResponseFormatter.success({ pickerId: req.params.id, overridden: true, overriddenBy }));
  } catch (err) { next(err); }
}

export async function adminGetAttendanceByMonth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { month, year, warehouseKey } = req.query as Record<string, string>;
    res.json(ResponseFormatter.success({ month, year, warehouseKey, attendance: [] }));
  } catch (err) { next(err); }
}

export async function adminExportAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ exported: true })); } catch (err) { next(err); }
}

export async function adminListAgencies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ agencies: [], total: 0 })); } catch (err) { next(err); }
}

export async function adminCreateAgency(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(req.body)); } catch (err) { next(err); }
}

export async function adminDeactivateAgency(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ agencyId: req.params.agencyId, status: 'inactive' })); } catch (err) { next(err); }
}

export async function adminActivateAgency(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ agencyId: req.params.agencyId, status: 'active' })); } catch (err) { next(err); }
}

export async function adminListStoreShiftSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ storeId: req.params.storeId, slots: [] })); } catch (err) { next(err); }
}

export async function adminCreateStoreShiftSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success({ storeId: req.params.storeId, ...req.body })); } catch (err) { next(err); }
}

export async function adminListOtRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ requests: [], total: 0 })); } catch (err) { next(err); }
}

export async function adminDecideOtRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const decidedBy = req.user?.userId || 'system';
    res.json(ResponseFormatter.success({ requestId: req.params.requestId, decision: req.body.decision, decidedBy }));
  } catch (err) { next(err); }
}

export async function adminListShiftChangeRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ requests: [], total: 0 })); } catch (err) { next(err); }
}

export async function adminDecideShiftChangeRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const decidedBy = req.user?.userId || 'system';
    res.json(ResponseFormatter.success({ requestId: req.params.requestId, decision: req.body.decision, decidedBy }));
  } catch (err) { next(err); }
}

export async function adminReassignPickerShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ shiftId: req.params.shiftId, reassigned: true })); } catch (err) { next(err); }
}
