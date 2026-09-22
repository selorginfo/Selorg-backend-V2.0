import type { ApiErrorResponse, ApiSuccessResponse, PaginationMeta } from '../types/common';

/**
 * Builds the standard `{ success, message, data, error, pagination, timestamp }` envelope
 * used by every controller response and by middleware/error.middleware.ts.
 */
export class ResponseFormatter {
  static success<T>(data: T | null = null, message = 'Success'): ApiSuccessResponse<T | null> {
    return {
      success: true,
      message,
      data,
      error: null,
      pagination: null,
      timestamp: new Date().toISOString(),
    };
  }

  static paginated<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    message = 'Items fetched successfully',
  ): ApiSuccessResponse<T[]> & { pagination: PaginationMeta } {
    const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
    const pagination: PaginationMeta = {
      total,
      page,
      limit,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    };
    return { success: true, message, data: items, error: null, pagination, timestamp: new Date().toISOString() };
  }

  /** Broad category per HTTP status — the `title` field of the error object. */
  static readonly STATUS_TITLES: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Validation Error',
    429: 'Too Many Requests',
    500: 'An unexpected error occurred',
    502: 'An error occurred while communicating with an upstream service',
    503: 'Service Unavailable',
  };

  static error(
    message: string,
    statusCode = 500,
    details?: unknown,
    opts: { appCode?: string; title?: string } = {},
  ): ApiErrorResponse {
    const title = opts.title || ResponseFormatter.STATUS_TITLES[statusCode] || 'Error';
    // 5xx `message` may leak internals — never expose it as `detail`.
    const detail = statusCode >= 500 ? undefined : message;
    return {
      success: false,
      message,
      data: null,
      error: {
        code: statusCode,
        ...(opts.appCode ? { appCode: opts.appCode } : {}),
        title,
        message,
        ...(detail ? { detail } : {}),
        details: details ?? null,
      },
      pagination: null,
      timestamp: new Date().toISOString(),
    };
  }

  static validationError(
    validationErrors: Array<{ field: string; message: string }>,
    message = 'Validation failed',
  ): ApiErrorResponse {
    return {
      success: false,
      message,
      data: null,
      error: {
        code: 422,
        appCode: 'VALIDATION_ERROR',
        title: 'Validation Error',
        message,
        detail: message,
        details: validationErrors,
      },
      pagination: null,
      timestamp: new Date().toISOString(),
    };
  }

  static notFound(resourceType = 'Resource', id?: string | null): ApiErrorResponse {
    const message = id ? `${resourceType} #${id} not found` : `${resourceType} not found`;
    return this.error(message, 404);
  }
}

export default ResponseFormatter;
