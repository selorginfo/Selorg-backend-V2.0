import mongoose, { Document, Schema } from 'mongoose';

/**
 * Schema-only port. categories.service.ts / categories.controller.ts (taxonomy resolution,
 * dedup/cleanup, product-count aggregation) are a deferred, dedicated port — see project
 * memory for why (heavy coupling to products.model.ts, Banner, StoreInventory, and ~1300
 * lines of taxonomy/media-enrichment utilities in the legacy code).
 */
export interface ICategory extends Document {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  thumbnailUrl: string;
  cardImageUrl: string;
  bannerImage: string;
  /** Mastersheet Banner ID (e.g. Ban-003-subcat) linked to this subcategory. */
  bannerId: string;
  bannerVideo: string;
  youtubeUrl: string;
  emoji: string;
  hierarchyCodes: string[];
  level: number;
  isActive: boolean;
  order: number;
  parentId: mongoose.Types.ObjectId | null;
  link: string;
  importRaw: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    cardImageUrl: { type: String, default: '' },
    bannerImage: { type: String, default: '' },
    bannerId: { type: String, default: '', index: true },
    bannerVideo: { type: String, default: '' },
    youtubeUrl: { type: String, default: '' },
    emoji: { type: String, default: '' },
    hierarchyCodes: [{ type: String }],
    level: { type: Number, default: 1, min: 1, max: 3, index: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    parentId: { type: Schema.Types.ObjectId, ref: 'CustomerCategory', default: null },
    link: { type: String, default: '' },
    importRaw: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);
categorySchema.index({ isActive: 1, order: 1 });
categorySchema.index({ parentId: 1, order: 1 });
categorySchema.index({ level: 1, isActive: 1, order: 1 });

categorySchema.pre('validate', async function validateHierarchy(next) {
  try {
    if (!this.parentId) {
      this.level = 1;
      return next();
    }
    const session = typeof this.$session === 'function' ? this.$session() : null;
    const q = Category.findById(this.parentId).select('level').lean();
    const parent = session ? await q.session(session) : await q;
    if (!parent) return next(new Error('Parent category not found'));
    if (parent.level >= 3) return next(new Error('Category depth cannot exceed level 3'));
    this.level = parent.level + 1;
    next();
  } catch (err) {
    next(err as Error);
  }
});

export const Category =
  (mongoose.models.CustomerCategory as mongoose.Model<ICategory>) ||
  mongoose.model<ICategory>('CustomerCategory', categorySchema, 'customer_categories');
