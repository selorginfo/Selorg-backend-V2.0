import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { Page } from './pages.model';
import { Collection } from '../collections/collections.model';
import { Banner } from '../banners/banners.model';
import { HomeSection, HomeSectionDefinition } from '../home/home.models';
import { Product } from '../products/products.model';
import { Category } from '../categories/categories.model';

// ─── Overview ─────────────────────────────────────────────────────────────────

export async function getOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [pages, collections, banners] = await Promise.all([
      Page.countDocuments(),
      Collection.countDocuments(),
      Banner.countDocuments(),
    ]);
    res.status(200).json({ success: true, data: { pages, collections, banners } });
  } catch (error) {
    next(error);
  }
}

// ─── Pages CRUD ───────────────────────────────────────────────────────────────

export async function listPages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, search } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 20);
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (search) query.$or = [{ title: { $regex: search, $options: 'i' } }, { slug: { $regex: search, $options: 'i' } }];
    const [items, total] = await Promise.all([
      Page.find(query).select('slug title status version publishedAt createdAt updatedAt').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Page.countDocuments(query),
    ]);
    res.status(200).json({ success: true, data: items, total, page, limit });
  } catch (error) {
    next(error);
  }
}

export async function getPage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await Page.findById(req.params.id).lean();
    if (!item) return next(new AppError('Page not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function createPage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = { ...req.body, createdBy: req.user?.userId };
    const item = await Page.create(body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function updatePage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = { ...req.body };
    delete body._id;
    if (body.status === 'published' && !body.publishedAt) body.publishedAt = new Date();
    const item = await Page.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true }).lean();
    if (!item) return next(new AppError('Page not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function deletePage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await Page.findByIdAndDelete(req.params.id);
    if (!item) return next(new AppError('Page not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, message: 'Page deleted' });
  } catch (error) {
    next(error);
  }
}

// ─── Collections CRUD ─────────────────────────────────────────────────────────

export async function listCollections(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 20);
    const query: Record<string, unknown> = {};
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { slug: { $regex: search, $options: 'i' } }];
    const [items, total] = await Promise.all([
      Collection.find(query).select('name slug type isActive imageUrl createdAt updatedAt').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Collection.countDocuments(query),
    ]);
    res.status(200).json({ success: true, data: items, total, page, limit });
  } catch (error) {
    next(error);
  }
}

export async function createCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await Collection.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function updateCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = { ...req.body };
    delete body._id;
    const item = await Collection.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true }).lean();
    if (!item) return next(new AppError('Collection not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function deleteCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await Collection.findByIdAndDelete(req.params.id);
    if (!item) return next(new AppError('Collection not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, message: 'Collection deleted' });
  } catch (error) {
    next(error);
  }
}

// ─── Banners CRUD ─────────────────────────────────────────────────────────────

export async function listBanners(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slot, isActive, search } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (slot) query.slot = slot;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) query.title = { $regex: search, $options: 'i' };
    const items = await Banner.find(query).sort({ order: 1, createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function createBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await Banner.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function updateBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = { ...req.body };
    delete body._id;
    const item = await Banner.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true }).lean();
    if (!item) return next(new AppError('Banner not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function deleteBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await Banner.findByIdAndDelete(req.params.id);
    if (!item) return next(new AppError('Banner not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, message: 'Banner deleted' });
  } catch (error) {
    next(error);
  }
}

// ─── Home Sections ────────────────────────────────────────────────────────────

export async function listHomeSections(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await HomeSectionDefinition.find().sort({ order: 1 }).lean();
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function createHomeSection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await HomeSectionDefinition.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function updateHomeSection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = { ...req.body };
    delete body._id;
    const item = await HomeSectionDefinition.findByIdAndUpdate(req.params.id, body, { new: true }).lean();
    if (!item) return next(new AppError('Section not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function deleteHomeSection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await HomeSectionDefinition.findByIdAndDelete(req.params.id);
    if (!item) return next(new AppError('Section not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, message: 'Section deleted' });
  } catch (error) {
    next(error);
  }
}

// ─── Upload stubs (ExcelJS not yet wired) ────────────────────────────────────

export async function uploadSkuMaster(_req: Request, res: Response): Promise<void> {
  // TODO: implement ExcelJS SKU master import
  res.status(200).json({ success: true, message: 'SKU master upload received. Processing not yet implemented.' });
}

export async function uploadCmsPages(_req: Request, res: Response): Promise<void> {
  // TODO: implement ExcelJS CMS pages import
  res.status(200).json({ success: true, message: 'CMS pages upload received. Processing not yet implemented.' });
}

export async function uploadContentHubMaster(_req: Request, res: Response): Promise<void> {
  // TODO: implement ExcelJS content-hub master import
  res.status(200).json({ success: true, message: 'Content hub master upload received. Processing not yet implemented.' });
}

export async function getContentHubImportJob(req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, data: { jobId: req.params.jobId, status: 'not_implemented' } });
}

export async function listContentHubImportRuns(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, data: [] });
}

export async function consolidateCatalogTaxonomy(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, message: 'Catalog taxonomy consolidation not yet implemented.' });
}

// ─── Media stubs ──────────────────────────────────────────────────────────────

export async function listMedia(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, data: [] });
}

export async function createMedia(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, message: 'Media upload not yet implemented.' });
}

export async function deleteMedia(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, message: 'Media deleted' });
}

// ─── Buttons (stub) ───────────────────────────────────────────────────────────

export async function listButtons(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, data: [] });
}

export async function createButton(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, message: 'Buttons not yet implemented.' });
}

export async function updateButton(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, message: 'Buttons not yet implemented.' });
}

export async function deleteButton(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, message: 'Buttons not yet implemented.' });
}
