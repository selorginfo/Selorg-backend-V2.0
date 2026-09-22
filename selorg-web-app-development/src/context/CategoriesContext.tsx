"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { categoryService } from "@/services/categoryService";
import type { Category } from "@/types";

interface CategoriesContextValue {
  categories: Category[];
  loading: boolean;
  /** True once a real (possibly empty) response has arrived. */
  isLive: boolean;
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  loading: true,
  isLive: false,
});

/**
 * Fetches GET /customer/categories once and shares it across Header,
 * HomeSidebar, category banners, etc. Consumers render their skeleton while `loading`.
 */
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const real = await categoryService.getCategories();
        if (cancelled) return;
        setCategories(real);
        setIsLive(true);
      } catch {
        // Unreachable backend: leave the list empty rather than showing links
        // that go nowhere. Without this the rejection escapes as an unhandled
        // promise rejection and `loading` never clears.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CategoriesContext.Provider value={{ categories, loading, isLive }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories(): CategoriesContextValue {
  return useContext(CategoriesContext);
}
