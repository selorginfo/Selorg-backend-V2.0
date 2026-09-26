import mongoose from 'mongoose';
import { Order } from '../orders/order.model';
import { PickerUser } from './picker.models';
import { AppError } from '../../utils/AppError';

/**
 * A standard rider finishes the current delivery before another order is assigned.
 * A bulk batch is the only multi-stop exception, and it blocks new standard orders
 * through `activeBatchId` plus the in-progress order query below.
 */
export async function assertRiderFreeForNewOrder(riderId: string, exceptOrderId?: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(riderId)) {
    throw new AppError('Rider not found', 404, 'RIDER_NOT_FOUND');
  }

  const rider = await PickerUser.findById(riderId).select('status workforceRole activeBatchId').lean();
  if (!rider) throw new AppError('Rider not found', 404, 'RIDER_NOT_FOUND');

  const status = String((rider as { status?: string }).status || '').toUpperCase();
  if (status !== 'ACTIVE') {
    throw new AppError('Rider is not approved for deliveries.', 403, 'RIDER_NOT_ACTIVE');
  }
  if ((rider as { workforceRole?: string }).workforceRole === 'picker') {
    throw new AppError('This account cannot take deliveries.', 403, 'ROLE_MISMATCH');
  }
  if ((rider as { activeBatchId?: string }).activeBatchId) {
    throw new AppError('Finish the current bulk batch before taking another order.', 409, 'RIDER_BUSY');
  }

  const filter: Record<string, unknown> = {
    pickerId: new mongoose.Types.ObjectId(riderId),
    riderStage: { $in: ['accepted', 'picked_up'] },
    status: { $nin: ['delivered', 'cancelled'] },
  };
  if (exceptOrderId && mongoose.Types.ObjectId.isValid(exceptOrderId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(exceptOrderId) };
  }

  const busy = await Order.findOne(filter).select('orderNumber').lean();
  if (busy) {
    const orderNumber = String((busy as { orderNumber?: string }).orderNumber || 'the current order');
    throw new AppError(
      `Finish delivery ${orderNumber} before taking another order.`,
      409,
      'RIDER_HAS_ACTIVE_DELIVERY',
    );
  }
}

/** Gateway orders must already be paid. Cash orders stay collectable as COD. */
export function deliveryPaymentAllowed(order: {
  paymentStatus?: string | null;
  paymentMethod?: { methodType?: string | null } | null;
}): boolean {
  const paymentStatus = String(order.paymentStatus || '');
  if (paymentStatus === 'paid' || paymentStatus === 'cod_pending') return true;
  const method = String(order.paymentMethod?.methodType || '');
  return method === 'cash' && paymentStatus === 'cod_pending';
}
