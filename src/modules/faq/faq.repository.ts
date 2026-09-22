import { FaqItem, FaqFeedback } from './faq.model';

export function listActiveFaqs(category?: string) {
  const filter: Record<string, unknown> = { isActive: true };
  if (category) filter.category = category;
  return FaqItem.find(filter).sort({ order: 1, createdAt: 1 }).select('question answer order category helpfulCount notHelpfulCount').lean();
}

export function listAdminFaqs(filter: { category?: string; isActive?: boolean }) {
  const query: Record<string, unknown> = {};
  if (filter.category) query.category = filter.category;
  if (filter.isActive !== undefined) query.isActive = filter.isActive;
  return FaqItem.find(query).sort({ order: 1, createdAt: 1 }).lean();
}

export function findFaqById(id: string) {
  return FaqItem.findById(id);
}

export function findFaqByIdLean(id: string) {
  return FaqItem.findById(id).lean();
}

export function createFaq(input: { question: string; answer: string; order?: number; category?: string; isActive?: boolean }) {
  return FaqItem.create({
    question: input.question.trim(),
    answer: input.answer.trim(),
    order: input.order ?? 0,
    category: input.category || '',
    isActive: input.isActive !== false,
  });
}

export function updateFaqById(id: string, update: Record<string, unknown>) {
  return FaqItem.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
}

export function deleteFaqById(id: string) {
  return FaqItem.findByIdAndDelete(id);
}

export function findFeedback(faqId: string, userId: string) {
  return FaqFeedback.findOne({ faqId, userId: String(userId) }).lean();
}

export function createFeedback(faqId: string, userId: string, helpful: boolean) {
  return FaqFeedback.create({ faqId, userId: String(userId), helpful });
}
