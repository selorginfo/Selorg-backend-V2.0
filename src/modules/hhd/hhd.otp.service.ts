import crypto from 'crypto';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/AppError';
import { HHDOTP } from './hhd.models';

const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_SENDS_PER_HOUR = 5;
const LOCKOUT_MINUTES = 15;

function generateOTP(retryCount = 0): string {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  if (otp.length !== 4) {
    if (retryCount < 3) return generateOTP(retryCount + 1);
    return otp.padStart(4, '0').slice(0, 4);
  }
  return otp;
}

export type OtpChannel = 'sms' | 'email';

async function assertCanSend(identifier: string): Promise<void> {
  const now = new Date();
  const latest = await HHDOTP.findOne({ identifier }).sort({ createdAt: -1 });
  if (latest?.lockedUntil && latest.lockedUntil > now) {
    throw new AppError('Too many OTP attempts. Please try again later.', 429, 'RATE_LIMITED');
  }
  if (latest?.lastSentAt) {
    const elapsed = (now.getTime() - new Date(latest.lastSentAt).getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      throw new AppError(
        `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed)}s before requesting another OTP`,
        429,
        'RESEND_COOLDOWN',
      );
    }
  }

  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recentSends = await HHDOTP.countDocuments({
    identifier,
    createdAt: { $gte: hourAgo },
  });
  if (recentSends >= MAX_SENDS_PER_HOUR) {
    throw new AppError('Too many OTP requests for this identity', 429, 'RATE_LIMITED');
  }
}

/** Public rate-limit check used before SMS/email delivery (picker-style). */
export async function ensureCanSendOtp(identifier: string): Promise<void> {
  await assertCanSend(String(identifier).trim().toLowerCase());
}

/**
 * Create (or replace) an OTP for a mobile or email identity.
 */
export async function createOTP(
  identifier: string,
  channel: OtpChannel = 'sms',
  otpOverride?: string,
): Promise<string> {
  const normalized = String(identifier).trim().toLowerCase();
  logger.info(`[OTP Service] Creating OTP for ${channel}:${normalized}`);

  await assertCanSend(normalized);

  const otp = otpOverride != null ? String(otpOverride).trim() : generateOTP();
  const expiresAt = new Date();
  const expireMinutes = Math.max(
    1,
    Math.min(30, parseInt(process.env.OTP_EXPIRE_MINUTES || '5', 10)),
  );
  expiresAt.setMinutes(expiresAt.getMinutes() + expireMinutes);

  try {
    await HHDOTP.deleteMany({ identifier: normalized, isUsed: false });
    // Legacy rows keyed only on mobile
    if (channel === 'sms') {
      await HHDOTP.deleteMany({ mobile: normalized, isUsed: false });
    }
  } catch (e) {
    logger.warn(`[OTP Service] Failed to delete existing OTPs: ${(e as Error).message}`);
  }

  const otpString = String(otp).trim();
  if (!/^\d{4}$/.test(otpString)) throw new Error(`Invalid OTP format: ${otpString}`);

  const created = await Promise.race([
    HHDOTP.create({
      identifier: normalized,
      channel,
      mobile: channel === 'sms' ? normalized : undefined,
      otp: otpString,
      expiresAt,
      lastSentAt: new Date(),
      attemptCount: 0,
    }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Save OTP timeout')), 5000)),
  ]);

  const saved = await HHDOTP.findById(created._id);
  if (!saved) throw new Error('OTP was not saved correctly');

  logger.info(
    `[OTP Service] OTP created: channel=${channel}, identifier=${normalized}, expires=${expiresAt.toISOString()}`,
  );
  return otpString;
}

/**
 * Verify an OTP — exact string match only (no parseInt fuzzy fallback).
 */
export async function verifyOTP(identifier: string, otp: string): Promise<boolean> {
  const normalized = String(identifier).trim().toLowerCase();
  const normalizedOtp = String(otp).trim();
  logger.info(`[OTP Service] Verifying OTP: identifier=${normalized}`);

  const currentTime = new Date();

  // Prefer new identifier key; fall back to legacy mobile field
  let otpRecord = await Promise.race([
    HHDOTP.findOne({
      $or: [{ identifier: normalized }, { mobile: normalized }],
      otp: normalizedOtp,
      isUsed: false,
      expiresAt: { $gt: currentTime },
    }).sort({ createdAt: -1 }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Verify OTP timeout')), 5000)),
  ]);

  if (!otpRecord) {
    const latest = await HHDOTP.findOne({
      $or: [{ identifier: normalized }, { mobile: normalized }],
      isUsed: false,
      expiresAt: { $gt: currentTime },
    }).sort({ createdAt: -1 });

    if (latest) {
      if (latest.lockedUntil && latest.lockedUntil > currentTime) {
        throw new AppError('Too many OTP attempts. Please try again later.', 429, 'RATE_LIMITED');
      }
      latest.attemptCount = (latest.attemptCount || 0) + 1;
      if (latest.attemptCount >= MAX_VERIFY_ATTEMPTS) {
        latest.lockedUntil = new Date(currentTime.getTime() + LOCKOUT_MINUTES * 60 * 1000);
      }
      await latest.save().catch(() => {});
    }

    logger.warn(`[OTP Service] Verification failed for identifier=${normalized}`);
    return false;
  }

  if (otpRecord.lockedUntil && otpRecord.lockedUntil > currentTime) {
    throw new AppError('Too many OTP attempts. Please try again later.', 429, 'RATE_LIMITED');
  }

  // Exact string match already enforced by the query
  logger.info(`[OTP Service] OTP match found, marking as used`);
  await Promise.race([
    HHDOTP.updateOne({ _id: otpRecord._id, isUsed: false }, { $set: { isUsed: true } }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Mark OTP timeout')), 5000)),
  ]);
  return true;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export const OTPService = { generateOTP, createOTP, verifyOTP, hashToken, generateRefreshToken };
