import { Product } from './products.model';

const DETAIL_EXCLUDE = {
  baseCost: 0,
  vendorCode: 0,
  mfgSkuCode: 0,
  hsnCode: 0,
  backOrderAllowed: 0,
  backOrderQty: 0,
  serialTracking: 0,
  stackable: 0,
  hazardous: 0,
  poisonous: 0,
  udf: 0,
  // Keep `meta` for product detail (Origin/Health copy in meta.title/description).
  storeLinks: 0,
  thresholdQty: 0,
};

const RELATED_EXCLUDE = { baseCost: 0, vendorCode: 0, mfgSkuCode: 0, hsnCode: 0, udf: 0, meta: 0 };

export function findProductDetailById(id: string) {
  return Product.findById(id).select(DETAIL_EXCLUDE).lean();
}

export function findSiblingsByHierarchyCode(hierarchyCode: string) {
  return Product.find({ hierarchyCode, isActive: true, isSaleable: true }).select(RELATED_EXCLUDE).lean();
}

export function findBySkus(skus: string[]) {
  return Product.find({ sku: { $in: skus }, isActive: true, isSaleable: true, classification: 'Style' }).select(RELATED_EXCLUDE).limit(64).lean();
}

export function findByIds(ids: unknown[]) {
  return Product.find({ _id: { $in: ids }, isActive: true, isSaleable: true, classification: 'Style' }).select(RELATED_EXCLUDE).limit(32).lean();
}

export function findRelatedByHierarchyCode(hierarchyCode: string, excludeId: unknown) {
  return Product.find({ hierarchyCode, _id: { $ne: excludeId }, isActive: true, isSaleable: true }).select(RELATED_EXCLUDE).limit(32).lean();
}

const SEARCH_SELECT = { name: 1, sku: 1, price: 1, mrp: 1, originalPrice: 1, imageUrl: 1, thumbnailUrl: 1, cardImageUrl: 1, images: 1, size: 1, quantity: 1, stock: 1, stockQuantity: 1, fixedStock: 1, isSaleable: 1, isActive: 1, hierarchyCode: 1, variants: 1, maxOrderLimit: 1, tag: 1, discount: 1, brand: 1, categoryId: 1 };

export async function searchProducts(query: string, filter: Record<string, unknown>, skip: number, limit: number) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  const $or = [
    { searchKeywordsNormalized: { $regex: regex } },
    { searchKeywords: { $elemMatch: { $regex: regex } } },
    { name: { $regex: regex } },
    { brand: { $regex: regex } },
    { sku: { $regex: regex } },
    { tag: { $regex: regex } },
    { subClassification: { $regex: regex } },
    { highlights: { $regex: regex } },
    { 'description.about': { $regex: regex } },
    { 'description.raw': { $regex: regex } },
    { 'description.healthBenefits': { $regex: regex } },
    { 'description.originOfPlace': { $regex: regex } },
    { 'meta.title': { $regex: regex } },
    { 'meta.keywords': { $regex: regex } },
    { 'meta.description': { $regex: regex } },
  ];
  const q = { ...filter, $or };
  const [rawProducts, total] = await Promise.all([
    Product.find(q).select(SEARCH_SELECT).skip(skip).limit(limit).lean(),
    Product.countDocuments(q),
  ]);
  return { rawProducts, total };
}

export async function searchSuggestions(query: string, limit = 5) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped}`, 'i');
  return Product.find({
    isActive: true,
    isSaleable: true,
    classification: 'Style',
    $or: [
      { name: { $regex: regex } },
      { searchKeywords: { $elemMatch: { $regex: regex } } },
    ],
  }).select({ name: 1, imageUrl: 1, thumbnailUrl: 1, price: 1 }).limit(limit).lean();
}
