import { Rider, RiderHR, Training, Compliance, Contract } from './rider.models';
import cacheService from '../../utils/cache';

function generateAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2)
    : parts[0].slice(0, 2).toUpperCase();
}

async function generateRiderId(): Promise<string> {
  const storeId = process.env.DEFAULT_STORE_ID || 'DS-Adyar-01';
  const parts = storeId.split('-');
  const storeCode = parts.length >= 2 ? parts[1].slice(0, 3).toUpperCase() : 'GEN';
  const now = new Date();
  const yearMonth = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `RDR-${storeCode}-${yearMonth}-`;
  const lastRider = await Rider.findOne({ id: new RegExp(`^${prefix}`) }).sort({ id: -1 }).lean() as any;
  let seq = 0;
  if (lastRider && typeof lastRider.id === 'string') {
    const parts2 = lastRider.id.split('-');
    seq = parseInt(parts2[parts2.length - 1]) || 0;
  }
  return `${prefix}${String(seq + 1).padStart(3, '0')}`;
}

export async function listRiders(filters: { status?: string; zone?: string; search?: string } = {}, pagination: { page?: number; limit?: number } = {}) {
  const { status, zone, search } = filters;
  const page = pagination.page || 1;
  const limit = pagination.limit || 50;

  const {
    listPickerFleetUsers,
    mapPickerToLiveMapRider,
  } = await import('./pickerFleet.bridge');

  let riders = (await listPickerFleetUsers(500)).map(mapPickerToLiveMapRider);

  if (status) {
    const s = status.toLowerCase();
    riders = riders.filter((r) => String(r.status).toLowerCase() === s);
  }
  if (zone) {
    const z = zone.toLowerCase();
    riders = riders.filter((r) => String(r.zone || r.hub || '').toLowerCase().includes(z));
  }
  if (search) {
    const q = search.toLowerCase();
    riders = riders.filter(
      (r) =>
        String(r.name || '').toLowerCase().includes(q) ||
        String(r.id || '').toLowerCase().includes(q) ||
        String(r.phone || '').includes(q),
    );
  }

  const total = riders.length;
  const skip = (page - 1) * limit;
  return { riders: riders.slice(skip, skip + limit), total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
}

export async function getRiderById(riderId: string) {
  const { findPickerFleetUser, mapPickerToLiveMapRider, mapPickerToAdminDirectory } = await import('./pickerFleet.bridge');
  const picker = await findPickerFleetUser(riderId);
  if (picker) {
    return { ...mapPickerToLiveMapRider(picker), ...mapPickerToAdminDirectory(picker) };
  }
  const rider = await Rider.findOne({ id: riderId }).lean();
  if (!rider) {
    const err: NodeJS.ErrnoException = new Error('Rider not found');
    (err as NodeJS.ErrnoException & { statusCode: number }).statusCode = 404;
    throw err;
  }
  return rider;
}

export async function updateRider(riderId: string, updateData: Record<string, unknown>) {
  const { findPickerFleetUser, mapPickerToAdminDirectory } = await import('./pickerFleet.bridge');
  const { PickerUser } = await import('../picker/picker.models');

  const picker = await findPickerFleetUser(riderId);
  if (picker) {
    if (Object.keys(updateData).length === 0) {
      throw Object.assign(new Error('At least one field must be provided'), { statusCode: 400 });
    }
    const $set: Record<string, unknown> = {};
    if (updateData.name !== undefined) $set.name = String(updateData.name);
    if (updateData.zone !== undefined || updateData.hub !== undefined || updateData.darkStore !== undefined) {
      $set.currentLocationId = String(updateData.hub || updateData.darkStore || updateData.zone);
    }
    if (updateData.vehicleType !== undefined || updateData.vehicle !== undefined) {
      $set.vehicleType = String(updateData.vehicleType || updateData.vehicle);
    }
    if (updateData.deliveryMode !== undefined || updateData.deliveryType !== undefined) {
      $set.deliveryMode = String(updateData.deliveryMode || updateData.deliveryType);
    }
    if (updateData.status !== undefined) {
      const s = String(updateData.status).toLowerCase();
      if (s === 'offline' || s === 'inactive') {
        $set.isOnline = false;
        $set.onlineSince = null;
        if (s === 'inactive') $set.status = 'INACTIVE';
      } else if (s === 'online' || s === 'idle' || s === 'busy') {
        $set.isOnline = true;
        if (!$set.onlineSince) $set.onlineSince = new Date();
        if (s === 'online' || s === 'idle') {
          /* keep ACTIVE */
        }
      } else if (['active', 'approved', 'approve'].includes(s)) {
        $set.status = 'ACTIVE';
      } else if (['suspended', 'suspend'].includes(s)) {
        $set.status = 'SUSPENDED';
        $set.isOnline = false;
      }
    }
    const updated = await PickerUser.findByIdAndUpdate(picker._id, { $set }, { new: true }).lean();
    if (!updated) throw Object.assign(new Error('Rider not found'), { statusCode: 404 });
    return mapPickerToAdminDirectory(updated as Parameters<typeof mapPickerToAdminDirectory>[0]);
  }

  const rider = await Rider.findOne({ id: riderId });
  if (!rider) {
    const err = Object.assign(new Error('Rider not found'), { statusCode: 404 });
    throw err;
  }
  if (Object.keys(updateData).length === 0) throw Object.assign(new Error('At least one field must be provided'), { statusCode: 400 });
  if (updateData.status === 'offline') updateData.currentOrderId = null;
  if (updateData.status === 'busy' && !rider.currentOrderId) throw Object.assign(new Error('Cannot set status to busy without current order'), { statusCode: 400 });
  if (updateData.name !== undefined) rider.name = updateData.name as string;
  if (updateData.status !== undefined) rider.status = updateData.status as IRiderStatus;
  if (updateData.zone !== undefined) rider.zone = updateData.zone as string;
  await rider.save();
  return rider.toObject();
}

type IRiderStatus = 'online' | 'offline' | 'busy' | 'idle';

export async function getRiderLocation(riderId: string) {
  const { findPickerFleetUser } = await import('./pickerFleet.bridge');
  const picker = await findPickerFleetUser(riderId);
  if (picker?.gpsLocation?.latitude != null && picker.gpsLocation?.longitude != null) {
    return { lat: picker.gpsLocation.latitude, lng: picker.gpsLocation.longitude, timestamp: picker.gpsLocation.timestamp };
  }
  const rider = await Rider.findOne({ id: riderId }).select('location').lean() as any;
  if (!rider) throw Object.assign(new Error('Rider not found'), { statusCode: 404 });
  if (!rider.location) throw Object.assign(new Error('Rider location not available'), { statusCode: 404 });
  return rider.location;
}

export async function getRiderDistribution() {
  const { listPickerFleetUsers, mapPickerToLiveMapRider } = await import('./pickerFleet.bridge');
  const users = await listPickerFleetUsers(500);
  const live = users.map(mapPickerToLiveMapRider).filter((r) => r.status === 'idle' || r.status === 'busy' || r.status === 'online');
  const idle = live.filter((r) => r.status === 'idle' || r.status === 'online').length;
  const busy = live.filter((r) => r.status === 'busy').length;
  return {
    idleRiders: idle,
    busyRiders: busy,
    totalRiders: idle + busy,
    riders: live.map((r) => ({ id: r.id, name: r.name, status: r.status, location: r.location })),
  };
}

export async function searchRiders(query: string, limit = 10) {
  const { listPickerFleetUsers, mapPickerToLiveMapRider } = await import('./pickerFleet.bridge');
  const q = query.toLowerCase();
  const fromPicker = (await listPickerFleetUsers(200))
    .map(mapPickerToLiveMapRider)
    .filter(
      (r) =>
        String(r.name || '').toLowerCase().includes(q) ||
        String(r.id || '').includes(q) ||
        String(r.phone || '').includes(q) ||
        String(r.hub || '').toLowerCase().includes(q),
    )
    .slice(0, limit);
  if (fromPicker.length) return fromPicker;
  const regex = { $regex: query, $options: 'i' };
  return Rider.find({ $or: [{ id: regex }, { name: regex }] }).limit(limit).lean();
}

export async function createRider(data: { name: string; phone?: string; email?: string; zone?: string; location?: { lat: number; lng: number }; capacity?: { maxLoad?: number }; status?: string }) {
  const { phone, email, zone, location, capacity, status } = data;
  const name = String(data?.name ?? '').trim();
  if (!name) throw Object.assign(new Error('name is required'), { statusCode: 400, code: 'MISSING_NAME' });

  const newId = await generateRiderId();
  const avatarInitials = generateAvatarInitials(name);

  const rider = new Rider({
    id: newId,
    name: name.trim(),
    avatarInitials,
    status: status || 'offline',
    currentOrderId: null,
    location: location || null,
    capacity: { currentLoad: 0, maxLoad: capacity?.maxLoad || 5 },
    avgEtaMins: 0,
    rating: 0,
    zone: zone || null,
  });
  await rider.save();

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  await Promise.all([
    RiderHR.create({
      id: newId,
      name: name.trim(),
      phone: phone || '+0000000000',
      email: email || `rider.${newId.toLowerCase()}@example.com`,
      status: status === 'offline' ? 'onboarding' : 'active',
      onboardingStatus: status === 'offline' ? 'invited' : 'approved',
      trainingStatus: status === 'offline' ? 'not_started' : 'completed',
      appAccess: status === 'offline' ? 'disabled' : 'enabled',
      deviceAssigned: false,
      contract: { startDate, endDate, renewalDue: false },
      compliance: { isCompliant: true, lastAuditDate: new Date(), policyViolationsCount: 0 },
      suspension: { isSuspended: false },
    }),
    Training.create({
      riderId: newId,
      riderName: name.trim(),
      status: status === 'offline' ? 'not_started' : 'completed',
      modules: [
        { id: 'MOD-001', name: 'Safety Protocols', completed: status !== 'offline' },
        { id: 'MOD-002', name: 'Traffic Rules', completed: status !== 'offline' },
        { id: 'MOD-003', name: 'Customer Service', completed: status !== 'offline' },
        { id: 'MOD-004', name: 'App Usage', completed: status !== 'offline' },
        { id: 'MOD-005', name: 'Emergency Procedures', completed: status !== 'offline' },
      ],
      modulesCompleted: status === 'offline' ? 0 : 5,
      totalModules: 5,
      progressPercentage: status === 'offline' ? 0 : 100,
    }),
    Compliance.create({
      riderId: newId,
      riderName: name.trim(),
      isCompliant: true,
      lastAuditDate: new Date(),
      policyViolationsCount: 0,
      suspension: { isSuspended: false },
    }),
    Contract.create({
      riderId: newId,
      riderName: name.trim(),
      startDate,
      endDate,
      renewalDue: false,
      status: 'active',
    }),
  ]);

  await cacheService.delPattern('riders:*');
  await cacheService.del('distribution');

  return rider.toObject();
}
