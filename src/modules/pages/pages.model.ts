import mongoose, { Document, Schema } from 'mongoose';

const BLOCK_TYPES = [
  'heroBanner', 'bannerCarousel', 'categoryGrid', 'productCarousel',
  'collectionCarousel', 'promoImage', 'videoBlock', 'lifestyleGrid',
  'textBanner', 'organicTagline',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export interface IPage extends Document {
  siteId?: mongoose.Types.ObjectId;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  /** Admin content-pipeline stage (broader than publish status). */
  stage?: string;
  surface?: string;
  type?: string;
  author?: string;
  placement?: string;
  schedule?: string;
  blocks: Array<{
    type: string;
    order: number;
    maxItems?: number;
    styleJson?: Record<string, unknown>;
    referenceId?: mongoose.Types.ObjectId;
    config?: Record<string, unknown>;
    dataSource?: {
      collectionId?: mongoose.Types.ObjectId;
      categoryIds?: mongoose.Types.ObjectId[];
    };
    schedule?: { startDate?: Date; endDate?: Date };
  }>;
  version: number;
  publishedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  additionalImportedFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const pageBlockSchema = new Schema(
  {
    type: { type: String, enum: BLOCK_TYPES, required: true },
    order: { type: Number, default: 0 },
    maxItems: { type: Number, default: 0 },
    styleJson: { type: Schema.Types.Mixed, default: {} },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    config: { type: Schema.Types.Mixed, default: {} },
    dataSource: {
      collectionId: { type: Schema.Types.ObjectId, ref: 'CustomerCollection' },
      categoryIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerCategory' }],
    },
    schedule: {
      startDate: Date,
      endDate: Date,
    },
  },
  { _id: true },
);

const pageSchema = new Schema<IPage>(
  {
    siteId: { type: Schema.Types.ObjectId, default: null },
    slug: { type: String, required: true, index: true },
    title: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    stage: {
      type: String,
      enum: ['Draft', 'In review', 'Approved', 'Scheduled', 'Published', 'Archived'],
      default: 'Draft',
      index: true,
    },
    surface: { type: String, default: 'Customer app', index: true },
    type: { type: String, default: 'Page' },
    author: { type: String, default: 'Admin' },
    placement: { type: String, default: '' },
    schedule: { type: String, default: '' },
    blocks: [pageBlockSchema],
    version: { type: Number, default: 1 },
    publishedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, default: null },
    additionalImportedFields: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

pageSchema.index({ siteId: 1, slug: 1 }, { unique: true });

export const Page =
  (mongoose.models.CustomerPage as mongoose.Model<IPage>) ||
  mongoose.model<IPage>('CustomerPage', pageSchema, 'customer_pages');
