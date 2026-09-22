import Link from "next/link";
import { homeService } from "@/services/homeService";
import type { HomeBanner, HomeCategory, HomeLifestyleItem } from "@/services/homeService";
import { PromoStrip, TrustGrid } from "@/components/home/PromoStrip";
import { CouponStrip } from "@/components/home/CouponStrip";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { HomeRightRail } from "@/components/home/HomeRightRail";
import { RecentlyViewedSection } from "@/components/home/RecentlyViewedSection";
import { Footer } from "@/components/layout/Footer";
import {
  DynamicHomeSection,
  isHeroSection,
  type ResolvedHomeSection,
} from "@/components/home/DynamicHomeSection";

// CMS-driven content changes independently of deploys — never let this page
// get frozen as a static build-time snapshot (e.g. if the backend happened
// to be unreachable at build time).
export const dynamic = "force-dynamic";

/**
 * The home page is fully CMS-driven: `/customer/home` returns an ordered
 * `sectionDefinitions` list plus a `sections{}` map that only inlines
 * categories/banners/lifestyle content. Anything else (product carousels)
 * has no flat products array on that payload — each must be resolved via a
 * separate `/sections/:key/products` call. There is no "flash deals" /
 * "bestsellers" concept computed from sales data anywhere in the backend;
 * whatever sections render here are exactly what an admin configured.
 */
async function resolveSections(): Promise<{ sections: ResolvedHomeSection[]; loaded: boolean }> {
  const home = await homeService.getHome();
  if (!home) return { sections: [], loaded: false };

  const resolved = await Promise.all(
    home.sectionDefinitions.map(async (def): Promise<ResolvedHomeSection | null> => {
      const inline = home.sections[def.key];

      if (inline && inline.length > 0) {
        const first = inline[0] as HomeBanner | HomeCategory | HomeLifestyleItem;
        if ("slot" in first) {
          return { key: def.key, label: def.label, kind: "banners", items: inline as HomeBanner[] };
        }
        if ("slug" in first) {
          return { key: def.key, label: def.label, kind: "categories", items: inline as HomeCategory[] };
        }
        return { key: def.key, label: def.label, kind: "lifestyle", items: inline as HomeLifestyleItem[] };
      }

      // No inline payload → treat as a product carousel (collections_* / legacy HomeSection).
      try {
        const productSection = await homeService.getSectionProducts(def.key);
        if (!productSection) return null; // genuine 404 — not a product section
        return {
          key: def.key,
          label: productSection.title || def.label,
          kind: "products",
          items: productSection.products,
        };
      } catch {
        return {
          key: def.key,
          label: def.label,
          kind: "products",
          items: [],
          error: true,
        };
      }
    }),
  );

  return { sections: mergePromoBanners(resolved.filter((s): s is ResolvedHomeSection => s !== null)), loaded: true };
}

/**
 * The design's promo row is three side-by-side banner cards. Admins configure each of those
 * as its own single-banner section (`banner_sub_moringa_banner`, `banner_sub_honey_banner`,
 * …), which would otherwise paint one lonely third-width card per row. Consecutive non-hero
 * banner sections are therefore collapsed into one section so they lay out as a single row.
 */
function mergePromoBanners(sections: ResolvedHomeSection[]): ResolvedHomeSection[] {
  const merged: ResolvedHomeSection[] = [];

  for (const section of sections) {
    const previous = merged[merged.length - 1];
    const mergeable =
      section.kind === "banners" &&
      !isHeroSection(section) &&
      previous?.kind === "banners" &&
      !isHeroSection(previous);

    if (mergeable && previous.kind === "banners" && section.kind === "banners") {
      merged[merged.length - 1] = { ...previous, items: [...previous.items, ...section.items] };
      continue;
    }
    merged.push(section);
  }

  return merged;
}

export default async function HomePage() {
  const { sections, loaded } = await resolveSections();

  // Everything up to and including the hero renders above the promo strip; if the
  // CMS configured no hero at all, the strip stays at the top of the column.
  const heroIndex = sections.findIndex(isHeroSection);
  const lead = heroIndex === -1 ? [] : sections.slice(0, heroIndex + 1);
  const rest = heroIndex === -1 ? sections : sections.slice(heroIndex + 1);

  return (
    <div className="home-shell flex w-full flex-col max-[940px]:pb-9">
      <div className="wrap pt-[18px]">
        <div className="grid grid-cols-1 items-start gap-[18px] min-[941px]:grid-cols-[200px_minmax(0,1fr)] min-[1221px]:grid-cols-[200px_minmax(0,1fr)_260px] min-[1221px]:gap-[18px]">
          <HomeSidebar />

          <div className="flex min-w-0 flex-col gap-7 pb-7">
            {/* The design leads with the full-bleed hero and only then drops the
                delivery/organic promo strip, so the strip is spliced in after the
                hero section rather than pinned to the top of the column. */}
            {lead.map((section) => (
              <DynamicHomeSection key={section.key} section={section} />
            ))}

            <PromoStrip />

            {rest.map((section) => (
              <DynamicHomeSection key={section.key} section={section} />
            ))}

            {loaded && sections.length === 0 ? (
              <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted">
                No home sections are configured yet.
              </div>
            ) : null}

            {!loaded ? (
              <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted">
                Couldn&apos;t load the latest deals right now — please refresh in a moment.
              </div>
            ) : null}

            <section>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-sans text-2xl font-extrabold tracking-[-0.6px]">
                  Coupons &amp; offers
                </h2>
                <Link href="/offers" className="text-sm font-bold text-accent-dark">
                  View all offers →
                </Link>
              </div>
              <CouponStrip />
            </section>

            <section className="rounded-[20px] border border-line bg-white p-[18px]">
              <TrustGrid />
            </section>

            <RecentlyViewedSection />
          </div>

          <HomeRightRail />
        </div>
      </div>

      {/* Home desktop only: full-viewport footer (outside .wrap / side rails).
          Mobile keeps the layout Footer. */}
      <div className="mt-auto hidden w-full min-[941px]:block">
        <Footer className="mt-0" />
      </div>
    </div>
  );
}
