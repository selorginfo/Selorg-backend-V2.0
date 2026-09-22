import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

const SIZE_CLASSES = {
  sm: { h: "h-9", w: "w-8", icon: 16, text: "text-sm", minW: "min-w-[22px]" },
  md: { h: "h-[36px]", w: "w-[30px]", icon: 16, text: "text-sm", minW: "min-w-[22px]" },
  lg: { h: "h-[54px]", w: "w-[52px]", icon: 20, text: "text-lg", minW: "min-w-[40px]" },
} as const;

export function QuantityStepper({
  qty,
  onInc,
  onDec,
  size = "md",
  variant = "solid",
  className,
  disableInc = false,
}: {
  qty: number;
  onInc: () => void;
  onDec: () => void;
  size?: "sm" | "md" | "lg";
  /** `circle` = pill stepper used after the product-card circular add. */
  variant?: "solid" | "outline" | "circle";
  className?: string;
  disableInc?: boolean;
}) {
  const { h, w, icon, text, minW } = SIZE_CLASSES[size];
  const isCircle = variant === "circle";

  return (
    <div
      className={cn(
        "flex items-center font-extrabold",
        variant === "outline"
          ? "rounded-[14px] border-[1.5px] border-accent bg-accent-tint text-accent-dark"
          : isCircle
            ? "rounded-full bg-accent px-1 text-white shadow-[0_6px_14px_-4px_rgba(68,106,32,0.55)]"
            : "rounded-[10px] bg-accent text-white",
        isCircle ? "h-[38px]" : h,
        className,
      )}
    >
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDec();
        }}
        aria-label="Decrease quantity"
        className={cn("flex items-center justify-center", isCircle ? "h-[34px] w-[26px]" : cn(h, w))}
      >
        <Minus size={isCircle ? 15 : icon} strokeWidth={isCircle ? 2.8 : 2} />
      </button>
      <span className={cn("text-center", isCircle ? "min-w-4 text-[13px]" : cn(minW, text))}>{qty}</span>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onInc();
        }}
        aria-label="Increase quantity"
        disabled={disableInc}
        className={cn(
          "flex items-center justify-center",
          isCircle ? "h-[34px] w-[26px]" : cn(h, w),
          disableInc && "opacity-40 cursor-not-allowed",
        )}
      >
        <Plus size={isCircle ? 15 : icon} strokeWidth={isCircle ? 2.8 : 2} />
      </button>
    </div>
  );
}
