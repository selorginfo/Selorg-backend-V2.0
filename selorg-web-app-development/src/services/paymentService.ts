import { launchPaynimoCheckout } from "@/lib/paynimo";
import { apiGet, apiPost } from "./api";

/**
 * Worldline/Paynimo gateway integration (selorg-service
 * src/modules/payments/{payments.routes,payments.controller,worldline.*}.ts).
 * Session create, status poll, complete, and abort call the real backend;
 * `openPaynimoCheckout` loads Paynimo's hosted checkout JS SDK.
 */

export interface WorldlineSessionPayload {
  features: Record<string, unknown>;
  consumerData: {
    deviceId: string;
    token: string;
    returnUrl: string;
    paymentMode: string;
    merchantId: string;
    currency: string;
    consumerId: string;
    consumerMobileNo?: string;
    consumerEmailId?: string;
    txnId: string;
    totalAmount: string;
    items: { itemId: string; amount: string; comAmt: string }[];
    customStyle: Record<string, unknown>;
  };
}

export interface CreateSessionResult {
  paymentId: string;
  orderId: string;
  txnId: string;
  attemptNo: number;
  hashAlgo: string;
  sessionPayload: WorldlineSessionPayload;
}

export interface PaymentStatusResult {
  orderId: string;
  orderPaymentStatus: "paid" | "pending" | "failed" | "cod_pending";
  uiState: "WAITING_FOR_PAYMENT" | "PENDING_VERIFICATION" | "PAID" | "UNKNOWN" | "RETRY_AVAILABLE" | "FAILED";
  recommendedAction: "NONE" | "CREATE_SESSION" | "POLL_STATUS" | "CONTACT_SUPPORT" | "RETRY_PAYMENT" | "OPEN_GATEWAY" | "GO_TO_ORDER";
  /** Present for wallet top-ups (`wallet_topup`) vs grocery orders (`order`). */
  purpose?: "order" | "wallet_topup" | string;
  /** True only after backend credits the wallet (idempotent). */
  walletCredited?: boolean;
  amountInr?: number;
  latestPayment?: {
    txnId: string;
    attemptNo?: number;
    status: string;
    statusCode?: string;
    statusMessage?: string;
    isExpired?: boolean;
    verificationError?: string;
  };
}

export interface CompletePaymentResult {
  orderId: string;
  txnId: string;
  status: string;
  statusCode?: string;
  statusMessage?: string;
  hashOk: boolean;
  verificationError?: string;
}

export const paymentService = {
  /** POST /payments/worldline/session — only valid for orders paid by card/upi/digital (not cash/pure-wallet). */
  async createOrderPaymentSession(
    orderId: string,
    options?: { paymentMode?: "upi" | "card" | "netbanking" | "all" },
  ): Promise<CreateSessionResult> {
    const paymentMode =
      options?.paymentMode === "upi"
        ? "upi"
        : options?.paymentMode === "card"
          ? "cards"
          : options?.paymentMode === "netbanking"
            ? "netbanking"
            : options?.paymentMode === "all"
              ? "all"
              : undefined;

    return apiPost<CreateSessionResult>("/payments/worldline/session", {
      orderId,
      platform: "web",
      ...(paymentMode ? { paymentMode } : {}),
      // Lets the API redirect back to this origin after Paynimo (local :3000 vs prod).
      checkoutOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
    });
  },

  /** GET /payments/worldline/status?orderId= — poll after the SDK reports completion (or on page return). */
  async getPaymentStatus(orderId: string): Promise<PaymentStatusResult> {
    return apiGet<PaymentStatusResult>(`/payments/worldline/status?orderId=${encodeURIComponent(orderId)}`);
  },

  /** POST /payments/worldline/complete — verify the gateway's client-side response server-side. */
  async completePayment(orderId: string, txnId: string, gatewayResponse: object): Promise<CompletePaymentResult> {
    return apiPost<CompletePaymentResult>("/payments/worldline/complete", {
      orderId,
      txnId,
      response: gatewayResponse,
    });
  },

  /** POST /payments/worldline/abort — client-initiated cancel (e.g. user closed the gateway tab). */
  async abortPayment(orderId: string, txnId: string, reason?: string): Promise<void> {
    await apiPost("/payments/worldline/abort", { orderId, txnId, reason });
  },
};

/** Launch Paynimo hosted checkout. Resolves only on SDK load/launch errors — success redirects away. */
export async function openPaynimoCheckout(session: CreateSessionResult): Promise<void> {
  await launchPaynimoCheckout(session.sessionPayload);
}

/** Poll until payment is confirmed, failed, or retries exhausted. */
export async function pollUntilPaymentSettled(
  orderId: string,
  maxAttempts = 8,
  intervalMs = 500,
): Promise<"paid" | "failed" | "pending"> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await paymentService.getPaymentStatus(orderId);
    // Wallet top-ups: credited balance is the real success signal.
    if (status.walletCredited) return "paid";
    if (status.uiState === "PAID" || status.orderPaymentStatus === "paid") return "paid";
    if (status.uiState === "FAILED") return "failed";
    // RETRY_AVAILABLE covers cancelled/expired — not a hard fail until settled.
    const st = String(status.latestPayment?.status || "").toLowerCase();
    if (st === "failed") return "failed";
    if (st === "cancelled" || st === "canceled") {
      // Give success path a moment (abort can race after a successful charge).
      if (i >= maxAttempts - 1) return "failed";
    } else if (status.uiState === "RETRY_AVAILABLE" && i >= maxAttempts - 1) {
      return "failed";
    }
    if (status.orderPaymentStatus === "failed") return "failed";
    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return "pending";
}
