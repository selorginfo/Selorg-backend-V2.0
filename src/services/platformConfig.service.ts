import { getRedisClient } from '../database/redis';
import { logger } from '../utils/logger';
import { PlatformConfig, PlatformConfigValueType } from './platformConfig.model';

const CACHE_PREFIX = 'platform:cfg:v1:';
const CACHE_TTL_SEC = Number(process.env.PLATFORM_CONFIG_CACHE_TTL_SEC) || 120;

const KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,255}$/;

function cacheKey(k: string): string {
  return `${CACHE_PREFIX}${k}`;
}

export function coerceInput(raw: unknown, valueType: PlatformConfigValueType): unknown {
  if (valueType === 'number') {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isNaN(n)) throw new Error('Invalid number value');
    return n;
  }
  if (valueType === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    throw new Error('Invalid boolean value');
  }
  if (valueType === 'json') {
    if (raw !== null && typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        throw new Error('Invalid JSON value');
      }
    }
    throw new Error('Invalid JSON value');
  }
  if (raw === null || raw === undefined) return '';
  return String(raw);
}

async function invalidateCache(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(cacheKey(key));
  } catch (e) {
    logger.warn('[platformConfig] cache invalidate failed', { key, error: (e as Error).message });
  }
}

/** Published value for runtime use (Mongo → optional Redis). */
export async function getPublishedValue<T = unknown>(key: string, fallback?: T): Promise<T | undefined> {
  if (!KEY_PATTERN.test(key)) return fallback;

  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(cacheKey(key));
      if (cached !== null) {
        try {
          const parsed = JSON.parse(cached);
          return parsed.v;
        } catch {
          /* fall through */
        }
      }
    } catch (e) {
      logger.warn('[platformConfig] redis get failed', { key, error: (e as Error).message });
    }
  }

  const doc = await PlatformConfig.findOne({ key }).lean();
  if (!doc) return fallback;

  const v = doc.value as T;
  if (redis) {
    try {
      await redis.setex(cacheKey(key), CACHE_TTL_SEC, JSON.stringify({ v }));
    } catch (e) {
      logger.warn('[platformConfig] redis set failed', { key, error: (e as Error).message });
    }
  }
  return v;
}

export async function listConfigs({ prefix }: { prefix?: string } = {}) {
  const q = prefix ? { key: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) } : {};
  return PlatformConfig.find(q).sort({ key: 1 }).lean();
}

export async function getConfigDoc(key: string) {
  if (!KEY_PATTERN.test(key)) {
    const err: Error & { statusCode?: number } = new Error('Invalid config key');
    err.statusCode = 400;
    throw err;
  }
  return PlatformConfig.findOne({ key }).lean();
}

export async function upsertConfig(
  key: string,
  { value, valueType, description }: { value: unknown; valueType?: PlatformConfigValueType; description?: string },
  updatedBy?: string,
) {
  if (!KEY_PATTERN.test(key)) {
    const err: Error & { statusCode?: number } = new Error('Invalid config key');
    err.statusCode = 400;
    throw err;
  }
  const coerced = coerceInput(value, valueType || 'string');
  const doc = await PlatformConfig.findOneAndUpdate(
    { key },
    {
      $set: {
        key,
        value: coerced,
        valueType: valueType || 'string',
        description: description || '',
        updatedBy: updatedBy || '',
      },
    },
    { new: true, upsert: true, runValidators: true },
  );
  await invalidateCache(key);
  return doc.toObject ? doc.toObject() : doc;
}

export async function deleteConfig(key: string): Promise<boolean> {
  if (!KEY_PATTERN.test(key)) {
    const err: Error & { statusCode?: number } = new Error('Invalid config key');
    err.statusCode = 400;
    throw err;
  }
  await PlatformConfig.deleteOne({ key });
  await invalidateCache(key);
  return true;
}

export { KEY_PATTERN };
