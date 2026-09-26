/**
 * Bridge: Admin Live/Dispatch/Directory ↔ Rider App identity (picker_users).
 * Rider App authenticates against PickerUser; Admin previously read an empty `riders`
 * collection. These helpers project picker_users into Admin DTO shapes.
 */
import mongoose from 'mongoose';
import { PickerUser } from '../picker/picker.models';

export const PICKER_RIDER_FILTER = {
  $or: [
    { workforceRole: 'rider' as const },
    { workforceRole: { $exists: false } },
    { workforceRole: null },
  ],
  // Exclude pure pickers when role is set
  workforceRole: { $ne: 'picker' as const },
};

/** Prefer explicit rider filter that still includes legacy null-role accounts. */
export const RIDER_APP_USER_FILTER = {
  $and: [
    {
      $or: [
        { workforceRole: 'rider' },
        { workforceRole: { $exists: false } },
        { workforceRole: null },
      ],
    },
    { workforceRole: { $ne: 'picker' } },
  ],
};

type LeanPicker = {
  _id: mongoose.Types.ObjectId;
  name?: string | null;
  phone?: string | null;
  phoneIsPlaceholder?: boolean;
  email?: string | null;
  status?: string | null;
  workforceRole?: string | null;
  isOnline?: boolean;
  onBreak?: boolean;
  currentLocationId?: string | null;
  deliveryMode?: string | null;
  vehicleType?: string | null;
  vehicleRegistrationNumber?: string | null;
  activeOrderId?: string | null;
  gpsLocation?: { latitude?: number; longitude?: number; timestamp?: Date } | null;
  ratingSum?: number;
  ratingCount?: number;
  totalTrips?: number;
  onTimeDeliveries?: number;
  lateDeliveries?: number;
  createdAt?: Date;
  updatedAt?: Date;
  approvedAt?: Date;
  onlineSince?: Date;
  lastSeenAt?: Date;
  rejectedReason?: string | null;
  onboarding?: { submittedForReviewAt?: Date | string; currentStep?: number } | null;
};

export function liveStatusFromPicker(u: LeanPicker): 'online' | 'busy' | 'idle' | 'offline' {
  if (String(u.status || '').toUpperCase() === 'SUSPENDED' || String(u.status || '').toUpperCase() === 'INACTIVE') {
    return 'offline';
  }
  if (!u.isOnline) return 'offline';
  if (u.activeOrderId) return 'busy';
  if (u.onBreak) return 'idle';
  return 'online';
}

export function ratingFromPicker(u: LeanPicker): number {
  const count = Number(u.ratingCount || 0);
  if (count <= 0) return 0;
  return Math.round((Number(u.ratingSum || 0) / count) * 10) / 10;
}

export function mapPickerToAdminDirectory(u: LeanPicker) {
  const phone =
    u.phoneIsPlaceholder || !u.phone || String(u.phone).startsWith('15') || String(u.phone).startsWith('12')
      ? null
      : String(u.phone);
  const hub = u.currentLocationId || null;
  const vehicle = u.vehicleType || null;
  const status = String(u.status || 'PENDING').toUpperCase();
  const live = liveStatusFromPicker(u);
  const submittedForReviewAt = u.onboarding?.submittedForReviewAt
    ? new Date(u.onboarding.submittedForReviewAt).toISOString()
    : null;
  const inInterview = status === 'PENDING' && Boolean(submittedForReviewAt);
  return {
    id: String(u._id),
    _id: String(u._id),
    name: u.name || '',
    fullName: u.name || '',
    phone: phone || '',
    mobile: phone || '',
    email: u.email || null,
    status,
    onboardingStatus: inInterview
      ? 'interview'
      : status === 'ACTIVE'
        ? 'approved'
        : status.toLowerCase(),
    interviewStatus: inInterview ? 'interview' : status === 'ACTIVE' ? 'approved' : status.toLowerCase(),
    approvalStatus: inInterview ? 'interview' : status.toLowerCase(),
    rejectedReason: u.rejectedReason || null,
    notes: u.rejectedReason ? [String(u.rejectedReason)] : [],
    submittedForReviewAt,
    appliedAt: submittedForReviewAt || u.createdAt || null,
    workforceRole: u.workforceRole || 'rider',
    hub: hub || '—',
    darkStore: hub || '—',
    assignedStore: hub || '—',
    zone: hub || '—',
    vehicle,
    vehicleType: vehicle,
    vehicleRegistration: u.vehicleRegistrationNumber || null,
    deliveryMode: u.deliveryMode || 'standard',
    deliveryType: u.deliveryMode || 'standard',
    isOnline: !!u.isOnline,
    onlineStatus: live,
    workStatus: live,
    currentOrderId: u.activeOrderId || null,
    activeOrderId: u.activeOrderId || null,
    rating: ratingFromPicker(u) || null,
    totalDeliveries: u.totalTrips ?? 0,
    completedDeliveries: u.totalTrips ?? 0,
    deliveriesCount: u.totalTrips ?? 0,
    onTimeRate:
      (u.onTimeDeliveries || 0) + (u.lateDeliveries || 0) > 0
        ? `${Math.round(((u.onTimeDeliveries || 0) / ((u.onTimeDeliveries || 0) + (u.lateDeliveries || 0))) * 100)}%`
        : '—',
    location: u.gpsLocation
      ? { lat: u.gpsLocation.latitude, lng: u.gpsLocation.longitude, timestamp: u.gpsLocation.timestamp }
      : null,
    createdAt: u.createdAt || null,
    updatedAt: u.updatedAt || null,
    approvedAt: u.approvedAt || null,
    onlineSince: u.onlineSince || null,
    lastSeenAt: u.lastSeenAt || null,
  };
}

export function mapPickerToLiveMapRider(u: LeanPicker) {
  const dir = mapPickerToAdminDirectory(u);
  const live = liveStatusFromPicker(u);
  const hasGps =
    typeof u.gpsLocation?.latitude === 'number' &&
    typeof u.gpsLocation?.longitude === 'number' &&
    !(u.gpsLocation.latitude === 0 && u.gpsLocation.longitude === 0);
  return {
    id: dir.id,
    _id: dir.id,
    name: dir.name,
    status: live,
    location: hasGps
      ? { lat: u.gpsLocation!.latitude, lng: u.gpsLocation!.longitude }
      : { lat: 13.0067, lng: 80.2206 },
    zone: dir.hub !== '—' ? dir.hub : null,
    hub: dir.hub,
    darkStore: dir.hub,
    assignedStore: dir.hub,
    capacity: { currentLoad: u.activeOrderId ? 1 : 0, maxLoad: 5 },
    currentOrderId: u.activeOrderId || null,
    currentOrder: u.activeOrderId || '—',
    activeOrder: u.activeOrderId || '—',
    vehicle: dir.vehicleType || '—',
    vehicleType: dir.vehicleType || '—',
    rating: dir.rating ?? '—',
    avatarInitials: (dir.name || 'R')
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    gpsStale: !hasGps,
    phone: dir.phone,
    deliveryMode: dir.deliveryMode,
    isOnline: dir.isOnline,
  };
}

export async function listPickerFleetUsers(limit = 200): Promise<LeanPicker[]> {
  return (await PickerUser.find(RIDER_APP_USER_FILTER)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean()) as LeanPicker[];
}

export async function findPickerFleetUser(idOrPhone: string): Promise<LeanPicker | null> {
  if (mongoose.Types.ObjectId.isValid(idOrPhone) && String(idOrPhone).length === 24) {
    const byId = (await PickerUser.findOne({ _id: idOrPhone, ...RIDER_APP_USER_FILTER }).lean()) as LeanPicker | null;
    if (byId) return byId;
  }
  const digits = String(idOrPhone).replace(/\D/g, '').slice(-10);
  if (digits.length === 10) {
    const byPhone = (await PickerUser.findOne({
      $and: [{ phone: digits }, ...(RIDER_APP_USER_FILTER.$and || [])],
    }).lean()) as LeanPicker | null;
    if (byPhone) return byPhone;
  }
  return null;
}

export async function getPickerFleetCounts() {
  const users = await listPickerFleetUsers(500);
  let online = 0;
  let busy = 0;
  let idle = 0;
  let offline = 0;
  for (const u of users) {
    const s = liveStatusFromPicker(u);
    if (s === 'online') online += 1;
    else if (s === 'busy') busy += 1;
    else if (s === 'idle') idle += 1;
    else offline += 1;
  }
  return { online, busy, idle, offline, total: users.length };
}
