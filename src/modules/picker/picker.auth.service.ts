import crypto from 'crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { PickerUser, PickerOtp, pickerDisplayRole, parseWorkforceRole, type WorkforceRole } from './picker.models';
import { PickerOnboardingApplication } from './picker.rider.models';
import { generateOtp } from '../../utils/auth';
import {
  awaitOtpDelivery,
  deliverOtpToEmail,
  deliverOtpToPhone,
} from '../../services/otpDelivery.service';
import { pickerConfig, toApiAccountStatus } from './picker.config';
import { logger } from '../../utils/logger';
import { appConfig } from '../../config/env';

/**
 * Picker (rider) authentication: OTP issue/verify over SMS, WhatsApp and email,
 * plus session lifecycle (logout, refresh).
 *
 * Delivery uses the same shared SMS/email providers as Customer auth
 * (`otpDelivery.service` → `sms.service` / `email.service`). Providers are
 * always called; API success is returned only when the provider accepts the message.
 *
 * Tokens carry `aud: 'picker'` so a rider token can never be replayed against the
 * admin or customer middlewares, and a `sid` claim that must match
 * `PickerUser.sessionToken` — which is what makes logout and refresh able to
 * invalidate every outstanding token for a rider.
 */

function resolvePickerJwtSecret(): string {
  const secret = process.env.PICKER_JWT_SECRET || process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PICKER_JWT_SECRET or JWT_SECRET must be set in production');
  }
  return 'picker-app-secret-change-in-production';
}
const JWT_SECRET = resolvePickerJwtSecret();
const OTP_EXPIRE_MINUTES = parseInt(process.env.OTP_EXPIRE_MINUTES || '5', 10);
const IS_NON_PRODUCTION = process.env.NODE_ENV !== 'production';
const RIDER_APP_NAME = process.env.RIDER_APP_NAME || 'Selorg Rider';

function otpDevFallback(): boolean {
  return appConfig.otp.devMode || !appConfig.isProduction;
}

function riderEmailFrom(): string | undefined {
  return (
    process.env.RIDER_EMAIL_FROM ||
    process.env.PICKER_EMAIL_FROM ||
    process.env.EMAIL_FROM ||
    undefined
  );
}

export const PICKER_TOKEN_AUDIENCE = 'picker';
const TOKEN_TTL_DAYS = 7;

export type PickerNextScreen = 'main' | 'onboarding' | 'pending_review' | 'rejected' | 'suspended';

export interface PickerAuthUserDto {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  loginMethod: 'mobile' | 'whatsapp' | 'email';
  status: ReturnType<typeof toApiAccountStatus>;
  onboardingCompleted: boolean;
  rejectedReason: string | null;
  role: string;
  workforceRole: WorkforceRole | null;
}

export interface PickerAuthResult {
  success: boolean;
  message: string;
  errorCode?: string;
  statusCode?: number;
  token?: string;
  expiresAt?: string;
  isNewUser?: boolean;
  user?: PickerAuthUserDto;
  nextScreen?: PickerNextScreen;
  channel?: string;
  retryAfterSeconds?: number;
  /** Truthful provider outcome — only present on send/resend OTP. */
  deliveryStatus?: 'sent' | 'failed';
}

// ─── Normalisation ────────────────────────────────────────────────────────────

function normalizePhone(phone: unknown): string | null {
  const raw = String(phone ?? '').replace(/\D/g, '');
  let digits = raw;
  if (raw.length === 12 && raw.startsWith('91')) digits = raw.slice(2);
  else if (raw.length === 11 && raw.startsWith('0')) digits = raw.slice(1);
  else if (raw.length > 10) digits = raw.slice(-10);
  if (digits.length !== 10 || /^0+$/.test(digits)) return null;
  return digits;
}

function normalizeEmail(email: unknown): string | null {
  const s = String(email ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

// ─── OTP storage + throttling ─────────────────────────────────────────────────

/**
 * Enforces the send throttle before an OTP is generated or delivered.
 *
 * `sendCount`/`windowStartedAt` live on the OTP record rather than the per-send
 * `attempts` counter precisely because `storeOtp` resets `attempts` — without a
 * separate window, resending would reset the verify cap indefinitely.
 */
async function reserveSendSlot(identifier: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = new Date();
  const windowMs = pickerConfig.otpThrottleWindowMinutes * 60000;
  const record = await PickerOtp.findOne({ identifier });

  if (record?.windowStartedAt && now.getTime() - new Date(record.windowStartedAt).getTime() < windowMs) {
    if ((record.sendCount || 0) >= pickerConfig.otpMaxSendsPerWindow) {
      const retryAfterSeconds = Math.ceil(
        (new Date(record.windowStartedAt).getTime() + windowMs - now.getTime()) / 1000,
      );
      return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // First send, or the previous window has elapsed — start a fresh one.
  if (record) {
    record.windowStartedAt = now;
    record.sendCount = 0;
    await record.save();
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

async function storeOtp(identifier: string, otp: string): Promise<void> {
  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60000);
  const existing = (await PickerOtp.findOne({ identifier }).select('sendCount windowStartedAt').lean()) as { windowStartedAt?: Date } | null;
  const windowStartedAt = existing?.windowStartedAt || new Date();
  await PickerOtp.findOneAndUpdate(
    { identifier },
    {
      $set: { identifier, otp, expiresAt, attempts: 0, verified: false, windowStartedAt },
      $inc: { sendCount: 1 },
    },
    { upsert: true, new: true },
  );
}

type OtpCheck = { ok: true } | { ok: false; errorCode: 'OTP_EXPIRED' | 'OTP_RATE_LIMITED' | 'INCORRECT_OTP' };

/**
 * Validates an OTP without marking it verified. Wrong attempts still increment
 * the counter. Call `consumeOtp` only after the login/signup side-effects succeed
 * so a correct OTP + ACCOUNT_NOT_FOUND (login intent) can be retried as signup.
 */
async function matchOtp(identifier: string, otp: string): Promise<OtpCheck> {
  const record = await PickerOtp.findOne({ identifier, verified: false, expiresAt: { $gt: new Date() } });
  if (!record) return { ok: false, errorCode: 'OTP_EXPIRED' };

  if ((record.attempts || 0) >= pickerConfig.otpMaxVerifyAttempts) {
    return { ok: false, errorCode: 'OTP_RATE_LIMITED' };
  }

  if (record.otp !== String(otp).trim()) {
    record.attempts += 1;
    await record.save();
    if (record.attempts >= pickerConfig.otpMaxVerifyAttempts) return { ok: false, errorCode: 'OTP_RATE_LIMITED' };
    return { ok: false, errorCode: 'INCORRECT_OTP' };
  }

  return { ok: true };
}

async function consumeOtp(identifier: string): Promise<void> {
  await PickerOtp.findOneAndUpdate(
    { identifier, verified: false },
    { $set: { verified: true } },
  );
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

function signToken(userId: string, sessionToken: string, workforceRole?: string | null): { token: string; expiresAt: string } {
  const role = parseWorkforceRole(workforceRole);
  const token = jwt.sign(
    {
      sub: userId,
      userId,
      id: userId,
      sid: sessionToken,
      ...(role ? { workforceRole: role } : {}),
    },
    JWT_SECRET,
    { expiresIn: `${TOKEN_TTL_DAYS}d`, audience: PICKER_TOKEN_AUDIENCE },
  );
  return { token, expiresAt: new Date(Date.now() + TOKEN_TTL_DAYS * 86400000).toISOString() };
}

/** Rotates the rider's session and returns a token bound to it. */
async function issueSession(user: {
  _id: unknown;
  sessionToken?: string | null;
  workforceRole?: string | null;
  save: () => Promise<unknown>;
}): Promise<{ token: string; expiresAt: string }> {
  const sessionToken = crypto.randomUUID();
  user.sessionToken = sessionToken;
  await user.save();
  return signToken(String(user._id), sessionToken, user.workforceRole);
}

/** Kept for callers that only need a signed token for an already-persisted session. */
function buildToken(user: { _id: unknown; sessionToken?: string | null; workforceRole?: string | null }): string {
  return signToken(String(user._id), user.sessionToken || crypto.randomUUID(), user.workforceRole).token;
}

function applyClientWorkforceRole(user: { workforceRole?: WorkforceRole | string | null }, client?: WorkforceRole): void {
  if (!client) return;
  if (!user.workforceRole) user.workforceRole = client;
}

// ─── Account state → routing ──────────────────────────────────────────────────

/**
 * Whether the rider has finished onboarding. Approval is authoritative: an
 * `ACTIVE` account is by definition past review. Otherwise onboarding counts as
 * complete once the application has actually been submitted.
 */
async function resolveOnboarding(user: {
  _id: unknown;
  status?: string;
}): Promise<{ onboardingCompleted: boolean; submitted: boolean }> {
  if (String(user.status).toUpperCase() === 'ACTIVE') return { onboardingCompleted: true, submitted: true };
  const application = await PickerOnboardingApplication.findOne({ pickerId: user._id }).select('status').lean();
  const submitted = Boolean(application && application.status !== 'draft');
  return { onboardingCompleted: false, submitted };
}

function resolveNextScreen(status: string, submitted: boolean): PickerNextScreen {
  switch (String(status).toUpperCase()) {
    case 'ACTIVE': return 'main';
    case 'SUSPENDED': return 'suspended';
    case 'REJECTED': return 'rejected';
    // INACTIVE riders are approved but stood down; the app shows Main and the
    // shift screens report no availability.
    case 'INACTIVE': return 'main';
    default: return submitted ? 'pending_review' : 'onboarding';
  }
}

export async function buildAuthUserDto(user: any): Promise<{ user: PickerAuthUserDto; nextScreen: PickerNextScreen }> {
  const { onboardingCompleted, submitted } = await resolveOnboarding(user);
  const status = toApiAccountStatus(user.status);
  return {
    user: {
      id: String(user._id),
      phone: user.phoneIsPlaceholder ? null : user.phone || null,
      email: user.email || null,
      name: user.name || null,
      loginMethod: (user.loginMethod || 'mobile') as PickerAuthUserDto['loginMethod'],
      status,
      onboardingCompleted,
      rejectedReason: status === 'rejected' ? user.rejectedReason || null : null,
      role: pickerDisplayRole(user),
      workforceRole: parseWorkforceRole(user.workforceRole) || null,
    },
    nextScreen: resolveNextScreen(user.status, submitted),
  };
}

// ─── SMS / WhatsApp OTP ───────────────────────────────────────────────────────

function logDevOtp(target: string, channel: string, otp: string): void {
  if (IS_NON_PRODUCTION) {
    logger.info(`[DEV] ${RIDER_APP_NAME} OTP for ${target} (${channel}): ${otp}`);
  }
}

/**
 * Issue phone OTP using the same SMS/WhatsApp providers as Customer auth.
 * Success is returned only when the provider accepts the message.
 */
export async function sendOtp(phone: unknown, options: { preferredChannel?: string } = {}): Promise<PickerAuthResult> {
  const trimmed = normalizePhone(phone);
  if (!trimmed) {
    return { success: false, message: 'Please provide a valid 10-digit mobile number.', errorCode: 'INVALID_PHONE', statusCode: 400 };
  }

  const isWhatsApp = String(options.preferredChannel || 'sms').toLowerCase() === 'whatsapp';
  const channel = isWhatsApp ? 'whatsapp' : 'sms';

  const slot = await reserveSendSlot(trimmed);
  if (!slot.allowed) {
    return {
      success: false,
      message: `Too many OTP requests. Please try again in ${Math.ceil(slot.retryAfterSeconds / 60)} minute(s).`,
      errorCode: 'OTP_RATE_LIMITED',
      statusCode: 429,
      retryAfterSeconds: slot.retryAfterSeconds,
    };
  }

  const otp = generateOtp(4);
  logDevOtp(trimmed, channel, otp);

  // Pass bare 10 digits — same as Customer. sms.service applies +91 for Twilio.
  const delivery = await awaitOtpDelivery(
    `${channel.toUpperCase()} OTP`,
    trimmed,
    () => deliverOtpToPhone(trimmed, otp, channel, OTP_EXPIRE_MINUTES),
  );

  if (!delivery.sent && !otpDevFallback()) {
    logger.error('[PickerAuth] SMS/WhatsApp OTP delivery failed', {
      phone: trimmed,
      channel,
      errorCode: delivery.errorCode,
      provider: delivery.provider,
      message: delivery.message,
    });
    return {
      success: false,
      message: delivery.message || 'Unable to send OTP. Please try again.',
      errorCode: delivery.errorCode || 'OTP_PROVIDER_ERROR',
      statusCode: 502,
      channel,
      deliveryStatus: 'failed',
    };
  }

  await storeOtp(trimmed, otp);
  return {
    success: true,
    message: 'OTP sent successfully',
    channel: delivery.channel || channel,
    deliveryStatus: delivery.sent ? 'sent' : 'failed',
  };
}

export async function resendOtp(phone: unknown, options: { preferredChannel?: string } = {}): Promise<PickerAuthResult> {
  return sendOtp(phone, options);
}

export async function verifyOtp(
  phone: unknown,
  otp: unknown,
  options: { preferredChannel?: string; storeId?: string; intent?: string; workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  const otpStr = String(otp ?? '').trim();
  if (!/^\d{4}$/.test(otpStr)) {
    return { success: false, message: 'OTP must be exactly 4 numeric digits', errorCode: 'INCORRECT_OTP', statusCode: 400 };
  }

  const trimmed = normalizePhone(phone);
  if (!trimmed) return { success: false, message: 'Invalid phone number.', errorCode: 'INVALID_PHONE', statusCode: 400 };

  const check = await matchOtp(trimmed, otpStr);
  if (!check.ok) {
    if (check.errorCode === 'OTP_RATE_LIMITED') {
      return { success: false, message: 'Too many incorrect attempts. Please request a new code.', errorCode: 'OTP_RATE_LIMITED', statusCode: 429 };
    }
    if (check.errorCode === 'INCORRECT_OTP') {
      return { success: false, message: 'Invalid OTP. Please try again.', errorCode: 'INCORRECT_OTP', statusCode: 400 };
    }
    return { success: false, message: 'Invalid or expired OTP. Please try again.', errorCode: 'OTP_EXPIRED', statusCode: 400 };
  }

  const loginMethod = String(options.preferredChannel || 'sms').toLowerCase() === 'whatsapp' ? 'whatsapp' : 'mobile';
  let user = await PickerUser.findOne({ phone: trimmed });
  const isNewUser = !user;

  // `intent: 'login'` means the rider tapped "Log in", so an absent account is an
  // error the app surfaces as a Create-Account banner — not a silent signup.
  if (!user && String(options.intent || '').toLowerCase() === 'login') {
    return { success: false, message: 'No account found for this number.', errorCode: 'ACCOUNT_NOT_FOUND', statusCode: 404 };
  }

  await consumeOtp(trimmed);

  if (!user) {
    user = await PickerUser.create({
      phone: trimmed,
      loginMethod,
      ...(options.workforceRole ? { workforceRole: options.workforceRole } : {}),
    });
  } else {
    user.loginMethod = loginMethod;
    // An email-only account logging in by phone now owns a real number.
    if (user.phoneIsPlaceholder) user.phoneIsPlaceholder = false;
    applyClientWorkforceRole(user, options.workforceRole);
  }

  // Persist the store the picker signed in against (their home store for
  // this session). Used by dispatch batchAssignByStore to scope work.
  if (options.storeId && mongoose.Types.ObjectId.isValid(options.storeId)) {
    user.storeId = new mongoose.Types.ObjectId(options.storeId);
    await user.save();
  }

  return finalizeLogin(user, isNewUser);
}

// ─── Email OTP ────────────────────────────────────────────────────────────────

/**
 * `PickerUser.phone` is `required` + `unique`, so an email-only signup needs a
 * deterministic filler. It is flagged via `phoneIsPlaceholder` and never returned.
 */
function syntheticPhone(email: string): string {
  const hex = crypto.createHash('md5').update(email).digest('hex');
  const digits = hex.replace(/[a-f]/gi, '').slice(0, 9);
  return `1${digits.padEnd(9, '0')}`;
}

export async function sendOtpEmail(email: unknown): Promise<PickerAuthResult> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { success: false, message: 'Please enter a valid email address.', errorCode: 'INVALID_EMAIL', statusCode: 400 };
  }

  const identifier = `email|${normalizedEmail}`;
  const slot = await reserveSendSlot(identifier);
  if (!slot.allowed) {
    return {
      success: false,
      message: `Too many OTP requests. Please try again in ${Math.ceil(slot.retryAfterSeconds / 60)} minute(s).`,
      errorCode: 'OTP_RATE_LIMITED',
      statusCode: 429,
      retryAfterSeconds: slot.retryAfterSeconds,
    };
  }

  const otp = generateOtp(4);
  logDevOtp(normalizedEmail, 'email', otp);

  const delivery = await awaitOtpDelivery('Email OTP', normalizedEmail, () =>
    deliverOtpToEmail({
      email: normalizedEmail,
      otp,
      expiresInMinutes: OTP_EXPIRE_MINUTES,
      appName: RIDER_APP_NAME,
      from: riderEmailFrom(),
    }),
  );

  if (!delivery.sent && !otpDevFallback()) {
    logger.error('[PickerAuth] Email OTP delivery failed', {
      email: normalizedEmail,
      provider: delivery.provider,
      message: delivery.message,
      errorCode: delivery.errorCode,
    });
    return {
      success: false,
      message: delivery.message || 'Unable to send OTP. Please try again.',
      errorCode: delivery.errorCode || 'EMAIL_PROVIDER_ERROR',
      statusCode: 502,
      channel: 'email',
      deliveryStatus: 'failed',
    };
  }

  await storeOtp(identifier, otp);
  return {
    success: true,
    message: 'OTP sent successfully',
    channel: 'email',
    deliveryStatus: delivery.sent ? 'sent' : 'failed',
  };
}

export async function resendOtpEmail(email: unknown): Promise<PickerAuthResult> {
  return sendOtpEmail(email);
}

export async function verifyOtpEmail(
  email: unknown,
  otp: unknown,
  options: { intent?: string; workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  const normalizedEmail = normalizeEmail(email);
  const otpStr = String(otp ?? '').trim();
  if (!normalizedEmail) {
    return { success: false, message: 'Please enter a valid email address.', errorCode: 'INVALID_EMAIL', statusCode: 400 };
  }
  if (!/^\d{4}$/.test(otpStr)) {
    return { success: false, message: 'OTP must be exactly 4 numeric digits', errorCode: 'INCORRECT_OTP', statusCode: 400 };
  }

  const check = await matchOtp(`email|${normalizedEmail}`, otpStr);
  if (!check.ok) {
    if (check.errorCode === 'OTP_RATE_LIMITED') {
      return { success: false, message: 'Too many incorrect attempts. Please request a new code.', errorCode: 'OTP_RATE_LIMITED', statusCode: 429 };
    }
    if (check.errorCode === 'INCORRECT_OTP') {
      return { success: false, message: 'Invalid OTP. Please try again.', errorCode: 'INCORRECT_OTP', statusCode: 400 };
    }
    return { success: false, message: 'Invalid or expired OTP. Please try again.', errorCode: 'OTP_EXPIRED', statusCode: 400 };
  }

  let user = await PickerUser.findOne({ email: normalizedEmail });
  const isNewUser = !user;

  if (!user && String(options.intent || '').toLowerCase() === 'login') {
    return { success: false, message: 'No account found for this email.', errorCode: 'ACCOUNT_NOT_FOUND', statusCode: 404 };
  }

  await consumeOtp(`email|${normalizedEmail}`);

  if (!user) {
    user = await PickerUser.create({
      phone: syntheticPhone(normalizedEmail),
      phoneIsPlaceholder: true,
      email: normalizedEmail,
      loginMethod: 'email',
      ...(options.workforceRole ? { workforceRole: options.workforceRole } : {}),
    });
  } else {
    user.loginMethod = 'email';
    if (!user.email) user.email = normalizedEmail;
    applyClientWorkforceRole(user, options.workforceRole);
  }

  return finalizeLogin(user, isNewUser);
}

// ─── Shared login tail ────────────────────────────────────────────────────────

/**
 * Issues the session and routing hint, refusing suspended accounts up front
 * rather than handing out a token that `authenticatePicker` rejects on the next call.
 */
async function finalizeLogin(user: any, isNewUser: boolean): Promise<PickerAuthResult> {
  if (String(user.status).toUpperCase() === 'SUSPENDED') {
    await user.save();
    return { success: false, message: 'Your account has been suspended. Please contact support.', errorCode: 'ACCOUNT_SUSPENDED', statusCode: 403 };
  }

  const { token, expiresAt } = await issueSession(user);
  const { user: dto, nextScreen } = await buildAuthUserDto(user);
  return { success: true, message: 'OTP verified', token, expiresAt, isNewUser, user: dto, nextScreen };
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

/**
 * Clears `sessionToken`, which invalidates every outstanding JWT for the rider
 * because `authenticatePicker` compares the token's `sid` against it.
 */
export async function logout(pickerId: string): Promise<{ loggedOut: boolean }> {
  await PickerUser.updateOne(
    { _id: pickerId },
    { $set: { sessionToken: null, isOnline: false, onlineSince: null } },
  );
  return { loggedOut: true };
}

export async function refreshSession(pickerId: string): Promise<PickerAuthResult> {
  const user = await PickerUser.findById(pickerId);
  if (!user) return { success: false, message: 'User not found.', errorCode: 'AUTH_TOKEN_INVALID', statusCode: 401 };

  if (String(user.status).toUpperCase() === 'SUSPENDED') {
    return { success: false, message: 'Your account has been suspended. Please contact support.', errorCode: 'ACCOUNT_SUSPENDED', statusCode: 403 };
  }

  const { token, expiresAt } = await issueSession(user);
  const { user: dto, nextScreen } = await buildAuthUserDto(user);
  return { success: true, message: 'Token refreshed', token, expiresAt, user: dto, nextScreen };
}

export { buildToken, normalizePhone, normalizeEmail, JWT_SECRET as PICKER_JWT_SECRET, parseWorkforceRole };
