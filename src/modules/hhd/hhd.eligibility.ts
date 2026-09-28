/**
 * HSD claim eligibility — backend source of truth.
 *
 * An HSD operator may accept an order only when the linked Picker workforce
 * account (if any) has started a shift and is currently online. Operators with
 * no linked Picker account remain allowed for legacy HSD-only hubs.
 */
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { HHDOrder, HHDUser } from './hhd.models';
import { ORDER_STATUS, OrderStatus } from './hhd.constants';
import { PickerUser } from '../picker/picker.models';
import { getActiveAssignment } from '../picker/picker.shift.service';

const BUSY_STATUSES: OrderStatus[] = [
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.BAG_SCANNED,
  ORDER_STATUS.PICKING,
  ORDER_STATUS.PHOTO_VERIFIED,
];

export type HhdEligibilityResult = {
  pickerUserId: string | null;
  shiftId: string | null;
  isOnline: boolean;
};

async function findLinkedPicker(hhdUserId: string, mobile?: string | null) {
  const byLink = await PickerUser.findOne({
    hhdUserId: new mongoose.Types.ObjectId(hhdUserId),
    workforceRole: 'picker',
  })
    .select('_id status isOnline activeShiftId phone name')
    .lean();
  if (byLink) return byLink;

  const phone = String(mobile || '').replace(/\D/g, '').slice(-10);
  if (phone.length === 10) {
    return PickerUser.findOne({
      phone,
      workforceRole: 'picker',
    })
      .select('_id status isOnline activeShiftId phone name')
      .lean();
  }
  return null;
}

/**
 * Throws when this HSD operator must not receive a new order assignment.
 * Pass `exceptOrderId` when re-claiming the same ticket (idempotent accept).
 */
export async function assertHhdOperatorEligibleToClaim(
  hhdUserId: string,
  exceptOrderId?: string | null,
): Promise<HhdEligibilityResult> {
  if (!mongoose.Types.ObjectId.isValid(hhdUserId)) {
    throw new AppError('Invalid HSD operator', 400, 'VALIDATION_ERROR');
  }

  const hhd = (await HHDUser.findById(hhdUserId)
    .select('isActive mobile email name')
    .lean()) as {
    isActive?: boolean;
    mobile?: string | null;
    email?: string | null;
    name?: string | null;
  } | null;

  if (!hhd) {
    throw new AppError('HSD operator not found', 404, 'OPERATOR_NOT_FOUND');
  }
  if (hhd.isActive === false) {
    throw new AppError('HSD operator is not active', 403, 'OPERATOR_INACTIVE');
  }

  const busyFilter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(hhdUserId),
    status: { $in: BUSY_STATUSES },
  };
  if (exceptOrderId) {
    busyFilter.orderId = { $ne: exceptOrderId };
  }
  const busy = await HHDOrder.findOne(busyFilter).select('orderId').lean();
  if (busy) {
    throw new AppError(
      `Finish order ${(busy as { orderId?: string }).orderId || 'in progress'} before accepting another.`,
      409,
      'PICKER_BUSY',
    );
  }

  const picker = await findLinkedPicker(hhdUserId, hhd.mobile);
  if (!picker) {
    // Legacy HSD-only operator (no Picker App account). Still require active account.
    return { pickerUserId: null, shiftId: null, isOnline: true };
  }

  const status = String((picker as { status?: string }).status || '').toUpperCase();
  if (status !== 'ACTIVE') {
    throw new AppError(
      'Complete Picker onboarding before accepting HSD orders.',
      403,
      'PICKER_NOT_ACTIVE',
    );
  }

  if (!(picker as { isOnline?: boolean }).isOnline) {
    throw new AppError(
      'Go online and start your shift in the Picker app before accepting orders.',
      403,
      'PICKER_OFFLINE',
    );
  }

  const activeShiftId = (picker as { activeShiftId?: unknown }).activeShiftId
    ? String((picker as { activeShiftId?: unknown }).activeShiftId)
    : null;
  const activeAssignment = (await getActiveAssignment(
    String((picker as { _id: unknown })._id),
  )) as { shiftId?: { _id?: unknown } | string } | null;
  let assignmentShiftId: string | null = null;
  if (activeAssignment?.shiftId) {
    const raw = activeAssignment.shiftId;
    assignmentShiftId =
      typeof raw === 'object' && raw && '_id' in raw
        ? String(raw._id ?? '')
        : String(raw || '');
    if (!assignmentShiftId) assignmentShiftId = null;
  }
  const shiftId = activeShiftId || assignmentShiftId;

  if (!shiftId) {
    throw new AppError(
      'Start your shift in the Picker app before accepting HSD orders.',
      403,
      'PICKER_SHIFT_NOT_STARTED',
    );
  }

  return {
    pickerUserId: String((picker as { _id: unknown })._id),
    shiftId,
    isOnline: true,
  };
}

/** True when operator may receive an auto-reassignment (no throw). */
export async function isHhdOperatorEligibleForAutoAssign(hhdUserId: string): Promise<boolean> {
  try {
    await assertHhdOperatorEligibleToClaim(hhdUserId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Next eligible HSD operator at the hub, excluding `excludeUserId`.
 * Prefers operators with a linked online on-shift Picker account.
 */
export async function findNextEligibleHhdOperator(
  hubKey: string,
  excludeUserId?: string | null,
): Promise<string | null> {
  const hub = String(hubKey || '').trim();
  const query: Record<string, unknown> = { isActive: { $ne: false } };
  if (hub) {
    query.$or = [{ darkstore: hub }, { warehouse: hub }];
  }
  if (excludeUserId && mongoose.Types.ObjectId.isValid(excludeUserId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeUserId) };
  }

  const candidates = await HHDUser.find(query).select('_id').limit(40).lean();
  for (const row of candidates) {
    const id = String((row as { _id: unknown })._id);
    if (await isHhdOperatorEligibleForAutoAssign(id)) {
      return id;
    }
  }
  return null;
}
