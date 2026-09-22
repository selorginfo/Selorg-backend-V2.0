import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { isDummyCatalogLabel } from '../../utils/catalogHygiene';
import * as faqRepo from './faq.repository';
import { FAQ_CATEGORIES, IFaqItem } from './faq.model';
import type { CreateFaqInput, UpdateFaqInput } from './faq.validation';

function mapFaqItem(item: Pick<IFaqItem, '_id' | 'question' | 'answer' | 'order' | 'category' | 'helpfulCount' | 'notHelpfulCount'>) {
  return {
    id: String(item._id),
    _id: String(item._id),
    question: item.question,
    answer: item.answer,
    order: item.order,
    category: item.category || '',
    helpfulCount: item.helpfulCount || 0,
    notHelpfulCount: item.notHelpfulCount || 0,
  };
}

function categoryCatalog() {
  return FAQ_CATEGORIES.map((name, index) => ({ id: name.toLowerCase().replace(/\s+/g, '_'), name, order: index + 1 }));
}

export function listCategories() {
  return categoryCatalog();
}

export async function listPublicFaqs(category?: string) {
  const normalizedCategory = category && category.trim() ? category.trim() : undefined;
  const items = await faqRepo.listActiveFaqs(normalizedCategory);
  const filtered = items.filter((item) => {
    if (isDummyCatalogLabel(item.question)) return false;
    const answer = String(item.answer || '').trim();
    return !(answer && isDummyCatalogLabel(answer));
  });
  return { items: filtered.map(mapFaqItem), categories: FAQ_CATEGORIES };
}

function parseHelpful(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
  }
  return null;
}

export async function submitFeedback(customerId: string, faqId: string, rawHelpful: unknown) {
  if (!mongoose.Types.ObjectId.isValid(faqId)) throw AppError.badRequest('Invalid FAQ id');
  const helpful = parseHelpful(rawHelpful);
  if (helpful === null) throw AppError.badRequest('helpful must be a boolean (true | false)');

  const faq = await faqRepo.findFaqById(faqId);
  if (!faq || !faq.isActive) throw AppError.notFound('FAQ');

  const existing = await faqRepo.findFeedback(faqId, customerId);
  if (existing) {
    throw new AppError('You have already voted on this FAQ', 409, 'ALREADY_VOTED', {
      faqId: String(faq._id),
      helpful: existing.helpful,
      alreadyVoted: true,
      helpfulCount: faq.helpfulCount || 0,
      notHelpfulCount: faq.notHelpfulCount || 0,
    });
  }

  try {
    await faqRepo.createFeedback(faqId, customerId, helpful);
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw AppError.conflict('You have already voted on this FAQ');
    }
    throw err;
  }

  if (helpful) faq.helpfulCount = (faq.helpfulCount || 0) + 1;
  else faq.notHelpfulCount = (faq.notHelpfulCount || 0) + 1;
  await faq.save();

  return { faqId: String(faq._id), helpful, helpfulCount: faq.helpfulCount, notHelpfulCount: faq.notHelpfulCount };
}

// --- Admin ---------------------------------------------------------------

function normalizeCategory(category?: string): string {
  const value = String(category || '').trim();
  if (!value) return '';
  const match = FAQ_CATEGORIES.find((c) => c.toLowerCase() === value.toLowerCase());
  return match || value;
}

export function listAdminFaqs(filter: { category?: string; isActive?: boolean }) {
  return faqRepo.listAdminFaqs({ ...filter, category: filter.category ? normalizeCategory(filter.category) : undefined });
}

export async function getFaqById(id: string) {
  const item = await faqRepo.findFaqByIdLean(id);
  if (!item) throw AppError.notFound('FAQ item');
  return item;
}

export function createFaq(input: CreateFaqInput) {
  return faqRepo.createFaq({ ...input, category: normalizeCategory(input.category) });
}

export async function updateFaq(id: string, input: UpdateFaqInput) {
  const update = { ...input } as Record<string, unknown>;
  if (update.category !== undefined) update.category = normalizeCategory(update.category as string);
  const updated = await faqRepo.updateFaqById(id, update);
  if (!updated) throw AppError.notFound('FAQ item');
  return updated;
}

export async function deleteFaq(id: string) {
  const deleted = await faqRepo.deleteFaqById(id);
  if (!deleted) throw AppError.notFound('FAQ item');
}
