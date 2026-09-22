import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import cacheService from '../../utils/cache';
import * as riderService from './rider.service';
import * as dispatchService from './dispatch.service';
import * as shiftService from './shift.service';
import { Compliance, Contract, Training, Vehicle, MaintenanceTask, RiderDashboardNotification, RiderHR } from './rider.models';
import { listActiveRiderPositions } from '../../services/realtime.service';

const CACHE_TTL = 30; // seconds

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = await cacheService.get<T>(key);
  if (hit !== null) return hit;
  const val = await fn();
  await cacheService.set(key, val, CACHE_TTL);
  return val;
}

// ─── Overview ─────────────────────────────────────────────────────────────────

export async function getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const summary = await cached('rider:summary', async () => {
      const [totalRiders, onlineRiders, busyRiders] = await Promise.all([
        (await import('./rider.models')).Rider.countDocuments({}),
        (await import('./rider.models')).Rider.countDocuments({ status: 'online' }),
        (await import('./rider.models')).Rider.countDocuments({ status: 'busy' }),
      ]);
      return { totalRiders, onlineRiders, busyRiders, offlineRiders: totalRiders - onlineRiders - busyRiders };
    });
    res.json(ResponseFormatter.success(summary));
  } catch (err) { next(err); }
}

// ─── Riders ───────────────────────────────────────────────────────────────────

export async function listRiders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, zone, search, page, limit } = req.query as Record<string, string>;
    const cacheKey = `riders:${status || 'all'}:${zone || 'all'}:${search || 'all'}:${page || 1}:${limit || 50}`;
    const result = await cached(cacheKey, () => riderService.listRiders({ status, zone, search }, { page: parseInt(page) || 1, limit: parseInt(limit) || 50 }));
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getRiderById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rider = await cached(`rider:${req.params.riderId}`, () => riderService.getRiderById(req.params.riderId));
    res.json(ResponseFormatter.success(rider));
  } catch (err) { next(err); }
}

export async function createRider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rider = await riderService.createRider(req.body);
    res.status(201).json(ResponseFormatter.success(rider));
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      res.status(400).json(ResponseFormatter.error('Rider with this ID already exists', 400));
      return;
    }
    next(err);
  }
}

export async function updateRider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { riderId } = req.params;
    const rider = await riderService.updateRider(riderId, req.body);
    await cacheService.del(`rider:${riderId}`);
    await cacheService.delPattern('riders:*');
    await cacheService.del('distribution');
    res.json(ResponseFormatter.success(rider));
  } catch (err) { next(err); }
}

export async function getRiderLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const loc = await cached(`rider:location:${req.params.riderId}`, () => riderService.getRiderLocation(req.params.riderId));
    res.json(ResponseFormatter.success(loc));
  } catch (err) { next(err); }
}

export async function getRiderDistribution(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dist = await cached('distribution', riderService.getRiderDistribution);
    res.json(ResponseFormatter.success(dist));
  } catch (err) { next(err); }
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function listUnassignedOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { priority, zone, search, sortBy, sortOrder, page, limit } = req.query as Record<string, string>;
    const result = await dispatchService.listUnassignedOrders({ priority, zone, search, sortBy, sortOrder, page: parseInt(page) || 1, limit: parseInt(limit) || 50 });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getUnassignedOrdersCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dispatchService.getUnassignedOrdersCount(req.query.priority as string);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getMapData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { hubId, showRiders, showOrders, showPickupPoints } = req.query as Record<string, string>;
    const result = await dispatchService.getMapData({ hubId, showRiders: showRiders !== 'false', showOrders: showOrders !== 'false', showPickupPoints: showPickupPoints !== 'false' });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getMapRiders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dispatchService.getMapRiders({ status: req.query.status as string, zone: req.query.zone as string });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getMapOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dispatchService.getMapOrders({ status: req.query.status as string, zone: req.query.zone as string });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getRecommendedRiders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderId } = req.params;
    const { search, limit } = req.query as Record<string, string>;
    const result = await dispatchService.getRecommendedRiders(orderId, { search, limit: parseInt(limit) || 20 });
    res.json(ResponseFormatter.success(result));
  } catch (err: unknown) {
    if ((err as Error).message === 'Order not found') { res.status(404).json(ResponseFormatter.error('Order not found', 404)); return; }
    next(err);
  }
}

export async function getOrderAssignmentDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dispatchService.getOrderAssignmentDetails(req.params.orderId);
    res.json(ResponseFormatter.success(result));
  } catch (err: unknown) {
    if ((err as Error).message === 'Order not found') { res.status(404).json(ResponseFormatter.error('Order not found', 404)); return; }
    next(err);
  }
}

export async function assignOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderId, riderId, overrideSla } = req.body;
    if (!orderId || !riderId) { res.status(400).json(ResponseFormatter.error('orderId and riderId are required', 400)); return; }
    const result = await dispatchService.assignOrder(orderId, riderId, overrideSla || false);
    await cacheService.delPattern('riders:*');
    await cacheService.del(`rider:${riderId}`);
    await cacheService.del('distribution');
    res.json(ResponseFormatter.success(result));
  } catch (err: unknown) {
    const msg = (err as Error).message || '';
    if (msg.includes('not found')) { res.status(404).json(ResponseFormatter.error(msg, 404)); return; }
    if (['at capacity', 'not pending', 'cannot be assigned', 'violate SLA', 'not available'].some((s) => msg.includes(s))) { res.status(400).json(ResponseFormatter.error(msg, 400)); return; }
    next(err);
  }
}

export async function batchAssignOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || !orderIds.length) { res.status(400).json(ResponseFormatter.error('orderIds array is required and must not be empty', 400)); return; }
    const result = await dispatchService.batchAssignOrders(orderIds);
    await cacheService.delPattern('riders:*');
    await cacheService.del('distribution');
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function batchAssignByStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { storeId } = req.body as { storeId?: string };
    if (!storeId) { res.status(400).json(ResponseFormatter.error('storeId is required', 400)); return; }
    const result = await dispatchService.batchAssignByStore(storeId);
    await cacheService.delPattern('riders:*');
    await cacheService.del('distribution');
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getLiveRiderPositions(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const positions = await listActiveRiderPositions();
    res.json(ResponseFormatter.success({ riders: positions, count: positions.length }));
  } catch (err) { next(err); }
}

export async function autoAssignOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dispatchService.autoAssignOrders(req.body?.orderIds || null);
    await cacheService.delPattern('riders:*');
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function simulateAutoAssign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dispatchService.simulateAutoAssignOrders(req.body?.orderIds || null);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function createManualOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dispatchService.createManualOrder(req.body);
    res.status(201).json(ResponseFormatter.success(result));
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (['at least one item', 'drop location', 'customer name'].some((s) => msg.toLowerCase().includes(s))) { res.status(400).json(ResponseFormatter.error(msg, 400)); return; }
    next(err);
  }
}

export async function getAutoAssignRules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rules = await dispatchService.getAutoAssignRules();
    res.json(ResponseFormatter.success(rules));
  } catch (err) { next(err); }
}

export async function updateAutoAssignRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dispatchService.updateAutoAssignRule(req.body);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function groupOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, zone, search, radius, minSize, maxSize } = req.query as Record<string, string>;
    const result = await dispatchService.groupOrders({ status, zone, search, radius: parseFloat(radius) || 2, minSize: parseInt(minSize) || 2, maxSize: parseInt(maxSize) || 10 });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function listGroupDeliveryOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, zone, search } = req.query as Record<string, string>;
    const result = await dispatchService.listGroupDeliveryOrders({ status, zone, search });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getGroupDeliveryFilterOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dispatchService.getGroupDeliveryFilterOptions();
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function computeClusterMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds)) { res.status(400).json(ResponseFormatter.error('orderIds array is required', 400)); return; }
    const result = await dispatchService.computeClusterMetrics(orderIds);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function saveClusters(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clusters } = req.body;
    if (!Array.isArray(clusters)) { res.status(400).json(ResponseFormatter.error('Clusters array is required', 400)); return; }
    const result = await dispatchService.saveClusters(clusters);
    res.status(201).json(ResponseFormatter.success(result.map((c) => ({ clusterId: (c as { clusterId: string }).clusterId, orderIds: (c as { orderIds: string[] }).orderIds, status: (c as { status: string }).status, color: (c as { color: string }).color }))));
  } catch (err) { next(err); }
}

export async function listClusters(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, zone } = req.query as Record<string, string>;
    const result = await dispatchService.listClusters({ status, zone });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function deleteCluster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const deleted = await dispatchService.deleteCluster(req.params.clusterId);
    if (!deleted) { res.status(404).json(ResponseFormatter.error('Cluster not found', 404)); return; }
    res.json(ResponseFormatter.success({ message: 'Cluster deleted successfully' }));
  } catch (err) { next(err); }
}

export async function assignCluster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clusterId } = req.params;
    const { riderId, overrideSla } = req.body;
    if (!riderId) { res.status(400).json(ResponseFormatter.error('riderId is required', 400)); return; }
    const result = await dispatchService.assignClusterToRider(clusterId, riderId, { overrideSla: !!overrideSla });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function updateClusterOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clusterId } = req.params;
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds)) { res.status(400).json(ResponseFormatter.error('orderIds array is required', 400)); return; }
    const result = await dispatchService.updateClusterOrders(clusterId, orderIds);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

export async function listShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, ...filters } = req.query as Record<string, unknown>;
    const result = await shiftService.listShifts(filters, { page: parseInt(page as string) || 1, limit: parseInt(limit as string) || 50 });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getShiftFilterOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const opts = await shiftService.getShiftFilterOptions();
    res.json(ResponseFormatter.success(opts));
  } catch (err) { next(err); }
}

export async function createShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const shift = await shiftService.createShift(req.body);
    res.status(201).json(ResponseFormatter.success(shift));
  } catch (err) { next(err); }
}

export async function getShiftById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const shift = await shiftService.getShiftById(req.params.shiftId);
    if (!shift) { res.status(404).json(ResponseFormatter.error('Shift not found', 404)); return; }
    res.json(ResponseFormatter.success(shift));
  } catch (err) { next(err); }
}

export async function updateShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const shift = await shiftService.updateShift(req.params.shiftId, req.body);
    if (!shift) { res.status(404).json(ResponseFormatter.error('Shift not found', 404)); return; }
    res.json(ResponseFormatter.success(shift));
  } catch (err) { next(err); }
}

export async function deleteShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const shift = await shiftService.deleteShift(req.params.shiftId);
    if (!shift) { res.status(404).json(ResponseFormatter.error('Shift not found', 404)); return; }
    res.json(ResponseFormatter.success({ message: 'Shift cancelled' }));
  } catch (err) { next(err); }
}

export async function getShiftAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await shiftService.getShiftAssignments(req.params.shiftId);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function adminAssignRiderToShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await shiftService.adminAssignRider(req.params.shiftId, req.body.riderId);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function adminUnassignRiderFromShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await shiftService.adminUnassignRider(req.params.shiftId, req.body.riderId);
    res.json(ResponseFormatter.success({ message: 'Rider unassigned from shift' }));
  } catch (err) { next(err); }
}

export async function listRiderShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await shiftService.listRiderShifts(req.params.riderId, { date: req.query.date as string, status: req.query.status as string });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

// ─── Fleet (Vehicles) ─────────────────────────────────────────────────────────

export async function listVehicles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, pool, type, page, limit } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (pool) query.pool = pool;
    if (type) query.type = type;
    const skip = ((parseInt(page) || 1) - 1) * (parseInt(limit) || 50);
    const [vehicles, total] = await Promise.all([Vehicle.find(query).skip(skip).limit(parseInt(limit) || 50).lean(), Vehicle.countDocuments(query)]);
    res.json(ResponseFormatter.success({ vehicles, total, page: parseInt(page) || 1, limit: parseInt(limit) || 50, totalPages: Math.ceil(total / (parseInt(limit) || 50)) }));
  } catch (err) { next(err); }
}

export async function createVehicle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vehicle = new Vehicle(req.body);
    await vehicle.save();
    res.status(201).json(ResponseFormatter.success(vehicle));
  } catch (err) { next(err); }
}

export async function updateVehicle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vehicle = await Vehicle.findOneAndUpdate({ id: req.params.vehicleId }, req.body, { new: true });
    if (!vehicle) { res.status(404).json(ResponseFormatter.error('Vehicle not found', 404)); return; }
    res.json(ResponseFormatter.success(vehicle));
  } catch (err) { next(err); }
}

export async function deleteVehicle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vehicle = await Vehicle.findOneAndUpdate({ id: req.params.vehicleId }, { status: 'inactive' }, { new: true });
    if (!vehicle) { res.status(404).json(ResponseFormatter.error('Vehicle not found', 404)); return; }
    res.json(ResponseFormatter.success({ message: 'Vehicle deactivated' }));
  } catch (err) { next(err); }
}

export async function listMaintenanceTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { vehicleId, status, page, limit } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (vehicleId) query.vehicleId = vehicleId;
    if (status) query.status = status;
    const skip = ((parseInt(page) || 1) - 1) * (parseInt(limit) || 20);
    const [tasks, total] = await Promise.all([MaintenanceTask.find(query).sort({ scheduledDate: -1 }).skip(skip).limit(parseInt(limit) || 20).lean(), MaintenanceTask.countDocuments(query)]);
    res.json(ResponseFormatter.success({ tasks, total }));
  } catch (err) { next(err); }
}

export async function createMaintenanceTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = new MaintenanceTask(req.body);
    await task.save();
    res.status(201).json(ResponseFormatter.success(task));
  } catch (err) { next(err); }
}

export async function updateMaintenanceTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await MaintenanceTask.findByIdAndUpdate(req.params.taskId, req.body, { new: true });
    if (!task) { res.status(404).json(ResponseFormatter.error('Maintenance task not found', 404)); return; }
    res.json(ResponseFormatter.success(task));
  } catch (err) { next(err); }
}

// ─── Compliance ───────────────────────────────────────────────────────────────

export async function listCompliance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { isCompliant, suspended, page, limit } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (isCompliant !== undefined) query.isCompliant = isCompliant === 'true';
    if (suspended === 'true') query['suspension.isSuspended'] = true;
    const skip = ((parseInt(page) || 1) - 1) * (parseInt(limit) || 50);
    const [docs, total] = await Promise.all([Compliance.find(query).sort({ lastAuditDate: -1 }).skip(skip).limit(parseInt(limit) || 50).lean(), Compliance.countDocuments(query)]);
    res.json(ResponseFormatter.success({ data: docs, total }));
  } catch (err) { next(err); }
}

export async function getRiderCompliance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const doc = await Compliance.findOne({ riderId: req.params.riderId }).lean();
    if (!doc) { res.status(404).json(ResponseFormatter.error('Compliance record not found', 404)); return; }
    res.json(ResponseFormatter.success(doc));
  } catch (err) { next(err); }
}

export async function suspendRider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reason, durationDays } = req.body;
    const since = new Date();
    const expiresAt = durationDays ? new Date(since.getTime() + durationDays * 86400000) : undefined;
    const doc = await Compliance.findOneAndUpdate(
      { riderId: req.params.riderId },
      { 'suspension.isSuspended': true, 'suspension.reason': reason, 'suspension.since': since, 'suspension.durationDays': durationDays, 'suspension.expiresAt': expiresAt, isCompliant: false },
      { new: true },
    );
    if (!doc) { res.status(404).json(ResponseFormatter.error('Compliance record not found', 404)); return; }
    res.json(ResponseFormatter.success(doc));
  } catch (err) { next(err); }
}

export async function unsuspendRider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const doc = await Compliance.findOneAndUpdate(
      { riderId: req.params.riderId },
      { 'suspension.isSuspended': false, 'suspension.reason': null, 'suspension.since': null, 'suspension.durationDays': null, 'suspension.expiresAt': null, isCompliant: true },
      { new: true },
    );
    if (!doc) { res.status(404).json(ResponseFormatter.error('Compliance record not found', 404)); return; }
    res.json(ResponseFormatter.success(doc));
  } catch (err) { next(err); }
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export async function listContracts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, renewalDue, page, limit } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (renewalDue === 'true') query.renewalDue = true;
    const skip = ((parseInt(page) || 1) - 1) * (parseInt(limit) || 50);
    const [contracts, total] = await Promise.all([Contract.find(query).sort({ endDate: 1 }).skip(skip).limit(parseInt(limit) || 50).lean(), Contract.countDocuments(query)]);
    res.json(ResponseFormatter.success({ contracts, total }));
  } catch (err) { next(err); }
}

export async function getRiderContract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const contract = await Contract.findOne({ riderId: req.params.riderId }).lean();
    if (!contract) { res.status(404).json(ResponseFormatter.error('Contract not found', 404)); return; }
    res.json(ResponseFormatter.success(contract));
  } catch (err) { next(err); }
}

export async function renewContract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { endDate } = req.body;
    const contract = await Contract.findOneAndUpdate(
      { riderId: req.params.riderId },
      { endDate: new Date(endDate), renewalDue: false, status: 'active' },
      { new: true },
    );
    if (!contract) { res.status(404).json(ResponseFormatter.error('Contract not found', 404)); return; }
    res.json(ResponseFormatter.success(contract));
  } catch (err) { next(err); }
}

export async function terminateContract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reason } = req.body;
    const contract = await Contract.findOneAndUpdate(
      { riderId: req.params.riderId },
      { status: 'terminated', terminationReason: reason, terminatedAt: new Date() },
      { new: true },
    );
    if (!contract) { res.status(404).json(ResponseFormatter.error('Contract not found', 404)); return; }
    res.json(ResponseFormatter.success(contract));
  } catch (err) { next(err); }
}

// ─── HR ───────────────────────────────────────────────────────────────────────

export async function listHRRiders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, onboardingStatus, search, page, limit } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (onboardingStatus) query.onboardingStatus = onboardingStatus;
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { id: { $regex: search, $options: 'i' } }];
    const skip = ((parseInt(page) || 1) - 1) * (parseInt(limit) || 50);
    const [riders, total] = await Promise.all([RiderHR.find(query).sort({ name: 1 }).skip(skip).limit(parseInt(limit) || 50).lean(), RiderHR.countDocuments(query)]);
    res.json(ResponseFormatter.success({ riders, total }));
  } catch (err) { next(err); }
}

export async function getRiderHR(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rider = await RiderHR.findOne({ id: req.params.riderId }).lean();
    if (!rider) { res.status(404).json(ResponseFormatter.error('Rider not found', 404)); return; }
    res.json(ResponseFormatter.success(rider));
  } catch (err) { next(err); }
}

export async function updateRiderHR(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rider = await RiderHR.findOneAndUpdate({ id: req.params.riderId }, req.body, { new: true });
    if (!rider) { res.status(404).json(ResponseFormatter.error('Rider not found', 404)); return; }
    res.json(ResponseFormatter.success(rider));
  } catch (err) { next(err); }
}

export async function approveOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rider = await RiderHR.findOneAndUpdate(
      { id: req.params.riderId },
      { onboardingStatus: 'approved', status: 'active', appAccess: 'enabled' },
      { new: true },
    );
    if (!rider) { res.status(404).json(ResponseFormatter.error('Rider not found', 404)); return; }
    res.json(ResponseFormatter.success(rider));
  } catch (err) { next(err); }
}

// ─── Training ─────────────────────────────────────────────────────────────────

export async function getRiderTraining(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const training = await Training.findOne({ riderId: req.params.riderId }).lean();
    if (!training) { res.status(404).json(ResponseFormatter.error('Training record not found', 404)); return; }
    res.json(ResponseFormatter.success(training));
  } catch (err) { next(err); }
}

export async function markModuleComplete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { moduleId } = req.params;
    const training = await Training.findOne({ riderId: req.params.riderId });
    if (!training) { res.status(404).json(ResponseFormatter.error('Training record not found', 404)); return; }
    const mod = (training.modules as any[]).find((m: any) => m.id === moduleId);
    if (!mod) { res.status(404).json(ResponseFormatter.error('Module not found', 404)); return; }
    mod.completed = true;
    training.modulesCompleted = (training.modules as any[]).filter((m: any) => m.completed).length;
    training.progressPercentage = Math.round((training.modulesCompleted / training.totalModules) * 100);
    training.status = training.progressPercentage === 100 ? 'completed' : 'in_progress';
    await training.save();
    res.json(ResponseFormatter.success(training));
  } catch (err) { next(err); }
}

// ─── Dashboard Notifications ──────────────────────────────────────────────────

export async function listDashboardNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { read, page, limit } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (read !== undefined) query.read = read === 'true';
    const skip = ((parseInt(page) || 1) - 1) * (parseInt(limit) || 20);
    const [notifications, total] = await Promise.all([RiderDashboardNotification.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit) || 20).lean(), RiderDashboardNotification.countDocuments(query)]);
    res.json(ResponseFormatter.success({ notifications, total }));
  } catch (err) { next(err); }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const n = await RiderDashboardNotification.findByIdAndUpdate(req.params.notificationId, { read: true }, { new: true });
    if (!n) { res.status(404).json(ResponseFormatter.error('Notification not found', 404)); return; }
    res.json(ResponseFormatter.success(n));
  } catch (err) { next(err); }
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function search(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { q, type = 'all', limit } = req.query as Record<string, string>;
    if (!q) { res.status(400).json(ResponseFormatter.error('Search query is required', 400)); return; }
    const lim = parseInt(limit) || 10;
    const results: Record<string, unknown> = {};
    if (type === 'all' || type === 'riders') results.riders = await riderService.searchRiders(q, lim);
    res.json(ResponseFormatter.success(results));
  } catch (err) { next(err); }
}

// ─── Dashboard Counts ─────────────────────────────────────────────────────────

export async function getDashboardCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const counts = await cached('rider:dashboard:counts', async () => {
      const { Rider: RiderModel } = await import('./rider.models');
      const [online, busy, offline, idle] = await Promise.all([
        RiderModel.countDocuments({ status: 'online' }),
        RiderModel.countDocuments({ status: 'busy' }),
        RiderModel.countDocuments({ status: 'offline' }),
        RiderModel.countDocuments({ status: 'idle' }),
      ]);
      return { online, busy, offline, idle, total: online + busy + offline + idle };
    });
    res.json(ResponseFormatter.success(counts));
  } catch (err) { next(err); }
}

// ─── Fleet extras ─────────────────────────────────────────────────────────────

export async function getFleetSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const summary = await cached('fleet:summary', async () => {
      const [total, active, maintenance, inactive] = await Promise.all([
        Vehicle.countDocuments({}),
        Vehicle.countDocuments({ status: 'active' }),
        Vehicle.countDocuments({ status: 'maintenance' }),
        Vehicle.countDocuments({ status: 'inactive' }),
      ]);
      return { total, active, maintenance, inactive };
    });
    res.json(ResponseFormatter.success(summary));
  } catch (err) { next(err); }
}

export async function getVehicleById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vehicle = await Vehicle.findOne({ id: req.params.vehicleId }).lean();
    if (!vehicle) { res.status(404).json(ResponseFormatter.error('Vehicle not found', 404)); return; }
    res.json(ResponseFormatter.success(vehicle));
  } catch (err) { next(err); }
}

export async function getMaintenanceTaskById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await MaintenanceTask.findById(req.params.taskId).lean();
    if (!task) { res.status(404).json(ResponseFormatter.error('Maintenance task not found', 404)); return; }
    res.json(ResponseFormatter.success(task));
  } catch (err) { next(err); }
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export async function listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { riderId, action, page, limit } = req.query as Record<string, string>;
    res.json(ResponseFormatter.success({ logs: [], total: 0, riderId, action, page: parseInt(page) || 1, limit: parseInt(limit) || 50 }));
  } catch (err) { next(err); }
}

// ─── HR extras ────────────────────────────────────────────────────────────────

export async function getHRDashboardSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const summary = await cached('hr:dashboard:summary', async () => {
      const [total, pendingOnboarding, pendingDocuments] = await Promise.all([
        RiderHR.countDocuments({}),
        RiderHR.countDocuments({ onboardingStatus: 'pending' }),
        RiderHR.countDocuments({ onboardingStatus: 'documents_pending' }),
      ]);
      return { total, pendingOnboarding, pendingDocuments };
    });
    res.json(ResponseFormatter.success(summary));
  } catch (err) { next(err); }
}

export async function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, riderId, page, limit } = req.query as Record<string, string>;
    res.json(ResponseFormatter.success({ documents: [], total: 0, status, riderId, page: parseInt(page) || 1, limit: parseInt(limit) || 50 }));
  } catch (err) { next(err); }
}

export async function getDocumentById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success({ documentId: req.params.documentId }));
  } catch (err) { next(err); }
}

export async function reviewDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success({ documentId: req.params.documentId, ...req.body }));
  } catch (err) { next(err); }
}

export async function downloadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success({ documentId: req.params.documentId, downloadUrl: null }));
  } catch (err) { next(err); }
}

export async function getDocumentRejectionReason(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success({ documentId: req.params.documentId, rejectionReason: null }));
  } catch (err) { next(err); }
}

export async function getDocumentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success({ documentId: req.params.documentId, history: [] }));
  } catch (err) { next(err); }
}

export async function listTraining(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, page, limit } = req.query as Record<string, string>;
    res.json(ResponseFormatter.success({ training: [], total: 0, status, page: parseInt(page) || 1, limit: parseInt(limit) || 50 }));
  } catch (err) { next(err); }
}

export async function markTrainingCompleted(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const training = await Training.findOneAndUpdate({ riderId: req.params.riderId }, { status: 'completed', ...req.body }, { new: true });
    if (!training) { res.status(404).json(ResponseFormatter.error('Training record not found', 404)); return; }
    res.json(ResponseFormatter.success(training));
  } catch (err) { next(err); }
}

export async function listRiderAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = req.query as Record<string, string>;
    res.json(ResponseFormatter.success({ access: [], total: 0, page: parseInt(page) || 1, limit: parseInt(limit) || 50 }));
  } catch (err) { next(err); }
}

export async function updateRiderAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rider = await RiderHR.findOneAndUpdate({ id: req.params.riderId }, { appAccess: req.body.appAccess }, { new: true });
    if (!rider) { res.status(404).json(ResponseFormatter.error('Rider not found', 404)); return; }
    res.json(ResponseFormatter.success(rider));
  } catch (err) { next(err); }
}

export async function assignDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success({ riderId: req.params.riderId, deviceId: req.body.deviceId, assigned: true }));
  } catch (err) { next(err); }
}

export async function unassignDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success({ riderId: req.params.riderId, unassigned: true }));
  } catch (err) { next(err); }
}

export async function listComplianceAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = req.query as Record<string, string>;
    res.json(ResponseFormatter.success({ alerts: [], total: 0, page: parseInt(page) || 1, limit: parseInt(limit) || 50 }));
  } catch (err) { next(err); }
}

export async function getRiderSuspension(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const doc = await Compliance.findOne({ riderId: req.params.riderId }).select('suspension').lean();
    if (!doc) { res.status(404).json(ResponseFormatter.error('Compliance record not found', 404)); return; }
    res.json(ResponseFormatter.success((doc as any).suspension || {}));
  } catch (err) { next(err); }
}

export async function manageSuspension(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const doc = await Compliance.findOneAndUpdate({ riderId: req.params.riderId }, { suspension: req.body }, { new: true });
    if (!doc) { res.status(404).json(ResponseFormatter.error('Compliance record not found', 404)); return; }
    res.json(ResponseFormatter.success(doc));
  } catch (err) { next(err); }
}

export async function getRiderViolations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const doc = await Compliance.findOne({ riderId: req.params.riderId }).select('violations').lean();
    if (!doc) { res.status(404).json(ResponseFormatter.error('Compliance record not found', 404)); return; }
    res.json(ResponseFormatter.success((doc as any).violations || []));
  } catch (err) { next(err); }
}

export async function updateContract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const contract = await Contract.findOneAndUpdate({ riderId: req.params.riderId }, req.body, { new: true });
    if (!contract) { res.status(404).json(ResponseFormatter.error('Contract not found', 404)); return; }
    res.json(ResponseFormatter.success(contract));
  } catch (err) { next(err); }
}

export async function onboardRider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rider = new RiderHR({ ...req.body, onboardingStatus: 'pending' });
    await rider.save();
    res.status(201).json(ResponseFormatter.success(rider));
  } catch (err) { next(err); }
}

export async function sendRiderReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success({ riderId: req.params.riderId, reminderSent: true }));
  } catch (err) { next(err); }
}

// ─── Kit ──────────────────────────────────────────────────────────────────────

export async function getKitConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success({ config: {} }));
  } catch (err) { next(err); }
}

export async function getKitTrainingVideos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success({
      videos: [
        {
          videoId: 'rider-onboarding-intro',
          title: 'Rider onboarding',
          url: 'https://youtu.be/IUdcxZeg4T0',
          durationSeconds: 180,
          order: 1,
          isActive: true,
        },
      ],
    }));
  } catch (err) { next(err); }
}

export async function updateKitConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success({ config: req.body }));
  } catch (err) { next(err); }
}

export async function createKitTrainingVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(ResponseFormatter.success({ video: req.body }));
  } catch (err) { next(err); }
}

export async function updateKitTrainingVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success({ id: req.params.id, ...req.body }));
  } catch (err) { next(err); }
}

export async function deleteKitTrainingVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success({ id: req.params.id, deleted: true }));
  } catch (err) { next(err); }
}

// ─── Notifications extras ─────────────────────────────────────────────────────

export async function markAllNotificationsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await RiderDashboardNotification.updateMany({}, { read: true });
    res.json(ResponseFormatter.success({ message: 'All notifications marked as read' }));
  } catch (err) { next(err); }
}

// ─── Legal (rider-app public) ─────────────────────────────────────────────────

export async function getLegalConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ config: {} })); } catch (err) { next(err); }
}

export async function getLegalTerms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ terms: '' })); } catch (err) { next(err); }
}

export async function getLegalPrivacy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ privacy: '' })); } catch (err) { next(err); }
}

// ─── Rider-facing shift routes ────────────────────────────────────────────────

export async function listAvailableShiftsForRider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await shiftService.listShifts({ status: 'available' }, { page: 1, limit: 50 });
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getMyShiftsForRider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { riderId } = req.query as Record<string, string>;
    const result = await shiftService.listRiderShifts(riderId || '', {});
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function selectShiftForRider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await shiftService.adminAssignRider(req.body.shiftId, req.body.riderId);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function cancelShiftForRider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await shiftService.adminUnassignRider(req.body.shiftId, req.body.riderId);
    res.json(ResponseFormatter.success({ message: 'Shift cancelled' }));
  } catch (err) { next(err); }
}

export async function startShiftForRider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ started: true, shiftId: req.body.shiftId })); } catch (err) { next(err); }
}

export async function endShiftForRider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ ended: true, shiftId: req.body.shiftId })); } catch (err) { next(err); }
}

// ─── Rider order routes ───────────────────────────────────────────────────────

export async function listRiderOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { riderId, status, page, limit } = req.query as Record<string, string>;
    res.json(ResponseFormatter.success({ orders: [], total: 0, riderId, status, page: parseInt(page) || 1, limit: parseInt(limit) || 50 }));
  } catch (err) { next(err); }
}

export async function assignRiderOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dispatchService.assignOrder(req.params.orderId, req.body.riderId, false);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function alertRiderOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ orderId: req.params.orderId, alerted: true })); } catch (err) { next(err); }
}
