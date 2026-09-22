/**
 * Restores deleted subcategories using IDs recovered from taxonomy audit files
 * and product collection references.
 * Usage: npx ts-node -r tsconfig-paths/register scripts/restore-categories.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error('MONGO_URI is not set in .env');

// All recoverable subcategories (IDs preserved from taxonomy audit + product refs)
const SUBCATEGORIES = [
  // ── Fruits ──────────────────────────────────────────────────────────────
  { _id: '6a02ecc3c6755a49b4218fc6', name: 'Tropical Fruits',          parentId: '6a02ecc0c6755a49b4218f45', level: 2, order: 1 },
  { _id: '6a02ecc4c6755a49b4218ff5', name: 'Highly Nutritious Fruits',  parentId: '6a02ecc0c6755a49b4218f45', level: 2, order: 2 },
  { _id: '6a02ecc5c6755a49b421903c', name: 'Premium Fruits',            parentId: '6a02ecc0c6755a49b4218f45', level: 2, order: 3 },
  { _id: '6a02ecc7c6755a49b4219083', name: 'Berries',                   parentId: '6a02ecc0c6755a49b4218f45', level: 2, order: 4 },
  { _id: '6a02ecc8c6755a49b42190be', name: 'Mango Varieties',           parentId: '6a02ecc0c6755a49b4218f45', level: 2, order: 5 },
  { _id: '6a02ecc0c6755a49b4218f49', name: 'Native Fruits',             parentId: '6a02ecc0c6755a49b4218f45', level: 2, order: 6 },

  // ── Vegetables ──────────────────────────────────────────────────────────
  { _id: '6a02eccbc6755a49b4219144', name: 'Daily Essentials',          parentId: '6a02ecc9c6755a49b42190ed', level: 2, order: 1 },
  { _id: '6a02eccdc6755a49b4219197', name: 'Climbers',                  parentId: '6a02ecc9c6755a49b42190ed', level: 2, order: 2 },
  { _id: '6a02eccec6755a49b42191ce', name: 'Root Vegetables',           parentId: '6a02ecc9c6755a49b42190ed', level: 2, order: 3 },
  { _id: '6a02eccfc6755a49b4219203', name: 'Leafy Vegetables',          parentId: '6a02ecc9c6755a49b42190ed', level: 2, order: 4 },
  { _id: '6a02ecd0c6755a49b4219226', name: 'Greens and Herbs',          parentId: '6a02ecc9c6755a49b42190ed', level: 2, order: 5 },
  { _id: '6a02ecd2c6755a49b421928b', name: 'Tuber Vegetables',          parentId: '6a02ecc9c6755a49b42190ed', level: 2, order: 6 },
  { _id: '6a02ecd3c6755a49b42192ac', name: 'Specialty Vegetables',      parentId: '6a02ecc9c6755a49b42190ed', level: 2, order: 7 },
  { _id: '6a02ecc9c6755a49b42190f1', name: 'Native Vegetables',         parentId: '6a02ecc9c6755a49b42190ed', level: 2, order: 8 },
  { _id: '6a71dd35c0155cac3e9ef203', name: 'Exotic Vegetables',         parentId: '6a02ecc9c6755a49b42190ed', level: 2, order: 9 },

  // ── Rice Mandi ──────────────────────────────────────────────────────────
  { _id: '69d8bfc29d463d9aaa3f6d39', name: 'Boiled Rice',               parentId: '69d8bfc29d463d9aaa3f6d35', level: 2, order: 1 },
  { _id: '69d8bfc29d463d9aaa3f6d74', name: 'Raw Rice',                  parentId: '69d8bfc29d463d9aaa3f6d35', level: 2, order: 2 },
  { _id: '69d8bfc39d463d9aaa3f6daf', name: 'Traditional Rice',          parentId: '69d8bfc29d463d9aaa3f6d35', level: 2, order: 3 },
  { _id: '69d8bfc39d463d9aaa3f6e1a', name: 'Red Rice & Brown Rice',     parentId: '69d8bfc29d463d9aaa3f6d35', level: 2, order: 4 },
  { _id: '6a11677a7faf69a6fa40d4dd', name: 'Basmati & Seeraga Samba',   parentId: '69d8bfc29d463d9aaa3f6d35', level: 2, order: 5 },
  { _id: '6a5deab3ecfe7c8081fe82f9', name: 'Boiled Rice Varieties',     parentId: '69d8bfc29d463d9aaa3f6d35', level: 2, order: 6 },
  { _id: '6a5deab4ecfe7c8081fe8312', name: 'Raw Rice Varieties',        parentId: '69d8bfc29d463d9aaa3f6d35', level: 2, order: 7 },
  { _id: '6a5deab6ecfe7c8081fe834c', name: 'Red & Brown Rice',          parentId: '69d8bfc29d463d9aaa3f6d35', level: 2, order: 8 },
  { _id: '6a5deab7ecfe7c8081fe8367', name: 'Kerala & Broken Rice',      parentId: '69d8bfc29d463d9aaa3f6d35', level: 2, order: 9 },
  { _id: '6a5b77363bc9e96166f0010d', name: 'Heritage Rice',             parentId: '69d8bfc29d463d9aaa3f6d35', level: 2, order: 10 },
  { _id: '69d8bfc49d463d9aaa3f6e5b', name: 'Parboiled Rice',            parentId: '69d8bfc29d463d9aaa3f6d35', level: 2, order: 11 },
  { _id: '69d8bfc49d463d9aaa3f6e90', name: 'Specialty Rice',            parentId: '69d8bfc29d463d9aaa3f6d35', level: 2, order: 12 },

  // ── Millets Mandi ───────────────────────────────────────────────────────
  { _id: '6a02ecdac6755a49b421939f', name: 'Raw Millets',               parentId: '6a02ecdac6755a49b421939b', level: 2, order: 1 },
  { _id: '6a02ecdbc6755a49b42193da', name: 'Millet Flours',             parentId: '6a02ecdac6755a49b421939b', level: 2, order: 2 },
  { _id: '6a02ecdcc6755a49b42193f7', name: 'Millet Noodles & Pasta',    parentId: '6a02ecdac6755a49b421939b', level: 2, order: 3 },

  // ── Dairy Products ──────────────────────────────────────────────────────
  { _id: '6a02ecdcc6755a49b4219400', name: 'Milk & Curd',               parentId: '6a02ecdcc6755a49b42193fc', level: 2, order: 1 },
  { _id: '6a02ecdcc6755a49b4219417', name: 'Butter & Ghee',             parentId: '6a02ecdcc6755a49b42193fc', level: 2, order: 2 },
  { _id: '6a02ecddc6755a49b421942e', name: 'Cheese & Paneer',           parentId: '6a02ecdcc6755a49b42193fc', level: 2, order: 3 },

  // ── Tea & Breakfast ─────────────────────────────────────────────────────
  { _id: '6a02ecdec6755a49b421945b', name: 'Tea & Coffee',              parentId: '6a02ecdec6755a49b4219457', level: 2, order: 1 },
  { _id: '6a02ecdfc6755a49b4219472', name: 'Breakfast Cereals',         parentId: '6a02ecdec6755a49b4219457', level: 2, order: 2 },
  { _id: '6a02ecdfc6755a49b4219489', name: 'Sauces & Spreads',          parentId: '6a02ecdec6755a49b4219457', level: 2, order: 3 },
  { _id: '6a02ece1c6755a49b42194b8', name: 'Sprouts',                   parentId: '6a02ecdec6755a49b4219457', level: 2, order: 4 },

  // ── Groceries & Kitchen ─────────────────────────────────────────────────
  { _id: '6a02ece3c6755a49b4219521', name: 'Atta & Flour',              parentId: '6a02ece3c6755a49b421951d', level: 2, order: 1 },
  { _id: '6a02ece4c6755a49b421955c', name: 'Oil & Ghee',                parentId: '6a02ece3c6755a49b421951d', level: 2, order: 2 },
  { _id: '6a02ece7c6755a49b42195c2', name: 'Dals & Pulses',             parentId: '6a02ece3c6755a49b421951d', level: 2, order: 3 },
  { _id: '6a02eceac6755a49b4219639', name: 'Masalas & Powders',         parentId: '6a02ece3c6755a49b421951d', level: 2, order: 4 },
  { _id: '6a02eceac6755a49b4219644', name: 'Whole Spices',              parentId: '6a02ece3c6755a49b421951d', level: 2, order: 5 },
  { _id: '6a02ecedc6755a49b42196d9', name: 'Rice & Grains',             parentId: '6a02ece3c6755a49b421951d', level: 2, order: 6 },
  { _id: '6a02ecefc6755a49b4219738', name: 'Pickles & Condiments',      parentId: '6a02ece3c6755a49b421951d', level: 2, order: 7 },
  { _id: '6a02ecf1c6755a49b4219773', name: 'Sweeteners & Sugar',        parentId: '6a02ece3c6755a49b421951d', level: 2, order: 8 },
  { _id: '6a02ecf2c6755a49b421979c', name: 'Snacks & Namkeen',          parentId: '6a02ece3c6755a49b421951d', level: 2, order: 9 },
  { _id: '6a71dd49c0155cac3e9ef3a8', name: 'Dals & Pulses',             parentId: '6a02ece3c6755a49b421951d', level: 2, order: 10 },

  // ── Dry Fruits & Seeds ──────────────────────────────────────────────────
  { _id: '6a02ecf2c6755a49b42197b1', name: 'Dry Fruits & Nuts',         parentId: '6a02ecf2c6755a49b42197ad', level: 2, order: 1 },
  { _id: '6a71dd52c0155cac3e9ef46c', name: 'Seeds',                     parentId: '6a02ecf2c6755a49b42197ad', level: 2, order: 2 },

  // ── Dry Powder Mix ──────────────────────────────────────────────────────
  { _id: '6a02ecf5c6755a49b4219829', name: 'Instant Mixes',             parentId: '6a02ecf5c6755a49b4219825', level: 2, order: 1 },
  { _id: '6a02ecf7c6755a49b4219870', name: 'Vegetables Mix',            parentId: '6a02ecf5c6755a49b4219825', level: 2, order: 2 },
  { _id: '6a02ecf8c6755a49b42198bd', name: 'Fruits Mix',                parentId: '6a02ecf5c6755a49b4219825', level: 2, order: 3 },
];

async function run() {
  await mongoose.connect(MONGO_URI as string);
  console.log('Connected to MongoDB\n');

  const col = mongoose.connection.collection('customer_categories');

  let restored = 0;
  let skipped = 0;

  for (const sub of SUBCATEGORIES) {
    const existing = await col.findOne({ _id: new mongoose.Types.ObjectId(sub._id) });
    if (existing) {
      console.log(`  SKIP (exists): "${sub.name}"`);
      skipped++;
      continue;
    }

    await col.insertOne({
      _id: new mongoose.Types.ObjectId(sub._id) as any,
      name: sub.name,
      slug: sub.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'),
      description: '',
      imageUrl: '',
      thumbnailUrl: '',
      cardImageUrl: '',
      bannerImage: '',
      bannerVideo: '',
      youtubeUrl: '',
      emoji: '',
      hierarchyCodes: [],
      level: sub.level,
      isActive: true,
      order: sub.order,
      parentId: new mongoose.Types.ObjectId(sub.parentId),
      link: '',
      importRaw: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`  ✓ Restored: "${sub.name}"`);
    restored++;
  }

  console.log(`\n✓ Done — restored ${restored}, skipped ${skipped} (already existed)`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
