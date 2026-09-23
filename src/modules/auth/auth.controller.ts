import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import { AppError } from '../../utils/AppError';
import * as authService from './auth.service';
import type { SendOtpInput, VerifyOtpInput, ResendOtpInput, LogoutInput, SendLinkPhoneOtpInput, VerifyLinkPhoneOtpInput, ConfirmDeleteAccountInput } from './auth.validation';

function requesterIp(req: Request): string | undefined {
  return req.ip || req.socket?.remoteAddress || String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
}

/**
 * A session is still returned when the provider rejected the message (non-production only —
 * production turns that into a 502), so the message must reflect what actually happened
 * rather than always claiming the OTP went out.
 */
function otpSentMessage(deliveryStatus?: string): string {
  return deliveryStatus === 'failed'
    ? 'OTP generated but NOT delivered — SMS provider rejected the message. See devNote.'
    : 'OTP sent successfully';
}

export async function sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as SendOtpInput;
    const result = await authService.sendOtp(body);
    res.status(200).json(ResponseFormatter.success(result, otpSentMessage(result.deliveryStatus)));
  } catch (err) {
    next(err);
  }
}

export async function verifyOtpController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId, otp } = req.body as VerifyOtpInput;
    const result = await authService.verifyOtp(sessionId, otp, { ip: requesterIp(req), userAgent: req.get('user-agent') });
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function resendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = req.body as ResendOtpInput;
    const result = await authService.resendOtp(sessionId, req.customer?._id);
    res.status(200).json(ResponseFormatter.success(result, otpSentMessage(result.deliveryStatus)));
  } catch (err) {
    next(err);
  }
}

/** Auth is optional here — a client that already cleared local storage can still send the raw token. */
export function logout(req: Request, res: Response): void {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const { refreshToken } = (req.body || {}) as LogoutInput;
    authService.logout(accessToken, refreshToken);
  } finally {
    // Never block client logout on server failure.
    res.status(200).json(ResponseFormatter.success(null, 'Logged out successfully.'));
  }
}

export async function sendLinkPhoneOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const body = req.body as SendLinkPhoneOtpInput;
    const result = await authService.sendLinkPhoneOtp(req.customer._id, body);
    res.status(200).json(ResponseFormatter.success(result, otpSentMessage(result.deliveryStatus)));
  } catch (err) {
    next(err);
  }
}

export async function sendDeleteAccountOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const result = await authService.sendDeleteAccountOtp(req.customer._id);
    res.status(200).json(ResponseFormatter.success(result, otpSentMessage(result.deliveryStatus)));
  } catch (err) {
    next(err);
  }
}

export async function confirmDeleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const { sessionId, otp } = req.body as ConfirmDeleteAccountInput;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    await authService.confirmDeleteAccount(req.customer._id, sessionId, otp, accessToken);
    res.status(200).json(ResponseFormatter.success(null, 'Your account has been deleted.'));
  } catch (err) {
    next(err);
  }
}

export async function verifyLinkPhoneOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const { sessionId, otp } = req.body as VerifyLinkPhoneOtpInput;
    const result = await authService.verifyLinkPhoneOtp(req.customer._id, sessionId, otp);
    res.status(200).json(ResponseFormatter.success(result, 'Phone number verified and linked'));
  } catch (err) {
    next(err);
  }
}
