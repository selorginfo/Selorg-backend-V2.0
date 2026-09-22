"use client";

import { useEffect, useState } from "react";
import { contentService, type FaqItem } from "@/services/contentService";
import { Skeleton } from "@/components/ui/Skeleton";

export function FaqClient() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const result = await contentService.getFaq(activeCategory ?? undefined);
        setItems(result.data ?? []);
        setCategories(result.categories ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeCategory]);

  return (
    <div className="wrap max-w-[720px] py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Frequently asked questions</h1>
        <a href="/help" className="text-[13px] font-bold text-accent-dark">
          Help &amp; Support →
        </a>
      </div>

      {categories.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
              !activeCategory ? "bg-accent text-white" : "border border-line"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold capitalize ${
                activeCategory === c ? "bg-accent text-white" : "border border-line"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No FAQ entries available.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <details key={item.id} className="rounded-2xl border border-line bg-white p-4">
              <summary className="cursor-pointer text-sm font-extrabold">{item.question}</summary>
              <p className="mt-3 text-[13px] leading-relaxed text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
