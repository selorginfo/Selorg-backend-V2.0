"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getToken } from "@/services/session";

/**
 * Redirects to /auth?redirect=<current path> when the viewer isn't signed in.
 * Uses a hard navigation (same pattern as api.ts 401 handling) because soft
 * `router.replace` was leaving account layouts on a blank shell without changing URL.
 */
export function useRequireAuth(): boolean {
  const { auth, authReady } = useAuth();
  const pathname = usePathname();
  const token = authReady ? getToken() : null;
  const allowed = Boolean(authReady && auth.loggedIn && token);

  useEffect(() => {
    if (!authReady) return;
    if (auth.loggedIn && getToken()) return;

    const returnPath =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : pathname;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- auth gate must hard-navigate
    window.location.replace(`/auth?redirect=${encodeURIComponent(returnPath)}`);
  }, [auth.loggedIn, authReady, pathname]);

  return allowed;
}
