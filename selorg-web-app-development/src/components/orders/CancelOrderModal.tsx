"use client";

import { useEffect, useState } from "react";
import { useOrders } from "@/context/OrdersContext";
import { useUI } from "@/context/UIContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { formatOrderRef } from "@/lib/orders";

/** Same catalogue as the customer mobile CancelOrderSheet. */
const CANCEL_REASONS = [
  "Ordered by mistake",
  "Delivery taking too long",
  "Want to change items",
  "Found a better price",
  "Other",
] as const;

export function CancelOrderModal() {
  const { modal, closeModal } = useUI();
  const { cancelOrder, getOrder } = useOrders();
  const open = modal?.type === "cancelOrder";
  const orderId = open ? modal.orderId : "";
  const order = orderId ? getOrder(orderId) : undefined;

  const [reason, setReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    if (submitting) return;
    closeModal();
  };

  const handleConfirm = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      await cancelOrder(orderId, reason);
      closeModal();
    } catch {
      // Toast + rollback live in OrdersContext.cancelOrder
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Cancel order?">
      {order ? (
        <p className="mb-3 text-[12.5px] font-semibold text-muted">{formatOrderRef(order)}</p>
      ) : null}

      <div className="mb-4 rounded-[13px] bg-accent-tint px-3.5 py-3 text-[12.5px] font-semibold leading-snug text-accent-dark">
        You&apos;re within the free-cancellation window — no fee, full refund to your original
        payment method.
      </div>

      <p className="mb-3 text-sm font-extrabold">Why are you cancelling?</p>

      <div className="mb-5 flex flex-col gap-2.5" role="radiogroup" aria-label="Cancellation reason">
        {CANCEL_REASONS.map((r) => {
          const selected = reason === r;
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={submitting}
              onClick={() => setReason(r)}
              className={cn(
                "flex items-center gap-3 rounded-[13px] border-[1.5px] px-3.5 py-3 text-left transition-colors",
                selected ? "border-accent bg-accent-tint" : "border-line hover:border-accent/50",
              )}
            >
              <span
                className={cn(
                  "h-[18px] w-[18px] shrink-0 rounded-full border-2",
                  selected ? "border-accent bg-accent" : "border-line bg-white",
                )}
              />
              <span className="text-[13.5px] font-semibold">{r}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleClose} disabled={submitting} className="flex-1">
          Keep order
        </Button>
        <Button
          variant="danger"
          onClick={() => void handleConfirm()}
          disabled={!reason || submitting}
          className="flex-1 border-warn bg-warn text-white hover:bg-warn/90 disabled:border-transparent"
        >
          {submitting ? "Cancelling…" : "Confirm cancel"}
        </Button>
      </div>
    </Modal>
  );
}
