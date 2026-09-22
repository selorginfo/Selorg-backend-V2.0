import { ORDER_STATUS, OrderStatus } from './hhd.constants';
import { AppError } from '../../utils/AppError';

/** Allowed device-flow transitions (API contract §17). */
const TRANSITIONS: Record<string, OrderStatus[]> = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.RECEIVED],
  [ORDER_STATUS.RECEIVED]: [ORDER_STATUS.BAG_SCANNED, ORDER_STATUS.PENDING],
  [ORDER_STATUS.BAG_SCANNED]: [ORDER_STATUS.PICKING],
  [ORDER_STATUS.PICKING]: [
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.PHOTO_VERIFIED,
  ],
  [ORDER_STATUS.PHOTO_VERIFIED]: [ORDER_STATUS.RACK_ASSIGNED, ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.RACK_ASSIGNED]: [ORDER_STATUS.HANDED_OFF, ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.COMPLETED]: [],
  [ORDER_STATUS.HANDED_OFF]: [],
};

export function assertOrderTransition(from: string, to: string): void {
  if (!Object.values(ORDER_STATUS).includes(to as OrderStatus)) {
    throw new AppError(`Invalid status '${to}'`, 400, 'VALIDATION_ERROR');
  }
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to as OrderStatus)) {
    throw new AppError(
      `Cannot transition order from '${from}' to '${to}'`,
      409,
      'INVALID_TRANSITION',
    );
  }
}

export function isValidOrderStatus(status: string): status is OrderStatus {
  return Object.values(ORDER_STATUS).includes(status as OrderStatus);
}
