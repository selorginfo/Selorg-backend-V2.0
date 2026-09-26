import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { ResponseFormatter } from '../../utils/response';
import { generateOtp } from '../../utils/auth';
import {
  awaitOtpDelivery,
  deliverOtpToEmail,
  deliverOtpToPhone,
} from '../../services/otpDelivery.service';
import { HHDUser, HHDRefreshToken } from './hhd.models';
import {
  createOTP,
  ensureCanSendOtp,
  verifyOTP,
  hashToken,
  generateRefreshToken,
  OtpChannel,
} from './hhd.otp.service';
import { mapUserView } from './hhd.mappers';
import { appConfig } from '../../config/env';

const REFRESH_TTL_DAYS = Math.max(1, parseInt(process.env.HHD_REFRESH_EXPIRE_DAYS || '30', 10));
const ACCESS_EXPIRE_SECONDS = (() => {
  const raw = process.env.JWT_EXPIRE || '7d';
  if (raw.endsWith('d')) return parseInt(raw, 10) * 24 * 60 * 60;
  if (raw.endsWith('h')) return parseInt(raw, 10) * 60 * 60;
  if (raw.endsWith('m')) return parseInt(raw, 10) * 60;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 7 * 24 * 60 * 60;
})();
const OTP_EXPIRE_MINUTES = Math.max(
  1,
  Math.min(30, parseInt(process.env.OTP_EXPIRE_MINUTES || '5', 10)),
);
const IS_NON_PRODUCTION = process.env.NODE_ENV !== 'production';
const HHD_APP_NAME = process.env.HHD_APP_NAME || 'Selorg HHD';

function logDevOtp(target: string, channel: string, otp: string): void {
  if (IS_NON_PRODUCTION) {
    logger.info(`[DEV] ${HHD_APP_NAME} OTP for ${target} (${channel}): ${otp}`);
  }
}

function hhdEmailFrom(): string | undefined {
  return (
    process.env.HHD_EMAIL_FROM ||
    process.env.PICKER_EMAIL_FROM ||
    process.env.EMAIL_FROM ||
    undefined
  );
}

function normalizeMobile(raw: string): string {
  return String(raw).replace(/\D/g, '').slice(-10);
}

function isValidMobile(mobile: string): boolean {
  return /^[6-9]\d{9}$/.test(mobile) && !/^0+$/.test(mobile);
}

function isValidEmail(email: string): boolean {
  return /.+@.+\..+/.test(email) && email.length <= 60;
}

async function issueTokens(user: InstanceType<typeof HHDUser>, deviceId?: string) {
  const token = user.getSignedJwtToken();
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

  await HHDRefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    deviceId: deviceId || user.deviceId,
    expiresAt,
  });

  return { token, refreshToken, expiresInSeconds: ACCESS_EXPIRE_SECONDS };
}

/**
 * POST /auth/send-otp
 * Body: { phone?, mobile?, mobileNumber?, email?, preferredChannel? }
 * Phone OTP uses the same SMS/WhatsApp providers as the picker app.
 */
export async function sendOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { mobile, mobileNumber, phone, email, preferredChannel } = req.body as {
      mobile?: string;
      mobileNumber?: string;
      phone?: string;
      email?: string;
      preferredChannel?: string;
    };

    const mobileRaw = (mobile || mobileNumber || phone || '').trim();
    const emailRaw = (email || '').trim().toLowerCase();

    if (!mobileRaw && !emailRaw) {
      return next(new AppError('Please provide a mobile number or email', 400, 'VALIDATION_ERROR'));
    }
    if (mobileRaw && emailRaw) {
      return next(
        new AppError('Provide exactly one of mobile or email', 400, 'VALIDATION_ERROR'),
      );
    }

    let identifier: string;
    let channel: OtpChannel;
    let responseIdentity: Record<string, unknown>;
    const preferred = String(preferredChannel || 'sms').toLowerCase();

    if (mobileRaw) {
      const normalizedMobile = normalizeMobile(mobileRaw);
      if (!isValidMobile(normalizedMobile)) {
        return next(
          new AppError(
            'Please provide a valid 10-digit mobile number starting with 6–9',
            400,
            'VALIDATION_ERROR',
          ),
        );
      }
      identifier = normalizedMobile;
      channel = 'sms';
      responseIdentity = { mobile: normalizedMobile, phone: normalizedMobile };
    } else {
      if (!isValidEmail(emailRaw)) {
        return next(new AppError('Please provide a valid email address', 400, 'VALIDATION_ERROR'));
      }
      identifier = emailRaw;
      channel = 'email';
      responseIdentity = { email: emailRaw };
    }

    const otp = generateOtp(4);
    const deliveryChannel = channel === 'email' ? 'email' : preferred === 'whatsapp' ? 'whatsapp' : 'sms';

    try {
      await ensureCanSendOtp(identifier);
    } catch (e) {
      if (e instanceof AppError) return next(e);
      return next(new AppError('Unable to send OTP. Please try again.', 500, 'OTP_RATE_CHECK_FAILED'));
    }

    logDevOtp(identifier, deliveryChannel, otp);

    const delivery =
      channel === 'email'
        ? await awaitOtpDelivery('HHD Email OTP', identifier, () =>
            deliverOtpToEmail({
              email: identifier,
              otp,
              expiresInMinutes: OTP_EXPIRE_MINUTES,
              appName: HHD_APP_NAME,
              from: hhdEmailFrom(),
            }),
          )
        : await awaitOtpDelivery(`HHD ${deliveryChannel.toUpperCase()} OTP`, identifier, () =>
            deliverOtpToPhone(identifier, otp, deliveryChannel, OTP_EXPIRE_MINUTES),
          );

    const devFallback = appConfig.otp.devMode || !appConfig.isProduction;
    if (!delivery.sent && !devFallback) {
      logger.error('[HHD Auth] OTP delivery failed', {
        identifier,
        channel: deliveryChannel,
        errorCode: delivery.errorCode,
        provider: delivery.provider,
        message: delivery.message,
      });
      return next(
        new AppError(
          delivery.message || 'Unable to send OTP. Please try again.',
          502,
          delivery.errorCode || 'OTP_PROVIDER_ERROR',
        ),
      );
    }

    try {
      await createOTP(identifier, channel, otp);
    } catch (e) {
      if (e instanceof AppError) return next(e);
      return next(new AppError('Failed to store OTP', 500, 'OTP_STORE_FAILED'));
    }

    res.status(200).json(
      ResponseFormatter.success(
        {
          ...responseIdentity,
          channel: delivery.channel || deliveryChannel,
          deliveryStatus: delivery.sent ? 'sent' : 'failed',
          expiresInSeconds: OTP_EXPIRE_MINUTES * 60,
        },
        'OTP sent successfully',
      ),
    );
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/resend-otp
 */
export async function resendOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
  return sendOTP(req, res, next);
}

/**
 * POST /auth/verify-otp
 * Body: { mobile?, email?, otp, deviceId? }
 */
export async function verifyOTPHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      mobile,
      mobileNumber,
      phone,
      email,
      otp,
      enteredOTP,
      deviceId,
    } = req.body as {
      mobile?: string;
      mobileNumber?: string;
      phone?: string;
      email?: string;
      otp?: string;
      enteredOTP?: string;
      deviceId?: string;
    };

    const mobileRaw = (mobile || mobileNumber || phone || '').trim();
    const emailRaw = (email || '').trim().toLowerCase();
    const otpParam = otp || enteredOTP;

    if (!mobileRaw && !emailRaw) {
      return next(new AppError('Please provide mobile number or email', 400, 'VALIDATION_ERROR'));
    }
    if (!otpParam) {
      return next(new AppError('Please provide OTP', 400, 'VALIDATION_ERROR'));
    }

    const normalizedOtp = String(otpParam).trim();
    if (!/^\d{4}$/.test(normalizedOtp)) {
      return next(
        new AppError('Invalid OTP format. Please enter a 4-digit code.', 400, 'VALIDATION_ERROR'),
      );
    }

    let identifier: string;
    let channel: OtpChannel;

    if (mobileRaw) {
      const normalizedMobile = normalizeMobile(mobileRaw);
      if (!isValidMobile(normalizedMobile)) {
        return next(
          new AppError(
            'Please provide a valid 10-digit mobile number starting with 6–9',
            400,
            'VALIDATION_ERROR',
          ),
        );
      }
      identifier = normalizedMobile;
      channel = 'sms';
    } else {
      if (!isValidEmail(emailRaw)) {
        return next(new AppError('Please provide a valid email address', 400, 'VALIDATION_ERROR'));
      }
      identifier = emailRaw;
      channel = 'email';
    }

    let isValid: boolean;
    try {
      isValid = await Promise.race([
        verifyOTP(identifier, normalizedOtp),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('OTP verification timeout')), 10000),
        ),
      ]);
    } catch (verifyError) {
      if (verifyError instanceof AppError) return next(verifyError);
      const msg = (verifyError as Error).message;
      const errMessage =
        msg.includes('timeout') || msg.includes('Database')
          ? 'Service temporarily unavailable. Please try again in a moment.'
          : 'Failed to verify OTP. Please try again.';
      return next(new AppError(errMessage, 500, 'OTP_VERIFY_FAILED'));
    }

    if (!isValid) {
      return next(new AppError('Invalid or expired OTP. Please try again.', 400, 'OTP_INVALID'));
    }

    let user =
      channel === 'sms'
        ? await HHDUser.findOne({ mobile: identifier })
        : await HHDUser.findOne({ email: identifier });

    if (!user) {
      // Auto-create picker on first successful OTP (existing behaviour for phone).
      const { DEFAULT_HUB_KEY } = await import('../orders/fulfillment.service');
      user = await HHDUser.create(
        channel === 'sms'
          ? { mobile: identifier, isActive: true, darkstore: DEFAULT_HUB_KEY, warehouse: DEFAULT_HUB_KEY }
          : { email: identifier, isActive: true, darkstore: DEFAULT_HUB_KEY, warehouse: DEFAULT_HUB_KEY },
      );
    } else if (!(user.darkstore || user.warehouse)) {
      const { ensureHhdOperatorHub } = await import('./hhdOperator.bridge');
      await ensureHhdOperatorHub(String(user._id));
      user = (await HHDUser.findById(user._id)) || user;
    }

    if (user.isActive === false) {
      return next(new AppError('User account is inactive', 403, 'USER_INACTIVE'));
    }

    user.lastLogin = new Date();
    if (deviceId) user.deviceId = deviceId;
    await user.save().catch(() => {});

    const tokens = await issueTokens(user, deviceId);

    res.status(200).json(
      ResponseFormatter.success(
        {
          token: tokens.token,
          refreshToken: tokens.refreshToken,
          expiresInSeconds: tokens.expiresInSeconds,
          user: {
            id: (user._id as { toString(): string }).toString(),
            mobile: user.mobile || null,
            name: user.name || null,
            role: user.role,
            email: user.email || null,
            warehouse: user.warehouse || null,
            deviceId: user.deviceId || null,
            isActive: user.isActive,
            lastLogin: user.lastLogin || null,
          },
        },
        'OTP verified successfully',
      ),
    );
  } catch (error) {
    next(error);
  }
}

/**
 * GET /auth/me
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.hhdUser?.id;
    const user = await HHDUser.findById(userId).select('-password').lean();
    if (!user) {
      return next(new AppError('Session expired. Please sign in again.', 401, 'SESSION_EXPIRED'));
    }
    res.status(200).json(ResponseFormatter.success(mapUserView(user as never)));
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/logout
 * Body: { refreshToken? }
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = (req.body || {}) as { refreshToken?: string };
    if (refreshToken) {
      await HHDRefreshToken.updateOne(
        { tokenHash: hashToken(refreshToken), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
    } else if (req.hhdUser?.id) {
      await HHDRefreshToken.updateMany(
        { userId: req.hhdUser.id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
    }
    logger.info('[HHD Auth] User logged out', { userId: req.hhdUser?.id });
    res.status(200).json(ResponseFormatter.success(null, 'Logged out successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/refresh
 * Body: { refreshToken, deviceId? }
 */
export async function refreshSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { refreshToken, deviceId } = req.body as {
      refreshToken?: string;
      deviceId?: string;
    };

    if (!refreshToken) {
      return next(new AppError('refreshToken is required', 400, 'VALIDATION_ERROR'));
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await HHDRefreshToken.findOne({ tokenHash });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      if (stored && !stored.revokedAt) {
        // Reuse of an already-rotated / expired token → revoke family
        await HHDRefreshToken.updateMany(
          { userId: stored.userId, revokedAt: null },
          { $set: { revokedAt: new Date() } },
        );
      }
      return next(new AppError('Invalid or expired refresh token', 401, 'REFRESH_TOKEN_INVALID'));
    }

    if (deviceId && stored.deviceId && stored.deviceId !== deviceId) {
      return next(new AppError('Invalid or expired refresh token', 401, 'REFRESH_TOKEN_INVALID'));
    }

    const user = await HHDUser.findById(stored.userId);
    if (!user) {
      return next(new AppError('Invalid or expired refresh token', 401, 'REFRESH_TOKEN_INVALID'));
    }
    if (user.isActive === false) {
      return next(new AppError('User account is inactive', 403, 'USER_INACTIVE'));
    }

    // Rotate
    stored.revokedAt = new Date();
    const newRefresh = generateRefreshToken();
    stored.replacedBy = hashToken(newRefresh);
    await stored.save();

    const tokens = await issueTokens(user, deviceId || stored.deviceId);
    // Replace the auto-created refresh from issueTokens with our rotated value for clarity
    await HHDRefreshToken.deleteOne({ tokenHash: hashToken(tokens.refreshToken) }).catch(() => {});
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);
    await HHDRefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(newRefresh),
      deviceId: deviceId || stored.deviceId,
      expiresAt,
    });

    res.status(200).json(
      ResponseFormatter.success({
        token: tokens.token,
        refreshToken: newRefresh,
        expiresInSeconds: tokens.expiresInSeconds,
      }),
    );
  } catch (error) {
    next(error);
  }
}
