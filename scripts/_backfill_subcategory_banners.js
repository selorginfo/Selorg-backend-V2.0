/**
 * Backfill: link existing L2 Category.bannerImage rows to slot=category Banner docs
 * with categoryId set — without overwriting home hero/mid banners.
 *
 * Run: node --dns-result-order=ipv4first scripts/_backfill_subcategory_banners.js
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

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const l2 = await db
    .collection('customer_categories')
    .find({ level: 2, bannerImage: { $exists: true, $nin: [null, ''] } })
    .toArray();

  let created = 0;
  let updated = 0;
  let normalized = 0;

  for (const cat of l2) {
    const url = normalizeSelorgCdnUrl(cat.bannerImage) || cat.bannerImage;
    if (url !== cat.bannerImage) {
      await db.collection('customer_categories').updateOne({ _id: cat._id }, { $set: { bannerImage: url } });
      normalized++;
    }

    const bannerId = `Ban-subcat-${slugify(cat.slug || cat.name)}`;
    const existing = await db.collection('customer_banners').findOne({ bannerId });
    const payload = {
      bannerId,
      imageUrl: url,
      bannerImageUrl: url,
      title: cat.name,
      slot: 'category',
      presentationMode: 'single',
      isNavigable: true,
      isActive: true,
      categoryId: cat._id,
      updatedAt: new Date(),
    };
    if (existing) {
      await db.collection('customer_banners').updateOne({ bannerId }, { $set: payload });
      updated++;
    } else {
      await db.collection('customer_banners').insertOne({
        ...payload,
        siteId: null,
        bannerType: 'clickable',
        contentItems: [],
        inputKeyValuePairs: [],
        order: 0,
        createdAt: new Date(),
      });
      created++;
    }
  }

  // Deactivate hero banners that are clearly subcategory art wrongly left on hero
  // (only if they also have a matching -subcat sibling — leave Ban-hero-* alone)
  const heroes = await db.collection('customer_banners').find({ slot: 'hero', isActive: true }).toArray();
  let demoted = 0;
  for (const h of heroes) {
    if (String(h.bannerId || '').startsWith('Ban-hero-')) continue;
    const sibling = await db.collection('customer_banners').findOne({
      bannerId: `${h.bannerId}-subcat`,
    });
    // If this hero Ban-* also exists as a pure category banner with same URL elsewhere, keep it —
    // only demote when categoryId is set (shouldn't be on heroes after our fix).
    if (h.categoryId) {
      await db.collection('customer_banners').updateOne({ _id: h._id }, { $set: { slot: 'category', isActive: true } });
      demoted++;
    }
    void sibling;
  }

  await db.collection('customer_home_configs').updateOne(
    { key: 'main' },
    {
      $inc: { contentRevision: 1 },
      $set: { lastMastersheetSyncAt: new Date(), lastMastersheetSyncSource: 'backfill-subcategory-banners' },
      $setOnInsert: { key: 'main' },
    },
    { upsert: true },
  );

  console.log(JSON.stringify({ l2: l2.length, created, updated, normalized, demoted }, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
