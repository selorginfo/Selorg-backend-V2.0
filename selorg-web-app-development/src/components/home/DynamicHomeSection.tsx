import Link from "next/link";
import { Zap } from "lucide-react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { SafeRemoteImage } from "@/components/ui/SafeRemoteImage";
import { categoryHref } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { DynamicHeroBanner } from "./DynamicHeroBanner";
import { SectionCountdown } from "./SectionCountdown";
import type { Product } from "@/types";
import type { HomeBanner, HomeCategory, HomeLifestyleItem } from "@/services/homeService";

/** One resolved home section, assembled server-side in page.tsx from the
 *  /customer/home payload + per-key /sections/:key/products fetches. */
export type ResolvedHomeSection =
  | { key: string; label: string; kind: "categories"; items: HomeCategory[] }
  | { key: string; label: string; kind: "banners"; items: HomeBanner[] }
  | { key: string; label: string; kind: "lifestyle"; items: HomeLifestyleItem[] }
  | { key: string; label: string; kind: "products"; items: Product[]; error?: boolean };

function bannerHref(b: HomeBanner): string {
  if (b.link) return b.link;
  if (b.redirectType === "category" && b.redirectValue) return `/category/${b.redirectValue}`;
  if (b.redirectType === "product" && b.redirectValue) return `/product/${b.redirectValue}`;
  return "/offers";
}

function lifestyleHref(item: HomeLifestyleItem): string {
  if (item.link) return item.link;
  if (item.redirectType === "category" && item.redirectValue) return `/category/${item.redirectValue}`;
  return "/";
}

/** The design's full-bleed hero maps to the backend's `hero` banner slot. A slot can mix
 *  `single` and `carousel` presentation modes across its banners, so the slot — not the first
 *  banner's mode — decides; any explicit "carousel" banner also forces the hero treatment. */
export function isHeroSection(section: ResolvedHomeSection): boolean {
  return (
    section.kind === "banners" &&
    section.items.some((b) => b.slot === "hero" || b.presentationMode === "carousel")
  );
}

function bannerImageSrc(b: HomeBanner): string | undefined {
  const primary = typeof b.imageUrl === "string" ? b.imageUrl.trim() : "";
  if (primary) return primary;
  const fallback = typeof b.bannerImageUrl === "string" ? b.bannerImageUrl.trim() : "";
  return fallback || undefined;
}

/** CMS test uploads under `/sample banner/` 500 on CloudFront — skip so we never request them. */
function isUsableBannerImage(b: HomeBanner): boolean {
  const src = bannerImageSrc(b);
  if (!src) return false;
  const url = src.toLowerCase();
  return !url.includes("/sample%20banner/") && !url.includes("/sample banner/");
}

/** The prototype pairs a live countdown with its "Flash Deals" heading. The backend has no
 *  deal-expiry field, so the badge is only shown for sections an admin actually named as a
 *  time-limited deal — never bolted onto an arbitrary carousel. */
function isTimeLimitedSection(section: ResolvedHomeSection): boolean {
  return /flash|deal|limited|today/i.test(`${section.key} ${section.label}`);
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 font-sans text-2xl font-extrabold tracking-[-0.6px]">
      {children}
    </h2>
  );
}

export function DynamicHomeSection({ section }: { section: ResolvedHomeSection }) {
  if (section.kind === "products") {
    const timeLimited = isTimeLimitedSection(section);
    return (
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SectionHeading>
            {timeLimited ? <Zap size={22} className="shrink-0 fill-warn text-warn" /> : null}
            {section.label}
          </SectionHeading>
          {timeLimited ? <SectionCountdown /> : null}
        </div>
        {section.error ? (
          <p className="rounded-2xl border border-line bg-white px-4 py-6 text-center text-sm text-muted">
            Couldn&apos;t load products for this section. Please refresh and try again.
          </p>
        ) : section.items.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white px-4 py-6 text-center text-sm text-muted">
            No products in this collection right now.
          </p>
        ) : (
          <ProductGrid products={section.items} />
        )}
      </section>
    );
  }

  if (section.items.length === 0) return null;

  if (section.kind === "categories") {
    return (
      <section>
        <div className="mb-4">
          <SectionHeading>{section.label}</SectionHeading>
        </div>
        {/* Mobile: horizontal scroll. Desktop/tablet: equal columns fill full row width. */}
        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-1 min-[700px]:w-full min-[700px]:justify-between min-[700px]:gap-2 min-[700px]:overflow-visible">
          {section.items.map((c, i) => (
            <Link
              key={`${c._id}-${i}`}
              href={categoryHref({ id: c._id, slug: c.slug })}
              prefetch={false}
              className="flex w-[72px] shrink-0 flex-col items-center gap-2 text-center transition-opacity hover:opacity-80 min-[700px]:w-auto min-[700px]:min-w-0 min-[700px]:flex-1"
            >
              <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-accent-tint text-2xl min-[900px]:h-[4.5rem] min-[900px]:w-[4.5rem]">
                {c.imageUrl || c.cardImageUrl ? (
                  <SafeRemoteImage
                    src={(c.imageUrl || c.cardImageUrl)!}
                    alt=""
                    fill
                    sizes="(min-width: 900px) 72px, 64px"
                    className="object-cover"
                    fallbackClassName="object-contain opacity-40 p-2"
                  />
                ) : (
                  c.emoji || null
                )}
              </span>
              <span className="w-full max-w-[72px] text-[12px] font-bold leading-tight min-[700px]:max-w-none">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  if (section.kind === "banners") {
    if (isHeroSection(section)) {
      return <DynamicHeroBanner banners={section.items} />;
    }

    // Image-only promo row — skip text/gradient dummies; CMS artwork carries its own copy.
    const imageBanners = section.items.filter(isUsableBannerImage);
    if (imageBanners.length === 0) return null;

    const count = imageBanners.length;

    return (
      <section
        className={cn(
          "grid w-full gap-3 min-[900px]:gap-4",
          // Columns follow banner count so a lone Moringa/Honey banner is full-width,
          // not stuck in a 1/3 grid track with empty space beside it.
          // 4 banners → 2×2 (scroll banner creatives), not a 3-column orphan.
          count === 1 && "grid-cols-1",
          count === 2 && "grid-cols-1 sm:grid-cols-2",
          count === 3 && "grid-cols-1 sm:grid-cols-2 min-[900px]:grid-cols-3",
          count === 4 && "grid-cols-1 sm:grid-cols-2",
          count >= 5 && "grid-cols-1 sm:grid-cols-2 min-[900px]:grid-cols-3",
        )}
      >
        {imageBanners.map((b, i) => (
          <Link
            key={`${b._id}-${i}`}
            href={bannerHref(b)}
            prefetch={false}
            className={cn(
              "relative block w-full min-w-0 overflow-hidden rounded-[14px] bg-[#f3f4ef] sm:rounded-[18px]",
              // Shorter responsive heights — always full track width.
              count === 1
                ? "aspect-[2.2/1] sm:aspect-[3.4/1] min-[941px]:aspect-[4.5/1]"
                : "aspect-[2/1] sm:aspect-[2.5/1]",
            )}
            aria-label={b.title?.trim() || "Open banner"}
          >
            <SafeRemoteImage
              src={bannerImageSrc(b)}
              alt={b.title?.trim() || "Banner"}
              fill
              sizes={
                count === 1
                  ? "(max-width: 940px) 100vw, 1100px"
                  : count === 2
                    ? "(max-width: 640px) 100vw, (max-width: 1220px) 50vw, 520px"
                    : "(max-width: 640px) 100vw, (max-width: 900px) 50vw, 360px"
              }
              className="object-cover object-center"
              fallbackClassName="object-contain opacity-40 p-8"
            />
          </Link>
        ))}
      </section>
    );
  }

  if (section.kind === "lifestyle") {
    return (
      <section>
        <div className="mb-4">
          <SectionHeading>{section.label}</SectionHeading>
        </div>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {section.items.map((item, i) => (
            <Link
              key={`${item._id}-${i}`}
              href={lifestyleHref(item)}
              prefetch={false}
              className="relative flex aspect-square flex-col justify-end overflow-hidden rounded-app border border-line"
            >
              <SafeRemoteImage
                src={item.imageUrl}
                alt={item.title || item.name || ""}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover"
                fallbackClassName="object-contain opacity-40 p-6"
              />
              {item.title || item.name ? (
                <span className="relative bg-gradient-to-t from-black/70 to-transparent p-3 text-[12.5px] font-bold text-white">
                  {item.title || item.name}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return null;
}
