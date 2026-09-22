import { logger } from './logger';

/** Simple in-memory TTL store: key -> { value, expiresAt } */
function createMemoryStore() {
  const store = new Map<string, { value: unknown; expiresAt: number | null }>();
  return {
    get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key: string, value: unknown, ttlSeconds?: number) {
      const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
      store.set(key, { value, expiresAt });
    },
    del(key: string) {
      store.delete(key);
    },
    keys(pattern: string) {
      const regex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
      const re = new RegExp(`^${regex}$`);
      return [...store.keys()].filter((k) => re.test(k));
    },
  };
}

/**
 * In-memory TTL cache used for GET-response caching (middleware/cache.middleware.ts) and
 * other short-lived lookups. Local/single-instance only — swap for a Redis-backed
 * implementation (see database/redis.ts) if this ever runs multi-instance.
 */
class CacheService {
  private store = createMemoryStore();

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    this.store.set(key, value, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    this.store.del(key);
  }

  async delPattern(pattern: string): Promise<number> {
    const keys = this.store.keys(pattern);
    keys.forEach((k) => this.store.del(k));
    return keys.length;
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    return this.delPattern(`${namespace}:*`);
  }
}

export const cacheService = new CacheService();
export default cacheService;

logger.debug('In-memory cache service ready');
