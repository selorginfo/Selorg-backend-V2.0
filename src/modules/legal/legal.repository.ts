import { LegalDocument, LegalConfig, ILegalDocument, LegalDocType } from './legal.model';

/** Documents created before appTarget existed are treated as customer-facing. */
export const CUSTOMER_TARGET_OR = [{ appTarget: 'customer' }, { appTarget: { $exists: false } }];

export function isCustomerLegalDoc(doc: Pick<ILegalDocument, 'appTarget'> | null): boolean {
  if (!doc) return false;
  return doc.appTarget == null || doc.appTarget === 'customer';
}

export async function findCurrentOrVersioned(type: LegalDocType, version?: string) {
  const filter = version
    ? { type, version, $or: CUSTOMER_TARGET_OR }
    : { type, isCurrent: true, $or: CUSTOMER_TARGET_OR };
  const current = await LegalDocument.findOne(filter).lean();
  if (current || version) return current;
  // Fallback: newest customer-facing doc of this type (handles mis-flagged isCurrent).
  return LegalDocument.findOne({ type, $or: CUSTOMER_TARGET_OR }).sort({ updatedAt: -1 }).lean();
}

export function listLegalDocuments(type?: LegalDocType) {
  const filter: Record<string, unknown> = { $or: CUSTOMER_TARGET_OR };
  if (type) filter.type = type;
  return LegalDocument.find(filter).sort({ type: 1, createdAt: -1 }).lean();
}

export function findLegalDocById(id: string) {
  return LegalDocument.findById(id);
}

export function findLegalDocByIdLean(id: string) {
  return LegalDocument.findById(id).lean();
}

export async function unsetCurrentForType(type: LegalDocType, excludeId?: string) {
  const filter: Record<string, unknown> = { type, isCurrent: true, $or: CUSTOMER_TARGET_OR };
  if (excludeId) filter._id = { $ne: excludeId };
  await LegalDocument.updateMany(filter, { isCurrent: false });
}

export function getLoginLegalConfig() {
  return LegalConfig.findOne({ key: 'login_legal' }).lean();
}

export async function getOrCreateDefaultConfig() {
  let config = await LegalConfig.findOne({ key: 'default' }).lean();
  if (!config) {
    const created = await LegalConfig.create({ key: 'default' });
    config = created.toObject();
  }
  return config;
}

export function updateDefaultConfig(update: Record<string, unknown>) {
  return LegalConfig.findOneAndUpdate({ key: 'default' }, { $set: update }, { new: true, upsert: true, runValidators: true }).lean();
}
