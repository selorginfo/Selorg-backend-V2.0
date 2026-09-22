import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { AppError } from '../../utils/AppError';
import { appConfig } from '../../config/env';
import { generateOtp, verifyOtp as verifyOtpHash, signCustomerToken, revokeToken, hashOtp, getOtpExpiryDate } from '../../utils/auth';
import { sendOtpSms, sendOtpWhatsApp } from '../../services/sms.service';
import { sendOtpEmail, isEmailConfigured } from '../../services/email.service';
import { recordAuditLog } from '../../services/audit.service';
import { sanitizeCustomerEmail } from '../../utils/customerDisplay';
import { logger } from '../../utils/logger';
import * as authRepo from './auth.repository';
import { ICustomerUser, IOtpSession } from './auth.model';

const ACCESS_EXPIRES_SECONDS = Number(process.env.JWT_ACCESS_EXPIRES_SECONDS) || 60 * 60 * 24;

/**
 * Verifies `otp` against `session`, tracking attempts and locking the session out (burning it,
 * so a guessed sessionId can't be retried) once `appConfig.otp.maxVerifyAttempts` is exceeded.
 * Throws AppError on wrong/locked OTP; returns silently when correct (caller still marks verified).
 */
async function checkOtpAttempt(session: IOtpSession, otp: string): Promise<void> {
  const ok = verifyOtpHash(otp, session.otpHash);
  session.attemptCount = (session.attemptCount || 0) + 1;
  if (!ok && session.attemptCount >= appConfig.otp.maxVerifyAttempts) {
    session.verified = true;
    session.verifiedAt = new Date();
    await session.save();
    throw new AppError('Too many incorrect attempts. Please request a new code.', 429, 'OTP_LOCKED');
  }
  await session.save();
  if (!ok) throw AppError.badRequest('Invalid OTP');
}

/** Exported for reuse by modules/user (profile updates must route phone changes through OTP link). */
export function normalizePhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function normalizeEmail(email: string): string | null {
  const e = String(email || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export function isPhoneLocked(user: Pick<ICustomerUser, 'phoneVerified' | 'phoneNumber'> | null): boolean {
  if (!user) return false;
  const digits = normalizePhone(user.phoneNumber || '');
  return !!(user.phoneVerified && digits.length === 10);
}

function generateSecurePassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const randomBytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) password += chars[randomBytes[i] % chars.length];
  return password;
}

function pickTestOtp(digits: string): string | null {
  const testMobile = normalizePhone(appConfig.otp.testMobile);
  return appConfig.otp.allowFixedTestOtp && digits === testMobile ? appConfig.otp.testOtp : null;
}

/** Provider-agnostic OTP delivery result — both phone and email delivery normalize to this shape. */
interface OtpDeliveryResult {
  sent: boolean;
  channel?: string;
  provider?: string;
  message?: string;
}

/** Sends an OTP over SMS or WhatsApp; returns a provider-agnostic result. */
async function deliverOtpToPhone(digits: string, otp: string, channel: string): Promise<OtpDeliveryResult> {
  const result =
    String(channel || 'sms').toLowerCase() === 'whatsapp' ? await sendOtpWhatsApp(digits, otp) : await sendOtpSms(digits, otp);
  return { sent: result.sent, channel: result.channel, provider: result.provider, message: result.userMessage || result.internalLog };
}

async function deliverOtpToEmail(email: string, otp: string): Promise<OtpDeliveryResult> {
  const expireMinutes = Math.max(1, Math.floor(appConfig.otp.ttlSeconds / 60));
  if (isEmailConfigured()) {
    const result = await sendOtpEmail({
      to: email,
      otp,
      expiresInMinutes: expireMinutes,
      appName: appConfig.customerAppName,
      // Resend rewrites this to the account's verified sender; the display name
      // is preserved. `CUSTOMER_EMAIL_FROM` keeps it as "Selorg" not "Selorg Admin".
      from: process.env.CUSTOMER_EMAIL_FROM || process.env.EMAIL_FROM,
    });
    return { sent: result.sent, channel: result.channel || 'email', provider: result.provider, message: result.userMessage || result.internalError };
  }
  if (appConfig.otp.devMode || !appConfig.isProduction) {
    logger.info(`[DEV] ${appConfig.customerAppName} email OTP for ${email}: ${otp}`);
    return { sent: true, channel: 'email' };
  }
  return { sent: false, message: 'Email OTP is not configured on the server. Please use Mobile or WhatsApp login.' };
}

export interface SendOtpParams {
  phoneNumber?: string;
  email?: string;
  channel?: string;
  preferredChannel?: string;
  /**
   * 'login'  -> reject if no customer exists for this phone/email (USER_NOT_FOUND).
   * 'signup' -> proceed; the account is created on verify.
   * undefined -> legacy auto-upsert behaviour.
   */
  intent?: 'login' | 'signup';
}

// How long the API waits for the OTP provider before responding anyway. If the
// gateway answers within this window with a hard failure we surface it; otherwise
// the response returns immediately and delivery finishes in the background. This
// is what stops the app sitting on a spinner for 1-2 minutes when a gateway is slow.
const OTP_DELIVERY_WAIT_MS = Math.max(
  1000,
  Math.min(8000, parseInt(process.env.OTP_DELIVERY_WAIT_MS || '3500', 10)),
);

interface RacedDelivery {
  /** true only when the provider settled within OTP_DELIVERY_WAIT_MS. */
  settled: boolean;
  result?: OtpDeliveryResult;
}

/**
 * Starts OTP delivery, races it against OTP_DELIVERY_WAIT_MS, and always keeps the
 * delivery promise alive in the background (with logging) regardless of the race.
 */
function raceOtpDelivery(
  label: string,
  target: string,
  start: () => Promise<OtpDeliveryResult>,
): Promise<RacedDelivery> {
  const delivery = start();
  // Background completion + logging — never throws out of here.
  void delivery
    .then((r) => {
      if (r.sent) {
        logger.info(`[OTP] ${label} delivered to ${target} via ${r.provider || r.channel || 'provider'}`);
      } else {
        logger.warn(`[OTP] ${label} delivery to ${target} failed: ${r.message || 'unknown error'}`);
      }
    })
    .catch((e) => logger.error(`[OTP] ${label} delivery to ${target} threw: ${(e as Error)?.message}`));

  return Promise.race<RacedDelivery>([
    delivery.then((result) => ({ settled: true, result })),
    new Promise<RacedDelivery>((resolve) =>
      setTimeout(() => resolve({ settled: false }), OTP_DELIVERY_WAIT_MS),
    ),
  ]);
}
/**
 * 'sent'    - provider confirmed acceptance before OTP_DELIVERY_WAIT_MS.
 * 'failed'  - provider rejected the message outright; no OTP will arrive.
 * 'pending' - provider hadn't answered yet; delivery continues in the background.
 */
export type OtpDeliveryStatus = 'sent' | 'failed' | 'pending';

export interface SendOtpResult {
  sessionId: string;
  channel: string;
  resendCooldownSeconds: number;
  deliveryStatus?: 'sent' | 'failed' | 'pending';
  devNote?: string;
}

interface ResolvedDelivery {
  deliveryStatus: OtpDeliveryStatus;
  devNote?: string;
}

/**
 * Turns a raced delivery into a truthful, caller-facing result.
 *
 * In production a hard provider rejection is a 502 — the client must not show an
 * "enter the code" screen for an OTP that was never sent. Outside production we keep
 * the 200 (the code is on the console, so local testing stays unblocked) but the
 * response reports `deliveryStatus: 'failed'` and carries the provider's reason
 * instead of silently claiming success.
 */
function resolveDelivery(
  raced: RacedDelivery,
  devFallback: boolean,
  target: string,
  fallbackMessage: string,
  appCode: 'OTP_PROVIDER_ERROR' | 'EMAIL_PROVIDER_ERROR' = 'OTP_PROVIDER_ERROR',
): ResolvedDelivery {
  if (!raced.settled) return { deliveryStatus: 'pending' };
  if (raced.result?.sent) return { deliveryStatus: 'sent' };

  const reason = raced.result?.message || fallbackMessage;
  if (!devFallback) throw new AppError(reason, 502, appCode);

  logger.error(`[OTP] NOT DELIVERED to ${target} — ${reason}. Returning 200 because this is a non-production environment; the code above is console-only.`);
  return { deliveryStatus: 'failed', devNote: `SMS was NOT delivered: ${reason}` };
}

export async function sendOtp(params: SendOtpParams): Promise<SendOtpResult> {
  const channel = String(params.preferredChannel || params.channel || 'sms').toLowerCase();

  if (params.email || channel === 'email') {
    const normalizedEmail = normalizeEmail(params.email || '');
    if (!normalizedEmail) throw AppError.badRequest('Valid email address required');

    // Login OTP is allowed without an existing account (OTP login = login-or-register).
    // Signup still rejects emails that already belong to an account.
    if (params.intent === 'signup') {
      const existing = await authRepo.findCustomerByEmail(normalizedEmail);
      if (existing) {
        throw new AppError(
          'An account with this email already exists. Please log in.',
          409,
          'EMAIL_EXISTS',
        );
      }
    }

    if (!isEmailConfigured() && !(appConfig.otp.devMode || !appConfig.isProduction)) {
      throw new AppError('Email OTP is not configured on the server. Please use Mobile or WhatsApp login.', 503, 'EMAIL_NOT_CONFIGURED');
    }

    const otp = generateOtp(4);
    logger.info(`[sendOtp] Generated email OTP for ${normalizedEmail}`);
    // Resend/SMTP reporting "sent" only means the provider accepted the message — it can
    // still land in spam or bounce from an unverified sender domain with no error surfaced
    // here. Print the code in non-production so local testing never depends on that actually
    // reaching the inbox (mirrors the phone path).
    const devFallback = appConfig.otp.devMode || !appConfig.isProduction;
    if (devFallback) {
      logger.info(`[DEV] ${appConfig.customerAppName} OTP for ${normalizedEmail} (email): ${otp}`);
    }
    const sessionId = await authRepo.createOtpSession({
      email: normalizedEmail,
      otp,
      channel: 'email',
      intent: params.intent,
      ttlSeconds: appConfig.otp.ttlSeconds,
    });

    // Don't block the response on SMTP/Resend — deliver in the background and only
    // surface an error if the provider fails *fast* (within OTP_DELIVERY_WAIT_MS).
    const raced = await raceOtpDelivery('Email OTP', normalizedEmail, () => deliverOtpToEmail(normalizedEmail, otp));
    if (raced.settled && !raced.result?.sent && !devFallback) {
      throw new AppError(raced.result?.message || 'Failed to send OTP email. Please try again.', 502, 'EMAIL_PROVIDER_ERROR');
    }
    const emailDeliveryStatus = !raced.settled ? 'pending' : raced.result?.sent ? 'sent' : 'failed';
    return {
      sessionId,
      channel: raced.result?.channel || 'email',
      resendCooldownSeconds: appConfig.otp.resendCooldownSeconds,
      deliveryStatus: emailDeliveryStatus,
    };
  }

  if (!params.phoneNumber) throw AppError.badRequest('phoneNumber or email required');
  const digits = normalizePhone(params.phoneNumber);
  if (digits.length !== 10 || /^0+$/.test(digits)) throw AppError.badRequest('phoneNumber must be exactly 10 digits');

  // Login OTP is allowed without an existing account (OTP login = login-or-register).
  // Signup still rejects phones that already belong to an account.
  if (params.intent === 'signup') {
    const existing = await authRepo.findCustomerByPhone(digits);
    if (existing) {
      throw new AppError(
        'An account with this phone number already exists. Please log in.',
        409,
        'PHONE_EXISTS',
      );
    }
  }

  const otp = pickTestOtp(digits) || generateOtp(4);
  logger.info(`[sendOtp] Generated OTP for ${digits}`);
  // Twilio's API only confirms the message was *queued*, not delivered — a WhatsApp
  // sandbox number that hasn't opted in (sent "join <code>") silently never receives
  // it, with no error surfaced here. Print the code in non-production so local/dev
  // testing doesn't depend on that delivery actually working, mirroring the email path.
  if (appConfig.otp.devMode || !appConfig.isProduction) {
    logger.info(`[DEV] ${appConfig.customerAppName} OTP for ${digits} (${channel}): ${otp}`);
  }

  const devFallback = appConfig.otp.devMode || !appConfig.isProduction;
  const deliveredChannel = channel === 'whatsapp' ? 'whatsapp' : 'sms';

  // Create the session first so the client gets a sessionId back straight away,
  // then deliver the code in the background. A slow SMS gateway no longer keeps
  // the app waiting on a spinner for a minute or two.
  const sessionId = await authRepo.createOtpSession({
    phoneNumber: digits,
    otp,
    channel: deliveredChannel,
    intent: params.intent,
    ttlSeconds: appConfig.otp.ttlSeconds,
  });

  const raced = await raceOtpDelivery(
    `${deliveredChannel.toUpperCase()} OTP`,
    digits,
    () => deliverOtpToPhone(digits, otp, channel),
  );
  const delivery = resolveDelivery(raced, devFallback, digits, 'Failed to send OTP');

  const deliveryStatus = !raced.settled ? 'pending' : raced.result?.sent ? 'sent' : 'failed';
  return {
    sessionId,
    channel: raced.result?.channel || deliveredChannel,
    resendCooldownSeconds: appConfig.otp.resendCooldownSeconds,
    deliveryStatus,
    ...(devFallback && deliveryStatus === 'failed'
      ? { devNote: 'SMS delivery failed — OTP is in the server console logs (search [DEV])' }
      : {}),
  };
}

export interface VerifyOtpResult {
  accessToken: string;
  isNewUser: boolean;
  user: { _id: string; phoneNumber?: string; email: string | null; name: string; phoneVerified: boolean };
  autoGeneratedPassword?: string;
}

export async function verifyOtp(
  sessionId: string,
  otp: string,
  context: { ip?: string; userAgent?: string } = {},
): Promise<VerifyOtpResult> {
  const session = await authRepo.findOtpSessionById(sessionId);
  if (!session) throw AppError.badRequest('Invalid session');
  if (session.purpose === 'link_phone') {
    throw new AppError('Use phone verify endpoint to link this number to your account', 400, 'LINK_PHONE_SESSION');
  }
  if (session.verified) throw AppError.badRequest('OTP already used');
  if (session.otpExpiresAt && session.otpExpiresAt < new Date()) throw AppError.badRequest('OTP expired');

  // Signup still rejects identifiers that already belong to an account.
  // Login sessions may create the user on first verify (upsertCustomerUser).
  if (session.intent === 'signup') {
    const existing = session.email
      ? await authRepo.findCustomerByEmail(session.email)
      : session.phoneNumber
      ? await authRepo.findCustomerByPhone(session.phoneNumber)
      : null;
    if (existing) {
      throw new AppError(
        `An account with this ${session.email ? 'email' : 'phone number'} already exists. Please log in.`,
        409,
        session.email ? 'EMAIL_EXISTS' : 'PHONE_EXISTS',
      );
    }
  }

  await checkOtpAttempt(session, otp);

  session.verified = true;
  session.verifiedAt = new Date();
  await session.save();

  const { user, isNewUser } = await authRepo.upsertCustomerUser(session);
  const now = new Date();

  // The plaintext password is returned once in this response and never persisted —
  // only its bcrypt hash is stored, so it cannot be recovered from the database later.
  let autoGeneratedPassword: string | undefined;
  if (isNewUser) {
    try {
      const plainPassword = generateSecurePassword(8);
      const passwordHash = await bcrypt.hash(plainPassword, 10);
      await authRepo.findCustomerById(String(user._id)).then((doc) => {
        if (!doc) return;
        doc.passwordHash = passwordHash;
        doc.isPasswordAutoGenerated = true;
        doc.passwordLastChangedAt = now;
        doc.passwordLastChangedBy = 'system';
        return doc.save();
      });
      autoGeneratedPassword = plainPassword;
    } catch (pwErr) {
      logger.warn('Auto-generate password failed (non-blocking)', { error: (pwErr as Error).message });
    }
  }

  await recordAuditLog({
    module: 'customer',
    action: isNewUser ? 'USER_REGISTERED' : 'USER_LOGIN',
    entityType: 'CustomerUser',
    entityId: String(user._id),
    severity: 'info',
    details: { phoneNumber: user.phoneNumber, email: user.email, channel: session.channel, isNewUser },
    ipAddress: context.ip,
    userAgent: context.userAgent,
  });

  const publicEmail = sanitizeCustomerEmail(user.email);
  const payload = { sub: String(user._id), phoneNumber: user.phoneNumber, email: publicEmail || undefined };
  const accessToken = signCustomerToken(payload, ACCESS_EXPIRES_SECONDS);

  return {
    accessToken,
    isNewUser,
    user: {
      _id: String(user._id),
      phoneNumber: user.phoneNumber,
      email: publicEmail || null,
      name: user.name || '',
      phoneVerified: user.phoneVerified,
    },
    ...(isNewUser && autoGeneratedPassword ? { autoGeneratedPassword } : {}),
  };
}

export interface ResendOtpResult {
  channel: string;
  resendCooldownSeconds: number;
  deliveryStatus?: 'sent' | 'failed' | 'pending';
}

export async function resendOtp(sessionId: string, requesterId?: string): Promise<ResendOtpResult> {
  const session = await authRepo.findOtpSessionById(sessionId);
  if (!session) throw AppError.badRequest('Invalid session');
  if (session.purpose === 'link_phone') {
    if (!requesterId || String(session.userId || '') !== String(requesterId)) {
      throw AppError.forbidden('OTP session does not belong to this account');
    }
  }
  if (session.verified) throw AppError.badRequest('OTP already used');
  if (session.otpSentAt && Date.now() - session.otpSentAt.getTime() < appConfig.otp.resendCooldownSeconds * 1000) {
    throw new AppError('Resend cooldown active', 429, 'RESEND_COOLDOWN');
  }

  const channel = String(session.channel || 'sms').toLowerCase();
  const otp =
    channel !== 'email' && session.phoneNumber && pickTestOtp(normalizePhone(session.phoneNumber))
      ? (pickTestOtp(normalizePhone(session.phoneNumber)) as string)
      : generateOtp(4);

  const isEmail = channel === 'email' && !!session.email;
  const target = isEmail ? session.email! : normalizePhone(session.phoneNumber || '');
  const devFallback = appConfig.otp.devMode || !appConfig.isProduction;

  // Persist the new code first, then deliver in the background (same as sendOtp)
  // so a slow gateway can't hang the resend request.
  session.otpHash = hashOtp(otp);
  session.otpSentAt = new Date();
  session.otpExpiresAt = getOtpExpiryDate(appConfig.otp.ttlSeconds);
  session.resendCount = (session.resendCount || 0) + 1;
  await session.save();

  const raced = await raceOtpDelivery(
    isEmail ? 'Email OTP (resend)' : 'SMS OTP (resend)',
    target,
    () => (isEmail ? deliverOtpToEmail(session.email!, otp) : deliverOtpToPhone(target, otp, channel)),
  );
  const delivery = resolveDelivery(raced, devFallback, target, 'Failed to resend OTP');
  if (raced.result?.channel && raced.result.channel !== session.channel) {
    session.channel = raced.result.channel;
    await session.save();
  }

  const resendDeliveryStatus = !raced.settled ? 'pending' : raced.result?.sent ? 'sent' : 'failed';
  return { channel: session.channel, resendCooldownSeconds: appConfig.otp.resendCooldownSeconds, deliveryStatus: resendDeliveryStatus };
}

/** Revokes the current access/refresh token so it is rejected by auth middleware. Never throws — logout must always succeed for the client. */
export function logout(accessToken?: string, refreshToken?: string): void {
  revokeToken(accessToken || '');
  revokeToken(refreshToken || '');
}

export async function sendLinkPhoneOtp(
  customerId: string,
  params: { phoneNumber: string; channel?: string; preferredChannel?: string },
): Promise<SendOtpResult> {
  const user = await authRepo.findCustomerByIdLean(customerId);
  if (!user) throw AppError.notFound('User');
  if (isPhoneLocked(user as unknown as ICustomerUser)) {
    throw new AppError('A verified phone number is already linked and cannot be changed', 403, 'PHONE_LOCKED');
  }

  const channel = String(params.preferredChannel || params.channel || 'sms').toLowerCase();
  if (channel === 'email') throw AppError.badRequest('Phone linking requires SMS or WhatsApp OTP');

  const digits = normalizePhone(params.phoneNumber);
  if (digits.length !== 10 || /^0+$/.test(digits)) throw AppError.badRequest('phoneNumber must be exactly 10 digits');

  const taken = await authRepo.findCustomerByPhone(digits, customerId);
  if (taken) throw new AppError('This phone number is already linked to another account', 409, 'PHONE_IN_USE');

  const otp = pickTestOtp(digits) || generateOtp(4);
  const devFallback = appConfig.otp.devMode || !appConfig.isProduction;
  const deliveredChannel = channel === 'whatsapp' ? 'whatsapp' : 'sms';

  const sessionId = await authRepo.createOtpSession({
    phoneNumber: digits,
    otp,
    channel: deliveredChannel,
    purpose: 'link_phone',
    userId: customerId,
    ttlSeconds: appConfig.otp.ttlSeconds,
  });

  const raced = await raceOtpDelivery(`${deliveredChannel.toUpperCase()} OTP (link-phone)`, digits, () =>
    deliverOtpToPhone(digits, otp, channel),
  );
  const delivery = resolveDelivery(raced, devFallback, digits, 'Failed to send OTP');

  return {
    sessionId,
    channel: raced.result?.channel || deliveredChannel,
    resendCooldownSeconds: appConfig.otp.resendCooldownSeconds,
    ...delivery,
  };
}

export async function verifyLinkPhoneOtp(customerId: string, sessionId: string, otp: string) {
  const session = await authRepo.findOtpSessionById(sessionId);
  if (!session) throw AppError.badRequest('Invalid session');
  if (session.purpose !== 'link_phone') throw AppError.badRequest('Invalid OTP session for phone linking');
  if (String(session.userId || '') !== String(customerId)) {
    throw AppError.forbidden('OTP session does not belong to this account');
  }
  if (session.verified) throw AppError.badRequest('OTP already used');
  if (session.otpExpiresAt && session.otpExpiresAt < new Date()) throw AppError.badRequest('OTP expired');

  await checkOtpAttempt(session, otp);

  const digits = normalizePhone(session.phoneNumber || '');
  if (digits.length !== 10) throw AppError.badRequest('Invalid phone number on OTP session');

  const user = await authRepo.findCustomerById(customerId);
  if (!user) throw AppError.notFound('User');
  if (isPhoneLocked(user)) {
    throw new AppError('A verified phone number is already linked and cannot be changed', 403, 'PHONE_LOCKED');
  }

  const taken = await authRepo.findCustomerByPhone(digits, customerId);
  if (taken) throw new AppError('This phone number is already linked to another account', 409, 'PHONE_IN_USE');

  session.verified = true;
  session.verifiedAt = new Date();
  await session.save();

  const now = new Date();
  user.phoneNumber = digits;
  user.phoneVerified = true;
  user.phoneVerifiedAt = now;
  try {
    await user.save();
  } catch (saveErr) {
    const code = (saveErr as { code?: number | string })?.code;
    if (code === 11000 || code === 'E11000') {
      throw new AppError('This phone number is already linked to another account', 409, 'PHONE_IN_USE');
    }
    throw saveErr;
  }

  const publicEmail = sanitizeCustomerEmail(user.email);
  return {
    _id: String(user._id),
    phoneNumber: user.phoneNumber,
    email: publicEmail || null,
    name: user.name || '',
    phoneVerified: true,
    phoneVerifiedAt: now,
    avatarUrl: user.avatarUrl || '',
  };
}
