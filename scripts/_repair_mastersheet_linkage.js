/**
 * One-shot repair after Master Sheet linkage bugs:
 * - Hero: keep only Ban-* from HomeSection.importedBannerCodes (drop Ban-hero-* synthetics)
 * - Relink orphan slot=category banners → level-2 categories (fuzzy name match)
 * - Persist Category.bannerId + bannerImage
 * - Normalize product CDN URLs (%20 → +)
 * - Bump home contentRevision
 *
 * Run: node --dns-result-order=ipv4first scripts/_repair_mastersheet_linkage.js
 */
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');

function normalizeSelorgCdnUrl(url) {
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

function normalizeMatchName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\r?\n/g, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(promotional|promo|header|banner|spl|special|title|description)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(value) {
  const stop = new Set([
    'and', 'or', 'the', 'of', 'for', 'a', 'an',
    'vegetables', 'vegetable', 'fruits', 'fruit', 'products', 'product',
  ]);
  return normalizeMatchName(value).split(' ').filter((t) => t.length > 2 && !stop.has(t));
}

function tokenMatchScore(a, b) {
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

const ALIASES = [
  { banner: /\bbanana\b/i, category: /^banana varieties$/i },
  { banner: /\b(high\s*nutrition|highly\s*nutrit)/i, category: /^highly nutritious fruits$/i },
  { banner: /\bmango/i, category: /^mango varieties$/i },
  { banner: /\bessential/i, category: /^daily essentials$/i },
  { banner: /\bclimber/i, category: /^climbers$/i },
  { banner: /\bgreens?\b.*\bherbs?\b|\bherbs?\b.*\bgreens?\b/i, category: /^greens\s*(&|and)\s*herbs$/i },
];

function scoreMatch(bannerName, categoryName) {
  const bn = normalizeMatchName(bannerName);
  const cn = normalizeMatchName(categoryName);
  if (!bn || !cn) return 0;
  if (bn === cn) return 1;
  if (bn.includes(cn) || cn.includes(bn)) return 0.92;
  for (const alias of ALIASES) {
    if (alias.banner.test(bannerName) && alias.category.test(categoryName)) return 0.9;
  }
  return tokenMatchScore(bannerName, categoryName);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  // ── 1. Hero: Ban-* from importedBannerCodes only ──────────────────────────
  const heroSection = await db.collection('customer_home_sections').findOne({ sectionKey: 'hero_banner' });
  let heroFixed = 0;
  if (heroSection) {
    const codes = (heroSection.importedBannerCodes || []).map(String).filter(Boolean);
    const candidates = new Set();
    for (const code of codes) {
      const normalized = code.replace(/^Ban\s*/i, 'Ban-').replace(/^Ban-+/i, 'Ban-');
      const padded = normalized
        .replace(/^Ban-0*/i, 'Ban-')
        .replace(/^Ban-(\d)$/, 'Ban-00$1')
        .replace(/^Ban-(\d\d)$/, 'Ban-0$1');
      [code, normalized, padded].forEach((c) => candidates.add(c));
    }
    const banners = await db.collection('customer_banners')
      .find({ bannerId: { $in: [...candidates] } })
      .project({ _id: 1, bannerId: 1 })
      .toArray();
    const ids = banners.map((b) => b._id);
    if (ids.length) {
      await db.collection('customer_home_sections').updateOne(
        { _id: heroSection._id },
        { $set: { bannerIds: ids, isActive: true, order: 0 } },
      );
      await db.collection('customer_banners').updateMany(
        { _id: { $in: ids } },
        { $set: { slot: 'hero', isActive: true, presentationMode: 'carousel' } },
      );
      await db.collection('customer_banners').updateMany(
        { slot: 'hero', _id: { $nin: ids } },
        { $set: { isActive: false } },
      );
      await db.collection('customer_banners').updateMany(
        { bannerId: { $regex: /^Ban-hero-/i }, _id: { $nin: ids } },
        { $set: { isActive: false, slot: 'mid' } },
      );
      await db.collection('customer_home_section_definitions').updateOne(
        { key: 'hero_banner' },
        {
          $set: {
            bannerIds: ids,
            type: 'banner_main',
            label: 'Featured Offers',
            bannerSelectionMode: ids.length > 1 ? 'multiple' : 'single',
            useCarousel: true,
            order: 0,
          },
        },
        { upsert: true },
      );
      heroFixed = ids.length;
    }
  }

  // ── 2. Relink orphan category banners ─────────────────────────────────────
  const level2 = await db.collection('customer_categories')
    .find({ level: 2 })
    .project({ _id: 1, name: 1, slug: 1, bannerImage: 1, bannerId: 1 })
    .toArray();

  const orphans = await db.collection('customer_banners')
    .find({
      slot: 'category',
      isActive: true,
      $or: [{ categoryId: null }, { categoryId: { $exists: false } }],
    })
    .toArray();

  let linked = 0;
  let skipped = 0;
  const usedCategoryIds = new Set();

  for (const b of orphans) {
    const title = String(b.title || '').replace(/\r?\n/g, ' ').trim();
    if (!title || /^Ban-\d/i.test(title) || /title\s*,\s*description/i.test(title)) {
      skipped += 1;
      continue;
    }
    const scored = level2
      .map((c) => ({ cat: c, score: scoreMatch(title, c.name) }))
      .filter((x) => x.score >= 0.55)
      .sort((a, b2) => {
        if (b2.score !== a.score) return b2.score - a.score;
        return String(b2.cat.name).length - String(a.cat.name).length;
      });
    const best = scored[0];
    if (!best) {
      skipped += 1;
      continue;
    }
    // Prefer unmatched categories; allow overwrite if score is very high.
    if (usedCategoryIds.has(String(best.cat._id)) && best.score < 0.9) {
      skipped += 1;
      continue;
    }
    usedCategoryIds.add(String(best.cat._id));
    const imageUrl = normalizeSelorgCdnUrl(b.imageUrl || b.bannerImageUrl || '') || b.imageUrl || b.bannerImageUrl;
    await db.collection('customer_banners').updateOne(
      { _id: b._id },
      {
        $set: {
          categoryId: best.cat._id,
          imageUrl,
          bannerImageUrl: imageUrl,
          title: title,
          isActive: true,
        },
      },
    );
    await db.collection('customer_categories').updateOne(
      { _id: best.cat._id },
      {
        $set: {
          bannerId: b.bannerId || '',
          bannerImage: imageUrl || best.cat.bannerImage || '',
        },
      },
    );
    linked += 1;
  }

  // ── 3. Normalize product image URLs ───────────────────────────────────────
  const products = await db.collection('customer_products')
    .find({ imageUrl: /%20| / })
    .project({ imageUrl: 1, images: 1, thumbnailUrl: 1, cardImageUrl: 1 })
    .toArray();
  let productsFixed = 0;
  for (const p of products) {
    const $set = {};
    for (const f of ['imageUrl', 'thumbnailUrl', 'cardImageUrl']) {
      if (typeof p[f] === 'string' && p[f].includes('http')) {
        const n = normalizeSelorgCdnUrl(p[f]);
        if (n && n !== p[f]) $set[f] = n;
      }
    }
    if (Array.isArray(p.images)) {
      const next = p.images.map((u) => (typeof u === 'string' ? normalizeSelorgCdnUrl(u) || u : u));
      if (JSON.stringify(next) !== JSON.stringify(p.images)) $set.images = next;
    }
    if (Object.keys($set).length) {
      await db.collection('customer_products').updateOne({ _id: p._id }, { $set });
      productsFixed += 1;
    }
  }

  // ── 4. Bump revision ──────────────────────────────────────────────────────
  await db.collection('customer_home_configs').updateOne(
    { key: 'main' },
    {
      $inc: { contentRevision: 1 },
      $set: {
        lastMastersheetSyncAt: new Date(),
        lastMastersheetSyncSource: 'repair-mastersheet-linkage',
      },
      $setOnInsert: { key: 'main' },
    },
    { upsert: true },
  );

  const heroNow = await db.collection('customer_banners')
    .find({ slot: 'hero', isActive: true })
    .project({ bannerId: 1, imageUrl: 1 })
    .toArray();
  const stillOrphan = await db.collection('customer_banners').countDocuments({
    slot: 'category',
    isActive: true,
    $or: [{ categoryId: null }, { categoryId: { $exists: false } }],
  });
  const pct20 = await db.collection('customer_products').countDocuments({ imageUrl: /%20/ });

  console.log(JSON.stringify({
    heroFixed,
    heroBanners: heroNow.map((b) => ({ id: b.bannerId, url: String(b.imageUrl || '').slice(0, 90) })),
    subcategoryLinked: linked,
    subcategorySkipped: skipped,
    stillOrphanCategoryBanners: stillOrphan,
    productsFixed,
    productsStillPct20: pct20,
  }, null, 2));

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
