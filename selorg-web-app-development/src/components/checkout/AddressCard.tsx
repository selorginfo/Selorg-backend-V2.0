import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Address } from "@/types";

export function AddressCard({
  address,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  address: Address;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetDefault?: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-[13px] border-[1.5px] px-4 py-3.5",
        onSelect && "cursor-pointer",
        selected ? "border-accent bg-accent-tint" : "border-line bg-white",
      )}
    >
      {onSelect ? (
        <span
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-accent",
            selected ? "bg-accent shadow-[0_0_0_3px_var(--color-accent-tint)]" : "bg-white",
          )}
        />
      ) : null}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-line bg-white px-2 py-0.5 text-[10.5px] font-extrabold text-muted">
            {address.type}
          </span>
          {address.def ? (
            <span className="text-[11px] font-bold text-accent-dark">Default</span>
          ) : onSetDefault ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetDefault();
              }}
              className="text-[11px] font-bold text-muted hover:text-accent-dark"
            >
              Set default
            </button>
          ) : null}
        </div>
        <div className="mt-1 text-[13px] leading-normal text-[#4a4d43]">
          {address.line}
        </div>
        <div className="mt-0.5 text-[12.5px] text-muted">{address.area}</div>

        {onEdit || onDelete ? (
          <div className="mt-2 flex gap-4">
            {onEdit ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="flex items-center gap-1 text-xs font-bold text-accent-dark"
              >
                <Pencil size={12} /> Edit
              </button>
            ) : null}
            {onDelete ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="flex items-center gap-1 text-xs font-bold text-warn"
              >
                <Trash2 size={12} /> Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
