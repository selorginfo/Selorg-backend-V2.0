import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load env vars before anything else reads process.env.
const rootDir = path.resolve(__dirname, '../..');
const defaultEnvPath = path.resolve(rootDir, '.env');
const prodEnvPath = path.resolve(rootDir, '.env.production');
const overrideEnvPath = process.env.DOTENV_PATH ? path.resolve(process.env.DOTENV_PATH) : null;
const isProd = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const selectedEnvPath = overrideEnvPath || (isProd && fs.existsSync(prodEnvPath) ? prodEnvPath : defaultEnvPath);
dotenv.config({ path: selectedEnvPath });

function int(value: string | undefined, fallback: number): number {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

export const appConfig = {
  port: int(process.env.PORT, 3333),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: process.env.API_VERSION || '1.0.0',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  isTest: (process.env.NODE_ENV || 'development') === 'test',

  // JWT secrets are intentionally not exposed here — use getAdminJwtSecret()/getCustomerJwtSecret()
  // from utils/auth.ts, which throw instead of falling back to a placeholder when unset.

  disableCache: process.env.DISABLE_CACHE === 'true',
  disableApiEnvelope: process.env.DISABLE_API_ENVELOPE === '1' || process.env.DISABLE_API_ENVELOPE === 'true',

  cache: {
    default: int(process.env.CACHE_TTL_DEFAULT, 60),
    customer: {
      home: int(process.env.CACHE_TTL_CUSTOMER_HOME, 60),
      categories: int(process.env.CACHE_TTL_CUSTOMER_CATEGORIES, 120),
      products: int(process.env.CACHE_TTL_CUSTOMER_PRODUCTS, 60),
      legal: int(process.env.CACHE_TTL_CUSTOMER_LEGAL, 300),
      search: int(process.env.CACHE_TTL_CUSTOMER_SEARCH, 0),
      bootstrap: int(process.env.CACHE_TTL_CUSTOMER_BOOTSTRAP, 45),
      default: int(process.env.CACHE_TTL_CUSTOMER, 60),
    },
  },

  rateLimit: {
    windowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 900000),
    maxRequests: int(process.env.RATE_LIMIT_MAX_REQUESTS, 1000),
  },

  /**
   * Burst cap per IP, then a 15–20 minute block.
   * Covers customer app, web app, admin, rider, picker, and HSD (HHD/darkstore).
   * A normal screen is a few dozen calls; this trips on a sustained flood.
   */
  ipBlock: {
    windowMs: int(process.env.IP_BLOCK_WINDOW_MS, 60_000),
    maxRequests: int(process.env.IP_BLOCK_MAX_REQUESTS, 180),
    minBlockMs: int(process.env.IP_BLOCK_MIN_MS, 15 * 60 * 1000),
    maxBlockMs: int(process.env.IP_BLOCK_MAX_MS, 20 * 60 * 1000),
  },

  otp: {
    length: int(process.env.OTP_LENGTH, 4),
    ttlSeconds: int(process.env.OTP_TTL_SECONDS, 300),
    resendCooldownSeconds: int(process.env.OTP_RESEND_COOLDOWN_SECONDS, 30),
    maxVerifyAttempts: int(process.env.OTP_MAX_VERIFY_ATTEMPTS, 5),
    allowFixedTestOtp:
      String(process.env.ALLOW_CUSTOMER_TEST_OTP || '').toLowerCase() === 'true' ||
      (process.env.NODE_ENV || 'development') !== 'production',
    // Case-insensitive so OTP_DEV_MODE=False in .env is respected.
    devMode: (() => {
      const raw = String(process.env.OTP_DEV_MODE || '')
        .trim()
        .toLowerCase();
      return raw === '1' || raw === 'true';
    })(),
    testMobile: (process.env.OTP_TEST_MOBILE || '9698790921').replace(/\D/g, '').slice(-10),
    testOtp: process.env.OTP_TEST_OTP || '8790',
  },

  customerAppName: process.env.CUSTOMER_APP_NAME || 'Selorg Customer',
} as const;

/**
 * Validates required environment variables on startup. Call before connectDB()/listen().
 * Throws with a combined message so all problems surface in one failed deploy, not one-by-one.
 */
export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    errors.push('MONGO_URI is required but not set');
  } else if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    errors.push('MONGO_URI format is invalid. Must start with mongodb:// or mongodb+srv://');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required but not set');
  } else if (jwtSecret.length < 32) {
    errors.push(
      `JWT_SECRET must be at least 32 characters long. Current length: ${jwtSecret.length}. Generate with: openssl rand -base64 32`,
    );
  } else if (['your-secret-key', 'change-me', 'secret', 'password', '123456'].includes(jwtSecret.toLowerCase())) {
    errors.push('JWT_SECRET is too weak. Please use a strong, randomly generated secret.');
  }

  if (!process.env.ALLOWED_ORIGINS) {
    warnings.push('ALLOWED_ORIGINS not set - CORS will fall back to the built-in allow-list');
  }
  if (!process.env.NODE_ENV) {
    warnings.push('NODE_ENV not set - defaulting to development');
  }

  warnings.forEach((w) => console.warn(`[env] ${w}`));

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
}

export default appConfig;
