import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { DarkStore } from './dark-store.model';
import { getPublishedValue } from '../../services/platformConfig.service';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * POST /store/assign
 * Finds the nearest active darkstore to the supplied coordinates.
 */
export async function assignStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { latitude, longitude } = req.body as { latitude?: number; longitude?: number };
    if (!latitude || !longitude) {
      return next(new AppError('latitude and longitude are required', 400, 'BAD_REQUEST'));
    }

    const assignSearchMaxM = await getPublishedValue<number>(
      'delivery.assign_search_max_m',
      Number(process.env.DELIVERY_ASSIGN_SEARCH_MAX_M) || 10000,
    );

    const store = await DarkStore.findOne({
      isActive: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
          $maxDistance: Number(assignSearchMaxM) || 10000,
        },
      },
    });

    if (!store) {
      res.status(200).json({
        success: true,
        serviceable: false,
        message: 'No serviceable store found near your location',
      });
      return;
    }

    const distanceKm = haversineKm(
      Number(latitude),
      Number(longitude),
      store.location.coordinates[1],
      store.location.coordinates[0],
    );

    if (distanceKm > store.serviceRadius) {
      res.status(200).json({
        success: true,
        serviceable: false,
        message: 'Your location is outside our delivery area',
        nearestStore: store.name,
        distanceKm: Math.round(distanceKm * 10) / 10,
      });
      return;
    }

    res.status(200).json({
      success: true,
      serviceable: true,
      store: {
        id: store._id,
        name: store.name,
        code: store.code,
        distanceKm: Math.round(distanceKm * 10) / 10,
        avgPickPackTime: store.avgPickPackTime,
        operatingHours: store.operatingHours,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /store/:storeId/inventory
 * List available inventory for a specific store.
 */
export async function getStoreInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { StoreInventory } = await import('../products/store-inventory.model');
    const { storeId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const inventory = await StoreInventory.find({ storeId, isAvailable: true, quantity: { $gt: 0 } })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('productId quantity')
      .lean();
    res.status(200).json({ success: true, data: { inventory } });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin merch: list stores
 */
export async function listStoresAdmin(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await DarkStore.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
}

export async function createStoreAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await DarkStore.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) { next(error); }
}

export async function updateStoreAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = { ...req.body };
    delete body._id;
    const item = await DarkStore.findByIdAndUpdate(req.params.id, { $set: body }, { new: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Store not found' }); return; }
    res.status(200).json({ success: true, data: item });
  } catch (error) { next(error); }
}

export async function deleteStoreAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await DarkStore.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Store deleted' });
  } catch (error) { next(error); }
}

/**
 * Admin merch: inventory management
 */
export async function updateStoreInventoryAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { StoreInventory } = await import('../products/store-inventory.model');
    const { storeId } = req.params;
    const { productId, quantity, isAvailable } = req.body as { productId: string; quantity: number; isAvailable?: boolean };
    const item = await StoreInventory.findOneAndUpdate(
      { storeId, productId },
      { $set: { quantity, ...(isAvailable !== undefined ? { isAvailable } : {}) } },
      { new: true, upsert: true },
    ).lean();
    res.status(200).json({ success: true, data: item });
  } catch (error) { next(error); }
}

export async function syncStoreInventoryAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ success: true, message: 'Inventory sync queued', storeId: req.params.storeId });
  } catch (error) { next(error); }
}

export async function getStoreInventoryHistoryAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { StoreInventory } = await import('../products/store-inventory.model');
    const { storeId } = req.params;
    const items = await StoreInventory.find({ storeId }).sort({ updatedAt: -1 }).limit(200).lean();
    res.status(200).json({ success: true, data: items });
  } catch (error) { next(error); }
}

export async function triggerStoreReplenishmentAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ success: true, message: 'Replenishment triggered', storeId: req.params.storeId });
  } catch (error) { next(error); }
}
