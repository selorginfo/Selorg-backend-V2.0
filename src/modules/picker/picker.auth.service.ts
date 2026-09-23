import crypto from 'crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import {
  PickerUser,
  PickerOtp,
  pickerDisplayRole,
  parseWorkforceRole,
  effectiveWorkforceRole,
  VALID_PICKER_USER_STATUSES,
  type WorkforceRole,
  type PickerUserStatus,
} from './picker.models';
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
 * Rider authentication.
 * Login: checkAccount â†’ LOGIN OTP â†’ status gates â†’ session.
 * Register: checkRegistration (phone & email independently) â†’ REGISTRATION OTP
 *   â†’ create PickerUser(PENDING) + draft onboarding application â†’ session.
 * under_review belongs on PickerOnboardingApplication only â€” never PickerUser.status.
 */

function resolveJwtSecret(): string {
  const secret = process.env.PICKER_JWT_SECRET || process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PICKER_JWT_SECRET or JWT_SECRET must be set in production');
  }
  return 'picker-app-secret-change-in-production';
}

export const PICKER_JWT_SECRET = resolveJwtSecret();
export const PICKER_TOKEN_AUDIENCE = 'picker';

const OTP_EXPIRE_MINUTES = parseInt(process.env.OTP_EXPIRE_MINUTES || '5', 10);
const TOKEN_TTL_DAYS = 7;
const IS_NON_PRODUCTION = process.env.NODE_ENV !== 'production';
const RIDER_APP_NAME = process.env.RIDER_APP_NAME || 'Selorg Rider';
const VALID_STATUS_SET = new Set<string>(VALID_PICKER_USER_STATUSES as readonly string[]);

export type OtpPurpose = 'LOGIN' | 'REGISTRATION';
export type PickerNextScreen =
  | 'main'
  | 'onboarding'
  | 'pending_review'
  | 'rejected'
  | 'suspended'
  | 'inactive'
  | 'blocked'
  | 'deletion_pending'
  | 'create_account';

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
  workforceRole: WorkforceRole;
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
  deliveryStatus?: 'sent' | 'failed';
  exists?: boolean;
  canLogin?: boolean;
  next?: 'OTP' | 'CREATE_ACCOUNT' | 'LOGIN';
  phoneRegistered?: boolean;
  emailRegistered?: boolean;
}

function otpDevFallback(): boolean {
  return Boolean((appConfig as any).otp?.devMode) || !appConfig.isProduction;
}

function riderEmailFrom(): string | undefined {
  return process.env.RIDER_EMAIL_FROM || process.env.PICKER_EMAIL_FROM || process.env.EMAIL_FROM || undefined;
}

export function normalizePhone(phone: unknown): string | null {
  const raw = String(phone ?? '').replace(/\D/g, '');
  let digits = raw;
  if (raw.length === 12 && raw.startsWith('91')) digits = raw.slice(2);
  else if (raw.length === 11 && raw.startsWith('0')) digits = raw.slice(1);
  else if (raw.length > 10) digits = raw.slice(-10);
  if (digits.length !== 10 || /^0+$/.test(digits)) return null;
  return digits;
}

export function normalizeEmail(email: unknown): string | null {
  const s = String(email ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

function emailOtpKey(email: string): string {
  return `email|${email}`;
}

function registrationOtpKey(phone: string): string {
  return `reg|${phone}`;
}

function isDuplicateKeyError(err: unknown): { field?: string } | null {
  const e = err as { code?: number; keyPattern?: Record<string, unknown>; message?: string };
  if (e?.code !== 11000) return null;
  const keys = Object.keys(e.keyPattern || {});
  if (keys.includes('phone')) return { field: 'phone' };
  if (keys.includes('email')) return { field: 'email' };
  const msg = String(e.message || '');
  if (/phone/i.test(msg)) return { field: 'phone' };
  if (/email/i.test(msg)) return { field: 'email' };
  return {};
}

function sanitizeUserStatus(user: { status?: string | null }): PickerUserStatus {
  const raw = String(user.status || 'PENDING').trim();
  const upper = raw.toUpperCase().replace(/-/g, '_');
  if (upper === 'UNDER_REVIEW' || raw === 'under_review' || upper === 'DOCS_REQUIRED' || raw === 'docs_required') {
    user.status = 'PENDING';
    return 'PENDING';
  }
  if (VALID_STATUS_SET.has(upper)) {
    user.status = upper as PickerUserStatus;
    return upper as PickerUserStatus;
  }
  user.status = 'PENDING';
  return 'PENDING';
}

async function safeSaveUser(user: { status?: string | null; save: () => Promise<unknown> }): Promise<void> {
  sanitizeUserStatus(user);
  await user.save();
}

async function reserveSendSlot(identifier: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = new Date();
  const windowMs = pickerConfig.otpThrottleWindowMinutes * 60000;
  const record = await PickerOtp.findOne({ identifier });
  if (record?.windowStartedAt && now.getTime() - new Date(record.windowStartedAt).getTime() < windowMs) {
    if ((record.sendCount || 0) >= pickerConfig.otpMaxSendsPerWindow) {
      const retryAfterSeconds = Math.ceil((new Date(record.windowStartedAt).getTime() + windowMs - now.getTime()) / 1000);
      return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (record) {
    record.windowStartedAt = now;
    record.sendCount = 0;
    await record.save();
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

async function storeOtp(
  identifier: string,
  otp: string,
  purpose: OtpPurpose,
  meta?: { phone?: string; email?: string; userId?: string },
): Promise<void> {
  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60000);
  const existing = (await PickerOtp.findOne({ identifier }).select('windowStartedAt').lean()) as { windowStartedAt?: Date } | null;
  const windowStartedAt = existing?.windowStartedAt || new Date();
  await PickerOtp.findOneAndUpdate(
    { identifier },
    {
      $set: {
        identifier,
        otp,
        expiresAt,
        attempts: 0,
        verified: false,
        windowStartedAt,
        purpose,
        pendingPhone: meta?.phone || null,
        pendingEmail: meta?.email || null,
        pendingUserId: meta?.userId || null,
      },
      $inc: { sendCount: 1 },
    },
    { upsert: true, new: true },
  );
}

type OtpFailCode = 'OTP_EXPIRED' | 'OTP_RATE_LIMITED' | 'INCORRECT_OTP' | 'OTP_PURPOSE_MISMATCH';
type OtpCheck = { ok: true; purpose: OtpPurpose } | { ok: false; errorCode: OtpFailCode };

async function matchOtp(identifier: string, otp: string, expectedPurpose: OtpPurpose): Promise<OtpCheck> {
  const record = await PickerOtp.findOne({ identifier, verified: false, expiresAt: { $gt: new Date() } });
  if (!record) return { ok: false, errorCode: 'OTP_EXPIRED' };
  if ((record.attempts || 0) >= pickerConfig.otpMaxVerifyAttempts) return { ok: false, errorCode: 'OTP_RATE_LIMITED' };
  const purpose = String((record as { purpose?: string }).purpose || 'LOGIN').toUpperCase() as OtpPurpose;
  if (purpose !== expectedPurpose) return { ok: false, errorCode: 'OTP_PURPOSE_MISMATCH' };
  if (record.otp !== String(otp).trim()) {
    record.attempts += 1;
    await record.save();
    if (record.attempts >= pickerConfig.otpMaxVerifyAttempts) return { ok: false, errorCode: 'OTP_RATE_LIMITED' };
    return { ok: false, errorCode: 'INCORRECT_OTP' };
  }
  return { ok: true, purpose };
}

async function consumeOtp(identifier: string): Promise<void> {
  await PickerOtp.findOneAndUpdate({ identifier, verified: false }, { $set: { verified: true } });
}

function otpFailure(errorCode: OtpFailCode): PickerAuthResult {
  if (errorCode === 'OTP_RATE_LIMITED') {
    return { success: false, message: 'Too many incorrect attempts. Please request a new code.', errorCode: 'OTP_TOO_MANY_ATTEMPTS', statusCode: 429 };
  }
  if (errorCode === 'INCORRECT_OTP') {
    return { success: false, message: 'Invalid OTP. Please try again.', errorCode: 'INVALID_OTP', statusCode: 400 };
  }
  if (errorCode === 'OTP_PURPOSE_MISMATCH') {
    return { success: false, message: 'This code cannot be used for this action. Please request a new code.', errorCode: 'OTP_PURPOSE_MISMATCH', statusCode: 400 };
  }
  return { success: false, message: 'OTP has expired. Please request a new code.', errorCode: 'OTP_EXPIRED', statusCode: 400 };
}

function signToken(userId: string, sessionToken: string, workforceRole?: string | null): { token: string; expiresAt: string } {
  const role = parseWorkforceRole(workforceRole);
  const token = jwt.sign(
    { sub: userId, userId, id: userId, sid: sessionToken, ...(role ? { workforceRole: role } : {}) },
    PICKER_JWT_SECRET,
    { expiresIn: `${TOKEN_TTL_DAYS}d`, audience: PICKER_TOKEN_AUDIENCE },
  );
  return { token, expiresAt: new Date(Date.now() + TOKEN_TTL_DAYS * 86400000).toISOString() };
}

async function issueSession(user: {
  _id: unknown;
  sessionToken?: string | null;
  workforceRole?: string | null;
  save: () => Promise<unknown>;
}): Promise<{ token: string; expiresAt: string }> {
  const sessionToken = crypto.randomUUID();
  user.sessionToken = sessionToken;
  await safeSaveUser(user);
  return signToken(String(user._id), sessionToken, user.workforceRole);
}

function buildToken(user: { _id: unknown; sessionToken?: string | null; workforceRole?: string | null }): string {
  return signToken(String(user._id), user.sessionToken || crypto.randomUUID(), user.workforceRole).token;
}

/** Legacy rows without workforceRole are treated as riders (matches dispatch/admin defaults). */
function roleAppLabel(role: WorkforceRole): string {
  return role === 'picker' ? 'Picker' : 'Rider';
}

function roleMismatchResult(expected: WorkforceRole): PickerAuthResult {
  const actual = expected === 'rider' ? 'picker' : 'rider';
  return {
    success: false,
    message: `This account is registered as a ${roleAppLabel(actual).toLowerCase()}. Please use the ${roleAppLabel(actual)} app.`,
    errorCode: 'ROLE_MISMATCH',
    statusCode: 403,
    exists: true,
    canLogin: false,
  };
}

function assertWorkforceRole(
  user: { workforceRole?: WorkforceRole | string | null },
  expected?: WorkforceRole,
): PickerAuthResult | null {
  if (!expected) return null;
  if (effectiveWorkforceRole(user) !== expected) return roleMismatchResult(expected);
  return null;
}

/** Stamp unset role from client; never overwrite an existing role. */
function applyClientWorkforceRole(user: { workforceRole?: WorkforceRole | string | null }, client?: WorkforceRole): void {
  if (!client) return;
  if (!parseWorkforceRole(user.workforceRole)) user.workforceRole = client;
}

async function resolveOnboarding(user: { _id: unknown; status?: string }): Promise<{ onboardingCompleted: boolean; submitted: boolean }> {
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
    case 'INACTIVE': return 'inactive';
    case 'BLOCKED': return 'blocked';
    case 'DELETION_PENDING': return 'deletion_pending';
    default: return submitted ? 'pending_review' : 'onboarding';
  }
}

function loginStatusGate(status: string): PickerAuthResult | null {
  switch (String(status || 'PENDING').toUpperCase()) {
    case 'ACTIVE':
    case 'PENDING':
      return null;
    case 'INACTIVE':
      return { success: false, message: 'Your rider account is inactive. Please contact support.', errorCode: 'ACCOUNT_INACTIVE', statusCode: 403, nextScreen: 'inactive' };
    case 'REJECTED':
      return { success: false, message: 'Your rider application was not approved.', errorCode: 'ACCOUNT_REJECTED', statusCode: 403, nextScreen: 'rejected' };
    case 'SUSPENDED':
      return { success: false, message: 'Your rider account is currently suspended. Please contact support.', errorCode: 'ACCOUNT_SUSPENDED', statusCode: 403, nextScreen: 'suspended' };
    case 'BLOCKED':
      return { success: false, message: 'Your rider account has been blocked. Please contact support.', errorCode: 'ACCOUNT_BLOCKED', statusCode: 403, nextScreen: 'blocked' };
    case 'DELETION_PENDING':
      return { success: false, message: 'Your rider account is scheduled for deletion.', errorCode: 'ACCOUNT_DELETION_PENDING', statusCode: 403, nextScreen: 'deletion_pending' };
    default:
      return null;
  }
}

const BLOCKED_LOGIN_CODES = new Set([
  'ACCOUNT_INACTIVE',
  'ACCOUNT_REJECTED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_BLOCKED',
  'ACCOUNT_DELETION_PENDING',
]);

export async function buildAuthUserDto(user: any): Promise<{ user: PickerAuthUserDto; nextScreen: PickerNextScreen }> {
  sanitizeUserStatus(user);
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
      workforceRole: effectiveWorkforceRole(user),
    },
    nextScreen: resolveNextScreen(user.status, submitted),
  };
}

async function finalizeLogin(user: any, isNewUser: boolean): Promise<PickerAuthResult> {
  sanitizeUserStatus(user);
  const gate = loginStatusGate(String(user.status));
  if (gate) {
    try { await safeSaveUser(user); } catch { /* ignore */ }
    return gate;
  }
  const { token, expiresAt } = await issueSession(user);
  const { user: dto, nextScreen } = await buildAuthUserDto(user);
  if (String(user.status).toUpperCase() === 'PENDING' && nextScreen === 'pending_review') {
    return {
      success: true,
      message: 'Your rider account is pending approval.',
      errorCode: 'ACCOUNT_PENDING',
      token,
      expiresAt,
      isNewUser,
      user: dto,
      nextScreen: 'pending_review',
    };
  }
  return { success: true, message: 'OTP verified', token, expiresAt, isNewUser, user: dto, nextScreen };
}

function logDevOtp(target: string, channel: string, otp: string): void {
  if (IS_NON_PRODUCTION) logger.info(`[DEV] ${RIDER_APP_NAME} OTP for ${target} (${channel}): ${otp}`);
}

export async function checkAccount(
  loginType: unknown,
  value: unknown,
  options: { workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  const expected = options.workforceRole;
  const type = String(loginType || '').trim().toLowerCase();
  if (type === 'phone' || type === 'mobile') {
    const phone = normalizePhone(value);
    if (!phone) return { success: false, message: 'Please provide a valid 10-digit mobile number.', errorCode: 'INVALID_PHONE', statusCode: 400 };
    const user = await PickerUser.findOne({ phone, phoneIsPlaceholder: { $ne: true } }).select('status workforceRole');
    if (!user) {
      return { success: true, message: 'No rider account found with this phone number. Please create an account first.', exists: false, canLogin: false, next: 'CREATE_ACCOUNT', errorCode: 'ACCOUNT_NOT_FOUND' };
    }
    const mismatch = assertWorkforceRole(user, expected);
    if (mismatch) return mismatch;
    sanitizeUserStatus(user);
    const gate = loginStatusGate(String(user.status));
    if (gate && BLOCKED_LOGIN_CODES.has(gate.errorCode || '')) return { ...gate, exists: true, canLogin: false };
    return { success: true, message: 'Rider found. Continue with OTP.', exists: true, canLogin: true, next: 'OTP' };
  }
  if (type === 'email') {
    const email = normalizeEmail(value);
    if (!email) return { success: false, message: 'Please enter a valid email address.', errorCode: 'INVALID_EMAIL', statusCode: 400 };
    const user = await PickerUser.findOne({ email }).select('status workforceRole');
    if (!user) {
      return { success: true, message: 'No rider account found with this email address. Please create an account first.', exists: false, canLogin: false, next: 'CREATE_ACCOUNT', errorCode: 'ACCOUNT_NOT_FOUND' };
    }
    const mismatch = assertWorkforceRole(user, expected);
    if (mismatch) return mismatch;
    sanitizeUserStatus(user);
    const gate = loginStatusGate(String(user.status));
    if (gate && BLOCKED_LOGIN_CODES.has(gate.errorCode || '')) return { ...gate, exists: true, canLogin: false };
    return { success: true, message: 'Rider found. Continue with OTP.', exists: true, canLogin: true, next: 'OTP' };
  }
  return { success: false, message: 'loginType must be phone or email.', errorCode: 'INVALID_INPUT', statusCode: 400 };
}

export async function checkRegistration(
  phoneRaw: unknown,
  emailRaw: unknown,
  options: { workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  const expected = options.workforceRole;
  const phone = normalizePhone(phoneRaw);
  const email = normalizeEmail(emailRaw);
  if (!phone) return { success: false, message: 'Please provide a valid 10-digit mobile number.', errorCode: 'INVALID_PHONE', statusCode: 400 };
  if (!email) return { success: false, message: 'Please enter a valid email address.', errorCode: 'INVALID_EMAIL', statusCode: 400 };

  const [byPhone, byEmail] = await Promise.all([
    PickerUser.findOne({ phone, phoneIsPlaceholder: { $ne: true } }).select('_id workforceRole'),
    PickerUser.findOne({ email }).select('_id workforceRole'),
  ]);
  const phoneRegistered = Boolean(byPhone);
  const emailRegistered = Boolean(byEmail);

  if (expected) {
    if (byPhone && assertWorkforceRole(byPhone, expected)) {
      return { ...roleMismatchResult(expected), phoneRegistered: true, emailRegistered, next: 'LOGIN' };
    }
    if (byEmail && assertWorkforceRole(byEmail, expected)) {
      return { ...roleMismatchResult(expected), phoneRegistered, emailRegistered: true, next: 'LOGIN' };
    }
  }

  if (phoneRegistered && emailRegistered) {
    return { success: false, message: 'This phone number and email address are already registered. Please login instead.', errorCode: 'PHONE_AND_EMAIL_ALREADY_REGISTERED', statusCode: 409, phoneRegistered: true, emailRegistered: true, next: 'LOGIN' };
  }
  if (phoneRegistered) {
    return { success: false, message: 'This phone number is already registered. Please login using this number instead.', errorCode: 'PHONE_ALREADY_REGISTERED', statusCode: 409, phoneRegistered: true, emailRegistered: false, next: 'LOGIN' };
  }
  if (emailRegistered) {
    return { success: false, message: 'This email address is already registered. Please login using this email instead.', errorCode: 'EMAIL_ALREADY_REGISTERED', statusCode: 409, phoneRegistered: false, emailRegistered: true, next: 'LOGIN' };
  }
  return { success: true, message: 'Phone and email are available. Continue with registration OTP.', phoneRegistered: false, emailRegistered: false, next: 'OTP' };
}

export async function sendOtp(
  phone: unknown,
  options: { preferredChannel?: string; purpose?: string; workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  if (String(options.purpose || 'LOGIN').toUpperCase() === 'REGISTRATION') {
    return { success: false, message: 'Use the registration endpoint with phone and email.', errorCode: 'INVALID_INPUT', statusCode: 400 };
  }
  const trimmed = normalizePhone(phone);
  if (!trimmed) return { success: false, message: 'Please provide a valid 10-digit mobile number.', errorCode: 'INVALID_PHONE', statusCode: 400 };

  const existing = await PickerUser.findOne({ phone: trimmed, phoneIsPlaceholder: { $ne: true } }).select('_id status workforceRole');
  if (!existing) {
    return { success: false, message: 'No rider account found with this phone number. Please create an account first.', errorCode: 'ACCOUNT_NOT_FOUND', statusCode: 404, exists: false, canLogin: false, next: 'CREATE_ACCOUNT' };
  }
  const mismatch = assertWorkforceRole(existing, options.workforceRole);
  if (mismatch) return mismatch;
  sanitizeUserStatus(existing);
  const gate = loginStatusGate(String(existing.status));
  if (gate && BLOCKED_LOGIN_CODES.has(gate.errorCode || '')) return { ...gate, exists: true, canLogin: false };

  const channel = String(options.preferredChannel || 'sms').toLowerCase() === 'whatsapp' ? 'whatsapp' : 'sms';
  const slot = await reserveSendSlot(trimmed);
  if (!slot.allowed) {
    return { success: false, message: `Too many OTP requests. Please try again in ${Math.ceil(slot.retryAfterSeconds / 60)} minute(s).`, errorCode: 'OTP_RATE_LIMITED', statusCode: 429, retryAfterSeconds: slot.retryAfterSeconds };
  }

  const otp = generateOtp(4);
  logDevOtp(trimmed, channel, otp);
  const delivery = await awaitOtpDelivery(`${channel.toUpperCase()} OTP`, trimmed, () => deliverOtpToPhone(trimmed, otp, channel, OTP_EXPIRE_MINUTES));
  if (!delivery.sent && !otpDevFallback()) {
    logger.error('[PickerAuth] LOGIN SMS/WhatsApp OTP delivery failed', { phone: trimmed, channel, errorCode: delivery.errorCode, provider: delivery.provider, message: delivery.message });
    return { success: false, message: delivery.message || 'Unable to send OTP. Please try again.', errorCode: delivery.errorCode || 'OTP_PROVIDER_ERROR', statusCode: 502, channel, deliveryStatus: 'failed' };
  }
  await storeOtp(trimmed, otp, 'LOGIN', { phone: trimmed, userId: String(existing._id) });
  return { success: true, message: 'OTP sent successfully', channel: delivery.channel || channel, deliveryStatus: delivery.sent ? 'sent' : 'failed' };
}

export async function resendOtp(
  phone: unknown,
  options: { preferredChannel?: string; purpose?: string; workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  return sendOtp(phone, options);
}

export async function verifyOtp(
  phone: unknown,
  otp: unknown,
  options: { preferredChannel?: string; storeId?: string; intent?: string; purpose?: string; workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  const purpose = String(options.purpose || options.intent || 'LOGIN').toUpperCase();
  if (purpose === 'SIGNUP' || purpose === 'REGISTRATION') {
    return { success: false, message: 'Use the registration verify endpoint with phone and email.', errorCode: 'INVALID_INPUT', statusCode: 400 };
  }
  const otpStr = String(otp ?? '').trim();
  if (!/^\d{4}$/.test(otpStr)) return { success: false, message: 'OTP must be exactly 4 numeric digits', errorCode: 'INVALID_OTP', statusCode: 400 };
  const trimmed = normalizePhone(phone);
  if (!trimmed) return { success: false, message: 'Invalid phone number.', errorCode: 'INVALID_PHONE', statusCode: 400 };

  const check = await matchOtp(trimmed, otpStr, 'LOGIN');
  if (!check.ok) return otpFailure(check.errorCode);

  const user = await PickerUser.findOne({ phone: trimmed });
  if (!user) {
    return { success: false, message: 'No rider account found with this phone number. Please create an account first.', errorCode: 'ACCOUNT_NOT_FOUND', statusCode: 404, next: 'CREATE_ACCOUNT' };
  }
  const mismatch = assertWorkforceRole(user, options.workforceRole);
  if (mismatch) return mismatch;
  await consumeOtp(trimmed);
  user.loginMethod = String(options.preferredChannel || 'sms').toLowerCase() === 'whatsapp' ? 'whatsapp' : 'mobile';
  if (user.phoneIsPlaceholder) user.phoneIsPlaceholder = false;
  applyClientWorkforceRole(user, options.workforceRole);
  if (options.storeId && mongoose.Types.ObjectId.isValid(options.storeId)) {
    (user as any).storeId = new mongoose.Types.ObjectId(options.storeId);
  }
  return finalizeLogin(user, false);
}

export async function sendOtpEmail(
  email: unknown,
  options: { purpose?: string; workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  if (String(options.purpose || 'LOGIN').toUpperCase() === 'REGISTRATION') {
    return { success: false, message: 'Use the registration endpoint with phone and email.', errorCode: 'INVALID_INPUT', statusCode: 400 };
  }
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return { success: false, message: 'Please enter a valid email address.', errorCode: 'INVALID_EMAIL', statusCode: 400 };

  const existing = await PickerUser.findOne({ email: normalizedEmail }).select('_id status workforceRole');
  if (!existing) {
    return { success: false, message: 'No rider account found with this email address. Please create an account first.', errorCode: 'ACCOUNT_NOT_FOUND', statusCode: 404, exists: false, canLogin: false, next: 'CREATE_ACCOUNT' };
  }
  const mismatch = assertWorkforceRole(existing, options.workforceRole);
  if (mismatch) return mismatch;
  sanitizeUserStatus(existing);
  const gate = loginStatusGate(String(existing.status));
  if (gate && BLOCKED_LOGIN_CODES.has(gate.errorCode || '')) return { ...gate, exists: true, canLogin: false };

  const identifier = emailOtpKey(normalizedEmail);
  const slot = await reserveSendSlot(identifier);
  if (!slot.allowed) {
    return { success: false, message: `Too many OTP requests. Please try again in ${Math.ceil(slot.retryAfterSeconds / 60)} minute(s).`, errorCode: 'OTP_RATE_LIMITED', statusCode: 429, retryAfterSeconds: slot.retryAfterSeconds };
  }
  const otp = generateOtp(4);
  logDevOtp(normalizedEmail, 'email', otp);
  const delivery = await awaitOtpDelivery('Email OTP', normalizedEmail, () =>
    deliverOtpToEmail({ email: normalizedEmail, otp, expiresInMinutes: OTP_EXPIRE_MINUTES, appName: RIDER_APP_NAME, from: riderEmailFrom() }),
  );
  if (!delivery.sent && !otpDevFallback()) {
    logger.error('[PickerAuth] LOGIN email OTP delivery failed', { email: normalizedEmail, provider: delivery.provider, message: delivery.message, errorCode: delivery.errorCode });
    return { success: false, message: delivery.message || 'Unable to send OTP. Please try again.', errorCode: delivery.errorCode || 'EMAIL_PROVIDER_ERROR', statusCode: 502, channel: 'email', deliveryStatus: 'failed' };
  }
  await storeOtp(identifier, otp, 'LOGIN', { email: normalizedEmail, userId: String(existing._id) });
  return { success: true, message: 'OTP sent successfully', channel: 'email', deliveryStatus: delivery.sent ? 'sent' : 'failed' };
}

export async function resendOtpEmail(
  email: unknown,
  options: { purpose?: string; workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  return sendOtpEmail(email, options);
}

export async function verifyOtpEmail(
  email: unknown,
  otp: unknown,
  options: { intent?: string; purpose?: string; workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  const purpose = String(options.purpose || options.intent || 'LOGIN').toUpperCase();
  if (purpose === 'SIGNUP' || purpose === 'REGISTRATION') {
    return { success: false, message: 'Use the registration verify endpoint with phone and email.', errorCode: 'INVALID_INPUT', statusCode: 400 };
  }
  const normalizedEmail = normalizeEmail(email);
  const otpStr = String(otp ?? '').trim();
  if (!normalizedEmail) return { success: false, message: 'Please enter a valid email address.', errorCode: 'INVALID_EMAIL', statusCode: 400 };
  if (!/^\d{4}$/.test(otpStr)) return { success: false, message: 'OTP must be exactly 4 numeric digits', errorCode: 'INVALID_OTP', statusCode: 400 };

  const identifier = emailOtpKey(normalizedEmail);
  const check = await matchOtp(identifier, otpStr, 'LOGIN');
  if (!check.ok) return otpFailure(check.errorCode);

  const user = await PickerUser.findOne({ email: normalizedEmail });
  if (!user) {
    return { success: false, message: 'No rider account found with this email address. Please create an account first.', errorCode: 'ACCOUNT_NOT_FOUND', statusCode: 404, next: 'CREATE_ACCOUNT' };
  }
  const mismatch = assertWorkforceRole(user, options.workforceRole);
  if (mismatch) return mismatch;
  await consumeOtp(identifier);
  user.loginMethod = 'email';
  applyClientWorkforceRole(user, options.workforceRole);
  return finalizeLogin(user, false);
}

export async function sendRegistrationOtp(
  phoneRaw: unknown,
  emailRaw: unknown,
  options: { preferredChannel?: string; workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  const precheck = await checkRegistration(phoneRaw, emailRaw, { workforceRole: options.workforceRole });
  if (!precheck.success) return precheck;
  const phone = normalizePhone(phoneRaw)!;
  const email = normalizeEmail(emailRaw)!;
  const identifier = registrationOtpKey(phone);

  const slot = await reserveSendSlot(identifier);
  if (!slot.allowed) {
    return { success: false, message: `Too many OTP requests. Please try again in ${Math.ceil(slot.retryAfterSeconds / 60)} minute(s).`, errorCode: 'OTP_RATE_LIMITED', statusCode: 429, retryAfterSeconds: slot.retryAfterSeconds };
  }
  const otp = generateOtp(4);
  logDevOtp(email, 'registration/email', otp);
  const delivery = await awaitOtpDelivery('REGISTRATION Email OTP', email, () =>
    deliverOtpToEmail({
      email,
      otp,
      expiresInMinutes: OTP_EXPIRE_MINUTES,
      appName: RIDER_APP_NAME,
      from: riderEmailFrom(),
    }),
  );
  if (!delivery.sent && !otpDevFallback()) {
    logger.error('[PickerAuth] REGISTRATION email OTP delivery failed', {
      email,
      phone,
      provider: delivery.provider,
      message: delivery.message,
      errorCode: delivery.errorCode,
    });
    return {
      success: false,
      message: delivery.message || 'Unable to send OTP to email. Please try again.',
      errorCode: delivery.errorCode || 'EMAIL_PROVIDER_ERROR',
      statusCode: 502,
      channel: 'email',
      deliveryStatus: 'failed',
    };
  }
  await storeOtp(identifier, otp, 'REGISTRATION', { phone, email });
  return {
    success: true,
    message: 'Registration OTP sent to your email.',
    channel: 'email',
    deliveryStatus: delivery.sent ? 'sent' : 'failed',
  };
}

export async function resendRegistrationOtp(
  phoneRaw: unknown,
  emailRaw: unknown,
  options: { preferredChannel?: string; workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  return sendRegistrationOtp(phoneRaw, emailRaw, options);
}

export async function verifyRegistrationOtp(
  phoneRaw: unknown,
  emailRaw: unknown,
  otp: unknown,
  options: { preferredChannel?: string; workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  const phone = normalizePhone(phoneRaw);
  const email = normalizeEmail(emailRaw);
  const otpStr = String(otp ?? '').trim();
  if (!phone) return { success: false, message: 'Please provide a valid 10-digit mobile number.', errorCode: 'INVALID_PHONE', statusCode: 400 };
  if (!email) return { success: false, message: 'Please enter a valid email address.', errorCode: 'INVALID_EMAIL', statusCode: 400 };
  if (!/^\d{4}$/.test(otpStr)) return { success: false, message: 'OTP must be exactly 4 numeric digits', errorCode: 'INVALID_OTP', statusCode: 400 };

  const identifier = registrationOtpKey(phone);
  const check = await matchOtp(identifier, otpStr, 'REGISTRATION');
  if (!check.ok) return otpFailure(check.errorCode);

  const precheck = await checkRegistration(phone, email, { workforceRole: options.workforceRole });
  if (!precheck.success) return precheck;

  const otpRecord = (await PickerOtp.findOne({ identifier }).lean()) as { pendingEmail?: string } | null;
  if (otpRecord?.pendingEmail && normalizeEmail(otpRecord.pendingEmail) !== email) {
    return { success: false, message: 'Email does not match the registration request. Please restart registration.', errorCode: 'INVALID_INPUT', statusCode: 400 };
  }

  await consumeOtp(identifier);
  const loginMethod = 'email';
  const createRole = options.workforceRole || 'rider';

  let user: any;
  try {
    user = await PickerUser.create({
      phone,
      email,
      phoneIsPlaceholder: false,
      loginMethod,
      status: 'PENDING',
      workforceRole: createRole,
    });
  } catch (err) {
    const dup = isDuplicateKeyError(err);
    if (dup?.field === 'phone') {
      return { success: false, message: 'This phone number is already registered. Please login using this number instead.', errorCode: 'PHONE_ALREADY_REGISTERED', statusCode: 409, next: 'LOGIN' };
    }
    if (dup?.field === 'email') {
      return { success: false, message: 'This email address is already registered. Please login using this email instead.', errorCode: 'EMAIL_ALREADY_REGISTERED', statusCode: 409, next: 'LOGIN' };
    }
    if (dup) {
      return { success: false, message: 'This account is already registered. Please login instead.', errorCode: 'PHONE_AND_EMAIL_ALREADY_REGISTERED', statusCode: 409, next: 'LOGIN' };
    }
    logger.error('[PickerAuth] Registration create failed', { err: (err as Error)?.message });
    return { success: false, message: 'Unable to create account. Please try again.', errorCode: 'SERVER_ERROR', statusCode: 500 };
  }

  try {
    const count = await PickerOnboardingApplication.countDocuments();
    await PickerOnboardingApplication.create({
      applicationId: `SL-RA-${2000 + count + 1}`,
      pickerId: user._id,
      status: 'draft',
      stepsAtSubmission: {},
    });
  } catch (err) {
    logger.warn('[PickerAuth] Onboarding application create failed (non-fatal)', { err: (err as Error)?.message, pickerId: String(user._id) });
  }

  return finalizeLogin(user, true);
}

export async function logout(pickerId: string): Promise<{ loggedOut: boolean }> {
  await PickerUser.updateOne({ _id: pickerId }, { $set: { sessionToken: null, isOnline: false, onlineSince: null } });
  return { loggedOut: true };
}

export async function refreshSession(
  pickerId: string,
  options: { workforceRole?: WorkforceRole } = {},
): Promise<PickerAuthResult> {
  const user = await PickerUser.findById(pickerId);
  if (!user) return { success: false, message: 'User not found.', errorCode: 'AUTH_TOKEN_INVALID', statusCode: 401 };
  const mismatch = assertWorkforceRole(user, options.workforceRole);
  if (mismatch) return mismatch;
  sanitizeUserStatus(user);
  const gate = loginStatusGate(String(user.status));
  if (gate && BLOCKED_LOGIN_CODES.has(gate.errorCode || '')) return gate;
  applyClientWorkforceRole(user, options.workforceRole);
  const { token, expiresAt } = await issueSession(user);
  const { user: dto, nextScreen } = await buildAuthUserDto(user);
  return { success: true, message: 'Token refreshed', token, expiresAt, user: dto, nextScreen };
}

export { buildToken, parseWorkforceRole, effectiveWorkforceRole };
