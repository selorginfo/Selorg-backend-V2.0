/**
 * Master Sheet category taxonomy helpers: duplicate L1/L2 detection and canonical-row
 * selection. Re-imports historically created suffix slugs (boiled-rice-3 … boiled-rice-9)
 * under the same parent; customer APIs must treat same-named L2s as one subcategory. L1
 * twins like "Millet Mandi"/"Millets Mandi" are collapsed by token fingerprint.
 *
 * This only ports the READ-PATH dedup helpers from the legacy `categoryTaxonomyCleanup.js`.
 * The background self-healing consolidation jobs (consolidateDuplicateTopCategories,
 * consolidateDuplicateSubcategories, deactivateLegacySeedProducts — DB-mutating, fired via
 * setImmediate as a side effect of read requests) are deliberately NOT ported: they're a
 * data-hygiene repair mechanism, not required for correct reads against already-clean data.
 */

export function sanitizeCategoryDisplayName(name?: string | null): string {
  return String(name || '').trim().replace(/[:;.,]+\s*$/, '').trim();
}

export function normalizeCategoryName(name?: string | null): string {
  return sanitizeCategoryDisplayName(name).toLowerCase().replace(/\s+/g, ' ');
}

const CATEGORY_TOKEN_ALIAS = new Map([['diary', 'dairy']]);
const CATEGORY_STOPWORDS = new Set(['category', 'categories', 'the', 'a', 'an']);

function stemCategoryToken(t: string): string {
  if (!t) return '';
  if (CATEGORY_TOKEN_ALIAS.has(t)) return CATEGORY_TOKEN_ALIAS.get(t)!;
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 4 && t.endsWith('es')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1);
  return t;
}

/** Stable fingerprint for plural/singular L1 twins ("Millet Mandi" <-> "Millets Mandi"). */
export function categoryFingerprint(name?: string | null): string {
  return [
    ...new Set(
      normalizeCategoryName(name)
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t && !CATEGORY_STOPWORDS.has(t))
        .map(stemCategoryToken)
        .filter(Boolean),
    ),
  ]
    .sort()
    .join(' ');
}

/**
 * Dedupe key for L2s: normalizes "&" <-> "and" and strips a trailing " rice" so sheet
 * variants like "Greens & Herbs"/"Greens And Herbs" collapse.
 */
export function normalizeSubcategoryDedupeKey(name?: string | null): string {
  return normalizeCategoryName(name).replace(/&/g, ' and ').replace(/\s+/g, ' ').replace(/\s+rice$/, '').trim();
}

/** Prefers an unsuffixed slug (boiled-rice) over boiled-rice-9. */
function slugSuffixRank(slug?: string | null): number {
  const m = String(slug || '').match(/-(\d+)$/);
  return m ? Number(m[1]) : 0;
}

/** Prefers "Seeds" over master-sheet header "Seeds:". Lower is better. */
function displayNameCleanlinessRank(name?: string | null): number {
  return /[:;.,]+$/.test(String(name || '').trim()) ? 1 : 0;
}

export interface CanonicalCandidate {
  _id: unknown;
  name?: string;
  slug?: string;
  productCount?: number;
  order?: number;
}

/** Among same-named L2 (or L1) docs, picks the canonical one: prefer higher productCount, then unsuffixed slug, then stable _id. */
export function pickCanonicalSubcategory<T extends CanonicalCandidate>(group: T[]): T | null {
  if (!Array.isArray(group) || group.length === 0) return null;
  return [...group].sort((a, b) => {
    const pc = (b.productCount || 0) - (a.productCount || 0);
    if (pc !== 0) return pc;
    const dn = displayNameCleanlinessRank(a.name) - displayNameCleanlinessRank(b.name);
    if (dn !== 0) return dn;
    const sr = slugSuffixRank(a.slug) - slugSuffixRank(b.slug);
    if (sr !== 0) return sr;
    const oa = Number.isFinite(Number(a.order)) ? Number(a.order) : 9999;
    const ob = Number.isFinite(Number(b.order)) ? Number(b.order) : 9999;
    if (oa !== ob) return oa - ob;
    return String(a._id).localeCompare(String(b._id));
  })[0];
}

/** Collapses duplicate L2s that share a display name (case-insensitive), merging productCount onto the canonical row. */
export function dedupeSubcategoriesByName<T extends CanonicalCandidate & { name: string }>(subcategories: T[]): T[] {
  if (!Array.isArray(subcategories) || subcategories.length === 0) return [];
  const groups = new Map<string, T[]>();
  const orderKeys: string[] = [];
  for (const s of subcategories) {
    const key = normalizeSubcategoryDedupeKey(s.name);
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, []);
      orderKeys.push(key);
    }
    groups.get(key)!.push(s);
  }
  const out: T[] = [];
  for (const key of orderKeys) {
    const group = groups.get(key)!;
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    const totalCount = group.reduce((n, s) => n + (Number(s.productCount) || 0), 0);
    const winner = pickCanonicalSubcategory(group)!;
    out.push({ ...winner, name: sanitizeCategoryDisplayName(winner.name), productCount: totalCount });
  }
  return out;
}

/** Same-named L2 twins under a parent (and optional alias parents), including the selected subcategory itself. */
export function findSameNamedSubcategoryTwins<T extends { _id: unknown; name?: string; slug?: string }>(selectedSub: T | null | undefined, candidateSubs: T[]): T[] {
  if (!selectedSub) return [];
  const nameKey = normalizeSubcategoryDedupeKey(selectedSub.name);
  const slugKey = String(selectedSub.slug || '').trim().toLowerCase();
  const seen = new Set<string>();
  const twins: T[] = [];
  for (const s of candidateSubs || []) {
    if (!s?._id) continue;
    const id = String(s._id);
    if (seen.has(id)) continue;
    const sameName = Boolean(nameKey) && normalizeSubcategoryDedupeKey(s.name) === nameKey;
    const sameSlug = Boolean(slugKey) && String(s.slug || '').trim().toLowerCase() === slugKey;
    if (!sameName && !sameSlug) continue;
    seen.add(id);
    twins.push(s);
  }
  if (!seen.has(String(selectedSub._id))) twins.unshift(selectedSub);
  return twins;
}

/** In-memory dedupe of L1 rows by fingerprint (API response hygiene). */
export function dedupeTopCategoriesByFingerprint<T extends { name?: string }>(categories: T[]): T[] {
  if (!Array.isArray(categories) || categories.length === 0) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const c of categories) {
    const fp = categoryFingerprint(c.name) || normalizeCategoryName(c.name);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    out.push(c);
  }
  return out;
}
