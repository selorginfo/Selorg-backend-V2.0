/**
 * One-shot backfill: normalize Selorg CDN URLs, migrate legacy hero HomeSection
 * keys, restore hero slots, and sync HomeSectionDefinitions from HomeSections.
 *
 * Run: node --dns-result-order=ipv4first scripts/_backfill_home_from_mastersheet.js
 */
const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();

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

async function normalizeCollection(db, name, fields) {
  const docs = await db.collection(name).find({}).project(
    Object.fromEntries(fields.map((f) => [f, 1])),
  ).toArray();
  let updated = 0;
  for (const doc of docs) {
    const $set = {};
    for (const f of fields) {
      const v = doc[f];
      if (typeof v === 'string' && v.includes('http')) {
        const n = normalizeSelorgCdnUrl(v);
        if (n && n !== v) $set[f] = n;
      }
      if (f === 'images' && Array.isArray(v)) {
        const next = v.map((u) => (typeof u === 'string' ? normalizeSelorgCdnUrl(u) || u : u));
        if (JSON.stringify(next) !== JSON.stringify(v)) $set.images = next;
      }
    }
    // Ensure banners expose imageUrl when only bannerImageUrl is set
    if (name === 'customer_banners') {
      const img = $set.imageUrl || doc.imageUrl;
      const ban = $set.bannerImageUrl || doc.bannerImageUrl;
      if ((!img || !String(img).trim()) && ban) $set.imageUrl = ban;
      if ((!ban || !String(ban).trim()) && img) $set.bannerImageUrl = img;
    }
    if (Object.keys($set).length) {
      await db.collection(name).updateOne({ _id: doc._id }, { $set });
      updated++;
    }
  }
  return updated;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const bannersFixed = await normalizeCollection(db, 'customer_banners', ['imageUrl', 'bannerImageUrl', 'thumbnailUrl']);
  const catsFixed = await normalizeCollection(db, 'customer_categories', ['imageUrl', 'cardImageUrl', 'thumbnailUrl', 'bannerImage']);
  const productsFixed = await normalizeCollection(db, 'customer_products', ['imageUrl', 'cardImageUrl', 'thumbnailUrl', 'images']);

  // Migrate legacy URL-slugged hero HomeSection → hero_banner
  const legacyHero = await db.collection('customer_home_sections').find({
    $or: [
      { sectionKey: { $regex: /^hero-section-banner_/i } },
      { sectionType: { $regex: /hero/i }, sectionKey: { $ne: 'hero_banner' } },
    ],
  }).toArray();

  let heroBannerIds = [];
  for (const s of legacyHero) {
    heroBannerIds.push(...(s.bannerIds || []));
    if (s.sectionKey !== 'hero_banner') {
      const existing = await db.collection('customer_home_sections').findOne({ sectionKey: 'hero_banner' });
      if (existing) {
        const mergedBanners = [...new Set([...(existing.bannerIds || []).map(String), ...(s.bannerIds || []).map(String)])];
        await db.collection('customer_home_sections').updateOne(
          { _id: existing._id },
          {
            $set: {
              title: 'Featured Offers',
              sectionType: 'hero_section_banner',
              bannerIds: mergedBanners.map((id) => new mongoose.Types.ObjectId(id)),
              importedBannerCodes: [...new Set([...(existing.importedBannerCodes || []), ...(s.importedBannerCodes || [])])],
              isActive: true,
              order: 0,
            },
          },
        );
        await db.collection('customer_home_sections').deleteOne({ _id: s._id });
      } else {
        await db.collection('customer_home_sections').updateOne(
          { _id: s._id },
          { $set: { sectionKey: 'hero_banner', title: 'Featured Offers', order: 0 } },
        );
      }
    }
  }

  // Restore hero slot on banners referenced by hero HomeSection + Ban-051 from import
  const heroSection = await db.collection('customer_home_sections').findOne({ sectionKey: 'hero_banner' });
  if (heroSection?.bannerIds?.length) {
    await db.collection('customer_banners').updateMany(
      { _id: { $in: heroSection.bannerIds } },
      { $set: { slot: 'hero', presentationMode: 'carousel' } },
    );
  }
  if (heroSection?.importedBannerCodes?.length) {
    await db.collection('customer_banners').updateMany(
      { bannerId: { $in: heroSection.importedBannerCodes } },
      { $set: { slot: 'hero' } },
    );
  }
  // Explicit Ban-051 from mastersheet Required Details
  await db.collection('customer_banners').updateOne({ bannerId: 'Ban-051' }, { $set: { slot: 'hero' } });

  // Sync definitions from home sections (inline minimal port of service logic)
  const homeSections = await db.collection('customer_home_sections').find({ isActive: true }).sort({ order: 1 }).toArray();
  const desired = [];
  let order = 0;
  desired.push({ key: 'categories', label: 'Shop by Category', type: 'super_category', order: order++, bannerIds: [] });

  function mapSection(section, ord) {
    const st = String(section.sectionType || '').toLowerCase();
    const key = String(section.sectionKey || '');
    const title = String(section.title || key);
    const hasProducts = Array.isArray(section.productIds) && section.productIds.length > 0;
    const hasBanners = Array.isArray(section.bannerIds) && section.bannerIds.length > 0;
    if (/hero/.test(st) || /hero/.test(key) || key === 'hero_banner') {
      return { key: 'hero_banner', label: 'Featured Offers', type: 'banner_main', order: 0, bannerIds: section.bannerIds || [] };
    }
    if (/categor/.test(st) || key === 'categories') {
      return { key: 'categories', label: title || 'Shop by Category', type: 'super_category', order: ord, bannerIds: [] };
    }
    if (hasBanners && !hasProducts) {
      if (/^https?:\/\//i.test(title)) return null;
      return { key, label: title, type: 'banner_sub', order: ord, bannerIds: section.bannerIds || [] };
    }
    if (hasProducts || /collection|deal|product|seller|arrival/.test(st) || key.startsWith('collections_')) {
      return { key, label: title, type: null, order: ord, bannerIds: [] };
    }
    return null;
  }

  for (const section of homeSections) {
    const mapped = mapSection(section, order);
    if (!mapped) continue;
    if (mapped.key === 'categories') continue;
    const idx = desired.findIndex((d) => d.key === mapped.key);
    if (idx >= 0) {
      if (mapped.bannerIds?.length) {
        const ids = new Set([...(desired[idx].bannerIds || []).map(String), ...mapped.bannerIds.map(String)]);
        desired[idx].bannerIds = [...ids].map((id) => new mongoose.Types.ObjectId(id));
      }
      continue;
    }
    desired.push({
      ...mapped,
      order: mapped.key === 'hero_banner' ? 0 : order++,
      bannerIds: (mapped.bannerIds || []).map((id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id))),
    });
  }

  desired.sort((a, b) => {
    if (a.key === 'hero_banner') return -1;
    if (b.key === 'hero_banner') return 1;
    if (a.key === 'categories') return -1;
    if (b.key === 'categories') return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
  desired.forEach((d, i) => { d.order = i; });

  for (const def of desired) {
    await db.collection('customer_home_section_definitions').updateOne(
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
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date(), taglineText: '', categoryIds: [], bannerId: null, collectionId: null },
      },
      { upsert: true },
    );
  }

  // Drop stale placeholder product defs if mastersheet collections are present
  const hasCollections = desired.some((d) => String(d.key).startsWith('collections_'));
  if (hasCollections) {
    await db.collection('customer_home_section_definitions').deleteMany({
      key: { $in: ['bestsellers', 'new_arrivals', 'deals', 'new_deals'] },
    });
  }

  const defs = await db.collection('customer_home_section_definitions').find({}).sort({ order: 1 }).toArray();
  const heroBanners = await db.collection('customer_banners').find({ slot: 'hero', isActive: true }).project({ bannerId: 1, imageUrl: 1 }).toArray();

  console.log(JSON.stringify({
    bannersFixed, catsFixed, productsFixed,
    legacyHeroMigrated: legacyHero.length,
    definitions: defs.map((d) => ({ key: d.key, type: d.type, order: d.order, banners: (d.bannerIds || []).length })),
    heroBanners: heroBanners.map((b) => ({ id: b.bannerId, url: String(b.imageUrl || '').slice(0, 80) })),
  }, null, 2));

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
