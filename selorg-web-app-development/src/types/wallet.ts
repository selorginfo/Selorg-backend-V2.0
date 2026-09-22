export type WalletTxnType = "credit" | "debit";

export interface WalletTransaction {
  id: string;
  label: string;
  when: string;
  amt: number;
  type: WalletTxnType;
}

export interface WalletState {
  balance: number;
  autoTopup: boolean;
  useAtCheckout: boolean;
  txns: WalletTransaction[];
}

export type TopupMethod = "upi" | "card" | "netbanking";
export type TopupStep =
  | "confirm"
  | "method"
  | "processing"
  | "failed";

/** Dedicated wallet top-up result (never order success/fail). */
export type WalletTopupResultStatus =
  | "success"
  | "failed"
  | "cancelled"
  | "pending"
  | "processing";

export interface WalletTopupResultState {
  status: WalletTopupResultStatus;
  amount: number;
  balance: number;
  txnId?: string;
  orderId?: string;
  message?: string;
}
