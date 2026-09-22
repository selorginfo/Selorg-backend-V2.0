"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supportService, type SupportMessage } from "@/services/supportService";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

export function TicketDetailClient() {
  const params = useParams();
  const ticketId = String(params.ticketId ?? "");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await supportService.getMessages(ticketId);
      setMessages(list);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await supportService.sendMessage(ticketId, reply.trim());
      setReply("");
      await load();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-8 sm:px-8">
      <Link href="/account/help#chat" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-accent-dark">
        <ArrowLeft size={16} /> Back to support
      </Link>

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 border-b border-line pb-3 last:border-0">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-white">
          <div className="max-h-[420px] divide-y divide-line overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No messages yet.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="py-3">
                  <div className="mb-1 text-[11px] font-bold text-muted">
                    {m.authorName ?? m.sender ?? m.senderType ?? "Support"}
                  </div>
                  <p className="text-sm">{m.text ?? m.message}</p>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-line p-4">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply…"
              rows={3}
              className="mb-3 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
            <Button size="sm" disabled={sending} onClick={() => void send()}>
              Send reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
