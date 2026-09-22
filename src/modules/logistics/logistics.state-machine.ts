import type { OrderStatus } from './logistics.models';

/**
 * Valid status transitions for a logistics order.
 * Terminal states (DELIVERED, CANCELLED, FAILED) have no outgoing transitions.
 */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['DRIVER_ASSIGNED', 'CANCELLED', 'FAILED'],
  DRIVER_ASSIGNED: ['PICKED_UP', 'CANCELLED', 'FAILED'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  CANCELLED: [],
  FAILED: [],
};

/**
 * Returns true if transitioning from `from` → `to` is a legal state transition.
 */
export function canTransition(from: string | undefined | null, to: string | undefined | null): boolean {
  if (!from || !to) return false;
  const allowed = ALLOWED[from as OrderStatus];
  return Array.isArray(allowed) && allowed.includes(to as OrderStatus);
}

export { ALLOWED };
