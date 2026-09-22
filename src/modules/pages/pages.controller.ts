import { Request, Response, NextFunction } from 'express';
import { getPageBySlug } from './pages.service';

export async function getPage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params;
    const siteId = (req.query.siteId as string) || (req.headers['x-site-id'] as string) || null;
    const page = await getPageBySlug(slug, siteId);
    if (!page) {
      res.status(404).json({ success: false, message: 'Page not found' });
      return;
    }
    res.status(200).json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
}
