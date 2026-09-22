import { apiGet, apiPost } from "./api";

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description?: string;
  category?: string;
  priority?: string;
  status: string;
  channel?: string;
  orderNumber?: string;
  attachments?: unknown[];
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string | null;
  noteCount?: number;
  canReopen?: boolean;
}

export interface SupportMessage {
  id: string;
  text?: string;
  message?: string;
  sender?: string;
  senderType?: string;
  authorName?: string;
  attachments?: unknown[];
  timestamp: string;
}

export const supportService = {
  async listTickets(): Promise<SupportTicket[]> {
    return apiGet<SupportTicket[]>("/support/tickets");
  },

  async getActiveTicket(orderNumber?: string): Promise<SupportTicket | null> {
    const q = orderNumber ? `?orderNumber=${encodeURIComponent(orderNumber)}` : "";
    return apiGet<SupportTicket | null>(`/support/tickets/active${q}`);
  },

  async createTicket(input: {
    subject?: string;
    description?: string;
    message?: string;
    category?: string;
    priority?: string;
    orderNumber?: string;
    orderId?: string;
  }): Promise<SupportTicket> {
    return apiPost<SupportTicket>("/support/tickets", input);
  },

  async reopenTicket(ticketId: string): Promise<SupportTicket> {
    return apiPost<SupportTicket>(`/support/tickets/${ticketId}/reopen`);
  },

  async getMessages(ticketId: string): Promise<SupportMessage[]> {
    const result = await apiGet<{ messages: SupportMessage[] }>(
      `/support/tickets/${ticketId}/messages`,
    );
    return result.messages ?? [];
  },

  async sendMessage(ticketId: string, message: string): Promise<SupportMessage> {
    return apiPost<SupportMessage>(`/support/tickets/${ticketId}/messages`, { message });
  },
};
