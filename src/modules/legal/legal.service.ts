import { AppError } from '../../utils/AppError';
import { CustomerUser } from '../auth/auth.model';
import * as legalRepo from './legal.repository';
import { ILegalDocument, LegalDocType, LegalDocument } from './legal.model';
import type { CreateLegalDocInput, UpdateLegalDocInput, UpdateLegalConfigInput } from './legal.validation';

function toLoginLegalDto(doc: Awaited<ReturnType<typeof legalRepo.getLoginLegalConfig>>) {
  const defaultDto = {
    preamble: 'By continuing, you agree to our ',
    terms: { label: 'Terms of Service', type: 'in_app' as const, url: null as string | null },
    privacy: { label: 'Privacy Policy', type: 'in_app' as const, url: null as string | null },
    connector: ' and ',
  };
  if (!doc?.loginLegal) return defaultDto;
  const { preamble, terms, privacy, connector } = doc.loginLegal;
  return {
    preamble: preamble ?? defaultDto.preamble,
    terms: {
      label: terms?.label ?? defaultDto.terms.label,
      type: terms?.type === 'url' ? ('url' as const) : ('in_app' as const),
      url: terms?.type === 'url' ? terms?.url ?? null : null,
    },
    privacy: {
      label: privacy?.label ?? defaultDto.privacy.label,
      type: privacy?.type === 'url' ? ('url' as const) : ('in_app' as const),
      url: privacy?.type === 'url' ? privacy?.url ?? null : null,
    },
    connector: connector ?? defaultDto.connector,
  };
}

function toLegalDocumentDto(doc: Pick<ILegalDocument, '_id' | 'version' | 'title' | 'effectiveDate' | 'lastUpdated' | 'contentFormat' | 'content'> | null) {
  if (!doc) return null;
  return {
    id: doc._id ? String(doc._id) : undefined,
    version: doc.version,
    title: doc.title,
    effectiveDate: doc.effectiveDate,
    lastUpdated: doc.lastUpdated,
    contentFormat: doc.contentFormat || 'plain',
    content: doc.content,
  };
}

// --- Customer-facing ---------------------------------------------------------

export async function getLoginLegalConfig() {
  const doc = await legalRepo.getLoginLegalConfig();
  return { loginLegal: toLoginLegalDto(doc) };
}

async function getDocOrThrow(type: LegalDocType, version: string | undefined, notFoundLabel: string) {
  const doc = await legalRepo.findCurrentOrVersioned(type, version);
  if (!doc) throw AppError.notFound(notFoundLabel);
  return toLegalDocumentDto(doc as unknown as ILegalDocument);
}

export function getTerms(version?: string) {
  return getDocOrThrow('terms', version, 'Terms of Service');
}

export function getPrivacy(version?: string) {
  return getDocOrThrow('privacy', version, 'Privacy Policy');
}

export function getLicense(version?: string) {
  return getDocOrThrow('license', version, 'License');
}

export async function acceptLegal(customerId: string, input: { termsVersion?: string; privacyVersion?: string }) {
  const update: Record<string, unknown> = {};
  if (input.termsVersion != null) {
    update.acceptedTermsVersion = input.termsVersion;
    update.acceptedTermsAt = new Date();
  }
  if (input.privacyVersion != null) {
    update.acceptedPrivacyVersion = input.privacyVersion;
    update.acceptedPrivacyAt = new Date();
  }

  const user = await CustomerUser.findByIdAndUpdate(customerId, { $set: update }, { new: true }).lean();
  if (!user) throw AppError.notFound('User');
  return {
    acceptedTermsVersion: user.acceptedTermsVersion ?? input.termsVersion,
    acceptedPrivacyVersion: user.acceptedPrivacyVersion ?? input.privacyVersion,
  };
}

// --- Admin ---------------------------------------------------------------

export function listDocuments(type?: LegalDocType) {
  return legalRepo.listLegalDocuments(type);
}

export async function getDocument(id: string) {
  const doc = await legalRepo.findLegalDocByIdLean(id);
  if (!doc || !legalRepo.isCustomerLegalDoc(doc)) throw AppError.notFound('Document');
  return doc;
}

export async function createDocument(input: CreateLegalDocInput) {
  if (input.isCurrent !== false) {
    await legalRepo.unsetCurrentForType(input.type);
  }
  try {
    return await LegalDocument.create({
      type: input.type,
      version: input.version,
      title: input.title,
      effectiveDate: input.effectiveDate || new Date().toISOString(),
      lastUpdated: input.lastUpdated || new Date().toISOString(),
      contentFormat: input.contentFormat || 'plain',
      content: input.content,
      isCurrent: input.isCurrent !== false,
      appTarget: 'customer',
    });
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw AppError.conflict('Document with this type and version already exists');
    }
    throw err;
  }
}

export async function updateDocument(id: string, input: UpdateLegalDocInput) {
  const existing = await legalRepo.findLegalDocByIdLean(id);
  if (!existing || !legalRepo.isCustomerLegalDoc(existing)) throw AppError.notFound('Document');

  if (input.isCurrent === true) {
    await legalRepo.unsetCurrentForType(existing.type, id);
  }

  const updated = await LegalDocument.findByIdAndUpdate(
    id,
    { $set: { ...input, lastUpdated: new Date().toISOString() } },
    { new: true, runValidators: true },
  ).lean();
  if (!updated) throw AppError.notFound('Document');
  return updated;
}

export async function deleteDocument(id: string) {
  const existing = await legalRepo.findLegalDocById(id);
  if (!existing || !legalRepo.isCustomerLegalDoc(existing)) throw AppError.notFound('Document');
  await existing.deleteOne();
}

export async function setCurrentDocument(id: string) {
  const doc = await legalRepo.findLegalDocById(id);
  if (!doc || !legalRepo.isCustomerLegalDoc(doc)) throw AppError.notFound('Document');
  await legalRepo.unsetCurrentForType(doc.type, id);
  doc.isCurrent = true;
  await doc.save();
  return doc.toObject();
}

export function getDefaultConfig() {
  return legalRepo.getOrCreateDefaultConfig();
}

export function updateDefaultConfig(input: UpdateLegalConfigInput) {
  return legalRepo.updateDefaultConfig(input);
}
