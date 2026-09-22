import mongoose from 'mongoose';
import { PickerWorkLocation, PickerUser } from '../picker/picker.models';
import { DEFAULT_HUB_KEY } from '../orders/fulfillment.service';
import { logger } from '../../utils/logger';

/** Chennai Adyar — the live order spine hub key used by customer/HHD fulfillment. */
export const ADYAR_HUB = {
  warehouseKey: DEFAULT_HUB_KEY,
  name: 'Adyar Darkstore',
  address: 'Lattice Bridge Road, Adyar, Chennai',
  type: 'darkstore' as const,
  isActive: true,
  coordinates: { latitude: 13.0067, longitude: 80.2206 },
  geo: { type: 'Point' as const, coordinates: [80.2206, 13.0067] as [number, number] },
  geofenceRadius: 250,
  dispatchBays: 8,
};

/**
 * Resolve any stored hub reference (warehouseKey OR PickerWorkLocation ObjectId)
 * to the canonical warehouseKey used on CustomerOrder.offerHubKey.
 */
export async function resolveWarehouseKey(
  raw?: string | null,
  opts: { fallbackToDefault?: boolean } = {},
): Promise<string | null> {
  const value = String(raw || '').trim();
  if (!value) {
    return opts.fallbackToDefault === false ? null : DEFAULT_HUB_KEY;
  }

  const byKey = (await PickerWorkLocation.findOne({ warehouseKey: value })
    .select('warehouseKey')
    .lean()) as { warehouseKey?: string } | null;
  if (byKey?.warehouseKey) return String(byKey.warehouseKey);

  if (mongoose.isValidObjectId(value)) {
    const byId = (await PickerWorkLocation.findById(value)
      .select('warehouseKey')
      .lean()) as { warehouseKey?: string } | null;
    if (byId?.warehouseKey) return String(byId.warehouseKey);
  }

  // Operational order hub may exist before it is seeded into work locations.
  if (value === DEFAULT_HUB_KEY) return DEFAULT_HUB_KEY;

  if (opts.fallbackToDefault === false) return null;
  logger.info('[hub] unresolved rider/order hub — falling back to default', {
    raw: value,
    fallback: DEFAULT_HUB_KEY,
  });
  return DEFAULT_HUB_KEY;
}

/** Ensure the Adyar operational hub exists even when Bangalore demo hubs were seeded first. */
export async function ensureOperationalHubs(): Promise<void> {
  await PickerWorkLocation.updateOne(
    { warehouseKey: ADYAR_HUB.warehouseKey },
    { $setOnInsert: ADYAR_HUB },
    { upsert: true },
  );
}

/**
 * Normalize a rider's currentLocationId to warehouseKey and persist when it was an ObjectId/orphan.
 * Returns the warehouseKey used for available-order filtering.
 */
export async function normalizeRiderHubKey(pickerId: string, currentLocationId?: string | null): Promise<string> {
  await ensureOperationalHubs();
  const resolved = (await resolveWarehouseKey(currentLocationId, { fallbackToDefault: true })) || DEFAULT_HUB_KEY;
  const raw = String(currentLocationId || '').trim();
  if (raw !== resolved) {
    await PickerUser.updateOne(
      { _id: new mongoose.Types.ObjectId(pickerId) },
      { $set: { currentLocationId: resolved } },
    );
    logger.info('[hub] normalized rider currentLocationId', {
      pickerId,
      previous: raw || null,
      next: resolved,
    });
  }
  return resolved;
}
