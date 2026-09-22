"use client";

import { useEffect, useState } from "react";

const START_SECONDS = 2 * 3600 + 48 * 60 + 19;
const RESET_SECONDS = 3 * 3600;

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)} : ${pad(m)} : ${pad(s)}`;
}

/** Flash-deals countdown; resets to 3h whenever it reaches zero, matching source behavior. */
export function useCountdown() {
  const [seconds, setSeconds] = useState(START_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => (s <= 0 ? RESET_SECONDS : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return formatCountdown(seconds);
}
