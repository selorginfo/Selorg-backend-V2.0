import mongoose from 'mongoose';
import { Store } from '../store/store.model';
import { City, Zone } from './master-data.model';
import { AppError } from '../../utils/AppError';
import { cacheService } from '../../utils/cache';

const STATUS_VALUES = ['active', 'offline', 'inactive', 'maintenance'];
const SERVICE_STATUS_VALUES = ['Full', 'Partial', 'None'];
const DAY_KEYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function paginationParams(page?: string | number, limit?: string | number) {
  const pageNum = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit ?? 50), 10) || 50));
  return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
}

async function invalidateStoresCache(): Promise<void> {
  await cacheService.delPattern('cache:/api/v1/admin/stores*').catch(() => undefined);
  await cacheService.delPattern('cache:/api/v1/admin/warehouses*').catch(() => undefined);
}

function validateCode(code: unknown, fieldName = 'Code'): string {
  if (!code || !String(code).trim()) throw AppError.badRequest(`${fieldName} is required`);
  const normalized = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,20}$/.test(normalized)) {
    throw AppError.badRequest(`${fieldName} must be uppercase alphanumeric with hyphens only (max 20 chars)`);
  }
  return normalized;
}

function toTitleDay(key: string): string {
  const v = String(key).trim().toLowerCase();
  return v ? `${v[0].toUpperCase()}${v.slice(1)}` : '';
}

function normalizeOperationalHours(hours: unknown): Record<string, { open: string; close: string; isOpen: boolean }> | undefined {
  if (!hours || typeof hours !== 'object') return undefined;
  const src = hours as Record<string, { open?: string; close?: string; isOpen?: boolean }>;
  const normalized: Record<string, { open: string; close: string; isOpen: boolean }> = {};
  Object.entries(src).forEach(([k, v]) => {
    const day = toTitleDay(k);
    if (!day) return;
    normalized[day] = { open: v?.open ?? '09:00', close: v?.close ?? '21:00', isOpen: typeof v?.isOpen === 'boolean' ? v.isOpen : true };
  });
  return normalized;
}

function validateOperationalHours(hours?: Record<string, { open: string; close: string; isOpen: boolean }>): void {
  if (!hours) return;
  const keys = Object.keys(hours);
  if (keys.length === 0) return;
  const hasAllDays = DAY_KEYS.every((day) => Object.prototype.hasOwnProperty.call(hours, day));
  if (!hasAllDays) throw AppError.badRequest('operationalHours must include all 7 days: Monday-Sunday');
  DAY_KEYS.forEach((day) => {
    const slot = hours[day];
    if (!slot || typeof slot.open !== 'string' || typeof slot.close !== 'string' || typeof slot.isOpen !== 'boolean') {
      throw AppError.badRequest(`operationalHours.${day} must include open, close and isOpen`);
    }
  });
}

interface LocationCapacityInput {
  cityId?: string;
  zoneId?: string;
  latitude?: unknown;
  longitude?: unknown;
  maxCapacity?: unknown;
  currentLoad?: unknown;
  deliveryRadius?: unknown;
  status?: unknown;
  serviceStatus?: unknown;
  email?: unknown;
}

function validateLocationAndCapacity(body: LocationCapacityInput, fallback: LocationCapacityInput = {}) {
  const cityId = body.cityId ?? fallback.cityId;
  const zoneId = body.zoneId ?? fallback.zoneId;
  const latitude = body.latitude ?? fallback.latitude;
  const longitude = body.longitude ?? fallback.longitude;
  const maxCapacity = Number(body.maxCapacity ?? fallback.maxCapacity ?? 100);
  const currentLoad = Number(body.currentLoad ?? fallback.currentLoad ?? 0);
  const deliveryRadius = Number(body.deliveryRadius ?? fallback.deliveryRadius ?? 5);
  const status = String(body.status ?? fallback.status ?? 'active');
  const serviceStatus = body.serviceStatus ?? fallback.serviceStatus;
  const email = body.email ?? fallback.email;

  if (!cityId || !mongoose.Types.ObjectId.isValid(String(cityId))) throw AppError.badRequest('Valid cityId is required');
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw AppError.badRequest('Latitude is required and must be between -90 and 90');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw AppError.badRequest('Longitude is required and must be between -180 and 180');
  if (!STATUS_VALUES.includes(status)) throw AppError.badRequest(`status must be one of: ${STATUS_VALUES.join(', ')}`);
  if (serviceStatus && !SERVICE_STATUS_VALUES.includes(String(serviceStatus))) {
    throw AppError.badRequest(`serviceStatus must be one of: ${SERVICE_STATUS_VALUES.join(', ')}`);
  }
  if (!Number.isFinite(deliveryRadius) || deliveryRadius < 1 || deliveryRadius > 100) throw AppError.badRequest('deliveryRadius must be between 1 and 100');
  if (!Number.isFinite(maxCapacity) || maxCapacity < 0) throw AppError.badRequest('maxCapacity must be a non-negative number');
  if (!Number.isFinite(currentLoad) || currentLoad < 0 || currentLoad > maxCapacity) throw AppError.badRequest('currentLoad must be >= 0 and <= maxCapacity');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) throw AppError.badRequest('email must be a valid email address');

  return { cityId: String(cityId), zoneId: zoneId ? String(zoneId) : undefined, lat, lng, maxCapacity, currentLoad, deliveryRadius, status };
}

function transformStore(doc: Record<string, any>) {
  if (!doc) return null;
  const cityName = doc.cityId?.name ?? doc.city ?? (doc.zones && doc.zones[0]) ?? '—';
  const zoneName = doc.zoneId?.name ?? (doc.zones && doc.zones[0]) ?? '—';
  const managerName = doc.managerId?.name ?? '';
  let operationalHours: Record<string, unknown> = {};
  if (doc.operationalHours instanceof Map) operationalHours = Object.fromEntries(doc.operationalHours);
  else if (doc.operationalHours && typeof doc.operationalHours === 'object') operationalHours = doc.operationalHours;

  return {
    id: doc._id?.toString(),
    code: doc.code ?? `STORE-${doc._id}`,
    name: doc.name,
    type: doc.type ?? 'store',
    address: doc.address,
    city: cityName,
    cityId: doc.cityId?._id ?? doc.cityId,
    zone: zoneName,
    zoneId: doc.zoneId?._id ?? doc.zoneId,
    state: doc.state,
    pincode: doc.pincode,
    latitude: doc.latitude ?? doc.x,
    longitude: doc.longitude ?? doc.y,
    zones: doc.zones ?? [],
    phone: doc.phone,
    email: doc.email,
    manager: managerName,
    managerId: doc.managerId?._id ?? doc.managerId,
    status: doc.status ?? 'inactive',
    serviceStatus: doc.serviceStatus,
    deliveryRadius: doc.deliveryRadius ?? 5,
    maxCapacity: doc.maxCapacity ?? 100,
    currentLoad: doc.currentLoad ?? 0,
    operationalHours,
    metadata: doc.metadata,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function transformWarehouse(doc: Record<string, any>) {
  const base = transformStore(doc);
  if (!base) return null;
  return {
    ...base,
    storageCapacity: doc.maxCapacity ?? 0,
    currentUtilization: doc.currentLoad != null ? Math.round((doc.currentLoad / (doc.maxCapacity || 1)) * 100) : 0,
  };
}

async function validateCityZone(cityId: string, zoneId?: string): Promise<void> {
  const city = await City.findById(cityId).lean();
  if (!city) throw AppError.badRequest('City not found');
  if (zoneId) {
    if (!mongoose.Types.ObjectId.isValid(zoneId)) throw AppError.badRequest('zoneId is invalid');
    const zone = await Zone.findById(zoneId).lean();
    if (!zone) throw AppError.badRequest('Zone not found');
    if (String(zone.cityId) !== String(cityId)) throw AppError.badRequest('zoneId must belong to the selected cityId');
  }
}

export interface StoreFilter {
  search?: string;
  status?: string;
  cityId?: string;
  zoneId?: string;
  type?: string;
  page?: string | number;
  limit?: string | number;
}

export async function listStores(filter: StoreFilter) {
  const query: Record<string, unknown> = {};
  if (filter.search?.trim()) {
    const s = escapeRegex(filter.search.trim());
    query.$or = [{ name: { $regex: s, $options: 'i' } }, { code: { $regex: s, $options: 'i' } }, { address: { $regex: s, $options: 'i' } }];
  }
  if (filter.status) query.status = filter.status;
  if (filter.cityId && mongoose.Types.ObjectId.isValid(filter.cityId)) query.cityId = filter.cityId;
  if (filter.zoneId && mongoose.Types.ObjectId.isValid(filter.zoneId)) query.zoneId = filter.zoneId;
  if (filter.type) query.type = filter.type;

  const { pageNum, limitNum, skip } = paginationParams(filter.page, filter.limit);
  const [stores, total] = await Promise.all([
    Store.find(query).populate('cityId', 'name code').populate('zoneId', 'name').populate('managerId', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Store.countDocuments(query),
  ]);
  return {
    data: stores.map(transformStore),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

export async function getStore(id: string) {
  const store = await Store.findById(id).populate('cityId', 'name code').populate('zoneId', 'name').populate('managerId', 'name email').lean();
  if (!store) throw AppError.notFound('Store', id);
  return transformStore(store as unknown as Record<string, any>);
}

export interface StoreInput extends LocationCapacityInput {
  code?: string;
  name?: string;
  type?: string;
  address?: string;
  operationalHours?: unknown;
  [key: string]: unknown;
}

export async function createStore(input: StoreInput) {
  const body: Record<string, unknown> = { ...input };
  body.code = validateCode(body.code, 'Store code');
  const validated = validateLocationAndCapacity(body);

  const existing = await Store.findOne({ code: body.code });
  if (existing) throw AppError.conflict('Store code already exists');

  await validateCityZone(validated.cityId, validated.zoneId);

  const normalizedHours = normalizeOperationalHours(body.operationalHours);
  validateOperationalHours(normalizedHours);
  if (normalizedHours) body.operationalHours = new Map(Object.entries(normalizedHours));
  body.latitude = validated.lat;
  body.longitude = validated.lng;
  body.maxCapacity = validated.maxCapacity;
  body.currentLoad = validated.currentLoad;
  body.deliveryRadius = validated.deliveryRadius;
  body.status = validated.status;

  const store = await Store.create(body);
  await invalidateStoresCache();
  const populated = await Store.findById(store._id).populate('cityId', 'name code').populate('zoneId', 'name').populate('managerId', 'name email').lean();
  return transformStore(populated as unknown as Record<string, any>);
}

export async function updateStore(id: string, input: StoreInput) {
  const store = await Store.findById(id);
  if (!store) throw AppError.notFound('Store', id);

  const body: Record<string, unknown> = { ...input };
  const validated = validateLocationAndCapacity(body, store as unknown as LocationCapacityInput);

  if (body.code && body.code !== store.code) {
    body.code = validateCode(body.code, 'Store code');
    const existing = await Store.findOne({ code: body.code, _id: { $ne: id } });
    if (existing) throw AppError.conflict('Store code already exists');
  }

  await validateCityZone(validated.cityId, validated.zoneId ?? (store.zoneId ? String(store.zoneId) : undefined));

  const normalizedHours = normalizeOperationalHours(body.operationalHours);
  validateOperationalHours(normalizedHours);
  if (normalizedHours) body.operationalHours = new Map(Object.entries(normalizedHours));
  body.latitude = validated.lat;
  body.longitude = validated.lng;
  body.maxCapacity = validated.maxCapacity;
  body.currentLoad = validated.currentLoad;
  body.deliveryRadius = validated.deliveryRadius;
  body.status = validated.status;

  const updated = await Store.findByIdAndUpdate(id, body, { new: true, runValidators: true })
    .populate('cityId', 'name code')
    .populate('zoneId', 'name')
    .populate('managerId', 'name email')
    .lean();
  await invalidateStoresCache();
  return transformStore(updated as unknown as Record<string, any>);
}

/**
 * Legacy `deleteStore` blocks deletion when the store's zone has active orders (checked
 * against `warehouse/models/Order`). That check is deliberately NOT ported here — the
 * warehouse sub-app doesn't exist in selorg-service yet (see [[project_selorg_service_migration]]).
 * Re-add the active-order guard once the warehouse module's Order model is ported.
 */
export async function deleteStore(id: string) {
  const store = await Store.findById(id);
  if (!store) throw AppError.notFound('Store', id);
  await Store.findByIdAndDelete(id);
  await invalidateStoresCache();
  return { message: 'Store deleted' };
}

// --- Warehouses (Store with type=warehouse) ---------------------------------------------------

export interface WarehouseFilter {
  search?: string;
  status?: string;
  page?: string | number;
  limit?: string | number;
}

export async function listWarehouses(filter: WarehouseFilter) {
  const query: Record<string, unknown> = { type: 'warehouse' };
  if (filter.status) query.status = filter.status;
  if (filter.search?.trim()) {
    const s = escapeRegex(filter.search.trim());
    query.$or = [{ name: { $regex: s, $options: 'i' } }, { code: { $regex: s, $options: 'i' } }, { address: { $regex: s, $options: 'i' } }];
  }
  const { pageNum, limitNum, skip } = paginationParams(filter.page, filter.limit);
  const [stores, total] = await Promise.all([
    Store.find(query).populate('cityId', 'name code').populate('zoneId', 'name').populate('managerId', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Store.countDocuments(query),
  ]);
  return {
    data: stores.map(transformWarehouse),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

export async function getWarehouse(id: string) {
  const store = await Store.findOne({ _id: id, type: 'warehouse' }).populate('cityId', 'name code').populate('zoneId', 'name').populate('managerId', 'name email').lean();
  if (!store) throw AppError.notFound('Warehouse', id);
  return transformWarehouse(store as unknown as Record<string, any>);
}

export async function createWarehouse(input: StoreInput) {
  const body: Record<string, unknown> = { ...input, type: 'warehouse' };
  body.code = validateCode(body.code, 'Warehouse code');
  const validated = validateLocationAndCapacity(body);

  const existing = await Store.findOne({ code: body.code });
  if (existing) throw AppError.conflict('Warehouse code already exists');

  await validateCityZone(validated.cityId, validated.zoneId);

  const normalizedHours = normalizeOperationalHours(body.operationalHours);
  validateOperationalHours(normalizedHours);
  if (normalizedHours) body.operationalHours = new Map(Object.entries(normalizedHours));
  body.latitude = validated.lat;
  body.longitude = validated.lng;
  body.maxCapacity = validated.maxCapacity;
  body.currentLoad = validated.currentLoad;
  body.deliveryRadius = validated.deliveryRadius;
  body.status = validated.status;

  const store = await Store.create(body);
  await invalidateStoresCache();
  const populated = await Store.findById(store._id).populate('cityId', 'name code').populate('zoneId', 'name').populate('managerId', 'name email').lean();
  return transformWarehouse(populated as unknown as Record<string, any>);
}

export async function updateWarehouse(id: string, input: StoreInput) {
  const store = await Store.findOne({ _id: id, type: 'warehouse' });
  if (!store) throw AppError.notFound('Warehouse', id);

  const body: Record<string, unknown> = { ...input };
  delete body.type;
  const validated = validateLocationAndCapacity(body, store as unknown as LocationCapacityInput);

  if (body.code) {
    body.code = validateCode(body.code, 'Warehouse code');
    const existing = await Store.findOne({ code: body.code, _id: { $ne: id } });
    if (existing) throw AppError.conflict('Warehouse code already exists');
  }

  await validateCityZone(validated.cityId, validated.zoneId ?? (store.zoneId ? String(store.zoneId) : undefined));

  const normalizedHours = normalizeOperationalHours(body.operationalHours);
  validateOperationalHours(normalizedHours);
  if (normalizedHours) body.operationalHours = new Map(Object.entries(normalizedHours));
  body.latitude = validated.lat;
  body.longitude = validated.lng;
  body.maxCapacity = validated.maxCapacity;
  body.currentLoad = validated.currentLoad;
  body.deliveryRadius = validated.deliveryRadius;
  body.status = validated.status;

  Object.assign(store, body);
  await store.save();
  await invalidateStoresCache();
  const populated = await Store.findById(store._id).populate('cityId', 'name code').populate('zoneId', 'name').populate('managerId', 'name email').lean();
  return transformWarehouse(populated as unknown as Record<string, any>);
}

export async function deleteWarehouse(id: string) {
  const store = await Store.findOne({ _id: id, type: 'warehouse' });
  if (!store) throw AppError.notFound('Warehouse', id);
  store.status = 'inactive';
  await store.save();
  await invalidateStoresCache();
  return { message: 'Warehouse deactivated' };
}

// --- Stats ---------------------------------------------------------------------------------

/**
 * Per-store order, revenue, rating and SLA metrics.
 *
 * Joining orders to stores is not a direct id match: `CustomerOrder.storeId` references the
 * `dark_stores` collection while this endpoint reports on `stores`. The shared key is `code`, so
 * order groups are resolved to a darkstore code (from `offerHubKey`, falling back to the
 * darkstore document) and then matched to a Store by code.
 *
 * Conventions: an "order" is any non-cancelled order placed in the window; "revenue" is billed
 * value of orders *delivered* in the window, so cancelled and in-flight orders never inflate it.
 */
interface StorePerformanceRow {
  storeId: string;
  storeName: string;
  ordersToday: number;
  ordersWeek: number;
  ordersMonth: number;
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  avgRating: number;
  totalReviews: number;
  onTimeDelivery: number;
  capacityUtilization: number;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBack(days: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - days);
  return d;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export async function getStorePerformance(): Promise<StorePerformanceRow[]> {
  const { Order } = await import('../orders/order.model');
  const { DarkStore } = await import('../store/dark-store.model');

  const stores = await Store.find().select('_id name code maxCapacity currentLoad').lean();
  if (!stores.length) return [];

  // darkstore _id → code, so order groups keyed by storeId can be matched to a Store by code.
  const darkStores = await DarkStore.find().select('_id code').lean();
  const codeByDarkStoreId = new Map(darkStores.map((d) => [String(d._id), String(d.code || '').toUpperCase()]));

  const todayStart = startOfToday();
  const weekStart = daysBack(6); // today plus the previous 6 days
  const monthStart = daysBack(29);

  const grouped = await Order.aggregate<{
    _id: { storeId: mongoose.Types.ObjectId | null; hubKey: string | null };
    ordersToday: number;
    ordersWeek: number;
    ordersMonth: number;
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    ratingSum: number;
    ratingCount: number;
    slaTracked: number;
    slaOnTime: number;
  }>([
    { $match: { createdAt: { $gte: monthStart } } },
    {
      $group: {
        _id: { storeId: '$storeId', hubKey: '$offerHubKey' },
        ordersToday: {
          $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', todayStart] }, { $ne: ['$status', 'cancelled'] }] }, 1, 0] },
        },
        ordersWeek: {
          $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', weekStart] }, { $ne: ['$status', 'cancelled'] }] }, 1, 0] },
        },
        ordersMonth: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] } },
        revenueToday: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'delivered'] }, { $gte: [{ $ifNull: ['$deliveredAt', '$createdAt'] }, todayStart] }] },
              { $ifNull: ['$totalBill', 0] },
              0,
            ],
          },
        },
        revenueWeek: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'delivered'] }, { $gte: [{ $ifNull: ['$deliveredAt', '$createdAt'] }, weekStart] }] },
              { $ifNull: ['$totalBill', 0] },
              0,
            ],
          },
        },
        revenueMonth: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, { $ifNull: ['$totalBill', 0] }, 0] },
        },
        ratingSum: { $sum: { $ifNull: ['$ratingScore', 0] } },
        ratingCount: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$ratingScore', 0] }, 0] }, 1, 0] } },
        // On-time is only meaningful for delivered orders that carried an SLA target.
        slaTracked: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'delivered'] }, { $ne: ['$deliveredAt', null] }, { $ne: ['$estimatedDelivery', null] }] },
              1,
              0,
            ],
          },
        },
        slaOnTime: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'delivered'] },
                  { $ne: ['$deliveredAt', null] },
                  { $ne: ['$estimatedDelivery', null] },
                  { $lte: ['$deliveredAt', '$estimatedDelivery'] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  // Fold order groups onto darkstore codes.
  type Bucket = Omit<StorePerformanceRow, 'storeId' | 'storeName' | 'avgRating' | 'onTimeDelivery' | 'capacityUtilization'> & {
    ratingSum: number;
    slaTracked: number;
    slaOnTime: number;
  };
  const byCode = new Map<string, Bucket>();

  for (const g of grouped) {
    const code =
      String(g._id.hubKey || '').toUpperCase() ||
      (g._id.storeId ? codeByDarkStoreId.get(String(g._id.storeId)) || '' : '');
    if (!code) continue; // unrouted orders can't be attributed to a store

    const bucket =
      byCode.get(code) ??
      {
        ordersToday: 0, ordersWeek: 0, ordersMonth: 0,
        revenueToday: 0, revenueWeek: 0, revenueMonth: 0,
        totalReviews: 0, ratingSum: 0, slaTracked: 0, slaOnTime: 0,
      };

    bucket.ordersToday += g.ordersToday;
    bucket.ordersWeek += g.ordersWeek;
    bucket.ordersMonth += g.ordersMonth;
    bucket.revenueToday += g.revenueToday;
    bucket.revenueWeek += g.revenueWeek;
    bucket.revenueMonth += g.revenueMonth;
    bucket.totalReviews += g.ratingCount;
    bucket.ratingSum += g.ratingSum;
    bucket.slaTracked += g.slaTracked;
    bucket.slaOnTime += g.slaOnTime;
    byCode.set(code, bucket);
  }

  return stores.map((store) => {
    const code = String(store.code || '').toUpperCase();
    const b = byCode.get(code);
    const capacity = Number(store.maxCapacity) || 0;
    return {
      storeId: String(store._id),
      storeName: store.name,
      ordersToday: b?.ordersToday ?? 0,
      ordersWeek: b?.ordersWeek ?? 0,
      ordersMonth: b?.ordersMonth ?? 0,
      revenueToday: Math.round((b?.revenueToday ?? 0) * 100) / 100,
      revenueWeek: Math.round((b?.revenueWeek ?? 0) * 100) / 100,
      revenueMonth: Math.round((b?.revenueMonth ?? 0) * 100) / 100,
      avgRating: b && b.totalReviews > 0 ? Math.round((b.ratingSum / b.totalReviews) * 10) / 10 : 0,
      totalReviews: b?.totalReviews ?? 0,
      onTimeDelivery: b ? pct(b.slaOnTime, b.slaTracked) : 0,
      capacityUtilization: capacity > 0 ? pct(Number(store.currentLoad) || 0, capacity) : 0,
    };
  });
}

/**
 * Network-wide store totals.
 *
 * `avgRating` and `totalRevenue` previously read `store.rating` / `store.revenue`, neither of
 * which exists on the Store schema, so both were always 0. They are now derived from orders via
 * `getStorePerformance`, and `totalStaff` counts the `warehouse_staff` collection.
 */
export async function getStoreStats() {
  const { Staff } = await import('../warehouse/warehouse.models');

  const [stores, performance, totalStaff] = await Promise.all([
    Store.find().select('status serviceStatus type maxCapacity currentLoad').lean(),
    getStorePerformance(),
    Staff.countDocuments({}),
  ]);

  const activeCount = stores.filter((s) => s.status === 'active' || s.serviceStatus === 'Full').length;
  const rated = performance.filter((p) => p.totalReviews > 0);
  const avgRating = rated.length
    ? rated.reduce((a, p) => a + p.avgRating * p.totalReviews, 0) / rated.reduce((a, p) => a + p.totalReviews, 0)
    : 0;

  const withCapacity = stores.filter((s) => (Number(s.maxCapacity) || 0) > 0);
  const avgCapacityUtilization = withCapacity.length
    ? withCapacity.reduce((a, s) => a + (Number(s.currentLoad) || 0) / (Number(s.maxCapacity) || 1), 0) /
      withCapacity.length
    : 0;

  return {
    totalStores: stores.length,
    activeStores: activeCount,
    darkStores: stores.filter((s) => s.type === 'dark_store').length,
    totalWarehouses: stores.filter((s) => s.type === 'warehouse').length,
    totalStaff,
    avgRating: Math.round(avgRating * 10) / 10,
    totalRevenue: Math.round(performance.reduce((a, p) => a + p.revenueMonth, 0) * 100) / 100,
    avgCapacityUtilization: Math.round(avgCapacityUtilization * 1000) / 10,
  };
}
