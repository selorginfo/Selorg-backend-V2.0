import mongoose from 'mongoose';
import { Order } from '../orders/order.model';
import { PickerUser } from '../picker/picker.models';
import { Cluster } from '../rider/rider.models';
import { pickerConfig } from '../picker/picker.config';
import { logger } from '../../utils/logger';

const BULK_VEHICLES = ['auto', 'ev_auto', 'van'];

function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * When enough ready orders in the same hub share a real drop area, claim them
 * for one online E-Auto / van. Orders without coordinates stay on the single-rider path.
 * Bike riders are never given this batch.
 */
export async function tryFormBulkBatch(hubKey: string): Promise<void> {
  if (!pickerConfig.bulkDeliveryEnabled) return;
  const hub = String(hubKey || '').trim();
  if (!hub) return;

  const radiusKm = Math.min(50, Math.max(0.2, Number(process.env.BULK_GROUP_RADIUS_KM) || 2));
  const minSize = Math.max(2, Number(process.env.BULK_MIN_ORDERS) || 2);
  const maxSize = Math.min(10, Math.max(minSize, Number(process.env.BULK_MAX_ORDERS) || 10));

  const candidates = await Order.find({
    offerHubKey: hub,
    riderStage: 'offered',
    status: 'getting-packed',
    deliveryType: { $ne: 'bulk' },
    $or: [{ pickerId: null }, { pickerId: { $exists: false } }],
    'deliveryAddress.latitude': { $type: 'number' },
    'deliveryAddress.longitude': { $type: 'number' },
  })
    .sort({ createdAt: 1 })
    .limit(40)
    .select('_id orderNumber deliveryAddress storeId');

  type Row = {
    _id: mongoose.Types.ObjectId;
    orderNumber?: string;
    storeId?: mongoose.Types.ObjectId;
    deliveryAddress?: { latitude?: number; longitude?: number };
  };
  const rows = candidates as unknown as Row[];
  if (rows.length < minSize) return;

  const seed = rows[0];
  const seedLat = Number(seed.deliveryAddress?.latitude);
  const seedLng = Number(seed.deliveryAddress?.longitude);
  const seedStore = seed.storeId ? String(seed.storeId) : '';
  const group = rows.filter((row) => {
    if (seedStore && row.storeId && String(row.storeId) !== seedStore) return false;
    const lat = Number(row.deliveryAddress?.latitude);
    const lng = Number(row.deliveryAddress?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return kmBetween(seedLat, seedLng, lat, lng) <= radiusKm;
  }).slice(0, maxSize);

  if (group.length < minSize) return;

  const rider = await PickerUser.findOne({
    workforceRole: 'rider',
    status: 'ACTIVE',
    isOnline: true,
    vehicleType: { $in: BULK_VEHICLES },
    $and: [
      { $or: [{ activeBatchId: null }, { activeBatchId: { $exists: false } }, { activeBatchId: '' }] },
      { $or: [{ activeOrderId: null }, { activeOrderId: { $exists: false } }, { activeOrderId: '' }] },
    ],
  }).select('_id name');

  if (!rider) {
    logger.info('[bulk-detect] eligible area orders are waiting for an E-Auto', { hub, count: group.length });
    return;
  }

  const busy = await Order.exists({
    pickerId: rider._id,
    riderStage: { $in: ['accepted', 'picked_up'] },
    status: { $nin: ['delivered', 'cancelled'] },
  });
  if (busy) return;

  const now = new Date();
  const clusterId = `CL-${Date.now()}`;
  const avgLat = group.reduce((sum, row) => sum + Number(row.deliveryAddress?.latitude), 0) / group.length;
  const avgLng = group.reduce((sum, row) => sum + Number(row.deliveryAddress?.longitude), 0) / group.length;
  const orderIds = group.map((row) => String(row._id));

  await Cluster.create({
    clusterId,
    orderIds,
    center: { lat: avgLat, lng: avgLng },
    status: 'assigned',
    riderId: String(rider._id),
    zone: hub,
    metadata: { radiusKm, source: 'customer_orders' },
  });

  await Order.updateMany(
    { _id: { $in: group.map((row) => row._id) }, riderStage: 'offered' },
    {
      $set: {
        deliveryType: 'bulk',
        pickerId: rider._id,
        riderId: String(rider._id),
        riderStage: 'accepted',
        assignedAt: now,
        acceptedAt: now,
      },
      $push: {
        timeline: {
          status: 'accepted',
          timestamp: now,
          actor: 'system',
          note: `Bulk batch ${clusterId} assigned to ${rider.name || 'E-Auto'}`,
        },
      },
    },
  );

  logger.info('[bulk-detect] bulk batch assigned', { clusterId, hub, orders: orderIds.length, riderId: String(rider._id) });
}
