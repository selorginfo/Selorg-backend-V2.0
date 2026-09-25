import mongoose from 'mongoose';
import { Rider, AutoAssignRule, Cluster } from './rider.models';
import { logger } from '../../utils/logger';

// Shared Order model (warehouse orders)
const WarehouseOrderModel = mongoose.models.WarehouseOrder || (() => {
  const s = new mongoose.Schema({}, { strict: false, collection: 'orders' });
  return mongoose.model('WarehouseOrder', s);
})();

const DEFAULT_MAP_COORDS = { lat: 13.0827, lng: 80.2707 };
const GROUP_CLUSTER_COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#EC4899', '#F59E0B', '#06B6D4', '#6366F1', '#14B8A6'];
const GROUP_DELIVERY_LIVE_STATUSES = ['pending', 'assigned', 'delayed', 'picked_up', 'in_transit', 'new', 'processing', 'ready', 'picking', 'picked', 'packed', 'ready_for_dispatch', 'ASSIGNED', 'PICKED'];
const RIDER_EARNING_BASE_INR = 25;
const RIDER_EARNING_PER_KM_INR = 8;
const MINUTES_PER_KM_ESTIMATE = 3;
const MINUTES_PER_STOP_BUFFER = 5;
const DEFAULT_AUTO_ASSIGN = { maxRadiusKm: 5, maxOrdersPerRider: 3, preferSameZone: true };

function isValidCoord(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng) && !(lat === 0 && lng === 0);
}

function resolveOrderId(order: Record<string, unknown>): string | null {
  return (order.id || order.order_id || (order._id ? String(order._id) : null)) as string | null;
}

function extractCoordinates(address: unknown): { lat: number; lng: number } {
  const str = typeof address === 'string' ? address.trim() : '';
  if (!str) return { ...DEFAULT_MAP_COORDS };
  const hash = str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return { lat: DEFAULT_MAP_COORDS.lat + (hash % 100) / 1000, lng: DEFAULT_MAP_COORDS.lng + (hash % 200) / 1000 };
}

function extractDropCoordinates(order: Record<string, unknown>): { lat: number; lng: number } {
  const c = (order as { delivery?: { address?: { coordinates?: { lat: number; lng: number } } } })?.delivery?.address?.coordinates;
  if (c && isValidCoord(c.lat, c.lng)) return { lat: c.lat, lng: c.lng };
  return extractCoordinates((order as { dropLocation?: string; delivery_address?: string }).dropLocation ?? (order as { delivery_address?: string }).delivery_address);
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculatePriority(slaDeadline: unknown): 'high' | 'medium' | 'low' {
  if (!slaDeadline) return 'medium';
  const deadline = slaDeadline instanceof Date ? slaDeadline : new Date(slaDeadline as string);
  if (Number.isNaN(deadline.getTime())) return 'medium';
  const mins = (deadline.getTime() - Date.now()) / 60000;
  return mins <= 30 ? 'high' : mins <= 60 ? 'medium' : 'low';
}

function normalizeOrder(raw: Record<string, unknown>): Record<string, unknown> {
  const id = resolveOrderId(raw);
  const pickupLocation = raw.pickupLocation || raw.pickup_location || (raw.store_id ? `Store ${raw.store_id}` : 'Default Warehouse');
  const dropLocation = raw.dropLocation || raw.delivery_address || '';
  const customerName = raw.customerName || raw.customer_name || 'Customer';
  const riderId = raw.riderId || (raw as { assignee?: { id?: string } }).assignee?.id || null;
  const zone = raw.zone || raw.store_id || null;
  let items = raw.items as unknown[];
  if (Array.isArray(items) && items.length > 0 && typeof items[0] === 'object') {
    items = (items as Array<{ productName?: string; sku?: string; productId?: string }>).map((i) => i?.productName || i?.sku || i?.productId || String(i)).filter(Boolean);
  }
  return { ...raw, id, pickupLocation, dropLocation, customerName, riderId, zone, items: items || [] };
}

function calcOrderDistance(order: Record<string, unknown>): number {
  const pickup = extractCoordinates(order.pickupLocation);
  const drop = extractDropCoordinates(order);
  if (isValidCoord(pickup.lat, pickup.lng) && isValidCoord(drop.lat, drop.lng)) {
    const km = calculateDistance(pickup.lat as number, pickup.lng as number, drop.lat, drop.lng);
    if (km > 0) return Math.round(km * 100) / 100;
  }
  const idStr = String(order.id || '');
  const match = idStr.match(/\d+/);
  return (match ? (parseInt(match[0]) % 10) : 1) + 0.5;
}

async function getAutoAssignCriteria() {
  const rule = await AutoAssignRule.findOne({}).sort({ createdAt: 1 }).lean();
  const c = (rule as any)?.criteria || {};
  return {
    maxRadiusKm: Math.min(50, Math.max(0.5, Number(c.maxRadiusKm) || DEFAULT_AUTO_ASSIGN.maxRadiusKm)),
    maxOrdersPerRider: Math.min(10, Math.max(1, Number(c.maxOrdersPerRider) || DEFAULT_AUTO_ASSIGN.maxOrdersPerRider)),
    preferSameZone: c.preferSameZone !== false,
  };
}

function riderMeetsConstraints(rider: Record<string, unknown>, order: Record<string, unknown>, criteria: typeof DEFAULT_AUTO_ASSIGN): boolean {
  const cap = rider.capacity as { currentLoad: number; maxLoad: number };
  if (cap.currentLoad >= criteria.maxOrdersPerRider || cap.currentLoad >= cap.maxLoad) return false;
  if (criteria.preferSameZone && order.zone && rider.zone && rider.zone !== order.zone) return false;
  const loc = rider.location as { lat: number; lng: number } | null;
  if (!loc || !isValidCoord(loc.lat, loc.lng)) return false;
  const pickup = extractCoordinates(order.pickupLocation);
  return calculateDistance(loc.lat, loc.lng, pickup.lat, pickup.lng) <= criteria.maxRadiusKm;
}

function scoreRider(rider: Record<string, unknown>, order: Record<string, unknown>, criteria: typeof DEFAULT_AUTO_ASSIGN): number {
  const loc = rider.location as { lat: number; lng: number } | null;
  if (!loc) return -Infinity;
  const pickup = extractCoordinates(order.pickupLocation);
  const dist = calculateDistance(loc.lat, loc.lng, pickup.lat, pickup.lng);
  const cap = rider.capacity as { currentLoad: number; maxLoad: number };
  let score = -(dist * 2) - Math.ceil(dist * 3) * 0.5;
  if (criteria.preferSameZone && rider.zone && order.zone && rider.zone === order.zone) score += 10;
  score -= (cap.currentLoad / Math.max(cap.maxLoad, 1)) * 10;
  if (rider.status === 'online' || rider.status === 'idle') score += 5;
  else if (rider.status === 'busy') score += 2;
  score += ((rider.rating as number) || 0) * 2;
  if (calculatePriority(order.slaDeadline) === 'high') score += 15;
  return score;
}

// ─── Exported Service Functions ───────────────────────────────────────────────

export async function listUnassignedOrders(filters: { priority?: string; zone?: string; search?: string; sortBy?: string; sortOrder?: string; page?: number; limit?: number } = {}) {
  const { priority = 'all', zone, search, sortBy = 'priority', sortOrder = 'asc', page = 1, limit = 50 } = filters;

  const query: Record<string, unknown> = {
    status: { $in: ['pending', 'new', 'processing', 'ready', 'picking', 'picked', 'packed', 'ready_for_dispatch'] },
    $and: [{ $or: [{ riderId: null }, { riderId: { $exists: false } }, { riderId: '' }] }],
  };
  if (zone) query.zone = zone;
  if (search) query.$or = [{ id: { $regex: search, $options: 'i' } }, { order_id: { $regex: search, $options: 'i' } }, { customerName: { $regex: search, $options: 'i' } }];

  let orders = (await WarehouseOrderModel.find(query).lean()) as Record<string, unknown>[];
  orders = orders.map((raw) => {
    const order = normalizeOrder(raw);
    const priorityLevel = calculatePriority(order.slaDeadline);
    const distance = calcOrderDistance(order);
    const pickup = extractCoordinates(order.pickupLocation);
    const drop = extractDropCoordinates(raw);
    return { ...order, id: (order as any).id, priority: priorityLevel, distance, etaMinutes: Math.ceil(distance * 3), pickupLocation: { address: order.pickupLocation, coordinates: pickup }, dropLocation: { address: order.dropLocation, coordinates: drop } };
  }).filter((o: any) => o.id);

  if (priority !== 'all') orders = orders.filter((o) => o.priority === priority);

  const sortMul = sortOrder === 'desc' ? -1 : 1;
  const prioOrd: Record<string, number> = { high: 3, medium: 2, low: 1 };
  orders.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'priority') cmp = (prioOrd[a.priority as string] || 0) - (prioOrd[b.priority as string] || 0);
    else if (sortBy === 'distance') cmp = (a.distance as number) - (b.distance as number);
    else if (sortBy === 'eta') cmp = (a.etaMinutes as number) - (b.etaMinutes as number);
    else if (sortBy === 'slaDeadline') cmp = new Date(a.slaDeadline as string).getTime() - new Date(b.slaDeadline as string).getTime();
    return cmp * sortMul;
  });

  const total = orders.length;
  const skip = (page - 1) * limit;
  return { orders: orders.slice(skip, skip + limit), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getUnassignedOrdersCount(priority = 'all') {
  const orders = (await WarehouseOrderModel.find({ status: 'pending' }).lean()) as Record<string, unknown>[];
  const withPriority = orders.map((o) => ({ ...o, priority: calculatePriority(o.slaDeadline) }));
  const breakdown = { high: 0, medium: 0, low: 0 } as Record<string, number>;
  withPriority.forEach((o) => { breakdown[o.priority as string] = (breakdown[o.priority as string] || 0) + 1; });
  const filtered = priority === 'all' ? withPriority : withPriority.filter((o) => o.priority === priority);
  return { count: filtered.length, priorityBreakdown: breakdown };
}

export async function getMapData(filters: { hubId?: string; showRiders?: boolean; showOrders?: boolean; showPickupPoints?: boolean } = {}) {
  const { showRiders = true, showOrders = true, showPickupPoints = true } = filters;
  const result: Record<string, unknown> = { riders: [], orders: [], pickupPoints: [], statusCounts: { riders: {}, orders: {} } };

  if (showRiders) {
    const riders = (await Rider.find({}).lean()) as any[];
    result.riders = riders.filter((r) => isValidCoord(r.location?.lat, r.location?.lng)).map((r) => ({ id: r.id, name: r.name, status: r.status, location: r.location, zone: r.zone, capacity: r.capacity, currentOrderId: r.currentOrderId, avatarInitials: r.avatarInitials }));
    const counts: Record<string, number> = {};
    riders.forEach((r) => { counts[r.status as string] = (counts[r.status as string] || 0) + 1; });
    result.statusCounts = { ...(result.statusCounts as object), riders: { online: counts.online || 0, busy: counts.busy || 0, idle: counts.idle || 0, offline: counts.offline || 0 } };
  }

  if (showOrders) {
    const orders = (await WarehouseOrderModel.find({ status: { $nin: ['delivered', 'cancelled'] } }).lean()) as Record<string, unknown>[];
    result.orders = orders.map((raw) => {
      const o = normalizeOrder(raw);
      return { id: o.id, status: o.status, pickupLocation: { address: o.pickupLocation, coordinates: extractCoordinates(o.pickupLocation) }, dropLocation: { address: o.dropLocation, coordinates: extractDropCoordinates(raw) }, riderId: o.riderId, priority: calculatePriority(o.slaDeadline), zone: o.zone };
    }).filter((o) => o.id);
  }

  if (showPickupPoints) {
    const orders = (await WarehouseOrderModel.find({}).lean()) as Record<string, unknown>[];
    const pickupMap = new Map<string, { id: string; address: unknown; coordinates: { lat: number; lng: number }; orderCount: number }>();
    orders.forEach((o) => {
      const key = String(o.pickupLocation ?? '');
      if (!pickupMap.has(key)) pickupMap.set(key, { id: `PICKUP-${pickupMap.size + 1}`, address: o.pickupLocation, coordinates: extractCoordinates(o.pickupLocation), orderCount: 0 });
      pickupMap.get(key)!.orderCount += 1;
    });
    result.pickupPoints = Array.from(pickupMap.values());
  }

  return result;
}

export async function getMapRiders(filters: { status?: string; zone?: string } = {}) {
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;
  if (filters.zone) query.zone = filters.zone;
  const riders = (await Rider.find(query).lean()) as Record<string, unknown>[];
  const counts: Record<string, number> = {};
  riders.forEach((r) => { counts[r.status as string] = (counts[r.status as string] || 0) + 1; });
  // Include riders without GPS so Admin never falls back to design seed when the fleet exists offline.
  return {
    riders: riders.map((r) => {
      const loc = r.location as { lat?: number; lng?: number } | null;
      const hasGps = isValidCoord(loc?.lat, loc?.lng);
      return {
        id: r.id || r._id,
        name: r.name,
        status: r.status,
        location: hasGps ? loc : { lat: 12.9716, lng: 77.5946 },
        zone: r.zone,
        capacity: r.capacity,
        hub: r.hub || r.darkStore || r.assignedStore,
        currentOrder: r.currentOrderId || r.currentOrder || r.activeOrder,
        vehicle: r.vehicle || r.vehicleType,
        rating: r.rating,
        gpsStale: !hasGps,
      };
    }),
    statusCounts: { online: counts.online || 0, busy: counts.busy || 0, idle: counts.idle || 0, offline: counts.offline || 0 },
  };
}

export async function getMapOrders(filters: { status?: string; zone?: string } = {}) {
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;
  if (filters.zone) query.zone = filters.zone;
  const orders = (await WarehouseOrderModel.find(query).lean()) as Record<string, unknown>[];
  return { orders: orders.map((raw) => { const o = normalizeOrder(raw); return { id: o.id, status: o.status, pickupLocation: { address: o.pickupLocation, coordinates: extractCoordinates(o.pickupLocation) }, dropLocation: { address: o.dropLocation, coordinates: extractDropCoordinates(raw) }, riderId: o.riderId, priority: calculatePriority(o.slaDeadline), zone: o.zone }; }).filter((o) => o.id) };
}

export async function getRecommendedRiders(orderId: string, filters: { search?: string; limit?: number } = {}) {
  const { search, limit = 20 } = filters;
  let rawOrder = await WarehouseOrderModel.findOne({ id: orderId }).lean() as Record<string, unknown> | null;
  if (!rawOrder) rawOrder = await WarehouseOrderModel.findOne({ order_id: orderId }).lean() as Record<string, unknown> | null;
  if (!rawOrder) throw Object.assign(new Error('Order not found'), { statusCode: 404 });

  const order = normalizeOrder(rawOrder);
  const ridersQuery: Record<string, unknown> = { status: { $in: ['online', 'idle'] }, currentOrderId: null, 'capacity.currentLoad': { $eq: 0 }, $expr: { $lt: ['$capacity.currentLoad', '$capacity.maxLoad'] } };
  if (search) ridersQuery.$or = [{ name: { $regex: search, $options: 'i' } }, { id: { $regex: search, $options: 'i' } }];

  const riders = (await Rider.find(ridersQuery).lean()) as Record<string, unknown>[];
  const criteria = await getAutoAssignCriteria();
  const pickup = extractCoordinates(order.pickupLocation);

  const scored = riders.filter((r) => riderMeetsConstraints(r, order, criteria)).map((r) => {
    const loc = r.location as { lat: number; lng: number };
    const score = scoreRider(r, order, criteria);
    const dist = calculateDistance(loc.lat, loc.lng, pickup.lat, pickup.lng);
    const cap = r.capacity as { currentLoad: number; maxLoad: number };
    return { id: r.id, name: r.name, zone: r.zone, status: r.status, load: { current: cap.currentLoad, max: cap.maxLoad }, estimatedPickupMinutes: Math.ceil(dist * 3), distance: dist, rating: r.rating || 0, score, isRecommended: false };
  });

  scored.sort((a, b) => b.score - a.score);
  scored.slice(0, 3).forEach((r) => { r.isRecommended = true; });
  return { riders: scored.slice(0, limit), orderDetails: { id: order.id, pickup: order.pickupLocation, distance: calcOrderDistance(order), priority: calculatePriority(order.slaDeadline) } };
}

export async function getOrderAssignmentDetails(orderId: string) {
  let rawOrder = await WarehouseOrderModel.findOne({ id: orderId }).lean() as Record<string, unknown> | null;
  if (!rawOrder) rawOrder = await WarehouseOrderModel.findOne({ order_id: orderId }).lean() as Record<string, unknown> | null;
  if (!rawOrder) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  const order = normalizeOrder(rawOrder);
  return { id: order.id, pickup: order.pickupLocation, drop: order.dropLocation, distance: calcOrderDistance(order), priority: calculatePriority(order.slaDeadline), zone: order.zone, slaDeadline: order.slaDeadline, customerName: order.customerName, items: order.items };
}

export async function assignOrder(orderId: string, riderId: string, overrideSla = false) {
  const orderDoc = await WarehouseOrderModel.findOne({ id: orderId }) as Record<string, unknown> & { save: () => Promise<void>; timeline?: Array<unknown> };
  if (!orderDoc) throw Object.assign(new Error('Order not found'), { statusCode: 404 });

  const assignable = ['pending', 'assigned', 'delayed', 'picked_up', 'in_transit', 'new', 'processing', 'ready', 'picking', 'picked', 'packed', 'ready_for_dispatch'];
  if (!assignable.includes(String(orderDoc.status || '').toLowerCase())) throw Object.assign(new Error(`Order cannot be assigned in status: ${orderDoc.status}`), { statusCode: 400 });

  const rider = await Rider.findOne({ id: riderId });
  if (!rider) throw Object.assign(new Error('Rider not found'), { statusCode: 404 });

  const cap = rider.capacity;
  if (cap.currentLoad >= cap.maxLoad) throw Object.assign(new Error('Rider is at capacity'), { statusCode: 400 });

  (orderDoc as Record<string, unknown>).status = 'assigned';
  (orderDoc as Record<string, unknown>).riderId = riderId;
  (orderDoc as Record<string, unknown>).etaMinutes = 15;
  if (!Array.isArray(orderDoc.timeline)) (orderDoc as Record<string, unknown>).timeline = [];
  (orderDoc.timeline as Array<unknown>).push({ status: 'assigned', time: new Date(), note: `Manually assigned to ${rider.name}` });

  rider.status = rider.status === 'offline' ? 'online' : 'busy';
  rider.currentOrderId = orderId;
  rider.capacity.currentLoad += 1;

  await Promise.all([orderDoc.save(), rider.save()]);
  return { orderId, riderId: rider.id, riderName: rider.name, status: 'assigned', etaMinutes: 15, assignedAt: new Date() };
}

export async function batchAssignOrders(orderIds: string[] | null = null, options: { dryRun?: boolean } = {}) {
  const { dryRun = false } = options;
  const statusFilter = { $in: ['pending', 'new', 'processing', 'ready', 'picking', 'picked', 'packed', 'ready_for_dispatch'] };
  let unassigned = orderIds?.length
    ? (await WarehouseOrderModel.find({ id: { $in: orderIds }, status: statusFilter }).lean()) as Record<string, unknown>[]
    : (await WarehouseOrderModel.find({ status: statusFilter }).sort({ slaDeadline: 1 }).limit(100).lean()) as Record<string, unknown>[];

  if (!unassigned.length) return { assigned: 0, failed: 0, assignments: [], totalProcessed: 0 };

  const criteria = await getAutoAssignCriteria();
  const availableRiders = (await Rider.find({ $expr: { $lt: ['$capacity.currentLoad', '$capacity.maxLoad'] } }).lean() as Record<string, unknown>[]).filter((r) => (r.capacity as { currentLoad: number }).currentLoad < criteria.maxOrdersPerRider);

  if (!availableRiders.length) {
    return { assigned: 0, failed: unassigned.length, assignments: unassigned.map((o) => ({ orderId: resolveOrderId(o), riderId: null, status: 'failed', reason: 'No available riders' })), totalProcessed: unassigned.length };
  }

  const assignments: Array<{ orderId: string | null; riderId: string | null; riderName?: string; status: string; reason: string | null }> = [];
  let assignedCount = 0, failedCount = 0;

  for (const rawOrder of unassigned) {
    const order = normalizeOrder(rawOrder);
    let best: Record<string, unknown> | null = null, bestScore = -Infinity;
    for (const r of availableRiders) {
      if (!riderMeetsConstraints(r, order, criteria)) continue;
      const s = scoreRider(r, order, criteria);
      if (s > bestScore) { bestScore = s; best = r; }
    }

    if (best) {
      if (dryRun) {
        assignments.push({ orderId: order.id as string, riderId: (best.id as string), riderName: (best.name as string), status: 'would_assign', reason: null });
        assignedCount++;
        const idx = availableRiders.findIndex((r) => r.id === best!.id);
        if (idx !== -1) (availableRiders[idx].capacity as { currentLoad: number }).currentLoad += 1;
        continue;
      }
      try {
        await assignOrder(order.id as string, best.id as string, true);
        const idx = availableRiders.findIndex((r) => r.id === best!.id);
        if (idx !== -1) (availableRiders[idx].capacity as { currentLoad: number }).currentLoad += 1;
        assignments.push({ orderId: order.id as string, riderId: (best.id as string), status: 'assigned', reason: null });
        assignedCount++;
      } catch (err) {
        logger.error(`Failed to assign order ${order.id}:`, err as Record<string, unknown>);
        assignments.push({ orderId: order.id as string, riderId: null, status: 'failed', reason: (err as Error).message });
        failedCount++;
      }
    } else {
      assignments.push({ orderId: order.id as string, riderId: null, status: 'failed', reason: 'No suitable rider found' });
      failedCount++;
    }
  }

  return { assigned: assignedCount, failed: failedCount, assignments, totalProcessed: unassigned.length };
}

export async function autoAssignOrders(orderIds: string[] | null = null) {
  const rule = await AutoAssignRule.findOne({}).sort({ createdAt: 1 }).lean() as { isActive?: boolean } | null;
  if (!rule?.isActive) return { assigned: 0, failed: 0, disabled: true, message: 'Auto-assign is disabled. Enable the rule in Auto-Assign Configuration.' };
  const result = await batchAssignOrders(orderIds);
  return { ...result, disabled: false };
}

export async function simulateAutoAssignOrders(orderIds: string[] | null = null) {
  const rule = await AutoAssignRule.findOne({}).sort({ createdAt: 1 }).lean() as { isActive?: boolean } | null;
  const result = await batchAssignOrders(orderIds, { dryRun: true });
  return { ...result, disabled: !rule?.isActive, simulation: true, message: rule?.isActive ? `Simulation: ${result.assigned} order(s) would be assigned` : 'Auto-assign is disabled' };
}

export async function createManualOrder(payload: { orderType?: string; items?: unknown[]; pickupLocation?: unknown; dropLocation?: unknown; customerName?: string; customerPhone?: string; zone?: string; riderId?: string }) {
  const { orderType = 'standard', items, pickupLocation, dropLocation, customerName, zone, riderId } = payload;
  if (!items || !Array.isArray(items) || items.length === 0) throw new Error('Order must have at least one item');
  const dropText = typeof dropLocation === 'string' ? dropLocation.trim() : typeof dropLocation === 'object' && dropLocation ? String((dropLocation as Record<string, unknown>).address || '') : '';
  if (!dropText) throw new Error('Customer address (drop location) is required');
  if (!customerName?.trim()) throw new Error('Customer name is required');

  const pickupText = typeof pickupLocation === 'string' ? pickupLocation.trim() : typeof pickupLocation === 'object' && pickupLocation ? String((pickupLocation as Record<string, unknown>).address || '') : '';
  const slaMinutes = orderType === 'express' ? 30 : 60;
  const slaDeadline = new Date(Date.now() + slaMinutes * 60000);
  const lastOrder = await WarehouseOrderModel.findOne({}).sort({ id: -1 }).select('id').lean() as { id?: string } | null;
  let nextNum = 9000;
  if (lastOrder?.id && /^ORD-(\d+)$/.test(lastOrder.id)) nextNum = parseInt(lastOrder.id.replace('ORD-', ''), 10) + 1;
  const id = `ORD-${nextNum}`;

  const order = new WarehouseOrderModel({ id, status: 'pending', riderId: riderId || null, etaMinutes: null, slaDeadline, pickupLocation: pickupText || 'Default Warehouse', dropLocation: dropText, zone: zone || null, customerName: customerName.trim(), items: (items as Array<string | { name?: string; id?: string }>).map((i) => typeof i === 'string' ? i : String((i as Record<string, unknown>).name || i)).filter(Boolean), timeline: [{ status: 'pending', time: new Date(), note: 'Manual order created' }] });
  await order.save();

  let dispatched = false;
  if (riderId) {
    try { await assignOrder(id, riderId, true); dispatched = true; } catch (e) { logger.warn('Manual order created but dispatch failed', { orderId: id, riderId, err: (e as Error).message }); }
  }
  return { orderId: id, status: dispatched ? 'assigned' : 'pending', riderId: dispatched ? riderId : null, message: dispatched ? 'Order created and dispatched to rider' : 'Order created successfully' };
}

export async function getAutoAssignRules() {
  const rules = await AutoAssignRule.find({}).sort({ createdAt: 1 }).lean() as Array<{ id?: string; name?: string; isActive?: boolean; criteria?: Record<string, unknown>; createdBy?: string; updatedAt?: Date }>;
  if (!rules.length) return [{ id: 'default', name: 'Default Rule', isActive: false, criteria: { ...DEFAULT_AUTO_ASSIGN }, createdBy: 'system', updatedAt: new Date().toISOString() }];
  return rules.map((r) => ({ id: r.id, name: r.name, isActive: r.isActive, criteria: r.criteria, createdBy: r.createdBy, updatedAt: r.updatedAt?.toISOString() || new Date().toISOString() }));
}

export async function updateAutoAssignRule(rule: { id?: string; name?: string; isActive?: boolean; criteria?: Record<string, unknown>; createdBy?: string }) {
  const ruleId = rule.id || 'default';
  const doc = await AutoAssignRule.findOneAndUpdate(
    { id: ruleId },
    { $set: { name: rule.name || 'Default Rule', isActive: rule.isActive ?? false, criteria: rule.criteria, updatedAt: new Date() }, $setOnInsert: { id: ruleId, createdBy: rule.createdBy || 'system' } },
    { upsert: true, new: true },
  ).lean() as { id?: string; name?: string; isActive?: boolean; criteria?: Record<string, unknown>; createdBy?: string; updatedAt?: Date };
  return { id: doc?.id, name: doc?.name, isActive: doc?.isActive, criteria: doc?.criteria, createdBy: doc?.createdBy, updatedAt: doc?.updatedAt?.toISOString() };
}

export async function groupOrders(filters: { status?: string; zone?: string; search?: string; radius?: number; minSize?: number; maxSize?: number } = {}) {
  const { radius = 2, minSize = 2, maxSize = 10 } = filters;
  const radiusKm = Math.min(50, Math.max(0.05, radius));
  const reservedIds = new Set((await Cluster.find({ status: { $in: ['active', 'assigned'] } }).select('orderIds').lean() as Array<{ orderIds?: string[] }>).flatMap((c) => c.orderIds || []));

  const query: Record<string, unknown> = { status: { $in: GROUP_DELIVERY_LIVE_STATUSES } };
  if (filters.zone) query.zone = filters.zone;
  let orders = (await WarehouseOrderModel.find(query).lean()) as Record<string, unknown>[];
  orders = (orders.map((raw) => { const o = normalizeOrder(raw); const coords = extractDropCoordinates(raw); const dist = calcOrderDistance(raw); return { ...o, coordinates: coords, distanceKm: dist, etaMinutes: Math.ceil(dist * MINUTES_PER_KM_ESTIMATE), priority: calculatePriority(o.slaDeadline), riderEarning: RIDER_EARNING_BASE_INR + dist * RIDER_EARNING_PER_KM_INR } as any; }) as any[]).filter((o: any) => o.id && !reservedIds.has(o.id) && !o.riderId && isValidCoord(o.coordinates?.lat, o.coordinates?.lng));

  if (filters.search) { const q = filters.search.toLowerCase(); orders = orders.filter((o: any) => String(o.id).toLowerCase().includes(q) || String(o.customerName || '').toLowerCase().includes(q)); }

  const remaining = [...orders] as any[];
  remaining.sort((a: any, b: any) => a.coordinates.lat - b.coordinates.lat);
  const clusters: Array<{ id: string; orders: unknown[]; center: { lat: number; lng: number }; orderCount: number; color: string; radiusKm: number }> = [];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const cluster = [seed];
    for (let i = 0; i < remaining.length && cluster.length < maxSize; i++) {
      const other = remaining[i];
      const d = calculateDistance((seed.coordinates as { lat: number; lng: number }).lat, (seed.coordinates as { lat: number; lng: number }).lng, (other.coordinates as { lat: number; lng: number }).lat, (other.coordinates as { lat: number; lng: number }).lng);
      if (d <= radiusKm) { cluster.push(other); remaining.splice(i, 1); i--; }
    }
    if (cluster.length >= minSize) {
      const avgLat = cluster.reduce((s, o) => s + (o.coordinates as { lat: number }).lat, 0) / cluster.length;
      const avgLng = cluster.reduce((s, o) => s + (o.coordinates as { lng: number }).lng, 0) / cluster.length;
      clusters.push({ id: `draft-${clusters.length + 1}`, orders: cluster, center: { lat: avgLat, lng: avgLng }, orderCount: cluster.length, color: GROUP_CLUSTER_COLORS[clusters.length % GROUP_CLUSTER_COLORS.length], radiusKm });
    }
  }

  const clusteredIds = new Set(clusters.flatMap((c) => (c.orders as Array<{ id: string }>).map((o) => o.id)));
  const unclustered = orders.filter((o) => !clusteredIds.has(o.id as string));
  return { clusters, unclustered, radiusKm, totalOrders: orders.length, clusteredCount: clusteredIds.size, unclusteredCount: unclustered.length };
}

export async function listGroupDeliveryOrders(filters: { status?: string; zone?: string; search?: string } = {}) {
  const reservedIds = new Set((await Cluster.find({ status: { $in: ['active', 'assigned'] } }).select('orderIds').lean() as Array<{ orderIds?: string[] }>).flatMap((c) => c.orderIds || []));
  const query: Record<string, unknown> = { status: { $in: GROUP_DELIVERY_LIVE_STATUSES } };
  if (filters.zone) query.zone = filters.zone;
  let orders = (await WarehouseOrderModel.find(query).lean()) as Record<string, unknown>[];
  orders = (orders.map((raw) => { const o = normalizeOrder(raw); const coords = extractDropCoordinates(raw); const dist = calcOrderDistance(raw); return { ...o, coordinates: coords, distanceKm: dist, etaMinutes: Math.ceil(dist * MINUTES_PER_KM_ESTIMATE), priority: calculatePriority(o.slaDeadline), riderEarning: RIDER_EARNING_BASE_INR + dist * RIDER_EARNING_PER_KM_INR } as any; }) as any[]).filter((o: any) => o.id && !reservedIds.has(o.id) && !o.riderId && isValidCoord(o.coordinates?.lat, o.coordinates?.lng));
  if (filters.search) { const q = filters.search.toLowerCase(); orders = orders.filter((o: any) => String(o.id).toLowerCase().includes(q) || String(o.customerName || '').toLowerCase().includes(q)); }
  return { orders, total: orders.length };
}

export async function computeClusterMetrics(orderIds: string[]) {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return { orderCount: 0, totalDistanceKm: 0, estimatedDeliveryMinutes: 0, totalEarnings: 0, slaRisk: 'ok', slaRiskLabel: 'No orders', ordersAtRisk: 0 };
  const rawOrders = (await WarehouseOrderModel.find({ id: { $in: ids } }).lean()) as Record<string, unknown>[];
  const orders = rawOrders.map((raw) => { const o = normalizeOrder(raw); const coords = extractDropCoordinates(raw); const dist = calcOrderDistance(raw); return { ...o, coordinates: coords, distanceKm: dist, riderEarning: RIDER_EARNING_BASE_INR + dist * RIDER_EARNING_PER_KM_INR }; });
  const totalDistanceKm = orders.reduce((s, o) => s + (o.distanceKm as number), 0);
  const estimatedDeliveryMinutes = Math.ceil(totalDistanceKm * MINUTES_PER_KM_ESTIMATE) + orders.length * MINUTES_PER_STOP_BUFFER;
  const totalEarnings = Math.round(orders.reduce((s, o) => s + (o.riderEarning as number), 0) * 100) / 100;
  const now = Date.now();
  const ordersAtRisk = (orders as any[]).filter((o: any) => { const d = o.slaDeadline ? new Date(o.slaDeadline).getTime() : null; return d && (d - now) / 60000 < estimatedDeliveryMinutes + 10; }).length;
  const slaRisk = ordersAtRisk > 0 ? 'high' : 'ok';
  return { orderCount: orders.length, totalDistanceKm: Math.round(totalDistanceKm * 100) / 100, estimatedDeliveryMinutes, totalEarnings, slaRisk, slaRiskLabel: slaRisk === 'high' ? 'High risk — SLA likely breached' : 'On track for SLA', ordersAtRisk, missingOrderCount: ids.length - orders.length };
}

export async function saveClusters(clustersData: Array<{ clusterId?: string; id?: string; orders?: Array<{ id: string; zone?: string }>; center?: { lat: number; lng: number }; color?: string; zone?: string; metadata?: Record<string, unknown>; radiusKm?: number }>) {
  const saved = [];
  for (const data of clustersData) {
    const rawId = data.clusterId || data.id;
    const clusterId = rawId && !String(rawId).startsWith('draft-') ? String(rawId) : `CL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const orderIds = (data.orders || []).map((o) => o.id).filter(Boolean);
    if (!orderIds.length) continue;
    const cluster = await Cluster.findOneAndUpdate(
      { clusterId },
      { clusterId, orderIds, center: data.center, color: data.color || '#F97316', zone: data.orders?.[0]?.zone || null, status: 'active', metadata: { ...(data.metadata || {}), ...(data.radiusKm != null ? { radiusKm: data.radiusKm } : {}) } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    saved.push(cluster);
  }
  return saved;
}

export async function listClusters(filters: { status?: string; zone?: string } = {}) {
  const query: Record<string, unknown> = { status: filters.status || 'active' };
  if (filters.zone) query.zone = filters.zone;
  const clusters = await Cluster.find(query).sort({ createdAt: -1 }).lean() as Array<{ clusterId: string; orderIds: string[]; center: { lat: number; lng: number }; color: string; zone?: string; status: string; riderId?: string; metadata?: Record<string, unknown>; createdAt: Date }>;
  return Promise.all(clusters.map(async (c) => {
    const orders = (await WarehouseOrderModel.find({ id: { $in: c.orderIds } }).lean()) as Record<string, unknown>[];
    return { ...c, orders: orders.map((raw) => { const o = normalizeOrder(raw); const coords = extractDropCoordinates(raw); const dist = calcOrderDistance(raw); return { ...o, coordinates: coords, distanceKm: dist }; }), radiusKm: c.metadata?.radiusKm };
  }));
}

export async function deleteCluster(clusterId: string) {
  const result = await Cluster.deleteOne({ clusterId });
  return result.deletedCount > 0;
}

export async function assignClusterToRider(clusterId: string, riderId: string, options: { overrideSla?: boolean } = {}) {
  const cluster = await Cluster.findOne({ clusterId });
  if (!cluster) throw Object.assign(new Error('Cluster not found'), { statusCode: 404 });
  if (cluster.status === 'assigned' && cluster.riderId && cluster.riderId !== riderId) throw Object.assign(new Error('Cluster is already assigned to another rider'), { statusCode: 400 });

  const rider = await Rider.findOne({ id: riderId });
  if (!rider) throw Object.assign(new Error('Rider not found'), { statusCode: 404 });

  const orderIds = cluster.orderIds || [];
  if (!orderIds.length) throw Object.assign(new Error('Cluster has no orders'), { statusCode: 400 });

  const spare = (rider.capacity?.maxLoad ?? 5) - (rider.capacity?.currentLoad ?? 0);
  if (spare < orderIds.length) throw Object.assign(new Error(`Rider has capacity for ${Math.max(0, spare)} more order(s), but group has ${orderIds.length}`), { statusCode: 400 });

  const assigned: unknown[] = [], failed: Array<{ orderId: string; message: string }> = [];
  for (const orderId of orderIds) {
    try { const res = await assignOrder(orderId, riderId, options.overrideSla); assigned.push({ orderId, ...(res as any) }); }
    catch (err) { failed.push({ orderId, message: (err as Error).message }); }
  }

  if (!assigned.length) throw Object.assign(new Error(failed[0]?.message || 'No orders could be assigned'), { statusCode: 400 });
  cluster.status = failed.length === 0 ? 'assigned' : 'active';
  cluster.riderId = riderId;
  await cluster.save();

  return { success: true, clusterId, riderId, riderName: rider.name, assignedCount: assigned.length, failedCount: failed.length, totalOrders: orderIds.length, assigned, failed };
}

export async function getGroupDeliveryFilterOptions() {
  const reservedIds = new Set((await Cluster.find({ status: { $in: ['active', 'assigned'] } }).select('orderIds').lean() as Array<{ orderIds?: string[] }>).flatMap((c) => c.orderIds || []));
  const orders = (await WarehouseOrderModel.find({ status: { $in: GROUP_DELIVERY_LIVE_STATUSES } }).select('zone status id riderId').lean()) as Array<{ zone?: string; status?: string; id?: string; riderId?: string }>;
  const zones = new Set<string>(), statuses = new Set<string>();
  for (const o of orders) {
    const id = o.id;
    if (!id || reservedIds.has(id) || o.riderId) continue;
    if (o.zone) zones.add(o.zone);
    if (o.status) statuses.add(o.status);
  }
  return { zones: Array.from(zones).sort(), statuses: Array.from(statuses).sort() };
}

export async function updateClusterOrders(clusterId: string, orderIds: string[]) {
  const cluster = await Cluster.findOne({ clusterId });
  if (!cluster) throw Object.assign(new Error('Cluster not found'), { statusCode: 404 });
  if (cluster.status === 'assigned') throw Object.assign(new Error('Cannot modify an assigned group'), { statusCode: 400 });
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (ids.length > 10) throw Object.assign(new Error('A group can have at most 10 orders'), { statusCode: 400 });
  const orders = (await WarehouseOrderModel.find({ id: { $in: ids } }).lean()) as Record<string, unknown>[];
  if (orders.length !== ids.length) throw Object.assign(new Error('One or more orders were not found'), { statusCode: 400 });
  const withCoords = orders.map((raw) => ({ ...normalizeOrder(raw), coordinates: extractDropCoordinates(raw) })).filter((o) => isValidCoord((o.coordinates as { lat: number; lng: number }).lat, (o.coordinates as { lat: number; lng: number }).lng));
  let center = cluster.center;
  if (withCoords.length > 0) center = { lat: withCoords.reduce((s, o) => s + (o.coordinates as { lat: number }).lat, 0) / withCoords.length, lng: withCoords.reduce((s, o) => s + (o.coordinates as { lng: number }).lng, 0) / withCoords.length };
  cluster.orderIds = ids;
  cluster.center = center;
  await cluster.save();
  return { clusterId: cluster.clusterId, orderIds: ids, center, orders };
}

// ─── Batch assign by dark store ──────────────────────────────────────────────
// Fetches every unassigned customer order for a specific dark store and
// distributes them across riders whose homeStoreId matches (or all available
// riders if no store-scoped riders exist). Uses the same capacity/score
// primitives as autoAssignOrders but scoped to one store's operational unit.

interface BatchAssignByStoreResult {
  storeId: string;
  totalOrders: number;
  assigned: number;
  failed: number;
  assignments: Array<{ orderId: string; riderId: string | null; riderName?: string; status: 'assigned' | 'failed'; reason: string | null }>;
}

export async function batchAssignByStore(storeId: string): Promise<BatchAssignByStoreResult> {
  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    throw Object.assign(new Error('Invalid storeId'), { statusCode: 400 });
  }
  const storeOid = new mongoose.Types.ObjectId(storeId);

  // Pull unassigned confirmed/getting-packed customer orders for this store.
  // We query the shared `orders` collection via WarehouseOrderModel to reuse
  // this module's assign primitives, but filter by the customer-order fields.
  const unassignedOrders = (await WarehouseOrderModel.find({
    storeId: storeOid,
    status: { $in: ['confirmed', 'getting-packed'] },
    $or: [{ riderId: null }, { riderId: { $exists: false } }],
  })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean()) as Record<string, unknown>[];

  if (!unassignedOrders.length) {
    return { storeId, totalOrders: 0, assigned: 0, failed: 0, assignments: [] };
  }

  // Prefer riders whose home store matches; if none, fall back to any
  // available rider (early operational state where riders aren't mapped yet).
  const scopedRiders = (await Rider.find({
    homeStoreId: storeOid,
    status: { $in: ['online', 'idle', 'busy'] },
    $expr: { $lt: ['$capacity.currentLoad', '$capacity.maxLoad'] },
  }).lean()) as Record<string, unknown>[];

  const availableRiders =
    scopedRiders.length > 0
      ? scopedRiders
      : ((await Rider.find({
          status: { $in: ['online', 'idle'] },
          $expr: { $lt: ['$capacity.currentLoad', '$capacity.maxLoad'] },
        }).lean()) as Record<string, unknown>[]);

  if (!availableRiders.length) {
    return {
      storeId,
      totalOrders: unassignedOrders.length,
      assigned: 0,
      failed: unassignedOrders.length,
      assignments: unassignedOrders.map((o) => ({
        orderId: String(o._id),
        riderId: null,
        status: 'failed',
        reason: 'No riders available for this store',
      })),
    };
  }

  // Simple round-robin least-loaded assignment. Keeps the store's load balanced
  // across its riders without needing full auto-assign scoring for now.
  const workingLoads = new Map<string, number>(
    availableRiders.map((r) => [String(r.id), (r.capacity as { currentLoad: number }).currentLoad]),
  );

  const assignments: BatchAssignByStoreResult['assignments'] = [];
  let assigned = 0;
  let failed = 0;

  for (const rawOrder of unassignedOrders) {
    const orderIdStr = String(rawOrder._id);
    // Pick the least-loaded still-eligible rider each iteration.
    let best: Record<string, unknown> | null = null;
    let bestLoad = Infinity;
    for (const r of availableRiders) {
      const rid = String(r.id);
      const load = workingLoads.get(rid) ?? 0;
      const max = (r.capacity as { maxLoad: number }).maxLoad;
      if (load >= max) continue;
      if (load < bestLoad) {
        best = r;
        bestLoad = load;
      }
    }
    if (!best) {
      assignments.push({ orderId: orderIdStr, riderId: null, status: 'failed', reason: 'All riders at capacity' });
      failed++;
      continue;
    }

    try {
      // Update the customer order directly (WarehouseOrderModel wraps the same
      // `orders` collection so we can persist riderId back onto it).
      await WarehouseOrderModel.updateOne(
        { _id: rawOrder._id },
        {
          $set: { riderId: String(best.id) },
          $push: {
            timeline: {
              status: rawOrder.status,
              timestamp: new Date(),
              note: `Auto-assigned to ${best.name} via batch-by-store`,
              actor: 'system:dispatch',
            },
          },
        },
      );
      workingLoads.set(String(best.id), (workingLoads.get(String(best.id)) ?? 0) + 1);
      assignments.push({
        orderId: orderIdStr,
        riderId: String(best.id),
        riderName: String(best.name),
        status: 'assigned',
        reason: null,
      });
      assigned++;
    } catch (err) {
      logger.error(`batchAssignByStore: failed to assign order ${orderIdStr}`, err as Record<string, unknown>);
      assignments.push({ orderId: orderIdStr, riderId: null, status: 'failed', reason: (err as Error).message });
      failed++;
    }
  }

  // Persist updated capacity for riders we assigned to.
  await Promise.all(
    Array.from(workingLoads.entries()).map(([rid, load]) =>
      Rider.updateOne({ id: rid }, { $set: { 'capacity.currentLoad': load } }),
    ),
  );

  return { storeId, totalOrders: unassignedOrders.length, assigned, failed, assignments };
}
