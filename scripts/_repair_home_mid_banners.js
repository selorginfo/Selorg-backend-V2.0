/**
 * Wire home mid/large/scroll banners that exist in Banner Details but were never
 * linked from Home Page Content (skipped rows / missing Section Name).
 *
 * Uses Banner IDs already in DB under the home-page asset set — not hardcoded URLs.
 * Re-upload Master Sheet after the importer fix for a full sheet-driven sync.
 *
 * Run: node --dns-result-order=ipv4first scripts/_repair_home_mid_banners.js
 */
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  async function ban(id) {
    return db.collection('customer_banners').findOne({ bannerId: id });
  }

  async function upsertSection({ key, title, sectionType, bannerIds, codes, order }) {
    const ids = bannerIds.filter(Boolean);
    if (!ids.length) return null;
    await db.collection('customer_home_sections').updateOne(
      { sectionKey: key },
      {
        $set: {
          sectionKey: key,
          title,
          sectionType,
          isActive: true,
          bannerIds: ids,
          productIds: [],
          importedBannerCodes: codes,
          importedSkuCodes: [],
          rawDetail: codes.join(','),
          order,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date(), videoUrl: '' },
      },
      { upsert: true },
    );
    return { key, title, n: ids.length, codes };
  }

  const moringa = await ban('Ban-052');
  const honey = await ban('Ban-031'); // titled Honey in Banner Details
  const scrollSmall = await ban('Ban-045');
  const scrollMid = [];
  for (const id of ['Ban-046', 'Ban-047', 'Ban-048']) {
    const b = await ban(id);
    if (b) scrollMid.push(b);
  }

  const created = [];
  if (moringa) {
    created.push(await upsertSection({
      key: 'banner_moringa_ban-052',
      title: 'Moringa Banner',
      sectionType: 'moringa_banner',
      bannerIds: [moringa._id],
      codes: ['Ban-052'],
      order: 1,
    }));
    await db.collection('customer_banners').updateOne(
      { _id: moringa._id },
      { $set: { slot: 'mid', isActive: true } },
    );
  }

  if (honey) {
    created.push(await upsertSection({
      key: 'banner_honey_ban-031',
      title: 'Honey Banner',
      sectionType: 'honey_banner',
      bannerIds: [honey._id],
      codes: ['Ban-031'],
      order: 1,
    }));
    await db.collection('customer_banners').updateOne(
      { _id: honey._id },
      { $set: { slot: 'mid', isActive: true } },
    );
  }

  if (scrollMid.length) {
    created.push(await upsertSection({
      key: 'banner_scroll_mid_row',
      title: 'Scroll Banners',
      sectionType: 'scroll_banner',
      bannerIds: scrollMid.map((b) => b._id),
      codes: scrollMid.map((b) => b.bannerId),
      order: 1,
    }));
    await db.collection('customer_banners').updateMany(
      { _id: { $in: scrollMid.map((b) => b._id) } },
      { $set: { slot: 'mid', isActive: true } },
    );
  }

  if (scrollSmall) {
    created.push(await upsertSection({
      key: 'banner_scroll_small_ban-045',
      title: 'Scroll Banner',
      sectionType: 'scroll_banner',
      bannerIds: [scrollSmall._id],
      codes: ['Ban-045'],
      order: 1,
    }));
    await db.collection('customer_banners').updateOne(
      { _id: scrollSmall._id },
      { $set: { slot: 'mid', isActive: true } },
    );
  }

  // Rebuild definitions from active home sections (minimal port)
  const homeSections = await db.collection('customer_home_sections')
    .find({ isActive: true })
    .sort({ order: 1 })
    .toArray();

  const desired = [{ key: 'categories', label: 'Shop by Category', type: 'super_category', order: 0, bannerIds: [] }];
  let ord = 1;
  for (const section of homeSections) {
    const st = String(section.sectionType || '').toLowerCase();
    const key = String(section.sectionKey || '');
    const hasProducts = Array.isArray(section.productIds) && section.productIds.length > 0;
    const hasBanners = Array.isArray(section.bannerIds) && section.bannerIds.length > 0;
    let mapped = null;
    if (/hero/.test(st) || /hero/.test(key)) {
      mapped = { key: 'hero_banner', label: 'Featured Offers', type: 'banner_main', order: 0, bannerIds: section.bannerIds || [] };
    } else if (/categor/.test(st) || key === 'categories') {
      continue;
    } else if ((hasBanners || key.startsWith('banner_')) && !hasProducts) {
      mapped = { key, label: section.title || key, type: 'banner_sub', order: ord++, bannerIds: section.bannerIds || [] };
    } else if (hasProducts || key.startsWith('collections_')) {
      mapped = { key, label: section.title || key, type: null, order: ord++, bannerIds: [] };
    }
    if (!mapped) continue;
    const idx = desired.findIndex((d) => d.key === mapped.key);
    if (idx >= 0) {
      if (mapped.bannerIds?.length) {
        const set = new Set([...(desired[idx].bannerIds || []).map(String), ...mapped.bannerIds.map(String)]);
        desired[idx].bannerIds = [...set].map((id) => new mongoose.Types.ObjectId(id));
      }
      continue;
    }
    desired.push({
      ...mapped,
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
  await db.collection('customer_home_section_definitions').deleteMany({
    key: { $nin: desired.map((d) => d.key) },
  });

  await db.collection('customer_home_configs').updateOne(
    { key: 'main' },
    {
      $inc: { contentRevision: 1 },
      $set: {
        lastMastersheetSyncAt: new Date(),
        lastMastersheetSyncSource: 'repair-home-mid-banners',
      },
    },
    { upsert: true },
  );

  console.log(JSON.stringify({
    created: created.filter(Boolean),
    definitions: desired.map((d) => ({ key: d.key, type: d.type, banners: (d.bannerIds || []).length })),
  }, null, 2));

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
