/**
 * Persist an in-flight wallet top-up across Paynimo full-page redirects.
 * Used so cancel/fail returns without `purpose` still route to wallet UI,
 * never order confirmation/failed.
 */

export const WALLET_TOPUP_PURPOSE = "wallet_topup" as const;

export interface PendingWalletTopup {
  orderId: string;
  txnId: string;
  amount: number;
  startedAt: number;
}

const STORAGE_KEY = "selorg_wallet_topup_pending";
/** Drop stale sessions after 45 minutes (gateway sessions expire sooner). */
const MAX_AGE_MS = 45 * 60 * 1000;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function savePendingWalletTopup(session: PendingWalletTopup): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* private mode / quota */
  }
}

export function getPendingWalletTopup(): PendingWalletTopup | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingWalletTopup;
    if (!parsed?.orderId || !parsed?.txnId) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() - Number(parsed.startedAt || 0) > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingWalletTopup(): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function isWalletTopupPurpose(purpose: string | null | undefined): boolean {
  return String(purpose || "").trim().toLowerCase() === WALLET_TOPUP_PURPOSE;
}

/**
 * True when this Paynimo bridge return belongs to a wallet top-up
 * (explicit purpose or matching pending session).
 */
export function isWalletTopupReturn(params: {
  purpose?: string | null;
  orderId?: string | null;
  txnId?: string | null;
}): boolean {
  const purpose = String(params.purpose || "").trim().toLowerCase();
  if (purpose === "order") return false;
  if (purpose === WALLET_TOPUP_PURPOSE) return true;
  const pending = getPendingWalletTopup();
  if (!pending) return false;
  if (params.orderId && params.orderId === pending.orderId) return true;
  if (params.txnId && params.txnId === pending.txnId) return true;
  // Cancel/empty returns often omit orderId+txnId — still treat as wallet if we
  // have an active pending top-up (user started Add Money in this tab).
  if (!params.orderId && !params.txnId) return true;
  return false;
}

/** Build `/account/wallet?...` preserving bridge query + forcing purpose. */
export function buildWalletTopupReturnHref(searchParams: URLSearchParams): string {
  const q = new URLSearchParams(searchParams.toString());
  q.set("paynimo_bridge", "1");
  q.set("purpose", WALLET_TOPUP_PURPOSE);
  const pending = getPendingWalletTopup();
  if (!q.get("orderId") && pending?.orderId) q.set("orderId", pending.orderId);
  if (!q.get("txnId") && pending?.txnId) q.set("txnId", pending.txnId);
  if (!q.get("amount") && pending?.amount) q.set("amount", String(pending.amount));
  if (!q.get("status")) q.set("status", "cancelled");
  return `/account/wallet?${q.toString()}`;
}
