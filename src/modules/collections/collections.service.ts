import mongoose from 'mongoose';
import { Collection } from './collections.model';
import { Product } from '../products/products.model';
import { Category } from '../categories/categories.model';

const PRODUCT_SELECT = {
  name: 1, images: 1, imageUrl: 1, thumbnailUrl: 1, cardImageUrl: 1,
  price: 1, originalPrice: 1, discount: 1, quantity: 1, size: 1, tag: 1,
  mrp: 1, taxPercent: 1, isSaleable: 1, stock: 1, stockQuantity: 1, fixedStock: 1,
  maxOrderLimit: 1, hierarchyCode: 1, sku: 1, categoryId: 1, subcategoryId: 1,
};

function applySort(products: any[], sortBy: string): any[] {
  const arr = [...products];
  if (sortBy === 'price' || sortBy === 'price_asc') arr.sort((a, b) => a.price - b.price);
  else if (sortBy === 'priceDesc' || sortBy === 'price_desc') arr.sort((a, b) => b.price - a.price);
  else if (sortBy === 'createdAt') arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  else if (sortBy === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  else if (sortBy === 'sortOrder') arr.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return arr;
}

async function attachSubcategoryNames(products: any[]): Promise<any[]> {
  const subIds = [
    ...new Set(
      products
        .map((p) => (p.subcategoryId != null ? String(p.subcategoryId) : ''))
        .filter(Boolean),
    ),
  ];
  if (subIds.length === 0) return products;

  const subs = await Category.find({ _id: { $in: subIds } })
    .select('_id name')
    .lean();
  const nameById = new Map(subs.map((s) => [String(s._id), String(s.name || '')]));

  return products.map((p) => {
    const subcategoryId = p.subcategoryId != null ? String(p.subcategoryId) : '';
    const subcategoryName = subcategoryId ? nameById.get(subcategoryId) || '' : '';
    return {
      ...p,
      categoryId: p.categoryId != null ? String(p.categoryId) : undefined,
      subcategoryId: subcategoryId || undefined,
      subcategoryName: subcategoryName || undefined,
    };
  });
}

export async function resolveCollectionProducts(
  collectionId: mongoose.Types.ObjectId,
  options: { page?: number; limit?: number; sort?: string } = {},
): Promise<{ products: any[]; total: number }> {
  const col = await Collection.findOne({ _id: collectionId, isActive: true }).lean();
  if (!col) return { products: [], total: 0 };

  const now = new Date();
  if (col.schedule) {
    if (col.schedule.startDate && col.schedule.startDate > now) return { products: [], total: 0 };
    if (col.schedule.endDate && col.schedule.endDate < now) return { products: [], total: 0 };
  }

  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const sortOverride = String(options.sort || '').trim();
  const sortBy = sortOverride || col.sortBy || 'manual';

  let products: any[] = [];

  if (col.type === 'manual' && col.productIds.length > 0) {
    products = await Product.find({ _id: { $in: col.productIds }, isActive: true })
      .select(PRODUCT_SELECT)
      .lean();
    if (sortBy === 'manual') {
      const orderMap = new Map(col.productIds.map((id, i) => [String(id), i]));
      products.sort((a, b) => (orderMap.get(String(a._id)) ?? 99) - (orderMap.get(String(b._id)) ?? 99));
    } else {
      products = applySort(products, sortBy);
    }
  } else if (col.type === 'rule-based' && col.rules) {
    const query: Record<string, any> = { isActive: true, isSaleable: true };
    const rules = col.rules as any;
    if (Array.isArray(rules.categoryIds) && rules.categoryIds.length > 0) {
      query.$or = [{ categoryId: { $in: rules.categoryIds } }, { subcategoryId: { $in: rules.categoryIds } }];
    }
    if (typeof rules.priceMin === 'number') query.price = { ...query.price, $gte: rules.priceMin };
    if (typeof rules.priceMax === 'number') query.price = { ...query.price, $lte: rules.priceMax };
    if (rules.featured === true) query.featured = true;

    products = await Product.find(query).select(PRODUCT_SELECT).limit(100).lean();
    products = applySort(products, sortBy);
  }

  const total = products.length;
  const start = (page - 1) * limit;
  const pageProducts = await attachSubcategoryNames(products.slice(start, start + limit));
  return { products: pageProducts, total };
}

export async function getCollectionBySlug(slug: string, options: { page?: number; limit?: number; sort?: string } = {}) {
  const isObjectId = mongoose.Types.ObjectId.isValid(slug) && String(new mongoose.Types.ObjectId(slug)) === slug;
  const query = isObjectId ? { _id: slug, isActive: true } : { slug, isActive: true };
  const collection = await Collection.findOne(query).lean();
  if (!collection) return null;

  const page = options.page || 1;
  const limit = options.limit || 20;
  const { products, total } = await resolveCollectionProducts(collection._id as mongoose.Types.ObjectId, options);
  return {
    id: String(collection._id),
    name: collection.name,
    slug: collection.slug,
    imageUrl: collection.imageUrl || '',
    tagline: collection.tagline || collection.description || (collection as any).additionalImportedFields?.Tagline || '',
    products,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
