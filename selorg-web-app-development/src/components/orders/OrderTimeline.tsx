import { cn } from "@/lib/cn";
import type { OrderTimelineStep } from "@/types";

/** Five-dot progress rail. Past steps get a tick, the current step a filled dot,
 *  future steps stay empty — matching the design source exactly. */
export function OrderTimeline({ steps }: { steps: OrderTimelineStep[] }) {
  return (
    <div className="relative flex justify-between">
      <div className="absolute left-[8%] right-[8%] top-4 z-[1] h-0.5 bg-line" />
      {steps.map((step) => (
        <div key={step.label} className="relative z-[2] flex flex-1 flex-col items-center gap-1.5">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-extrabold leading-none",
              step.done ? "border-accent bg-accent text-white" : "border-line bg-white text-[#c9ccc0]",
              step.active && "ring-4 ring-accent/20",
            )}
          >
            {step.done ? (step.active ? "●" : "✓") : ""}
          </span>
          <span
            className={cn(
              "max-w-[78px] text-center text-[11px] font-bold leading-[1.2]",
              step.done ? "text-ink" : "text-[#9a9c93]",
              step.active && "text-accent-dark",
            )}
          >
            {step.label}
          </span>
          {step.at ? (
            <span className="text-[10px] font-semibold text-muted">
              {new Date(step.at).toLocaleTimeString("en-IN", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          ) : null}
          {step.note && step.active ? (
            <span className="mt-0.5 max-w-[100px] text-center text-[10px] font-semibold leading-snug text-muted">
              {step.note}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
