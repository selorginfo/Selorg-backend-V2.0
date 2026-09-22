/**
 * Session storage: the selorg-service access token + cached user. Persisted
 * in cookies with localStorage as a fallback, matching ecommerce-web-app's
 * auth.service.ts pattern. Fires a same-tab event so contexts (cart, wallet,
 * etc.) can react to login/logout without a page reload.
 *
 * Deliberately NOT "use client" — every export is guarded by `typeof window`
 * checks (safe no-ops on the server), so this can be called directly from
 * Server Components (e.g. `apiGet` in `services/api.ts`) as well as client
 * code. A "use client" directive here would turn these into opaque client
 * references that a Server Component can only render as JSX, not call.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
}

const TOKEN_KEY = "selorg_token";
const USER_KEY = "selorg_user";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days — matches typical JWT expiry window

const AUTH_EVENT = "selorg:auth";

export function onAuthChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_EVENT, cb);
  return () => window.removeEventListener(AUTH_EVENT, cb);
}

function emitAuthChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EVENT));
}

function setCookie(name: string, value: string, maxAgeSec: number) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; Path=/; SameSite=Lax${secure}`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp("(?:^|; )" + escaped + "=([^;]*)"));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function delCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function saveSession(token: string, user?: SessionUser) {
  if (typeof window === "undefined") return;
  setCookie(TOKEN_KEY, token, SESSION_MAX_AGE);
  if (user) setCookie(USER_KEY, JSON.stringify(user), SESSION_MAX_AGE);
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore quota/availability errors */
  }
  emitAuthChange();
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  let token = getCookie(TOKEN_KEY);
  if (!token) {
    try {
      token = localStorage.getItem(TOKEN_KEY);
      if (token) setCookie(TOKEN_KEY, token, SESSION_MAX_AGE);
    } catch {
      /* ignore */
    }
  }
  if (token && isJwtExpired(token)) {
    // Drop expired JWT before any request; clearSession emits once. Callers must
    // not treat this as a refresh-retry signal — there is no refresh-token loop.
    clearSession();
    return null;
  }
  return token;
}

/** Decode JWT `exp` without verifying the signature — used only to drop
 *  obviously-expired tokens before they trigger a 401 round-trip. */
function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length < 2 || !parts[1]) return false;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    // Treat as expired 30s early so we don't race a token that dies mid-request.
    return payload.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return false;
  }
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const tryParse = (raw: string | null): SessionUser | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  };
  // Prefer cookie, but fall back to localStorage when the cookie is missing or corrupt
  // (a bad cookie must not mask a valid localStorage session).
  const fromCookie = tryParse(getCookie(USER_KEY));
  if (fromCookie) return fromCookie;
  try {
    return tryParse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  delCookie(TOKEN_KEY);
  delCookie(USER_KEY);
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
  emitAuthChange();
}
