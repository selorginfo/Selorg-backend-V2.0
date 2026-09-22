import mongoose, { Document, Schema } from 'mongoose';

// ── HomeConfig ────────────────────────────────────────────────────────────────
export interface ISectionDefinition {
  key: string;
  label: string;
}

export interface IHomeConfig extends Document {
  key: string;
  heroVideoUrl?: string;
  searchPlaceholder: string;
  deliveryTypeLabel?: string;
  deliveryLabel: string;
  categorySectionTitle: string;
  organicTagline: string;
  organicIconUrl: string;
  trendingSearches: string[];
  sectionOrder: string[];
  sectionVisibility: Record<string, unknown>;
  sectionDefinitions: ISectionDefinition[];
  categoryIds: mongoose.Types.ObjectId[];
  contentRevision: number;
  lastMastersheetSyncAt?: Date | null;
  lastMastersheetSyncSource?: string;
}

const VALID_SECTION_KEYS = [
  'categories', 'hero_banner', 'deals', 'wellbeing', 'greens_banner', 'section_image',
  'lifestyle', 'new_deals', 'mid_banner', 'fresh_juice', 'deals_2', 'organic_tagline',
];

const sectionDefinitionSchema = new Schema<ISectionDefinition>(
  { key: { type: String, required: true }, label: { type: String, default: '' } },
  { _id: false },
);

const DEFAULT_SECTION_DEFINITIONS = VALID_SECTION_KEYS.map((key) => ({
  key,
  label: key.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
}));

const homeConfigSchema = new Schema<IHomeConfig>(
  {
    key: { type: String, default: 'main', unique: true },
    heroVideoUrl: String,
    searchPlaceholder: { type: String, default: 'Search for Dal, Milk…' },
    deliveryTypeLabel: String,
    deliveryLabel: { type: String, default: '10-min delivery' },
    categorySectionTitle: { type: String, default: 'Grocery & Kitchen' },
    organicTagline: { type: String, default: '' },
    organicIconUrl: { type: String, default: '' },
    trendingSearches: [{ type: String }],
    sectionOrder: { type: [String], default: [] },
    sectionVisibility: { type: Schema.Types.Mixed, default: {} },
    sectionDefinitions: { type: [sectionDefinitionSchema], default: DEFAULT_SECTION_DEFINITIONS },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerCategory' }],
    /** Bumped after mastersheet sync so clients can detect fresh catalog/home content. */
    contentRevision: { type: Number, default: 0 },
    lastMastersheetSyncAt: { type: Date, default: null },
    lastMastersheetSyncSource: { type: String, default: '' },
  },
  { timestamps: true },
);

export const HomeConfig =
  (mongoose.models.CustomerHomeConfig as mongoose.Model<IHomeConfig>) ||
  mongoose.model<IHomeConfig>('CustomerHomeConfig', homeConfigSchema, 'customer_home_configs');

export { VALID_SECTION_KEYS };

// ── HomeSectionDefinition ─────────────────────────────────────────────────────
export interface IHomeSectionDefinition extends Document {
  key: string;
  label: string;
  order: number;
  type: 'super_category' | 'banner_main' | 'banner_sub' | 'banner' | 'collections' | 'lifestyle' | 'tagline' | null;
  collectionId?: mongoose.Types.ObjectId | null;
  taglineText: string;
  categoryIds: mongoose.Types.ObjectId[];
  bannerId?: mongoose.Types.ObjectId | null;
  bannerIds: mongoose.Types.ObjectId[];
  bannerSelectionMode: 'single' | 'multiple';
  useCarousel: boolean;
}

const homeSectionDefinitionSchema = new Schema<IHomeSectionDefinition>(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, default: '' },
    order: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ['super_category', 'banner_main', 'banner_sub', 'banner', 'collections', 'lifestyle', 'tagline', null],
      default: null,
    },
    collectionId: { type: Schema.Types.ObjectId, ref: 'CustomerCollection', default: null },
    taglineText: { type: String, default: '' },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerCategory' }],
    bannerId: { type: Schema.Types.ObjectId, ref: 'CustomerBanner', default: null },
    bannerIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerBanner' }],
    bannerSelectionMode: { type: String, enum: ['single', 'multiple'], default: 'single' },
    useCarousel: { type: Boolean, default: true },
  },
  { timestamps: true },
);
homeSectionDefinitionSchema.index({ order: 1 });

export const HomeSectionDefinition =
  (mongoose.models.CustomerHomeSectionDefinition as mongoose.Model<IHomeSectionDefinition>) ||
  mongoose.model<IHomeSectionDefinition>('CustomerHomeSectionDefinition', homeSectionDefinitionSchema, 'customer_home_section_definitions');

// ── HomeSection ───────────────────────────────────────────────────────────────
export interface IHomeSection extends Document {
  sectionKey: string;
  title: string;
  productIds: mongoose.Types.ObjectId[];
  maxItems: number;
  order: number;
  isActive: boolean;
  viewAllLink: string;
  sectionType: string;
  bannerIds: mongoose.Types.ObjectId[];
  categoryIds: mongoose.Types.ObjectId[];
  videoUrl: string;
  rawDetail?: unknown;
  importedBannerCodes: string[];
  importedSkuCodes: string[];
  importedCategoryNames: string[];
}

const homeSectionSchema = new Schema<IHomeSection>(
  {
    sectionKey: { type: String, required: true, unique: true },
    title: { type: String, default: '' },
    productIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerProduct' }],
    maxItems: { type: Number, default: 10 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    viewAllLink: { type: String, default: '' },
    sectionType: { type: String, default: 'products' },
    bannerIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerBanner' }],
    categoryIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerCategory' }],
    videoUrl: { type: String, default: '' },
    rawDetail: { type: Schema.Types.Mixed, default: null },
    importedBannerCodes: [{ type: String }],
    importedSkuCodes: [{ type: String }],
    importedCategoryNames: [{ type: String }],
  },
  { timestamps: true },
);
homeSectionSchema.index({ isActive: 1, order: 1 });

export const HomeSection =
  (mongoose.models.CustomerHomeSection as mongoose.Model<IHomeSection>) ||
  mongoose.model<IHomeSection>('CustomerHomeSection', homeSectionSchema, 'customer_home_sections');

// ── LifestyleItem ─────────────────────────────────────────────────────────────
export interface ILifestyleItem extends Document {
  name: string;
  title: string;
  imageUrl?: string;
  link?: string;
  redirectType?: string | null;
  redirectValue?: string;
  blockKey?: string;
  order: number;
  isActive: boolean;
}

const lifestyleItemSchema = new Schema<ILifestyleItem>(
  {
    name: { type: String, required: true },
    title: { type: String, default: '' },
    imageUrl: String,
    link: String,
    redirectType: { type: String, enum: ['url', 'category', 'subcategory', 'collection', 'section', 'product', 'search', 'none', 'page', 'screen', null], default: null },
    redirectValue: String,
    blockKey: { type: String, unique: true, sparse: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
lifestyleItemSchema.index({ isActive: 1, order: 1 });

export const LifestyleItem =
  (mongoose.models.CustomerLifestyleItem as mongoose.Model<ILifestyleItem>) ||
  mongoose.model<ILifestyleItem>('CustomerLifestyleItem', lifestyleItemSchema, 'customer_lifestyle_items');

// ── PromoBlock ────────────────────────────────────────────────────────────────
export interface IPromoBlock extends Document {
  type: 'greens_banner' | 'section_image' | 'fullwidth_image';
  blockKey: string;
  imageUrl: string;
  link?: string;
  redirectType?: string | null;
  redirectValue?: string;
  order: number;
  isActive: boolean;
}

const promoBlockSchema = new Schema<IPromoBlock>(
  {
    type: { type: String, enum: ['greens_banner', 'section_image', 'fullwidth_image'], default: 'section_image' },
    blockKey: { type: String, required: true, unique: true },
    imageUrl: { type: String, required: true },
    link: String,
    redirectType: { type: String, enum: ['url', 'category', 'subcategory', 'collection', 'section', 'product', 'search', 'none', 'page', 'screen', null], default: null },
    redirectValue: String,
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
promoBlockSchema.index({ blockKey: 1 });

export const PromoBlock =
  (mongoose.models.CustomerPromoBlock as mongoose.Model<IPromoBlock>) ||
  mongoose.model<IPromoBlock>('CustomerPromoBlock', promoBlockSchema, 'customer_promo_blocks');
