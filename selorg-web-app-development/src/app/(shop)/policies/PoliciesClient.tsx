"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, Headphones } from "lucide-react";
import { contentService } from "@/services/contentService";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import {
  POLICY_SECTIONS,
  STATIC_POLICY_CONTENT,
  type PolicySectionId,
} from "@/lib/policyContent";

function sectionFromHash(): PolicySectionId {
  if (typeof window === "undefined") return "terms";
  const raw = window.location.hash.replace(/^#/, "");
  if (POLICY_SECTIONS.some((s) => s.id === raw)) return raw as PolicySectionId;
  return "terms";
}

export function PoliciesClient({ embedded = false }: { embedded?: boolean }) {
  const [active, setActive] = useState<PolicySectionId>("terms");
  const helpPath = embedded ? "/account/help" : "/help";
  const [apiBody, setApiBody] = useState<Record<"terms" | "privacy", { title: string; content: string; error?: string }>>({
    terms: { title: "Terms of Service", content: "" },
    privacy: { title: "Privacy Policy", content: "" },
  });
  const [loadingApi, setLoadingApi] = useState(true);

  useEffect(() => {
    setActive(sectionFromHash());
    const onHash = () => setActive(sectionFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingApi(true);
      const [terms, privacy] = await Promise.allSettled([
        contentService.getTerms(),
        contentService.getPrivacy(),
      ]);
      if (cancelled) return;
      setApiBody({
        terms:
          terms.status === "fulfilled"
            ? { title: terms.value.title || "Terms of Service", content: terms.value.content || "" }
            : {
                title: "Terms of Service",
                content: "",
                error: "Terms could not be loaded right now. Please try again later.",
              },
        privacy:
          privacy.status === "fulfilled"
            ? { title: privacy.value.title || "Privacy Policy", content: privacy.value.content || "" }
            : {
                title: "Privacy Policy",
                content: "",
                error: "Privacy Policy could not be loaded right now. Please try again later.",
              },
      });
      setLoadingApi(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const select = (id: PolicySectionId) => {
    setActive(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  };

  const meta = useMemo(() => POLICY_SECTIONS.find((s) => s.id === active)!, [active]);

  const rendered = useMemo(() => {
    if (meta.fromApi === "terms" || meta.fromApi === "privacy") {
      const doc = apiBody[meta.fromApi];
      return {
        title: doc.title,
        subtitle: "Loaded from Selorg’s published legal documents",
        body: doc.content,
        error: doc.error,
        loading: loadingApi,
      };
    }
    const staticDoc = STATIC_POLICY_CONTENT[active as Exclude<PolicySectionId, "terms" | "privacy">];
    return {
      title: staticDoc.title,
      subtitle: staticDoc.updated,
      body: staticDoc.body,
      error: undefined,
      loading: false,
    };
  }, [active, apiBody, loadingApi, meta]);

  return (
    <div className={cn(embedded ? "pb-2" : "wrap max-w-[1100px] pb-14 pt-6 sm:pt-8")}>
      <section
        className={cn(
          "relative overflow-hidden border border-line bg-gradient-to-br from-[#f4f7ef] via-white to-[#eef4e6]",
          embedded ? "rounded-2xl px-5 py-5 sm:px-6 sm:py-6" : "rounded-[22px] px-5 py-7 sm:px-8 sm:py-9",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-[560px]">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-accent-dark">Selorg Policies</p>
            <h1
              className={cn(
                "mt-2 font-extrabold leading-tight tracking-tight",
                embedded ? "text-[22px] sm:text-[26px]" : "text-[26px] sm:text-[32px]",
              )}
            >
              Policies &amp; legal
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              Terms, privacy, refunds, delivery, payments, wallet, quality, and grievance — everything in one place.
            </p>
          </div>
          <Link
            href={helpPath}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-[#20241c] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#2a3124]"
          >
            <Headphones size={16} />
            Help &amp; Support
          </Link>
        </div>
      </section>

      <div
        className={cn(
          "mt-5 grid gap-4",
          embedded ? "grid-cols-1" : "min-[900px]:grid-cols-[240px_minmax(0,1fr)] gap-5 mt-6",
        )}
      >
        <aside className={cn(!embedded && "min-[900px]:sticky min-[900px]:top-4 min-[900px]:self-start")}>
          <nav
            className={cn(
              "flex gap-2 overflow-x-auto pb-1",
              !embedded &&
                "min-[900px]:flex-col min-[900px]:overflow-visible min-[900px]:rounded-2xl min-[900px]:border min-[900px]:border-line min-[900px]:bg-white min-[900px]:p-2",
            )}
          >
            {POLICY_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => select(s.id)}
                className={cn(
                  "shrink-0 rounded-xl px-3.5 py-2.5 text-left transition-colors",
                  !embedded && "min-[900px]:px-3",
                  active === s.id
                    ? "bg-accent-tint text-accent-dark"
                    : cn(
                        "bg-white text-ink ring-1 ring-line hover:bg-black/[0.03]",
                        !embedded && "min-[900px]:bg-transparent min-[900px]:ring-0",
                      ),
                )}
              >
                <div className="text-[13px] font-extrabold">{s.label}</div>
                <div
                  className={cn(
                    "text-[11px] text-muted",
                    embedded ? "hidden" : "hidden min-[900px]:block",
                  )}
                >
                  {s.short}
                </div>
              </button>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 rounded-2xl border border-line bg-white p-5 sm:p-7">
          <div className="mb-5 flex items-start gap-3 border-b border-line pb-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-tint text-accent-dark">
              <FileText size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[18px] font-extrabold sm:text-[20px]">{rendered.title}</h2>
              <p className="mt-0.5 text-[12.5px] text-muted">{rendered.subtitle}</p>
            </div>
          </div>

          {rendered.loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[92%]" />
              <Skeleton className="h-4 w-[88%]" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[70%]" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="h-4 w-[85%]" />
            </div>
          ) : rendered.error ? (
            <p className="text-sm text-muted">{rendered.error}</p>
          ) : (
            <div className="whitespace-pre-wrap text-[14px] leading-[1.7] text-ink">{rendered.body || "Content coming soon."}</div>
          )}

          <div className="mt-8 flex flex-col gap-2 border-t border-line pt-4 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>Need help applying a policy to your order?</span>
            <Link href={helpPath} className="inline-flex items-center gap-1 font-bold text-accent-dark">
              Contact Help &amp; Support <ChevronRight size={14} />
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
