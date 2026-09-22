"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { refundService, type RefundDetails, type RefundSummary } from "@/services/refundService";
import { formatMoney } from "@/lib/money";
import { PanelListSkeleton } from "@/components/ui/page-skeletons";
import { Modal } from "@/components/ui/Modal";

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes("complet") || s.includes("refunded") || s === "approved") return "text-brand";
  if (s.includes("reject") || s.includes("declin")) return "text-warn";
  return "text-muted";
}

export function RefundsClient() {
  const [refunds, setRefunds] = useState<RefundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<RefundDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await refundService.list();
      setRefunds(result.refunds ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load refunds");
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

  useEffect(() => {
    if (!selectedId) {
      setDetails(null);
      return;
    }
    let cancelled = false;
    setDetailsLoading(true);
    void refundService
      .getDetails(selectedId)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = refunds.find((r) => r.id === selectedId) ?? null;
          setDetails(fallback);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, refunds]);

  const closeDetails = () => setSelectedId(null);

  return (
    <>
      <div className="w-full min-w-0 rounded-2xl border border-line bg-white p-6">
        <h2 className="mb-4 text-lg font-extrabold">Refunds</h2>
        {loading ? (
          <PanelListSkeleton rows={3} />
        ) : error ? (
          <p className="text-sm font-semibold text-warn">{error}</p>
        ) : refunds.length === 0 ? (
          <p className="text-sm text-muted">No refund requests yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {refunds.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition-colors hover:bg-black/[0.02]"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold">Order #{r.orderNumber ?? r.orderId}</div>
                  <div className={`text-xs font-semibold ${statusTone(r.status)}`}>
                    {r.statusText ?? r.status}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <div className="text-sm font-extrabold">{formatMoney(r.amount)}</div>
                    <div className="text-[11px] text-muted">
                      {new Date(r.date).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted" aria-hidden />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal open={Boolean(selectedId)} onClose={closeDetails} title="Refund details">
        {detailsLoading && !details ? (
          <p className="text-sm text-muted">Loading details…</p>
        ) : details ? (
          <div className="max-h-[min(70dvh,520px)] overflow-y-auto">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold">Order #{details.orderNumber ?? details.orderId}</div>
                <div className={`mt-0.5 text-xs font-semibold ${statusTone(details.status)}`}>
                  {details.statusText ?? details.status}
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-extrabold">{formatMoney(details.amount)}</div>
                <div className="text-[11px] text-muted">
                  {details.dateTime ??
                    new Date(details.date).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                </div>
              </div>
            </div>

            {details.reasonText ? (
              <div className="mb-4 rounded-xl bg-black/[0.03] px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Reason</div>
                <div className="mt-0.5 text-sm font-semibold text-ink">{details.reasonText}</div>
              </div>
            ) : null}

            <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-line px-3 py-2">
                <div className="text-muted">Requested</div>
                <div className="mt-0.5 font-extrabold">
                  {formatMoney(details.refundAmountRequested ?? details.amount)}
                </div>
              </div>
              <div className="rounded-xl border border-line px-3 py-2">
                <div className="text-muted">Approved</div>
                <div className="mt-0.5 font-extrabold">
                  {formatMoney(details.refundAmountApproved ?? 0)}
                </div>
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Items</h3>
              {typeof details.totalItems === "number" ? (
                <span className="text-xs text-muted">{details.totalItems} items</span>
              ) : null}
            </div>

            {details.products && details.products.length > 0 ? (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {details.products.map((item) => (
                  <li
                    key={`${details.id}-${item.name}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span>
                      {item.name}
                      <span className="text-muted"> ×{item.quantity}</span>
                    </span>
                    <span className="shrink-0 font-bold">{formatMoney(item.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No item details available.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Could not load refund details.</p>
        )}
      </Modal>
    </>
  );
}
