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

export async function listBanners(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Banner } = await import('./banners.model');
    const data = await Banner.find().sort({ order: 1, createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Banner } = await import('./banners.model');
    const banner = await Banner.create(req.body);
    res.status(201).json({ success: true, data: banner });
  } catch (err) { next(err); }
}

export async function updateBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Banner } = await import('./banners.model');
    const banner = await Banner.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean();
    if (!banner) { res.status(404).json({ success: false, message: 'Banner not found' }); return; }
    res.json({ success: true, data: banner });
  } catch (err) { next(err); }
}

export async function deleteBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Banner } = await import('./banners.model');
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Banner deleted' });
  } catch (err) { next(err); }
}

export async function reorderBanners(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Banner } = await import('./banners.model');
    const { order } = req.body as { order: { id: string; position: number }[] };
    if (Array.isArray(order)) {
      await Promise.all(order.map((item) => Banner.findByIdAndUpdate(item.id, { $set: { order: item.position } })));
    }
    res.json({ success: true, message: 'Banners reordered' });
  } catch (err) { next(err); }
}
