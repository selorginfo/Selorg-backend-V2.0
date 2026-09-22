import { OnboardingPage } from './onboarding.model';

export function listActivePages() {
  return OnboardingPage.find({ isActive: true }).sort({ order: 1, pageNumber: 1 }).lean();
}

export function findActivePageByNumber(pageNumber: number) {
  return OnboardingPage.findOne({ pageNumber, isActive: true }).lean();
}

export function listAllPages() {
  return OnboardingPage.find().sort({ order: 1, pageNumber: 1 }).lean();
}

export function findPageById(id: string) {
  return OnboardingPage.findById(id);
}

export async function nextPageNumber(): Promise<number> {
  const max = await OnboardingPage.findOne().sort({ pageNumber: -1 }).lean();
  return (max?.pageNumber ?? 0) + 1;
}

export async function nextOrder(): Promise<number> {
  const max = await OnboardingPage.findOne().sort({ order: -1 }).lean();
  return (max?.order ?? 0) + 1;
}

export function createPage(input: {
  pageNumber: number;
  title: string;
  description: string;
  imageUrl: string;
  ctaText?: string;
  isActive: boolean;
  order: number;
}) {
  return OnboardingPage.create(input);
}

export function updatePageById(id: string, updates: Record<string, unknown>) {
  return OnboardingPage.findByIdAndUpdate(id, updates, { new: true }).lean();
}

export function deletePageById(id: string) {
  return OnboardingPage.findByIdAndDelete(id);
}

export function listAllPagesSortedByOrder() {
  return OnboardingPage.find().sort({ order: 1 }).lean();
}

export function bulkWrite(ops: Array<{ updateOne: { filter: { _id: string }; update: { $set: Record<string, unknown> } } }>) {
  return OnboardingPage.bulkWrite(ops);
}
