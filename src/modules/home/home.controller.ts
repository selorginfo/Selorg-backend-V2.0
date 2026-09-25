import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import * as homeService from './home.service';

// ── Public customer endpoints ─────────────────────────────────────────────────

export async function getHome(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).customer?._id?.toString();
    const data = await homeService.getHomePayload(userId);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function getConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.getConfig();
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.updateConfig(req.body);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function resetConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.resetConfig();
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

// ── Section definitions ───────────────────────────────────────────────────────

export async function listSectionDefinitions(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.listSectionDefinitions();
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createSectionDefinition(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.createSectionDefinition(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateSectionDefinition(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.updateSectionDefinition(req.params.id, req.body);
    if (!data) throw AppError.notFound('Section definition not found');
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteSectionDefinition(req: Request, res: Response, next: NextFunction) {
  try {
    await homeService.deleteSectionDefinition(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
}

export async function reorderSectionDefinitions(req: Request, res: Response, next: NextFunction) {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids)) throw AppError.badRequest('ids array is required');
    await homeService.reorderSectionDefinitions(ids);
    res.status(200).json({ success: true });
  } catch (err) { next(err); }
}

// ── Home sections ─────────────────────────────────────────────────────────────

export async function listSections(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.listHomeSections();
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createSection(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.createHomeSection(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateSection(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.updateHomeSection(req.params.id, req.body);
    if (!data) throw AppError.notFound('Section not found');
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteSection(req: Request, res: Response, next: NextFunction) {
  try {
    await homeService.deleteHomeSection(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
}

export async function reorderSections(req: Request, res: Response, next: NextFunction) {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids)) throw AppError.badRequest('ids array is required');
    await homeService.reorderHomeSections(ids);
    res.status(200).json({ success: true });
  } catch (err) { next(err); }
}

export async function updateSectionProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { productIds } = req.body as { productIds: string[] };
    if (!Array.isArray(productIds)) throw AppError.badRequest('productIds array is required');
    const data = await homeService.updateSectionProducts(req.params.id, productIds);
    if (!data) throw AppError.notFound('Section not found');
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

// ── Lifestyle items ───────────────────────────────────────────────────────────

export async function listLifestyle(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.listLifestyleItems();
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createLifestyle(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.createLifestyleItem(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateLifestyle(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.updateLifestyleItem(req.params.id, req.body);
    if (!data) throw AppError.notFound('Lifestyle item not found');
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteLifestyle(req: Request, res: Response, next: NextFunction) {
  try {
    await homeService.deleteLifestyleItem(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
}

export async function reorderLifestyle(req: Request, res: Response, next: NextFunction) {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids)) throw AppError.badRequest('ids array is required');
    await homeService.reorderLifestyleItems(ids);
    res.status(200).json({ success: true });
  } catch (err) { next(err); }
}

// ── Promo blocks ──────────────────────────────────────────────────────────────

export async function listPromoBlocks(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.listPromoBlocks();
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createPromoBlock(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.createPromoBlock(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updatePromoBlock(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.updatePromoBlock(req.params.id, req.body);
    if (!data) throw AppError.notFound('Promo block not found');
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deletePromoBlock(req: Request, res: Response, next: NextFunction) {
  try {
    await homeService.deletePromoBlock(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
}

export async function reorderPromoBlocks(req: Request, res: Response, next: NextFunction) {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids)) throw AppError.badRequest('ids array is required');
    await homeService.reorderPromoBlocks(ids);
    res.status(200).json({ success: true });
  } catch (err) { next(err); }
}

// ── Home admin: preview ───────────────────────────────────────────────────────

export async function getBootstrapPreview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId;
    const data = await homeService.getHomePayload(userId);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

// ── Home admin: config extras ─────────────────────────────────────────────────

export async function listHomeConfigs(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.getConfig();
    res.status(200).json({ success: true, data: data ? [data] : [] });
  } catch (err) { next(err); }
}

export async function upsertHomeConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await homeService.updateConfig(req.body);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteHomeConfig(_req: Request, res: Response, next: NextFunction) {
  try {
    await homeService.resetConfig();
    res.status(200).json({ success: true, message: 'Config deleted' });
  } catch (err) { next(err); }
}

// ── Home admin: categories ────────────────────────────────────────────────────

export async function listCategoriesAdmin(_req: Request, res: Response, next: NextFunction) {
  try {
    const { Category } = await import('../categories/categories.model');
    const data = await Category.find().sort({ order: 1, level: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function listCategoryChildren(req: Request, res: Response, next: NextFunction) {
  try {
    const { Category } = await import('../categories/categories.model');
    const data = await Category.find({ parentId: req.params.id }).sort({ order: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createCategoryAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Category } = await import('../categories/categories.model');
    const item = await Category.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function updateCategoryAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Category } = await import('../categories/categories.model');
    const body = { ...req.body };
    delete body._id;
    const item = await Category.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Category not found' }); return; }
    res.status(200).json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function deleteCategoryAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Category } = await import('../categories/categories.model');
    await Category.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Category deleted' });
  } catch (err) { next(err); }
}

export async function reorderCategoriesAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Category } = await import('../categories/categories.model');
    const { order } = req.body as { order: { id: string; position: number }[] };
    if (Array.isArray(order)) {
      await Promise.all(order.map((item) => Category.findByIdAndUpdate(item.id, { $set: { order: item.position } })));
    }
    res.status(200).json({ success: true, message: 'Reordered' });
  } catch (err) { next(err); }
}

// ── Home admin: banners ───────────────────────────────────────────────────────

export async function listBannersAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Banner } = await import('../banners/banners.model');
    const { slot, isActive } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (slot) query.slot = slot;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    const data = await Banner.find(query).sort({ order: 1, createdAt: -1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createBannerAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Banner } = await import('../banners/banners.model');
    const { registerBannerInHomeSection } = await import('../banners/banners.service');
    const item = await Banner.create(req.body);
    await registerBannerInHomeSection(item.toObject ? item.toObject() : item);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function updateBannerAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Banner } = await import('../banners/banners.model');
    const { registerBannerInHomeSection, unregisterBannerFromHomeSections } = await import('../banners/banners.service');
    const body = { ...req.body };
    delete body._id;
    const item = await Banner.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Banner not found' }); return; }
    if (item.isActive === false) {
      await unregisterBannerFromHomeSections(String(item._id));
    } else {
      await registerBannerInHomeSection(item);
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function deleteBannerAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Banner } = await import('../banners/banners.model');
    const { unregisterBannerFromHomeSections } = await import('../banners/banners.service');
    await Banner.findByIdAndDelete(req.params.id);
    await unregisterBannerFromHomeSections(String(req.params.id));
    res.status(200).json({ success: true, message: 'Banner deleted' });
  } catch (err) { next(err); }
}

export async function reorderBannersAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Banner } = await import('../banners/banners.model');
    const { order } = req.body as { order: { id: string; position: number }[] };
    if (Array.isArray(order)) {
      await Promise.all(order.map((item) => Banner.findByIdAndUpdate(item.id, { $set: { order: item.position } })));
    }
    res.status(200).json({ success: true, message: 'Reordered' });
  } catch (err) { next(err); }
}

// ── Home admin: upload-product-image (stub) ───────────────────────────────────

export async function uploadProductImage(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, message: 'Image upload not yet implemented.' });
}

// ── Home admin: products (delegated to products module stubs) ─────────────────

export async function listProductsAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Product } = await import('../products/products.model');
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 20);
    const [items, total] = await Promise.all([
      Product.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Product.countDocuments(),
    ]);
    res.status(200).json({ success: true, data: items, total, page, limit });
  } catch (err) { next(err); }
}

export async function getProductByIdAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Product } = await import('../products/products.model');
    const item = await Product.findById(req.params.id).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Product not found' }); return; }
    res.status(200).json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function getProductVariantsAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Product } = await import('../products/products.model');
    const items = await Product.find({ parentId: req.params.id }).lean();
    res.status(200).json({ success: true, data: items });
  } catch (err) { next(err); }
}

export async function createProductAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Product } = await import('../products/products.model');
    const item = await Product.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function bulkUpdateProductsAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Product } = await import('../products/products.model');
    const { ids, update } = req.body as { ids: string[]; update: Record<string, unknown> };
    const result = await Product.updateMany({ _id: { $in: ids } }, { $set: update });
    res.status(200).json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) { next(err); }
}

export async function bulkUpdateProductStatusAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Product } = await import('../products/products.model');
    const { ids, status } = req.body as { ids: string[]; status: string };
    const result = await Product.updateMany({ _id: { $in: ids } }, { $set: { status } });
    res.status(200).json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) { next(err); }
}

export async function updateProductAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Product } = await import('../products/products.model');
    const body = { ...req.body };
    delete body._id;
    const item = await Product.findByIdAndUpdate(req.params.id, { $set: body }, { new: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Product not found' }); return; }
    res.status(200).json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function patchProductStatusAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Product } = await import('../products/products.model');
    const { status } = req.body as { status: string };
    const statusNorm = String(status || '').toLowerCase();
    const update: Record<string, unknown> = { status };
    // Keep isActive in sync so customer search/PDP filters stay consistent.
    if (statusNorm === 'active' || statusNorm === 'published') update.isActive = true;
    else if (statusNorm === 'inactive' || statusNorm === 'draft') update.isActive = false;
    const item = await Product.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Product not found' }); return; }
    res.status(200).json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function publishProductAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Product } = await import('../products/products.model');
    const item = await Product.findByIdAndUpdate(req.params.id, { $set: { status: 'published', publishedAt: new Date() } }, { new: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Product not found' }); return; }
    res.status(200).json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function deleteProductAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { Product } = await import('../products/products.model');
    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Product deleted' });
  } catch (err) { next(err); }
}

// ── Home admin: attributes (stubs) ────────────────────────────────────────────

export async function listAttributes(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, data: [] });
}

export async function createAttribute(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, message: 'Attributes not yet implemented.' });
}

export async function updateAttribute(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, message: 'Attributes not yet implemented.' });
}

export async function deleteAttribute(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, message: 'Attributes not yet implemented.' });
}

// ── Public: GET /sections/:key/products ───────────────────────────────────────
// Resolves products for a home section key. Preferred path is a CMS
// HomeSectionDefinition of type `collections` (linked via collectionId).
// Falls back to legacy HomeSection.productIds keyed by sectionKey.

export async function getSectionProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { HomeSection, HomeSectionDefinition } = await import('./home.models');
    const { Product } = await import('../products/products.model');
    const { resolveCollectionProducts } = await import('../collections/collections.service');
    const { key } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    const definition = await HomeSectionDefinition.findOne({ key }).lean();
    if (definition?.type === 'collections' && definition.collectionId) {
      const { products, total } = await resolveCollectionProducts(
        definition.collectionId as import('mongoose').Types.ObjectId,
        { page, limit },
      );
      res.status(200).json({
        success: true,
        data: {
          title: definition.label || key,
          products,
          pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        },
      });
      return;
    }

    const section = await HomeSection.findOne({ sectionKey: key, isActive: true }).lean();
    if (section) {
      const { enrichProduct } = await import('../../utils/mediaEnrichment');
      const ids = section.productIds || [];
      const total = ids.length;
      const start = (page - 1) * limit;
      const pageIds = ids.slice(start, start + limit);
      const products = await Product.find({ _id: { $in: pageIds }, isActive: true }).lean();
      const byId = new Map(products.map((p) => [String(p._id), p]));
      const ordered = pageIds.map((id) => byId.get(String(id))).filter(Boolean).map((p) => enrichProduct(p as any));
      res.status(200).json({
        success: true,
        data: {
          title: section.title,
          products: ordered,
          pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        },
      });
      return;
    }

    // No CMS configuration for this section key — only serve a catalog fallback when
    // there is no mastersheet-driven layout yet (avoids dumping unrelated products into
    // curated collection keys that simply have an empty product list).
    if (definition && (definition.type === null || definition.type === 'collections' || String(key).startsWith('collections_'))) {
      res.status(200).json({
        success: true,
        data: {
          title: definition.label || key.replace(/_/g, ' '),
          products: [],
          pagination: { page, limit, total: 0, totalPages: 1 },
        },
      });
      return;
    }

    const { enrichProduct } = await import('../../utils/mediaEnrichment');
    const [products, total] = await Promise.all([
      Product.find({ isActive: true }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Product.countDocuments({ isActive: true }),
    ]);
    if (!total) {
      res.status(404).json({ success: false, message: 'Section not found' });
      return;
    }
    res.status(200).json({
      success: true,
      data: {
        title: definition?.label || key.replace(/_/g, ' '),
        products: products.map((p) => enrichProduct(p as any)),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  } catch (err) { next(err); }
}
