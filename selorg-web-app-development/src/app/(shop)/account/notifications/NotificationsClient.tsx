"use client";

import { Bell, CheckCheck } from "lucide-react";
import { usePreferences } from "@/context/PreferencesContext";
import { useNotificationsInbox } from "@/context/NotificationsInboxContext";
import { Switch } from "@/components/ui/Switch";
import { PanelListSkeleton } from "@/components/ui/page-skeletons";

const PREF_ROWS: { key: "offers" | "sms" | "whatsapp"; title: string; sub: string }[] = [
  { key: "offers", title: "Offers & promotions", sub: "Deals, coupons and sale alerts" },
  { key: "sms", title: "SMS updates", sub: "Order status over SMS" },
  { key: "whatsapp", title: "WhatsApp updates", sub: "Delivery alerts on WhatsApp" },
];

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export function NotificationsClient() {
  const { prefs, togglePref } = usePreferences();
  const { notifications, unreadCount, loading, error, markRead, markAllRead } =
    useNotificationsInbox();

  return (
    <div className="flex flex-col gap-5">
      <div className="w-full min-w-0 rounded-2xl border border-line bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <Bell size={18} className="text-accent-dark" /> Inbox
            {unreadCount > 0 ? (
              <span className="rounded-full bg-warn px-2 py-0.5 text-[11px] font-extrabold text-white">
                {unreadCount}
              </span>
            ) : null}
          </h2>
          {unreadCount > 0 ? (
            <button
              onClick={() => void markAllRead()}
              className="flex items-center gap-1 text-xs font-bold text-accent-dark"
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          ) : null}
        </div>

        {loading ? (
          <PanelListSkeleton rows={5} />
        ) : error ? (
          <div className="rounded-xl border border-[#ffd9cf] bg-[#fff2ef] p-4 text-sm font-semibold text-warn">
            {error}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted">No notifications yet</div>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.read && void markRead(n.id)}
                className={`flex flex-col gap-1 py-3.5 text-left first:pt-0 last:pb-0 ${
                  !n.read ? "opacity-100" : "opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-sm font-bold ${!n.read ? "text-ink" : "text-muted"}`}>
                    {!n.read ? <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent" /> : null}
                    {n.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">{formatWhen(n.createdAt)}</span>
                </div>
                <p className="text-[13px] leading-relaxed text-muted">{n.body}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-full min-w-0 rounded-2xl border border-line bg-white p-6">
        <h2 className="mb-4 text-lg font-extrabold">Notification preferences</h2>
        <div className="flex flex-col">
          {PREF_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between border-b border-line py-3.5 last:border-b-0">
              <div>
                <div className="text-sm font-bold">{row.title}</div>
                <div className="mt-0.5 text-xs text-muted">{row.sub}</div>
              </div>
              <Switch checked={prefs[row.key]} onChange={() => togglePref(row.key)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
