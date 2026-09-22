import mongoose from 'mongoose';
import { City, Zone, VehicleType, SkuUnit } from './master-data.model';
import { AdminDirectoryUser } from './admin-directory.model';
import { Store } from '../store/store.model';
import { AppError } from '../../utils/AppError';

const CITY_CODE_REGEX = /^[A-Z]{3}$/;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function paginationParams(page?: string | number, limit?: string | number) {
  const pageNum = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit ?? 50), 10) || 50));
  return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
}

function parseOptionalLatLng(body: Record<string, unknown>): { latitude?: number; longitude?: number } {
  const hasLat = body.latitude !== undefined && body.latitude !== null && String(body.latitude).trim() !== '';
  const hasLng = body.longitude !== undefined && body.longitude !== null && String(body.longitude).trim() !== '';
  if (!hasLat && !hasLng) return {};
  if (hasLat !== hasLng) throw AppError.badRequest('Provide both latitude and longitude, or omit both');
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw AppError.badRequest('latitude must be between -90 and 90');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw AppError.badRequest('longitude must be between -180 and 180');
  return { latitude: lat, longitude: lng };
}

// --- Cities --------------------------------------------------------------------------------

export interface CityFilter {
  isActive?: boolean;
  search?: string;
  page?: string | number;
  limit?: string | number;
}

export async function listCities(filter: CityFilter) {
  const query: Record<string, unknown> = {};
  if (filter.isActive !== undefined) query.isActive = filter.isActive;
  if (filter.search?.trim()) {
    const s = escapeRegex(filter.search.trim());
    query.$or = [{ name: { $regex: s, $options: 'i' } }, { code: { $regex: s, $options: 'i' } }];
  }
  const { pageNum, limitNum, skip } = paginationParams(filter.page, filter.limit);
  const [cities, total] = await Promise.all([
    City.find(query).sort({ name: 1 }).skip(skip).limit(limitNum).lean(),
    City.countDocuments(query),
  ]);
  return {
    data: cities.map((c) => ({ ...c, id: String(c._id) })),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

export async function getCity(id: string) {
  const city = await City.findById(id).lean();
  if (!city) throw AppError.notFound('City', id);
  return { ...city, id: String(city._id) };
}

export interface CreateCityInput {
  code: string;
  name: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
}

export async function createCity(input: CreateCityInput) {
  const codeTrim = String(input.code).trim().toUpperCase();
  if (!CITY_CODE_REGEX.test(codeTrim)) throw AppError.badRequest('City code must be uppercase 3-letter code (e.g. BLR)');
  const existing = await City.findOne({ code: codeTrim });
  if (existing) throw AppError.conflict('City code already exists');
  const coords = parseOptionalLatLng(input as unknown as Record<string, unknown>);
  const city = await City.create({
    code: codeTrim,
    name: String(input.name).trim(),
    state: input.state?.trim(),
    country: input.country?.trim() || 'India',
    ...coords,
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  });
  const obj = city.toObject() as Record<string, unknown>;
  return { ...obj, id: String(city._id) };
}

export interface UpdateCityInput {
  code?: string;
  name?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
}

export async function updateCity(id: string, input: UpdateCityInput) {
  const city = await City.findById(id);
  if (!city) throw AppError.notFound('City', id);

  if (input.code !== undefined) {
    const codeTrim = String(input.code).trim().toUpperCase();
    if (!CITY_CODE_REGEX.test(codeTrim)) throw AppError.badRequest('City code must be uppercase 3-letter code (e.g. BLR)');
    const existing = await City.findOne({ code: codeTrim, _id: { $ne: id } });
    if (existing) throw AppError.conflict('City code already exists');
    city.code = codeTrim;
  }
  if (input.name !== undefined) city.name = input.name.trim();
  if (input.state !== undefined) city.state = input.state?.trim();
  if (input.country !== undefined) city.country = input.country?.trim() || city.country;
  if (input.isActive !== undefined) city.isActive = input.isActive;
  if (input.latitude !== undefined || input.longitude !== undefined) {
    const coords = parseOptionalLatLng(input as Record<string, unknown>);
    city.latitude = coords.latitude;
    city.longitude = coords.longitude;
  }
  if (input.metadata !== undefined) city.metadata = input.metadata;

  await city.save();
  const obj = city.toObject() as Record<string, unknown>;
  return { ...obj, id: String(city._id) };
}

export async function deleteCity(id: string) {
  const city = await City.findById(id);
  if (!city) throw AppError.notFound('City', id);
  const [storeCount, activeZoneCount] = await Promise.all([
    Store.countDocuments({ cityId: city._id, status: { $in: ['active', 'offline', 'maintenance'] } }),
    Zone.countDocuments({ cityId: city._id, status: { $in: ['Active', 'active', 'Pending', 'testing'] } }),
  ]);
  city.isActive = false;
  await city.save();
  const warningParts: string[] = [];
  if (storeCount > 0) warningParts.push(`${storeCount} active store(s) still reference this city`);
  if (activeZoneCount > 0) warningParts.push(`${activeZoneCount} active zone(s) still reference this city`);
  return {
    message: warningParts.length ? `City deactivated with warnings: ${warningParts.join('; ')}` : 'City deactivated',
    warning: warningParts.length ? warningParts.join('; ') : undefined,
  };
}

// --- Zones ---------------------------------------------------------------------------------

export interface ZoneFilter {
  cityId?: string;
  status?: string;
  search?: string;
  page?: string | number;
  limit?: string | number;
}

function normalizeZoneStatus(status: unknown): string {
  return String(status ?? '').toLowerCase();
}

function formatZone(z: Record<string, any>) {
  return {
    ...z,
    id: String(z._id),
    cityId: z.cityId?._id ?? z.cityId,
    cityName: z.cityId?.name,
    cityState: z.cityId?.state,
    status: normalizeZoneStatus(z.status),
  };
}

export async function listZones(filter: ZoneFilter) {
  const query: Record<string, unknown> = {};
  if (filter.cityId && mongoose.Types.ObjectId.isValid(filter.cityId)) query.cityId = filter.cityId;
  if (filter.status) query.status = { $regex: `^${escapeRegex(filter.status.trim())}$`, $options: 'i' };
  if (filter.search?.trim()) {
    const s = escapeRegex(filter.search.trim());
    query.$or = [{ name: { $regex: s, $options: 'i' } }, { code: { $regex: s, $options: 'i' } }];
  }
  const { pageNum, limitNum, skip } = paginationParams(filter.page, filter.limit);
  const [zones, total] = await Promise.all([
    Zone.find(query).populate('cityId', 'name code state').sort({ name: 1 }).skip(skip).limit(limitNum).lean(),
    Zone.countDocuments(query),
  ]);
  return {
    data: zones.map(formatZone),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

export async function getZone(id: string) {
  const zone = await Zone.findById(id).populate('cityId', 'name code state').lean();
  if (!zone) throw AppError.notFound('Zone', id);
  return formatZone(zone as unknown as Record<string, any>);
}

export interface UpsertZoneInput {
  name?: string;
  code?: string;
  cityId?: string;
  type?: string;
  status?: string;
  color?: string;
  areaSqKm?: number;
  defaultCapacity?: number;
  points?: Array<{ x: number; y: number }>;
  polygon?: Array<{ lat: number; lng: number }>;
  center?: { lat?: number; lng?: number };
  city?: string;
  region?: string;
  isVisible?: boolean;
  promoCount?: number;
  settings?: Record<string, unknown>;
  analytics?: Record<string, unknown>;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  confirmCityChange?: boolean;
}

export async function createZone(input: UpsertZoneInput) {
  if (!input.name?.trim()) throw AppError.badRequest('Zone name is required');
  if (!input.cityId || !mongoose.Types.ObjectId.isValid(input.cityId)) throw AppError.badRequest('Valid cityId is required');
  const city = await City.findById(input.cityId);
  if (!city) throw AppError.badRequest('City not found');

  const zone = await Zone.create({
    name: input.name.trim(),
    code: input.code?.trim(),
    cityId: input.cityId,
    type: input.type || 'Serviceable',
    status: input.status || 'Active',
    color: input.color || '#3b82f6',
    areaSqKm: input.areaSqKm != null ? Number(input.areaSqKm) : 0,
    defaultCapacity: input.defaultCapacity != null ? Number(input.defaultCapacity) : undefined,
    points: input.points,
    polygon: input.polygon,
    center: input.center?.lat != null || input.center?.lng != null ? { lat: Number(input.center.lat), lng: Number(input.center.lng) } : undefined,
    city: input.city?.trim(),
    region: input.region?.trim(),
    isVisible: input.isVisible,
    promoCount: input.promoCount != null ? Number(input.promoCount) : undefined,
    settings: input.settings,
    analytics: input.analytics,
    createdBy: input.createdBy?.trim(),
    metadata: input.metadata,
  });
  const populated = await Zone.findById(zone._id).populate('cityId', 'name code state').lean();
  return formatZone(populated as unknown as Record<string, any>);
}

export async function updateZone(id: string, input: UpsertZoneInput) {
  const zone = await Zone.findById(id);
  if (!zone) throw AppError.notFound('Zone', id);

  if (input.name !== undefined) zone.name = input.name.trim();
  if (input.code !== undefined) zone.code = input.code?.trim();
  if (input.cityId && mongoose.Types.ObjectId.isValid(input.cityId)) {
    if (String(zone.cityId) !== String(input.cityId) && input.confirmCityChange !== true) {
      throw AppError.badRequest('Changing zone cityId is destructive. Set confirmCityChange=true to proceed.');
    }
    const city = await City.findById(input.cityId);
    if (!city) throw AppError.badRequest('City not found');
    zone.cityId = input.cityId as unknown as mongoose.Types.ObjectId;
  }
  if (input.type !== undefined) zone.type = input.type;
  if (input.status !== undefined) zone.status = input.status;
  if (input.color !== undefined) zone.color = input.color;
  if (input.areaSqKm !== undefined) zone.areaSqKm = Number(input.areaSqKm);
  if (input.defaultCapacity !== undefined) zone.defaultCapacity = input.defaultCapacity != null ? Number(input.defaultCapacity) : undefined;
  if (input.points !== undefined) zone.points = input.points;
  if (input.polygon !== undefined) zone.polygon = input.polygon;
  if (input.center !== undefined) {
    zone.center = { lat: input.center.lat != null ? Number(input.center.lat) : undefined, lng: input.center.lng != null ? Number(input.center.lng) : undefined };
  }
  if (input.city !== undefined) zone.city = input.city?.trim();
  if (input.region !== undefined) zone.region = input.region?.trim();
  if (input.isVisible !== undefined) zone.isVisible = input.isVisible;
  if (input.promoCount !== undefined) zone.promoCount = input.promoCount != null ? Number(input.promoCount) : 0;
  if (input.settings) zone.settings = { ...(zone.toObject().settings || {}), ...input.settings };
  if (input.analytics) zone.analytics = { ...(zone.toObject().analytics || {}), ...input.analytics };
  if (input.createdBy !== undefined) zone.createdBy = input.createdBy?.trim();
  if (input.metadata !== undefined) zone.metadata = input.metadata;

  await zone.save();
  const populated = await Zone.findById(zone._id).populate('cityId', 'name code state').lean();
  return formatZone(populated as unknown as Record<string, any>);
}

export async function deleteZone(id: string) {
  const zone = await Zone.findById(id);
  if (!zone) throw AppError.notFound('Zone', id);
  const storeCount = await Store.countDocuments({ zoneId: zone._id });
  if (storeCount > 0) {
    throw AppError.badRequest(`Cannot delete zone: ${storeCount} store(s) reference it. Remove or reassign stores first.`);
  }
  zone.status = 'inactive';
  zone.isVisible = false;
  await zone.save();
  return { message: 'Zone deactivated' };
}

// --- Managers dropdown -----------------------------------------------------------------------

export async function listManagers() {
  const users = await AdminDirectoryUser.find({ status: 'active' }).select('name email').sort({ name: 1 }).lean();
  return users.map((u) => ({ id: String(u._id), name: u.name, email: u.email }));
}

// --- Vehicle types ---------------------------------------------------------------------------

export interface VehicleTypeFilter {
  isActive?: boolean;
}

export async function listVehicleTypes(filter: VehicleTypeFilter) {
  const query: Record<string, unknown> = {};
  if (filter.isActive !== undefined) query.isActive = filter.isActive;
  const items = await VehicleType.find(query).sort({ sortOrder: 1, name: 1 }).lean();
  return items.map((v) => ({ ...v, id: String(v._id) }));
}

export async function getVehicleType(id: string) {
  const item = await VehicleType.findById(id).lean();
  if (!item) throw AppError.notFound('Vehicle type', id);
  return { ...item, id: String(item._id) };
}

export interface UpsertVehicleTypeInput {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export async function createVehicleType(input: UpsertVehicleTypeInput) {
  if (!input.code?.trim()) throw AppError.badRequest('Code is required');
  if (!input.name?.trim()) throw AppError.badRequest('Name is required');
  const codeTrim = input.code.trim();
  const existing = await VehicleType.findOne({ code: codeTrim });
  if (existing) throw AppError.conflict('Vehicle type code already exists');
  const item = await VehicleType.create({
    code: codeTrim,
    name: input.name.trim(),
    description: input.description?.trim(),
    isActive: input.isActive !== false,
    sortOrder: input.sortOrder != null ? Number(input.sortOrder) : 0,
  });
  const obj = item.toObject() as Record<string, unknown>;
  return { ...obj, id: String(item._id) };
}

export async function updateVehicleType(id: string, input: UpsertVehicleTypeInput) {
  const item = await VehicleType.findById(id);
  if (!item) throw AppError.notFound('Vehicle type', id);
  if (input.code !== undefined) {
    const codeTrim = input.code.trim();
    if (!codeTrim) throw AppError.badRequest('Code cannot be empty');
    const existing = await VehicleType.findOne({ code: codeTrim, _id: { $ne: id } });
    if (existing) throw AppError.conflict('Vehicle type code already exists');
    item.code = codeTrim;
  }
  if (input.name !== undefined) item.name = input.name.trim();
  if (input.description !== undefined) item.description = input.description?.trim();
  if (input.isActive !== undefined) item.isActive = input.isActive;
  if (input.sortOrder !== undefined) item.sortOrder = Number(input.sortOrder);
  await item.save();
  const obj = item.toObject() as Record<string, unknown>;
  return { ...obj, id: String(item._id) };
}

export async function deleteVehicleType(id: string) {
  const item = await VehicleType.findById(id);
  if (!item) throw AppError.notFound('Vehicle type', id);
  item.isActive = false;
  await item.save();
  return { message: 'Vehicle type deactivated' };
}

// --- SKU units ---------------------------------------------------------------------------------

export interface SkuUnitFilter {
  isActive?: boolean;
}

export async function listSkuUnits(filter: SkuUnitFilter) {
  const query: Record<string, unknown> = {};
  if (filter.isActive !== undefined) query.isActive = filter.isActive;
  const items = await SkuUnit.find(query).sort({ sortOrder: 1, name: 1 }).lean();
  return items.map((s) => ({ ...s, id: String(s._id) }));
}

export async function getSkuUnit(id: string) {
  const item = await SkuUnit.findById(id).lean();
  if (!item) throw AppError.notFound('SKU unit', id);
  return { ...item, id: String(item._id) };
}

export interface UpsertSkuUnitInput {
  code?: string;
  name?: string;
  baseUnit?: string;
  conversionFactor?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export async function createSkuUnit(input: UpsertSkuUnitInput) {
  if (!input.code?.trim()) throw AppError.badRequest('Code is required');
  if (!input.name?.trim()) throw AppError.badRequest('Name is required');
  const codeTrim = input.code.trim();
  const existing = await SkuUnit.findOne({ code: codeTrim });
  if (existing) throw AppError.conflict('SKU unit code already exists');
  const item = await SkuUnit.create({
    code: codeTrim,
    name: input.name.trim(),
    baseUnit: input.baseUnit?.trim(),
    conversionFactor: input.conversionFactor != null ? Number(input.conversionFactor) : undefined,
    isActive: input.isActive !== false,
    sortOrder: input.sortOrder != null ? Number(input.sortOrder) : 0,
  });
  const obj = item.toObject() as Record<string, unknown>;
  return { ...obj, id: String(item._id) };
}

export async function updateSkuUnit(id: string, input: UpsertSkuUnitInput) {
  const item = await SkuUnit.findById(id);
  if (!item) throw AppError.notFound('SKU unit', id);
  if (input.code !== undefined) {
    const codeTrim = input.code.trim();
    if (!codeTrim) throw AppError.badRequest('Code cannot be empty');
    const existing = await SkuUnit.findOne({ code: codeTrim, _id: { $ne: id } });
    if (existing) throw AppError.conflict('SKU unit code already exists');
    item.code = codeTrim;
  }
  if (input.name !== undefined) item.name = input.name.trim();
  if (input.baseUnit !== undefined) item.baseUnit = input.baseUnit?.trim();
  if (input.conversionFactor !== undefined) item.conversionFactor = input.conversionFactor != null ? Number(input.conversionFactor) : undefined;
  if (input.isActive !== undefined) item.isActive = input.isActive;
  if (input.sortOrder !== undefined) item.sortOrder = Number(input.sortOrder);
  await item.save();
  const obj = item.toObject() as Record<string, unknown>;
  return { ...obj, id: String(item._id) };
}

export async function deleteSkuUnit(id: string) {
  const item = await SkuUnit.findById(id);
  if (!item) throw AppError.notFound('SKU unit', id);
  item.isActive = false;
  await item.save();
  return { message: 'SKU unit deactivated' };
}
