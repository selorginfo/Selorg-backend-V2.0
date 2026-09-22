import { z } from 'zod';

export const createCitySchema = z.object({
  code: z.string().trim().min(1, 'City code is required'),
  name: z.string().trim().min(1, 'City name is required'),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  latitude: z.union([z.number(), z.string()]).optional(),
  longitude: z.union([z.number(), z.string()]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateCityInput = z.infer<typeof createCitySchema>;

export const updateCitySchema = z.object({
  code: z.string().trim().optional(),
  name: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  latitude: z.union([z.number(), z.string()]).optional(),
  longitude: z.union([z.number(), z.string()]).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type UpdateCityInput = z.infer<typeof updateCitySchema>;

const pointSchema = z.object({ x: z.number(), y: z.number() });
const polygonPointSchema = z.object({ lat: z.number(), lng: z.number() });
const centerSchema = z.object({ lat: z.number().optional(), lng: z.number().optional() });

export const createZoneSchema = z.object({
  name: z.string().trim().min(1, 'Zone name is required'),
  code: z.string().trim().optional(),
  cityId: z.string().trim().min(1, 'Valid cityId is required'),
  type: z.string().optional(),
  status: z.string().optional(),
  color: z.string().optional(),
  areaSqKm: z.union([z.number(), z.string()]).optional(),
  defaultCapacity: z.union([z.number(), z.string()]).optional(),
  points: z.array(pointSchema).optional(),
  polygon: z.array(polygonPointSchema).optional(),
  center: centerSchema.optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  isVisible: z.boolean().optional(),
  promoCount: z.union([z.number(), z.string()]).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  analytics: z.record(z.string(), z.unknown()).optional(),
  createdBy: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateZoneInput = z.infer<typeof createZoneSchema>;

export const updateZoneSchema = createZoneSchema.partial().extend({
  confirmCityChange: z.boolean().optional(),
});
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;

export const createVehicleTypeSchema = z.object({
  code: z.string().trim().min(1, 'Code is required'),
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.union([z.number(), z.string()]).optional(),
});
export type CreateVehicleTypeInput = z.infer<typeof createVehicleTypeSchema>;

export const updateVehicleTypeSchema = createVehicleTypeSchema.partial();
export type UpdateVehicleTypeInput = z.infer<typeof updateVehicleTypeSchema>;

export const createSkuUnitSchema = z.object({
  code: z.string().trim().min(1, 'Code is required'),
  name: z.string().trim().min(1, 'Name is required'),
  baseUnit: z.string().trim().optional(),
  conversionFactor: z.union([z.number(), z.string()]).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.union([z.number(), z.string()]).optional(),
});
export type CreateSkuUnitInput = z.infer<typeof createSkuUnitSchema>;

export const updateSkuUnitSchema = createSkuUnitSchema.partial();
export type UpdateSkuUnitInput = z.infer<typeof updateSkuUnitSchema>;
