import { logger } from '../../utils/logger';

/**
 * Ported field-for-field from legacy `customer-backend/utils/paymentRedirectUrls.js`.
 * Resolve customer-web and Worldline return URLs safely. Production / hosted API
 * deployments must never redirect customers to localhost / private IPs even if
 * NODE_ENV is mis-set — localhost redirects are opt-in only via
 * ALLOW_LOCAL_PAYNIMO_REDIRECT=true. Default fallback is always https://www.selorg.com.
 *
 * IMPORTANT: Do not treat unrelated hosted signals (e.g. DIDIT_WEBHOOK_BASE_URL) as
 * proof that Worldline itself is hosted — that incorrectly ignores local
 * WORLDLINE_RETURN_URL / WORLDLINE_WEB_APP_URL and 302s customers to the old
 * production web app (www.selorg.com) after Cancel/Success/Failure.
 */

const PRODUCTION_WEB_APP_URL = 'https://www.selorg.com';
const PRODUCTION_API_RETURN_URL = 'https://api.selorg.com/api/v1/customer/payments/worldline/return';

const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i;
const PRIVATE_IP_RE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
/** Open-redirect allowlist: only Selorg customer web hosts. */
const SELORG_WEB_HOST_RE = /^(www\.)?selorg\.com$/i;

function trimEnv(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s || null;
}

export function isLocalOrPrivateHost(urlOrHost: unknown): boolean {
  if (!urlOrHost) return false;
  try {
    const s = String(urlOrHost);
    const host = s.includes('://') ? new URL(s).hostname : s.split('/')[0].split(':')[0];
    if (LOCAL_HOST_RE.test(host)) return true;
    if (PRIVATE_IP_RE.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * True when this process is clearly serving a hosted Worldline/API callback stack,
 * even if NODE_ENV is misconfigured.
 *
 * Only Worldline return + public API bases count. DIDIT (or other product) webhook
 * bases often point at production while Worldline is still local — including them
 * forced cancel/success redirects to www.selorg.com (old web app).
 */
export function isHostedWorldlineDeployment(): boolean {
  const hostedSignals = [
    process.env.WORLDLINE_RETURN_URL,
    process.env.API_BASE_URL,
    process.env.PUBLIC_API_URL,
  ];
  for (const signal of hostedSignals) {
    const trimmed = trimEnv(signal);
    if (trimmed && !isLocalOrPrivateHost(trimmed)) return true;
  }
  return false;
}

/**
 * Local Paynimo redirects are opt-in only. Set ALLOW_LOCAL_PAYNIMO_REDIRECT=true
 * only on a fully local stack.
 */
export function allowsLocalRedirectUrls(): boolean {
  const optedIn = String(process.env.ALLOW_LOCAL_PAYNIMO_REDIRECT || '').trim().toLowerCase() === 'true';
  if (!optedIn) return false;
  if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production') return false;
  if (isHostedWorldlineDeployment()) return false;
  return true;
}

/** Sanitize a client-supplied checkout origin (window.location.origin). Bare origin or null. */
export function sanitizeCheckoutOrigin(candidate: unknown, log = logger): string | null {
  const trimmed = trimEnv(candidate);
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    log?.warn?.('Ignoring invalid checkoutOrigin for Paynimo redirect', { candidate: trimmed });
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname;
  if (SELORG_WEB_HOST_RE.test(host)) {
    return `https://${host}`;
  }

  if (isLocalOrPrivateHost(host)) {
    if (!allowsLocalRedirectUrls()) {
      log?.warn?.('Ignoring local checkoutOrigin for Paynimo redirect', {
        candidate: trimmed,
        fallback: PRODUCTION_WEB_APP_URL,
        hint: 'Set ALLOW_LOCAL_PAYNIMO_REDIRECT=true only for local Paynimo testing',
      });
      return null;
    }
    return url.origin.replace(/\/$/, '');
  }

  // Explicitly configured customer-web hosts (staging / preview) may be non-selorg.com.
  const configuredHosts = [process.env.WORLDLINE_WEB_APP_URL, process.env.CUSTOMER_WEB_URL, process.env.FRONTEND_URL]
    .map((v) => trimEnv(v))
    .filter(Boolean)
    .map((v) => {
      try {
        return new URL(v!.includes('://') ? v! : `https://${v}`).hostname.toLowerCase();
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (configuredHosts.includes(host.toLowerCase())) {
    return url.origin.replace(/\/$/, '');
  }

  log?.warn?.('Ignoring non-Selorg checkoutOrigin for Paynimo redirect', {
    candidate: trimmed,
    fallback: PRODUCTION_WEB_APP_URL,
  });
  return null;
}

export function resolveWebAppBaseUrl(log = logger, preferredOrigin?: unknown): string {
  const fromClient = sanitizeCheckoutOrigin(preferredOrigin, log);
  if (fromClient) return fromClient;

  const allowLocal = allowsLocalRedirectUrls();
  const candidates = [process.env.WORLDLINE_WEB_APP_URL, process.env.CUSTOMER_WEB_URL, process.env.FRONTEND_URL];

  for (const candidate of candidates) {
    const trimmed = trimEnv(candidate);
    if (!trimmed) continue;
    const base = trimmed.replace(/\/$/, '');
    if (isLocalOrPrivateHost(base)) {
      if (!allowLocal) {
        log?.warn?.('Ignoring local customer web URL for Paynimo redirect', {
          candidate: base,
          fallback: PRODUCTION_WEB_APP_URL,
          nodeEnv: process.env.NODE_ENV || null,
          hint: 'Set ALLOW_LOCAL_PAYNIMO_REDIRECT=true only for local Paynimo testing',
        });
        continue;
      }
    }
    return base;
  }

  return PRODUCTION_WEB_APP_URL;
}

/** Merchant return URL registered with Worldline for non-web / API callbacks. */
export function resolveWorldlineApiReturnUrl(log = logger): string {
  const allowLocal = allowsLocalRedirectUrls();
  const fromEnv = trimEnv(process.env.WORLDLINE_RETURN_URL);

  if (fromEnv) {
    const cleaned = fromEnv.replace(/\/$/, '');
    if (allowLocal || !isLocalOrPrivateHost(cleaned)) {
      return cleaned;
    }
    log?.warn?.('Ignoring local WORLDLINE_RETURN_URL in hosted/production deployment', {
      candidate: cleaned,
      fallback: PRODUCTION_API_RETURN_URL,
    });
  }

  const apiBase = trimEnv(process.env.API_BASE_URL);
  if (apiBase && !isLocalOrPrivateHost(apiBase)) {
    return `${apiBase.replace(/\/$/, '')}/api/v1/customer/payments/worldline/return`;
  }

  if (allowLocal && fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  return PRODUCTION_API_RETURN_URL;
}

/**
 * Platform-specific return URL embedded in the Paynimo session payload.
 * All platforms use the API callback: the server verifies the gateway response
 * then 302s to `{webApp}/checkout/payment?paynimo_bridge=1&…`.
 * (`checkoutOrigin` is unused here — it is stored on the payment doc for the post-verify redirect.)
 */
export function resolveReturnUrlForPlatform(
  _platform: string,
  log = logger,
  _checkoutOrigin?: unknown,
): string {
  return resolveWorldlineApiReturnUrl(log);
}

export { PRODUCTION_WEB_APP_URL, PRODUCTION_API_RETURN_URL };
