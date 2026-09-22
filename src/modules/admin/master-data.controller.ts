import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as masterDataService from './master-data.service';

function boolQuery(v: unknown): boolean | undefined {
  if (v === undefined || v === '') return undefined;
  return v === true || v === 'true';
}

// --- Cities ---
export async function listCities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { isActive, search, page, limit } = req.query as Record<string, string | undefined>;
    const result = await masterDataService.listCities({ isActive: boolQuery(isActive), search, page, limit });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getCity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await masterDataService.getCity(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function createCity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(ResponseFormatter.success(await masterDataService.createCity(req.body as masterDataService.CreateCityInput)));
  } catch (err) {
    next(err);
  }
}

export async function updateCity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await masterDataService.updateCity(req.params.id, req.body as masterDataService.UpdateCityInput)));
  } catch (err) {
    next(err);
  }
}

export async function deleteCity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await masterDataService.deleteCity(req.params.id);
    res.json({ success: true, message: result.message, warning: result.warning });
  } catch (err) {
    next(err);
  }
}

// --- Zones ---
export async function listZones(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { cityId, status, search, page, limit } = req.query as Record<string, string | undefined>;
    const result = await masterDataService.listZones({ cityId, status, search, page, limit });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getZone(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await masterDataService.getZone(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function createZone(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(ResponseFormatter.success(await masterDataService.createZone(req.body as masterDataService.UpsertZoneInput)));
  } catch (err) {
    next(err);
  }
}

export async function updateZone(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await masterDataService.updateZone(req.params.id, req.body as masterDataService.UpsertZoneInput)));
  } catch (err) {
    next(err);
  }
}

export async function deleteZone(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await masterDataService.deleteZone(req.params.id);
    res.json(ResponseFormatter.success(null, result.message));
  } catch (err) {
    next(err);
  }
}

// --- Managers ---
export async function listManagers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await masterDataService.listManagers()));
  } catch (err) {
    next(err);
  }
}

// --- Vehicle types ---
export async function listVehicleTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { isActive } = req.query as Record<string, string | undefined>;
    res.json(ResponseFormatter.success(await masterDataService.listVehicleTypes({ isActive: boolQuery(isActive) })));
  } catch (err) {
    next(err);
  }
}

export async function getVehicleType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await masterDataService.getVehicleType(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function createVehicleType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(ResponseFormatter.success(await masterDataService.createVehicleType(req.body as masterDataService.UpsertVehicleTypeInput)));
  } catch (err) {
    next(err);
  }
}

export async function updateVehicleType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await masterDataService.updateVehicleType(req.params.id, req.body as masterDataService.UpsertVehicleTypeInput)));
  } catch (err) {
    next(err);
  }
}

export async function deleteVehicleType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await masterDataService.deleteVehicleType(req.params.id);
    res.json(ResponseFormatter.success(null, result.message));
  } catch (err) {
    next(err);
  }
}

// --- SKU units ---
export async function listSkuUnits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { isActive } = req.query as Record<string, string | undefined>;
    res.json(ResponseFormatter.success(await masterDataService.listSkuUnits({ isActive: boolQuery(isActive) })));
  } catch (err) {
    next(err);
  }
}

export async function getSkuUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await masterDataService.getSkuUnit(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function createSkuUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(ResponseFormatter.success(await masterDataService.createSkuUnit(req.body as masterDataService.UpsertSkuUnitInput)));
  } catch (err) {
    next(err);
  }
}

export async function updateSkuUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await masterDataService.updateSkuUnit(req.params.id, req.body as masterDataService.UpsertSkuUnitInput)));
  } catch (err) {
    next(err);
  }
}

export async function deleteSkuUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await masterDataService.deleteSkuUnit(req.params.id);
    res.json(ResponseFormatter.success(null, result.message));
  } catch (err) {
    next(err);
  }
}
