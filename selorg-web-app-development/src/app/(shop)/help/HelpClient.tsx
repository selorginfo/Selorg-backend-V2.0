"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Clock3,
  FileText,
  HelpCircle,
  Mail,
  MessageCircle,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useAppConfig } from "@/context/AppConfigContext";
import { useUI } from "@/context/UIContext";
import { getToken } from "@/services/session";
import { supportService, type SupportTicket } from "@/services/supportService";
import { contentService, type FaqItem } from "@/services/contentService";
import { Button } from "@/components/ui/Button";
import { PanelListSkeleton } from "@/components/ui/page-skeletons";
import { cn } from "@/lib/cn";
import {
  formatDisplayPhone,
  mailtoHref,
  telHref,
  whatsappHref,
} from "@/lib/supportContact";

const QUICK_LINKS_BASE = [
  { href: "/account/orders", label: "Track orders", Icon: Package, hint: "Live status & invoices" },
  { href: "/account/refunds", label: "Refunds", Icon: RefreshCw, hint: "Request or check status" },
  { href: "/account/wallet", label: "Wallet", Icon: Wallet, hint: "Balance & top-ups" },
];

const TICKET_CATEGORIES = [
  { value: "order", label: "Order" },
  { value: "payment", label: "Payment" },
  { value: "delivery", label: "Delivery" },
  { value: "account", label: "Account" },
  { value: "technical", label: "Technical" },
  { value: "feedback", label: "Feedback" },
];

export function HelpClient({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const { support } = useAppConfig();
  const { showToast } = useUI();
  const chatRef = useRef<HTMLElement | null>(null);
  const helpPath = embedded ? "/account/help" : "/help";
  const policiesPath = embedded ? "/account/policies" : "/policies";
  const quickLinks = [
    ...QUICK_LINKS_BASE,
    { href: policiesPath, label: "Policies", Icon: FileText, hint: "Terms, privacy & more" },
  ];

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [faqPreview, setFaqPreview] = useState<FaqItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("order");
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!getToken()) {
      setTickets([]);
      return;
    }
    setTicketsLoading(true);
    try {
      setTickets(await supportService.listTickets());
    } catch {
      /* keep empty — guest or offline */
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
    void contentService
      .getFaq()
      .then((r) => setFaqPreview((r.data ?? []).slice(0, 5)))
      .catch(() => undefined);

    if (typeof window !== "undefined" && window.location.hash === "#chat") {
      window.setTimeout(() => chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      setShowForm(true);
    }
  }, [loadTickets]);

  const openChat = () => {
    if (!getToken()) {
      router.push(`/auth?redirect=${encodeURIComponent(`${helpPath}#chat`)}`);
      return;
    }
    setShowForm(true);
    chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const createTicket = async () => {
    if (!getToken()) {
      router.push(`/auth?redirect=${encodeURIComponent(`${helpPath}#chat`)}`);
      return;
    }
    if (!subject.trim() && !description.trim()) {
      showToast("Please describe your issue");
      return;
    }
    setSubmitting(true);
    try {
      const ticket = await supportService.createTicket({
        subject: subject.trim() || "Support request",
        description: description.trim(),
        category,
      });
      setSubject("");
      setDescription("");
      setShowForm(false);
      await loadTickets();
      showToast("Support ticket created");
      if (ticket?.id) {
        window.location.href = `/support/${ticket.id}`;
      }
    } catch {
      showToast("Could not create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn(embedded ? "pb-2" : "wrap max-w-[980px] pb-14 pt-6 sm:pt-8")}>
      {/* Hero — one composition */}
      <section
        className={cn(
          "relative overflow-hidden bg-[#1a2116] text-white",
          embedded ? "rounded-2xl px-5 py-6 sm:px-6 sm:py-7" : "rounded-[22px] px-5 py-8 sm:px-9 sm:py-10",
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 80% 70% at 100% 0%, rgba(94,140,58,0.45), transparent 55%), radial-gradient(ellipse 60% 50% at 0% 100%, rgba(68,106,32,0.35), transparent 50%)",
          }}
        />
        <div className="relative max-w-[520px]">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-accent">Selorg</p>
          <h1
            className={cn(
              "mt-2 font-extrabold leading-tight tracking-tight",
              embedded ? "text-[22px] sm:text-[26px]" : "text-[28px] sm:text-[34px]",
            )}
          >
            Help &amp; Support
          </h1>
          <p className="mt-2.5 text-[14px] leading-relaxed text-white/75 sm:text-[15px]">
            Call us, start a chat, or email — we&apos;re here for orders, payments, delivery, and wallet help.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-white/65">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={14} className="text-accent" />
              {support.workingHours}
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-white/35 sm:inline-block" />
            <span>{support.responseTime}</span>
          </div>
        </div>
      </section>

      {/* Contact channels */}
      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <a
          href={telHref(support.phone)}
          className="group flex flex-col rounded-2xl border border-line bg-white p-5 transition-colors hover:border-accent"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-accent-tint text-accent-dark transition-transform group-hover:scale-105">
            <Phone size={20} />
          </span>
          <h2 className="mt-3.5 text-[15px] font-extrabold">Call</h2>
          <p className="mt-1 text-[12.5px] leading-snug text-muted">Speak with Selorg support</p>
          <span className="mt-3 text-sm font-extrabold text-accent-dark">
            {formatDisplayPhone(support.phone)}
          </span>
        </a>

        <button
          type="button"
          onClick={openChat}
          className="group flex flex-col rounded-2xl border border-line bg-white p-5 text-left transition-colors hover:border-accent"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-accent-tint text-accent-dark transition-transform group-hover:scale-105">
            <MessageCircle size={20} />
          </span>
          <h2 className="mt-3.5 text-[15px] font-extrabold">Chat</h2>
          <p className="mt-1 text-[12.5px] leading-snug text-muted">
            {support.liveChatEnabled ? "In-app ticket chat with our team" : "Message our support team"}
          </p>
          <span className="mt-3 text-sm font-extrabold text-accent-dark">Start a conversation</span>
        </button>

        <a
          href={mailtoHref(support.email)}
          className="group flex flex-col rounded-2xl border border-line bg-white p-5 transition-colors hover:border-accent"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-accent-tint text-accent-dark transition-transform group-hover:scale-105">
            <Mail size={20} />
          </span>
          <h2 className="mt-3.5 text-[15px] font-extrabold">Email</h2>
          <p className="mt-1 text-[12.5px] leading-snug text-muted">Send details &amp; attachments via mail</p>
          <span className="mt-3 break-all text-sm font-extrabold text-accent-dark">{support.email}</span>
        </a>
      </section>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-line bg-accent-tint/40 px-4 py-3.5">
        <p className="text-[13px] text-muted">
          Prefer WhatsApp? Message us on{" "}
          <a
            href={whatsappHref(support.whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-accent-dark"
          >
            {formatDisplayPhone(support.whatsapp)}
          </a>
        </p>
        <Link href={policiesPath} className="text-[13px] font-bold text-accent-dark">
          View all policies →
        </Link>
      </div>

      {/* Quick links */}
      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-extrabold">Quick links</h2>
        <div className="grid gap-2.5 xs:grid-cols-2 sm:grid-cols-4">
          {quickLinks.map(({ href, label, Icon, hint }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4 transition-colors hover:border-accent"
            >
              <Icon size={18} className="mt-0.5 shrink-0 text-accent-dark" />
              <div className="min-w-0">
                <div className="text-[13.5px] font-extrabold">{label}</div>
                <div className="text-[11.5px] text-muted">{hint}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ preview */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-extrabold">Popular questions</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">Answers from our help centre</p>
          </div>
          <Link href="/faq" className="shrink-0 text-[13px] font-bold text-accent-dark">
            All FAQs
          </Link>
        </div>
        {faqPreview.length === 0 ? (
          <Link
            href="/faq"
            className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 hover:border-accent"
          >
            <HelpCircle size={18} className="text-accent-dark" />
            <span className="text-sm font-bold">Browse the full FAQ</span>
            <ChevronRight size={16} className="ml-auto text-muted" />
          </Link>
        ) : (
          <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
            {faqPreview.map((item, i) => (
              <details
                key={item.id}
                className={cn("group px-4 py-3.5", i > 0 && "border-t border-line")}
              >
                <summary className="cursor-pointer list-none text-[13.5px] font-bold marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {item.question}
                    <ChevronRight
                      size={15}
                      className="shrink-0 text-muted transition-transform group-open:rotate-90"
                    />
                  </span>
                </summary>
                <p className="mt-2 pr-6 text-[13px] leading-relaxed text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* Chat / tickets */}
      <section ref={chatRef} id="chat" className="mt-8 scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-extrabold">Chat with support</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">Create a ticket and follow replies here</p>
          </div>
          <Button size="sm" onClick={openChat}>
            <Plus size={16} className="mr-1" /> New chat
          </Button>
        </div>

        {showForm ? (
          <div className="mb-4 rounded-2xl border border-line bg-white p-5">
            <h3 className="mb-3 text-sm font-extrabold">New conversation</h3>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mb-3 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-accent"
            >
              {TICKET_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
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
              placeholder="Describe your issue… include order ID if relevant"
              rows={4}
              className="mb-4 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={submitting} onClick={() => void createTicket()}>
                {submitting ? "Sending…" : "Send message"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {!getToken() ? (
          <div className="rounded-2xl border border-dashed border-line py-10 text-center">
            <MessageCircle size={28} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-muted">Sign in to view and start support chats.</p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => router.push(`/auth?redirect=${encodeURIComponent(`${helpPath}#chat`)}`)}
            >
              Sign in to chat
            </Button>
          </div>
        ) : ticketsLoading ? (
          <PanelListSkeleton rows={3} />
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line py-12 text-center">
            <MessageCircle size={28} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-muted">No conversations yet. Start a chat above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/support/${t.id}`}
                className="rounded-2xl border border-line bg-white p-4 transition-colors hover:border-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold">{t.subject}</div>
                    <div className="mt-1 text-xs text-muted">
                      #{t.ticketNumber} · {t.category}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent-tint px-2.5 py-1 text-[11px] font-bold capitalize text-accent-dark">
                    {t.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
