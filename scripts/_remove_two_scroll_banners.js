const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  // Keep top scroll row (Ban-046, Ban-047); remove bottom pair (veg + fruits = Ban-048, Ban-049).
  const keepCodes = ['Ban-046', 'Ban-047'];
  const bans = await db.collection('customer_banners')
    .find({ bannerId: { $in: keepCodes } })
    .project({ _id: 1, bannerId: 1 })
    .toArray();
  const byCode = new Map(bans.map((b) => [b.bannerId, b._id]));
  const ids = keepCodes.map((c) => byCode.get(c)).filter(Boolean);

  await db.collection('customer_home_sections').updateOne(
    { sectionKey: 'banner_scroll_mid_row' },
    {
      $set: {
        bannerIds: ids,
        importedBannerCodes: keepCodes,
        title: 'Scroll Banners',
        isActive: true,
      },
    },
  );
  await db.collection('customer_home_section_definitions').updateOne(
    { key: 'banner_scroll_mid_row' },
    { $set: { bannerIds: ids, bannerSelectionMode: ids.length > 1 ? 'multiple' : 'single' } },
  );
  await db.collection('customer_home_configs').updateOne(
    { key: 'main' },
    {
      $inc: { contentRevision: 1 },
      $set: {
        lastMastersheetSyncAt: new Date(),
        lastMastersheetSyncSource: 'remove-veg-fruit-scroll-banners',
      },
    },
  );

  console.log(JSON.stringify({ removed: ['Ban-048', 'Ban-049'], kept: keepCodes }, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
