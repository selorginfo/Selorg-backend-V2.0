export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  error: null;
  pagination: PaginationMeta | null;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  data: null;
  error: {
    code: number | string;
    /** Machine-readable code (e.g. USER_NOT_FOUND, CONFLICT) when available. */
    appCode?: string;
    /** Broad category — "Bad Request", "Conflict", "Unauthorized", … */
    title?: string;
    message: string;
    /** Specific, dynamic explanation (often safe to show the end user). */
    detail?: string;
    details?: unknown;
  };
  pagination: null;
  timestamp: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface OtpProviderResult {
  success: boolean;
  channel?: string;
  body?: string;
  error?: string;
  provider?: string;
}
