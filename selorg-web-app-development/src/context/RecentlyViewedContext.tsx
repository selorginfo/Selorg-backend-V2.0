"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const MAX_RECENT = 8;

interface RecentlyViewedContextValue {
  recentViewedIds: string[];
  pushRecent: (productId: string) => void;
}

const RecentlyViewedContext = createContext<RecentlyViewedContextValue | null>(null);

export function RecentlyViewedProvider({ children }: { children: ReactNode }) {
  const [recentViewedIds, setRecentViewedIds] = useState<string[]>([]);

  const pushRecent = useCallback((productId: string) => {
    setRecentViewedIds((prev) => [productId, ...prev.filter((id) => id !== productId)].slice(0, MAX_RECENT));
  }, []);

  return (
    <RecentlyViewedContext.Provider value={{ recentViewedIds, pushRecent }}>
      {children}
    </RecentlyViewedContext.Provider>
  );
}

export function useRecentlyViewed(): RecentlyViewedContextValue {
  const ctx = useContext(RecentlyViewedContext);
  if (!ctx) throw new Error("useRecentlyViewed must be used within a RecentlyViewedProvider");
  return ctx;
}
