import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as bannersService from './banners.service';

export async function getBannerById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await bannersService.getBannerById(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function listBanners(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Banner } = await import('./banners.model');
    // Admin sessions (req.user set by authenticateAdmin) may see inactive banners.
    // Customer-facing GET /customer/banners must only return active ones.
    const isAdmin = !!(req as Request & { user?: unknown }).user;
    const includeInactive = isAdmin || String(req.query.includeInactive || '') === 'true';
    const filter = includeInactive ? {} : { isActive: true };
    const data = await Banner.find(filter).sort({ order: 1, createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Banner } = await import('./banners.model');
    const banner = await Banner.create(req.body);
    await bannersService.registerBannerInHomeSection(banner.toObject ? banner.toObject() : banner);
    res.status(201).json({ success: true, data: banner });
  } catch (err) {
    next(err);
  }
}

export async function updateBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Banner } = await import('./banners.model');
    const banner = await Banner.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean();
    if (!banner) {
      res.status(404).json({ success: false, message: 'Banner not found' });
      return;
    }
    if (banner.isActive === false) {
      await bannersService.unregisterBannerFromHomeSections(String(banner._id));
    } else {
      await bannersService.registerBannerInHomeSection(banner);
    }
    res.json({ success: true, data: banner });
  } catch (err) {
    next(err);
  }
}

export async function deleteBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Banner } = await import('./banners.model');
    await Banner.findByIdAndDelete(req.params.id);
    await bannersService.unregisterBannerFromHomeSections(String(req.params.id));
    res.json({ success: true, message: 'Banner deleted' });
  } catch (err) {
    next(err);
  }
}

export async function reorderBanners(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Banner } = await import('./banners.model');
    const { order } = req.body as { order: { id: string; position: number }[] };
    if (Array.isArray(order)) {
      await Promise.all(order.map((item) => Banner.findByIdAndUpdate(item.id, { $set: { order: item.position } })));
    }
    res.json({ success: true, message: 'Banners reordered' });
  } catch (err) {
    next(err);
  }
}
