import mongoose, { Document, Schema } from 'mongoose';

export interface ICollection extends Document {
  siteId?: mongoose.Types.ObjectId;
  collectionId?: string;
  name: string;
  slug: string;
  imageUrl: string;
  tagline?: string;
  description?: string;
  type: 'manual' | 'rule-based';
  productIds: mongoose.Types.ObjectId[];
  filterTags: string[];
  rules?: {
    categoryIds?: mongoose.Types.ObjectId[];
    tagIds?: mongoose.Types.ObjectId[];
    priceMin?: number;
    priceMax?: number;
    featured?: boolean;
  };
  sortBy: 'manual' | 'price' | 'priceDesc' | 'price_asc' | 'price_desc' | 'createdAt' | 'name' | 'sortOrder';
  isActive: boolean;
  schedule?: { startDate?: Date; endDate?: Date };
  additionalImportedFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const collectionSchema = new Schema<ICollection>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: 'CustomerSite', default: null },
    collectionId: { type: String, default: '' },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    imageUrl: { type: String, default: '' },
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    type: { type: String, enum: ['manual', 'rule-based'], default: 'manual' },
    productIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerProduct' }],
    filterTags: [{ type: String }],
    rules: {
      categoryIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerCategory' }],
      tagIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerTag' }],
      priceMin: Number,
      priceMax: Number,
      featured: Boolean,
    },
    sortBy: {
      type: String,
      enum: ['manual', 'price', 'priceDesc', 'price_asc', 'price_desc', 'createdAt', 'name', 'sortOrder'],
      default: 'manual',
    },
    isActive: { type: Boolean, default: true },
    schedule: {
      startDate: Date,
      endDate: Date,
    },
    additionalImportedFields: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

collectionSchema.index({ siteId: 1, slug: 1 }, { unique: true });
collectionSchema.index({ collectionId: 1 }, { sparse: true });
collectionSchema.index({ isActive: 1 });
collectionSchema.index({ type: 1 });

export const Collection =
  (mongoose.models.CustomerCollection as mongoose.Model<ICollection>) ||
  mongoose.model<ICollection>('CustomerCollection', collectionSchema, 'customer_collections');
