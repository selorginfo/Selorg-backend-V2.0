"use client";

import { useEffect, type RefObject } from "react";

interface OnClickOutsideOptions {
  /** Skip attaching the listener entirely (e.g. while the popover is closed). */
  enabled?: boolean;
  /**
   * Clicks landing inside an element matching this selector never count as
   * "outside". Needed when several instances of the same popover are mounted
   * (responsive desktop/mobile copies) and share one open/closed state — each
   * instance would otherwise treat the other's panel as outside territory.
   */
  ignoreSelector?: string;
}

export function useOnClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  { enabled = true, ignoreSelector }: OnClickOutsideOptions = {},
) {
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !ref.current || ref.current.contains(target)) return;
      if (ignoreSelector && typeof target.closest === "function" && target.closest(ignoreSelector)) {
        return;
      }
      handler();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler, enabled, ignoreSelector]);
}
