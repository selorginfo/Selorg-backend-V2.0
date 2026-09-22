import mongoose from 'mongoose';
import { getDeliveryRuntimeConfig } from '../../services/deliveryRuntime.service';
import { Store } from './store.model';

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find the nearest active darkstore to the given coordinates.
 * 1. Prefers the closest store whose deliveryRadius covers the customer.
 * 2. Falls back to the absolute nearest store if none covers the customer.
 */
export async function findNearestDarkstore(latitude?: number | null, longitude?: number | null): Promise<string | null> {
  if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }

  const { defaultRadiusKm } = await getDeliveryRuntimeConfig();

  const darkstores = await Store.find(
    { type: 'dark_store', status: 'active' },
    { code: 1, latitude: 1, longitude: 1, deliveryRadius: 1 },
  ).lean();

  let bestInRadius: string | null = null;
  let bestInRadiusDist = Infinity;
  let absoluteNearest: string | null = null;
  let absoluteNearestDist = Infinity;

  for (const ds of darkstores) {
    if (ds.latitude == null || ds.longitude == null) continue;
    const dist = haversineKm(latitude, longitude, ds.latitude, ds.longitude);

    if (dist < absoluteNearestDist) {
      absoluteNearestDist = dist;
      absoluteNearest = ds.code ?? null;
    }

    const radius = ds.deliveryRadius != null ? ds.deliveryRadius : defaultRadiusKm;
    if (dist <= radius && dist < bestInRadiusDist) {
      bestInRadiusDist = dist;
      bestInRadius = ds.code ?? null;
    }
  }

  return bestInRadius || absoluteNearest;
}

/** Resolve a Store document _id from its code. Used to populate storeId on customer orders. */
export async function resolveStoreId(code?: string | null): Promise<mongoose.Types.ObjectId | null> {
  if (!code) return null;
  const store = await Store.findOne({ code }, { _id: 1 }).lean();
  return store ? (store._id as mongoose.Types.ObjectId) : null;
}

/** Alias used by admin order create — same as resolveStoreId. */
export const resolveDarkStoreIdByCode = resolveStoreId;
