import { z } from 'zod';

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

export const locationSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  address: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
});

export const itemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  weight: z.number().nonnegative().optional(),
});

// ─── Order schemas ────────────────────────────────────────────────────────────

export const createOrderBodySchema = z.object({
  referenceId: z.string().min(1),
  type: z.enum(['VENDOR_TO_WAREHOUSE', 'WAREHOUSE_TO_DARKSTORE']),
  provider: z.enum(['PORTER', 'SHADOWFAX', 'LOADSHARE']).default('PORTER'),
  pickup: locationSchema,
  drop: locationSchema,
  items: z.array(itemSchema).min(1),
  vehicleType: z.string().optional(),
  scheduledTime: z.coerce.date().optional(),
});

export const listOrdersQuerySchema = z.object({
  status: z.string().optional(),
  provider: z.string().optional(),
  type: z.enum(['VENDOR_TO_WAREHOUSE', 'WAREHOUSE_TO_DARKSTORE']).optional(),
  referenceId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Estimate schemas ─────────────────────────────────────────────────────────

export const estimateBodySchema = z.object({
  pickup: locationSchema,
  drop: locationSchema,
  items: z.array(itemSchema).min(1),
  vehicleType: z.string().optional(),
  providers: z.array(z.enum(['PORTER', 'SHADOWFAX', 'LOADSHARE'])).optional(),
});

// ─── Admin schemas ────────────────────────────────────────────────────────────

export const patchProviderParamsSchema = z.object({
  id: z.string().min(1),
});

export const patchProviderBodySchema = z
  .object({
    isActive: z.boolean().optional(),
    priority: z.number().int().min(0).max(9999).optional(),
  })
  .refine((d) => d.isActive !== undefined || d.priority !== undefined, {
    message: 'Provide isActive and/or priority',
  });

export const reorderProviderBodySchema = z.object({
  direction: z.enum(['up', 'down']),
});

export const analyticsCostQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type EstimateBody = z.infer<typeof estimateBodySchema>;
export type PatchProviderParams = z.infer<typeof patchProviderParamsSchema>;
export type PatchProviderBody = z.infer<typeof patchProviderBodySchema>;
export type ReorderProviderBody = z.infer<typeof reorderProviderBodySchema>;
export type AnalyticsCostQuery = z.infer<typeof analyticsCostQuerySchema>;

// ─── Validation helper ────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';

/**
 * Returns an Express middleware that validates `req.body` against a Zod schema.
 * On success, replaces `req.body` with the parsed (coerced) value.
 * On failure, calls `next(AppError.validation(...))`.
 */
export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(AppError.validation('Validation failed', result.error.flatten()));
    }
    req.body = result.data;
    next();
  };
}

/**
 * Returns an Express middleware that validates `req.query` against a Zod schema.
 * On success, replaces `req.query` with the parsed (coerced) value.
 */
export function validateQuery<T>(schema: z.ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(AppError.validation('Validation failed', result.error.flatten()));
    }
    req.query = result.data as unknown as typeof req.query;
    next();
  };
}

/**
 * Returns an Express middleware that validates `req.params` against a Zod schema.
 */
export function validateParams<T>(schema: z.ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return next(AppError.validation('Validation failed', result.error.flatten()));
    }
    req.params = result.data as unknown as typeof req.params;
    next();
  };
}
