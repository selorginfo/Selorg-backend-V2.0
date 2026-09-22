import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import * as productsRepo from './products.repository';
import { mapEmbeddedVariants, enrichProductsWithVariants, pickImageFields, filterHierarchySiblingsForProductLine, normalizeImagesForClient, VariantRow } from './products.variants';
import { normalizeDescriptionForClient } from './products.description';
import { attachLiveSellableStock } from './products.stock';
import { IProduct } from './products.model';
import { Category } from '../categories/categories.model';

type LeanProduct = Partial<IProduct> & { _id: unknown };

export async function getProductDetail(id: string, storeId?: string | null) {
  if (!id || !String(id).trim()) {
    throw AppError.badRequest('Product id required');
  }
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    throw AppError.badRequest('Invalid product id');
  }

  const product = (await productsRepo.findProductDetailById(id)) as LeanProduct | null;
  if (!product) {
    throw AppError.notFound('Product', id);
  }

  let variants: VariantRow[] = [];
  const embedded = mapEmbeddedVariants(product);
  if (embedded.length > 1) {
    variants = embedded;
  } else if (product.hierarchyCode && String(product.hierarchyCode).trim()) {
    const siblings = (await productsRepo.findSiblingsByHierarchyCode(product.hierarchyCode)) as LeanProduct[];
    const line = filterHierarchySiblingsForProductLine(product, siblings);
    if (line.length > 1) {
      variants = line.map((s) => {
        const sid = String(s._id);
        return { id: sid, productId: sid, name: s.name, size: String(s.size || s.quantity || '').trim() || '1 unit', price: Number(s.price ?? 0), originalPrice: Number(s.mrp ?? s.originalPrice ?? s.price ?? 0), ...pickImageFields(s) };
      });
    } else if (line.length === 1) {
      const s = line[0];
      const sid = String(s._id);
      variants = [{ id: sid, productId: sid, name: s.name, size: String(s.size || s.quantity || product.size || product.quantity || '').trim() || '1 unit', price: Number(s.price ?? product.price ?? 0), originalPrice: Number(s.mrp ?? s.originalPrice ?? product.mrp ?? product.price ?? 0), ...pickImageFields(s) }];
    }
  } else if (embedded.length === 1) {
    variants = embedded;
  }
  if (variants.length === 0) {
    const pid = String(product._id);
    variants = [{ id: pid, productId: pid, name: product.name, size: String(product.size || product.quantity || '').trim() || '1 unit', price: Number(product.price || 0), originalPrice: Number(product.mrp ?? product.originalPrice ?? product.price ?? 0), ...pickImageFields(product) }];
  }

  let relatedProducts: LeanProduct[] = [];
  const similarSkus = String(product.similarProducts || '').split(/[,;\n\r]+/).map((s) => s.trim()).filter(Boolean);
  if (similarSkus.length > 0) {
    const docs = (await productsRepo.findBySkus(similarSkus)) as LeanProduct[];
    const bySku = new Map(docs.map((d) => [String(d.sku || ''), d]));
    relatedProducts = similarSkus.map((s) => bySku.get(s)).filter((d): d is LeanProduct => Boolean(d));
  } else if (Array.isArray(product.relatedProductIds) && product.relatedProductIds.length > 0) {
    relatedProducts = (await productsRepo.findByIds(product.relatedProductIds)) as LeanProduct[];
  } else if (product.hierarchyCode) {
    relatedProducts = (await productsRepo.findRelatedByHierarchyCode(product.hierarchyCode, product._id)) as LeanProduct[];
  }
  // One card per product line; pack SKUs collapse into variants on each card (dedupe by base title, max 8 lines).
  const relatedWithVariants = await enrichProductsWithVariants(relatedProducts, { maxProductLines: 8 });
  const relatedWithStock = await attachLiveSellableStock(relatedWithVariants, { storeId: storeId || null });

  let subcategoryName = '';
  if (product.subcategoryId) {
    const sub = await Category.findById(product.subcategoryId).select('name').lean();
    subcategoryName = String(sub?.name || '').trim();
  }

  const [enrichedProduct] = await attachLiveSellableStock(
    [{
      ...product,
      images: normalizeImagesForClient(product),
      description: normalizeDescriptionForClient(product.description),
      deliveryInfo: product.deliveryInfo || '10-min delivery',
      subcategoryName: subcategoryName || undefined,
    }],
    { storeId: storeId || null },
  );

  return { product: enrichedProduct, variants, relatedProducts: relatedWithStock };
}

export async function searchProducts(query: string, options: { page: number; limit: number; category?: string; storeId?: string }) {
  const { page, limit, category, storeId } = options;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = { isActive: true, isSaleable: true, classification: 'Style' };
  if (category) filter.categoryId = category;
  if (storeId) {
    const { StoreInventory } = await import('./store-inventory.model');
    const available = await StoreInventory.find({ storeId, isAvailable: true, quantity: { $gt: 0 } }).select('productId').lean();
    filter._id = { $in: available.map((i: any) => i.productId) };
  }
  const { rawProducts, total } = await productsRepo.searchProducts(query, filter, skip, limit);
  const products = await enrichProductsWithVariants(rawProducts as any[], { dedupeProductLines: false });
  const withStock = await attachLiveSellableStock(products, { storeId: storeId || null });
  return { products: withStock, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function searchSuggestions(query: string) {
  return productsRepo.searchSuggestions(query, 5);
}

export async function getTrendingSearches(): Promise<string[]> {
  try {
    const { HomeConfig } = await import('../home/home.models');
    const cfg = await HomeConfig.findOne({ key: 'main' }).select('trendingSearches').lean() as any;
    return Array.isArray(cfg?.trendingSearches) ? cfg.trendingSearches : [];
  } catch {
    return [];
  }
}
