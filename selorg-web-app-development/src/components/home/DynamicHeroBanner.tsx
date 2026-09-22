"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useBannerRotation } from "@/hooks/useBannerRotation";
import { SafeRemoteImage } from "@/components/ui/SafeRemoteImage";
import { cn } from "@/lib/cn";
import type { HomeBanner } from "@/services/homeService";

function bannerHref(b: HomeBanner): string {
  if (b.link) return b.link;
  if (b.redirectType === "category" && b.redirectValue) return `/category/${b.redirectValue}`;
  if (b.redirectType === "product" && b.redirectValue) return `/product/${b.redirectValue}`;
  return "/offers";
}

function bannerImageSrc(b: HomeBanner): string | undefined {
  const primary = typeof b.imageUrl === "string" ? b.imageUrl.trim() : "";
  if (primary) return primary;
  const fallback = typeof b.bannerImageUrl === "string" ? b.bannerImageUrl.trim() : "";
  return fallback || undefined;
}

function isUsableBannerImage(url: string | undefined): boolean {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  // CMS test uploads under `/sample banner/` 500 on CloudFront.
  return !lower.includes("/sample%20banner/") && !lower.includes("/sample banner/");
}

/** Image-only hero carousel — CMS artwork already includes copy; no overlay text/CTA. */
export function DynamicHeroBanner({ banners }: { banners: HomeBanner[] }) {
  const slides = useMemo(() => {
    const seen = new Set<string>();
    const out: HomeBanner[] = [];
    for (const b of banners) {
      const src = bannerImageSrc(b);
      if (!isUsableBannerImage(src)) continue;
      const id = b._id?.trim() || src!;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ ...b, imageUrl: src });
    }
    return out;
  }, [banners]);
  const [index, setIndex] = useBannerRotation(slides.length);
  const router = useRouter();

  if (slides.length === 0) return null;

  const active = slides[Math.min(index, slides.length - 1)];
  if (!active) return null;

  return (
    <section>
      <div className="relative aspect-[2.2/1] w-full overflow-hidden rounded-[14px] bg-[#f3f4ef] sm:aspect-[3.2/1] sm:rounded-[18px] min-[941px]:aspect-[4.2/1]">
        {slides.map((b, i) => (
          <button
            key={`slide-${b._id}-${i}`}
            type="button"
            onClick={() => router.push(bannerHref(b))}
            aria-label={b.title?.trim() || "Open banner"}
            className={cn(
              "absolute inset-0 block w-full cursor-pointer border-0 p-0",
              i === index ? "visible" : "invisible",
            )}
          >
            <SafeRemoteImage
              src={bannerImageSrc(b)}
              alt={b.title?.trim() || "Banner"}
              fill
              sizes="(max-width: 560px) 100vw, (max-width: 1220px) 90vw, 1100px"
              className="object-cover object-center"
              fallbackClassName="object-contain opacity-40 p-10"
              priority={i === 0}
            />
          </button>
        ))}

        {slides.length > 1 ? (
          <div className="absolute bottom-2.5 left-1/2 z-[3] flex -translate-x-1/2 gap-1.5 sm:bottom-3 sm:gap-[7px]">
            {slides.map((b, i) => (
              <button
                key={`dot-${b._id}-${i}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
                aria-label={`Go to banner ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-2 w-2 rounded-full shadow-[0_1px_3px_rgba(0,0,0,.3)] transition-colors sm:h-[9px] sm:w-[9px]",
                  i === index ? "bg-white" : "bg-white/50",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
