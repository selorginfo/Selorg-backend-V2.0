import mongoose from 'mongoose';
import {
  PickerUser, PickerDocument, PickerWorkLocation, PickerTrainingVideo,
  PICKER_DOCUMENT_TYPES, PICKER_TWO_SIDED_DOCUMENT_TYPES, deriveDeliveryMode,
  type PickerDocumentType,
} from './picker.models';
import {
  PickerOnboardingApplication, PickerKitAcknowledgement, KIT_ITEMS,
  ONBOARDING_STEP_KEYS, ONBOARDING_STEP_LABELS, type OnboardingStepKey,
} from './picker.rider.models';
import { AppError } from '../../utils/AppError';
import { pickerConfig, toApiAccountStatus, VEHICLE_LABELS } from './picker.config';
import { distanceDisplay, haversineKm, hasCoords, maskDocumentNumber } from './picker.format';
import { getCashInHand } from './picker.cash.service';
import { storeKycDocument } from './picker.upload.service';
import { ensureOperationalHubs, resolveWarehouseKey } from './picker.hub';
import { DEFAULT_HUB_KEY } from '../orders/fulfillment.service';

/**
 * Rider profile and onboarding (APIs 8–17).
 *
 * The profile response is a curated DTO rather than the raw `PickerUser`, which
 * carries secrets (`sessionToken`, `locationOtp`) that must never reach a client.
 */

// ─── Profile (APIs 8, 9) ──────────────────────────────────────────────────────

export interface RiderProfileDto {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  status: ReturnType<typeof toApiAccountStatus>;
  /** Persisted online presence — HomeScreen restores toggle from this after reload. */
  isOnline: boolean;
  onlineSince: string | null;
  vehicle: { type: string | null; registrationNumber: string | null; label: string | null };
  deliveryMode: 'standard' | 'bulk';
  hub: { id: string | null; name: string | null };
  stats: { totalTrips: number; onTimePercent: number; rating: number | null };
  floatCash: number;
  kycVerified: boolean;
  createdAt: string;
}

async function resolveHub(warehouseKey?: string | null): Promise<{ id: string | null; name: string | null }> {
  if (!warehouseKey) return { id: null, name: null };
  await ensureOperationalHubs();
  const key = await resolveWarehouseKey(warehouseKey, { fallbackToDefault: false });
  if (!key) return { id: null, name: null };
  const hub = (await PickerWorkLocation.findOne({ warehouseKey: key }).select('warehouseKey name').lean()) as { name?: string } | null;
  if (hub) return { id: key, name: hub.name || null };
  if (key === DEFAULT_HUB_KEY) return { id: key, name: 'Adyar Darkstore' };
  return { id: key, name: null };
}

/** True when every required KYC document (including both Aadhaar and PAN sides) is approved. */
export async function isKycVerified(pickerId: string): Promise<boolean> {
  const docs = (await PickerDocument.find({
    userId: new mongoose.Types.ObjectId(pickerId),
    supersededBy: null,
  })
    .select('type side status')
    .lean()) as Array<{ type: string; side?: string | null; status: string }>;

  return PICKER_DOCUMENT_TYPES.every((type) => {
    const required = PICKER_TWO_SIDED_DOCUMENT_TYPES.includes(type) ? ['front', 'back'] : [null];
    return required.every((side) =>
      docs.some((d) => d.type === type && d.status === 'approved' && (side === null || d.side === side)),
    );
  });
}

/**
 * On-time share of rated deliveries. Returns 100 before any delivery so a new
 * rider's Profile shows a neutral figure rather than 0%.
 */
function onTimePercent(onTime: number, late: number): number {
  const total = onTime + late;
  if (total === 0) return 100;
  return Math.round((onTime / total) * 1000) / 10;
}

/** Average rating, withheld until the rider has enough rated trips to be meaningful. */
function averageRating(sum: number, count: number): number | null {
  if (count < pickerConfig.minRatedTripsForRating) return null;
  return Math.round((sum / count) * 10) / 10;
}

export async function getRiderProfile(pickerId: string): Promise<RiderProfileDto> {
  const user = (await PickerUser.findById(pickerId).lean()) as any;
  if (!user) throw AppError.notFound('Picker');

  const [hub, floatCash, kycVerified] = await Promise.all([
    resolveHub(user.currentLocationId),
    getCashInHand(pickerId),
    isKycVerified(pickerId),
  ]);

  return {
    id: String(user._id),
    name: user.name || null,
    email: user.email || null,
    phone: user.phoneIsPlaceholder ? null : user.phone || null,
    photoUrl: user.photoUri || null,
    status: toApiAccountStatus(user.status),
    isOnline: Boolean(user.isOnline),
    onlineSince: user.onlineSince ? new Date(user.onlineSince).toISOString() : null,
    vehicle: {
      type: user.vehicleType || null,
      registrationNumber: user.vehicleRegistrationNumber || null,
      label: user.vehicleType ? VEHICLE_LABELS[user.vehicleType] || String(user.vehicleType).toUpperCase() : null,
    },
    deliveryMode: user.deliveryMode || deriveDeliveryMode(user.vehicleType),
    hub,
    stats: {
      totalTrips: user.totalTrips || 0,
      onTimePercent: onTimePercent(user.onTimeDeliveries || 0, user.lateDeliveries || 0),
      rating: averageRating(user.ratingSum || 0, user.ratingCount || 0),
    },
    floatCash,
    kycVerified,
    createdAt: new Date(user.createdAt).toISOString(),
  };
}

/**
 * Partial profile update. `hubId` writes `currentLocationId` after checking the hub
 * is active, and `deliveryMode` is always recomputed from the vehicle so the rider
 * cannot choose which delivery vertical they see.
 */
export async function updateRiderProfile(
  pickerId: string,
  input: {
    name?: string; email?: string; photoUrl?: string; vehicleType?: string;
    vehicleRegistrationNumber?: string; hubId?: string; age?: number;
    gender?: string; upiId?: string; upiName?: string; locationType?: string;
  },
): Promise<RiderProfileDto> {
  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) updates.name = input.name;
  if (input.email !== undefined) updates.email = input.email;
  if (input.photoUrl !== undefined) updates.photoUri = input.photoUrl;
  if (input.age !== undefined) updates.age = input.age;
  if (input.gender !== undefined) updates.gender = String(input.gender).trim().toLowerCase();
  if (input.upiId !== undefined) updates.upiId = input.upiId;
  if (input.upiName !== undefined) updates.upiName = input.upiName;
  if (input.locationType !== undefined) updates.locationType = String(input.locationType).trim().toLowerCase();

  if (input.vehicleRegistrationNumber !== undefined) {
    // Stored without separators so lookups and comparisons are stable.
    updates.vehicleRegistrationNumber = input.vehicleRegistrationNumber.replace(/[\s-]/g, '').toUpperCase();
  }

  if (input.vehicleType !== undefined) {
    updates.vehicleType = input.vehicleType;
    updates.deliveryMode = deriveDeliveryMode(input.vehicleType);
  }

  if (input.hubId !== undefined) {
    await ensureOperationalHubs();
    const hubKey = await resolveWarehouseKey(input.hubId, { fallbackToDefault: false });
    if (!hubKey) throw AppError.notFound('Hub', input.hubId);
    const hub = (await PickerWorkLocation.findOne({ warehouseKey: hubKey }).select('isActive type').lean()) as { isActive?: boolean; type?: string } | null;
    if (!hub && hubKey !== DEFAULT_HUB_KEY) throw AppError.notFound('Hub', input.hubId);
    if (hub && !hub.isActive) throw AppError.conflict('That hub is no longer active. Please choose another.', 'HUB_INACTIVE');
    updates.currentLocationId = hubKey;
    if (input.locationType === undefined && hub?.type) updates.locationType = hub.type;
  }

  const user = await PickerUser.findByIdAndUpdate(pickerId, updates, { new: true, runValidators: true }).lean();
  if (!user) throw AppError.notFound('Picker');

  return getRiderProfile(pickerId);
}

// ─── Hubs (API 11) ────────────────────────────────────────────────────────────

export interface HubDto {
  id: string;
  name: string;
  /** Picker card title — same as name; additive for the workforce app. */
  title?: string;
  /** Picker card subtitle — distance · address. */
  sub?: string;
  address: string | null;
  type: 'warehouse' | 'darkstore';
  coordinates: { latitude: number | null; longitude: number | null };
  distanceKm: number | null;
  distanceDisplay: string | null;
  dispatchBays: number | null;
  isActive: boolean;
}

const DEFAULT_DARKSTORES: Array<{
  warehouseKey: string;
  name: string;
  address: string;
  type: 'darkstore';
  isActive: boolean;
  coordinates: { latitude: number; longitude: number };
  geo: { type: 'Point'; coordinates: [number, number] };
  geofenceRadius: number;
  dispatchBays: number;
}> = [
  {
    warehouseKey: 'kor',
    name: 'Koramangala Darkstore',
    address: '80 Feet Rd, 4th Block, Koramangala',
    type: 'darkstore',
    isActive: true,
    coordinates: { latitude: 12.9352, longitude: 77.6245 },
    geo: { type: 'Point', coordinates: [77.6245, 12.9352] },
    geofenceRadius: 200,
    dispatchBays: 6,
  },
  {
    warehouseKey: 'hsr',
    name: 'HSR Layout Darkstore',
    address: '27th Main, Sector 2, HSR Layout',
    type: 'darkstore',
    isActive: true,
    coordinates: { latitude: 12.9116, longitude: 77.6473 },
    geo: { type: 'Point', coordinates: [77.6473, 12.9116] },
    geofenceRadius: 200,
    dispatchBays: 4,
  },
  {
    warehouseKey: 'ind',
    name: 'Indiranagar Darkstore',
    address: '100 Feet Rd, Indiranagar',
    type: 'darkstore',
    isActive: true,
    coordinates: { latitude: 12.9784, longitude: 77.6408 },
    geo: { type: 'Point', coordinates: [77.6408, 12.9784] },
    geofenceRadius: 200,
    dispatchBays: 5,
  },
];

/** Bootstraps Bangalore darkstores when the collection is empty (local/dev), and always ensures Adyar. */
async function ensureDefaultHubs(): Promise<void> {
  const count = await PickerWorkLocation.countDocuments();
  if (count === 0) {
    await PickerWorkLocation.insertMany(DEFAULT_DARKSTORES, { ordered: false }).catch(() => undefined);
  }
  await ensureOperationalHubs();
}

/**
 * Active hubs, sorted by proximity when the caller supplies coordinates.
 * Distance is Haversine in application code (hub count is small). `geo` is
 * also indexed 2dsphere for any future `$near` queries.
 */
export async function listHubs(params: {
  type?: string; lat?: number; lng?: number; radiusKm?: number;
}): Promise<HubDto[]> {
  await ensureDefaultHubs();

  const query: Record<string, unknown> = { isActive: true };
  if (params.type) query.type = params.type;

  const locations = (await PickerWorkLocation.find(query).lean()) as Array<{
    warehouseKey: string; name: string; address?: string; type: 'warehouse' | 'darkstore';
    isActive: boolean; coordinates?: { latitude?: number; longitude?: number }; dispatchBays?: number;
  }>;

  const hasOrigin = params.lat != null && params.lng != null;

  const hubs: HubDto[] = locations.map((loc) => {
    const lat = loc.coordinates?.latitude ?? null;
    const lng = loc.coordinates?.longitude ?? null;
    const km = hasOrigin && hasCoords(lat, lng)
      ? Math.round(haversineKm(params.lat as number, params.lng as number, lat as number, lng as number) * 10) / 10
      : null;

    const distance = distanceDisplay(km);
    const address = loc.address || null;
    return {
      id: loc.warehouseKey,
      name: loc.name,
      // Picker app card fields (additive — Rider ignores unused keys)
      title: loc.name,
      sub: [distance, address].filter(Boolean).join(' · ') || loc.name,
      address,
      type: loc.type,
      coordinates: { latitude: lat, longitude: lng },
      distanceKm: km,
      distanceDisplay: distance,
      dispatchBays: loc.dispatchBays ?? null,
      isActive: loc.isActive,
    };
  });

  if (!hasOrigin) return hubs.sort((a, b) => a.name.localeCompare(b.name));

  const radius = params.radiusKm ?? 25;
  return hubs
    // Hubs without coordinates cannot be excluded by radius without hiding them
    // entirely, so they are kept and sorted last.
    .filter((h) => h.distanceKm == null || h.distanceKm <= radius)
    .sort((a, b) => {
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
}

export async function getHubById(hubId: string): Promise<HubDto> {
  const loc = (await PickerWorkLocation.findOne({
    $or: [
      { warehouseKey: hubId },
      ...(mongoose.isValidObjectId(hubId) ? [{ _id: hubId }] : []),
    ],
  }).lean()) as {
    warehouseKey: string; name: string; address?: string; type: 'warehouse' | 'darkstore';
    isActive: boolean; coordinates?: { latitude?: number; longitude?: number }; dispatchBays?: number;
  } | null;
  if (!loc) throw AppError.notFound('Hub', hubId);
  const lat = loc.coordinates?.latitude ?? null;
  const lng = loc.coordinates?.longitude ?? null;
  return {
    id: loc.warehouseKey,
    name: loc.name,
    address: loc.address || null,
    type: loc.type,
    coordinates: { latitude: lat, longitude: lng },
    distanceKm: null,
    distanceDisplay: null,
    dispatchBays: loc.dispatchBays ?? null,
    isActive: loc.isActive,
  };
}

// ─── KYC documents (API 12) ───────────────────────────────────────────────────

const DOCUMENT_DISPLAY_NAMES: Record<string, string> = {
  aadhar: 'Aadhaar card',
  aadhaar: 'Aadhaar card',
  pan: 'PAN card',
  dl: 'Driving licence',
  rc: 'Registration certificate',
  ins: 'Insurance',
};

export interface DocumentDto {
  id: string;
  _id: string;
  type: string;
  side: 'front' | 'back' | null;
  status: 'pending' | 'approved' | 'rejected';
  url: string;
  fileName: string | null;
  uploadedAt: string;
  createdAt: string;
  rejectionReason: string | null;
  /** Picker-app checklist fields — additive, rider ignores them. */
  name: string;
  num: string;
  verified: boolean;
  pending: boolean;
}

function toDocumentDto(doc: any): DocumentDto {
  const id = String(doc._id);
  const type = String(doc.type || '');
  const status = (doc.status || 'pending') as DocumentDto['status'];
  return {
    id,
    _id: id,
    type,
    side: doc.side || null,
    status,
    url: doc.url,
    fileName: doc.fileName || null,
    uploadedAt: new Date(doc.createdAt).toISOString(),
    createdAt: new Date(doc.createdAt).toISOString(),
    rejectionReason: doc.rejectionReason || null,
    name: DOCUMENT_DISPLAY_NAMES[type] || String(type).toUpperCase(),
    num: maskDocumentNumber(doc.documentNumber) || '',
    verified: status === 'approved',
    pending: status === 'pending',
  };
}

/**
 * Stores a KYC document. Re-uploading after a rejection supersedes the earlier row
 * rather than leaving two indistinguishable records; re-uploading an already
 * approved document is refused.
 */
export async function uploadKycDocument(
  pickerId: string,
  input: { type: PickerDocumentType; side?: 'front' | 'back'; fileName?: string; url?: string },
  file?: Express.Multer.File,
): Promise<DocumentDto> {
  const userId = new mongoose.Types.ObjectId(pickerId);
  const twoSided = PICKER_TWO_SIDED_DOCUMENT_TYPES.includes(input.type);
  let side: 'front' | 'back' = twoSided ? (input.side || 'front') : 'front';
  if (twoSided && !input.side) {
    const hasFront = await PickerDocument.exists({ userId, type: input.type, side: 'front', supersededBy: null });
    side = hasFront ? 'back' : 'front';
  }

  const existing = twoSided
    ? await PickerDocument.findOne({ userId, type: input.type, side, supersededBy: null })
    : await PickerDocument.findOne({ userId, type: input.type, supersededBy: null });
  if (existing?.status === 'approved') {
    throw AppError.conflict('This document has already been approved.', 'DOCUMENT_ALREADY_APPROVED');
  }

  let url = input.url;
  let fileName = input.fileName;
  if (file) {
    const stored = await storeKycDocument(file, pickerId, input.type);
    url = stored.url;
    fileName = input.fileName || stored.fileName;
  }
  if (!url) throw AppError.badRequest('A file is required to upload a document');

  const created = await PickerDocument.create({
    userId,
    type: input.type,
    side,
    url,
    fileName,
    status: 'pending',
  });

  if (existing) {
    existing.supersededBy = created._id as mongoose.Types.ObjectId;
    existing.supersededAt = new Date();
    await existing.save();
  }

  return toDocumentDto(created);
}

/** Current documents only — superseded re-uploads are hidden from the rider's list. */
export async function listKycDocuments(pickerId: string): Promise<DocumentDto[]> {
  const docs = await PickerDocument.find({
    userId: new mongoose.Types.ObjectId(pickerId),
    supersededBy: null,
  })
    .sort({ createdAt: -1 })
    .lean();
  return (docs as any[]).map(toDocumentDto);
}

// ─── Kit acknowledgement (API 16) ─────────────────────────────────────────────

export async function acknowledgeKit(
  pickerId: string,
  input: { items: string[]; hubId?: string },
): Promise<{ acknowledged: boolean; items: string[]; acknowledgedAt: string; hubId: string | null; complete: boolean; alreadyAcknowledged: boolean }> {
  const userId = new mongoose.Types.ObjectId(pickerId);
  const existing = await PickerKitAcknowledgement.findOne({ pickerId: userId });

  let hubId = input.hubId;
  if (!hubId) {
    const user = await PickerUser.findById(pickerId).select('currentLocationId').lean();
    hubId = (user as any)?.currentLocationId || undefined;
  }

  // Re-posting is treated as an update rather than a conflict: the rider may tick
  // the remaining items in a second pass, and the sheet toggles both ways.
  const items = Array.from(new Set(input.items));

  const record = existing
    ? await PickerKitAcknowledgement.findOneAndUpdate(
        { pickerId: userId },
        { items, hubKey: hubId, acknowledgedAt: new Date() },
        { new: true },
      )
    : await PickerKitAcknowledgement.create({ pickerId: userId, items, hubKey: hubId, acknowledgedAt: new Date() });

  // Hub step completion checks `user.currentLocationId` — persist it when supplied.
  if (hubId) {
    await ensureOperationalHubs();
    const resolvedHub = await resolveWarehouseKey(hubId, { fallbackToDefault: false });
    const hub = resolvedHub
      ? ((await PickerWorkLocation.findOne({ warehouseKey: resolvedHub }).select('isActive').lean()) as { isActive?: boolean } | null)
      : null;
    if (resolvedHub && ((hub?.isActive !== false && hub) || resolvedHub === DEFAULT_HUB_KEY)) {
      hubId = resolvedHub;
      await PickerUser.findByIdAndUpdate(pickerId, { $set: { currentLocationId: resolvedHub } });
    }
  }

  return {
    acknowledged: true,
    items: record!.items as string[],
    acknowledgedAt: new Date(record!.acknowledgedAt).toISOString(),
    hubId: hubId || null,
    complete: KIT_ITEMS.every((item) => (record!.items as string[]).includes(item)),
    alreadyAcknowledged: Boolean(existing),
  };
}

// ─── Onboarding state (API 10) ────────────────────────────────────────────────

type OnboardingStatus = 'not_started' | 'in_progress' | 'under_review' | 'approved' | 'rejected';

export interface OnboardingStateDto {
  applicationId: string | null;
  status: OnboardingStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  hub: { id: string | null; name: string | null };
  steps: Array<{ key: OnboardingStepKey; label: string; completed: boolean; blockedReason?: string | null }>;
  documents: Array<{ type: PickerDocumentType; status: 'missing' | 'pending' | 'approved' | 'rejected'; rejectionReason: string | null }>;
  kit: { acknowledged: boolean };
  training: { completed: boolean; progressPercent: number };
}

/**
 * Rolls each of the five onboarding steps up to a completed flag. This is the
 * single evaluation used by both `GET /onboarding/state` and the submit guard, so
 * the app can never be shown a step it is then refused for.
 */
async function evaluateSteps(pickerId: string): Promise<{
  steps: OnboardingStateDto['steps'];
  documents: OnboardingStateDto['documents'];
  training: { completed: boolean; progressPercent: number };
  kitAcknowledged: boolean;
  user: any;
}> {
  const userId = new mongoose.Types.ObjectId(pickerId);
  const [user, docs, kit, videos] = await Promise.all([
    PickerUser.findById(pickerId).lean() as Promise<any>,
    PickerDocument.find({ userId, supersededBy: null }).select('type side status rejectionReason').lean() as Promise<any[]>,
    PickerKitAcknowledgement.findOne({ pickerId: userId }).select('items').lean() as Promise<any>,
    PickerTrainingVideo.find({ isActive: true }).select('videoId').lean() as Promise<Array<{ videoId: string }>>,
  ]);
  if (!user) throw AppError.notFound('Picker');

  const documents = PICKER_DOCUMENT_TYPES.map((type) => {
    const rows = docs.filter((d) => d.type === type);
    if (rows.length === 0) return { type, status: 'missing' as const, rejectionReason: null };

    const rejected = rows.find((r) => r.status === 'rejected');
    if (rejected) return { type, status: 'rejected' as const, rejectionReason: rejected.rejectionReason || null };

    // Aadhaar and PAN need both sides present before they count as submitted.
    const sidesNeeded = PICKER_TWO_SIDED_DOCUMENT_TYPES.includes(type) ? ['front', 'back'] : [null];
    const allSidesPresent = sidesNeeded.every((side) => rows.some((r) => (side === null ? true : r.side === side)));
    if (!allSidesPresent) return { type, status: 'missing' as const, rejectionReason: null };

    const allApproved = rows.every((r) => r.status === 'approved');
    return { type, status: allApproved ? ('approved' as const) : ('pending' as const), rejectionReason: null };
  });

  const progress = (user.trainingProgress || {}) as Record<string, number>;
  const progressPercent = videos.length === 0
    ? (user.trainingCompleted ? 100 : 0)
    : Math.round(videos.reduce((sum, v) => sum + Math.min(100, progress[v.videoId] || 0), 0) / videos.length);

  const kitItems: string[] = (kit?.items as string[]) || [];
  const kitAcknowledged = KIT_ITEMS.every((item) => kitItems.includes(item));

  const rejectedCount = documents.filter((d) => d.status === 'rejected').length;
  const missingCount = documents.filter((d) => d.status === 'missing').length;
  const documentsComplete = rejectedCount === 0 && missingCount === 0;

  let documentsBlockedReason: string | null = null;
  if (rejectedCount > 0) {
    documentsBlockedReason = `${rejectedCount} of ${documents.length} documents rejected`;
  } else if (missingCount > 0) {
    documentsBlockedReason = `${missingCount} of ${documents.length} documents pending upload`;
  }

  const completion: Record<OnboardingStepKey, { completed: boolean; blockedReason?: string | null }> = {
    personal: { completed: Boolean(user.name && user.email) },
    vehicle: { completed: Boolean(user.vehicleType && user.vehicleRegistrationNumber) },
    hub: { completed: Boolean(user.currentLocationId) },
    documents: { completed: documentsComplete, blockedReason: documentsBlockedReason },
    training: {
      // No active videos ⇒ video requirement is satisfied; kit ack still required.
      completed: (videos.length === 0 || Boolean(user.trainingCompleted)) && kitAcknowledged,
      blockedReason: videos.length > 0 && !user.trainingCompleted
        ? 'Training video not finished'
        : !kitAcknowledged
          ? 'Kit items not acknowledged'
          : null,
    },
  };

  const steps = ONBOARDING_STEP_KEYS.map((key) => ({
    key,
    label: ONBOARDING_STEP_LABELS[key],
    completed: completion[key].completed,
    blockedReason: completion[key].completed ? null : completion[key].blockedReason ?? null,
  }));

  return { steps, documents, training: { completed: Boolean(user.trainingCompleted), progressPercent }, kitAcknowledged, user };
}

function resolveOnboardingStatus(accountStatus: string, applicationStatus: string | null, anyStepDone: boolean): OnboardingStatus {
  switch (String(accountStatus).toUpperCase()) {
    case 'ACTIVE':
    case 'INACTIVE':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    default:
      if (applicationStatus === 'rejected') return 'rejected';
      if (applicationStatus && applicationStatus !== 'draft') return 'under_review';
      return anyStepDone ? 'in_progress' : 'not_started';
  }
}

export async function getOnboardingState(pickerId: string): Promise<OnboardingStateDto> {
  const [{ steps, documents, training, kitAcknowledged, user }, application] = await Promise.all([
    evaluateSteps(pickerId),
    PickerOnboardingApplication.findOne({ pickerId: new mongoose.Types.ObjectId(pickerId) }).lean() as Promise<any>,
  ]);

  const hub = await resolveHub(application?.hubKey || user.currentLocationId);
  const anyStepDone = steps.some((s) => s.completed);

  return {
    applicationId: application?.applicationId || null,
    status: resolveOnboardingStatus(user.status, application?.status || null, anyStepDone),
    submittedAt: application?.submittedAt ? new Date(application.submittedAt).toISOString() : null,
    reviewedAt: application?.reviewedAt ? new Date(application.reviewedAt).toISOString() : null,
    rejectionReason: user.rejectedReason || application?.rejectionReason || null,
    hub,
    steps,
    documents,
    kit: { acknowledged: kitAcknowledged },
    training,
  };
}

// ─── Submit application (API 17) ──────────────────────────────────────────────

/**
 * Human-quotable application reference, e.g. `SL-RA-2048`. The counter is the
 * number of applications already on record, so ids are sequential and unique;
 * a collision (concurrent submits) is retried against the unique index.
 */
async function generateApplicationId(): Promise<string> {
  const count = await PickerOnboardingApplication.countDocuments();
  return `SL-RA-${2000 + count + 1}`;
}

export async function submitOnboarding(
  pickerId: string,
  input: { acceptedTermsVersion?: string; acceptedPrivacyVersion?: string },
): Promise<{ applicationId: string; status: 'under_review'; submittedAt: string; estimatedReviewHours: number }> {
  const userId = new mongoose.Types.ObjectId(pickerId);
  const { steps, user } = await evaluateSteps(pickerId);

  if (String(user.status).toUpperCase() === 'ACTIVE') {
    throw AppError.conflict('Your account is already approved.', 'ALREADY_APPROVED');
  }

  const existing = await PickerOnboardingApplication.findOne({ pickerId: userId });
  if (existing && existing.status === 'under_review') {
    throw AppError.conflict('Your application is already under review.', 'ALREADY_SUBMITTED');
  }

  const incomplete = steps.filter((s) => !s.completed);
  if (incomplete.length > 0) {
    const detail = incomplete.map((s) => ({
      step: s.key,
      reason: s.blockedReason || `${s.label} is incomplete`,
    }));
    // eslint-disable-next-line no-console
    console.error('[ONBOARDING_INCOMPLETE]', { pickerId, detail });
    throw new AppError(
      'Some onboarding steps are still incomplete.',
      400,
      'ONBOARDING_INCOMPLETE',
      detail,
    );
  }

  const submittedAt = new Date();
  const stepsAtSubmission = Object.fromEntries(steps.map((s) => [s.key, s.completed]));

  let application = existing;
  if (application) {
    application.status = 'under_review';
    application.submittedAt = submittedAt;
    application.hubKey = user.currentLocationId;
    application.stepsAtSubmission = stepsAtSubmission;
    application.reviewedAt = undefined;
    application.rejectionReason = undefined;
    if (input.acceptedTermsVersion) application.acceptedTermsVersion = input.acceptedTermsVersion;
    if (input.acceptedPrivacyVersion) application.acceptedPrivacyVersion = input.acceptedPrivacyVersion;
    await application.save();
  } else {
    application = await PickerOnboardingApplication.create({
      applicationId: await generateApplicationId(),
      pickerId: userId,
      status: 'under_review',
      hubKey: user.currentLocationId,
      submittedAt,
      stepsAtSubmission,
      acceptedTermsVersion: input.acceptedTermsVersion,
      acceptedPrivacyVersion: input.acceptedPrivacyVersion,
    });
  }

  // Mirrored onto the user so the admin review queue and the auth response can
  // read consent without joining the application.
  await PickerUser.updateOne(
    { _id: userId },
    {
      $set: {
        ...(input.acceptedTermsVersion ? { acceptedTermsVersion: input.acceptedTermsVersion } : {}),
        ...(input.acceptedPrivacyVersion ? { acceptedPrivacyVersion: input.acceptedPrivacyVersion } : {}),
      },
    },
  );

  return {
    applicationId: application.applicationId,
    status: 'under_review',
    submittedAt: submittedAt.toISOString(),
    estimatedReviewHours: pickerConfig.estimatedReviewHours,
  };
}
