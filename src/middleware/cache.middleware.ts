import type { NextFunction, Request, Response } from 'express';
import { cacheService } from '../utils/cache';
import { logger } from '../utils/logger';
import { appConfig } from '../config/env';

export interface CacheMiddlewareOptions {
  skipPaths?: string[];
  cacheKeyExtra?: (req: Request) => string;
  ttlResolver?: (req: Request) => number;
}

/**
 * Caches GET request JSON responses with a configurable TTL.
 * Respects DISABLE_CACHE and always skips health/metrics endpoints.
 */
export function cacheMiddleware(ttlSeconds = 60, options: CacheMiddlewareOptions = {}) {
  const { skipPaths = [], cacheKeyExtra, ttlResolver } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== 'GET') return next();

    const resolvedTtl = typeof ttlResolver === 'function' ? Number(ttlResolver(req)) || 0 : ttlSeconds;
    if (!resolvedTtl || resolvedTtl <= 0) return next();
    if (appConfig.disableCache) return next();
    if (req.path.startsWith('/health') || req.path === '/metrics') return next();
    if (skipPaths.some((p) => req.path === p || req.path.startsWith(`${p}/`))) return next();

    const extra = typeof cacheKeyExtra === 'function' ? String(cacheKeyExtra(req) || '') : '';
    const cacheKey = `cache:${req.originalUrl}:${JSON.stringify(req.query)}${extra}`;

    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug('Cache HIT', { key: cacheKey, path: req.path });
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        res.setHeader('Cache-Control', `public, max-age=${Math.min(resolvedTtl, 120)}, stale-while-revalidate=60`);
        res.json(cached);
        return;
      }

      logger.debug('Cache MISS', { key: cacheKey, path: req.path });
      const originalJson = res.json.bind(res);
      res.json = ((data: unknown) => {
        cacheService.set(cacheKey, data, resolvedTtl).catch((err) => {
          logger.warn('Cache set failed in middleware', { key: cacheKey, error: (err as Error).message });
        });
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
        res.setHeader('Cache-Control', `public, max-age=${Math.min(resolvedTtl, 120)}, stale-while-revalidate=60`);
        return originalJson(data);
      }) as Response['json'];

      next();
    } catch (err) {
      logger.warn('Cache middleware error', { error: (err as Error).message });
      next();
    }
  };
}
