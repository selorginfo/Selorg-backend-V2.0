"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { contentService } from "@/services/contentService";
import { Skeleton } from "@/components/ui/Skeleton";

export function LegalClient({ type }: { type: "terms" | "privacy" }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const doc =
          type === "terms" ? await contentService.getTerms() : await contentService.getPrivacy();
        setTitle(doc.title);
        setContent(doc.content);
      } catch {
        setError(
          type === "terms"
            ? "Terms of Service could not be loaded. Please try again later."
            : "Privacy Policy could not be loaded. Please try again later.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [type]);

  return (
    <div className="wrap max-w-[720px] py-8">
      <div className="mb-2 text-[12px] font-bold text-muted">
        <Link href="/policies" className="text-accent-dark">
          All policies
        </Link>
        <span className="mx-1.5 text-[#d5d6ce]">/</span>
        <span>{type === "terms" ? "Terms" : "Privacy"}</span>
      </div>
      <h1 className="mb-6 text-2xl font-extrabold">
        {title || (type === "terms" ? "Terms of Service" : "Privacy Policy")}
      </h1>
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[92%]" />
          <Skeleton className="h-4 w-[88%]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[70%]" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="h-4 w-[85%]" />
          <Skeleton className="h-4 w-[60%]" />
        </div>
      ) : error ? (
        <p className="text-sm text-muted">{error}</p>
      ) : (
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
          {content || "Content coming soon."}
        </div>
      )}
    </div>
  );
}
