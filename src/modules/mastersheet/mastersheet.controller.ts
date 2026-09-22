import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../../utils/AppError';
import { isMetaRow, normalizeRow } from '../products/products.admin.controller';
import {
  PROCESS_SHEET_ORDER,
  emptyPendingCleanup,
  mapToObject,
  mergeCleanup,
  objectToMap,
  type PendingCleanup,
  type SheetOutcome,
} from './mastersheet.import.helpers';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
export const uploadMiddleware = upload.single('file');

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

const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour — Mongo persists across restarts

/* ── Hybrid job store: memory cache + MongoDB (survives backend restart) ── */
type Job = {
  jobId: string;
  sheets: Map<string, Record<string, unknown>[]>;
  headers: Map<string, string[]>;
  createdAt: number;
  versionId: string;
  fileName: string;
  sheetOutcomes: Partial<Record<SheetKey, SheetOutcome>>;
  pendingCleanup: PendingCleanup;
  status: 'ready' | 'processing' | 'finalized' | 'failed' | 'expired';
};
const jobStore = new Map<string, Job>();

setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobStore) {
    if (job.createdAt < cutoff) jobStore.delete(id);
  }
}, 5 * 60 * 1000);

async function persistJob(job: Job): Promise<void> {
  const { MastersheetJob } = await import('./mastersheet-job.model');
  await MastersheetJob.findOneAndUpdate(
    { jobId: job.jobId },
    {
      $set: {
        jobId: job.jobId,
        versionId: job.versionId,
        fileName: job.fileName,
        sheets: mapToObject(job.sheets),
        headers: mapToObject(job.headers),
        sheetOutcomes: job.sheetOutcomes,
        pendingCleanup: job.pendingCleanup,
        status: job.status,
        expiresAt: new Date(job.createdAt + JOB_TTL_MS),
      },
    },
    { upsert: true },
  );
}

async function loadJob(jobId: string): Promise<Job | null> {
  const cached = jobStore.get(jobId);
  if (cached) return cached;

  const { MastersheetJob } = await import('./mastersheet-job.model');
  const doc = await MastersheetJob.findOne({ jobId }).lean();
  if (!doc) return null;
  if (doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now()) return null;

  const job: Job = {
    jobId: doc.jobId,
    versionId: doc.versionId,
    fileName: doc.fileName || 'mastersheet.xlsx',
    sheets: objectToMap(doc.sheets as Record<string, Record<string, unknown>[]>),
    headers: objectToMap(doc.headers as Record<string, string[]>),
    sheetOutcomes: (doc.sheetOutcomes || {}) as Partial<Record<SheetKey, SheetOutcome>>,
    pendingCleanup: { ...emptyPendingCleanup(), ...(doc.pendingCleanup as Partial<PendingCleanup>) },
    createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
    status: (doc.status as Job['status']) || 'ready',
  };
  jobStore.set(jobId, job);
  return job;
}

async function applyDeferredCleanup(job: Job): Promise<number | null> {
  const { Banner } = await import('../banners/banners.model');
  const { HomeSection } = await import('../home/home.models');
  const { syncHomeSectionDefinitionsFromHomeSections, bumpHomeContentRevision } = await import('../home/home.service');
  const cleanup = job.pendingCleanup;

  if (cleanup.touchedHeroBannerIds.length > 0) {
    await Banner.updateMany(
      { slot: 'hero', _id: { $nin: cleanup.touchedHeroBannerIds } },
      { $set: { isActive: false } },
    );
    await Banner.updateMany(
      { bannerId: { $regex: /^Ban-hero-/i }, _id: { $nin: cleanup.touchedHeroBannerIds } },
      { $set: { isActive: false, slot: 'mid' } },
    );
  }

  if (cleanup.touchedSectionKeys.length > 0) {
    await HomeSection.updateMany(
      {
        isActive: true,
        sectionKey: { $nin: cleanup.touchedSectionKeys },
        $or: [
          { sectionKey: { $regex: /^collections_/i } },
          { sectionKey: { $regex: /^banner_/i } },
          { sectionType: { $regex: /collection|hero|banner|deal|product|scroll|promo|moringa|honey/i } },
        ],
      },
      { $set: { isActive: false } },
    );
  }

  if (cleanup.touchedCategoryBannerIds.length > 0) {
    await Banner.updateMany(
      {
        slot: 'category',
        isActive: true,
        _id: { $nin: cleanup.touchedCategoryBannerIds },
        bannerId: { $regex: /^Ban-\d/i },
      },
      { $set: { isActive: false } },
    );
  }

  if (cleanup.needsHomeSync) {
    await syncHomeSectionDefinitionsFromHomeSections();
  }

  if (cleanup.needsHomeSync || cleanup.needsBannerRevision || cleanup.needsSubcatRevision) {
    const cfg = await bumpHomeContentRevision(`mastersheet-activate:${job.versionId}`);
    return typeof cfg?.contentRevision === 'number' ? cfg.contentRevision : null;
  }
  return null;
}

/** Canonical tab names required in every valid master sheet. */
const REQUIRED_SHEET_NAMES = [
  'SKU Master',
  'Categories',
  'Category Display Image',
  'Banner Details',
  'Home Page Content',
  'Subcategories',
] as const;

const SHEET_LABELS: Record<SheetKey, string> = {
  'sku-master': 'SKU Master',
  'categories': 'Categories',
  'category-display-image': 'Category Display Image',
  'banner-details': 'Banner Details',
  'home-page-content': 'Home Page Content',
  'subcategories': 'Subcategories',
};

/** Minimum columns that must exist on each sheet (case/space-insensitive). */
const REQUIRED_COLUMNS: Record<(typeof REQUIRED_SHEET_NAMES)[number], string[]> = {
  'SKU Master': ['SKU Code', 'SKU Name'],
  Categories: ['Category', 'Sub Category', 'Hierarchy Code'],
  'Category Display Image': ['Category Level', 'Category Name', 'Display Image URL'],
  'Banner Details': ['Banner ID', 'Banner URL'],
  'Home Page Content': ['Section Type', 'Required Details'],
  Subcategories: ['Banner ID', 'Sub-Category Banner URL', 'Sub-Category Banner Name'],
};

function headerHasColumn(headers: string[], required: string): boolean {
  const want = required.trim().toLowerCase();
  const wantCompact = want.replace(/\s+/g, '');
  return headers.some((h) => {
    const got = h.trim().toLowerCase();
    return got === want || got.replace(/\s+/g, '') === wantCompact;
  });
}

function findSheetEntry(
  sheets: Map<string, Record<string, unknown>[]>,
  headers: Map<string, string[]>,
  expectedName: string,
): { name: string; rows: Record<string, unknown>[]; headers: string[] } | null {
  const want = normalizeSheetName(expectedName);
  for (const [name, rows] of sheets) {
    if (normalizeSheetName(name) === want) {
      return { name, rows, headers: headers.get(name) ?? [] };
    }
  }
  return null;
}

type StructureValidationIssue = {
  sheet: string;
  type: 'missing_sheet' | 'missing_columns' | 'empty_sheet' | 'invalid_rows' | 'duplicate';
  message: string;
  missingColumns?: string[];
};

/** Validate required sheets + columns before any DB write. */
function validateMasterSheetStructure(
  sheets: Map<string, Record<string, unknown>[]>,
  headers: Map<string, string[]>,
): StructureValidationIssue[] {
  const issues: StructureValidationIssue[] = [];
  for (const expected of REQUIRED_SHEET_NAMES) {
    const entry = findSheetEntry(sheets, headers, expected);
    if (!entry) {
      issues.push({
        sheet: expected,
        type: 'missing_sheet',
        message: `Required sheet "${expected}" is missing`,
      });
      continue;
    }
    const requiredCols = REQUIRED_COLUMNS[expected];
    const missingColumns = requiredCols.filter((col) => !headerHasColumn(entry.headers, col));
    if (missingColumns.length > 0) {
      issues.push({
        sheet: expected,
        type: 'missing_columns',
        message: `Sheet "${entry.name}" is missing required columns: ${missingColumns.join(', ')}`,
        missingColumns,
      });
    }
  }
  return issues;
}

/** Row-level validation (required values + duplicates) — reject before processing. */
function validateMasterSheetContent(
  sheets: Map<string, Record<string, unknown>[]>,
  headers: Map<string, string[]>,
): StructureValidationIssue[] {
  const issues: StructureValidationIssue[] = [];

  const skuSheet = findSheetEntry(sheets, headers, 'SKU Master');
  if (skuSheet) {
    const seenSku = new Map<string, number>();
    let dataRows = 0;
    for (let i = 0; i < skuSheet.rows.length; i++) {
      const row = skuSheet.rows[i]!;
      const sku = cell(row, 'SKU Code', 'sku', 'SKU');
      const name = cell(row, 'SKU Name', 'name', 'Name');
      if (isMetaRow(sku) || isTemplateHintValue(sku)) continue;
      if (!sku && !name) continue;
      dataRows++;
      if (!sku) {
        issues.push({ sheet: 'SKU Master', type: 'invalid_rows', message: `Row ${i + 2}: missing SKU Code` });
        continue;
      }
      if (!name) {
        issues.push({ sheet: 'SKU Master', type: 'invalid_rows', message: `Row ${i + 2} (${sku}): missing SKU Name` });
      }
      const key = sku.toUpperCase();
      if (seenSku.has(key)) {
        issues.push({
          sheet: 'SKU Master',
          type: 'duplicate',
          message: `Duplicate SKU Code "${sku}" at rows ${seenSku.get(key)} and ${i + 2}`,
        });
      } else seenSku.set(key, i + 2);
    }
    if (dataRows === 0) {
      issues.push({ sheet: 'SKU Master', type: 'empty_sheet', message: 'SKU Master has no data rows' });
    }
  }

  const bannerSheet = findSheetEntry(sheets, headers, 'Banner Details');
  if (bannerSheet) {
    const seen = new Map<string, number>();
    for (let i = 0; i < bannerSheet.rows.length; i++) {
      const row = bannerSheet.rows[i]!;
      const bannerId = cell(row, 'Banner ID', 'Banner Id', 'bannerId');
      const bannerUrl = cell(row, 'Banner URL', 'Banner Url', 'Image URL');
      if (!bannerId || bannerId.toLowerCase() === 'banner id' || isTemplateHintValue(bannerId)) continue;
      if (!bannerUrl || isTemplateHintValue(bannerUrl) || !/^https?:\/\//i.test(bannerUrl)) {
        issues.push({
          sheet: 'Banner Details',
          type: 'invalid_rows',
          message: `Row ${i + 2} (${bannerId}): missing or invalid Banner URL`,
        });
      }
      const key = bannerId.toUpperCase();
      if (seen.has(key)) {
        issues.push({
          sheet: 'Banner Details',
          type: 'duplicate',
          message: `Duplicate Banner ID "${bannerId}" at rows ${seen.get(key)} and ${i + 2}`,
        });
      } else seen.set(key, i + 2);
    }
  }

  const homeSheet = findSheetEntry(sheets, headers, 'Home Page Content');
  if (homeSheet) {
    let dataRows = 0;
    for (let i = 0; i < homeSheet.rows.length; i++) {
      const row = homeSheet.rows[i]!;
      const sectionType = cell(row, 'Section Type', 'Section type');
      if (!sectionType || sectionType.toLowerCase() === 'section type' || sectionType.toLowerCase() === 'homepage') continue;
      if (isTemplateHintValue(sectionType)) continue;
      dataRows++;
    }
    if (dataRows === 0) {
      issues.push({ sheet: 'Home Page Content', type: 'empty_sheet', message: 'Home Page Content has no data rows' });
    }
  }

  const catImgSheet = findSheetEntry(sheets, headers, 'Category Display Image');
  if (catImgSheet) {
    for (let i = 0; i < catImgSheet.rows.length; i++) {
      const row = catImgSheet.rows[i]!;
      const levelStr = cell(row, 'Category Level');
      const categoryName = cell(row, 'Category Name');
      const imageUrl = cell(row, 'Display Image URL');
      if (levelStr.toLowerCase() === 'category level') continue;
      if (!categoryName && !imageUrl && !levelStr) continue;
      if (!categoryName) {
        issues.push({ sheet: 'Category Display Image', type: 'invalid_rows', message: `Row ${i + 2}: missing Category Name` });
      }
      if (imageUrl && !isTemplateHintValue(imageUrl) && !/^https?:\/\//i.test(imageUrl)) {
        issues.push({
          sheet: 'Category Display Image',
          type: 'invalid_rows',
          message: `Row ${i + 2} (${categoryName || '?'}): invalid Display Image URL`,
        });
      }
    }
  }

  const subSheet = findSheetEntry(sheets, headers, 'Subcategories');
  if (subSheet) {
    const seen = new Map<string, number>();
    for (let i = 0; i < subSheet.rows.length; i++) {
      const row = subSheet.rows[i]!;
      const bannerId = cell(row, 'Banner ID', 'Banner Id');
      if (!bannerId || bannerId.toLowerCase() === 'banner id' || isTemplateHintValue(bannerId)) continue;
      const bannerUrl = cell(row, 'Sub-Category Banner URL', 'Sub Category Banner URL', 'Banner URL');
      const bannerName = cell(row, 'Sub-Category Banner Name', 'Sub Category Banner Name', 'Banner Name');
      if (!bannerUrl || (!isTemplateHintValue(bannerUrl) && !/^https?:\/\//i.test(bannerUrl))) {
        if (bannerUrl && !isTemplateHintValue(bannerUrl)) {
          issues.push({
            sheet: 'Subcategories',
            type: 'invalid_rows',
            message: `Row ${i + 2} (${bannerId}): invalid Sub-Category Banner URL`,
          });
        }
      }
      if (!bannerName && !isTemplateHintValue(bannerId)) {
        issues.push({
          sheet: 'Subcategories',
          type: 'invalid_rows',
          message: `Row ${i + 2} (${bannerId}): missing Sub-Category Banner Name`,
        });
      }
      const key = bannerId.toUpperCase();
      if (seen.has(key)) {
        issues.push({
          sheet: 'Subcategories',
          type: 'duplicate',
          message: `Duplicate Banner ID "${bannerId}" at rows ${seen.get(key)} and ${i + 2}`,
        });
      } else seen.set(key, i + 2);
    }
  }

  return issues.slice(0, 40);
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function emptyResult(totalRows = 0): SheetResult {
  return { totalRows, created: 0, updated: 0, skipped: 0, skippedRows: [], errors: [] };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeSheetName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}

function str(v: unknown): string {
  return v !== undefined && v !== null && v !== '' ? String(v).trim() : '';
}

/** Case/space-insensitive column lookup — Master Sheets often drift on casing. */
function cell(row: Record<string, unknown>, ...names: string[]): string {
  const keys = Object.keys(row);
  for (const name of names) {
    const want = name.trim().toLowerCase();
    const found = keys.find((k) => k.trim().toLowerCase() === want);
    if (found !== undefined) return str(row[found]);
  }
  for (const name of names) {
    const want = name.replace(/\s+/g, '').toLowerCase();
    const found = keys.find((k) => k.replace(/\s+/g, '').toLowerCase() === want);
    if (found !== undefined) return str(row[found]);
  }
  return '';
}

function skip(result: SheetResult, row: number, ref: string, reason: string) {
  result.skipped++;
  result.skippedRows.push({ row, ref, reason });
}

/** Template hint / sample rows that must never become catalog data. */
function isTemplateHintValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  return (
    v === 'mandatory' ||
    v === 'optional' ||
    v.startsWith('e.g.') ||
    v.startsWith('eg.') ||
    v.includes('cdn…') ||
    v.includes('cdn...') ||
    v === 'banner id' ||
    v === 'section type' ||
    v === 'clickable / static'
  );
}

function normalizeMatchName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\r?\n/g, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(promotional|promo|header|banner|spl|special|title|description)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(value: string): string[] {
  const stop = new Set([
    'and', 'or', 'the', 'of', 'for', 'a', 'an',
    'vegetables', 'vegetable', 'fruits', 'fruit', 'products', 'product',
  ]);
  return normalizeMatchName(value)
    .split(' ')
    .filter((t) => t.length > 2 && !stop.has(t));
}

function tokenMatchScore(a: string, b: string): number {
  const ta = significantTokens(a);
  const tb = significantTokens(b);
  if (!ta.length || !tb.length) return 0;
  let hits = 0;
  for (const x of ta) {
    if (tb.some((y) => y === x || y.startsWith(x.slice(0, Math.min(4, x.length))) || x.startsWith(y.slice(0, Math.min(4, y.length))))) {
      hits += 1;
    }
  }
  return hits / Math.max(ta.length, tb.length);
}

/** Known Master Sheet title ↔ catalog subcategory name drift. */
const SUBCATEGORY_BANNER_ALIASES: Array<{ banner: RegExp; category: RegExp }> = [
  { banner: /\bbanana\b/i, category: /^banana varieties$/i },
  { banner: /\b(high\s*nutrition|highly\s*nutrit)/i, category: /^highly nutritious fruits$/i },
  { banner: /\bmango/i, category: /^mango varieties$/i },
  { banner: /\bessential/i, category: /^daily essentials$/i },
  { banner: /\bclimber/i, category: /^climbers$/i },
  { banner: /\bgreens?\b.*\bherbs?\b|\bherbs?\b.*\bgreens?\b/i, category: /^greens\s*(&|and)\s*herbs$/i },
  { banner: /\bmillets?\b/i, category: /^millets$/i },
  { banner: /\bghee\b/i, category: /^ghee$/i },
  { banner: /\bpulses?\b/i, category: /^pulses$/i },
  { banner: /\bherbs?\s*mix/i, category: /herb/i },
];

function scoreSubcategoryBannerMatch(bannerName: string, categoryName: string): number {
  const bn = normalizeMatchName(bannerName);
  const cn = normalizeMatchName(categoryName);
  if (!bn || !cn) return 0;
  if (bn === cn) return 1;
  if (bn.includes(cn) || cn.includes(bn)) return 0.92;
  for (const alias of SUBCATEGORY_BANNER_ALIASES) {
    if (alias.banner.test(bannerName) && alias.category.test(categoryName)) return 0.9;
  }
  return tokenMatchScore(bannerName, categoryName);
}

/** Resolve sheet rows with fuzzy name match (Dashboard already fuzzy-matches). */
function getSheetRows(
  sheets: Map<string, Record<string, unknown>[]>,
  expectedName: string,
): Record<string, unknown>[] {
  if (sheets.has(expectedName)) return sheets.get(expectedName)!;
  const want = normalizeSheetName(expectedName);
  for (const [name, rows] of sheets) {
    if (normalizeSheetName(name) === want) return rows;
  }
  return [];
}

/** Known header tokens per sheet — prefer a row that contains these over the first non-blank. */
const SHEET_HEADER_HINTS: Record<string, string[]> = {
  'SKU Master': ['sku code', 'sku name'],
  Categories: ['category', 'sub category', 'hierarchy code'],
  'Category Display Image': ['category level', 'category name', 'display image url'],
  'Banner Details': ['banner id', 'banner url', 'banner type', 'banner name'],
  'Home Page Content': ['section type', 'section name', 'required details'],
  Subcategories: ['banner id', 'sub-category banner url', 'sub-category banner name'],
};

function findHeaderIndex(aoa: unknown[][], sheetName: string): number {
  const hints = (SHEET_HEADER_HINTS[sheetName] || []).map((h) => h.toLowerCase());
  const isBlankCell = (c: unknown) => c == null || String(c).trim() === '';
  const nonBlankCount = (r: unknown[]) => (r ?? []).filter((c) => !isBlankCell(c)).length;

  if (hints.length >= 2) {
    const limit = Math.min(aoa.length, 40);
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < limit; i++) {
      const cells = (aoa[i] ?? []).map((c) => String(c ?? '').trim().toLowerCase());
      const score = hints.filter((h) => cells.some((c) => c === h || c.replace(/\s+/g, '') === h.replace(/\s+/g, ''))).length;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestScore >= 2) return bestIdx;
  }

  let headerIdx = 0;
  while (headerIdx < aoa.length && nonBlankCount(aoa[headerIdx] ?? []) < 2) {
    headerIdx++;
  }
  return headerIdx;
}

/** Parse ALL sheets from an XLSX buffer → rows + detected headers per sheet */
async function parseAllSheets(buffer: Buffer): Promise<{
  sheets: Map<string, Record<string, unknown>[]>;
  headers: Map<string, string[]>;
}> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheets = new Map<string, Record<string, unknown>[]>();
  const headersMap = new Map<string, string[]>();
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]!;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    const isBlankCell = (c: unknown) => c == null || String(c).trim() === '';
    const isBlankRow = (r: unknown[]) => (r ?? []).every(isBlankCell);
    const headerIdx = findHeaderIndex(aoa, name);
    const headers = (aoa[headerIdx] ?? []).map((h) => String(h ?? '').trim()).filter(Boolean);
    const rows: Record<string, unknown>[] = [];
    for (let r = headerIdx + 1; r < aoa.length; r++) {
      const rowArr = aoa[r] ?? [];
      if (isBlankRow(rowArr)) continue;
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => { if (h) obj[h] = rowArr[i] ?? ''; });
      rows.push(obj);
    }
    sheets.set(name, rows);
    headersMap.set(name, headers);
  }
  return { sheets, headers: headersMap };
}

/** Stable sectionKey for Home Page Content rows (must match live /home keys). */
function resolveHomeSectionKey(sectionType: string, sectionName: string, bannerCodes: string[] = []): string {
  const t = sectionType.toLowerCase();
  const n = sectionName.toLowerCase();
  const nameIsUrl = /^https?:\/\//i.test(sectionName);
  const nameIsBan = /^ban-?\d+/i.test(sectionName.trim());
  // Prefer human section type over raw CDN URLs / Ban codes for stable keys.
  const labelForKey = (!nameIsUrl && !nameIsBan && sectionName.trim())
    ? sectionName
    : (sectionType || bannerCodes[0] || 'section');

  if (t.includes('hero')) {
    if (t.includes('video')) return 'hero_video';
    return 'hero_banner';
  }
  if (t.includes('categor')) return 'categories';
  if (t.includes('lifestyle')) return 'lifestyle';
  if (t.includes('collection') || t === 'collections') {
    return `collections_${slugify(nameIsUrl ? sectionType || 'section' : sectionName || 'section')}`;
  }
  if (/best\s*seller/.test(n) || t.includes('bestseller') || t.includes('best seller')) return 'bestsellers';
  if (/new\s*arrival/.test(n) || t.includes('new arrival')) return 'new_arrivals';

  const looksLikeBanner =
    t.includes('banner') ||
    t.includes('promo') ||
    t.includes('mid') ||
    t.includes('scroll') ||
    t.includes('moringa') ||
    t.includes('honey') ||
    bannerCodes.length > 0;
  if (looksLikeBanner && !t.includes('hero')) {
    const base = slugify(labelForKey).slice(0, 48) || 'promo';
    // Keep one section per logical row: type+first Ban code avoids URL-key collisions.
    if (bannerCodes.length === 1) return `banner_${base}_${slugify(bannerCodes[0]).slice(0, 12)}`;
    if (bannerCodes.length > 1) return `banner_${base}_row`;
    return `banner_${base}`;
  }
  return `${slugify(sectionType || 'section')}_${slugify(labelForKey)}`.replace(/_{2,}/g, '_');
}

/** Extract Ban-* codes from free text (Required Details, Section Name, Banner ID col). */
function extractBannerCodes(...texts: string[]): string[] {
  const out: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const ref of text.split(/[,\n\r;/|]+/).map((r) => r.trim()).filter(Boolean)) {
      if (!/^Ban-?\s*\d+/i.test(ref) && !/^Ban\d+/i.test(ref)) continue;
      const normalizedId = ref
        .replace(/^Ban\s*/i, 'Ban-')
        .replace(/^Ban-+/i, 'Ban-')
        .replace(/\s+/g, '');
      const normRef = normalizedId
        .replace(/^Ban-0*/i, 'Ban-')
        .replace(/^Ban-(\d)$/, 'Ban-00$1')
        .replace(/^Ban-(\d\d)$/, 'Ban-0$1');
      out.push(normRef);
    }
  }
  return [...new Set(out)];
}

async function resolveBannerObjectIds(codes: string[]): Promise<{ ids: unknown[]; matchedCodes: string[] }> {
  const { Banner } = await import('../banners/banners.model');
  const ids: unknown[] = [];
  const matchedCodes: string[] = [];
  for (const code of codes) {
    const normalizedId = code.replace(/^Ban\s*/i, 'Ban-').replace(/^Ban-+/i, 'Ban-');
    const normRef = normalizedId
      .replace(/^Ban-0*/i, 'Ban-')
      .replace(/^Ban-(\d)$/, 'Ban-00$1')
      .replace(/^Ban-(\d\d)$/, 'Ban-0$1');
    const candidates = [...new Set([code, normalizedId, normRef])];
    const banner = await Banner.findOne({ bannerId: { $in: candidates } }).select('_id bannerId').lean();
    if (banner) {
      ids.push(banner._id);
      matchedCodes.push(String(banner.bannerId || code));
    }
  }
  return { ids, matchedCodes };
}

/* ══════════════════════════════════════════════════════════════════════
   SHEET PROCESSORS
══════════════════════════════════════════════════════════════════════ */

async function processSkuMaster(rows: Record<string, unknown>[]): Promise<SheetResult> {
  const { Product } = await import('../products/products.model');
  const { WarehouseInventory } = await import('../products/store-inventory.model');
  const { WarehouseLocation } = await import('../warehouse/warehouse.models');
  const result = emptyResult(rows.length);

  const warehouseCache = new Map<string, string | null>();
  async function resolveWarehouseId(code: string): Promise<string | null> {
    const key = code.toUpperCase();
    if (warehouseCache.has(key)) return warehouseCache.get(key)!;
    const wh = await WarehouseLocation.findOne({ code: key }).select('_id').lean();
    const id = wh ? String(wh._id) : null;
    warehouseCache.set(key, id);
    return id;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const sku = String(row['SKU Code'] ?? row.sku ?? row.SKU ?? '').trim();

    if (isMetaRow(sku)) {
      skip(result, i + 2, sku || '(empty)', `Metadata/header row — value: "${sku}"`);
      continue;
    }

    const name = String(row['SKU Name'] ?? row.name ?? row.Name ?? '').trim();
    if (!sku) {
      skip(result, i + 2, '(blank)', 'SKU Code is empty');
      continue;
    }
    if (!name) {
      result.errors.push({ row: i + 2, ref: sku, error: 'Missing SKU Name' });
      continue;
    }

    try {
      const payload = normalizeRow(row);
      if (payload.price === undefined || payload.price === null) payload.price = 0;

      let productId: string;
      const existing = await Product.findOne({ sku });
      if (existing) {
        await Product.updateOne({ sku }, { $set: payload });
        productId = String(existing._id);
        result.updated++;
      } else {
        const created = await Product.create({ ...payload, sku, name, status: 'active' });
        productId = String(created._id);
        result.created++;
      }

      const whCode = String(row['Warehouse Code'] ?? row.warehouse_code ?? '').trim();
      if (whCode) {
        const warehouseId = await resolveWarehouseId(whCode);
        if (warehouseId) {
          await WarehouseInventory.updateOne(
            { warehouseId, productId },
            { $setOnInsert: { warehouseId, productId, quantity: 0, reservedQty: 0, isAvailable: true, lowStockThreshold: 5 } },
            { upsert: true },
          );
        }
      }
    } catch (err) {
      result.errors.push({ row: i + 2, ref: sku, error: (err as Error).message });
    }
  }
  return result;
}

async function processCategories(rows: Record<string, unknown>[]): Promise<SheetResult> {
  const { Category } = await import('../categories/categories.model');
  const { Product } = await import('../products/products.model');
  const result = emptyResult(rows.length);
  let currentL1Id: string | null = null;
  let currentL2Id: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const catName = str(row['Category']);
    const subCatName = str(row['Sub Category']);
    const productName = str(row['Products']);
    const hierarchyCode = str(row['Hierarchy Code']);

    // Header rows
    if (catName.toLowerCase() === 'category') {
      skip(result, i + 2, catName, 'Header row');
      continue;
    }

    if (!catName && !subCatName && !productName) continue;

    try {
      if (catName) {
        const slug = slugify(catName);
        const existing = await Category.findOne({ slug }).lean();
        if (existing) {
          await Category.updateOne({ slug }, { $set: { name: catName, level: 1, isActive: true } });
          currentL1Id = String(existing._id);
          result.updated++;
        } else {
          const created = await Category.create({ name: catName, slug, level: 1, parentId: null, isActive: true });
          currentL1Id = String(created._id);
          result.created++;
        }
        currentL2Id = null;
      } else if (subCatName) {
        if (!currentL1Id) {
          skip(result, i + 2, subCatName, 'Sub-category row but no parent category found above it');
          continue;
        }
        const slug = slugify(subCatName);
        const existing = await Category.findOne({ slug }).lean();
        if (existing) {
          await Category.updateOne({ slug }, { $set: { name: subCatName, level: 2, parentId: currentL1Id, isActive: true } });
          currentL2Id = String(existing._id);
          result.updated++;
        } else {
          const created = await Category.create({ name: subCatName, slug, level: 2, parentId: currentL1Id, isActive: true });
          currentL2Id = String(created._id);
          result.created++;
        }
      } else if (productName && hierarchyCode) {
        const escaped = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const setPayload: Record<string, unknown> = { hierarchyCode };
        if (currentL2Id) setPayload['subcategoryId'] = currentL2Id;
        if (currentL1Id) setPayload['categoryId'] = currentL1Id;
        const res = await Product.updateMany(
          { name: new RegExp(`^${escaped}(\\s|-|$)`, 'i') },
          { $set: setPayload },
        );
        if (res.matchedCount > 0) {
          result.updated += res.matchedCount;
          // Keep hierarchy codes on the L2 category for stable display-image / subcategory matching
          if (currentL2Id) {
            await Category.updateOne(
              { _id: currentL2Id },
              { $addToSet: { hierarchyCodes: hierarchyCode.toUpperCase() } },
            );
          }
        } else skip(result, i + 2, productName, `Product "${productName}" not found in DB — hierarchy code not applied`);
      } else if (productName && !hierarchyCode) {
        skip(result, i + 2, productName, 'Row has product name but missing Hierarchy Code');
      }
    } catch (err) {
      result.errors.push({ row: i + 2, ref: catName || subCatName || productName, error: (err as Error).message });
    }
  }
  return result;
}

function normalizeCategoryTokens(name: string): string[] {
  const STOP = new Set(['and', 'the', 'of', 'a', 'category', 'mandi']);
  return name.toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t))
    .sort();
}

function normalizeCategoryKey(name: string): string {
  return normalizeCategoryTokens(name).join('');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j]!, dp[j - 1]!) + 1;
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

async function processCategoryDisplayImage(rows: Record<string, unknown>[]): Promise<SheetResult> {
  const { Category } = await import('../categories/categories.model');
  const { Product } = await import('../products/products.model');
  const result = emptyResult(rows.length);

  const catsByLevel = new Map<number, { _id: unknown; name: string; slug: string; key: string; hierarchyCodes: string[] }[]>();
  async function candidates(level: number) {
    if (catsByLevel.has(level)) return catsByLevel.get(level)!;
    const list = await Category.find({ level }).select('_id name slug hierarchyCodes').lean();
    const mapped = list.map((c) => ({
      _id: c._id,
      name: c.name,
      slug: c.slug,
      key: normalizeCategoryKey(c.name),
      hierarchyCodes: (c.hierarchyCodes || []).map((h: string) => String(h).toUpperCase()),
    }));
    catsByLevel.set(level, mapped);
    return mapped;
  }

  async function resolveByHierarchyCode(code: string, level: number) {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return null;
    const pool = await candidates(level);
    const byCatCode = pool.filter((c) => c.hierarchyCodes.includes(normalized));
    if (byCatCode.length === 1) return byCatCode[0]!;
    if (byCatCode.length > 1) return { ambiguous: true as const, names: byCatCode.map((c) => c.name) };

    const product = await Product.findOne({ hierarchyCode: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
      .select('categoryId subcategoryId')
      .lean();
    if (!product) return null;
    const targetId = level === 2 ? product.subcategoryId : product.categoryId;
    if (!targetId) return null;
    return pool.find((c) => String(c._id) === String(targetId)) ?? null;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const categoryName = cell(row, 'Category Name');
    const imageUrl = cell(row, 'Display Image URL');
    const levelStr = cell(row, 'Category Level');
    const hierarchyRef = cell(row, 'Hierarchy Code Ref', 'Hierarchy Code', 'hierarchyCode');

    if (levelStr.toLowerCase() === 'category level') {
      skip(result, i + 2, categoryName || '(empty)', 'Header row');
      continue;
    }
    if (!categoryName && !imageUrl && !levelStr && !hierarchyRef) continue;
    if (!categoryName && !hierarchyRef) {
      skip(result, i + 2, '(blank)', 'Missing Category Name and Hierarchy Code Ref');
      continue;
    }
    if (!imageUrl) {
      skip(result, i + 2, categoryName || hierarchyRef, 'Missing Display Image URL');
      continue;
    }

    try {
      const level = levelStr.toLowerCase().includes('sub') ? 2 : 1;
      const pool = await candidates(level);
      let match: (typeof pool)[number] | null = null;

      // 1) Stable: hierarchy code
      if (hierarchyRef) {
        const byCode = await resolveByHierarchyCode(hierarchyRef, level);
        if (byCode && 'ambiguous' in byCode) {
          result.errors.push({
            row: i + 2,
            ref: hierarchyRef,
            error: `Ambiguous hierarchy code "${hierarchyRef}" matches: ${byCode.names.join(', ')}`,
          });
          continue;
        }
        match = byCode;
      }

      // 2) Exact normalized name / slug
      if (!match && categoryName) {
        const targetKey = normalizeCategoryKey(categoryName);
        const targetSlug = slugify(categoryName);
        const exact = pool.filter((c) => c.key === targetKey || c.slug === targetSlug);
        if (exact.length === 1) match = exact[0]!;
        else if (exact.length > 1) {
          result.errors.push({
            row: i + 2,
            ref: categoryName,
            error: `Ambiguous category name "${categoryName}" matches: ${exact.map((c) => c.name).join(', ')}`,
          });
          continue;
        }
      }

      // 3) Case-insensitive exact name only (no Levenshtein / fuzzy)
      if (!match && categoryName) {
        const exactName = pool.filter(
          (c) => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase(),
        );
        if (exactName.length === 1) match = exactName[0]!;
        else if (exactName.length > 1) {
          result.errors.push({
            row: i + 2,
            ref: categoryName,
            error: `Ambiguous category name "${categoryName}"`,
          });
          continue;
        }
      }

      if (match) {
        await Category.updateOne(
          { _id: match._id },
          { $set: { imageUrl, cardImageUrl: imageUrl, thumbnailUrl: imageUrl } },
        );
        result.updated++;
      } else {
        skip(
          result,
          i + 2,
          categoryName || hierarchyRef,
          `No unique level-${level} category found for "${categoryName || hierarchyRef}" — use Hierarchy Code Ref`,
        );
      }
    } catch (err) {
      result.errors.push({ row: i + 2, ref: categoryName || hierarchyRef, error: (err as Error).message });
    }
  }
  return result;
}

async function processBannerDetails(rows: Record<string, unknown>[], job?: Job): Promise<SheetResult> {
  const { Banner } = await import('../banners/banners.model');
  const { normalizeSelorgCdnUrl } = await import('../../utils/mediaEnrichment');
  const result = emptyResult(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const bannerId = cell(row, 'Banner ID', 'Banner Id', 'bannerId');
    const bannerUrlRaw = cell(row, 'Banner URL', 'Banner Url', 'Image URL', 'Image Url');
    const bannerUrl = normalizeSelorgCdnUrl(bannerUrlRaw) || bannerUrlRaw;

    if (!bannerId || bannerId.toLowerCase() === 'banner id' || isTemplateHintValue(bannerId)) {
      skip(result, i + 2, bannerId || '(blank)', bannerId.toLowerCase() === 'banner id' ? 'Header row' : isTemplateHintValue(bannerId) ? 'Template hint/sample row' : 'Missing Banner ID');
      continue;
    }
    if (!bannerUrl || isTemplateHintValue(bannerUrl) || !/^https?:\/\//i.test(bannerUrl)) {
      skip(result, i + 2, bannerId, 'Missing or invalid Banner URL');
      continue;
    }

    const bannerType = cell(row, 'Banner Type').replace(/\s+/g, '').toLowerCase();
    const bannerName = cell(row, 'Banner Name');
    const bannerSize = cell(row, 'Banner Size');
    const extraName = cell(row, 'Name');
    const sections: { key: string; value: string }[] = [];
    for (let s = 1; s <= 8; s++) {
      const v = cell(row, `Section ${s}`);
      if (v) sections.push({ key: `section${s}`, value: v });
    }
    if (bannerSize) sections.push({ key: 'size', value: bannerSize });
    if (extraName) sections.push({ key: 'name', value: extraName });

    try {
      const existing = await Banner.findOne({ bannerId }).lean();
      // Preserve hero/mid slots set by Home Page Content — Banner Details defaults to mid.
      const slot = existing && ['hero', 'large'].includes(String(existing.slot))
        ? existing.slot
        : ('mid' as const);
      const payload = {
        bannerId, bannerImageUrl: bannerUrl, imageUrl: bannerUrl,
        bannerType: bannerType || 'clickable', title: bannerName,
        slot, presentationMode: 'single' as const,
        isNavigable: bannerType !== 'static', isActive: true,
        inputKeyValuePairs: sections,
      };
      if (existing) { await Banner.updateOne({ bannerId }, { $set: payload }); result.updated++; }
      else { await Banner.create(payload); result.created++; }
    } catch (err) {
      result.errors.push({ row: i + 2, ref: bannerId, error: (err as Error).message });
    }
  }
  if (job) {
    job.pendingCleanup = mergeCleanup(job.pendingCleanup, { needsBannerRevision: true });
  }
  return result;
}

async function processHomePageContent(rows: Record<string, unknown>[], job?: Job): Promise<SheetResult> {
  const { HomeSection } = await import('../home/home.models');
  const { Banner } = await import('../banners/banners.model');
  const { Product } = await import('../products/products.model');
  const { normalizeSelorgCdnUrl } = await import('../../utils/mediaEnrichment');
  const result = emptyResult(rows.length);
  const touchedHeroBannerIds = new Set<string>();
  const touchedSectionKeys = new Set<string>();
  // Sheet row order is the homepage layout order (mastersheet source of truth).
  let layoutOrder = 1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    let sectionType = cell(row, 'Section Type', 'Section type');
    let sectionName = cell(row, 'Section Name', 'Section name');
    const requiredDetails = cell(row, 'Required Details', 'Required details', 'Details');
    const bannerIdCol = cell(row, 'Banner ID', 'Banner Id', 'bannerId');
    const videoLink = cell(row, 'video link', 'Video Link', 'Video URL', 'video');

    if (!sectionType || sectionType.toLowerCase() === 'section type' || sectionType.toLowerCase() === 'homepage') {
      skip(result, i + 2, sectionType || '(blank)', sectionType.toLowerCase() === 'section type' ? 'Header row' : sectionType.toLowerCase() === 'homepage' ? 'Sheet title row — not a data row' : 'Missing Section Type');
      continue;
    }
    if (isTemplateHintValue(sectionType)) {
      skip(result, i + 2, sectionType, 'Template hint/sample row');
      continue;
    }

    const earlyBanCodes = extractBannerCodes(requiredDetails, sectionName, bannerIdCol);
    // Section Name is optional when Ban IDs / SKUs / video are present (Master Sheet often
    // leaves the label blank and only fills Banner ID in Required Details).
    if (!sectionName) {
      if (earlyBanCodes.length > 0) {
        sectionName = earlyBanCodes.length === 1 ? earlyBanCodes[0]! : sectionType;
      } else if (/^(S\d+|SKU[-_]?\d+)/i.test(requiredDetails.split(/[,\n\r]+/)[0] || '')) {
        sectionName = sectionType;
      } else if (videoLink) {
        sectionName = sectionType;
      } else {
        skip(result, i + 2, sectionType, 'Missing Section Name');
        continue;
      }
    }

    const sectionTypeLower = sectionType.toLowerCase();
    const isHeroSection = sectionTypeLower.includes('hero') && !sectionTypeLower.includes('video');

    try {
      const importedBannerCodes = extractBannerCodes(requiredDetails, sectionName, bannerIdCol);
      const { ids: bannerIds, matchedCodes } = await resolveBannerObjectIds(importedBannerCodes);

      if (isHeroSection) {
        for (const id of bannerIds) {
          await Banner.updateOne({ _id: id }, { $set: { slot: 'hero', isActive: true } });
          touchedHeroBannerIds.add(String(id));
        }
      } else if (bannerIds.length > 0) {
        // Home mid/large/scroll promos — keep slot off hero so subcategory forks stay intact.
        await Banner.updateMany(
          { _id: { $in: bannerIds }, slot: { $nin: ['hero'] } },
          { $set: { slot: 'mid', isActive: true } },
        );
      }

      if (isHeroSection && sectionName && /^https?:\/\//i.test(sectionName)) {
        const heroUrl = normalizeSelorgCdnUrl(sectionName) || sectionName;
        if (bannerIds.length === 0) {
          const heroBannerId = `Ban-hero-${slugify(sectionType).slice(0, 20)}`;
          const existing = await Banner.findOne({ bannerId: heroBannerId }).lean();
          const heroPayload = {
            bannerId: heroBannerId, bannerImageUrl: heroUrl, imageUrl: heroUrl,
            bannerType: 'clickable', title: sectionType,
            slot: 'hero' as const, presentationMode: 'carousel' as const,
            isNavigable: true, isActive: true,
          };
          if (existing) {
            await Banner.updateOne({ bannerId: heroBannerId }, { $set: heroPayload });
            bannerIds.push(existing._id);
            touchedHeroBannerIds.add(String(existing._id));
          } else {
            const created = await Banner.create(heroPayload);
            bannerIds.push(created._id);
            touchedHeroBannerIds.add(String(created._id));
          }
        } else {
          for (const id of bannerIds) {
            const existing = await Banner.findById(id).select('imageUrl bannerImageUrl').lean();
            const hasImg = Boolean(String(existing?.imageUrl || existing?.bannerImageUrl || '').trim());
            if (!hasImg) {
              await Banner.updateOne(
                { _id: id },
                { $set: { imageUrl: heroUrl, bannerImageUrl: heroUrl } },
              );
            }
          }
        }
      }

      // Non-hero: Section Name URL can refresh the linked Ban-* artwork.
      if (!isHeroSection && bannerIds.length > 0 && /^https?:\/\//i.test(sectionName)) {
        const url = normalizeSelorgCdnUrl(sectionName) || sectionName;
        await Banner.updateMany(
          { _id: { $in: bannerIds } },
          { $set: { imageUrl: url, bannerImageUrl: url, isActive: true } },
        );
      }

      const productIds: unknown[] = [];
      const importedSkuCodes: string[] = [];
      if (requiredDetails) {
        const skuRefs = requiredDetails
          .split(/[,\n\r]+/)
          .map((r) => r.trim())
          .filter((r) => /^(S\d+|SKU[-_]?\d+)$/i.test(r))
          .map((r) => r.replace(/^SKU[-_]?/i, 'S'));
        if (skuRefs.length > 0) {
          importedSkuCodes.push(...skuRefs);
          const products = await Product.find({ sku: { $in: skuRefs } }).select('_id sku').lean();
          const bySku = new Map(products.map((p) => [String(p.sku).toUpperCase(), p._id]));
          for (const sku of skuRefs) {
            const id = bySku.get(sku.toUpperCase());
            if (id) productIds.push(id);
          }
        }
      }

      const sectionKey = resolveHomeSectionKey(sectionType, sectionName, matchedCodes.length ? matchedCodes : importedBannerCodes);
      touchedSectionKeys.add(sectionKey);
      const displayTitle = /^https?:\/\//i.test(sectionName) || /^ban-?\d+/i.test(sectionName)
        ? sectionType
        : sectionName;
      const rowOrder = isHeroSection ? 0 : layoutOrder++;
      const payload = {
        sectionKey,
        title: displayTitle || sectionType,
        sectionType: sectionType.toLowerCase().replace(/\s+/g, '_'),
        isActive: true,
        videoUrl: videoLink || '',
        bannerIds,
        productIds,
        importedBannerCodes: matchedCodes.length ? matchedCodes : importedBannerCodes,
        importedSkuCodes,
        rawDetail: requiredDetails || bannerIdCol || null,
        order: rowOrder,
      };
      const existing = await HomeSection.findOne({ sectionKey }).lean();
      if (existing) { await HomeSection.updateOne({ sectionKey }, { $set: payload }); result.updated++; }
      else { await HomeSection.create(payload); result.created++; }

      if (importedBannerCodes.length > 0 && bannerIds.length === 0) {
        result.errors.push({
          row: i + 2,
          ref: sectionType,
          error: `Banner ID(s) ${importedBannerCodes.join(', ')} not found — run Banner Details sheet first`,
        });
      }
    } catch (err) {
      result.errors.push({ row: i + 2, ref: sectionType || sectionName, error: (err as Error).message });
    }
  }

  // Defer soft-deletes + definition sync until finalize activates this version.
  // Failed imports must not hide previous live heroes/sections.
  if (job) {
    job.pendingCleanup = mergeCleanup(job.pendingCleanup, {
      touchedHeroBannerIds: [...touchedHeroBannerIds],
      touchedSectionKeys: [...touchedSectionKeys],
      needsHomeSync: true,
    });
  } else {
    // Legacy path (no job): apply immediately for backward compatibility
    const { Banner: BannerModel } = await import('../banners/banners.model');
    const { HomeSection: HomeSectionModel } = await import('../home/home.models');
    const { syncHomeSectionDefinitionsFromHomeSections } = await import('../home/home.service');
    if (touchedHeroBannerIds.size > 0) {
      await BannerModel.updateMany(
        { slot: 'hero', _id: { $nin: [...touchedHeroBannerIds] } },
        { $set: { isActive: false } },
      );
      await BannerModel.updateMany(
        { bannerId: { $regex: /^Ban-hero-/i }, _id: { $nin: [...touchedHeroBannerIds] } },
        { $set: { isActive: false, slot: 'mid' } },
      );
    }
    if (touchedSectionKeys.size > 0) {
      await HomeSectionModel.updateMany(
        {
          isActive: true,
          sectionKey: { $nin: [...touchedSectionKeys] },
          $or: [
            { sectionKey: { $regex: /^collections_/i } },
            { sectionKey: { $regex: /^banner_/i } },
            { sectionType: { $regex: /collection|hero|banner|deal|product|scroll|promo|moringa|honey/i } },
          ],
        },
        { $set: { isActive: false } },
      );
    }
    try {
      await syncHomeSectionDefinitionsFromHomeSections();
    } catch (err) {
      result.errors.push({ row: 0, ref: 'sync-definitions', error: (err as Error).message });
    }
  }

  return result;
}

/**
 * Resolve L2 category by stable identifiers first; name match only when unique.
 * Returns { cat } | { ambiguous, names } | null
 */
async function resolveLevel2Category(opts: {
  bannerName?: string;
  hierarchyCode?: string;
  categoryId?: string;
}): Promise<
  | { cat: { _id: unknown; name: string; slug: string } }
  | { ambiguous: true; names: string[] }
  | null
> {
  const { Category } = await import('../categories/categories.model');
  const { Product } = await import('../products/products.model');

  if (opts.categoryId && /^[a-f\d]{24}$/i.test(opts.categoryId)) {
    const byId = await Category.findOne({ _id: opts.categoryId, level: 2 }).select('_id name slug').lean();
    if (byId) return { cat: byId };
  }

  if (opts.hierarchyCode) {
    const code = opts.hierarchyCode.trim().toUpperCase();
    const byCodes = await Category.find({
      level: 2,
      hierarchyCodes: { $elemMatch: { $regex: new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
    })
      .select('_id name slug')
      .lean();
    if (byCodes.length === 1) return { cat: byCodes[0]! };
    if (byCodes.length > 1) return { ambiguous: true, names: byCodes.map((c) => String(c.name)) };

    const product = await Product.findOne({
      hierarchyCode: new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })
      .select('subcategoryId')
      .lean();
    if (product?.subcategoryId) {
      const cat = await Category.findOne({ _id: product.subcategoryId, level: 2 }).select('_id name slug').lean();
      if (cat) return { cat };
    }
  }

  const cleaned = (opts.bannerName || '').replace(/\s*\(.*?\)/g, '').replace(/\r?\n/g, ' ').trim();
  if (!cleaned) return null;

  const level2 = await Category.find({ level: 2, isActive: { $ne: false } })
    .select('_id name slug')
    .lean();
  if (!level2.length) return null;

  const exact = level2.filter((c) =>
    new RegExp(`^${cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(String(c.name)),
  );
  if (exact.length === 1) return { cat: exact[0]! };
  if (exact.length > 1) return { ambiguous: true, names: exact.map((c) => String(c.name)) };

  const slug = slugify(cleaned);
  const bySlug = level2.filter((c) => c.slug === slug);
  if (bySlug.length === 1) return { cat: bySlug[0]! };
  if (bySlug.length > 1) return { ambiguous: true, names: bySlug.map((c) => String(c.name)) };

  // Do not fuzzy-link — report as unmatched so operators fix the sheet
  return null;
}

async function processSubcategories(rows: Record<string, unknown>[], job?: Job): Promise<SheetResult> {
  const { Banner } = await import('../banners/banners.model');
  const { Category } = await import('../categories/categories.model');
  const { normalizeSelorgCdnUrl } = await import('../../utils/mediaEnrichment');
  const result = emptyResult(rows.length);
  const touchedCategoryBannerIds = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const bannerIdRaw = cell(row, 'Banner ID', 'Banner Id');

    if (!bannerIdRaw || bannerIdRaw.toLowerCase() === 'banner id' || isTemplateHintValue(bannerIdRaw)) {
      skip(
        result,
        i + 2,
        bannerIdRaw || '(blank)',
        bannerIdRaw.toLowerCase() === 'banner id'
          ? 'Header row'
          : isTemplateHintValue(bannerIdRaw)
            ? 'Template hint/sample row'
            : 'Missing Banner ID',
      );
      continue;
    }

    const bannerUrlRaw = cell(row, 'Sub-Category Banner URL', 'Sub Category Banner URL', 'Banner URL');
    const bannerUrl = normalizeSelorgCdnUrl(bannerUrlRaw) || bannerUrlRaw;
    const bannerName = cell(row, 'Sub-Category Banner Name', 'Sub Category Banner Name', 'Banner Name')
      .replace(/\r?\n/g, ' ')
      .trim();
    const hierarchyCode = cell(row, 'Hierarchy Code', 'Hierarchy Code Ref', 'hierarchyCode');
    const categoryIdCol = cell(row, 'Category ID', 'Category Id', 'categoryId');

    if (!bannerUrl || isTemplateHintValue(bannerUrl) || !/^https?:\/\//i.test(bannerUrl)) {
      skip(result, i + 2, bannerIdRaw, 'Missing or invalid Sub-Category Banner URL');
      continue;
    }

    const videoUrl = cell(row, ' video', 'video', 'Video');
    const youtubeUrl = cell(row, ' youtube video link', 'youtube video link', 'Youtube Video Link');
    const sections: { key: string; value: string }[] = [];
    for (let s = 2; s <= 8; s++) {
      const v = cell(row, `Section ${s}`);
      if (v) sections.push({ key: `section${s}`, value: v });
    }

    try {
      // Never overwrite home hero/mid/large artwork. Subcategory banners get a dedicated
      // document (Ban-XXX-subcat) when the same Ban-ID is already used on the home page.
      const sourceId = bannerIdRaw.replace(/^Ban\s*/i, 'Ban-').replace(/^Ban-+/i, 'Ban-');
      const existingHome = await Banner.findOne({ bannerId: sourceId }).lean();
      const homeLocked = existingHome && ['hero', 'mid', 'large'].includes(String(existingHome.slot));
      const subBannerId = homeLocked ? `${sourceId}-subcat` : sourceId;

      const resolved = await resolveLevel2Category({
        bannerName,
        hierarchyCode,
        categoryId: categoryIdCol,
      });
      if (resolved && 'ambiguous' in resolved) {
        result.errors.push({
          row: i + 2,
          ref: bannerIdRaw,
          error: `Ambiguous category match for "${bannerName || hierarchyCode}": ${resolved.names.join(', ')} — use Hierarchy Code`,
        });
        continue;
      }
      const matchedCat = resolved?.cat ?? null;
      const categoryId = matchedCat?._id || null;

      const bannerPayload: Record<string, unknown> = {
        bannerId: subBannerId,
        bannerImageUrl: bannerUrl,
        imageUrl: bannerUrl,
        title: bannerName || sourceId,
        videoUrl: videoUrl || undefined,
        slot: 'category' as const,
        presentationMode: 'single' as const,
        isNavigable: true,
        isActive: true,
        categoryId,
        inputKeyValuePairs: sections,
      };

      const existingSub = await Banner.findOne({ bannerId: subBannerId }).lean();
      if (existingSub) {
        await Banner.updateOne({ bannerId: subBannerId }, { $set: bannerPayload });
      } else {
        await Banner.create(bannerPayload);
      }
      const saved = await Banner.findOne({ bannerId: subBannerId }).select('_id').lean();
      if (saved) touchedCategoryBannerIds.add(String(saved._id));

      if (matchedCat) {
        await Category.updateOne(
          { _id: matchedCat._id },
          {
            $set: {
              bannerId: subBannerId,
              bannerImage: bannerUrl || undefined,
              bannerVideo: videoUrl || undefined,
              youtubeUrl: youtubeUrl || undefined,
            },
          },
        );
        result.updated++;
      } else if (bannerName || hierarchyCode) {
        skip(
          result,
          i + 2,
          bannerIdRaw,
          `No unique level-2 category for "${bannerName || hierarchyCode}" — use Hierarchy Code or exact name`,
        );
      } else {
        result.created++;
      }
    } catch (err) {
      result.errors.push({ row: i + 2, ref: bannerIdRaw, error: (err as Error).message });
    }
  }

  if (job) {
    job.pendingCleanup = mergeCleanup(job.pendingCleanup, {
      touchedCategoryBannerIds: [...touchedCategoryBannerIds],
      needsSubcatRevision: true,
    });
  } else if (touchedCategoryBannerIds.size > 0) {
    await Banner.updateMany(
      {
        slot: 'category',
        isActive: true,
        _id: { $nin: [...touchedCategoryBannerIds] },
        bannerId: { $regex: /^Ban-\d/i },
      },
      { $set: { isActive: false } },
    );
  }

  return result;
}

/* ══════════════════════════════════════════════════════════════════════
   STEP 1: PREPARE UPLOAD — upload file once, store parsed sheets
══════════════════════════════════════════════════════════════════════ */

export async function prepareUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) throw AppError.badRequest('No file uploaded');
    const ext = req.file.originalname.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(ext ?? '')) {
      throw AppError.badRequest('Invalid Excel file — only .xlsx and .xls files are supported');
    }
    if (!req.file.buffer?.length) {
      throw AppError.badRequest('Invalid Excel file — uploaded file is empty');
    }

    let sheets: Map<string, Record<string, unknown>[]>;
    let headers: Map<string, string[]>;
    try {
      ({ sheets, headers } = await parseAllSheets(req.file.buffer));
    } catch (parseErr) {
      throw AppError.badRequest(
        `Invalid Excel file — could not parse workbook: ${(parseErr as Error).message}`,
      );
    }

    if (sheets.size === 0) {
      throw AppError.badRequest('Invalid Excel file — no sheets found in workbook');
    }

    const structureIssues = validateMasterSheetStructure(sheets, headers);
    const contentIssues = validateMasterSheetContent(sheets, headers);
    // Reject broken structure, empty critical sheets, duplicates, and invalid required values.
    const blockingIssues = [
      ...structureIssues,
      ...contentIssues.filter((i) =>
        i.type === 'empty_sheet' || i.type === 'duplicate' || i.type === 'invalid_rows',
      ),
    ];
    const warnings: StructureValidationIssue[] = [];

    if (blockingIssues.length > 0) {
      const missingSheets = blockingIssues.filter((i) => i.type === 'missing_sheet').map((i) => i.sheet);
      const columnIssues = blockingIssues.filter((i) => i.type === 'missing_columns');
      const otherIssues = blockingIssues.filter(
        (i) => i.type !== 'missing_sheet' && i.type !== 'missing_columns',
      );
      const parts: string[] = [];
      if (missingSheets.length) parts.push(`Missing required sheet(s): ${missingSheets.join(', ')}`);
      if (columnIssues.length) parts.push(columnIssues.map((i) => i.message).join('; '));
      if (otherIssues.length) parts.push(otherIssues.map((i) => i.message).join('; '));
      throw AppError.validation(
        `Master sheet validation failed. ${parts.join(' | ')}`,
        { issues: blockingIssues.slice(0, 40), warnings, sheetsFound: [...sheets.keys()] },
      );
    }

    const versionId = randomUUID();
    const jobId = randomUUID();
    const fileName = req.file.originalname || 'mastersheet.xlsx';
    const sheetsFound = [...sheets.keys()];
    const sheetRowCounts: Record<string, number> = {};
    for (const [name, rows] of sheets) {
      sheetRowCounts[name] = rows.length;
    }

    const { MastersheetVersion } = await import('./mastersheet-version.model');
    await MastersheetVersion.create({
      versionId,
      jobId,
      status: 'importing',
      fileName,
      sheetsFound,
      sheetRowCounts,
      sheets: (Object.keys(SHEET_LABELS) as SheetKey[]).map((sheetKey) => ({
        sheetKey,
        label: SHEET_LABELS[sheetKey],
        status: 'pending',
      })),
      uploadedById: req.user?.userId ?? '',
      uploadedByName: req.user?.name ?? 'Admin',
      uploadedByEmail: req.user?.email ?? '',
    });

    const job: Job = {
      jobId,
      sheets,
      headers,
      createdAt: Date.now(),
      versionId,
      fileName,
      sheetOutcomes: {},
      pendingCleanup: emptyPendingCleanup(),
      status: 'ready',
    };
    jobStore.set(jobId, job);
    await persistJob(job);

    res.status(200).json({
      success: true,
      data: {
        jobId,
        versionId,
        sheetsFound,
        sheetRowCounts,
        validation: {
          ok: true,
          requiredSheets: [...REQUIRED_SHEET_NAMES],
          warnings: warnings.slice(0, 40),
          warningCount: warnings.length,
        },
      },
    });
  } catch (err) { next(err); }
}

/* ══════════════════════════════════════════════════════════════════════
   STEP 2: PROCESS ONE SHEET — called once per sheet from the frontend
══════════════════════════════════════════════════════════════════════ */

const SHEET_NAME_MAP: Record<SheetKey, string> = {
  'sku-master': 'SKU Master',
  'categories': 'Categories',
  'category-display-image': 'Category Display Image',
  'banner-details': 'Banner Details',
  'home-page-content': 'Home Page Content',
  'subcategories': 'Subcategories',
};

export async function processSheetByJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { jobId } = req.query as { jobId: string };
    const sheetKey = req.params['sheet'] as SheetKey;

    if (!jobId) throw AppError.badRequest('Missing jobId query parameter');
    const job = await loadJob(jobId);
    if (!job) throw AppError.badRequest('Job not found or expired — please re-upload the file');
    if (job.status === 'finalized' || job.status === 'failed') {
      throw AppError.badRequest(`Job already ${job.status} — please re-upload to start a new import`);
    }

    const sheetName = SHEET_NAME_MAP[sheetKey];
    if (!sheetName) throw AppError.badRequest(`Unknown sheet key: ${sheetKey}`);

    // Import-order dependency: refuse sheets whose prerequisites failed
    const sheetIndex = PROCESS_SHEET_ORDER.indexOf(sheetKey);
    for (let i = 0; i < sheetIndex; i++) {
      const prev = PROCESS_SHEET_ORDER[i]!;
      const outcome = job.sheetOutcomes[prev];
      if (outcome && outcome.ok === false) {
        throw AppError.validation(
          `Cannot process "${sheetName}" — prerequisite "${SHEET_LABELS[prev]}" failed: ${outcome.error || 'error'}`,
        );
      }
    }

    // Home / Subcategories require Banner Details to have succeeded
    if (
      (sheetKey === 'home-page-content' || sheetKey === 'subcategories') &&
      job.sheetOutcomes['banner-details']?.ok === false
    ) {
      throw AppError.validation(
        `Cannot process "${sheetName}" — Banner Details must succeed first so Ban-* references resolve`,
      );
    }

    const rows = getSheetRows(job.sheets, sheetName);
    if (rows.length === 0 && !findSheetEntry(job.sheets, job.headers, sheetName)) {
      job.sheetOutcomes[sheetKey] = { ok: false, error: `Required sheet "${sheetName}" not found in upload`, missing: true };
      job.status = 'processing';
      await persistJob(job);
      throw AppError.validation(`Required sheet "${sheetName}" not found in upload`);
    }

    job.status = 'processing';
    let result: SheetResult;
    try {
      switch (sheetKey) {
        case 'sku-master':            result = await processSkuMaster(rows); break;
        case 'categories':            result = await processCategories(rows); break;
        case 'category-display-image': result = await processCategoryDisplayImage(rows); break;
        case 'banner-details':        result = await processBannerDetails(rows, job); break;
        case 'home-page-content':     result = await processHomePageContent(rows, job); break;
        case 'subcategories':         result = await processSubcategories(rows, job); break;
        default: throw AppError.badRequest(`Unknown sheet: ${sheetKey}`);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      job.sheetOutcomes[sheetKey] = { ok: false, error: (err as Error).message };
      await persistJob(job);
      const { MastersheetVersion } = await import('./mastersheet-version.model');
      await MastersheetVersion.updateOne(
        { versionId: job.versionId, 'sheets.sheetKey': sheetKey },
        {
          $set: {
            'sheets.$.status': 'error',
            'sheets.$.errorMessage': (err as Error).message,
          },
        },
      );
      throw err;
    }

    job.sheetOutcomes[sheetKey] = { ok: true, result };
    await persistJob(job);

    const { MastersheetVersion } = await import('./mastersheet-version.model');
    await MastersheetVersion.updateOne(
      { versionId: job.versionId, 'sheets.sheetKey': sheetKey },
      {
        $set: {
          'sheets.$.status': 'processed',
          'sheets.$.totalRows': result.totalRows,
          'sheets.$.created': result.created,
          'sheets.$.updated': result.updated,
          'sheets.$.skipped': result.skipped,
          'sheets.$.errorCount': result.errors.length,
        },
      },
    );

    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

/* ══════════════════════════════════════════════════════════════════════
   TEMPLATE DOWNLOAD — single file with all sheets
══════════════════════════════════════════════════════════════════════ */

export async function downloadAllTemplate(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();

    function addSheet(name: string, headers: string[], hints: string[], sample: (string | number)[]) {
      const ws = wb.addWorksheet(name);
      headers.forEach((h, idx) => { ws.getColumn(idx + 1).width = Math.max(h.length + 4, 18); });
      const hRow = ws.addRow(headers);
      hRow.height = 22;
      hRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.alignment = { vertical: 'middle' };
      });
      const hintRow = ws.addRow(hints);
      hintRow.height = 16;
      hintRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        cell.font = { color: { argb: 'FF6B7280' }, size: 9, italic: true };
        cell.alignment = { vertical: 'middle' };
      });
      const sRow = ws.addRow(sample);
      sRow.height = 18;
      sRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEFCE8' } };
        cell.font = { color: { argb: 'FF374151' }, size: 10 };
      });
      ws.views = [{ state: 'frozen', ySplit: 2 }];
    }

    const SKU_HEADERS = [
      'SKU Code','SKU Name','Priority','SKU Classification','SKU Sub-Classification',
      'SKU Source','Similar Products','Primary Vendor','Brand Code','Mfg SKU Code',
      'Size','SKU UOM','Colour','Material','Weight(kg)','Height(cm)','Length(cm)',
      'Width(cm)','Cube','Primary UPC/EAN','Country Of Origin','Hierarchy Code',
      'MSRP/MRP','Sale Price','Base Cost','HSN Code','Tax %','SGST %','CGST %',
      'IGST %','Cess %','SGST Amount (₹)','CGST Amount (₹)','IGST Amount (₹)',
      'Cess Amount (₹)','Price incl. GST (₹)','About','Nutrition','Origin of Place',
      'Health Benefits','Shipping & Returns','SKU Rotation','Rotate By',
      'Receiving Validation Code','Picking Instructions','Shipping Instructions',
      'Threshold Alert Required','Threshold Qty','Shipping Charges','Handling Charges',
      'Is ARS Applicable?','Follow Style','ARS Calculation Method','Fixed Stock',
      'Model Stock','SKUimgURL','Image URL 2','Image URL 3','Image URL 4','Image URL 5',
      'Search Keywords','Order Limit Type','Min Qty Per Order','Max Qty Per Order',
      'Max Weight Per Order','Cart Limit Per Order','Max Order Value','Max Cart Qty',
      'Max Cart Weight','Allow Mixed Pack','Restriction Type','Warehouse Code',
    ];
    const SKU_HINTS = SKU_HEADERS.map((h) =>
      ['SKU Code','SKU Name','Brand Code','SKU UOM','Country Of Origin','Hierarchy Code','MSRP/MRP','Sale Price','Base Cost','HSN Code','Tax %'].includes(h)
        ? 'Mandatory' : 'Optional',
    );
    const SKU_SAMPLE: (string | number)[] = [
      'S10','Papaya - 5 pcs',1,'Style','Organic','','','','Selorg','',
      '5 pcs','EACH','','',0,0,0,0,0,'','India','A01',
      59,49,34.5,'08072000',5,'','','','','','','','','',
      'Soft tropical fruit rich in digestive enzymes','High in vitamin C','Procured from India','Improves digestion','',
      '','','','','','No',0,0,0,'No','','',0,0,
      'https://cdn.selorg.com/img.webp','','','','',
      'papaya,fruit,fresh','Quantity',1,4,'N/A','Yes','N/A',4,'N/A','Yes','Qty','',
    ];
    addSheet('SKU Master', SKU_HEADERS, SKU_HINTS, SKU_SAMPLE);

    addSheet(
      'Categories',
      ['Category','Sub Category','Products','Hierarchy Code'],
      ['Top-level category','Sub-category name','Product name in this sub-category','e.g. A01'],
      ['Fruits','','',''],
    );

    addSheet(
      'Category Display Image',
      ['Category Level','Category Name','Display Image URL','Hierarchy Code Ref'],
      ['Category / Sub Category','e.g. Fruits','https://cdn…/image.webp','Prefer hierarchy code (stable)'],
      ['Category','Fruits','https://cdn.selorg.com/fruits.webp','A01'],
    );

    addSheet(
      'Banner Details',
      ['Banner ID','Banner URL','Banner Type','Banner Name','Banner Size','Name','Section 1','Section 2','Section 3','Section 4','Section 5','Section 6','Section 7','Section 8'],
      ['e.g. Ban-001','https://cdn…/img.webp','clickable / static','Display name','198 H-355 w (Medium)','Optional','Ref','','','','','','',''],
      ['Ban-001','https://cdn.selorg.com/banner.webp','clickable','Native Fruits Promo','198 H-355 w (Medium)','','Ban-002','','','','','','',''],
    );

    addSheet(
      'Home Page Content',
      ['Section Type','Section Name','Required Details','video link'],
      ['e.g. Hero Video','Label or URL','Banner ID or SKU codes','https://youtube.com/…'],
      ['hero section banner','https://cdn.selorg.com/hero.webp','Ban-051',''],
    );

    addSheet(
      'Subcategories',
      ['Banner ID','Sub-Category Banner URL','Sub-Category Banner Name','Hierarchy Code',' video',' youtube video link','Section 2','Section 3','Section 4','Section 5','Section 6','Section 7','Section 8'],
      ['e.g. Ban-001','https://cdn…/img.webp','Exact L2 category name','Prefer hierarchy code','https://cdn…/video.mp4','https://youtube.com/…','','','','','','',''],
      ['Ban-001','https://cdn.selorg.com/native-fruits.webp','Native Fruits','A01','https://cdn.selorg.com/native.mp4','https://youtube.com/shorts/xxx','','','','','','',''],
    );

    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="selorg_mastersheet_template.xlsx"');
    res.send(buf);
  } catch (err) { next(err); }
}

/* ══════════════════════════════════════════════════════════════════════
   FINALIZE / ACTIVATE — only successful imports become active master data
══════════════════════════════════════════════════════════════════════ */

interface FinalizeBody {
  jobId: string;
  fileName?: string;
  sheets?: {
    sheetKey: SheetKey;
    totalRows: number;
    created: number;
    updated: number;
    skipped: number;
    errorCount: number;
    status?: 'done' | 'error' | 'missing';
    error?: string;
  }[];
}

/**
 * Activates a mastersheet version only when all required sheets processed
 * without sheet-level failures. Failed imports remain non-active and do not
 * bump HomeConfig.contentRevision (Web App keeps serving last good revision metadata).
 */
export async function finalizeImport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as FinalizeBody;
    const jobId = body.jobId;
    if (!jobId) throw AppError.badRequest('Missing jobId');

    const job = await loadJob(jobId);
    const { MastersheetVersion } = await import('./mastersheet-version.model');
    const { MastersheetHistory } = await import('./mastersheet-history.model');
    const { MastersheetJob } = await import('./mastersheet-job.model');

    const versionId = job?.versionId;
    if (!job || !versionId) {
      throw AppError.badRequest('Job not found or expired — cannot finalize. Re-upload the file.');
    }

    const version = await MastersheetVersion.findOne({ versionId });
    if (!version) throw AppError.notFound('Mastersheet version', versionId);
    if (version.status === 'active') {
      res.status(200).json({
        success: true,
        data: {
          versionId,
          status: 'active',
          activated: true,
          message: 'Version already active',
        },
      });
      return;
    }

    const sheetSummaries = body.sheets ?? [];
    const criticalKeys: SheetKey[] = [
      'sku-master',
      'categories',
      'banner-details',
      'home-page-content',
      'subcategories',
      'category-display-image',
    ];

    const failedSheets: string[] = [];
    for (const key of criticalKeys) {
      const fromClient = sheetSummaries.find((s) => s.sheetKey === key);
      const fromJob = job.sheetOutcomes[key];
      const clientFailed = fromClient?.status === 'error' || fromClient?.status === 'missing';
      const jobFailed = fromJob && fromJob.ok === false;
      const neverProcessed = !fromJob && (!fromClient || fromClient.status !== 'done');
      if (clientFailed || jobFailed || neverProcessed) {
        failedSheets.push(SHEET_LABELS[key]);
      }
    }

    // Catastrophic: a processed sheet with rows but every row errored and nothing written.
    for (const s of sheetSummaries) {
      if (
        s.status === 'done' &&
        s.totalRows > 0 &&
        s.created === 0 &&
        s.updated === 0 &&
        s.errorCount > 0 &&
        s.errorCount >= s.totalRows
      ) {
        failedSheets.push(`${SHEET_LABELS[s.sheetKey]} (all rows failed)`);
      }
    }

    const uniqueFailed = [...new Set(failedSheets)];
    const activate = uniqueFailed.length === 0;

    const totals = sheetSummaries.reduce(
      (acc, s) => {
        acc.created += s.created ?? 0;
        acc.updated += s.updated ?? 0;
        acc.skipped += s.skipped ?? 0;
        acc.errors += s.errorCount ?? 0;
        return acc;
      },
      { created: 0, updated: 0, skipped: 0, errors: 0 },
    );

    if (sheetSummaries.length) {
      for (const s of sheetSummaries) {
        await MastersheetVersion.updateOne(
          { versionId, 'sheets.sheetKey': s.sheetKey },
          {
            $set: {
              'sheets.$.status':
                s.status === 'missing' ? 'missing' : s.status === 'error' ? 'error' : 'processed',
              'sheets.$.totalRows': s.totalRows,
              'sheets.$.created': s.created,
              'sheets.$.updated': s.updated,
              'sheets.$.skipped': s.skipped,
              'sheets.$.errorCount': s.errorCount,
              'sheets.$.errorMessage': s.error ?? '',
            },
          },
        );
      }
    }

    let contentRevisionAfter: number | null = null;

    if (activate) {
      await MastersheetVersion.updateMany(
        { status: 'active', versionId: { $ne: versionId } },
        { $set: { status: 'superseded' } },
      );

      // Soft-deactivate superseded banners/sections + bump contentRevision only on success
      try {
        contentRevisionAfter = await applyDeferredCleanup(job);
        if (contentRevisionAfter == null) {
          const { bumpHomeContentRevision } = await import('../home/home.service');
          const cfg = await bumpHomeContentRevision(`mastersheet-version:${versionId}`);
          contentRevisionAfter =
            typeof cfg?.contentRevision === 'number' ? cfg.contentRevision : null;
        }
      } catch {
        /* non-fatal — row data already in DB */
      }

      await MastersheetVersion.updateOne(
        { versionId },
        {
          $set: {
            status: 'active',
            activatedAt: new Date(),
            failureReason: '',
            contentRevisionAfter,
            fileName: body.fileName || job.fileName || version.fileName,
            totalCreated: totals.created,
            totalUpdated: totals.updated,
            totalSkipped: totals.skipped,
            totalErrors: totals.errors,
            totalRecords: totals.created + totals.updated,
          },
        },
      );
      job.status = 'finalized';
    } else {
      const failureReason = `Import not activated — failed/missing sheets: ${uniqueFailed.join(', ')}. Previous active master data remains the source of truth for contentRevision.`;
      await MastersheetVersion.updateOne(
        { versionId },
        {
          $set: {
            status: 'failed',
            failedAt: new Date(),
            failureReason,
            fileName: body.fileName || job.fileName || version.fileName,
            totalCreated: totals.created,
            totalUpdated: totals.updated,
            totalSkipped: totals.skipped,
            totalErrors: totals.errors,
          },
        },
      );
      job.status = 'failed';
    }

    await MastersheetHistory.create({
      versionId,
      uploadedAt: new Date(),
      uploadedById: req.user?.userId ?? '',
      uploadedByName: req.user?.name ?? 'Admin',
      uploadedByEmail: req.user?.email ?? '',
      fileName: body.fileName || job.fileName || version.fileName,
      status: activate ? 'active' : 'failed',
      isActive: activate,
      sheetsProcessed: sheetSummaries.filter((s) => s.status === 'done').length,
      totalCreated: totals.created,
      totalUpdated: totals.updated,
      totalSkipped: totals.skipped,
      totalErrors: totals.errors,
      totalRecords: totals.created + totals.updated + totals.skipped,
      failureReason: activate ? '' : `Failed/missing: ${uniqueFailed.join(', ')}`,
      sheets: sheetSummaries.map((s) => ({
        sheetKey: s.sheetKey,
        label: SHEET_LABELS[s.sheetKey] ?? s.sheetKey,
        status: s.status === 'missing' ? 'missing' : s.status === 'error' ? 'error' : 'processed',
        totalRows: s.totalRows,
        created: s.created,
        updated: s.updated,
        skipped: s.skipped,
        errorCount: s.errorCount,
        errorMessage: s.error ?? '',
      })),
    });

    if (activate) {
      await MastersheetHistory.updateMany(
        { isActive: true, versionId: { $ne: versionId } },
        { $set: { isActive: false, status: 'superseded' } },
      );
    }

    await persistJob(job);
    jobStore.delete(jobId);
    await MastersheetJob.deleteOne({ jobId }).catch(() => {});

    res.status(activate ? 200 : 422).json({
      success: activate,
      data: {
        versionId,
        status: activate ? 'active' : 'failed',
        activated: activate,
        contentRevision: contentRevisionAfter,
        totals,
        failedSheets: uniqueFailed,
        message: activate
          ? 'Master sheet import activated — Web App will serve this database data.'
          : `Import stored as failed and was not activated. ${uniqueFailed.join(', ')}`,
      },
      ...(activate
        ? {}
        : {
            message: `Import not activated — failed/missing sheets: ${uniqueFailed.join(', ')}`,
          }),
    });
  } catch (err) { next(err); }
}

export async function getActiveVersion(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { MastersheetVersion } = await import('./mastersheet-version.model');
    const active = await MastersheetVersion.findOne({ status: 'active' })
      .sort({ activatedAt: -1 })
      .lean();
    res.status(200).json({
      success: true,
      data: active
        ? {
            versionId: active.versionId,
            status: active.status,
            fileName: active.fileName,
            activatedAt: active.activatedAt,
            contentRevisionAfter: active.contentRevisionAfter,
            sheets: active.sheets,
            uploadedByName: active.uploadedByName,
          }
        : null,
    });
  } catch (err) { next(err); }
}

/* ══════════════════════════════════════════════════════════════════════
   HISTORY — save after all sheets done, fetch for the history panel
══════════════════════════════════════════════════════════════════════ */

interface SaveHistoryBody {
  fileName: string;
  sheets: {
    sheetKey: SheetKey;
    totalRows: number;
    created: number;
    updated: number;
    skipped: number;
    errorCount: number;
  }[];
}

export async function saveHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { MastersheetHistory } = await import('./mastersheet-history.model');
    const body = req.body as SaveHistoryBody;

    if (!Array.isArray(body?.sheets) || body.sheets.length === 0) {
      throw AppError.badRequest('sheets (non-empty array) is required');
    }

    const totalCreated  = body.sheets.reduce((s, r) => s + (r.created  ?? 0), 0);
    const totalUpdated  = body.sheets.reduce((s, r) => s + (r.updated  ?? 0), 0);
    const totalSkipped  = body.sheets.reduce((s, r) => s + (r.skipped  ?? 0), 0);
    const totalErrors   = body.sheets.reduce((s, r) => s + (r.errorCount ?? 0), 0);

    await MastersheetHistory.create({
      uploadedAt: new Date(),
      uploadedById:    req.user?.userId   ?? '',
      uploadedByName:  req.user?.name     ?? 'Admin',
      uploadedByEmail: req.user?.email    ?? '',
      fileName: body.fileName ?? 'mastersheet.xlsx',
      sheetsProcessed: body.sheets.length,
      totalCreated, totalUpdated, totalSkipped, totalErrors,
      sheets: body.sheets.map((s) => ({
        sheetKey:   s.sheetKey,
        label:      SHEET_LABELS[s.sheetKey] ?? s.sheetKey,
        totalRows:  s.totalRows,
        created:    s.created,
        updated:    s.updated,
        skipped:    s.skipped,
        errorCount: s.errorCount,
      })),
    });

    res.status(201).json({ success: true, data: { saved: true } });
  } catch (err) { next(err); }
}

export async function getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { MastersheetHistory } = await import('./mastersheet-history.model');
    const limit = Math.min(Number(req.query['limit'] ?? 20), 50);

    const records = await MastersheetHistory.find()
      .sort({ uploadedAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({ success: true, data: records });
  } catch (err) { next(err); }
}
