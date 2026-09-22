"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

export function OtpInput({
  length = 4,
  value,
  onChange,
  error,
  autoFocus,
}: {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = value.split("");

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative flex gap-2.5"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex h-[62px] flex-1 items-center justify-center rounded-[13px] border-2 font-sans text-[26px] font-extrabold text-ink transition-colors",
              digits[i] ? "border-accent bg-accent-tint animate-otpPop" : "border-line",
              error && "border-warn",
            )}
          >
            {digits[i] ?? ""}
          </div>
        ))}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
          inputMode="numeric"
          autoFocus={autoFocus}
          maxLength={length}
          aria-label="One-time passcode"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      {error ? <span className="text-xs font-semibold text-warn">{error}</span> : null}
    </div>
  );
}
