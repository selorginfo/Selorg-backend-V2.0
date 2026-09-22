"use client";

import { useEffect, useState } from "react";
import { BANNER_ROTATE_MS } from "@/lib/constants";

/** Auto-rotates a 0..count-1 index every BANNER_ROTATE_MS, matching the home hero carousel. */
export function useBannerRotation(count: number) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, BANNER_ROTATE_MS);
    return () => clearInterval(timer);
  }, [count]);

  return [index, setIndex] as const;
}
