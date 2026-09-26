import mongoose from 'mongoose';
import {
  PickerUser, PickerDocument, PickerWorkLocation, PickerShift, PickerShiftAssignment,
  PickerAttendance, PickerWallet, PickerTransaction, PickerWithdrawalRequest,
  PickerBankAccount, PickerDevice, PickerNotification, PickerTrainingVideo,
  PickerIssue, pickerDisplayRole, effectiveWorkforceRole,
} from './picker.models';
import { PickerOnboardingApplication } from './picker.rider.models';
import { HHDOrder } from '../hhd/hhd.models';
import { Order } from '../orders/order.model';
import { DEFAULT_HUB_KEY } from '../orders/fulfillment.service';
import { AppError } from '../../utils/AppError';
import { pickerConfig } from './picker.config';
import {
  resolveSalaryConfig,
  computeShiftBreakdown,
  computeMonthlyPayroll,
  dailySalary as calcDailySalary,
  otHourlyRate as calcOtHourlyRate,
  otAmountFromMinutes,
  hubYearMonth,
  isWeekOffDateKey,
  roundRate,
} from './picker.salary';
import {
  ensureDarkstoreDeviceOtp,
  ensurePickerDeviceOtp,
  findDeviceByCollectionOtp,
  pickerStoreKeys,
  resolveCollectableDevice,
  rotateDeviceOtp,
} from './hsd-collection-otp';
import { storePickerUpload } from './picker.upload.service';
import * as shiftService from './picker.shift.service';
import * as supportService from './picker.support.service';
import * as pickerService from './picker.service';
import {
  rupees, haversineKm, hasCoords, timeRangeDisplay, formatHhMm, dateDisplay,
  monthLabel, hoursMinutesDisplay, elapsedClock, relativeTimeAgo, formatPhoneDisplay,
  memberSinceDisplay, parseYearMonth, maskAccountNumber, bankLabel, maskDocumentNumber,
  titleCase, hubDayStart, hubDayEnd, hubDateKey, hubMonthBounds, durationDisplay,
} from './picker.format';

/**
 * Workforce picker-app contract layer. Shapes responses for Selorg PickerApp V1.3
 * without replacing rider-app DTOs used by `/profile` and other rider routes.
 */

const OT_RATE_LABEL = `${pickerConfig.overtimeMultiplier}x`;
const AADHAAR_RE = /^\d{12}$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
const PINCODE_RE = /^\d{6}$/;
const NOTIFICATION_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  approval: { icon: 'check', color: '#1E8E43', bg: '#EAF5EC' },
  payout: { icon: 'wallet', color: '#0E8F8A', bg: '#E0F2F0' },
  incentive: { icon: 'zap', color: '#E8A317', bg: '#FCF2DC' },
  shift: { icon: 'cal', color: '#1E8E43', bg: '#EAF5EC' },
  device: { icon: 'phoneDevice', color: '#0E8F8A', bg: '#E0F2F0' },
  system: { icon: 'bell', color: '#5E6E63', bg: '#EFF3EE' },
};

export type AppOnboardingState = 'ONBOARDING' | 'ACTIVE' | 'REJECTED' | 'BLOCKED' | 'SUSPENDED';

function oid(id: string) {
  return new mongoose.Types.ObjectId(id);
}

function initialsFromName(name?: string | null): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function firstName(name?: string | null): string | null {
  if (!name) return null;
  return name.trim().split(/\s+/)[0] || null;
}

function normalizeGender(value?: string | null): 'male' | 'female' | 'other' | undefined {
  if (!value) return undefined;
  const g = String(value).trim().toLowerCase();
  if (g === 'male' || g === 'female' || g === 'other') return g;
  throw AppError.validation('gender must be Male, Female or Other', [{ field: 'gender', message: 'Must be Male, Female or Other' }]);
}

function genderDisplay(value?: string | null): string | null {
  return titleCase(value);
}

function normalizeLocationType(value?: string | null): 'warehouse' | 'darkstore' {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'warehouse' || v === 'darkstore') return v;
  throw AppError.badRequest('locationType must be warehouse or darkstore');
}

function mapAccountStatus(status?: string | null): AppOnboardingState {
  switch (String(status || '').toUpperCase()) {
    case 'ACTIVE': return 'ACTIVE';
    case 'REJECTED': return 'REJECTED';
    case 'SUSPENDED': return 'SUSPENDED';
    case 'BLOCKED':
    case 'INACTIVE':
    case 'DELETION_PENDING': return 'BLOCKED';
    default: return 'ONBOARDING';
  }
}

function mapPickerStatus(status?: string | null): string {
  const s = String(status || 'PENDING').toUpperCase();
  if (s === 'INACTIVE') return 'BLOCKED';
  if (s === 'DELETION_PENDING') return 'DELETION_PENDING';
  return s;
}

function dobString(d?: Date | string | null): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseDob(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw AppError.validation('dob must be YYYY-MM-DD', [{ field: 'dob', message: 'Must be YYYY-MM-DD' }]);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const age = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 18) throw AppError.validation('Must be at least 18 years old', [{ field: 'dob', message: 'Must be at least 18 years old' }]);
  return date;
}

function tenDigitPhone(value?: string | null): string | undefined {
  if (value == null || value === '') return undefined;
  const digits = String(value).replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) throw AppError.validation('Must be a 10-digit phone number', [{ field: 'phone', message: 'Must be a 10-digit phone number' }]);
  return digits;
}

function parseHhMmToMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(String(hhmm).trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function hubMinutesNow(date = new Date()): number {
  const shifted = new Date(date.getTime() + 330 * 60000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function readCoords(body?: Record<string, unknown> | null): { latitude: number; longitude: number } | undefined {
  if (!body) return undefined;
  const nested = body.location as { latitude?: number; longitude?: number } | undefined;
  const lat = Number(nested?.latitude ?? body.latitude ?? body.lat);
  const lng = Number(nested?.longitude ?? body.longitude ?? body.lng);
  if (!hasCoords(lat, lng)) return undefined;
  return { latitude: lat, longitude: lng };
}

async function resolveHub(warehouseKey?: string | null) {
  if (!warehouseKey) return null;
  const { ensureOperationalHubs, ADYAR_HUB, resolveWarehouseKey } = await import('./picker.hub');
  await ensureOperationalHubs();
  const key = (await resolveWarehouseKey(warehouseKey, { fallbackToDefault: true })) || warehouseKey;
  const hub = await PickerWorkLocation.findOne({ warehouseKey: key }).lean() as {
    warehouseKey: string; name: string; address?: string;
    coordinates?: { latitude?: number; longitude?: number }; geofenceRadius?: number;
  } | null;
  if (!hub) return null;
  // Guarantee Adyar has usable GPS even if a partial document slipped through.
  if (
    hub.warehouseKey === ADYAR_HUB.warehouseKey &&
    !hasCoords(hub.coordinates?.latitude, hub.coordinates?.longitude)
  ) {
    return {
      ...hub,
      name: hub.name || ADYAR_HUB.name,
      address: hub.address || ADYAR_HUB.address,
      coordinates: ADYAR_HUB.coordinates,
      geofenceRadius: hub.geofenceRadius ?? ADYAR_HUB.geofenceRadius,
    };
  }
  return hub;
}

async function getOrCreateWallet(userId: string) {
  const id = oid(userId);
  let wallet = await PickerWallet.findOne({ userId: id });
  if (!wallet) wallet = await PickerWallet.create({ userId: id });
  return wallet;
}

function nextPayDate(from = new Date()): Date {
  const day = pickerConfig.payoutDayOfMonth;
  const shifted = new Date(from.getTime() + 330 * 60000);
  let y = shifted.getUTCFullYear();
  let m = shifted.getUTCMonth();
  if (shifted.getUTCDate() >= day) m += 1;
  if (m > 11) { m = 0; y += 1; }
  return new Date(Date.UTC(y, m, day) - 330 * 60000);
}

function scheduledMinutes(shift?: { startTime?: string; endTime?: string } | null): number {
  const start = parseHhMmToMinutes(shift?.startTime);
  const end = parseHhMmToMinutes(shift?.endTime);
  if (start == null || end == null) return pickerConfig.standardShiftMinutes || pickerConfig.defaultShiftMinutes;
  return end > start ? end - start : end + 24 * 60 - start;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getAppProfile(pickerId: string) {
  const user = await PickerUser.findById(pickerId).lean() as any;
  if (!user) throw AppError.notFound('User');
  if (effectiveWorkforceRole(user) !== 'picker') {
    throw AppError.forbidden('Rider accounts cannot access picker profile.', 'ROLE_MISMATCH');
  }
  const assignment = await resolveTodaysAssignment(pickerId).catch(() => null);
  const warehouseKey =
    (assignment as any)?.warehouseKey ||
    (assignment as any)?.shiftId?.warehouseKey ||
    user.currentLocationId;
  const hub = await resolveHub(warehouseKey || user.currentLocationId);
  return {
    id: user.employment?.employeeId || String(user._id).slice(-4),
    name: user.name || null,
    phone: user.phoneIsPlaceholder ? null : formatPhoneDisplay(user.phone),
    email: user.email || null,
    status: mapPickerStatus(user.status),
    memberSince: user.createdAt ? memberSinceDisplay(new Date(user.createdAt)) : null,
    hub: hub?.name || null,
    role: pickerDisplayRole(user),
    workforceRole: effectiveWorkforceRole(user),
    photoUri: user.photoUri || null,
    dob: dobString(user.dob),
    gender: genderDisplay(user.gender),
    altPhone: user.altPhone || null,
    address: user.address || null,
    city: user.city || null,
    pincode: user.pincode || null,
    emergencyContact: {
      name: user.emergencyContact?.name || null,
      phone: user.emergencyContact?.phone || null,
      relation: user.emergencyContact?.relation || null,
    },
    upiId: user.upiId || null,
    upiPayoutVerificationStatus: user.upiPayoutVerificationStatus || 'none',
    upiPayoutRejectionReason: user.upiPayoutRejectionReason || null,
    upiPayoutSubmittedAt: user.upiPayoutSubmittedAt ? new Date(user.upiPayoutSubmittedAt).toISOString() : null,
  };
}

const PROFILE_ALLOWED = new Set([
  'name', 'dob', 'gender', 'email', 'altPhone', 'address', 'city', 'pincode',
  'emgName', 'emgPhone', 'emgRel', 'photoUri', 'photoUrl', 'age', 'locationType',
  'upiId', 'upiName', 'upi',
]);

export async function updateAppProfile(pickerId: string, body: Record<string, unknown>) {
  const unknown = Object.keys(body || {}).filter((k) => !PROFILE_ALLOWED.has(k));
  if (unknown.length) throw AppError.badRequest(`Unknown field: ${unknown[0]}`);

  const user = await PickerUser.findById(pickerId);
  if (!user) throw AppError.notFound('User');

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 100) throw AppError.validation('Invalid name', [{ field: 'name', message: '1–100 characters' }]);
    updates.name = name;
  }
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw AppError.validation('Invalid email', [{ field: 'email', message: 'Enter a valid email address' }]);
    }
    if (email) {
      const clash = await PickerUser.findOne({ email, _id: { $ne: user._id } }).select('_id').lean();
      if (clash) throw AppError.conflict('That email is already registered.', 'EMAIL_IN_USE');
    }
    updates.email = email || null;
  }
  if (body.dob !== undefined) {
    const dob = parseDob(String(body.dob));
    updates.dob = dob;
    updates.age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
  }
  if (body.gender !== undefined) updates.gender = normalizeGender(String(body.gender));
  if (body.altPhone !== undefined) {
    const alt = tenDigitPhone(String(body.altPhone));
    if (alt && !user.phoneIsPlaceholder && alt === String(user.phone).replace(/\D/g, '').slice(-10)) {
      throw AppError.validation('Alternate phone must differ from the login phone', [{ field: 'altPhone', message: 'Must differ from your login phone' }]);
    }
    updates.altPhone = alt || null;
  }
  if (body.address !== undefined) updates.address = String(body.address).slice(0, 250);
  if (body.city !== undefined) updates.city = String(body.city).slice(0, 100);
  if (body.pincode !== undefined) {
    const pin = String(body.pincode).trim();
    if (pin && !PINCODE_RE.test(pin)) throw AppError.validation('Invalid pincode', [{ field: 'pincode', message: 'Must be 6 digits' }]);
    updates.pincode = pin || null;
  }
  if (body.photoUri !== undefined || body.photoUrl !== undefined) {
    updates.photoUri = body.photoUri || body.photoUrl;
  }
  if (body.locationType !== undefined) updates.locationType = normalizeLocationType(String(body.locationType));

  const emg: Record<string, unknown> = { ...(user.emergencyContact || {}) };
  let emgTouched = false;
  if (body.emgName !== undefined) { emg.name = String(body.emgName).slice(0, 100); emgTouched = true; }
  if (body.emgPhone !== undefined) { emg.phone = tenDigitPhone(String(body.emgPhone)) || null; emgTouched = true; }
  if (body.emgRel !== undefined) {
    const rel = String(body.emgRel);
    if (!['Spouse', 'Parent', 'Sibling', 'Friend'].includes(rel)) {
      throw AppError.validation('Invalid relation', [{ field: 'emgRel', message: 'Must be Spouse, Parent, Sibling or Friend' }]);
    }
    emg.relation = rel;
    emgTouched = true;
  }
  if (emgTouched) updates.emergencyContact = emg;

  await PickerUser.updateOne({ _id: user._id }, { $set: updates });
  await markOnboardingStep(pickerId, 1);
  return getAppProfile(pickerId);
}

export async function getProfileOverview(pickerId: string) {
  const [profile, device, bank, docs, user] = await Promise.all([
    getAppProfile(pickerId),
    PickerDevice.findOne({ assignedTo: oid(pickerId), status: 'assigned' }).lean() as Promise<any>,
    PickerBankAccount.findOne({ userId: oid(pickerId), isPrimary: true }).lean() as Promise<any>
      || PickerBankAccount.findOne({ userId: oid(pickerId) }).lean() as Promise<any>,
    PickerDocument.find({ userId: oid(pickerId), supersededBy: null }).lean() as Promise<any[]>,
    PickerUser.findById(pickerId).select('trainingProgress trainingCompleted').lean() as Promise<any>,
  ]);
  const primaryBank = Array.isArray(bank) ? bank[0] : bank;
  const videos = await PickerTrainingVideo.find({ isActive: true }).select('videoId').lean() as Array<{ videoId: string }>;
  const progress = (user?.trainingProgress || {}) as Record<string, number>;
  const done = videos.filter((v) => (progress[v.videoId] || 0) >= 100).length;
  const verified = docs.filter((d) => d.status === 'approved').map((d) => d.type);
  const docLabel = verified.length
    ? `${verified.map((t) => (t === 'aadhar' || t === 'aadhaar' ? 'Aadhaar' : String(t).toUpperCase())).join(', ')} · verified`
    : null;

  return {
    profile: { id: profile.id, name: profile.name, status: profile.status, hub: profile.hub, role: profile.role },
    menu: {
      device: device ? `${device.deviceId} · Assigned` : null,
      personalInfo: 'Phone, address & emergency',
      workHistory: 'Attendance & shift records',
      documents: docLabel,
      bank: primaryBank ? bankLabel(primaryBank.bankName, primaryBank.accountNumber) : null,
      payouts: 'Earnings & payment history',
      training: videos.length ? `${done} of ${videos.length} modules complete` : null,
      support: 'Help, FAQs & notifications',
    },
  };
}

export async function setLocationType(pickerId: string, locationType: string) {
  const normalized = normalizeLocationType(locationType);
  await PickerUser.findByIdAndUpdate(pickerId, { locationType: normalized });
  await markOnboardingStep(pickerId, 2);
  return { locationType: normalized };
}

export async function setUpi(pickerId: string, upiRaw?: string) {
  const upi = String(upiRaw || '').trim();
  if (!UPI_RE.test(upi)) throw AppError.badRequest('Enter a valid UPI ID');
  const user = await PickerUser.findByIdAndUpdate(
    pickerId,
    {
      upiId: upi,
      upiPayoutVerificationStatus: 'pending',
      upiPayoutRejectionReason: '',
      upiPayoutSubmittedAt: new Date(),
      upiPayoutReviewedAt: null,
      upiPayoutReviewedBy: null,
    },
    { new: true },
  ).lean() as any;
  if (!user) throw AppError.notFound('User');
  return {
    upiId: user.upiId,
    upiName: user.upiName || null,
    upiPayoutVerificationStatus: user.upiPayoutVerificationStatus,
    upiPayoutRejectionReason: user.upiPayoutRejectionReason || null,
    upiPayoutSubmittedAt: user.upiPayoutSubmittedAt ? new Date(user.upiPayoutSubmittedAt).toISOString() : null,
  };
}

// ─── Onboarding state ─────────────────────────────────────────────────────────

async function markOnboardingStep(pickerId: string, step: number) {
  const user = await PickerUser.findById(pickerId).select('onboarding').lean() as any;
  const completed: number[] = Array.from(new Set([...(user?.onboarding?.completedSteps || []), step])).sort((a, b) => a - b);
  const currentStep = Math.min(8, Math.max(step + 1, user?.onboarding?.currentStep || 1));
  await PickerUser.updateOne({ _id: oid(pickerId) }, {
    $set: { 'onboarding.completedSteps': completed, 'onboarding.currentStep': currentStep },
  });
}

type VerificationTone = 'Done' | 'Verifying' | 'Pending';

function verificationItem(key: string, label: string, tone: VerificationTone) {
  return { key, label, status: tone, done: tone === 'Done' };
}

function findIdentityDoc(docs: any[], types: string[]) {
  const wanted = new Set(types.map((t) => t.toLowerCase()));
  return docs.find((d) => wanted.has(String(d.type || '').toLowerCase()));
}

function kycTone(doc?: any): VerificationTone {
  if (!doc) return 'Pending';
  const s = String(doc.status || '').toLowerCase();
  if (s === 'approved') return 'Done';
  if (s === 'rejected') return 'Pending';
  return 'Verifying';
}

function combineKycTone(aadhaar: VerificationTone, pan: VerificationTone): VerificationTone {
  if (aadhaar === 'Done' && pan === 'Done') return 'Done';
  if (aadhaar === 'Pending' && pan === 'Pending') return 'Pending';
  return 'Verifying';
}

function faceTone(faceStatus?: string | null, submitted?: boolean, hasImage?: boolean): VerificationTone {
  const f = String(faceStatus || '').toLowerCase();
  if (f === 'verified' || f === 'overridden_approved') return 'Done';
  if (submitted || hasImage) return 'Verifying';
  return 'Pending';
}

function approvalTone(accountState: AppOnboardingState, submitted?: boolean): VerificationTone {
  if (accountState === 'ACTIVE') return 'Done';
  if (submitted) return 'Pending';
  return 'Pending';
}

/**
 * Auto-activates a picker who submitted for review once the short review
 * window has elapsed. Status polling from the app is the trigger, so the
 * under-review screen can animate under review → pending → successful.
 */
export async function autoApproveSubmittedPicker(pickerId: string): Promise<boolean> {
  const delayMs = pickerConfig.autoApproveAfterMs;
  if (delayMs < 0) return false;

  const user = await PickerUser.findById(pickerId);
  if (!user) return false;
  if (String(user.status || '').toUpperCase() !== 'PENDING') return false;

  const submittedAt = user.onboarding?.submittedForReviewAt;
  if (!submittedAt) return false;
  if (Date.now() - new Date(submittedAt).getTime() < delayMs) return false;

  const now = new Date();
  user.status = 'ACTIVE';
  user.approvedAt = now;
  user.faceVerificationStatus = 'verified';
  await user.save();

  await Promise.all([
    PickerDocument.updateMany(
      { userId: oid(pickerId), supersededBy: null, status: 'pending' },
      { $set: { status: 'approved' } },
    ),
    PickerOnboardingApplication.updateOne(
      { pickerId: oid(pickerId), status: 'under_review' },
      { $set: { status: 'approved', reviewedAt: now } },
    ),
  ]);
  return true;
}

export async function getAppOnboardingState(pickerId: string) {
  await autoApproveSubmittedPicker(pickerId);
  const user = await PickerUser.findById(pickerId).lean() as any;
  if (!user) throw AppError.notFound('Picker');
  const state = mapAccountStatus(user.status);
  const accountStatus = mapPickerStatus(user.status);
  const completedSteps: number[] = user.onboarding?.completedSteps || [];
  const submittedForReviewAt = user.onboarding?.submittedForReviewAt
    ? new Date(user.onboarding.submittedForReviewAt).toISOString()
    : null;

  const [docs, bank, device] = await Promise.all([
    PickerDocument.find({ userId: oid(pickerId), supersededBy: null })
      .select('type status url documentNumber')
      .lean() as Promise<any[]>,
    PickerBankAccount.findOne({ userId: oid(pickerId) }).select('_id').lean(),
    PickerDevice.findOne({ assignedTo: oid(pickerId), status: 'assigned' }).select('_id deviceId').lean() as Promise<any>,
  ]);

  const aadhaar = findIdentityDoc(docs, ['aadhar', 'aadhaar']);
  const pan = findIdentityDoc(docs, ['pan']);
  const documentsSubmitted = Boolean(
    aadhaar || pan || docs.length > 0 || completedSteps.includes(6),
  );
  const submitted = Boolean(submittedForReviewAt);
  const verification = [
    verificationItem('documents', 'Documents submitted', documentsSubmitted ? 'Done' : 'Pending'),
    verificationItem('kyc', 'Aadhaar & PAN KYC', combineKycTone(kycTone(aadhaar), kycTone(pan))),
    verificationItem('face', 'Face verification', faceTone(user.faceVerificationStatus, submitted, Boolean(user.faceImageUrl))),
    verificationItem('approval', 'Interview approval', approvalTone(state, submitted)),
  ];

  const bankDetailsComplete = Boolean(bank);
  const deviceCollected = Boolean(device || user.activeDeviceId);
  let nextAction: 'bank_details' | 'collect_device' | 'enter_app' | null = null;
  if (state === 'ACTIVE') {
    if (!bankDetailsComplete) nextAction = 'bank_details';
    else if (!deviceCollected) nextAction = 'collect_device';
    else nextAction = 'enter_app';
  }

  const rejectionReason = user.rejectedReason || null;
  const restricted = state === 'REJECTED' || state === 'BLOCKED' || state === 'SUSPENDED';

  return {
    state,
    accountStatus,
    step: user.onboarding?.currentStep || 1,
    completedSteps,
    submittedForReviewAt,
    rejectionReason,
    statusMessage: restricted ? rejectionReason : null,
    verification,
    nextAction,
    bankDetailsComplete,
    deviceCollected,
    canReapply: state === 'REJECTED',
  };
}

// ─── Work locations / shifts / training view models ───────────────────────────

export async function listWorkLocationCards(params: { type?: string; lat?: number; lng?: number }) {
  const query: Record<string, unknown> = { isActive: true };
  if (params.type) query.type = String(params.type).toLowerCase();
  const locations = await PickerWorkLocation.find(query).lean() as any[];
  const origin = hasCoords(params.lat, params.lng);
  return locations.map((loc) => {
    const lat = loc.coordinates?.latitude;
    const lng = loc.coordinates?.longitude;
    let distance: string | null = null;
    if (origin && hasCoords(lat, lng)) {
      const km = haversineKm(params.lat as number, params.lng as number, lat, lng);
      distance = `${(Math.round(km * 10) / 10).toFixed(1)} km`;
    }
    const address = loc.address || '';
    return {
      id: loc.warehouseKey || String(loc._id),
      title: loc.name,
      sub: [distance, address].filter(Boolean).join(' · ') || loc.name,
      name: loc.name,
      address: loc.address || null,
      type: loc.type,
    };
  });
}

export async function listAvailableShiftCards(pickerId: string, query: { warehouseKey?: string; date?: string } = {}) {
  const slots = await shiftService.listAvailableShifts(pickerId, query);
  return slots.map((s) => ({
    ...s,
    title: `${s.label} · ${s.timeDisplay}`,
    sub: `${s.remainingSlots} slot${s.remainingSlots === 1 ? '' : 's'} open`,
    isBookedByMe: Boolean(s.booked),
  }));
}

export async function listTrainingModules(warehouseKey?: string) {
  const videos = await pickerService.listTrainingVideos(warehouseKey) as any[];
  return videos.map((v) => ({
    videoId: v.videoId,
    url: v.url,
    name: v.title,
    dur: v.durationSeconds != null ? `${Math.max(1, Math.round(v.durationSeconds / 60))} min` : (durationDisplay(v.durationSeconds) || ''),
    title: v.title,
    thumbnailUrl: v.thumbnailUrl || null,
    durationSeconds: v.durationSeconds ?? null,
  }));
}

export async function getTrainingUserProgress(pickerId: string) {
  const [user, videos] = await Promise.all([
    PickerUser.findById(pickerId).select('trainingProgress').lean() as Promise<any>,
    PickerTrainingVideo.find({ isActive: true }).select('videoId').lean() as Promise<Array<{ videoId: string }>>,
  ]);
  if (!user) throw AppError.notFound('User');
  const progress = (user.trainingProgress || {}) as Record<string, number>;
  const completed = Object.keys(progress).filter((k) => (progress[k] || 0) >= 100);
  return { completed, total: videos.length, progress };
}

// ─── Documents / uploads / face ───────────────────────────────────────────────

function normalizeDocType(type?: string): string {
  const t = String(type || '').toLowerCase();
  if (t === 'aadhaar' || t === 'aadhar') return 'aadhar';
  if (t === 'pan' || t === 'dl' || t === 'rc' || t === 'ins' || t === 'photo' || t === 'other') return t;
  return t || 'other';
}

function validateDocNumber(type: string, number?: string) {
  if (!number) return;
  if (type === 'aadhar' && !AADHAAR_RE.test(number)) {
    throw AppError.validation('Aadhaar must be 12 digits', [{ field: 'aadhaar', message: 'Aadhaar must be 12 digits' }]);
  }
  if (type === 'pan' && !PAN_RE.test(number.toUpperCase())) {
    throw AppError.validation('Enter a valid PAN', [{ field: 'pan', message: 'PAN must match ABCDE1234F' }]);
  }
}

async function upsertIdentityDoc(pickerId: string, type: string, number?: string, url?: string, fileName?: string) {
  validateDocNumber(type, number);
  const userId = oid(pickerId);
  const existing = await PickerDocument.findOne({ userId, type, supersededBy: null });
  if (existing?.status === 'approved' && !number && !url) return existing;
  const created = await PickerDocument.create({
    userId,
    type,
    url: url || existing?.url || '',
    documentNumber: number ? number.toUpperCase() : existing?.documentNumber,
    fileName: fileName || existing?.fileName,
    status: 'pending',
  });
  if (existing) {
    existing.supersededBy = created._id as mongoose.Types.ObjectId;
    existing.supersededAt = new Date();
    await existing.save();
  }
  return created;
}

function toDocResponse(doc: any) {
  return {
    id: String(doc._id),
    type: doc.type === 'aadhar' ? 'aadhaar' : doc.type,
    number: maskDocumentNumber(doc.documentNumber),
    url: doc.url || null,
    fileName: doc.fileName || null,
    status: doc.status,
    rejectionReason: doc.rejectionReason || null,
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

export async function uploadWorkforceDocument(pickerId: string, body: Record<string, unknown>, file?: Express.Multer.File) {
  const results: any[] = [];

  if (body.aadhaar || body.pan) {
    if (body.aadhaar) results.push(await upsertIdentityDoc(pickerId, 'aadhar', String(body.aadhaar)));
    if (body.pan) results.push(await upsertIdentityDoc(pickerId, 'pan', String(body.pan).toUpperCase()));
    await markOnboardingStep(pickerId, 6);
    return results.length === 1 ? toDocResponse(results[0]) : { ok: true, documents: results.map(toDocResponse) };
  }

  const type = normalizeDocType(String(body.type || ''));
  if (!type) throw AppError.badRequest('type is required');
  let url = body.url ? String(body.url) : undefined;
  let fileName = body.fileName ? String(body.fileName) : undefined;
  if (file) {
    const stored = await storePickerUpload(file, pickerId, 'kyc');
    url = stored.url;
    fileName = fileName || stored.fileName;
  }
  const number = body.number ? String(body.number) : undefined;
  if (!url && !number) throw AppError.badRequest('A file or document number is required');
  const doc = await upsertIdentityDoc(pickerId, type, number, url, fileName);
  await markOnboardingStep(pickerId, 6);
  return toDocResponse(doc);
}

export async function listDocumentItems(pickerId: string) {
  const docs = await PickerDocument.find({ userId: oid(pickerId), supersededBy: null }).sort({ createdAt: -1 }).lean() as any[];
  const byType = new Map<string, any>();
  for (const d of docs) if (!byType.has(d.type)) byType.set(d.type, d);
  const ordered = ['aadhar', 'pan', ...Array.from(byType.keys()).filter((t) => t !== 'aadhar' && t !== 'pan')];
  return ordered.filter((t) => byType.has(t)).map((t) => {
    const d = byType.get(t);
    const name = t === 'aadhar' ? 'Aadhaar card' : t === 'pan' ? 'PAN card' : String(t).toUpperCase();
    return {
      id: t === 'aadhar' ? 'aadhaar' : String(d._id),
      name,
      num: maskDocumentNumber(d.documentNumber) || '',
      verified: d.status === 'approved',
      pending: d.status === 'pending',
      status: d.status,
      rejectionReason: d.rejectionReason || null,
    };
  });
}

export async function uploadGenericFile(pickerId: string, file: Express.Multer.File | undefined, purposeRaw?: string) {
  if (!file) throw AppError.badRequest('A file is required');
  const purpose = String(purposeRaw || 'kyc').toLowerCase();
  if (!['kyc', 'face', 'avatar', 'device'].includes(purpose)) {
    throw AppError.badRequest('purpose must be kyc, face, avatar or device');
  }
  const stored = await storePickerUpload(file, pickerId, purpose as 'kyc' | 'face' | 'avatar' | 'device');
  if (purpose === 'avatar') {
    await PickerUser.findByIdAndUpdate(pickerId, { photoUri: stored.url });
  }
  return stored;
}

export async function submitFaceVerification(pickerId: string, imageUrl?: string) {
  const user = await PickerUser.findById(pickerId);
  if (!user) throw AppError.notFound('User');
  if (user.onboarding?.submittedForReviewAt && user.status === 'PENDING') {
    throw AppError.conflict('Your application is already under review.', 'ALREADY_SUBMITTED');
  }
  const now = new Date();
  user.faceVerificationStatus = 'pending';
  if (imageUrl) user.faceImageUrl = imageUrl;
  user.onboarding = {
    currentStep: user.onboarding?.currentStep || 7,
    completedSteps: Array.from(new Set([...(user.onboarding?.completedSteps || []), 7])),
    submittedForReviewAt: now,
  };
  await user.save();
  return {
    faceVerificationStatus: user.faceVerificationStatus,
    submittedForReviewAt: now.toISOString(),
    state: mapAccountStatus(user.status),
  };
}

// ─── Manager OTP / devices ────────────────────────────────────────────────────

export async function requestManagerOtp(pickerId: string) {
  const user = await PickerUser.findById(pickerId);
  if (!user) throw AppError.notFound('User');
  const device = await resolveCollectableDevice(user);
  if (!device) {
    throw AppError.badRequest('No HSD device is registered at your dark store. Ask the manager to add one.');
  }
  const deviceId = 'deviceId' in device && device.deviceId ? device.deviceId : String((device as { device_id?: string }).device_id || '');
  const otp = 'deviceId' in device && device.deviceId
    ? await ensurePickerDeviceOtp(deviceId)
    : await ensureDarkstoreDeviceOtp(deviceId);
  user.locationOtpAttempts = 0;
  user.locationOtpForLocationId = deviceId;
  await user.save();
  return { sent: true, deviceId, otpReady: Boolean(otp) };
}

export async function verifyManagerOtp(pickerId: string, otpRaw?: string) {
  const otp = String(otpRaw || '').trim();
  if (!/^\d{4}$/.test(otp)) throw AppError.badRequest('Enter a valid 4-digit OTP');
  const user = await PickerUser.findById(pickerId);
  if (!user) throw AppError.notFound('User');
  const attempts = (user.locationOtpAttempts || 0) + 1;
  user.locationOtpAttempts = attempts;
  if (attempts > pickerConfig.otpMaxVerifyAttempts) {
    await user.save();
    throw AppError.badRequest('Too many attempts. Ask your dark store manager for the device OTP.');
  }
  const match = await findDeviceByCollectionOtp(otp, pickerStoreKeys(user));
  if (!match) {
    await user.save();
    throw AppError.badRequest('Invalid OTP. Ask your dark store manager for the code on this HSD device.');
  }
  user.locationOtpAttempts = 0;
  user.deviceCollectionVerifiedAt = new Date();
  user.deviceCollectionVerifiedId = match.deviceId;
  await user.save();
  return { verified: true, deviceId: match.deviceId };
}

export async function confirmDeviceCollection(pickerId: string, deviceIdRaw?: string) {
  const user = await PickerUser.findById(pickerId);
  if (!user) throw AppError.notFound('User');
  if (user.activeDeviceId) {
    const existing = await PickerDevice.findOne({ deviceId: user.activeDeviceId, status: 'assigned' });
    if (existing) {
      return { acknowledged: true, deviceId: existing.deviceId };
    }
  }
  const verifiedAt = user.deviceCollectionVerifiedAt ? new Date(user.deviceCollectionVerifiedAt).getTime() : 0;
  const verifiedFresh = verifiedAt > 0 && Date.now() - verifiedAt < 10 * 60 * 1000;
  if (!verifiedFresh || !user.deviceCollectionVerifiedId) {
    throw AppError.badRequest('Enter the HSD collection OTP from your dark store manager before starting your shift.');
  }
  const verifiedDeviceId = user.deviceCollectionVerifiedId;
  if (deviceIdRaw && deviceIdRaw !== verifiedDeviceId) {
    throw AppError.badRequest('That device does not match the OTP from your dark store manager.');
  }
  let device = await PickerDevice.findOne({ deviceId: verifiedDeviceId });
  if (device && device.status === 'assigned' && device.assignedTo && String(device.assignedTo) !== String(pickerId)) {
    throw new AppError('This HSD device is already assigned to another picker.', 409, 'DEVICE_ALREADY_ASSIGNED');
  }
  if (!device) {
    const { DarkstoreDevice } = await import('../darkstore/darkstore.models');
    const dark = await DarkstoreDevice.findOne({ device_id: verifiedDeviceId });
    if (!dark) throw AppError.badRequest('The HSD device for this OTP is no longer available.');
    if (dark.status === 'assigned' && dark.assigned_to && dark.assigned_to !== String(pickerId)) {
      throw new AppError('This HSD device is already assigned to another picker.', 409, 'DEVICE_ALREADY_ASSIGNED');
    }
    dark.status = 'assigned';
    dark.assigned_to = String(pickerId);
    await dark.save();
    user.activeDeviceId = verifiedDeviceId;
    user.deviceCollectionVerifiedAt = undefined;
    user.deviceCollectionVerifiedId = undefined;
    await user.save();
    await rotateDeviceOtp(verifiedDeviceId);
    await markOnboardingStep(pickerId, 8);
    return { acknowledged: true, deviceId: verifiedDeviceId };
  }
  device.assignedTo = user._id as mongoose.Types.ObjectId;
  device.status = 'assigned';
  device.assignedAt = new Date();
  await device.save();
  user.activeDeviceId = device.deviceId;
  user.deviceCollectionVerifiedAt = undefined;
  user.deviceCollectionVerifiedId = undefined;
  await user.save();
  await rotateDeviceOtp(device.deviceId);
  await markOnboardingStep(pickerId, 8);
  return { acknowledged: true, deviceId: device.deviceId };
}

export async function returnAssignedDevice(
  pickerId: string,
  body: { deviceId?: string; notes?: string } = {},
) {
  const user = await PickerUser.findById(pickerId);
  if (!user) throw AppError.notFound('User');

  const deviceIdRaw = body?.deviceId ? String(body.deviceId).trim() : '';
  const device = deviceIdRaw
    ? await PickerDevice.findOne({ deviceId: deviceIdRaw, assignedTo: oid(pickerId) })
    : await PickerDevice.findOne({
      assignedTo: oid(pickerId),
      status: { $in: ['assigned', 'maintenance'] },
    });
  if (!device) throw AppError.notFound('Assigned device');

  await PickerDevice.updateOne(
    { _id: device._id },
    {
      $set: {
        status: 'available',
        ...(body?.notes ? { notes: String(body.notes).slice(0, 500) } : {}),
      },
      $unset: { assignedTo: 1, assignedAt: 1 },
    },
  );

  if (user.activeDeviceId === device.deviceId) {
    await PickerUser.updateOne({ _id: user._id }, { $unset: { activeDeviceId: 1 } });
  }
  return { returned: true, deviceId: device.deviceId };
}

export async function getAssignedDeviceView(pickerId: string) {
  const user = await PickerUser.findById(pickerId).select('activeDeviceId currentLocationId batteryLevel lastSeenAt').lean() as any;
  const device = await PickerDevice.findOne({
    $or: [
      { assignedTo: oid(pickerId), status: 'assigned' },
      ...(user?.activeDeviceId ? [{ deviceId: user.activeDeviceId }] : []),
    ],
  }).lean() as any;

  if (!device) return { device: null, rows: [] };

  const hub = await resolveHub(device.warehouseKey || user?.currentLocationId);
  const battery = device.battery ?? user?.batteryLevel ?? null;
  const lastSyncedAt = device.lastSyncedAt || user?.lastSeenAt;
  const assignedOn = device.assignedAt || device.updatedAt || device.createdAt;

  return {
    device: {
      id: device.deviceId,
      model: device.deviceModel || 'Handheld',
      status: device.status === 'assigned' ? 'Active' : 'Inactive',
      battery,
      lastSynced: lastSyncedAt ? relativeTimeAgo(new Date(lastSyncedAt)) : null,
    },
    rows: [
      { k: 'Model', v: device.deviceModel || '—' },
      { k: 'Serial', v: device.deviceId },
      { k: 'Assigned on', v: assignedOn ? dateDisplay(new Date(assignedOn)) : '—' },
      { k: 'Hub', v: hub?.name || '—' },
    ],
  };
}

export async function reportIssue(pickerId: string, body: Record<string, unknown>) {
  const reason = String(body.reason || body.description || '').trim();
  const type = String(body.type || 'device').toLowerCase();
  if (!reason) throw AppError.badRequest('Select an issue to report.');
  const allowed = ['device', 'app', 'shift', 'payout', 'other'];
  const issueType = (allowed.includes(type) ? type : 'other') as 'device' | 'app' | 'shift' | 'payout' | 'other';

  const assigned = await PickerDevice.findOne({ assignedTo: oid(pickerId), status: 'assigned' }).lean() as any;
  const deviceId = String(body.deviceId || assigned?.deviceId || '');

  const ticket = await supportService.createSupportTicket(pickerId, {
    subject: `Picker ${issueType} issue: ${reason.slice(0, 80)}`,
    message: String(body.description || reason),
    category: issueType === 'payout' ? 'payment' : issueType === 'app' ? 'app' : 'other',
  });

  const issue = await PickerIssue.create({
    userId: oid(pickerId),
    type: issueType,
    reason,
    description: body.description ? String(body.description).slice(0, 1000) : undefined,
    deviceId: deviceId || undefined,
    status: 'open',
    ticketId: ticket.ticketNumber || ticket.id,
  });

  if (issueType === 'device' && assigned) {
    await PickerDevice.updateOne({ _id: assigned._id }, { status: 'maintenance' });
  }

  return {
    id: String(issue._id),
    type: issue.type,
    status: issue.status,
    ticketId: issue.ticketId || null,
    createdAt: issue.createdAt.toISOString(),
  };
}

// ─── Shift readiness / start / end ────────────────────────────────────────────

export async function getShiftReadiness(
  pickerId: string,
  coords?: { latitude: number; longitude: number },
  accuracyM?: number,
) {
  const user = await PickerUser.findById(pickerId).select('currentLocationId').lean() as any;
  const assignment = await resolveTodaysAssignment(pickerId);
  const warehouseKey = (assignment as any)?.warehouseKey || (assignment as any)?.shiftId?.warehouseKey || user?.currentLocationId;
  const hub = await resolveHub(warehouseKey);
  const geofenceM = hub?.geofenceRadius || pickerConfig.geofenceMeters;
  const blockers: string[] = [];
  if (!assignment) blockers.push('You have no shift scheduled today.');
  if (!coords) blockers.push('Location is required to start a shift.');

  let distanceM: number | null = null;
  let onSite = false;
  if (coords && hub && hasCoords(hub.coordinates?.latitude, hub.coordinates?.longitude)) {
    distanceM = Math.round(haversineKm(coords.latitude, coords.longitude, hub.coordinates!.latitude!, hub.coordinates!.longitude!) * 1000);
    onSite = distanceM <= geofenceM;
    if (!onSite) {
      blockers.push(
        `You are ${distanceM} m from ${hub.name}. Move within ${geofenceM} m of the Dark Store to start your shift.`,
      );
    }
  } else if (coords && hub && !hasCoords(hub.coordinates?.latitude, hub.coordinates?.longitude)) {
    blockers.push(`Hub location for ${hub.name} is not configured. Contact your manager.`);
  }

  return {
    ready: blockers.length === 0 && onSite,
    accuracyM: accuracyM ?? 0,
    onSite,
    distanceM,
    geofenceM,
    hub: hub?.name || null,
    hubLatitude: hub?.coordinates?.latitude ?? null,
    hubLongitude: hub?.coordinates?.longitude ?? null,
    blockers,
  };
}

export async function resolveTodaysAssignment(pickerId: string) {
  const from = hubDayStart();
  const to = hubDayEnd();
  return PickerShiftAssignment.findOne({
    userId: oid(pickerId),
    status: { $in: ['STARTED', 'ASSIGNED'] },
    $or: [{ date: { $gte: from, $lte: to } }, { date: null }],
  })
    .sort({ status: -1 })
    .populate('shiftId')
    .exec();
}

async function ensureAttendanceOnStart(pickerId: string, shiftId: string, location?: { latitude: number; longitude: number }) {
  const existing = await PickerAttendance.findOne({ userId: oid(pickerId), punchOut: null });
  if (existing) return existing;
  const user = await PickerUser.findById(pickerId).select('currentLocationId').lean() as any;
  const shift = await PickerShift.findById(shiftId).lean() as any;
  const lateByMinutes = computeLateness(shift);
  return PickerAttendance.create({
    userId: oid(pickerId),
    punchIn: new Date(),
    locationIn: location,
    shiftId,
    warehouseKey: shift?.warehouseKey || user?.currentLocationId,
    status: 'ON_DUTY',
    lateByMinutes,
  });
}

function computeLateness(shift?: { startTime?: string } | null): number {
  const start = parseHhMmToMinutes(shift?.startTime);
  if (start == null) return 0;
  return Math.max(0, hubMinutesNow() - start);
}

/** Credit OT (and week-off work) only — base monthly salary is paid via payroll, not per punch. */
async function creditShiftEarnings(pickerId: string, attendance: any) {
  const otMinutes = Math.max(0, attendance.overtimeMinutes || 0);
  if (otMinutes <= 0) return;

  const ref = `ot:${String(attendance._id)}`;
  const existing = await PickerTransaction.findOne({
    userId: oid(pickerId),
    referenceId: ref,
    type: 'credit',
  }).lean();
  if (existing) return;

  const cfg = await resolveSalaryConfig();
  const { year, monthIndex0 } = hubYearMonth(new Date(attendance.punchIn));
  const daily = calcDailySalary(cfg, year, monthIndex0);
  const amount = otAmountFromMinutes(cfg, daily, otMinutes);
  if (amount <= 0) return;

  const label = attendance.isWeekOffWork
    ? `Week-off work OT ${hubDateKey(new Date(attendance.punchIn))}`
    : `Overtime ${hubDateKey(new Date(attendance.punchIn))}`;
  await pickerService.creditEarnings(pickerId, amount, label, ref);
}

export async function startAppShift(pickerId: string, shiftId?: string, body?: Record<string, unknown>) {
  const holder = await PickerUser.findById(pickerId).select('activeDeviceId').lean() as { activeDeviceId?: string | null } | null;
  if (!holder?.activeDeviceId) {
    throw AppError.badRequest('Collect your HSD device and enter the manager OTP before starting your shift.');
  }
  const location = readCoords(body);
  let resolved = shiftId;
  if (!resolved || !mongoose.isValidObjectId(resolved)) {
    const assignment = await resolveTodaysAssignment(pickerId);
    if (!assignment) throw new AppError('You have no shift scheduled today.', 404, 'ASSIGNMENT_NOT_FOUND');
    resolved = String((assignment.shiftId as any)?._id || assignment.shiftId);
    if ((assignment as any).status === 'STARTED') {
      await ensureAttendanceOnStart(pickerId, resolved, location);
      return shiftService.startShift(pickerId, resolved, location);
    }
  }
  const result = await shiftService.startShift(pickerId, resolved, location);
  await ensureAttendanceOnStart(pickerId, resolved, location);
  return result;
}

export async function endAppShift(pickerId: string, shiftId?: string, body?: Record<string, unknown>) {
  const location = readCoords(body);
  let resolved = shiftId;
  if (!resolved || !mongoose.isValidObjectId(resolved)) {
    const assignment = await PickerShiftAssignment.findOne({
      userId: oid(pickerId),
      status: 'STARTED',
    }).populate('shiftId');
    if (!assignment) throw new AppError('This shift has not been started.', 404, 'SHIFT_NOT_STARTED');
    resolved = String((assignment.shiftId as any)?._id || assignment.shiftId);
  }
  const attendance = await PickerAttendance.findOne({ userId: oid(pickerId), punchOut: null });
  if (attendance) {
    await punchOutInternal(pickerId, location);
  }
  return shiftService.endShift(pickerId, resolved, location);
}

export async function punchInApp(pickerId: string, body: Record<string, unknown> = {}) {
  const holder = await PickerUser.findById(pickerId).select('activeDeviceId').lean() as { activeDeviceId?: string | null } | null;
  if (!holder?.activeDeviceId) {
    throw AppError.badRequest('Collect your HSD device and enter the manager OTP before starting your shift.');
  }
  const location = readCoords(body);
  const user = await PickerUser.findById(pickerId).select('currentLocationId').lean() as any;
  const assignment = await resolveTodaysAssignment(pickerId);
  const warehouseKey = (assignment as any)?.warehouseKey || user?.currentLocationId;
  const hub = await resolveHub(warehouseKey);
  if (location && hub && hasCoords(hub.coordinates?.latitude, hub.coordinates?.longitude)) {
    const metres = haversineKm(location.latitude, location.longitude, hub.coordinates!.latitude!, hub.coordinates!.longitude!) * 1000;
    const radius = hub.geofenceRadius || pickerConfig.geofenceMeters;
    if (metres > radius) {
      throw AppError.forbidden(`You are too far from ${hub.name} to punch in.`, 'OUTSIDE_GEOFENCE');
    }
  }
  const shift = (assignment as any)?.shiftId;
  const shiftId = body.shiftId ? String(body.shiftId) : shift ? String(shift._id || shift) : undefined;
  return pickerService.punchIn(pickerId, location, shiftId);
}

async function punchOutInternal(pickerId: string, location?: { latitude: number; longitude: number }) {
  const attendance = await PickerAttendance.findOne({ userId: oid(pickerId), punchOut: null });
  if (!attendance) throw Object.assign(new Error('Not punched in'), { statusCode: 400 });
  attendance.punchOut = new Date();
  attendance.locationOut = location;

  const cfg = await resolveSalaryConfig();
  const punchIn = new Date(attendance.punchIn);
  const { year, monthIndex0 } = hubYearMonth(punchIn);
  const dayKey = hubDateKey(punchIn);
  const weekOff = isWeekOffDateKey(dayKey, cfg, year, monthIndex0);

  const breakdown = computeShiftBreakdown({
    punchIn,
    punchOut: attendance.punchOut,
    breaks: attendance.breaks as Array<{ startTime: Date; endTime?: Date }>,
    cfg,
    isWeekOffDay: weekOff,
  });

  attendance.totalShiftMinutes = breakdown.totalShiftMinutes;
  attendance.startHandoverMinutes = breakdown.startHandoverMinutes;
  attendance.endHandoverMinutes = breakdown.endHandoverMinutes;
  attendance.breakMinutes = breakdown.breakMinutes;
  attendance.productiveWorkMinutes = breakdown.productiveWorkMinutes;
  attendance.actualWorkStartTime = breakdown.actualWorkStartTime;
  attendance.actualWorkEndTime = breakdown.actualWorkEndTime || undefined;
  attendance.isWeekOffWork = breakdown.isWeekOffWork;
  // Keep totalWorkedMinutes as productive work for legacy consumers
  attendance.totalWorkedMinutes = breakdown.productiveWorkMinutes;
  attendance.overtimeMinutes = breakdown.overtimeMinutes;
  attendance.overtimeHours = Math.round((breakdown.overtimeMinutes / 60) * 10) / 10;
  const regularMins = Math.max(0, breakdown.totalShiftMinutes - breakdown.overtimeMinutes);
  attendance.regularHours = Math.round((regularMins / 60) * 10) / 10;

  const shift = attendance.shiftId ? await PickerShift.findById(attendance.shiftId).lean() as any : null;
  if (!attendance.lateByMinutes) attendance.lateByMinutes = computeLateness(shift);
  const halfDayThreshold = cfg.standardShiftMinutes * 0.5;
  attendance.status = breakdown.totalShiftMinutes < halfDayThreshold ? 'half-day' : 'present';
  await attendance.save();
  await creditShiftEarnings(pickerId, attendance);
  return attendance;
}

export async function punchOutApp(pickerId: string, body: Record<string, unknown> = {}) {
  return punchOutInternal(pickerId, readCoords(body));
}

export async function registerAtLocation(pickerId: string, body: Record<string, unknown> = {}) {
  const hubId = String(body.hubId || body.locationId || body.warehouseKey || body.currentLocationId || '');
  const coords = readCoords(body);
  const updates: Record<string, unknown> = {};
  if (hubId) {
    const { resolveWarehouseKey, ensureOperationalHubs } = await import('./picker.hub');
    await ensureOperationalHubs();
    const resolved = await resolveWarehouseKey(hubId, { fallbackToDefault: false });
    if (!resolved) throw AppError.notFound('Hub', hubId);
    updates.currentLocationId = resolved;
  }
  if (coords) updates.gpsLocation = { ...coords, timestamp: new Date() };
  if (Object.keys(updates).length === 0) throw AppError.badRequest('hubId is required');
  await PickerUser.findByIdAndUpdate(pickerId, { $set: updates });
  await markOnboardingStep(pickerId, 3);
  return { set: true, registered: true, currentLocationId: (updates.currentLocationId as string) || null };
}

// ─── Attendance view models ───────────────────────────────────────────────────

function monthWindow(month?: string) {
  const parsed = parseYearMonth(month);
  const bounds = hubMonthBounds(parsed || new Date());
  return { ...bounds, label: monthLabel(parsed || new Date()) };
}

function classifyDay(rec?: any): { badge: string; tone: string; hrs: string } {
  if (!rec) return { badge: 'Absent', tone: 'danger', hrs: '—' };
  const ot = (rec.overtimeMinutes || 0) > 0;
  if (rec.status === 'half-day' || rec.status === 'half-day') return { badge: 'Half day', tone: 'warning', hrs: hoursMinutesDisplay(rec.totalWorkedMinutes) };
  if (['absent'].includes(rec.status) && !rec.punchIn) return { badge: 'Absent', tone: 'danger', hrs: '—' };
  if (ot) return { badge: 'Present +OT', tone: 'success', hrs: hoursMinutesDisplay(rec.totalWorkedMinutes) };
  if (['present', 'COMPLETED', 'ON_DUTY', 'ON_BREAK'].includes(rec.status) || rec.punchIn) {
    return { badge: 'Present', tone: 'success', hrs: hoursMinutesDisplay(rec.totalWorkedMinutes) };
  }
  return { badge: 'Absent', tone: 'danger', hrs: '—' };
}

export async function getWorkHistory(pickerId: string, month?: string) {
  const { from, to, label } = monthWindow(month);
  const records = await PickerAttendance.find({
    userId: oid(pickerId),
    punchIn: { $gte: from, $lte: to },
  }).sort({ punchIn: -1 }).lean() as any[];

  const user = await PickerUser.findById(pickerId).select('currentLocationId').lean() as any;
  const hub = await resolveHub(user?.currentLocationId);
  const byDay = new Map<string, any>();
  for (const r of records) byDay.set(hubDateKey(new Date(r.punchIn)), r);

  const rows: any[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
    const day = new Date(t);
    if (day > new Date()) continue;
    const rec = byDay.get(hubDateKey(day));
    const cls = classifyDay(rec);
    rows.push({
      date: dateDisplay(day),
      hub: hub?.name || rec?.warehouseKey || null,
      hrs: cls.hrs,
      badge: cls.badge,
      tone: cls.tone,
    });
  }

  const overtimeMin = records.reduce((s, r) => s + (r.overtimeMinutes || 0), 0);
  const totalMin = records.reduce((s, r) => s + (r.totalWorkedMinutes || 0), 0);

  rows.reverse();
  return {
    month: label,
    summary: {
      present: String(records.filter((r) => ['present', 'COMPLETED', 'ON_DUTY', 'ON_BREAK', 'half-day'].includes(r.status) || r.punchIn).length),
      overtime: `${Math.round((overtimeMin / 60) * 10) / 10}h`.replace(/\.0h$/, 'h'),
      total: `${Math.round((totalMin / 60) * 10) / 10}h`.replace(/\.0h$/, 'h'),
    },
    rows,
  };
}

export async function getAttendanceSummary(pickerId: string, month?: string) {
  const { from, to, label } = monthWindow(month);
  const [records, user, assignment] = await Promise.all([
    PickerAttendance.find({ userId: oid(pickerId), punchIn: { $gte: from, $lte: to } }).lean() as Promise<any[]>,
    PickerUser.findById(pickerId).select('currentLocationId onBreak').lean() as Promise<any>,
    resolveTodaysAssignment(pickerId),
  ]);
  const hub = await resolveHub(user?.currentLocationId);
  const shift = (assignment as any)?.shiftId;
  const todayKey = hubDateKey();
  const today = records.find((r) => hubDateKey(new Date(r.punchIn)) === todayKey);
  const scheduled = scheduledMinutes(shift);
  const window = timeRangeDisplay(shift?.startTime, shift?.endTime, shift?.time) || null;
  let hoursToday = '00:00:00';
  let pct = 0;
  if (today) {
    const end = today.punchOut ? new Date(today.punchOut) : new Date();
    const secs = Math.max(0, Math.floor((end.getTime() - new Date(today.punchIn).getTime()) / 1000));
    hoursToday = elapsedClock(secs);
    pct = Math.min(100, Math.round((secs / (scheduled * 60)) * 100));
  }

  const otMinutes = records.reduce((s, r) => s + (r.overtimeMinutes || 0), 0);
  const salaryCfg = await resolveSalaryConfig();
  const ym = hubYearMonth(from);
  const daily = calcDailySalary(salaryCfg, ym.year, ym.monthIndex0);
  const otRate = calcOtHourlyRate(salaryCfg, daily);
  const otEarnings = otAmountFromMinutes(salaryCfg, daily, otMinutes);

  const weeks: { week: string; range: string; hrs: string; amt: string }[] = [];
  const start = new Date(from);
  for (let i = 0; i < 6; i++) {
    const wFrom = new Date(start.getTime() + i * 7 * 86400000);
    if (wFrom > to) break;
    const wTo = new Date(Math.min(wFrom.getTime() + 7 * 86400000 - 1, to.getTime()));
    const slice = records.filter((r) => {
      const t = new Date(r.punchIn).getTime();
      return t >= wFrom.getTime() && t <= wTo.getTime();
    });
    const mins = slice.reduce((s, r) => s + (r.overtimeMinutes || 0), 0);
    const amt = otAmountFromMinutes(salaryCfg, daily, mins);
    const fromShifted = new Date(wFrom.getTime() + 330 * 60000);
    const toShifted = new Date(wTo.getTime() + 330 * 60000);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    weeks.push({
      week: `Week ${i + 1}`,
      range: `${months[fromShifted.getUTCMonth()]} ${fromShifted.getUTCDate()}-${toShifted.getUTCDate()}`,
      hrs: `${Math.round((mins / 60) * 10) / 10} hrs`,
      amt: rupees(amt),
    });
  }

  const presentDays = records.filter((r) => classifyDay(r).badge.startsWith('Present')).length;
  const halfDays = records.filter((r) => r.status === 'half-day').length;

  const firstWeekday = new Date(from.getTime() + 330 * 60000).getUTCDay();
  const cells: { n: string; tone: string; selected: boolean }[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ n: '', tone: 'empty', selected: false });
  const daysInMonth = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const todayNum = new Date(Date.now() + 330 * 60000).getUTCDate();
  const viewingCurrent = monthLabel() === label;
  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(from.getTime() + (d - 1) * 86400000);
    const rec = records.find((r) => hubDateKey(new Date(r.punchIn)) === hubDateKey(dayDate));
    let tone = 'none';
    if (rec) tone = rec.status === 'half-day' ? 'half' : 'present';
    cells.push({ n: String(d), tone, selected: viewingCurrent && d === todayNum });
  }
  while (cells.length % 7 !== 0) cells.push({ n: '', tone: 'empty', selected: false });

  return {
    present: {
      window,
      punchedInOnTime: today ? (today.lateByMinutes || 0) <= 5 : false,
      hoursToday,
      pct,
    },
    detailsRows: [
      { k: 'Warehouse / Darkstore', v: hub?.name || '—' },
      { k: 'Punch In', v: today ? formatHhMm(
        `${String(new Date(new Date(today.punchIn).getTime() + 330 * 60000).getUTCHours()).padStart(2, '0')}:${String(new Date(new Date(today.punchIn).getTime() + 330 * 60000).getUTCMinutes()).padStart(2, '0')}`,
      ) : '—' },
      { k: 'Expected Punch Out', v: formatHhMm(shift?.endTime) || '—' },
      { k: 'Scheduled Hours', v: `${Math.round(scheduled / 60)} hrs` },
    ],
    ot: {
      totalHrs: `${Math.round((otMinutes / 60) * 10) / 10} hrs`,
      rate: `${rupees(otRate)}/hr (${OT_RATE_LABEL})`,
      totalEarnings: rupees(otEarnings),
      weeks,
    },
    history: {
      month: label,
      dow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
      cells,
      presentDays,
      halfDays,
    },
    stats: { presentDays, halfDays, otHours: Math.round((otMinutes / 60) * 10) / 10 },
  };
}

export async function getAttendanceStats(pickerId: string, month?: string) {
  const summary = await getAttendanceSummary(pickerId, month);
  return summary.stats;
}

/**
 * Monthly salary breakdown for the Picker App:
 * Monthly Salary − Leave Deduction + OT Earnings (+ week-off work OT).
 */
export async function getMonthlySalarySummary(pickerId: string, month?: string) {
  const { from, to, label } = monthWindow(month);
  const [records, user, cfg] = await Promise.all([
    PickerAttendance.find({
      userId: oid(pickerId),
      punchIn: { $gte: from, $lte: to },
    }).lean() as Promise<any[]>,
    PickerUser.findById(pickerId).select('employment.joiningDate createdAt').lean() as Promise<any>,
    resolveSalaryConfig(),
  ]);

  const ym = hubYearMonth(from);
  const joiningDate = user?.employment?.joiningDate
    ? new Date(user.employment.joiningDate)
    : user?.createdAt
      ? new Date(user.createdAt)
      : null;

  const payroll = computeMonthlyPayroll({
    cfg,
    year: ym.year,
    monthIndex0: ym.monthIndex0,
    records,
    joiningDate,
    asOf: new Date(),
  });

  const formatHours = (mins: number) => {
    const h = roundRate(Math.max(0, mins) / 60);
    return `${h}`.replace(/\.0$/, '') + ' hours';
  };

  return {
    month: label,
    monthKey: `${ym.year}-${String(ym.monthIndex0 + 1).padStart(2, '0')}`,
    currency: 'INR',
    config: {
      monthlySalary: cfg.monthlySalary,
      fixedSalary: cfg.monthlySalary,
      standardShiftHours: cfg.standardShiftMinutes / 60,
      breakMinutes: cfg.breakMinutes,
      startHandoverMinutes: cfg.startHandoverMinutes,
      endHandoverMinutes: cfg.endHandoverMinutes,
      productiveWorkMinutes: cfg.productiveWorkMinutes,
      overtimeMultiplier: cfg.overtimeMultiplier,
      weekOffAllowance: cfg.weekOffAllowance,
      weekOffWeekday: cfg.weekOffWeekday,
      monthlyWorkingDays: payroll.monthlyWorkingDays,
    },
    regular: {
      monthlySalary: payroll.monthlySalary,
      monthlySalaryDisplay: rupees(payroll.monthlySalary),
      fixedSalary: payroll.monthlySalary,
      fixedSalaryDisplay: rupees(payroll.monthlySalary),
      dailySalary: payroll.dailySalary,
      dailySalaryDisplay: rupees(payroll.dailySalary),
      workingDays: payroll.workingDays,
      weekOffs: payroll.weekOffsPaid,
      weekOffsScheduled: payroll.weekOffsScheduled,
      weekOffsWorked: payroll.weekOffsWorked,
      paidDays: payroll.paidDays,
      unpaidLeave: payroll.unpaidLeaveDays,
      leaveDeduction: payroll.leaveDeduction,
      leaveDeductionDisplay: rupees(payroll.leaveDeduction),
    },
    overtime: {
      otHours: payroll.otHours,
      otHoursDisplay: formatHours(payroll.otMinutes),
      otRate: payroll.otHourlyRate,
      otRateDisplay: `${rupees(payroll.otHourlyRate)}/hour`,
      otEarnings: payroll.otEarnings,
      otEarningsDisplay: rupees(payroll.otEarnings),
      weekOffWorkHours: roundRate(payroll.weekOffWorkMinutes / 60),
      weekOffWorkEarnings: payroll.weekOffWorkEarnings,
      weekOffWorkEarningsDisplay: rupees(payroll.weekOffWorkEarnings),
    },
    fixedSalary: payroll.monthlySalary,
    fixedSalaryDisplay: rupees(payroll.monthlySalary),
    finalSalary: payroll.finalSalary,
    finalSalaryDisplay: rupees(payroll.finalSalary),
    breakdown: {
      monthlySalary: rupees(payroll.monthlySalary),
      fixedSalary: rupees(payroll.monthlySalary),
      workingDays: String(payroll.workingDays),
      weekOffs: String(payroll.weekOffsPaid),
      paidDays: String(payroll.paidDays),
      unpaidLeave: `${payroll.unpaidLeaveDays} days`,
      leaveDeduction: rupees(payroll.leaveDeduction),
      otHours: formatHours(payroll.otMinutes),
      otRate: `${rupees(payroll.otHourlyRate)}/hour`,
      otEarnings: rupees(payroll.otEarnings),
      weekOffWorkEarnings: rupees(payroll.weekOffWorkEarnings),
      finalSalary: rupees(payroll.finalSalary),
    },
    weekOffDates: payroll.paidWeekOffDates,
    formula: {
      dailySalary: `Monthly Salary ÷ ${payroll.monthlyWorkingDays} working days`,
      otHourlyRate: `(Daily Salary ÷ ${cfg.standardShiftMinutes / 60}) × ${cfg.overtimeMultiplier}`,
      finalSalary:
        'Fixed Monthly Salary (₹13,000 default) − Leave Deduction (after month close) + OT Earnings + Week-off Work Earnings',
    },
  };
}

// ─── Wallet / bank ────────────────────────────────────────────────────────────

export async function getWalletBalanceView(pickerId: string, month?: string) {
  const wallet = await getOrCreateWallet(pickerId);
  const user = await PickerUser.findById(pickerId)
    .select('upiId upiPayoutVerificationStatus upiPayoutRejectionReason upiPayoutSubmittedAt')
    .lean() as any;
  const account = await PickerBankAccount.findOne({ userId: oid(pickerId), isPrimary: true }).lean() as any
    || await PickerBankAccount.findOne({ userId: oid(pickerId) }).lean() as any;
  const { from, to, label } = monthWindow(month);
  const monthCredits = await PickerTransaction.aggregate<{ total: number }>([
    { $match: { userId: oid(pickerId), type: 'credit', status: 'completed', createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const net = monthCredits[0]?.total ?? wallet.totalEarnings ?? 0;
  return {
    month: label,
    netPayout: rupees(net),
    payDate: longPay(nextPayDate()),
    available: rupees(wallet.availableBalance),
    availableAmount: Math.round(wallet.availableBalance || 0),
    pending: rupees(wallet.pendingBalance),
    pendingAmount: Math.round(wallet.pendingBalance || 0),
    currency: wallet.currency || 'INR',
    bankLabel: account ? bankLabel(account.bankName, account.accountNumber) : null,
    bankVerified: Boolean(account?.isVerified),
    bankStatus: account ? bankVerificationStatus(account) : 'none',
    bankSubmittedAt: account?.submittedAt
      ? new Date(account.submittedAt).toISOString()
      : account?.createdAt ? new Date(account.createdAt).toISOString() : null,
    bankRejectionReason: account?.rejectionReason || null,
    upiVerified: user?.upiPayoutVerificationStatus === 'verified',
    upiStatus: user?.upiPayoutVerificationStatus || 'none',
    upiSubmittedAt: user?.upiPayoutSubmittedAt ? new Date(user.upiPayoutSubmittedAt).toISOString() : null,
    upiRejectionReason: user?.upiPayoutRejectionReason || null,
    minWithdrawal: pickerConfig.minWithdrawal,
  };
}

/**
 * Older accounts predate `verificationStatus`, so fall back to the `isVerified` flag.
 */
function bankVerificationStatus(account: any): 'pending' | 'verified' | 'rejected' {
  if (account.verificationStatus) return account.verificationStatus;
  return account.isVerified ? 'verified' : 'pending';
}

function longPay(date: Date): string {
  const s = new Date(date.getTime() + 330 * 60000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${s.getUTCDate()} ${months[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
}

export async function listPayoutTransactions(pickerId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    PickerTransaction.find({ userId: oid(pickerId) }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean() as Promise<any[]>,
    PickerTransaction.countDocuments({ userId: oid(pickerId) }),
  ]);
  const items = rows.map((t) => ({
    id: String(t._id),
    month: monthLabel(new Date(t.createdAt)),
    date: longPay(new Date(t.createdAt)),
    mode: /upi/i.test(t.description || '') ? 'UPI' : 'Bank transfer',
    amt: rupees(t.amount),
    amount: t.amount,
    status: t.status,
    type: t.type,
  }));
  return { items, total, page, limit };
}

export async function getPayoutTransaction(pickerId: string, transactionId: string) {
  if (!mongoose.isValidObjectId(transactionId)) throw AppError.notFound('Transaction');
  const t = await PickerTransaction.findOne({ _id: transactionId, userId: oid(pickerId) }).lean() as any;
  if (!t) throw AppError.notFound('Transaction');
  return {
    id: String(t._id),
    month: monthLabel(new Date(t.createdAt)),
    date: longPay(new Date(t.createdAt)),
    mode: /upi/i.test(t.description || '') ? 'UPI' : 'Bank transfer',
    amt: rupees(t.amount),
    amount: t.amount,
    status: t.status,
    type: t.type,
    description: t.description || null,
    createdAt: new Date(t.createdAt).toISOString(),
  };
}

export async function getAppWithdrawalRequest(pickerId: string, requestId: string) {
  if (!mongoose.isValidObjectId(requestId)) throw AppError.notFound('Withdrawal request');
  const existing = await PickerWithdrawalRequest.findOne({ _id: requestId, userId: oid(pickerId) }).lean() as any;
  if (!existing) throw AppError.notFound('Withdrawal request');
  return {
    id: String(existing._id),
    status: existing.status,
    amount: existing.amount,
    requestedAt: new Date(existing.createdAt).toISOString(),
    paidAt: existing.paidAt ? new Date(existing.paidAt).toISOString() : null,
    rejectionReason: existing.rejectionReason || null,
  };
}

export async function requestAppWithdrawal(
  pickerId: string,
  amount: number,
  accountId?: string,
  idempotencyKey?: string,
) {
  if (!amount || amount <= 0) throw AppError.badRequest('Valid amount is required');
  if (amount < pickerConfig.minWithdrawal) {
    throw AppError.badRequest(`Minimum withdrawal is ₹${pickerConfig.minWithdrawal}.`);
  }

  if (idempotencyKey) {
    const existing = await PickerWithdrawalRequest.findOne({ userId: oid(pickerId), idempotencyKey }).lean() as any;
    if (existing) {
      const wallet = await getOrCreateWallet(pickerId);
      return {
        id: String(existing._id),
        status: existing.status,
        amount: existing.amount,
        requestedAt: new Date(existing.createdAt).toISOString(),
        availableBalance: Math.round(wallet.availableBalance || 0),
      };
    }
  }

  let account = accountId
    ? await PickerBankAccount.findOne({ _id: accountId, userId: oid(pickerId) })
    : await PickerBankAccount.findOne({ userId: oid(pickerId), isPrimary: true })
      || await PickerBankAccount.findOne({ userId: oid(pickerId) });
  if (!account) throw AppError.forbidden('Add a verified bank account before withdrawing.', 'NO_BANK_ACCOUNT');
  if (!account.isVerified && process.env.PICKER_REQUIRE_VERIFIED_BANK !== 'false') {
    // Format-verified accounts may still be unverified; allow withdraw but prefer verified.
  }

  const wallet = await getOrCreateWallet(pickerId);
  if (wallet.availableBalance < amount) throw AppError.badRequest('Insufficient balance');
  wallet.availableBalance -= amount;
  wallet.reservedBalance += amount;
  await wallet.save();

  try {
    const request = await PickerWithdrawalRequest.create({
      userId: oid(pickerId),
      amount,
      accountId: account._id,
      idempotencyKey: idempotencyKey || undefined,
      status: 'PENDING',
    });
    return {
      id: String(request._id),
      status: request.status,
      amount: request.amount,
      requestedAt: request.createdAt.toISOString(),
      availableBalance: Math.round(wallet.availableBalance),
    };
  } catch (err: any) {
    if (err?.code === 11000 && idempotencyKey) {
      wallet.availableBalance += amount;
      wallet.reservedBalance -= amount;
      await wallet.save();
      const existing = await PickerWithdrawalRequest.findOne({ userId: oid(pickerId), idempotencyKey }).lean() as any;
      return {
        id: String(existing._id),
        status: existing.status,
        amount: existing.amount,
        requestedAt: new Date(existing.createdAt).toISOString(),
        availableBalance: Math.round((await getOrCreateWallet(pickerId)).availableBalance),
      };
    }
    wallet.availableBalance += amount;
    wallet.reservedBalance -= amount;
    await wallet.save();
    throw err;
  }
}

function mapBankInput(data: Record<string, unknown>) {
  return {
    accountHolderName: String(data.accountHolderName || data.holderName || data.holder || '').trim(),
    accountNumber: String(data.accountNumber || data.acc || '').replace(/\s/g, ''),
    ifscCode: String(data.ifscCode || data.ifsc || '').trim().toUpperCase(),
    bankName: data.bankName || data.bank ? String(data.bankName || data.bank).trim() : undefined,
    branchName: data.branchName ? String(data.branchName).trim() : undefined,
    isPrimary: data.isPrimary === true || data.isPrimary === 'true',
  };
}

function toBankDto(a: any) {
  return {
    id: String(a._id),
    accountHolderName: a.accountHolderName,
    bankName: a.bankName || null,
    accountNumberMasked: maskAccountNumber(a.accountNumber),
    ifscCode: a.ifscCode,
    branchName: a.branchName || null,
    isVerified: Boolean(a.isVerified),
    isPrimary: Boolean(a.isPrimary),
    verificationStatus: bankVerificationStatus(a),
    rejectionReason: a.rejectionReason || null,
    submittedAt: a.submittedAt
      ? new Date(a.submittedAt).toISOString()
      : a.createdAt ? new Date(a.createdAt).toISOString() : null,
    reviewedAt: a.reviewedAt ? new Date(a.reviewedAt).toISOString() : null,
    label: bankLabel(a.bankName, a.accountNumber),
  };
}

export async function listBankAccountViews(pickerId: string) {
  const accounts = await PickerBankAccount.find({ userId: oid(pickerId) }).lean();
  return accounts.map(toBankDto);
}

export async function addBankAccountApp(pickerId: string, data: Record<string, unknown>) {
  const mapped = mapBankInput(data);
  if (!mapped.accountNumber && !mapped.ifscCode && !mapped.accountHolderName) {
    const existing = await PickerBankAccount.find({ userId: oid(pickerId) }).lean();
    if (existing.length) return toBankDto(existing.find((a) => a.isPrimary) || existing[0]);
    throw AppError.validation('Bank details are required', [
      { field: 'accountNumber', message: 'Account number is required' },
      { field: 'ifscCode', message: 'IFSC is required' },
    ]);
  }
  if (!mapped.accountHolderName || mapped.accountNumber.length < 9 || mapped.accountNumber.length > 18 || !IFSC_RE.test(mapped.ifscCode)) {
    const details = [];
    if (!mapped.accountHolderName) details.push({ field: 'accountHolderName', message: 'Account holder name is required' });
    if (mapped.accountNumber.length < 9 || mapped.accountNumber.length > 18) details.push({ field: 'accountNumber', message: 'Account number must be 9–18 digits' });
    if (!IFSC_RE.test(mapped.ifscCode)) details.push({ field: 'ifscCode', message: 'Enter a valid IFSC code' });
    throw AppError.validation('Invalid bank details', details);
  }

  const userId = oid(pickerId);
  const count = await PickerBankAccount.countDocuments({ userId });
  if (mapped.isPrimary || count === 0) {
    await PickerBankAccount.updateMany({ userId }, { isPrimary: false });
    mapped.isPrimary = true;
  }
  const created = await PickerBankAccount.create({
    userId,
    ...mapped,
    isVerified: false,
    verificationStatus: 'pending',
    rejectionReason: '',
    submittedAt: new Date(),
  });
  await markOnboardingStep(pickerId, 8);
  return toBankDto(created);
}

export async function verifyBankAccountApp(pickerId: string, body: Record<string, unknown>) {
  const mapped = mapBankInput(body);
  const ifsc = mapped.ifscCode || String(body.ifsc || '').toUpperCase();
  const acc = mapped.accountNumber || String(body.accountNumber || body.acc || '');
  const holder = mapped.accountHolderName || String(body.holderName || body.holder || '');
  // Format check only (no penny-drop provider). Read-only on purpose: writing the
  // holder name here would change an already-approved account without re-review.
  const valid = IFSC_RE.test(ifsc) && /^\d{9,18}$/.test(acc);
  return { valid, holderName: holder || null };
}

export async function updateBankAccountApp(pickerId: string, accountId: string, data: Record<string, unknown>) {
  const mapped = mapBankInput(data);
  const updates: Record<string, unknown> = {};
  if (mapped.accountHolderName) updates.accountHolderName = mapped.accountHolderName;
  if (mapped.accountNumber) updates.accountNumber = mapped.accountNumber;
  if (mapped.ifscCode) updates.ifscCode = mapped.ifscCode;
  if (mapped.bankName) updates.bankName = mapped.bankName;
  if (mapped.branchName) updates.branchName = mapped.branchName;

  // Changing the payout destination invalidates any prior review.
  if (mapped.accountNumber || mapped.ifscCode || mapped.accountHolderName) {
    Object.assign(updates, {
      isVerified: false,
      verificationStatus: 'pending',
      rejectionReason: '',
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
    });
  }

  const account = await PickerBankAccount.findOneAndUpdate(
    { _id: accountId, userId: oid(pickerId) },
    { $set: updates },
    { new: true },
  );
  if (!account) throw AppError.notFound('Bank account');
  return toBankDto(account);
}

export async function setDefaultBankAccount(pickerId: string, accountId: string) {
  const account = await PickerBankAccount.findOne({ _id: accountId, userId: oid(pickerId) });
  if (!account) throw AppError.notFound('Bank account');
  await PickerBankAccount.updateMany({ userId: oid(pickerId) }, { isPrimary: false });
  account.isPrimary = true;
  await account.save();
  return toBankDto(account);
}

export async function deleteBankAccountApp(pickerId: string, accountId: string) {
  const account = await PickerBankAccount.findOne({ _id: accountId, userId: oid(pickerId) });
  if (!account) throw AppError.notFound('Bank account');
  const wasPrimary = account.isPrimary;
  await account.deleteOne();
  if (wasPrimary) {
    const next = await PickerBankAccount.findOne({ userId: oid(pickerId) });
    if (next) { next.isPrimary = true; await next.save(); }
  }
  return { accountId, deleted: true };
}

// ─── Notifications / FAQ / support / account ──────────────────────────────────

export async function listNotificationViews(pickerId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const query = { userId: oid(pickerId) };
  const [rows, total, unread] = await Promise.all([
    PickerNotification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean() as Promise<any[]>,
    PickerNotification.countDocuments(query),
    PickerNotification.countDocuments({ ...query, read: false }),
  ]);
  const items = rows.map((n) => {
    const style = NOTIFICATION_STYLE[n.type] || NOTIFICATION_STYLE.system;
    return {
      id: String(n._id),
      type: n.type,
      icon: style.icon,
      color: style.color,
      bg: style.bg,
      title: n.title,
      body: n.body,
      time: relativeTimeAgo(new Date(n.createdAt)),
      createdAt: new Date(n.createdAt).toISOString(),
      read: Boolean(n.read),
    };
  });
  return { items, total, unread, page, limit };
}

export async function listFaqItems(category?: string, limit = 20) {
  const primary = await supportService.listFaqs({ category: category || 'picker', limit });
  let faqs = primary.faqs || [];
  if (!category && faqs.length === 0) {
    const fallback = await supportService.listFaqs({ limit });
    faqs = fallback.faqs || [];
  }
  return faqs.map((f: any) => ({ q: f.q, a: f.a, id: f.id, category: f.category, order: f.order }));
}

export async function createPickerTicket(pickerId: string, body: Record<string, unknown>) {
  const subject = String(body.subject || 'Support request').trim();
  const message = String(body.message || body.description || '').trim();
  if (!message) throw AppError.badRequest('description is required');
  const created = await supportService.createSupportTicket(pickerId, {
    subject: subject.length >= 3 ? subject : message.slice(0, 80),
    message,
    category: String(body.category || 'other'),
  });
  return { ok: true, id: created.id, ticketNumber: created.ticketNumber, status: created.status };
}

export async function requestAccountDeletion(pickerId: string, reason?: string) {
  await PickerUser.findByIdAndUpdate(pickerId, {
    deletionRequestedAt: new Date(),
    deletionReason: reason || '',
    status: 'DELETION_PENDING',
  });
  return { requested: true };
}

// ─── Performance / home ───────────────────────────────────────────────────────

export async function getPerformanceView(pickerId: string) {
  const user = await PickerUser.findById(pickerId).select('currentLocationId onTimeDeliveries lateDeliveries totalTrips').lean() as any;
  if (!user) throw AppError.notFound('User');
  const hub = await resolveHub(user.currentLocationId);
  const from = hubDayStart();
  const to = hubDayEnd();
  const weekStart = new Date(from.getTime() - ((new Date(from.getTime() + 330 * 60000).getUTCDay() + 6) % 7) * 86400000);

  const [todayAgg, weekDocs, walletToday] = await Promise.all([
    PickerAttendance.aggregate<{ orders: number; minutes: number }>([
      { $match: { userId: oid(pickerId), punchIn: { $gte: from, $lte: to } } },
      { $group: { _id: null, orders: { $sum: { $ifNull: ['$ordersCompleted', 0] } }, minutes: { $sum: '$totalWorkedMinutes' } } },
    ]),
    PickerAttendance.find({ userId: oid(pickerId), punchIn: { $gte: weekStart, $lte: new Date(weekStart.getTime() + 7 * 86400000 - 1) } }).lean() as Promise<any[]>,
    PickerTransaction.aggregate<{ total: number }>([
      { $match: { userId: oid(pickerId), type: 'credit', createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const ordersToday = todayAgg[0]?.orders || 0;
  const minutesToday = todayAgg[0]?.minutes || 0;
  const rated = (user.onTimeDeliveries || 0) + (user.lateDeliveries || 0);
  const accuracy = rated === 0 ? 100 : Math.round(((user.onTimeDeliveries || 0) / rated) * 100);
  const speed = minutesToday > 0 ? Math.round((ordersToday / (minutesToday / 60)) * 10) / 10 : 0;
  const rankLabel = accuracy >= 90 ? 'Top 12%' : accuracy >= 75 ? 'Top 25%' : 'Rising';

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekBars = [];
  const todayIdx = new Date(Date.now() + 330 * 60000).getUTCDay();
  for (let i = 0; i < 7; i++) {
    const dayFrom = new Date(weekStart.getTime() + i * 86400000);
    const key = hubDateKey(dayFrom);
    const recs = weekDocs.filter((r) => hubDateKey(new Date(r.punchIn)) === key);
    const mins = recs.reduce((s, r) => s + (r.totalWorkedMinutes || 0), 0);
    weekBars.push({
      d: dayNames[new Date(dayFrom.getTime() + 330 * 60000).getUTCDay()],
      pct: Math.min(100, Math.round((mins / pickerConfig.defaultShiftMinutes) * 100)),
      highlight: new Date(dayFrom.getTime() + 330 * 60000).getUTCDay() === todayIdx,
    });
  }

  return {
    cards: [
      { icon: 'package', color: '#0E8F8A', bg: '#E0F2F0', value: String(ordersToday), label: "Today's Orders" },
      { icon: 'target', color: '#1E8E43', bg: '#EAF5EC', value: `${accuracy}%`, label: 'Accuracy' },
      { icon: 'zap', color: '#E8A317', bg: '#FCF2DC', value: String(Math.round(speed) || 0), label: 'Speed Score' },
      { icon: 'trophy', color: '#1E8E43', bg: '#EAF5EC', value: rankLabel, label: 'Performance' },
    ],
    todaysEarnings: rupees(walletToday[0]?.total || 0),
    hub: hub?.name || null,
    weekBars,
    home: { rank: rankLabel, accuracy, speedLabel: `${Math.round(speed) || 0} items/hr`, speedPct: Math.min(100, Math.round(speed)) },
  };
}

function settle<T, F>(label: string, promise: Promise<T>, fallback: F): Promise<T | F> {
  return promise.catch((err) => {
    console.error(`[getHomeSummary] ${label}`, err);
    return fallback;
  });
}

export async function getHomeSummary(
  pickerId: string,
  coords?: { latitude: number; longitude: number },
  accuracyM?: number,
) {
  const user = await PickerUser.findById(pickerId).lean() as any;
  if (!user) throw AppError.notFound('User');

  const emptyPerf = {
    cards: [] as unknown[],
    todaysEarnings: rupees(0),
    hub: null as string | null,
    weekBars: [] as unknown[],
    home: { rank: '—', accuracy: 0, speedLabel: '0 items/hr', speedPct: 0 },
  };

  const [profile, wallet, device, assignment, unread, readiness, perf, hubFromUser, hhdPending, hubOrders] = await Promise.all([
    settle('profile', getAppProfile(pickerId), null),
    settle('wallet', getWalletBalanceView(pickerId), null),
    settle('device', getAssignedDeviceView(pickerId), { device: null, rows: [] }),
    settle('assignment', resolveTodaysAssignment(pickerId), null),
    settle('unread', PickerNotification.countDocuments({ userId: oid(pickerId), read: false }), 0),
    settle('readiness', getShiftReadiness(pickerId, coords, accuracyM), {
      ready: false, accuracyM: 0, onSite: false, distanceM: null, geofenceM: 0,
      hub: null, hubLatitude: null, hubLongitude: null, blockers: [],
    }),
    settle('performance', getPerformanceView(pickerId), emptyPerf),
    settle('hub', resolveHub(user.currentLocationId), null),
    settle(
      'hhdPending',
      HHDOrder.countDocuments({
        status: { $in: ['pending', 'received', 'bag_scanned', 'picking'] },
        $or: [
          { hubKey: user.currentLocationId || DEFAULT_HUB_KEY },
          { hubKey: null },
          { hubKey: { $exists: false } },
        ],
      }),
      0,
    ),
    settle(
      'hubOrders',
      Order.countDocuments({
        status: { $in: ['confirmed', 'getting-packed'] },
        $or: [
          { offerHubKey: user.currentLocationId || DEFAULT_HUB_KEY },
          { offerHubKey: null },
          { offerHubKey: { $exists: false } },
        ],
      }),
      0,
    ),
  ]);

  // Align hub resolution with shift readiness (assignment warehouse → currentLocationId).
  const assignmentWarehouse =
    (assignment as any)?.warehouseKey ||
    (assignment as any)?.shiftId?.warehouseKey ||
    (assignment as any)?.shiftId?.locationId ||
    null;
  let hub = hubFromUser;
  if (
    assignmentWarehouse &&
    assignmentWarehouse !== user.currentLocationId &&
    !(hubFromUser as any)?.name
  ) {
    hub = await settle('hubAssignment', resolveHub(assignmentWarehouse), hubFromUser);
  }

  const shift = (assignment as any)?.shiftId;
  const startedAt = (assignment as any)?.startedAt ? new Date((assignment as any).startedAt) : null;
  const active = (assignment as any)?.status === 'STARTED';
  const elapsedSeconds = startedAt && active ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000)) : 0;
  const ordersCount = Number(hubOrders) || Number((perf as any)?.cards?.[0]?.value) || 0;
  const pending = Number(hhdPending) || 0;
  const progress = ordersCount > 0 ? 100 : 0;
  const displayName = profile?.name || user.name || null;
  const hubName =
    profile?.hub ||
    (hub as any)?.name ||
    (typeof readiness?.hub === 'string' ? readiness.hub : null) ||
    null;

  return {
    picker: {
      id: profile?.id || String(user._id).slice(-4),
      name: firstName(displayName),
      initials: initialsFromName(displayName) || 'SP',
      role: profile?.role || pickerDisplayRole(user),
    },
    hub: {
      name: hubName,
      address: (hub as any)?.address || null,
      accuracy: accuracyM != null ? `±${Math.round(accuracyM)} m` : null,
      onSite: Boolean(readiness?.onSite),
      distanceM: readiness?.distanceM ?? null,
      geofenceM: readiness?.geofenceM ?? ((hub as any)?.geofenceRadius || pickerConfig.geofenceMeters),
      latitude: (hub as any)?.coordinates?.latitude ?? readiness?.hubLatitude ?? null,
      longitude: (hub as any)?.coordinates?.longitude ?? readiness?.hubLongitude ?? null,
    },
    shift: {
      window: timeRangeDisplay(shift?.startTime, shift?.endTime, shift?.time) || null,
      active,
      startedAt: startedAt ? startedAt.toISOString() : null,
      elapsedSeconds,
      onBreak: Boolean(user.onBreak),
    },
    balance: {
      available: wallet?.available || rupees(0),
      pending: `${wallet?.pending || rupees(0)} pending`,
      availableAmount: wallet?.availableAmount || 0,
    },
    orders: {
      count: ordersCount,
      pending,
      syncedLabel: 'Orders synced from HHD',
      progress,
    },
    metrics: {
      todaysEarnings: (perf as any)?.todaysEarnings || rupees(0),
      incentivesToday: rupees(0),
    },
    performance: (perf as any)?.home || emptyPerf.home,
    device: {
      collected: Boolean(device?.device),
      id: device?.device?.id || null,
      copy: device?.device ? null : 'Enter the manager OTP to receive your HHD',
    },
    unreadNotifications: unread || 0,
  };
}
