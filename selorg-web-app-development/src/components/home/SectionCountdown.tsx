"use client";

import { Zap } from "lucide-react";
import { useCountdown } from "@/hooks/useCountdown";
import { useMounted } from "@/hooks/useMounted";

/** "Ends in HH : MM : SS" pill that sits beside a time-limited section heading,
 *  matching the prototype's Flash Deals badge. Renders nothing until mounted so
 *  the server and client markup agree. */
export function SectionCountdown() {
  const mounted = useMounted();
  const countdown = useCountdown();

  if (!mounted) return null;

  return (
    <span className="flex items-center gap-1.5 rounded-[10px] border border-[#ffd9cf] bg-[#fff2ef] px-3 py-1.5 text-[13px] font-extrabold text-warn">
      <Zap size={14} className="shrink-0" />
      Ends in {countdown}
    </span>
  );
}
