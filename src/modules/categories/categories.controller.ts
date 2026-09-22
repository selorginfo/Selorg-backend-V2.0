import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as categoriesService from './categories.service';
import type { CategoryDetailQuery, CategoryProductsQuery } from './categories.validation';

export async function listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await categoriesService.listCategories()));
  } catch (err) {
    next(err);
  }
}

export async function listAllCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await categoriesService.listAllCategories()));
  } catch (err) {
    next(err);
  }
}

export async function getCategoryDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { subCategoryId } = req.query as CategoryDetailQuery;
    res.status(200).json(ResponseFormatter.success(await categoriesService.getCategoryDetail(req.params.id, subCategoryId)));
  } catch (err) {
    next(err);
  }
}

export async function getCategoryProductsBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as CategoryProductsQuery;
    const result = await categoriesService.getCategoryProductsBySlug(req.params.slug, {
      sort: q.sort,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      inStock: q.inStock,
      subcategory: q.subcategory,
      storeId: q.storeId,
    });
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function getSubcategoriesByCategorySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await categoriesService.getSubcategoriesByCategorySlug(req.params.slug)));
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Category } = await import('./categories.model');
    const item = await Category.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Category } = await import('./categories.model');
    const body = { ...req.body };
    delete body._id;
    const item = await Category.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Category not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Category } = await import('./categories.model');
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) { next(err); }
}

export async function reorderCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Category } = await import('./categories.model');
    const { order } = req.body as { order: { id: string; position: number }[] };
    if (Array.isArray(order)) {
      await Promise.all(order.map((item) => Category.findByIdAndUpdate(item.id, { $set: { order: item.position } })));
    }
    res.json({ success: true, message: 'Categories reordered' });
  } catch (err) { next(err); }
}
