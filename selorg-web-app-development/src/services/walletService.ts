import { apiGet, apiPost } from "./api";
import type { WalletTransaction } from "@/types";

export interface WalletBalance {
  balance: number;
  pendingCredits: number;
  currency: string;
  isActive: boolean;
}

interface BackendTransaction {
  _id: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function toTransaction(raw: BackendTransaction): WalletTransaction {
  return {
    id: raw._id,
    label: raw.description || (raw.type === "credit" ? "Money added" : "Payment"),
    when: timeAgo(raw.createdAt),
    amt: raw.amount,
    type: raw.type,
  };
}

export async function getBalance(): Promise<WalletBalance> {
  return apiGet<WalletBalance>("/wallet/balance");
}

export async function getTransactions(): Promise<WalletTransaction[]> {
  const raw = await apiGet<BackendTransaction[]>("/wallet/transactions?limit=50");
  return raw.map(toTransaction);
}

import type { CreateSessionResult } from "./paymentService";

/**
 * Starts a real Worldline/Paynimo top-up session (POST /wallet/top-up/session).
 * This is the SAME gateway mechanics as order payment (see paymentService.ts)
 * — the response is a `sessionPayload` meant for Paynimo's client-side JS SDK,
 * not a redirect URL. Handing off to that SDK is a documented integration
 * stub (`openPaynimoCheckout`) since the SDK itself isn't available here.
 */
export async function initiateTopUp(amount: number): Promise<CreateSessionResult> {
  return apiPost<CreateSessionResult>("/wallet/top-up/session", {
    amount,
    platform: "web",
    checkoutOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
  });
}
