import mongoose, { Document, Schema } from 'mongoose';

export interface IContentItem {
  _id: mongoose.Types.ObjectId;
  type: 'banner' | 'video' | 'image' | 'text' | 'products';
  order: number;
  imageUrl?: string;
  videoUrl?: string;
  text?: string;
  blockTitle?: string;
  link?: string;
  isNavigable: boolean;
  productIds: mongoose.Types.ObjectId[];
  nestedContentItems?: Array<Omit<IContentItem, 'nestedContentItems' | 'blockTitle'>>;
}

const leafContentItemSchema = new Schema<IContentItem>(
  {
    type: { type: String, enum: ['banner', 'video', 'image', 'text', 'products'], required: true },
    order: { type: Number, default: 0 },
    imageUrl: String,
    videoUrl: String,
    text: String,
    link: String,
    isNavigable: { type: Boolean, default: true },
    productIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerProduct' }],
  },
  { _id: true },
);

const contentItemSchema = new Schema<IContentItem>(
  {
    type: { type: String, enum: ['banner', 'video', 'image', 'text', 'products'], required: true },
    order: { type: Number, default: 0 },
    imageUrl: String,
    videoUrl: String,
    text: String,
    blockTitle: String,
    link: String,
    isNavigable: { type: Boolean, default: true },
    productIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerProduct' }],
    nestedContentItems: [leafContentItemSchema],
  },
  { _id: true },
);

export interface IBanner extends Document {
  siteId: mongoose.Types.ObjectId | null;
  bannerId: string;
  slot: 'hero' | 'small' | 'mid' | 'large' | 'info' | 'category';
  presentationMode: 'single' | 'carousel';
  isNavigable: boolean;
  title?: string;
  imageUrl: string;
  bannerType: string;
  sectionCode: string;
  bannerImageUrl: string;
  videoUrl: string;
  thumbnailUrl: string;
  mediaId: mongoose.Types.ObjectId | null;
  link?: string;
  redirectType: string;
  redirectValue?: string;
  aspectRatio: string;
  contentFit: 'cover' | 'contain' | 'fill' | 'none';
  dimensions: { width: number | null; height: number | null; preferredHeight: number | null };
  categoryId?: mongoose.Types.ObjectId;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  order: number;
  contentItems: IContentItem[];
  inputKeyValuePairs: Array<{ key: string; value: unknown }>;
  createdAt: Date;
  updatedAt: Date;
}

const ALLOWED_REDIRECT_TYPES = new Set([
  'url',
  'category',
  'subcategory',
  'collection',
  'section',
  'product',
  'search',
  'none',
  'page',
  'screen',
  'banner',
]);

function normalizeRedirectTypeValue(value: unknown): string {
  const v = value == null ? '' : String(value).trim();
  if (!v || !ALLOWED_REDIRECT_TYPES.has(v)) return 'none';
  return v;
}

function sanitizeRedirectTypeInUpdate(update: unknown) {
  if (!update || typeof update !== 'object') return;
  const record = update as Record<string, unknown>;
  const targets: Record<string, unknown>[] = [];
  if (record.$set && typeof record.$set === 'object') targets.push(record.$set as Record<string, unknown>);
  if (Object.prototype.hasOwnProperty.call(record, 'redirectType')) targets.push(record);
  for (const target of targets) {
    if (Object.prototype.hasOwnProperty.call(target, 'redirectType')) {
      target.redirectType = normalizeRedirectTypeValue(target.redirectType);
    }
  }
}

const bannerSchema = new Schema<IBanner>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: 'CustomerSite', default: null },
    bannerId: { type: String, default: '' },
    slot: { type: String, enum: ['hero', 'small', 'mid', 'large', 'info', 'category'], default: 'hero' },
    presentationMode: { type: String, enum: ['single', 'carousel'], default: 'single' },
    isNavigable: { type: Boolean, default: true },
    title: String,
    imageUrl: { type: String, default: '' },
    bannerType: { type: String, default: '' },
    sectionCode: { type: String, default: '' },
    bannerImageUrl: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    mediaId: { type: Schema.Types.ObjectId, ref: 'CustomerMedia', default: null },
    link: String,
    redirectType: { type: String, enum: [...ALLOWED_REDIRECT_TYPES], default: 'none' },
    redirectValue: String,
    aspectRatio: { type: String, default: 'auto' },
    contentFit: { type: String, enum: ['cover', 'contain', 'fill', 'none'], default: 'fill' },
    dimensions: {
      width: { type: Number, default: null },
      height: { type: Number, default: null },
      preferredHeight: { type: Number, default: null },
    },
    categoryId: { type: Schema.Types.ObjectId, ref: 'CustomerCategory' },
    isActive: { type: Boolean, default: true },
    startDate: Date,
    endDate: Date,
    order: { type: Number, default: 0 },
    contentItems: [contentItemSchema],
    inputKeyValuePairs: [{ key: { type: String, required: true }, value: { type: Schema.Types.Mixed, default: null } }],
  },
  { timestamps: true },
);
bannerSchema.index({ slot: 1, isActive: 1, order: 1 });
bannerSchema.index({ slot: 1, categoryId: 1, isActive: 1, order: 1 });
bannerSchema.index({ bannerId: 1 }, { sparse: true });

bannerSchema.pre('validate', function coerceBannerRedirectType(next) {
  this.redirectType = normalizeRedirectTypeValue(this.redirectType);
  next();
});
bannerSchema.pre('validate', function validateBannerDates(next) {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    return next(new Error('endDate must be greater than startDate'));
  }
  next();
});
bannerSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function sanitizeBannerRedirectTypeUpdate(next) {
  sanitizeRedirectTypeInUpdate(this.getUpdate());
  next();
});

export const Banner =
  (mongoose.models.CustomerBanner as mongoose.Model<IBanner>) ||
  mongoose.model<IBanner>('CustomerBanner', bannerSchema, 'customer_banners');
