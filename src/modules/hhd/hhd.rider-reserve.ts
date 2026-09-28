/**
 * Reserve an eligible online Rider when an HSD picker accepts an order.
 * Soft reservation only — full rider accept still happens after rack handover.
 */
import { HHDOrder } from './hhd.models';
import { Order } from '../orders/order.model';
import { PickerUser } from '../picker/picker.models';
import { assertRiderFreeForNewOrder } from '../picker/rider-lock';
import { logger } from '../../utils/logger';

export type ReservedRider = {
  riderId: string;
  riderName: string;
};

function hubMatchFilter(hubKey: string): Record<string, unknown>[] {
  const hub = String(hubKey || '').trim();
  if (!hub) return [{}];
  return [
    { currentLocationId: hub },
    { currentLocationId: { $exists: false } },
    { currentLocationId: null },
    { currentLocationId: '' },
  ];
}

/**
 * Find the first free online bike/scooter rider for this hub and stamp
 * targetRider* on the HHD ticket (and adminFulfillment on the customer order).
 */
export async function reserveAvailableRiderForHhdOrder(
  hhdOrderId: string,
  hubKey: string,
): Promise<ReservedRider | null> {
  const riders = await PickerUser.find({
    workforceRole: 'rider',
    status: 'ACTIVE',
    isOnline: true,
    vehicleType: { $nin: ['auto', 'ev_auto', 'van'] },
    $or: hubMatchFilter(hubKey),
  })
    .select('_id name currentLocationId')
    .sort({ lastSeenAt: -1, onlineSince: -1 })
    .limit(40)
    .lean();

  for (const rider of riders) {
    const riderId = String((rider as { _id: unknown })._id);
    try {
      await assertRiderFreeForNewOrder(riderId);
    } catch {
      continue;
    }

    const riderName = String((rider as { name?: string }).name || '').trim() || 'Rider';
    const updated = await HHDOrder.findOneAndUpdate(
      {
        orderId: hhdOrderId,
        $or: [
          { targetRiderId: null },
          { targetRiderId: { $exists: false } },
          { targetRiderId: '' },
        ],
      },
      {
        $set: {
          targetRiderId: riderId,
          targetRiderName: riderName,
          riderId,
          riderName,
        },
      },
      { new: true },
    );

    if (!updated) {
      // Another accept/reserve already stamped a rider — return existing.
      const existing = await HHDOrder.findOne({ orderId: hhdOrderId })
        .select('targetRiderId targetRiderName riderId riderName')
        .lean();
      if (existing?.targetRiderId || existing?.riderId) {
        return {
          riderId: String(existing.targetRiderId || existing.riderId),
          riderName: String(existing.targetRiderName || existing.riderName || 'Rider'),
        };
      }
      continue;
    }

    await Order.updateOne(
      { orderNumber: hhdOrderId },
      { $set: { 'adminFulfillment.riderName': riderName } },
    ).catch(() => undefined);

    logger.info('[hhd] reserved rider on picker accept', {
      orderId: hhdOrderId,
      riderId,
      riderName,
      hubKey,
    });

    return { riderId, riderName };
  }

  logger.info('[hhd] no available rider to reserve on accept', { orderId: hhdOrderId, hubKey });
  return null;
}
