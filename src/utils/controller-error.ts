import type { Response } from 'express';
import { AppError } from './AppError';
import { ResponseFormatter } from './response';

interface MongooseValidationError extends Error {
  errors?: Record<string, { message: string }>;
}

interface MongoDuplicateKeyError extends Error {
  code?: number | string;
  keyValue?: Record<string, unknown>;
}

/** Error shape used by services that throw `Object.assign(new Error(msg), { statusCode })`. */
interface AnnotatedError extends Error {
  statusCode?: unknown;
  status?: unknown;
  code?: unknown;
}

export interface ClassifiedError {
  statusCode: number;
  message: string;
  appCode?: string;
  /** Field-level detail for validation failures. */
  validationErrors?: Array<{ field: string; message: string }>;
}

function asHttpStatus(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 400 && n <= 599 ? n : null;
}

/**
 * Single source of truth for turning a caught error into an HTTP status.
 *
 * Used by both middleware/error.middleware.ts (the `next(err)` path) and
 * `sendControllerError` (controllers that answer the response themselves), so
 * the two paths cannot drift apart.
 *
 * Three conventions exist in this codebase and all of them must be honoured:
 * `AppError`, plain `Error` annotated with `statusCode`/`code`, and bare
 * `Error` whose message is the only signal.
 */
export function classifyError(err: unknown): ClassifiedError {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message, appCode: err.code };
  }

  const error = err as AnnotatedError;

  if (error?.name === 'ValidationError') {
    const validationErrors = Object.entries((error as MongooseValidationError).errors || {}).map(
      ([field, detail]) => ({ field, message: detail.message }),
    );
    return { statusCode: 422, message: 'Validation failed', appCode: 'VALIDATION_ERROR', validationErrors };
  }

  if (error?.name === 'CastError') {
    return { statusCode: 400, message: 'Invalid value provided', appCode: 'INVALID_INPUT' };
  }

  const duplicate = err as MongoDuplicateKeyError;
  if (duplicate?.code === 11000) {
    const field = Object.keys(duplicate.keyValue || {})[0] || 'field';
    return { statusCode: 409, message: `${field} already exists`, appCode: 'DUPLICATE_KEY' };
  }

  const message = error?.message || 'Internal server error';
  const domainCode = typeof error?.code === 'string' ? error.code : undefined;

  // Services annotate thrown errors with an explicit status — respect it.
  const annotated = asHttpStatus(error?.statusCode) ?? asHttpStatus(error?.status);
  if (annotated) return { statusCode: annotated, message, appCode: domainCode };

  // ...or with a domain code whose suffix implies the status.
  if (domainCode) {
    if (/_NOT_FOUND$/.test(domainCode)) return { statusCode: 404, message, appCode: domainCode };
    if (/^(MISSING|INVALID|UNSUPPORTED)_/.test(domainCode)) {
      return { statusCode: 400, message, appCode: domainCode };
    }
    if (/_EXISTS$|_CONFLICT$|^DUPLICATE_/.test(domainCode)) {
      return { statusCode: 409, message, appCode: domainCode };
    }
    if (/_FORBIDDEN$|^NOT_ALLOWED/.test(domainCode)) return { statusCode: 403, message, appCode: domainCode };
  }

  // Last resort: the message is the only signal a domain guard left behind.
  if (/\bnot found\b/i.test(message) || /\bdoes not exist\b/i.test(message)) {
    return { statusCode: 404, message, appCode: 'NOT_FOUND' };
  }
  if (/^(missing|invalid|unsupported|unknown)\b/i.test(message) || /\bis required\b/i.test(message)) {
    return { statusCode: 400, message, appCode: 'INVALID_INPUT' };
  }

  return { statusCode: 500, message };
}

/**
 * Answers the response for controllers that handle their own errors instead of
 * delegating to `next(err)`.
 *
 * These previously answered `res.status(500)` for every `catch`, which made a
 * missing required field indistinguishable from a genuine crash.
 */
export function sendControllerError(res: Response, err: unknown, fallbackMessage?: string): void {
  if (res.headersSent) return;

  const { statusCode, message, appCode, validationErrors } = classifyError(err);

  if (validationErrors) {
    res.status(statusCode).json(ResponseFormatter.validationError(validationErrors));
    return;
  }

  const details = err instanceof AppError ? err.details ?? null : null;
  // A 5xx message may leak internals, so prefer the caller's safe fallback there.
  const body = statusCode >= 500 ? fallbackMessage || message : message;
  res.status(statusCode).json(ResponseFormatter.error(body, statusCode, details, { appCode }));
}
