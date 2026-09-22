import { apiGet, apiPost } from "./api";

export interface RefundItem {
  name: string;
  quantity: number;
  amount: number;
}

export interface RefundSummary {
  id: string;
  orderId: string;
  orderNumber?: string;
  date: string;
  status: string;
  statusText?: string;
  amount: number;
  currency?: string;
  reasonCode?: string;
  reasonText?: string;
  products?: RefundItem[];
}

export interface RefundDetails extends RefundSummary {
  dateTime?: string;
  totalItems?: number;
  refundAmountRequested?: number;
  refundAmountApproved?: number;
}

export const refundService = {
  async list(page = 1, pageSize = 20): Promise<{ refunds: RefundSummary[]; pagination?: unknown }> {
    try {
      const result = await apiGet<{ refunds: RefundSummary[]; pagination?: unknown }>(
        `/refunds?page=${page}&pageSize=${pageSize}`,
      );
      return result ?? { refunds: [], pagination: { page, pageSize, total: 0, totalPages: 0 } };
    } catch {
      return { refunds: [], pagination: { page, pageSize, total: 0, totalPages: 0 } };
    }
  },

  async getById(id: string): Promise<RefundSummary> {
    return apiGet<RefundSummary>(`/refunds/${id}`);
  },

  async getDetails(id: string): Promise<RefundDetails> {
    return apiGet<RefundDetails>(`/refunds/${id}/details`);
  },

  async request(input: {
    orderId: string;
    reasonCode: "item_damaged" | "expired" | "late_delivery" | "wrong_item" | "customer_cancelled" | "other";
    reasonText: string;
    amount?: number;
    currency?: string;
  }): Promise<RefundSummary> {
    return apiPost<RefundSummary>("/refunds/request", input);
  },
};
