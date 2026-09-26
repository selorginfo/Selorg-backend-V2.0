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

  const { ensureHhdOperatorHub } = await import('./hhdOperator.bridge');
  const operatorHub = await ensureHhdOperatorHub(userId);
  const existing = await HHDOrder.findOne({ orderId });
  if (!existing) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  await fulfillment.assertCustomerOrderPickable(orderId);

  const hhdUser = await HHDUser.findById(userId).select('name isActive deviceId').lean();
  if (!hhdUser || (hhdUser as { isActive?: boolean }).isActive === false) {
    throw new AppError('HSD operator is not active', 403, 'OPERATOR_INACTIVE');
  }
  const hhdUserName = String(hhdUser?.name || '').trim() || 'HSD Operator';
  let hsdDeviceId = String((hhdUser as { deviceId?: string }).deviceId || '').trim() || null;

  // A verified device is required. A linked picker must also have an open punch.
  const { PickerDevice } = await import('../picker/picker.models');
  const held = (await PickerDevice.findOne({
    assignedTo: new mongoose.Types.ObjectId(userId),
    status: 'assigned',
  })
    .select('deviceId')
    .lean()) as { deviceId?: string } | null;
  if (held?.deviceId) hsdDeviceId = String(held.deviceId);
  if (!hsdDeviceId) {
    throw new AppError(
      'Collect and verify an HSD device before accepting orders.',
      403,
      'HSD_DEVICE_REQUIRED',
    );
  }

  const { PickerUser, PickerAttendance } = await import('../picker/picker.models');
  const linkedPicker = (await PickerUser.findOne({ hhdUserId: new mongoose.Types.ObjectId(userId) })
    .select('_id status activeShiftId')
    .lean()) as { _id: mongoose.Types.ObjectId; status?: string; activeShiftId?: mongoose.Types.ObjectId | null } | null;
  let pickerShiftId: string | null = null;
  let hsdSessionId: string | null = null;
  if (linkedPicker) {
    if (String(linkedPicker.status || '') !== 'ACTIVE') {
      throw new AppError('Picker account is not active', 403, 'OPERATOR_INACTIVE');
    }
    const punch = (await PickerAttendance.findOne({
      userId: linkedPicker._id,
      punchOut: null,
      status: { $in: ['ON_DUTY', 'ON_BREAK'] },
    })
      .select('_id shiftId')
      .lean()) as { _id: mongoose.Types.ObjectId; shiftId?: string } | null;
    if (!punch) {
      throw new AppError('Punch in before accepting orders.', 403, 'PUNCH_REQUIRED');
    }
    pickerShiftId = punch.shiftId
      ? String(punch.shiftId)
      : linkedPicker.activeShiftId
        ? String(linkedPicker.activeShiftId)
        : null;
    hsdSessionId = String(punch._id);
  }

  const owner = existing.userId ? String(existing.userId) : null;
  if (owner === userId) {
    if (existing.status === ORDER_STATUS.PENDING) {
      existing.status = ORDER_STATUS.RECEIVED as OrderStatus;
      if (!existing.assignedAt) existing.assignedAt = new Date();
      await existing.save();
    }
    await fulfillment.markCustomerPicking(orderId, {
      hhdUserId: userId,
      hhdUserName,
      hsdDeviceId,
      hsdSessionId,
      pickerShiftId,
    });
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

  await fulfillment.markCustomerPicking(orderId, {
    hhdUserId: userId,
    hhdUserName,
    hsdDeviceId,
    hsdSessionId,
    pickerShiftId,
  });
  return claimed;
}
