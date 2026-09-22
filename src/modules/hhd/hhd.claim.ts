import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { HHDOrder, HHDUser, IHHDOrder } from './hhd.models';
import { ORDER_STATUS, OrderStatus } from './hhd.constants';
import { DEFAULT_HUB_KEY } from '../orders/fulfillment.service';
import * as fulfillment from '../orders/fulfillment.service';
import { Order } from '../orders/order.model';

export function effectiveHubKey(raw?: string | null): string {
  const v = String(raw || '').trim();
  return v || DEFAULT_HUB_KEY;
}

export function hubsMatch(a?: string | null, b?: string | null): boolean {
  return effectiveHubKey(a).toLowerCase() === effectiveHubKey(b).toLowerCase();
}

export async function resolveOperatorHub(userId: string): Promise<string> {
  const user = await HHDUser.findById(userId).select('warehouse darkstore').lean();
  return effectiveHubKey((user?.warehouse || user?.darkstore || null) as string | null);
}

function unassignedPendingFilter(hubKey: string): Record<string, unknown> {
  const hubClause: Record<string, unknown>[] = [{ hubKey }];
  if (hubKey === DEFAULT_HUB_KEY) {
    hubClause.push({ hubKey: null }, { hubKey: { $exists: false } }, { hubKey: '' });
  }
  return {
    status: ORDER_STATUS.PENDING,
    $and: [
      { $or: [{ userId: null }, { userId: { $exists: false } }] },
      { $or: hubClause },
    ],
  };
}

function hubEligible(orderHub: string | null | undefined, operatorHub: string): boolean {
  if (!orderHub) {
    return operatorHub === DEFAULT_HUB_KEY || hubsMatch(orderHub, operatorHub);
  }
  return hubsMatch(orderHub, operatorHub);
}

export async function listAvailableHhdOrders(userId: string, limit = 50): Promise<IHHDOrder[]> {
  const operatorHub = await resolveOperatorHub(userId);
  const rows = await HHDOrder.find(unassignedPendingFilter(operatorHub))
    .sort({ createdAt: 1 })
    .limit(Math.min(100, Math.max(1, limit)));

  const numbers = rows.map((r) => r.orderId);
  if (!numbers.length) return [];

  const blocked = await Order.find({
    orderNumber: { $in: numbers },
    status: { $in: ['cancelled'] },
  })
    .select('orderNumber')
    .lean();
  const blockedSet = new Set(blocked.map((o) => String(o.orderNumber)));

  return rows.filter((row) => {
    if (blockedSet.has(row.orderId)) return false;
    return hubEligible(row.hubKey, operatorHub);
  });
}

export async function claimHhdOrder(userId: string, orderId: string): Promise<IHHDOrder> {
  if (!orderId) {
    throw new AppError('Order id is required', 400, 'VALIDATION_ERROR');
  }

  const operatorHub = await resolveOperatorHub(userId);
  const existing = await HHDOrder.findOne({ orderId });
  if (!existing) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  await fulfillment.assertCustomerOrderPickable(orderId);

  const owner = existing.userId ? String(existing.userId) : null;
  if (owner === userId) {
    if (existing.status === ORDER_STATUS.PENDING) {
      existing.status = ORDER_STATUS.RECEIVED as OrderStatus;
      if (!existing.assignedAt) existing.assignedAt = new Date();
      await existing.save();
    }
    await fulfillment.markCustomerPicking(orderId);
    return existing;
  }
  if (owner) {
    throw new AppError('Another operator has already accepted this order.', 409, 'ORDER_ALREADY_ASSIGNED');
  }

  if (!hubEligible(existing.hubKey, operatorHub)) {
    throw new AppError('This order does not belong to this hub', 403, 'WRONG_HUB');
  }

  const now = new Date();
  const claimed = await HHDOrder.findOneAndUpdate(
    {
      orderId,
      status: ORDER_STATUS.PENDING,
      $or: [{ userId: null }, { userId: { $exists: false } }],
    },
    {
      $set: {
        userId: new mongoose.Types.ObjectId(userId),
        assignedAt: now,
        status: ORDER_STATUS.RECEIVED,
        hubKey: existing.hubKey || operatorHub,
        slaDueAt:
          existing.slaDueAt ||
          (existing.targetTime
            ? new Date(now.getTime() + existing.targetTime * 60 * 1000)
            : undefined),
      },
    },
    { new: true },
  );

  if (!claimed) {
    throw new AppError('Another operator has already accepted this order.', 409, 'ORDER_ALREADY_ASSIGNED');
  }

  await fulfillment.markCustomerPicking(orderId);
  return claimed;
}
