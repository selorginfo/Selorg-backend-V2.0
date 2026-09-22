import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { ProductVariant } from "@/types";

export function VariantSelector({
  variants,
  selected,
  onSelect,
}: {
  variants: ProductVariant[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {variants.map((v, i) => (
        <button
          key={v.label}
          onClick={() => onSelect(i)}
          className={cn(
            "min-w-[120px] rounded-xl border-[1.5px] px-4 py-[11px] text-left text-[13.5px] font-bold transition-colors",
            i === selected
              ? "border-accent bg-accent-tint text-ink"
              : "border-line text-ink hover:border-accent/50",
          )}
        >
          <div>{v.label}</div>
          <div className="mt-0.5 text-[13px] font-extrabold text-accent-dark">{formatMoney(v.price)}</div>
        </button>
      ))}
    </div>
  );
}
