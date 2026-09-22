/**
 * Set homepage section order to match Master Sheet Home Page Content layout:
 * Categories → Moringa → Deal In Lowest Price → Honey → Trending Now →
 * Scroll Banner → High Nutrition → Scroll Banner → Speciality Products
 *
 * Run: node --dns-result-order=ipv4first scripts/_reorder_home_sections.js
 */
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');

const ORDERED_KEYS = [
  { key: 'hero_banner', order: 0 },
  { key: 'categories', order: 1 },
  { key: 'banner_moringa_ban-052', order: 2 },
  { key: 'collections_deal-in-lowest-price', order: 3 },
  { key: 'banner_honey_ban-031', order: 4 },
  { key: 'collections_trending-now', order: 5 },
  { key: 'banner_scroll_mid_row', order: 6 },
  { key: 'collections_high-nutrition-products', order: 7 },
  { key: 'banner_scroll_small_ban-045', order: 8 },
  { key: 'collections_speciality-products', order: 9 },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  // Ensure first scroll includes Ban-049 (4 creatives in 2×2 with 046–048).
  const ban049 = await db.collection('customer_banners').findOne({ bannerId: 'Ban-049' });
  if (ban049) {
    const scroll = await db.collection('customer_home_sections').findOne({ sectionKey: 'banner_scroll_mid_row' });
    if (scroll) {
      const ids = [...(scroll.bannerIds || []).map(String)];
      if (!ids.includes(String(ban049._id))) {
        await db.collection('customer_home_sections').updateOne(
          { _id: scroll._id },
          {
            $set: {
              bannerIds: [...(scroll.bannerIds || []), ban049._id],
              importedBannerCodes: [...new Set([...(scroll.importedBannerCodes || []), 'Ban-049'])],
            },
          },
        );
      }
      await db.collection('customer_banners').updateOne(
        { _id: ban049._id },
        { $set: { slot: 'mid', isActive: true } },
      );
    }
  }

  // Also align categories_categories duplicate → keep canonical categories key order.
  await db.collection('customer_home_sections').updateOne(
    { sectionKey: 'categories' },
    { $set: { order: 1, isActive: true } },
  );

  for (const row of ORDERED_KEYS) {
    await db.collection('customer_home_sections').updateMany(
      { sectionKey: row.key },
      { $set: { order: row.order, isActive: true } },
    );
    await db.collection('customer_home_section_definitions').updateOne(
      { key: row.key },
      { $set: { order: row.order } },
    );
  }

  // Rebuild definition order list exactly.
  const defs = await db.collection('customer_home_section_definitions').find({}).toArray();
  const byKey = new Map(defs.map((d) => [d.key, d]));
  let order = 0;
  const final = [];
  for (const row of ORDERED_KEYS) {
    const d = byKey.get(row.key);
    if (!d) continue;
    // Refresh bannerIds from home section
    const sec = await db.collection('customer_home_sections').findOne({ sectionKey: row.key, isActive: true });
    const bannerIds = sec?.bannerIds || d.bannerIds || [];
    await db.collection('customer_home_section_definitions').updateOne(
      { key: row.key },
      {
        $set: {
          order: order,
          bannerIds,
          type: d.type,
          label: d.label || row.key,
          bannerSelectionMode: (bannerIds || []).length > 1 ? 'multiple' : 'single',
          useCarousel: d.type === 'banner_main',
          updatedAt: new Date(),
        },
      },
    );
    final.push({ key: row.key, order });
    order += 1;
  }

  // Drop defs not in the ordered layout (keep only these).
  await db.collection('customer_home_section_definitions').deleteMany({
    key: { $nin: final.map((f) => f.key) },
  });

  await db.collection('customer_home_configs').updateOne(
    { key: 'main' },
    {
      $inc: { contentRevision: 1 },
      $set: {
        lastMastersheetSyncAt: new Date(),
        lastMastersheetSyncSource: 'reorder-home-sections',
      },
    },
    { upsert: true },
  );

  console.log(JSON.stringify({ final }, null, 2));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
