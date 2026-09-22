import { Request, Response, NextFunction } from 'express';
import { getCollectionBySlug } from './collections.service';

export async function getCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const sort = String(req.query.sort || '').trim();

    const data = await getCollectionBySlug(slug, { page, limit, sort });
    if (!data) {
      res.status(404).json({ success: false, message: 'Collection not found' });
      return;
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
