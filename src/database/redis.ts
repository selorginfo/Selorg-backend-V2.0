import Redis from 'ioredis';
import { logger } from '../utils/logger';

function isRedisDisabled(): boolean {
  const v = String(process.env.DISABLE_REDIS || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export function isRedisConfigured(): boolean {
  if (isRedisDisabled()) return false;
  if (String(process.env.REDIS_URL || '').trim()) return true;
  const enabled = String(process.env.REDIS_ENABLED || '').trim().toLowerCase();
  return enabled === 'true' || enabled === '1' || enabled === 'yes';
}

let skippedLogEmitted = false;
function logRedisSkippedOnce() {
  if (skippedLogEmitted) return;
  skippedLogEmitted = true;
  if (isRedisDisabled()) {
    logger.info('[redis] disabled via DISABLE_REDIS');
  } else {
    logger.info('[redis] not configured (set REDIS_URL or REDIS_ENABLED=true); in-memory fallbacks active');
  }
}

let client: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!isRedisConfigured()) {
    logRedisSkippedOnce();
    return null;
  }
  if (client) return client;

  const url = String(process.env.REDIS_URL || '').trim();
  const options = {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    retryStrategy(times: number) {
      if (times > 5) return null;
      return Math.min(times * 200, 3000);
    },
  };

  client = url
    ? new Redis(url, options)
    : new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        ...options,
      });

  let lastErrorLog = 0;
  client.on('error', (err) => {
    const now = Date.now();
    if (now - lastErrorLog < 15000) return;
    lastErrorLog = now;
    logger.warn(`[redis] ${err.message} (Redis unavailable; using in-memory fallbacks)`);
  });
  client.on('connect', () => logger.info('[redis] connected'));

  return client;
}
