"use client";

import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import { DIAL_CODES } from "@/lib/constants";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { cn } from "@/lib/cn";

function CountryFlag({ iso, className }: { iso: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny CDN flag icons; avoid next/image remote config for this
    <img
      src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`}
      alt=""
      width={20}
      height={15}
      className={cn("inline-block shrink-0 rounded-[2px] object-cover", className)}
      loading="lazy"
      decoding="async"
    />
  );
}

export function DialCodePicker({
  dialCode,
  dialOpen,
  setDialOpen,
  setDialCode,
}: {
  dialCode: string;
  dialOpen: boolean;
  setDialOpen: (open: boolean) => void;
  setDialCode: (code: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, () => setDialOpen(false));
  const current = DIAL_CODES.find((d) => d.d === dialCode) ?? DIAL_CODES[0]!;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setDialOpen(!dialOpen)}
        aria-label={`Country code ${current.d}`}
        aria-expanded={dialOpen}
        className="flex h-full items-center gap-1.5 py-0 pl-3 pr-2.5 text-[14px] font-bold min-[560px]:gap-2 min-[560px]:pl-3.5 min-[560px]:pr-3 min-[560px]:text-[15px]"
      >
        <CountryFlag iso={current.iso} className="h-[14px] w-[20px]" />
        <span className="tabular-nums">{current.d}</span>
        <ChevronDown size={14} className="shrink-0 opacity-70" />
      </button>
      {dialOpen ? (
        <div className="absolute top-[calc(100%+6px)] left-0 z-20 max-h-[242px] w-[260px] overflow-y-auto rounded-[13px] border border-line bg-white p-1.5 shadow-2xl">
          {DIAL_CODES.map((d) => {
            const selected = d.d === current.d;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => {
                  setDialCode(d.d);
                  setDialOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2.5 rounded-[9px] px-3 py-2.5 text-left text-[13.5px] font-semibold hover:bg-accent-tint",
                  selected && "bg-accent-tint text-accent-dark",
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <CountryFlag iso={d.iso} className="h-3.5 w-5" />
                  <span className="truncate">{d.c}</span>
                </span>
                <b className="shrink-0 text-[13px]">{d.d}</b>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
