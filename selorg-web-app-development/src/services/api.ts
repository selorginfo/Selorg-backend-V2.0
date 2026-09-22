/**
 * Thin fetch wrapper around the selorg-service customer API. Mirrors the
 * pattern used in the sibling ecommerce-web-app project's src/services/api.ts,
 * adapted to selorg-service's response envelope:
 *   { success, message, data, error, pagination, timestamp }
 * (see selorg-service/src/utils/response.ts — ResponseFormatter).
 */
import { clearSession, getToken } from "./session";

let handlingUnauthorized = false;

function handleUnauthorized() {
  if (handlingUnauthorized || typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path.startsWith("/auth")) return;
  handlingUnauthorized = true;
  clearSession();
  const redirect = encodeURIComponent(path + window.location.search);
  // Centralized auth expiry — must hard-navigate to clear client state fully.
  // Param name matches useRequireAuth / AuthClient (`redirect`), not a second convention.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- not a Next.js route transition
  window.location.href = `/auth?redirect=${redirect}`;
}

const DEFAULT_BACKEND_PORT = process.env.NEXT_PUBLIC_API_PORT || "3333";

/**
 * Resolves the selorg-service origin (no path suffix).
 * - Production/staging: uses NEXT_PUBLIC_API_BASE_URL when set to a non-localhost host.
 * - LAN dev: when the page is opened via a LAN IP/hostname, targets the same host on
 *   the backend port so mobile testing works without hardcoding an IP in env.
 * - Local / SSR: uses 127.0.0.1 (not localhost) so Windows Node fetch doesn't hit
 *   IPv6 ::1 while selorg-service is listening on IPv4 0.0.0.0 only.
 */
export function resolveApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "");
  const localFallback = `http://127.0.0.1:${DEFAULT_BACKEND_PORT}`;
  if (typeof window === "undefined") {
    if (!configured) return localFallback;
    // Rewrite bare localhost → 127.0.0.1 for the same IPv4 SSR reliability.
    return configured.replace(
      /^https?:\/\/localhost(?=:\d+|$)/i,
      (m) => m.replace(/localhost/i, "127.0.0.1"),
    );
  }
  if (
    configured &&
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)
  ) {
    return configured;
  }
  const { hostname, protocol } = window.location;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    return `${protocol}//${hostname}:${DEFAULT_BACKEND_PORT}`;
  }
  return configured?.replace(
    /^https?:\/\/localhost(?=:\d+|$)/i,
    (m) => m.replace(/localhost/i, "127.0.0.1"),
  ) || localFallback;
}

/** All customer-facing selorg-service routes are mounted under this prefix. */
const CUSTOMER_PREFIX = "/api/v1/customer";

/** Error carrying the HTTP status + server error code so callers can branch
 *  (e.g. redirect to /auth on 401) instead of just showing raw text. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string | number;
  /** Machine-readable backend code (e.g. USER_NOT_FOUND) from error.appCode. */
  readonly appCode?: string;
  constructor(
    status: number,
    message: string,
    code?: string | number,
    appCode?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.appCode = appCode;
  }
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  error: {
    code: string | number;
    appCode?: string;
    message: string;
    details?: unknown;
  } | null;
}

interface RequestOptions {
  /** Skip attaching the Bearer token even if one is stored (public endpoints). */
  skipAuth?: boolean;
  /** AbortSignal passthrough for cancellable requests. */
  signal?: AbortSignal;
  /** Extra headers merged over the defaults. */
  headers?: Record<string, string>;
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  { skipAuth, signal, headers }: RequestOptions = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${resolveApiBaseUrl()}${CUSTOMER_PREFIX}${path}`;
  const token = skipAuth ? null : getToken();

  if (process.env.NODE_ENV === "development") {
    // Structured breadcrumb for spotting accidental idle loops in DevTools.
    // Keep lightweight — no payloads. Remove or gate further if noisy.
    console.debug(
      `[API REQUEST]\nmethod: ${method}\nendpoint: ${path}\ntimestamp: ${new Date().toISOString()}`,
    );
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      0,
      "Cannot connect to the server. Make sure selorg-service is running and reachable.",
      "NETWORK_ERROR",
      "NETWORK_ERROR",
    );
  }

  const json = (await res.json().catch(() => null)) as Envelope<T> | null;

  if (res.status === 401 && !skipAuth) {
    handleUnauthorized();
    throw new ApiError(401, "Session expired. Please sign in again.", "UNAUTHORIZED", "UNAUTHORIZED");
  }

  if (!res.ok || !json || json.success === false) {
    const message = json?.error?.message || json?.message || `Request failed (${res.status})`;
    const appCode =
      typeof json?.error?.appCode === "string" ? json.error.appCode : undefined;
    throw new ApiError(res.status, message, json?.error?.code, appCode);
  }

  return json.data as T;
}

/** For endpoints that return fields outside the standard `data` envelope. */
export async function apiGetBody<T>(
  path: string,
  opts?: RequestOptions,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${resolveApiBaseUrl()}${CUSTOMER_PREFIX}${path}`;
  const token = opts?.skipAuth ? null : getToken();
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
    signal: opts?.signal,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status === 401 && !opts?.skipAuth) {
    handleUnauthorized();
    throw new ApiError(401, "Session expired. Please sign in again.", "UNAUTHORIZED", "UNAUTHORIZED");
  }
  if (!res.ok || !json || json.success === false) {
    const err = json?.error as { message?: string; code?: string; appCode?: string } | undefined;
    throw new ApiError(res.status, err?.message || String(json?.message || "Request failed"), err?.code, err?.appCode);
  }
  return json as T;
}

/** For POST endpoints that return fields outside the standard `data` envelope. */
export async function apiPostBody<T>(
  path: string,
  body?: unknown,
  opts?: RequestOptions,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${resolveApiBaseUrl()}${CUSTOMER_PREFIX}${path}`;
  const token = opts?.skipAuth ? null : getToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: opts?.signal,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status === 401 && !opts?.skipAuth) {
    handleUnauthorized();
    throw new ApiError(401, "Session expired. Please sign in again.", "UNAUTHORIZED", "UNAUTHORIZED");
  }
  if (!res.ok || !json || json.success === false) {
    const err = json?.error as { message?: string; code?: string; appCode?: string } | undefined;
    throw new ApiError(res.status, err?.message || String(json?.message || "Request failed"), err?.code, err?.appCode);
  }
  return json as T;
}

export const apiGet = <T>(path: string, opts?: RequestOptions) => request<T>("GET", path, undefined, opts);
export const apiPost = <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("POST", path, body, opts);
export const apiPut = <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("PUT", path, body, opts);
export const apiPatch = <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("PATCH", path, body, opts);
export const apiDelete = <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, undefined, opts);
