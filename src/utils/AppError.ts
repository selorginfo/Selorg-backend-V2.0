/**
 * Standard application error. Carries an HTTP status code and optional
 * machine-readable `code` + `details`, consumed by middleware/error.middleware.ts.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code?: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Authentication required', code = 'AUTH_REQUIRED') {
    return new AppError(message, 401, code);
  }

  static forbidden(message = 'Access denied', code = 'ACCESS_DENIED') {
    return new AppError(message, 403, code);
  }

  static notFound(resource = 'Resource', id?: string) {
    return new AppError(id ? `${resource} #${id} not found` : `${resource} not found`, 404, 'NOT_FOUND');
  }

  static conflict(message = 'Resource conflict', code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }

  static validation(message = 'Validation failed', details?: unknown) {
    return new AppError(message, 422, 'VALIDATION_ERROR', details);
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }
}
