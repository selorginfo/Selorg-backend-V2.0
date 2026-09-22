import mongoose, { Document, Schema } from 'mongoose';

/**
 * SKU Master (mastersheet import) → Product field mapping lives in the legacy
 * `services/import/skuMasterProductHydration.js` (not yet ported — see products module TODO).
 * This file only ports the schema; products.service.ts / products.controller.ts / the full
 * catalog business logic (taxonomy, search, media enrichment, live-stock) are a deferred,
 * dedicated port — see project memory for why.
 */
export interface IProduct extends Document {
  name: string;
  sku: string;
  classification: 'Style' | 'Variant';
  tag: string;
  subClassification: string;
  hierarchyCode: string;
  description: { about: string; nutrition: string; originOfPlace: string; healthBenefits: string; raw: string };
  images: string[];
  imageUrl: string;
  thumbnailUrl: string;
  cardImageUrl: string;
  additionalImages: string[];
  price: number;
  mrp: number;
  baseCost: number;
  originalPrice?: number;
  costPrice: number;
  hsnCode: string;
  taxPercent: number;
  gstRate: number;
  discount?: string;
  quantity?: string;
  size: string;
  uom: string;
  stockQuantity: number;
  stock: number;
  lowStockThreshold: number;
  maxOrderLimit: number | null;
  minOrderQty: number | null;
  orderLimitType: string;
  orderRestrictionType: string;
  brand: string;
  brandCode: string;
  vendorCode: string;
  mfgSkuCode: string;
  countryOfOrigin: string;
  categoryId?: mongoose.Types.ObjectId;
  subcategoryId?: mongoose.Types.ObjectId | null;
  status: 'active' | 'inactive' | 'draft';
  featured: boolean;
  isPurchasable: boolean;
  isSaleable: boolean;
  isStocked: boolean;
  variants: Array<{ sku?: string; size?: string; price?: number; originalPrice?: number }>;
  qcRequired: boolean;
  backOrderAllowed: boolean;
  backOrderQty: number;
  serialTracking: boolean;
  stackable: boolean;
  hazardous: boolean;
  poisonous: boolean;
  skuRotation: string;
  rotateBy: string;
  thresholdAlertRequired: boolean;
  thresholdQty: number;
  shelfLife: { value: number; type: string; total: number; onReceiving: number; onPicking: number };
  meta: { title: string; keywords: string; description: string };
  relatedProductIds: mongoose.Types.ObjectId[];
  highlights: string[];
  deliveryInfo: string;
  storeLinks: string;
  sortOrder: number;
  udf: Record<string, string>;
  budf8: string;
  attributes: { weight?: string; dimensions?: string; color?: string; size?: string; material?: string; expiryDays?: number };
  associatedClientName: string;
  styleAttributes: string;
  style: string;
  skuSource: string;
  colour: string;
  material: string;
  upcEan: string;
  taxCategory: string;
  dimensions: { heightCm: number; lengthCm: number; widthCm: number; cube: number; weightKg: number };
  washAndCare: string;
  shippingAndReturns: string;
  lottableValidation: string;
  recvValidationCode: string;
  pickingInstructions: string;
  shippingInstructions: string;
  shippingCharges: number;
  handlingCharges: number;
  isArsApplicable: boolean;
  followStyle: string;
  arsCalculationMethod: string;
  fixedStock: number;
  modelStock: number;
  imageDescriptions: string[];
  isUniqueBarcode: boolean;
  taxBreakup: {
    sgstPercent: number;
    cgstPercent: number;
    igstPercent: number;
    cessPercent: number;
    sgstAmount: number;
    cgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    priceInclGst: number;
  };
  similarProducts: string;
  additionalImportedFields: Record<string, unknown>;
  tags: string[];
  searchKeywords: string[];
  searchKeywordsNormalized: string;
  isActive: boolean;
  order?: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    sku: { type: String, default: '' },
    classification: { type: String, enum: ['Style', 'Variant'], default: 'Style', index: true },
    tag: { type: String, default: '' },
    subClassification: { type: String, default: '' },
    hierarchyCode: { type: String, default: '', index: true },
    description: {
      type: new Schema(
        { about: { type: String, default: '' }, nutrition: { type: String, default: '' }, originOfPlace: { type: String, default: '' }, healthBenefits: { type: String, default: '' }, raw: { type: String, default: '' } },
        { _id: false },
      ),
      default: () => ({ about: '', nutrition: '', originOfPlace: '', healthBenefits: '', raw: '' }),
    },
    images: [{ type: String }],
    imageUrl: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    cardImageUrl: { type: String, default: '' },
    additionalImages: [{ type: String }],
    price: { type: Number, required: true },
    mrp: { type: Number, default: 0 },
    baseCost: { type: Number, default: 0 },
    originalPrice: { type: Number },
    costPrice: { type: Number, default: 0 },
    hsnCode: { type: String, default: '' },
    taxPercent: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
    discount: { type: String },
    quantity: { type: String },
    size: { type: String, default: '' },
    uom: { type: String, default: 'EACH' },
    stockQuantity: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    maxOrderLimit: { type: Number, default: null },
    minOrderQty: { type: Number, default: null },
    orderLimitType: { type: String, default: '' },
    orderRestrictionType: { type: String, default: '' },
    brand: { type: String, default: '' },
    brandCode: { type: String, default: '' },
    vendorCode: { type: String, default: '' },
    mfgSkuCode: { type: String, default: '' },
    countryOfOrigin: { type: String, default: 'India' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'CustomerCategory' },
    subcategoryId: { type: Schema.Types.ObjectId, ref: 'CustomerCategory', default: null },
    status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'active' },
    featured: { type: Boolean, default: false },
    isPurchasable: { type: Boolean, default: true },
    isSaleable: { type: Boolean, default: true },
    isStocked: { type: Boolean, default: true },
    variants: [{ sku: String, size: String, price: Number, originalPrice: Number }],
    qcRequired: { type: Boolean, default: false },
    backOrderAllowed: { type: Boolean, default: false },
    backOrderQty: { type: Number, default: 0 },
    serialTracking: { type: Boolean, default: false },
    stackable: { type: Boolean, default: false },
    hazardous: { type: Boolean, default: false },
    poisonous: { type: Boolean, default: false },
    skuRotation: { type: String, default: '' },
    rotateBy: { type: String, default: '' },
    thresholdAlertRequired: { type: Boolean, default: false },
    thresholdQty: { type: Number, default: 0 },
    shelfLife: {
      type: new Schema({ value: { type: Number, default: 0 }, type: { type: String, default: '' }, total: { type: Number, default: 0 }, onReceiving: { type: Number, default: 0 }, onPicking: { type: Number, default: 0 } }, { _id: false }),
      default: () => ({ value: 0, type: '', total: 0, onReceiving: 0, onPicking: 0 }),
    },
    meta: {
      type: new Schema({ title: { type: String, default: '' }, keywords: { type: String, default: '' }, description: { type: String, default: '' } }, { _id: false }),
      default: () => ({ title: '', keywords: '', description: '' }),
    },
    relatedProductIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerProduct' }],
    highlights: [{ type: String }],
    deliveryInfo: { type: String, default: '' },
    storeLinks: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    udf: {
      type: new Schema(
        { udf1: { type: String, default: '' }, udf2: { type: String, default: '' }, udf3: { type: String, default: '' }, udf4: { type: String, default: '' }, udf5: { type: String, default: '' }, udf6: { type: String, default: '' }, udf7: { type: String, default: '' }, udf8: { type: String, default: '' }, udf9: { type: String, default: '' }, udf10: { type: String, default: '' } },
        { _id: false },
      ),
      default: () => ({ udf1: '', udf2: '', udf3: '', udf4: '', udf5: '', udf6: '', udf7: '', udf8: '', udf9: '', udf10: '' }),
    },
    budf8: { type: String, default: '' },
    attributes: { weight: String, dimensions: String, color: String, size: String, material: String, expiryDays: Number },
    associatedClientName: { type: String, default: '' },
    styleAttributes: { type: String, default: '' },
    style: { type: String, default: '' },
    skuSource: { type: String, default: '' },
    colour: { type: String, default: '' },
    material: { type: String, default: '' },
    upcEan: { type: String, default: '' },
    taxCategory: { type: String, default: '' },
    dimensions: {
      type: new Schema({ heightCm: { type: Number, default: 0 }, lengthCm: { type: Number, default: 0 }, widthCm: { type: Number, default: 0 }, cube: { type: Number, default: 0 }, weightKg: { type: Number, default: 0 } }, { _id: false }),
      default: () => ({ heightCm: 0, lengthCm: 0, widthCm: 0, cube: 0, weightKg: 0 }),
    },
    washAndCare: { type: String, default: '' },
    shippingAndReturns: { type: String, default: '' },
    lottableValidation: { type: String, default: '' },
    recvValidationCode: { type: String, default: '' },
    pickingInstructions: { type: String, default: '' },
    shippingInstructions: { type: String, default: '' },
    shippingCharges: { type: Number, default: 0 },
    handlingCharges: { type: Number, default: 0 },
    isArsApplicable: { type: Boolean, default: false },
    followStyle: { type: String, default: '' },
    arsCalculationMethod: { type: String, default: '' },
    fixedStock: { type: Number, default: 0 },
    modelStock: { type: Number, default: 0 },
    imageDescriptions: [{ type: String }],
    isUniqueBarcode: { type: Boolean, default: false },
    taxBreakup: {
      type: new Schema(
        { sgstPercent: { type: Number, default: 0 }, cgstPercent: { type: Number, default: 0 }, igstPercent: { type: Number, default: 0 }, cessPercent: { type: Number, default: 0 }, sgstAmount: { type: Number, default: 0 }, cgstAmount: { type: Number, default: 0 }, igstAmount: { type: Number, default: 0 }, cessAmount: { type: Number, default: 0 }, priceInclGst: { type: Number, default: 0 } },
        { _id: false },
      ),
      default: () => ({ sgstPercent: 0, cgstPercent: 0, igstPercent: 0, cessPercent: 0, sgstAmount: 0, cgstAmount: 0, igstAmount: 0, cessAmount: 0, priceInclGst: 0 }),
    },
    similarProducts: { type: String, default: '' },
    additionalImportedFields: { type: Schema.Types.Mixed, default: () => ({}) },
    tags: [{ type: String }],
    searchKeywords: [{ type: String }],
    searchKeywordsNormalized: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    order: { type: Number },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
productSchema.index({ isActive: 1, order: 1 });
productSchema.index({ categoryId: 1 });
productSchema.index({ subcategoryId: 1 });
productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ status: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ hierarchyCode: 1, classification: 1, isActive: 1, isSaleable: 1 });
productSchema.index(
  {
    name: 'text',
    searchKeywords: 'text',
    brand: 'text',
    sku: 'text',
    'description.about': 'text',
    'description.nutrition': 'text',
    'description.healthBenefits': 'text',
    tag: 'text',
  },
  {
    name: 'product_text_search',
    weights: { name: 10, searchKeywords: 8, brand: 6, sku: 5, tag: 5, 'description.about': 2, 'description.nutrition': 1, 'description.healthBenefits': 1 },
  },
);
productSchema.index({ searchKeywordsNormalized: 1 });
productSchema.index({ classification: 1, isActive: 1, isSaleable: 1, sortOrder: 1, order: 1 });
productSchema.index({ subcategoryId: 1, classification: 1, isActive: 1, isSaleable: 1 });

export const Product =
  (mongoose.models.CustomerProduct as mongoose.Model<IProduct>) ||
  mongoose.model<IProduct>('CustomerProduct', productSchema, 'customer_products');
