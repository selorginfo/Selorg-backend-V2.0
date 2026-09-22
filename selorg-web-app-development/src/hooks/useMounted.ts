"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and on the client's first render (hydration), then true
 * after mount. Keeps SSR HTML and the hydration pass identical — React 19
 * treats useSyncExternalStore(server=false, client=true) as a recoverable
 * hydration mismatch, which is why this uses useState + useEffect instead.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Mount gate only: first client paint must match SSR (mounted=false).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional
    setMounted(true);
  }, []);
  return mounted;
}
