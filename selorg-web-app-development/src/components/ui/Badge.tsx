import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "accent" | "warn" | "muted" | "star";

const TONE_CLASSES: Record<Tone, string> = {
  accent: "bg-accent-tint text-accent-dark",
  warn: "bg-warn/10 text-warn",
  muted: "bg-black/5 text-muted",
  star: "bg-star/15 text-[#8a6314]",
};

export function Badge({
  children,
  tone = "accent",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
