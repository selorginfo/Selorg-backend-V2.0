import { logger } from '../utils/logger';
import { eventBus } from './eventBus';
import { EVENT_TYPES } from './eventTypes';

export function registerEventListeners(): void {
  eventBus.on(EVENT_TYPES.ORDER_CREATED, (payload: { orderId?: string; userId?: string }) => {
    logger.info('[domain-event] order.created', { orderId: payload?.orderId, userId: payload?.userId });
    setImmediate(async () => {
      try {
        const orderId = payload?.orderId;
        if (!orderId) return;
        // Notification dispatch handled by notifications module
      } catch (err: any) {
        logger.warn('[domain-event] order.created handler skipped', { error: err?.message });
      }
    });
  });

  eventBus.on(EVENT_TYPES.INVENTORY_LOW_STOCK, (payload: { sku?: string; storeId?: string }) => {
    logger.warn('[domain-event] inventory.low_stock', { sku: payload?.sku, storeId: payload?.storeId });
  });
}
