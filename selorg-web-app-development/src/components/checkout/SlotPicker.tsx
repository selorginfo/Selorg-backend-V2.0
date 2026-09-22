"use client";

import { useDelivery } from "@/context/DeliveryContext";
import { cn } from "@/lib/cn";
import type { DeliverySlotId } from "@/types";

export function SlotPicker({
  selected,
  onSelect,
}: {
  selected: DeliverySlotId;
  onSelect: (id: DeliverySlotId) => void;
}) {
  const { promiseText, estimatedMinutes, loading } = useDelivery();
  const sub = loading
    ? "Calculating…"
    : promiseText
      ? promiseText
      : estimatedMinutes
        ? `In about ${estimatedMinutes} minutes`
        : "As soon as possible";

  return (
    <div className="flex flex-wrap gap-2.5">
      <button
        type="button"
        onClick={() => onSelect("now")}
        className={cn(
          "min-w-[140px] flex-1 rounded-xl border-[1.5px] px-4 py-3 text-left sm:flex-none",
          selected === "now" ? "border-accent bg-accent-tint" : "border-line",
        )}
      >
        <div
          className={cn(
            "text-[13.5px] font-extrabold",
            selected === "now" ? "text-accent-dark" : "text-ink",
          )}
        >
          Express
        </div>
        <div className="mt-0.5 text-[11.5px] text-muted">{sub}</div>
      </button>
    </div>
  );
}
