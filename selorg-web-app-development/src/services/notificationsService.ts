import { apiDelete, apiGet, apiGetBody, apiPut } from "./api";

/** GET/PUT /customer/notifications/preferences — real per-channel + per-category prefs. */
export interface NotificationPreferences {
  push: boolean;
  inApp: boolean;
  sms: boolean;
  whatsapp: boolean;
  email: boolean;
  dnd: boolean;
  dndStartHour: number;
  dndEndHour: number;
  categories: Record<string, { push: boolean; inApp: boolean; sms: boolean; whatsapp: boolean; email: boolean }>;
}

export interface InboxNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  category?: string;
  data?: Record<string, unknown>;
  createdAt: string;
  deliveryStatus?: string;
}

export interface NotificationListResult {
  data: InboxNotification[];
  pagination?: { page: number; limit: number; total: number; totalPages?: number };
  unreadCount: number;
}

export const notificationsService = {
  async getPreferences(): Promise<NotificationPreferences> {
    return apiGet<NotificationPreferences>("/notifications/preferences");
  },

  async updatePreferences(patch: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    return apiPut<NotificationPreferences>("/notifications/preferences", patch);
  },

  async list(params?: {
    page?: number;
    limit?: number;
    category?: string;
    unreadOnly?: boolean;
  }): Promise<NotificationListResult> {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.category) q.set("category", params.category);
    if (params?.unreadOnly) q.set("unread", "1");
    const qs = q.toString();
    const result = await apiGetBody<NotificationListResult>(
      `/notifications${qs ? `?${qs}` : ""}`,
    );
    return {
      data: result.data ?? [],
      pagination: result.pagination,
      unreadCount: result.unreadCount ?? 0,
    };
  },

  async getUnreadCount(): Promise<number> {
    const result = await apiGet<{ unreadCount: number }>("/notifications/unread-count");
    return result.unreadCount ?? 0;
  },

  async markRead(id: string): Promise<InboxNotification> {
    return apiPut<InboxNotification>(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await apiPut("/notifications/read-all");
  },

  async markUnread(id: string): Promise<InboxNotification> {
    return apiPut<InboxNotification>(`/notifications/${id}/unread`);
  },

  async deleteNotification(id: string): Promise<void> {
    await apiDelete(`/notifications/${id}`);
  },
};
