/**
 * Customer app image contract: mobile/web clients prefer smaller display URLs when present
 * (thumbnailUrl -> cardImageUrl -> imageUrl -> images[0] for categories/products; for
 * banners: bannerImageUrl -> thumbnailUrl -> imageUrl). When the DB only has imageUrl, these
 * helpers duplicate it into the other keys so the contract stays stable.
 */

/** Stub/placeholder image hosts (seed data, not real CDN assets) that clients can't reliably load. */
export function isStubImageUrl(url?: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('local://')) return true;
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    return host === 'placehold.co' || host.endsWith('.placehold.co') || host === 'via.placeholder.com' || host === 'placeholder.com' || host.endsWith('.placeholder.com');
  } catch {
    return /placehold\.co|via\.placeholder\.com|placeholder\.com/i.test(trimmed);
  }
}

export function pickFirstNonStubString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() && !isStubImageUrl(v)) return v.trim();
  }
  return '';
}

/**
 * Selorg's CloudFront/S3 object keys use literal `+` for spaces. Master-sheet / Excel
 * imports often store the same path with `%20` or real spaces, which 404 on CDN.
 * Normalize path segments so spaces become `+` while leaving other encoding intact.
 */
export function normalizeSelorgCdnUrl(url: string): string {
  if (typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    if (!/cloudfront\.net|amazonaws\.com/i.test(u.hostname)) return trimmed;
    u.pathname = u.pathname
      .split('/')
      .map((seg) => {
        if (!seg) return seg;
        let decoded = seg;
        try {
          // Keep literal '+' in the key (do not treat path '+' as space).
          decoded = decodeURIComponent(seg.replace(/\+/g, '%2B'));
        } catch {
          decoded = seg.replace(/%20/gi, ' ');
        }
        return encodeURIComponent(decoded).replace(/%20/g, '+').replace(/%2B/gi, '+');
      })
      .join('/');
    return u.toString();
  } catch {
    return trimmed.replace(/%20/gi, '+');
  }
}

/** Removes resize query params that break static CloudFront asset URLs. */
function cleanClientImageUrl(url: string): string {
  if (typeof url !== 'string' || !url.trim()) return '';
  const trimmed = normalizeSelorgCdnUrl(url.trim()) || url.trim();
  try {
    const u = new URL(trimmed);
    const path = u.pathname.toLowerCase();
    const isStaticAsset = /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(path);
    const isCdnHost = u.hostname.includes('cloudfront.net') || u.hostname.includes('amazonaws.com') || path.includes('/prod/products/');
    if (isStaticAsset || isCdnHost) {
      u.searchParams.delete('q');
      u.searchParams.delete('w');
      const qs = u.searchParams.toString();
      u.search = qs ? `?${qs}` : '';
      return u.toString().replace(/\?$/, '');
    }
    return u.toString();
  } catch {
    return trimmed.replace(/([?&])q=\d*(&|$)/gi, '$2').replace(/([?&])w=\d*(&|$)/gi, '$2').replace(/\?&/, '?').replace(/[?&]$/, '');
  }
}

export function sanitizeImageFields<T extends Record<string, unknown>>(doc: T): T {
  if (!doc || typeof doc !== 'object') return doc;
  const out: Record<string, unknown> = { ...doc };
  for (const key of ['thumbnailUrl', 'cardImageUrl', 'imageUrl', 'bannerImageUrl', 'bannerImage', 'bannerVideo']) {
    if (isStubImageUrl(out[key])) {
      out[key] = '';
    } else if (typeof out[key] === 'string' && (out[key] as string).trim()) {
      out[key] = cleanClientImageUrl(out[key] as string);
    }
  }
  if (Array.isArray(out.images)) {
    out.images = (out.images as unknown[]).filter((u): u is string => typeof u === 'string' && u.trim().length > 0 && !isStubImageUrl(u)).map((u) => cleanClientImageUrl(u));
  }
  return out as T;
}

export function enrichCategory<T extends Record<string, unknown>>(doc: T): T {
  if (!doc || typeof doc !== 'object') return doc;
  const base = sanitizeImageFields(doc);
  const primary = pickFirstNonStubString(base.thumbnailUrl, base.cardImageUrl, base.imageUrl);
  const bannerImage = pickFirstNonStubString(base.bannerImage) || '';
  return {
    ...base,
    thumbnailUrl: primary,
    cardImageUrl: pickFirstNonStubString(base.cardImageUrl, base.thumbnailUrl, base.imageUrl) || primary,
    bannerImage: bannerImage || (base.bannerImage as string) || '',
  };
}

export function enrichProduct<T extends Record<string, unknown>>(doc: T): T {
  if (!doc || typeof doc !== 'object') return doc;
  const base = sanitizeImageFields(doc);
  const images = base.images as unknown;
  const img0 = Array.isArray(images) && images.length > 0 && typeof images[0] === 'string' ? (images[0] as string).trim() : '';
  const primary = pickFirstNonStubString(base.thumbnailUrl, base.cardImageUrl, base.imageUrl, img0);
  return {
    ...base,
    thumbnailUrl: primary,
    cardImageUrl: pickFirstNonStubString(base.cardImageUrl, base.thumbnailUrl, base.imageUrl, img0) || primary,
    imageUrl: isStubImageUrl(base.imageUrl) ? '' : base.imageUrl,
  };
}

export function enrichBanner<T extends Record<string, unknown>>(doc: T): T {
  if (!doc || typeof doc !== 'object') return doc;
  const base = sanitizeImageFields(doc);
  const wide = pickFirstNonStubString(base.bannerImageUrl, base.thumbnailUrl, base.imageUrl);
  const thumb = pickFirstNonStubString(base.thumbnailUrl, base.bannerImageUrl, base.imageUrl);
  // Web home (and most clients) read `imageUrl` only — keep it populated from bannerImageUrl.
  const imageUrl = pickFirstNonStubString(base.imageUrl, base.bannerImageUrl, base.thumbnailUrl) || wide;
  return { ...base, imageUrl, bannerImageUrl: wide || imageUrl, thumbnailUrl: thumb || wide || imageUrl };
}
