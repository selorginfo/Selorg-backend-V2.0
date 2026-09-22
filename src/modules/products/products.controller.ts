import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import * as productsService from './products.service';
import type { ProductDetailQuery } from './products.validation';

export async function searchProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) throw AppError.badRequest('q must be at least 2 characters');
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const result = await productsService.searchProducts(q, {
      page,
      limit,
      category: req.query.category as string | undefined,
      storeId: req.query.storeId as string | undefined,
    });
    res.status(200).json({ success: true, data: result.products, meta: result.meta });
  } catch (err) {
    next(err);
  }
}

export async function searchSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 1) { res.status(200).json({ success: true, data: [] }); return; }
    const data = await productsService.searchSuggestions(q);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getTrendingSearches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await productsService.getTrendingSearches();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getProductDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id;
    if (!id) throw AppError.badRequest('Product id required');
    const { storeId } = req.query as ProductDetailQuery;
    const data = await productsService.getProductDetail(id, storeId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
