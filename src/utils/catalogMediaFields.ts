/** Shared helpers for Category/SubCategory media fields and MaxOrderLimit on API payloads. */

import { normalizeSelorgCdnUrl } from './mediaEnrichment';

function cleanMediaUrl(v: unknown): string | null {
  const raw = String(v || '').trim();
  if (!raw) return null;
  return normalizeSelorgCdnUrl(raw) || raw;
}

export function pickCategoryMediaFields(doc: Record<string, unknown> = {}) {
  return {
    bannerImage: cleanMediaUrl(doc.bannerImage),
    bannerId: String(doc.bannerId || '').trim() || null,
    bannerVideo: cleanMediaUrl(doc.bannerVideo),
    youtubeUrl: String(doc.youtubeUrl || '').trim() || null,
  };
}

/** Master Sheet MaxOrderLimit -> API number | null (null = unlimited). */
export function pickMaxOrderLimit(doc: Record<string, unknown> = {}): number | null {
  const raw = doc.maxOrderLimit;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}
