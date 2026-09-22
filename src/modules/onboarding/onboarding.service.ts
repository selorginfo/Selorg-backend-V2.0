import { AppError } from '../../utils/AppError';
import { CustomerUser } from '../auth/auth.model';
import { uploadBase64ImageToS3 } from '../../services/s3.service';
import * as onboardingRepo from './onboarding.repository';
import { IOnboardingPage } from './onboarding.model';
import type { CreateOnboardingPageInput, UpdateOnboardingPageInput } from './onboarding.validation';

function toPageDto(doc: Pick<IOnboardingPage, '_id' | 'pageNumber' | 'title' | 'description' | 'imageUrl' | 'ctaText' | 'isActive' | 'order' | 'createdAt' | 'updatedAt'>) {
  return {
    _id: String(doc._id),
    pageNumber: doc.pageNumber,
    title: doc.title,
    description: doc.description,
    imageUrl: doc.imageUrl,
    ...(doc.ctaText != null && { ctaText: doc.ctaText }),
    ...(doc.isActive != null && { isActive: doc.isActive }),
    ...(doc.order != null && { order: doc.order }),
    ...(doc.createdAt && { createdAt: doc.createdAt.toISOString() }),
    ...(doc.updatedAt && { updatedAt: doc.updatedAt.toISOString() }),
  };
}

function toStatusDto(completed: boolean, completedAt: Date | null) {
  return { onboardingCompleted: completed, onboardingCompletedAt: completedAt ? completedAt.toISOString() : null };
}

// --- Customer-facing ---------------------------------------------------------

export async function getPages() {
  const pages = await onboardingRepo.listActivePages();
  return pages.map((p) => toPageDto(p as unknown as IOnboardingPage));
}

export async function getPageByNumber(pageNumber: number) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw AppError.badRequest('Invalid page number');
  const page = await onboardingRepo.findActivePageByNumber(pageNumber);
  if (!page) throw AppError.notFound('Page');
  return toPageDto(page as unknown as IOnboardingPage);
}

export async function completeOnboarding(customerId?: string) {
  if (customerId) {
    const user = await CustomerUser.findByIdAndUpdate(customerId, { onboardingCompleted: true, onboardingCompletedAt: new Date() }, { new: true }).lean();
    if (user) {
      const completedAt = user.onboardingCompletedAt instanceof Date ? user.onboardingCompletedAt : null;
      return toStatusDto(true, completedAt);
    }
  }
  return toStatusDto(true, null);
}

export async function getStatus(customerId?: string) {
  if (customerId) {
    const user = await CustomerUser.findById(customerId).lean();
    if (user) {
      const completedAt = user.onboardingCompletedAt instanceof Date ? user.onboardingCompletedAt : null;
      return toStatusDto(!!user.onboardingCompleted, completedAt);
    }
  }
  return toStatusDto(false, null);
}

// --- Admin ---------------------------------------------------------------

function toAdminDto(doc: IOnboardingPage) {
  return {
    _id: String(doc._id),
    pageNumber: doc.pageNumber,
    title: doc.title,
    description: doc.description,
    imageUrl: doc.imageUrl,
    ctaText: doc.ctaText ?? null,
    isActive: doc.isActive ?? true,
    order: doc.order ?? doc.pageNumber,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

export async function adminList() {
  const pages = await onboardingRepo.listAllPages();
  return pages.map((p) => toAdminDto(p as unknown as IOnboardingPage));
}

export async function adminCreate(input: CreateOnboardingPageInput) {
  const [pageNumber, order] = await Promise.all([onboardingRepo.nextPageNumber(), onboardingRepo.nextOrder()]);
  const page = await onboardingRepo.createPage({
    pageNumber,
    title: input.title,
    description: input.description,
    imageUrl: input.imageUrl || '',
    ctaText: input.ctaText || undefined,
    isActive: input.isActive !== false,
    order,
  });
  return toAdminDto(page.toObject());
}

const UPDATABLE_FIELDS = ['title', 'description', 'imageUrl', 'ctaText', 'isActive', 'order', 'pageNumber'] as const;

export async function adminUpdate(id: string, input: UpdateOnboardingPageInput) {
  const updates: Record<string, unknown> = {};
  for (const key of UPDATABLE_FIELDS) {
    if (input[key] !== undefined) updates[key] = input[key];
  }
  const page = await onboardingRepo.updatePageById(id, updates);
  if (!page) throw AppError.notFound('Onboarding page');
  return toAdminDto(page as unknown as IOnboardingPage);
}

async function renumberSequentially(pages: Array<{ _id: unknown }>) {
  const tempOps = pages.map((p, idx) => ({ updateOne: { filter: { _id: String(p._id) }, update: { $set: { pageNumber: 10000 + idx, order: idx + 1 } } } }));
  await onboardingRepo.bulkWrite(tempOps);
  const finalOps = pages.map((p, idx) => ({ updateOne: { filter: { _id: String(p._id) }, update: { $set: { pageNumber: idx + 1 } } } }));
  await onboardingRepo.bulkWrite(finalOps);
}

export async function adminRemove(id: string) {
  const page = await onboardingRepo.deletePageById(id);
  if (!page) throw AppError.notFound('Onboarding page');

  const remaining = await onboardingRepo.listAllPagesSortedByOrder();
  if (remaining.length > 0) await renumberSequentially(remaining);
}

export async function adminReorder(order: string[]) {
  const tempOps = order.map((id, idx) => ({ updateOne: { filter: { _id: id }, update: { $set: { pageNumber: 10000 + idx, order: idx + 1 } } } }));
  await onboardingRepo.bulkWrite(tempOps);
  const finalOps = order.map((id, idx) => ({ updateOne: { filter: { _id: id }, update: { $set: { pageNumber: idx + 1 } } } }));
  await onboardingRepo.bulkWrite(finalOps);

  const pages = await onboardingRepo.listAllPagesSortedByOrder();
  return pages.map((p) => toAdminDto(p as unknown as IOnboardingPage));
}

export async function adminUploadImage(id: string, base64Image: string) {
  const page = await onboardingRepo.findPageById(id);
  if (!page) throw AppError.notFound('Onboarding page');

  const bucket = process.env.AWS_S3_BUCKET || 'selorg-assets';
  const imageUrl = await uploadBase64ImageToS3(base64Image, bucket, 'onboarding');
  page.imageUrl = imageUrl;
  await page.save();
  return { imageUrl };
}
