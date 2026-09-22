import { logger } from '../../utils/logger';

/**
 * In-memory dashboard-login lockout, ported from legacy `core/services/loginLockout.js`.
 * For multi-instance deployments, back this with Redis (key `login_attempts:${email}`,
 * increment + TTL) instead — same caveat legacy called out.
 */
const MAX_ATTEMPTS = Number(process.env.LOGIN_LOCKOUT_MAX_ATTEMPTS) || 5;
const LOCKOUT_DURATION_SEC = Number(process.env.LOGIN_LOCKOUT_DURATION_SEC) || 900;

const store = new Map<string, { attempts: number; lockedUntil?: number }>();

const CLEAN_INTERVAL_MS = 5 * 60 * 1000;
let cleanInterval: NodeJS.Timeout | undefined;

function startCleanInterval() {
  if (cleanInterval) return;
  cleanInterval = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    let removed = 0;
    for (const [key, data] of store.entries()) {
      if (data.lockedUntil && data.lockedUntil <= now) {
        store.delete(key);
        removed++;
      }
    }
    if (removed > 0) logger.debug('Login lockout cleanup', { removed });
  }, CLEAN_INTERVAL_MS);
  cleanInterval.unref?.();
}

function normalizeEmail(email?: string | null): string {
  return typeof email === 'string' ? email.toLowerCase().trim() : '';
}

export function isLocked(email?: string | null): { locked: boolean; retryAfterSeconds?: number } {
  const key = normalizeEmail(email);
  if (!key) return { locked: false };
  const data = store.get(key);
  if (!data) return { locked: false };
  const now = Math.floor(Date.now() / 1000);
  if (data.lockedUntil && data.lockedUntil > now) {
    return { locked: true, retryAfterSeconds: data.lockedUntil - now };
  }
  if (data.lockedUntil && data.lockedUntil <= now) store.delete(key);
  return { locked: false };
}

export function recordFailure(email?: string | null): void {
  const key = normalizeEmail(email);
  if (!key) return;
  const data = store.get(key) || { attempts: 0 };
  data.attempts += 1;
  const now = Math.floor(Date.now() / 1000);
  if (data.attempts >= MAX_ATTEMPTS) {
    data.lockedUntil = now + LOCKOUT_DURATION_SEC;
    logger.warn('Login lockout activated', {
      email: `${key.slice(0, 3)}***`,
      attempts: data.attempts,
      lockedUntil: new Date(data.lockedUntil * 1000).toISOString(),
    });
  }
  store.set(key, data);
  startCleanInterval();
}

export function clearAttempts(email?: string | null): void {
  const key = normalizeEmail(email);
  if (!key) return;
  store.delete(key);
}
