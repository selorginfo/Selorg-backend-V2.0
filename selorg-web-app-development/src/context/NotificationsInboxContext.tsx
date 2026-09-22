"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  notificationsService,
  type InboxNotification,
} from "@/services/notificationsService";
import { getToken, onAuthChange } from "@/services/session";

interface NotificationsInboxContextValue {
  notifications: InboxNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsInboxContext = createContext<NotificationsInboxContextValue | null>(null);

export function NotificationsInboxProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [list, count] = await Promise.all([
        notificationsService.list({ limit: 50 }),
        notificationsService.getUnreadCount(),
      ]);
      setNotifications(list.data);
      setUnreadCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    const unsub = onAuthChange(refresh);
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    await notificationsService.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationsService.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  return (
    <NotificationsInboxContext.Provider
      value={{ notifications, unreadCount, loading, error, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationsInboxContext.Provider>
  );
}

export function useNotificationsInbox(): NotificationsInboxContextValue {
  const ctx = useContext(NotificationsInboxContext);
  if (!ctx) throw new Error("useNotificationsInbox must be used within NotificationsInboxProvider");
  return ctx;
}
