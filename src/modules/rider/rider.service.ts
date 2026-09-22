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

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (zone) query.zone = { $regex: zone, $options: 'i' };
  if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { id: { $regex: search, $options: 'i' } }];

  const skip = (page - 1) * limit;
  const [riders, total] = await Promise.all([Rider.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(), Rider.countDocuments(query)]);

  return { riders, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getRiderById(riderId: string) {
  const rider = await Rider.findOne({ id: riderId }).lean();
  if (!rider) {
    const err: NodeJS.ErrnoException = new Error('Rider not found');
    (err as NodeJS.ErrnoException & { statusCode: number }).statusCode = 404;
    throw err;
  }
  return rider;
}

export async function updateRider(riderId: string, updateData: Record<string, unknown>) {
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
  const rider = await Rider.findOne({ id: riderId }).select('location').lean() as any;
  if (!rider) throw Object.assign(new Error('Rider not found'), { statusCode: 404 });
  if (!rider.location) throw Object.assign(new Error('Rider location not available'), { statusCode: 404 });
  return rider.location;
}

export async function getRiderDistribution() {
  const riders = await Rider.find({ status: { $in: ['idle', 'busy'] } }).select('id name status location').lean();
  const idle = riders.filter((r) => r.status === 'idle').length;
  const busy = riders.filter((r) => r.status === 'busy').length;
  return {
    idleRiders: idle,
    busyRiders: busy,
    totalRiders: idle + busy,
    riders: riders.map((r) => ({ id: r.id, name: r.name, status: r.status, location: r.location })),
  };
}

export async function searchRiders(query: string, limit = 10) {
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
