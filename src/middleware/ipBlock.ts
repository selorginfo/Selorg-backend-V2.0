import type { NextFunction, Request, Response } from 'express';
import { appConfig } from '../config/env';
import { getRedisClient } from '../database/redis';
import { logger } from '../utils/logger';
import { ResponseFormatter } from '../utils/response';

/** Customer app + web, admin, rider, picker, and HSD (handheld + darkstore). */
const GUARDED_PREFIXES = [
  '/api/v1/customer',
  '/api/v1/admin',
  '/api/v1/rider',
  '/api/v1/picker',
  '/api/v1/hhd',
  '/api/v1/darkstore',
  '/api/payment',
] as const;

type Bucket = { windowStart: number; count: number; blockedUntil: number };

export interface IpBlockOptions {
  windowMs: number;
  maxRequests: number;
  minBlockMs: number;
  maxBlockMs: number;
}

export interface IpBlockDecision {
  blocked: boolean;
  retryAfterSec: number;
  justBlocked: boolean;
}

const buckets = new Map<string, Bucket>();

export function resetIpBlocks(): void {
  buckets.clear();
}

export function isGuardedAppPath(path: string): boolean {
  const pathname = (path.split('?')[0] || path).replace(/\/+$/, '') || '/';
  return GUARDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Inclusive random duration between the configured minimum and maximum. */
export function blockDurationMs(minMs: number, maxMs: number, random: () => number = Math.random): number {
  const min = Math.max(0, Math.min(minMs, maxMs));
  const max = Math.max(minMs, maxMs);
  const span = max - min;
  if (span <= 0) return min;
  return min + Math.floor(random() * (span + 1));
}

export function clientIp(req: Request): string {
  const raw = req.ip || req.socket?.remoteAddress || '';
  return raw.replace(/^::ffff:/, '') || 'unknown';
}

export function isLoopbackIp(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

export function evaluateIpBlock(
  ip: string,
  now: number,
  opts: IpBlockOptions,
  random: () => number = Math.random,
): IpBlockDecision {
  let bucket = buckets.get(ip);
  if (!bucket) {
    bucket = { windowStart: now, count: 0, blockedUntil: 0 };
    buckets.set(ip, bucket);
  }

  if (buckets.size > 10_000) {
    for (const [key, value] of buckets) {
      if (value.blockedUntil <= now && now - value.windowStart >= opts.windowMs) buckets.delete(key);
    }
  }

  if (bucket.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
      justBlocked: false,
    };
  }

  if (now - bucket.windowStart >= opts.windowMs) {
    bucket.windowStart = now;
    bucket.count = 0;
  }

  bucket.count += 1;
  if (bucket.count > opts.maxRequests) {
    const duration = blockDurationMs(opts.minBlockMs, opts.maxBlockMs, random);
    bucket.blockedUntil = now + duration;
    bucket.count = 0;
    bucket.windowStart = now;
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil(duration / 1000)),
      justBlocked: true,
    };
  }

  return { blocked: false, retryAfterSec: 0, justBlocked: false };
}

async function evaluateRedisIpBlock(
  ip: string,
  opts: IpBlockOptions,
): Promise<IpBlockDecision | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  const banKey = `ipblock:ban:${ip}`;
  const countKey = `ipblock:count:${ip}`;
  const bannedForMs = await redis.pttl(banKey);
  if (bannedForMs > 0) {
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil(bannedForMs / 1000)),
      justBlocked: false,
    };
  }
  const count = await redis.incr(countKey);
  if (count === 1) await redis.pexpire(countKey, opts.windowMs);
  if (count > opts.maxRequests) {
    const duration = blockDurationMs(opts.minBlockMs, opts.maxBlockMs);
    await redis.set(banKey, '1', 'PX', duration);
    await redis.del(countKey);
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil(duration / 1000)),
      justBlocked: true,
    };
  }
  return { blocked: false, retryAfterSec: 0, justBlocked: false };
}

function rejectBlocked(res: Response, retryAfterSec: number): void {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  res.setHeader('Retry-After', String(retryAfterSec));
  res.status(429).json(
    ResponseFormatter.error(
      `Too many requests from your network. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      429,
      undefined,
      { appCode: 'IP_BLOCKED' },
    ),
  );
}

/**
 * After a burst from one IP, refuse every guarded app for 15–20 minutes.
 * Loopback is skipped outside production so local checkout is not locked out.
 */
export async function ipBlockMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }
  const path = req.originalUrl || req.path;
  if (!isGuardedAppPath(path) || appConfig.isTest) {
    next();
    return;
  }
  const ip = clientIp(req);
  if (!appConfig.isProduction && isLoopbackIp(ip)) {
    next();
    return;
  }

  const opts = appConfig.ipBlock;
  let decision: IpBlockDecision;
  try {
    decision = (await evaluateRedisIpBlock(ip, opts)) ?? evaluateIpBlock(ip, Date.now(), opts);
  } catch (err) {
    logger.warn('[ip-block] redis unavailable, using memory', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    decision = evaluateIpBlock(ip, Date.now(), opts);
  }

  if (!decision.blocked) {
    next();
    return;
  }
  if (decision.justBlocked) {
    logger.warn('[ip-block] blocked IP', { ip, retryAfterSec: decision.retryAfterSec, path });
  }
  rejectBlocked(res, decision.retryAfterSec);
}
