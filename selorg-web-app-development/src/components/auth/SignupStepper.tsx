import { Fragment } from "react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { n: 1, label: "Number" },
  { n: 2, label: "Verify" },
  { n: 3, label: "Details" },
] as const;

/** Number → Verify → Details progress rail shown above every sign-up step. */
export function SignupStepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mb-[18px] flex items-center gap-1.5">
      {ITEMS.map((item, i) => {
        const done = step > item.n;
        const on = step === item.n;
        return (
          <Fragment key={item.n}>
            <span
              className={cn(
                "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[11px] font-extrabold transition-all duration-200",
                done || on ? "border-accent bg-accent text-white" : "border-line bg-white text-[#9a9c93]",
              )}
            >
              {done ? "✓" : item.n}
            </span>
            <span
              className={cn(
                "whitespace-nowrap text-[11.5px]",
                on ? "font-extrabold text-accent-dark" : "font-semibold text-[#9a9c93]",
              )}
            >
              {item.label}
            </span>
            {i < ITEMS.length - 1 ? (
              <span
                className={cn(
                  "h-0.5 min-w-2.5 flex-1 rounded-sm transition-colors duration-300",
                  done ? "bg-accent" : "bg-line",
                )}
              />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
