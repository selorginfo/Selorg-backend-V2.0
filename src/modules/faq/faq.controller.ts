import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import { AppError } from '../../utils/AppError';
import * as faqService from './faq.service';
import type { CreateFaqInput, UpdateFaqInput, SubmitFaqFeedbackInput } from './faq.validation';

// --- Customer-facing ---------------------------------------------------------

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { category } = req.query as { category?: string };
    const { items, categories } = await faqService.listPublicFaqs(category);
    res.json({ success: true, data: items, categories });
  } catch (err) {
    next(err);
  }
}

export function listCategories(_req: Request, res: Response): void {
  res.json({ success: true, data: faqService.listCategories() });
}

export async function submitFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const { helpful } = req.body as SubmitFaqFeedbackInput;
    const result = await faqService.submitFeedback(req.customer._id, req.params.id, helpful);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// --- Admin ---------------------------------------------------------------

export async function adminList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { category, isActive } = req.query as { category?: string; isActive?: 'true' | 'false' };
    const items = await faqService.listAdminFaqs({ category, isActive: isActive === undefined ? undefined : isActive === 'true' });
    res.json({ success: true, data: items, categories: faqService.listCategories().map((c) => c.name) });
  } catch (err) {
    next(err);
  }
}

export async function adminGetById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await faqService.getFaqById(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function adminCreate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await faqService.createFaq(req.body as CreateFaqInput);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function adminUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await faqService.updateFaq(req.params.id, req.body as UpdateFaqInput);
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function adminDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await faqService.deleteFaq(req.params.id);
    res.json({ success: true, message: 'FAQ item deleted' });
  } catch (err) {
    next(err);
  }
}
