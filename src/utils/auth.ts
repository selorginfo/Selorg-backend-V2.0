import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from './logger';

/**
 * In-memory blocklist for logout/revocation. Tokens are rejected by the auth
 * middleware until they would have expired. For multi-instance deployments,
 * back this with Redis (see database/redis.ts) instead.
 */
class TokenBlocklist {
  private blocklist = new Map<string, number>();
  private cleanInterval: NodeJS.Timeout | null = null;
  private static readonly CLEAN_INTERVAL_MS = 5 * 60 * 1000;

  private startCleanInterval() {
    if (this.cleanInterval) return;
    this.cleanInterval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      let removed = 0;
      for (const [token, exp] of this.blocklist.entries()) {
        if (exp <= now) {
          this.blocklist.delete(token);
          removed++;
        }
      }
      if (removed > 0) logger.debug('Token blocklist cleanup', { removed });
    }, TokenBlocklist.CLEAN_INTERVAL_MS);
    this.cleanInterval.unref?.();
  }

  add(token: string, exp: number) {
    if (!token || !exp) return;
    this.blocklist.set(token, exp);
    this.startCleanInterval();
  }

  has(token: string): boolean {
    if (!token) return false;
    const exp = this.blocklist.get(token);
    if (!exp) return false;
    if (exp <= Math.floor(Date.now() / 1000)) {
      this.blocklist.delete(token);
      return false;
    }
    return true;
  }
}

export const tokenBlocklist = new TokenBlocklist();

/** Revoke a raw JWT (adds it to the blocklist until its own expiry). Safe to call with an invalid token. */
export function revokeToken(token: string) {
  if (!token) return;
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (decoded?.exp && decoded.exp > Math.floor(Date.now() / 1000)) {
      tokenBlocklist.add(token, decoded.exp);
    }
  } catch {
    // Still succeed so the client can clear local state.
  }
}

// --- OTP helpers -----------------------------------------------------------

const OTP_LENGTH = Number(process.env.OTP_LENGTH) || 4;
const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS) || 300;

/** Resolved lazily (not at module load) so it always reflects post-validateEnvironment() state. */
function getOtpPepper(): string {
  const pepper = process.env.OTP_PEPPER || process.env.CUSTOMER_JWT_SECRET || process.env.JWT_SECRET;
  if (!pepper) throw new Error('OTP_PEPPER (or CUSTOMER_JWT_SECRET / JWT_SECRET) is required but not set');
  return pepper;
}

/** CSPRNG-backed OTP — do not use Math.random() for authentication codes. */
export function generateOtp(length: number = OTP_LENGTH): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(crypto.randomInt(min, max));
}

export function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', getOtpPepper()).update(String(otp)).digest('hex');
}

export function verifyOtp(otp: string, hash: string): boolean {
  const computed = hashOtp(otp);
  const a = Buffer.from(computed);
  const b = Buffer.from(String(hash || ''));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function getOtpExpiryDate(ttlSeconds: number = OTP_TTL_SECONDS): Date {
  return new Date(Date.now() + ttlSeconds * 1000);
}

// --- JWT helpers -------------------------------------------------------------

/**
 * Both getters throw rather than fall back to a placeholder secret when unset — the getter
 * is the enforcement point, since callers (scripts, tests) may bypass server.ts's
 * validateEnvironment() bootstrap check.
 */
export function getCustomerJwtSecret(): string {
  const secret = process.env.CUSTOMER_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('CUSTOMER_JWT_SECRET (or JWT_SECRET) is required but not set');
  return secret;
}

export function getAdminJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required but not set');
  return secret;
}

export function signCustomerToken(payload: Record<string, unknown>, expiresInSeconds: number): string {
  return jwt.sign(payload, getCustomerJwtSecret(), { expiresIn: expiresInSeconds });
}

export function verifyCustomerToken<T = Record<string, unknown>>(token: string): T {
  return jwt.verify(token, getCustomerJwtSecret()) as T;
}
