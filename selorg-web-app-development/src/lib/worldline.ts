/** Parse query string from a Worldline/Paynimo return URL into a plain object. */
export function parseReturnUrl(url: string): Record<string, unknown> {
  try {
    const parts = url.split("?");
    const query = parts[1]?.split("#")[0] ?? "";
    const out: Record<string, unknown> = {};
    if (!query) return out;
    query.split("&").forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || "");
    });
    return out;
  } catch {
    return { rawUrl: url };
  }
}

export function isWorldlinePaidStatus(status: {
  paymentStatus?: string;
  status?: string;
  orderPaymentStatus?: string;
  uiState?: string;
  walletCredited?: boolean;
}): boolean {
  if (status.walletCredited) return true;
  if (status.uiState === "PAID") return true;
  const pay = String(status.paymentStatus || status.orderPaymentStatus || "").toLowerCase();
  if (pay === "paid") return true;
  const st = String(status.status || "").toLowerCase();
  return st === "success" || st === "paid";
}

export function isWorldlinePendingStatus(status: {
  uiState?: string;
  paymentStatus?: string;
}): boolean {
  const ui = String(status.uiState || "").toUpperCase();
  return ui === "PENDING_VERIFICATION" || ui === "WAITING_FOR_PAYMENT" || ui === "UNKNOWN";
}

export function isWorldlineFailedStatus(status: {
  uiState?: string;
  orderPaymentStatus?: string;
  paymentStatus?: string;
  status?: string;
  walletCredited?: boolean;
  latestPayment?: { status?: string };
}): boolean {
  // Never treat a credited wallet top-up as failed/cancelled.
  if (status.walletCredited) return false;
  const ui = String(status.uiState || "").toUpperCase();
  if (ui === "PAID") return false;
  if (ui === "FAILED") return true;
  const pay = String(status.orderPaymentStatus || status.paymentStatus || "").toLowerCase();
  if (pay === "paid") return false;
  if (pay === "failed") return true;
  const st = String(status.status || status.latestPayment?.status || "").toLowerCase();
  if (st === "success" || st === "paid") return false;
  if (st === "failed" || st === "cancelled" || st === "canceled") return true;
  // RETRY_AVAILABLE alone is ambiguous (cancel vs expired) — only fail when status says so.
  return false;
}

/** Wallet top-up success requires confirmed backend credit (not gateway-only success). */
export function isWalletTopupCredited(status: { walletCredited?: boolean }): boolean {
  return !!status.walletCredited;
}

export function isWorldlineReturnUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("worldline/return") ||
    lower.includes("payment-result") ||
    lower.includes("payment_status") ||
    lower.includes("paynimo-return") ||
    lower.includes("paynimo_bridge=1") ||
    lower.includes("status=success") ||
    lower.includes("status=failed") ||
    lower.includes("status=cancelled") ||
    lower.includes("txnstatus")
  );
}
