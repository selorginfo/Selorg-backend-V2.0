import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../../utils/AppError';
import { Page } from './pages.model';
import { Collection } from '../collections/collections.model';
import { Banner } from '../banners/banners.model';
import { HomeSection, HomeSectionDefinition } from '../home/home.models';
import { Product } from '../products/products.model';
import { Category } from '../categories/categories.model';
import { CmsMedia } from './cms-media.model';

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(image\/(jpeg|jpg|png|gif|webp|svg\+xml)|video\/mp4|image\/svg\+xml)$/i.test(file.mimetype);
    if (!ok) {
      const err = new Error('Unsupported media type. Allowed: JPEG, PNG, GIF, WEBP, SVG, MP4') as Error & {
        code?: string;
      };
      err.code = 'UNSUPPORTED_MEDIA_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});
export const mediaUploadMiddleware = mediaUpload.single('file');

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
      Page.find(query)
        .select('slug title status stage surface type author placement schedule version publishedAt createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
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
    // Persist pipeline fields; coerce status to model enum
    if (body.stage && !['Draft', 'In review', 'Approved', 'Scheduled', 'Published', 'Archived'].includes(String(body.stage))) {
      body.stage = 'Draft';
    }
    if (body.status && body.status !== 'draft' && body.status !== 'published') {
      body.status = body.status === 'published' || body.stage === 'Published' ? 'published' : 'draft';
    }
    if (!body.stage) body.stage = 'Draft';
    if (!body.status) body.status = 'draft';
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
    // Pipeline stage is separate from publish status (model enum: draft | published)
    if (body.stage != null) {
      const stage = String(body.stage);
      if (!['Draft', 'In review', 'Approved', 'Scheduled', 'Published', 'Archived'].includes(stage)) {
        delete body.stage;
      } else if (stage === 'Published') {
        body.status = 'published';
      } else if (stage === 'Archived' || stage === 'Draft' || stage === 'In review' || stage === 'Approved' || stage === 'Scheduled') {
        if (body.status !== 'published') body.status = 'draft';
      }
    }
    if (body.status != null && body.status !== 'draft' && body.status !== 'published') {
      // Map legacy/pipeline status strings onto the two allowed publish states
      const s = String(body.status).toLowerCase();
      body.status = s === 'published' || s === 'live' ? 'published' : 'draft';
    }
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

// ─── Media library ────────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (!n || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function mapMediaDoc(doc: {
  _id: unknown;
  filename?: string;
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  categories?: string[];
  status?: string;
  uploadedBy?: string;
  usedIn?: string;
  updatedAt?: Date;
}) {
  const status = String(doc.status || 'unused');
  const statusLabel =
    status === 'in_use'
      ? 'In use'
      : status === 'archived'
        ? 'Archived'
        : status === 'awaiting'
          ? 'Awaiting approval'
          : 'Unused';
  const tone = status === 'in_use' ? 'green' : status === 'awaiting' ? 'amber' : 'grey';
  const mime = String(doc.mimeType || '');
  const format = mime.includes('svg')
    ? 'SVG'
    : mime.includes('mp4')
      ? 'MP4'
      : mime.includes('png')
        ? 'PNG'
        : mime.includes('webp')
          ? 'WEBP'
          : mime.includes('gif')
            ? 'GIF'
            : 'JPG';
  const dims =
    doc.width && doc.height ? `${doc.width}×${doc.height}` : mime.startsWith('image/') ? '—' : '—';
  return {
    id: String(doc._id),
    filename: doc.filename || 'asset',
    url: doc.url || '',
    format,
    dimensions: dims,
    usedIn: doc.usedIn || '—',
    uploadedBy: doc.uploadedBy || 'Admin',
    size: formatBytes(Number(doc.sizeBytes || 0)),
    sizeBytes: Number(doc.sizeBytes || 0),
    updated: doc.updatedAt
      ? new Date(doc.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      : '—',
    status: { label: statusLabel, tone },
    categories: Array.isArray(doc.categories) ? doc.categories : [],
  };
}

export async function listMedia(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await CmsMedia.find().sort({ updatedAt: -1 }).lean();
    const totalBytes = items.reduce((sum, i) => sum + (Number(i.sizeBytes) || 0), 0);
    res.status(200).json({
      success: true,
      data: items.map(mapMediaDoc),
      meta: { totalBytes, total: items.length },
    });
  } catch (error) {
    next(error);
  }
}

export async function createMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) throw AppError.badRequest('No file uploaded');
    const { uploadBufferToS3 } = await import('../../services/s3.service');
    const { randomUUID } = await import('crypto');
    const ext =
      req.file.originalname.split('.').pop()?.toLowerCase() ||
      req.file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') ||
      'bin';
    const bucket = process.env.AWS_S3_BUCKET_PRODUCT_IMAGES || process.env.AWS_S3_BUCKET || 'selorg-product-images';
    const url = await uploadBufferToS3(
      req.file.buffer,
      bucket,
      'cms-media',
      `${randomUUID()}.${ext}`,
      req.file.mimetype,
    );
    const categoriesRaw = String(req.body?.categories || req.body?.category || '').trim();
    const categories = categoriesRaw
      ? categoriesRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
      : ['Unused'];
    const doc = await CmsMedia.create({
      filename: req.file.originalname || `upload.${ext}`,
      url,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      categories,
      status: 'unused',
      uploadedBy: req.user?.email || req.user?.userId || 'Admin',
      usedIn: '—',
    });
    res.status(201).json({ success: true, data: mapMediaDoc(doc.toObject()) });
  } catch (error) {
    next(error);
  }
}

export async function deleteMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await CmsMedia.findById(req.params.id);
    if (!item) return next(new AppError('Media not found', 404, 'NOT_FOUND'));
    item.status = 'archived';
    if (!item.categories.includes('Archived')) item.categories = [...item.categories, 'Archived'];
    await item.save();
    res.status(200).json({ success: true, data: mapMediaDoc(item.toObject()), message: 'Media archived' });
  } catch (error) {
    next(error);
  }
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
