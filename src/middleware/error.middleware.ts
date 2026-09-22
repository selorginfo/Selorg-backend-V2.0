import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { ResponseFormatter } from '../utils/response';
import { classifyError } from '../utils/controller-error';
import { isAllowedOrigin } from '../config/cors';
import { appConfig } from '../config/env';

function applyCorsHeadersIfAllowed(req: Request, res: Response) {
  const origin = req.headers.origin;
  if (!origin || !isAllowedOrigin(origin)) return;
  if (res.getHeader('Access-Control-Allow-Origin')) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
}

/** Global error handler. Must be registered last, after all routes. */
export function errorHandlerMiddleware(err: Error, req: Request, res: Response, _next: NextFunction): void {
  applyCorsHeadersIfAllowed(req, res);
  const isDevelopment = !appConfig.isProduction;

  // Shared with sendControllerError so both error paths produce the same status.
  const classified = classifyError(err);
  let message = classified.message;
  let statusCode = classified.statusCode;
  let details: unknown = null;

  const msg = String(err.message || '');
  if (
    msg.includes('buffering timed out') ||
    msg.includes('before initial connection is complete') ||
    (err.name === 'MongooseError' && msg.includes('Cannot call'))
  ) {
    message = 'Database is not available. Please ensure MongoDB is running and MONGO_URI is correct.';
    statusCode = 503;
  } else if (classified.validationErrors) {
    res.status(statusCode).json(ResponseFormatter.validationError(classified.validationErrors));
    return;
  }

  if (err.name === 'UnauthorizedError') {
    message = 'Invalid or expired token';
    statusCode = 401;
  }
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token';
    statusCode = 401;
  }
  if (err.name === 'TokenExpiredError') {
    message = 'Token expired';
    statusCode = 401;
  }

  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method,
    statusCode,
    message,
    userId: req.user?.userId ?? (req as { pickerId?: string }).pickerId,
    details: err instanceof AppError ? err.details : undefined,
    stack: isDevelopment ? err.stack : undefined,
  });

  // Always forward AppError.details (e.g. incomplete onboarding steps) to clients.
  if (err instanceof AppError && err.details != null) {
    details = isDevelopment
      ? { stack: err.stack, name: err.name, validationDetails: err.details }
      : err.details;
  } else if (isDevelopment) {
    details = { stack: err.stack, name: err.name };
  }

  // Surface the machine-readable code (e.g. USER_NOT_FOUND) so clients can
  // branch on it — the human `message` alone isn't stable enough to match on.
  const appCode = err instanceof AppError ? err.code : classified.appCode;

  res
    .status(statusCode)
    .json(ResponseFormatter.error(message, statusCode, details, { appCode }));
}

/** 404 handler. Register after all routes, before errorHandlerMiddleware. */
export function notFoundMiddleware(req: Request, res: Response): void {
  res.status(404).json(ResponseFormatter.notFound('Route', req.originalUrl));
}

function shouldSkipEnvelope(req: Request): boolean {
  if (appConfig.disableApiEnvelope) return true;
  const p = req.path || '';
  if (p === '/health' || p === '/healthz' || p.startsWith('/health/') || p === '/metrics' || p.startsWith('/api-docs')) {
    return true;
  }
  return p.includes('/webhooks/') || p.includes('/callback');
}

/**
 * Normalizes any `res.json({...})` call to the standard envelope
 * (`{ success, message, data, error, pagination, timestamp }`) when a
 * controller returns a raw object instead of using ResponseFormatter directly.
 */
export function apiEnvelopeMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (shouldSkipEnvelope(req)) {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    const status = res.statusCode || 200;

    if (body === undefined || body === null) {
      return originalJson(ResponseFormatter.success(null, status >= 400 ? 'Error' : 'Success'));
    }
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      return originalJson(body);
    }
    if (typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const errorField = record.error;
      const errorObj =
        typeof errorField === 'object' && errorField !== null
          ? (errorField as Record<string, unknown>)
          : undefined;

      // Extract a machine-readable code from wherever a hand-written response put it.
      const pickAppCode = (): string | undefined => {
        const c =
          errorObj?.appCode ??
          (typeof errorObj?.code === 'string' ? errorObj.code : undefined) ??
          (typeof record.code === 'string' ? record.code : undefined) ??
          (typeof record.appCode === 'string' ? record.appCode : undefined);
        return typeof c === 'string' && c ? c : undefined;
      };

      const pickMessage = (): string =>
        (typeof record.message === 'string' && record.message.trim()) ||
        (errorObj && typeof errorObj.message === 'string' && errorObj.message.trim()) ||
        (typeof errorField === 'string' && errorField.trim() && errorField !== 'Bad Request' && errorField.trim()) ||
        (status >= 500 ? 'An unexpected error occurred' : 'Request failed');

      if (Object.prototype.hasOwnProperty.call(record, 'success')) {
        // Already-standard error envelopes (carry error.title) pass through as-is.
        if (record.success === false && status >= 400 && !(errorObj && errorObj.title)) {
          const normalized = ResponseFormatter.error(pickMessage(), status, errorObj?.details ?? record.details ?? null, {
            appCode: pickAppCode(),
          });
          if (record.data != null) (normalized as unknown as Record<string, unknown>).data = record.data;
          return originalJson(normalized);
        }
        return originalJson(body);
      }

      if (status >= 400) {
        return originalJson(
          ResponseFormatter.error(pickMessage(), status, record.details ?? null, { appCode: pickAppCode() }),
        );
      }
      return originalJson(ResponseFormatter.success(body, 'Success'));
    }
    return originalJson(body);
  }) as Response['json'];

  next();
}
