export type SkippedRow = { row: number; ref: string; reason: string };
export type ErrorRow = { row: number; ref: string; error: string };

export type SheetResult = {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  skippedRows: SkippedRow[];
  errors: ErrorRow[];
};

export type SheetKey =
  | 'sku-master'
  | 'categories'
  | 'category-display-image'
  | 'banner-details'
  | 'home-page-content'
  | 'subcategories';

export const PROCESS_SHEET_ORDER: SheetKey[] = [
  'sku-master',
  'categories',
  'category-display-image',
  'banner-details',
  'home-page-content',
  'subcategories',
];

export const SHEET_LABELS: Record<SheetKey, string> = {
  'sku-master': 'SKU Master',
  categories: 'Categories',
  'category-display-image': 'Category Display Image',
  'banner-details': 'Banner Details',
  'home-page-content': 'Home Page Content',
  subcategories: 'Subcategories',
};

export type SheetOutcome = {
  ok: boolean;
  result?: SheetResult;
  error?: string;
  missing?: boolean;
};

export type PendingCleanup = {
  touchedHeroBannerIds: string[];
  touchedSectionKeys: string[];
  touchedCategoryBannerIds: string[];
  needsHomeSync: boolean;
  needsBannerRevision: boolean;
  needsSubcatRevision: boolean;
};

export function emptyPendingCleanup(): PendingCleanup {
  return {
    touchedHeroBannerIds: [],
    touchedSectionKeys: [],
    touchedCategoryBannerIds: [],
    needsHomeSync: false,
    needsBannerRevision: false,
    needsSubcatRevision: false,
  };
}

export function mapToObject<T>(map: Map<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of map) out[k] = v;
  return out;
}

export function objectToMap<T>(obj: Record<string, T> | null | undefined): Map<string, T> {
  const map = new Map<string, T>();
  if (!obj || typeof obj !== 'object') return map;
  for (const [k, v] of Object.entries(obj)) map.set(k, v as T);
  return map;
}

export function mergeCleanup(base: PendingCleanup, patch: Partial<PendingCleanup>): PendingCleanup {
  return {
    touchedHeroBannerIds: [
      ...new Set([...(base.touchedHeroBannerIds || []), ...(patch.touchedHeroBannerIds || [])]),
    ],
    touchedSectionKeys: [
      ...new Set([...(base.touchedSectionKeys || []), ...(patch.touchedSectionKeys || [])]),
    ],
    touchedCategoryBannerIds: [
      ...new Set([...(base.touchedCategoryBannerIds || []), ...(patch.touchedCategoryBannerIds || [])]),
    ],
    needsHomeSync: Boolean(base.needsHomeSync || patch.needsHomeSync),
    needsBannerRevision: Boolean(base.needsBannerRevision || patch.needsBannerRevision),
    needsSubcatRevision: Boolean(base.needsSubcatRevision || patch.needsSubcatRevision),
  };
}

/** True when every required sheet either processed OK or was explicitly missing-and-rejected at prepare. */
export function allRequiredSheetsSucceeded(
  outcomes: Partial<Record<SheetKey, SheetOutcome>>,
  required: SheetKey[] = PROCESS_SHEET_ORDER,
): { ok: boolean; reason?: string } {
  for (const key of required) {
    const o = outcomes[key];
    if (!o) return { ok: false, reason: `Sheet "${SHEET_LABELS[key]}" was not processed` };
    if (!o.ok) {
      return {
        ok: false,
        reason: o.error || `Sheet "${SHEET_LABELS[key]}" failed`,
      };
    }
    if (o.result && (o.result.errors?.length ?? 0) > 0) {
      return {
        ok: false,
        reason: `Sheet "${SHEET_LABELS[key]}" has ${o.result.errors.length} row error(s) — import not activated`,
      };
    }
  }
  return { ok: true };
}

export function summarizeOutcomes(outcomes: Partial<Record<SheetKey, SheetOutcome>>) {
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalRecords = 0;
  const sheets = PROCESS_SHEET_ORDER.map((sheetKey) => {
    const o = outcomes[sheetKey];
    const r = o?.result;
    totalCreated += r?.created ?? 0;
    totalUpdated += r?.updated ?? 0;
    totalSkipped += r?.skipped ?? 0;
    totalErrors += r?.errors?.length ?? 0;
    totalRecords += r?.totalRows ?? 0;
    return {
      sheetKey,
      label: SHEET_LABELS[sheetKey],
      status: !o ? 'pending' : o.missing ? 'missing' : o.ok ? 'processed' : 'error',
      totalRows: r?.totalRows ?? 0,
      created: r?.created ?? 0,
      updated: r?.updated ?? 0,
      skipped: r?.skipped ?? 0,
      errorCount: r?.errors?.length ?? (o?.error ? 1 : 0),
      errorMessage: o?.error ?? '',
    };
  });
  return { sheets, totalCreated, totalUpdated, totalSkipped, totalErrors, totalRecords };
}
