import type { Request, Response, NextFunction } from 'express';
import * as logisticsService from './logistics.service';

/**
 * GET /orders
 * Lists logistics orders with optional filters. Supports enforcedType for
 * scope-restricted callers (e.g. warehouse-only views).
 */
export async function listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as Record<string, unknown>;
    const out = await logisticsService.listOrders(query as logisticsService.ListOrdersQuery, {
      enforcedType: (req as unknown as { logisticsScopeType?: string }).logisticsScopeType,
    });
    res.json({
      success: true,
      data: out.items,
      meta: { total: out.total, page: out.page, limit: out.limit },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /orders/:id
 * Returns a single order with its status history and provider audit records.
 */
export async function getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await logisticsService.getOrderById(req.params.id, {
      enforcedType: (req as unknown as { logisticsScopeType?: string }).logisticsScopeType,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /orders
 * Creates a new logistics order and attempts provider submission with failover.
 */
export async function createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await logisticsService.createOrder(req.body as logisticsService.CreateOrderBody, {
      enforcedType: (req as unknown as { logisticsScopeType?: string }).logisticsScopeType,
    });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /orders/:id/cancel
 * Cancels an order (must be in a cancellable state per the state machine).
 */
export async function cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await logisticsService.cancelOrder(req.params.id, {
      enforcedType: (req as unknown as { logisticsScopeType?: string }).logisticsScopeType,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /orders/:id/tracking
 * Fetches live tracking data from the assigned provider.
 */
export async function getTracking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await logisticsService.getTracking(req.params.id, {
      enforcedType: (req as unknown as { logisticsScopeType?: string }).logisticsScopeType,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /orders/:id/status
 * Manually advances an order to a new status (admin / ops use).
 * Body: { status: OrderStatus, message?: string }
 */
export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, message } = req.body as { status: string; message?: string };
    const result = await logisticsService.applyWebhookStatusUpdate({
      providerOrderId: req.params.id, // treated as providerOrderId for manual lookup
      nextStatus: status as Parameters<typeof logisticsService.applyWebhookStatusUpdate>[0]['nextStatus'],
      message,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
