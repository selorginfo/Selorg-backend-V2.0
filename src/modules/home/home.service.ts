import { Banner } from '../banners/banners.model';
import { Category } from '../categories/categories.model';
import { enrichBanner, enrichCategory } from '../../utils/mediaEnrichment';
import { filterCatalogLabels } from '../../utils/catalogHygiene';
import { dedupeTopCategoriesByFingerprint } from '../categories/categories.taxonomy';
import { HomeConfig, HomeSectionDefinition, HomeSection, LifestyleItem, PromoBlock } from './home.models';

// ── Home payload ──────────────────────────────────────────────────────────────

export async function getHomePayload(userId?: string) {
  const shared = await buildSharedHomePayload();
  return { ...shared, defaultAddress: null };
}

/** Map a mastersheet / CMS HomeSection into a layout definition entry. */
function definitionFromHomeSection(section: any, order: number) {
  const st = String(section.sectionType || '').toLowerCase();
  const key = String(section.sectionKey || '');
  const title = String(section.title || key);
  const hasProducts = Array.isArray(section.productIds) && section.productIds.length > 0;
  const hasBanners =
    (Array.isArray(section.bannerIds) && section.bannerIds.length > 0) ||
    (Array.isArray(section.importedBannerCodes) && section.importedBannerCodes.length > 0);
  const looksLikeBanner =
    /banner|promo|scroll|moringa|honey|mid|large|small/.test(st) ||
    key.startsWith('banner_');

  if (/hero/.test(st) || /hero/.test(key)) {
    // Always fold hero rows into the canonical hero_banner key (never expose URL-slugged keys).
    return {
      key: 'hero_banner',
      label: 'Featured Offers',
      type: 'banner_main' as const,
      order: 0,
      bannerIds: section.bannerIds || [],
    };
  }
  if (/categor/.test(st) || key === 'categories') {
    return { key: 'categories', label: title || 'Shop by Category', type: 'super_category' as const, order, bannerIds: [] };
  }
  if (/lifestyle/.test(st) || key === 'lifestyle') {
    return { key: 'lifestyle', label: title || 'Lifestyle', type: 'lifestyle' as const, order, bannerIds: [] };
  }
  if ((hasBanners || looksLikeBanner) && !hasProducts) {
    return {
      key,
      label: /^https?:\/\//i.test(title) ? (section.sectionType || 'Banner') : title,
      type: 'banner_sub' as const,
      order,
      bannerIds: section.bannerIds || [],
    };
  }
  if (hasProducts || /collection|deal|product|seller|arrival/.test(st) || key.startsWith('collections_')) {
    return {
      key,
      label: /^https?:\/\//i.test(title) ? key.replace(/_/g, ' ') : title,
      type: null,
      order,
      bannerIds: [],
    };
  }
  return null;
}

/**
 * Mastersheet writes `customer_home_sections`. Live home layout reads
 * `customer_home_section_definitions`. Merge any active HomeSection rows that
 * are missing from definitions so imported banners/products actually surface.
 */
async function mergeHomeSectionsIntoDefinitions(definitions: any[]): Promise<any[]> {
  const homeSections = await HomeSection.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
  if (!homeSections.length) return definitions;

  const merged = [...definitions];
  const byKey = new Map(merged.map((d) => [d.key, d]));

  for (const section of homeSections as any[]) {
    const sectionOrder = typeof section.order === 'number' ? section.order : merged.length;
    const mapped = definitionFromHomeSection(section, sectionOrder);
    if (!mapped) continue;

    const existing = byKey.get(mapped.key);
    if (existing) {
      if (mapped.bannerIds?.length) {
        const current = Array.isArray(existing.bannerIds) ? existing.bannerIds.map(String) : [];
        const add = mapped.bannerIds.map(String).filter((id: string) => !current.includes(id));
        if (add.length) {
          existing.bannerIds = [...(existing.bannerIds || []), ...mapped.bannerIds.filter((id: any) => add.includes(String(id)))];
        }
      }
      if (typeof section.order === 'number') {
        existing.order = section.order;
      }
      continue;
    }

    if (mapped.key !== 'hero_banner' && mapped.type === 'banner_sub' && /^https?:\/\//i.test(String(section.title || ''))) {
      continue;
    }

    const entry = {
      ...mapped,
      order: mapped.key === 'hero_banner' ? 0 : sectionOrder,
    };
    merged.push(entry);
    byKey.set(entry.key, entry);
  }

  const hasMastersheetCollections = merged.some((d) => String(d.key || '').startsWith('collections_'));
  const filtered = hasMastersheetCollections
    ? merged.filter((d) => !['bestsellers', 'new_arrivals', 'deals', 'new_deals'].includes(String(d.key)))
    : merged;

  return filtered.sort((a, b) => {
    if (a.key === 'hero_banner') return -1;
    if (b.key === 'hero_banner') return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

async function buildSharedHomePayload() {
  let config = (await HomeConfig.findOne({ key: 'main' }).lean()) as any;
  if (!config) {
    config = { key: 'main', searchPlaceholder: 'Search for products', deliveryTypeLabel: 'Delivery', categorySectionTitle: 'Shop by Category' };
  }

  let definitions: any[] = await HomeSectionDefinition.find().sort({ order: 1 }).lean();

  if (definitions.length === 0) {
    const banners = await Banner.find({ isActive: true }).select('_id slot').lean();
    const heroBanners = banners.filter((b) => b.slot === 'hero').map((b) => b._id);
    const midBanners = banners.filter((b) => (b.slot as string) === 'mid' || (b.slot as string) === 'banner_sub').map((b) => b._id);
    definitions = [{ key: 'categories', label: 'Shop by Category', type: 'super_category', order: 1 } as any];
    if (heroBanners.length > 0) definitions.unshift({ key: 'hero_banner', label: 'Featured Offers', type: 'banner_main', order: 0, bannerIds: heroBanners } as any);
    if (midBanners.length > 0) definitions.push({ key: 'mid_banner', label: 'Recommended for You', type: 'banner_sub', order: 2, bannerIds: midBanners } as any);
    definitions.push({ key: 'deals', label: 'Best Sellers', type: null, order: 3 } as any);
    definitions.push({ key: 'new_deals', label: 'New Arrivals', type: null, order: 4 } as any);
  }

  // Bridge mastersheet HomeSection rows → live layout definitions.
  definitions = await mergeHomeSectionsIntoDefinitions(definitions);

  // Keep the home category rail consistent with GET /customer/categories:
  // same hygiene filter (drops smoke/test rows) and same L1 twin dedupe.
  const topCategories = filterCatalogLabels(
    dedupeTopCategoriesByFingerprint(
      await Category.find({ isActive: true, parentId: { $in: [null, undefined] } }).sort({ order: 1 }).lean() as any,
    ) as any[],
  ).map((c: any) => enrichCategory(c));
  const heroBanners = (await Banner.find({ slot: 'hero', isActive: true }).sort({ order: 1 }).lean())
    .map((b) => enrichBanner(b as any));
  const lifestyleItems = await LifestyleItem.find({ isActive: true }).sort({ order: 1 }).lean();
  const promoBlocks = await PromoBlock.find({ isActive: true }).sort({ order: 1 }).lean();

  const sections: Record<string, unknown> = {};
  for (const def of definitions) {
    const d = def as any;
    if (d.type === 'super_category' || d.key === 'categories') {
      sections[d.key] = topCategories;
    } else if (d.type === 'banner_main' || d.key === 'hero_banner') {
      // Prefer curated bannerIds from the definition / mastersheet merge; fall back to slot=hero.
      const ids = Array.isArray(d.bannerIds) && d.bannerIds.length > 0 ? d.bannerIds : [];
      if (ids.length > 0) {
        const curated = await Banner.find({ _id: { $in: ids }, isActive: true }).lean();
        const byId = new Map(curated.map((b) => [String(b._id), b]));
        const ordered = ids.map((id: any) => byId.get(String(id))).filter(Boolean);
        sections[d.key] = (ordered.length > 0 ? ordered : heroBanners).map((b: any) => enrichBanner(b));
      } else {
        sections[d.key] = heroBanners;
      }
    } else if (d.type === 'lifestyle' || d.key === 'lifestyle') {
      sections[d.key] = lifestyleItems;
    } else if (d.type === 'banner_sub' || d.type === 'banner') {
      const ids = Array.isArray(d.bannerIds) && d.bannerIds.length > 0 ? d.bannerIds : (d.bannerId ? [d.bannerId] : []);
      if (ids.length > 0) {
        const found = await Banner.find({ _id: { $in: ids }, isActive: true }).lean();
        const byId = new Map(found.map((b) => [String(b._id), b]));
        sections[d.key] = ids.map((id: any) => byId.get(String(id))).filter(Boolean).map((b: any) => enrichBanner(b));
      }
    }
  }

  // If no product carousel sections exist (type null or 'collections'), inject defaults
  // so the home page always shows real products even when CMS hasn't been configured yet.
  const hasProductSection = (definitions as any[]).some(
    (d) => d.type === null || d.type === 'collections',
  );
  if (!hasProductSection) {
    const maxOrder = (definitions as any[]).reduce(
      (m: number, d: any) => Math.max(m, typeof d.order === 'number' ? d.order : 0),
      definitions.length,
    );
    (definitions as any[]).push(
      { key: 'deals', label: 'Best Sellers', type: null, order: maxOrder + 1 },
      { key: 'new_deals', label: 'New Arrivals', type: null, order: maxOrder + 2 },
    );
  }

  return {
    config: {
      searchPlaceholder: config.searchPlaceholder || 'Search products',
      deliveryLabel: config.deliveryLabel || '10-min delivery',
      categorySectionTitle: config.categorySectionTitle || 'Shop by Category',
      trendingSearches: config.trendingSearches || [],
      contentRevision: typeof config.contentRevision === 'number' ? config.contentRevision : 0,
      lastMastersheetSyncAt: config.lastMastersheetSyncAt || null,
    },
    sectionDefinitions: definitions.map((d: any) => ({ key: d.key, label: d.label || d.key })),
    sections,
    promoBlocks,
  };
}

/** Bump home content revision after mastersheet sync — clients/CDN can key off this. */
export async function bumpHomeContentRevision(source: string) {
  return HomeConfig.findOneAndUpdate(
    { key: 'main' },
    {
      $inc: { contentRevision: 1 },
      $set: { lastMastersheetSyncAt: new Date(), lastMastersheetSyncSource: source },
      $setOnInsert: { key: 'main' },
    },
    { upsert: true, new: true },
  ).lean();
}

// ── Section definitions CRUD ──────────────────────────────────────────────────
export function listSectionDefinitions() {
  return HomeSectionDefinition.find().sort({ order: 1 }).lean();
}

export function getSectionDefinition(id: string) {
  return HomeSectionDefinition.findById(id).lean();
}

export async function createSectionDefinition(data: Partial<{ key: string; label: string; order: number; type: string }>) {
  return HomeSectionDefinition.create(data);
}

export async function updateSectionDefinition(id: string, data: Record<string, unknown>) {
  return HomeSectionDefinition.findByIdAndUpdate(id, data, { new: true }).lean();
}

export async function deleteSectionDefinition(id: string) {
  return HomeSectionDefinition.findByIdAndDelete(id);
}

export async function reorderSectionDefinitions(orderedIds: string[]) {
  const ops = orderedIds.map((id, index) => ({
    updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
  }));
  return HomeSectionDefinition.bulkWrite(ops as any[]);
}

/**
 * Persist HomeSectionDefinition rows from active HomeSection documents.
 * Called after mastersheet Home Page Content import so the live /home layout
 * matches what was uploaded (not just the legacy HomeSection collection).
 */
export async function syncHomeSectionDefinitionsFromHomeSections() {
  const homeSections = await HomeSection.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();

  // Re-resolve Ban-* codes → ObjectIds when bannerIds were empty at import time
  // (e.g. Home Page Content processed before Banner Details in an older run).
  const { Banner } = await import('../banners/banners.model');
  for (const section of homeSections as any[]) {
    const codes = Array.isArray(section.importedBannerCodes) ? section.importedBannerCodes : [];
    const existingIds = Array.isArray(section.bannerIds) ? section.bannerIds : [];
    if (!codes.length || existingIds.length >= codes.length) continue;
    const found = await Banner.find({ bannerId: { $in: codes } }).select('_id bannerId').lean();
    if (!found.length) continue;
    const byCode = new Map(found.map((b) => [String(b.bannerId), b._id]));
    const ids = codes.map((c: string) => byCode.get(String(c))).filter(Boolean);
    if (ids.length) {
      await HomeSection.updateOne({ _id: section._id }, { $set: { bannerIds: ids } });
      section.bannerIds = ids;
    }
  }

  const desired: any[] = [];

  // Preserve mastersheet row order from HomeSection.order (do NOT clump all
  // banners before all collections — home layout interleaves them).
  const sortedSections = [...(homeSections as any[])].sort(
    (a, b) => (typeof a.order === 'number' ? a.order : 999) - (typeof b.order === 'number' ? b.order : 999),
  );

  let hasCategories = false;
  for (const section of sortedSections) {
    const mapped = definitionFromHomeSection(section, typeof section.order === 'number' ? section.order : desired.length);
    if (!mapped) continue;
    if (mapped.key === 'categories') {
      if (hasCategories) continue;
      hasCategories = true;
      desired.push({ ...mapped, order: typeof section.order === 'number' ? section.order : 1, bannerIds: [] });
      continue;
    }
    if (mapped.key !== 'hero_banner' && mapped.type === 'banner_sub' && /^https?:\/\//i.test(String(section.title || ''))) {
      continue;
    }
    const existingIdx = desired.findIndex((d) => d.key === mapped.key);
    if (existingIdx >= 0) {
      const cur = desired[existingIdx]!;
      if (mapped.bannerIds?.length) {
        const ids = new Set([...(cur.bannerIds || []).map(String), ...mapped.bannerIds.map(String)]);
        cur.bannerIds = [...ids];
      }
      // Keep the earlier (smaller) order when merging duplicates.
      if (typeof section.order === 'number' && (cur.order == null || section.order < cur.order)) {
        cur.order = section.order;
      }
      continue;
    }
    desired.push({
      ...mapped,
      order: mapped.key === 'hero_banner'
        ? 0
        : (typeof section.order === 'number' ? section.order : desired.length + 1),
    });
  }

  if (!hasCategories) {
    desired.push({ key: 'categories', label: 'Shop by Category', type: 'super_category', order: 1, bannerIds: [] });
  }

  // Stable sort by order; hero always first.
  desired.sort((a, b) => {
    if (a.key === 'hero_banner') return -1;
    if (b.key === 'hero_banner') return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
  desired.forEach((d, i) => { d.order = i; });

  for (const def of desired) {
    await HomeSectionDefinition.findOneAndUpdate(
      { key: def.key },
      {
        $set: {
          key: def.key,
          label: def.label,
          type: def.type,
          order: def.order,
          bannerIds: def.bannerIds || [],
          bannerSelectionMode: (def.bannerIds || []).length > 1 ? 'multiple' : 'single',
          useCarousel: def.type === 'banner_main',
        },
      },
      { upsert: true, new: true },
    );
  }

  // Mastersheet is source of truth — remove layout keys not present in this sync.
  const desiredKeys = desired.map((d) => d.key);
  await HomeSectionDefinition.deleteMany({ key: { $nin: desiredKeys } });

  return desired;
}

// ── Home sections (product lists per section) ─────────────────────────────────
export function listHomeSections() {
  return HomeSection.find({ isActive: true }).sort({ order: 1 }).lean();
}

export function getHomeSection(id: string) {
  return HomeSection.findById(id).lean();
}

export async function createHomeSection(data: Record<string, unknown>) {
  return HomeSection.create(data);
}

export async function updateHomeSection(id: string, data: Record<string, unknown>) {
  return HomeSection.findByIdAndUpdate(id, data, { new: true }).lean();
}

export async function deleteHomeSection(id: string) {
  return HomeSection.findByIdAndDelete(id);
}

export async function reorderHomeSections(orderedIds: string[]) {
  const ops = orderedIds.map((id, index) => ({
    updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
  }));
  return HomeSection.bulkWrite(ops as any[]);
}

export async function updateSectionProducts(id: string, productIds: string[]) {
  return HomeSection.findByIdAndUpdate(id, { productIds }, { new: true }).lean();
}

// ── Home Config ───────────────────────────────────────────────────────────────
export async function getConfig() {
  const cfg = await HomeConfig.findOne({ key: 'main' }).lean();
  if (!cfg) return HomeConfig.create({ key: 'main' }).then((d) => d.toObject());
  return cfg;
}

export async function updateConfig(data: Record<string, unknown>) {
  return HomeConfig.findOneAndUpdate({ key: 'main' }, { $set: data }, { new: true, upsert: true }).lean();
}

export async function resetConfig() {
  await HomeConfig.findOneAndDelete({ key: 'main' });
  return HomeConfig.create({ key: 'main' });
}

// ── Lifestyle items ───────────────────────────────────────────────────────────
export function listLifestyleItems() {
  return LifestyleItem.find({ isActive: true }).sort({ order: 1 }).lean();
}

export async function createLifestyleItem(data: Record<string, unknown>) {
  return LifestyleItem.create(data);
}

export async function updateLifestyleItem(id: string, data: Record<string, unknown>) {
  return LifestyleItem.findByIdAndUpdate(id, data, { new: true }).lean();
}

export async function deleteLifestyleItem(id: string) {
  return LifestyleItem.findByIdAndDelete(id);
}

export async function reorderLifestyleItems(orderedIds: string[]) {
  const ops = orderedIds.map((id, index) => ({
    updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
  }));
  return LifestyleItem.bulkWrite(ops as any[]);
}

// ── Promo blocks ──────────────────────────────────────────────────────────────
export function listPromoBlocks() {
  return PromoBlock.find({ isActive: true }).sort({ order: 1 }).lean();
}

export async function createPromoBlock(data: Record<string, unknown>) {
  return PromoBlock.create(data);
}

export async function updatePromoBlock(id: string, data: Record<string, unknown>) {
  return PromoBlock.findByIdAndUpdate(id, data, { new: true }).lean();
}

export async function deletePromoBlock(id: string) {
  return PromoBlock.findByIdAndDelete(id);
}

export async function reorderPromoBlocks(orderedIds: string[]) {
  const ops = orderedIds.map((id, index) => ({
    updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
  }));
  return PromoBlock.bulkWrite(ops as any[]);
}
