import { logger } from '../utils/logger';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:3333',
  'http://localhost:5002',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5002',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
  'https://dashboard.selorg.com',
  'https://www.dashboard.selorg.com',
];

function parseOrigins(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getAllowedOrigins(): string[] {
  return Array.from(
    new Set([...DEFAULT_ALLOWED_ORIGINS, ...parseOrigins(process.env.ALLOWED_ORIGINS), ...parseOrigins(process.env.CORS_ORIGIN)]),
  );
}

function isLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\/?$/i.test(origin.trim());
}

function isLanOrigin(origin: string): boolean {
  return /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?\/?$/i.test(
    origin.trim(),
  );
}

function isExpoOrMobileOrigin(origin: string): boolean {
  return origin.trim().startsWith('exp://') || origin.trim().startsWith('http://localhost');
}

/** Production dashboard/API hosts on selorg.com (https only). */
export function isSelorgHttpsOrigin(origin: string): boolean {
  return /^https:\/\/([a-z0-9-]+\.)*selorg\.com(:\d+)?\/?$/i.test(origin.trim());
}

export function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin || origin === 'null' || origin === '') return true;

  const normalized = origin.trim().toLowerCase();

  if (isLocalOrigin(normalized) || isLanOrigin(normalized) || isExpoOrMobileOrigin(normalized)) {
    return true;
  }
  if (isSelorgHttpsOrigin(normalized)) {
    return true;
  }
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  const allowed = getAllowedOrigins().map((o) => o.trim().toLowerCase());
  return allowed.includes(normalized);
}

type CorsOriginCallback = (err: Error | null, allow?: boolean | string) => void;

export function createCorsOriginHandler(
  onBlocked?: (origin: string | undefined, allowedOrigins: string[]) => void,
) {
  return (origin: string | undefined, callback: CorsOriginCallback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, origin || true);
      return;
    }
    onBlocked?.(origin, getAllowedOrigins());
    logger.warn('CORS origin rejected', { origin, nodeEnv: process.env.NODE_ENV || 'development' });
    callback(null, false);
  };
}
