import crypto from 'crypto';
import { CustomerUser, ICustomerUser, OtpSession, IOtpSession } from './auth.model';
import { hashOtp, getOtpExpiryDate } from '../../utils/auth';

export interface CreateOtpSessionParams {
  phoneNumber?: string | null;
  email?: string | null;
  otp: string;
  channel: string;
  providerResponseId?: string;
  purpose?: 'login' | 'link_phone' | 'delete_account';
  intent?: 'login' | 'signup';
  userId?: string | null;
  ttlSeconds: number;
}

export async function createOtpSession(params: CreateOtpSessionParams): Promise<string> {
  const sessionId = crypto.randomUUID();
  await OtpSession.create({
    sessionId,
    phoneNumber: params.phoneNumber || null,
    email: params.email || null,
    otpHash: hashOtp(params.otp),
    channel: params.channel,
    otpSentAt: new Date(),
    otpExpiresAt: getOtpExpiryDate(params.ttlSeconds),
    resendCount: 0,
    attemptCount: 0,
    verified: false,
    purpose: params.purpose || 'login',
    intent: params.intent || 'login',
    userId: params.userId ? String(params.userId) : null,
    providerResponseId: params.providerResponseId ? String(params.providerResponseId).slice(0, 255) : undefined,
  });
  return sessionId;
}

export function findOtpSessionById(sessionId: string) {
  return OtpSession.findOne({ sessionId });
}

/** Match 10-digit, 91…, and +91… so an existing account is found either way. */
export function phoneLookupFilter(phoneNumber: string): Record<string, unknown> {
  const raw = String(phoneNumber || '').trim();
  const digits = raw.replace(/\D/g, '').slice(-10);
  const variants = [...new Set([raw, digits, digits ? `+91${digits}` : '', digits ? `91${digits}` : ''].filter(Boolean))];
  return variants.length ? { phoneNumber: { $in: variants } } : { phoneNumber: raw };
}

export function findCustomerByPhone(phoneNumber: string, excludeId?: string) {
  const filter: Record<string, unknown> = phoneLookupFilter(phoneNumber);
  if (excludeId) filter._id = { $ne: excludeId };
  return CustomerUser.findOne(filter).select('_id phoneVerified').lean();
}

export function findCustomerByEmail(email: string) {
  return CustomerUser.findOne({ email }).select('_id phoneVerified').lean();
}

export function findCustomerById(id: string) {
  return CustomerUser.findById(id);
}

export function findCustomerByIdLean(id: string) {
  return CustomerUser.findById(id).lean();
}

/** Finds an existing customer by phone/email or creates one, incrementing loginCount. */
export async function upsertCustomerUser(session: Pick<IOtpSession, 'email' | 'phoneNumber'>): Promise<{
  user: ICustomerUser;
  isNewUser: boolean;
}> {
  const now = new Date();
  const isEmailLogin = !!session.email;

  const existingUser = isEmailLogin
    ? await CustomerUser.findOne({ email: session.email }).lean()
    : await CustomerUser.findOne(phoneLookupFilter(session.phoneNumber || '')).lean();
  const isNewUser = !existingUser;

  const filter = isEmailLogin ? { email: session.email } : phoneLookupFilter(session.phoneNumber || '');
  const setFields = isEmailLogin ? { lastLogin: now } : { phoneVerified: true, phoneVerifiedAt: now, lastLogin: now };
  const insertFields = isEmailLogin ? { email: session.email, status: 'active' } : { phoneNumber: session.phoneNumber, status: 'active' };

  let user: ICustomerUser;
  try {
    user = (await CustomerUser.findOneAndUpdate(
      filter,
      { $set: setFields, $inc: { loginCount: 1 }, $setOnInsert: insertFields },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean()) as unknown as ICustomerUser;
  } catch (err) {
    const isDup = err && ((err as { code?: number | string }).code === 11000 || (err as { code?: number | string }).code === 'E11000');
    if (!isDup) throw err;
    const existing = (await CustomerUser.findOne(filter).lean()) as unknown as ICustomerUser | null;
    if (existing) {
      user = existing;
    } else {
      const created = await CustomerUser.create({ ...insertFields, lastLogin: now, loginCount: 1 });
      user = created.toObject ? (created.toObject() as ICustomerUser) : (created as unknown as ICustomerUser);
    }
  }

  return { user, isNewUser };
}
