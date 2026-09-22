"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import { supportService, type SupportTicket } from "@/services/supportService";
import { useUI } from "@/context/UIContext";
import { Button } from "@/components/ui/Button";
import { PanelListSkeleton } from "@/components/ui/page-skeletons";

export function SupportClient() {
  const { showToast } = useUI();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("order");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await supportService.listTickets();
      setTickets(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const createTicket = async () => {
    if (!subject.trim() && !description.trim()) {
      showToast("Please describe your issue");
      return;
    }
    setSubmitting(true);
    try {
      await supportService.createTicket({
        subject: subject.trim() || "Support request",
        description: description.trim(),
        category,
      });
      setSubject("");
      setDescription("");
      setShowForm(false);
      await load();
      showToast("Support ticket created");
    } catch {
      showToast("Could not create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wrap max-w-[720px] py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Help &amp; Support</h1>
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} className="mr-1" /> New ticket
        </Button>
      </div>

      {showForm ? (
        <div className="mb-6 rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-extrabold">Create a support ticket</h2>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mb-3 w-full rounded-xl border border-line px-3 py-2.5 text-sm"
          >
            <option value="order">Order</option>
            <option value="payment">Payment</option>
            <option value="delivery">Delivery</option>
            <option value="account">Account</option>
            <option value="technical">Technical</option>
            <option value="feedback">Feedback</option>
          </select>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="mb-3 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your issue…"
            rows={4}
            className="mb-4 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={submitting} onClick={() => void createTicket()}>
              Submit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <PanelListSkeleton rows={4} />
      ) : error ? (
        <div className="rounded-xl border border-[#ffd9cf] bg-[#fff2ef] p-4 text-sm font-semibold text-warn">
          {error}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center">
          <MessageSquare size={32} className="mx-auto mb-3 text-muted" />
          <p className="text-sm text-muted">No support tickets yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/support/${t.id}`}
              className="rounded-2xl border border-line bg-white p-4 hover:border-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold">{t.subject}</div>
                  <div className="mt-1 text-xs text-muted">#{t.ticketNumber} · {t.category}</div>
                </div>
                <span className="shrink-0 rounded-full bg-accent-tint px-2.5 py-1 text-[11px] font-bold capitalize text-accent-dark">
                  {t.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
