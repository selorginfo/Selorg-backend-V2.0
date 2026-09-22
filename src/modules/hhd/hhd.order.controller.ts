import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import { logger } from '../../utils/logger';
import { eventBus } from '../../events/eventBus';
import { EVENT_TYPES } from '../../events/eventTypes';
import {
  HHDOrder,
  HHDItem,
  HHDBag,
  HHDCompletedOrder,
  HHDAssignOrder,
  IHHDOrder,
  IHHDItem,
  IHHDBag,
} from './hhd.models';
import {
  ORDER_STATUS,
  ORDER_PRIORITY,
  ZONE,
  ITEM_STATUS,
  OrderStatus,
} from './hhd.constants';
import { mapOrderView, mapItemView } from './hhd.mappers';
import { assertOrderTransition, isValidOrderStatus } from './hhd.order-state';
import { readIdempotencyKey, withHhdIdempotency } from './hhd.idempotency';
import * as fulfillment from '../orders/fulfillment.service';
import { claimHhdOrder, listAvailableHhdOrders } from './hhd.claim';

const ACTIVE_CURRENT_STATUSES: OrderStatus[] = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.BAG_SCANNED,
  ORDER_STATUS.PICKING,
  ORDER_STATUS.PHOTO_VERIFIED,
];

const RESOLVED_ITEM_STATUSES = new Set<string>([
  ITEM_STATUS.SCANNED,
  ITEM_STATUS.NOT_FOUND,
  ITEM_STATUS.SUBSTITUTED,
  ITEM_STATUS.COMPLETED,
]);

function requireUserId(req: Request): string {
  const userId = req.hhdUser?.id;
  if (!userId) {
    throw new AppError('User ID is required', 401, 'AUTH_REQUIRED');
  }
  return userId;
}

function parsePageLimit(
  query: Record<string, string | undefined>,
  defaults: { page?: number; limit?: number } = {},
): { page: number; limit: number } {
  const page = Math.max(1, parseInt(String(query.page ?? defaults.page ?? 1), 10) || 1);
  const rawLimit = parseInt(String(query.limit ?? defaults.limit ?? 20), 10) || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  return { page, limit };
}

function mostCommonCategory(items: Array<IHHDItem | Record<string, unknown>>): string | null {
  const counts = new Map<string, number>();
  for (const raw of items) {
    const cat =
      typeof (raw as IHHDItem).toObject === 'function'
        ? (raw as IHHDItem).toObject().category
        : (raw as Record<string, unknown>).category;
    if (!cat || typeof cat !== 'string') continue;
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [cat, n] of counts) {
    if (n > bestCount) {
      best = cat;
      bestCount = n;
    }
  }
  return best;
}

async function loadBagForOrder(order: IHHDOrder | Record<string, unknown>): Promise<IHHDBag | null> {
  const bagId = (order as IHHDOrder).bagId || (order as Record<string, unknown>).bagId;
  if (!bagId) return null;
  return HHDBag.findOne({ bagId: String(bagId) });
}

function formatPickTimeLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m <= 0) return `${rem}s`;
  return `${m}m ${rem}s`;
}

function formatVsTargetLabel(vsSeconds: number | null): string | null {
  if (vsSeconds == null || !Number.isFinite(vsSeconds)) return null;
  const rounded = Math.round(vsSeconds);
  if (rounded === 0) return '0s';
  if (rounded < 0) return `−${Math.abs(rounded)}s`;
  return `+${rounded}s`;
}

function resolvePickTimeSeconds(order: Record<string, unknown>): number | null {
  if (order.pickTimeSeconds != null) return Number(order.pickTimeSeconds);
  if (order.startedAt && order.completedAt) {
    return Math.round(
      (new Date(order.completedAt as string).getTime() -
        new Date(order.startedAt as string).getTime()) /
        1000,
    );
  }
  if (order.pickTime != null) return Math.round(Number(order.pickTime) * 60);
  return null;
}

function resolveTargetTimeSeconds(order: Record<string, unknown>): number | null {
  if (order.targetTimeSeconds != null) return Number(order.targetTimeSeconds);
  if (order.targetTime != null) return Math.round(Number(order.targetTime) * 60);
  return null;
}

/**
 * GET /orders
 * Query: { status, page, limit }
 */
export async function getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { status } = req.query as Record<string, string | undefined>;
    const { page, limit } = parsePageLimit(req.query as Record<string, string | undefined>, {
      limit: 10,
    });

    const query: Record<string, unknown> = { userId };
    if (status) {
      if (!isValidOrderStatus(status)) {
        return next(new AppError(`Invalid status '${status}'`, 400, 'VALIDATION_ERROR'));
      }
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      HHDOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      HHDOrder.countDocuments(query),
    ]);

    const bagIds = orders.map((o) => o.bagId).filter(Boolean) as string[];
    const bags = bagIds.length
      ? await HHDBag.find({ bagId: { $in: bagIds } })
      : [];
    const bagById = new Map(bags.map((b) => [b.bagId, b]));

    const data = orders.map((order) =>
      mapOrderView(order, { bag: order.bagId ? bagById.get(order.bagId) ?? null : null }),
    );

    res.status(200).json(ResponseFormatter.paginated(data, total, page, limit, 'Orders fetched'));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /orders/:orderId
 */
export async function getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { orderId } = req.params;

    const owned = await HHDOrder.findOne({ orderId, userId });
    if (!owned) {
      const any = await HHDOrder.findOne({ orderId });
      if (any) {
        return next(new AppError('Access denied for this order', 403, 'ACCESS_DENIED'));
      }
      return next(new AppError(`Order not found with id of ${orderId}`, 404, 'NOT_FOUND'));
    }

    const [items, bag] = await Promise.all([
      HHDItem.find({ orderId }).sort({ createdAt: 1 }),
      loadBagForOrder(owned),
    ]);
    const zoneCategory = mostCommonCategory(items);

    res.status(200).json(
      ResponseFormatter.success({
        order: mapOrderView(owned, { bag, zoneCategory }),
        items: items.map((i) => mapItemView(i)),
      }),
    );
  } catch (error) {
    next(error);
  }
}

/**
 * POST /orders
 * Body: { orderId, zone, itemCount, targetTime, priority, items[], recommendedBagSize, ... }
 */
export async function createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const {
      orderId,
      zone,
      itemCount,
      targetTime,
      priority,
      items,
      recommendedBagSize,
      targetRackCode,
      targetRiderName,
      targetRiderId,
    } = req.body as {
      orderId?: string;
      zone?: string;
      itemCount?: number;
      targetTime?: number;
      priority?: string;
      items?: Array<Record<string, unknown>>;
      recommendedBagSize?: string;
      targetRackCode?: string;
      targetRiderName?: string;
      targetRiderId?: string;
    };

    if (!orderId || typeof orderId !== 'string') {
      return next(new AppError('orderId is required', 400, 'VALIDATION_ERROR'));
    }
    if (!zone || !Object.values(ZONE).includes(zone as (typeof ZONE)[keyof typeof ZONE])) {
      return next(
        new AppError(
          `zone must be one of: ${Object.values(ZONE).join(', ')}`,
          400,
          'VALIDATION_ERROR',
        ),
      );
    }

    const existingOrder = await HHDOrder.findOne({ orderId });
    if (existingOrder) {
      return next(new AppError(`Order ${orderId} already exists`, 400, 'CONFLICT'));
    }

    if (items && Array.isArray(items)) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.itemCode || !item.name) {
          return next(
            new AppError(
              `items[${i}] requires itemCode and name`,
              400,
              'VALIDATION_ERROR',
            ),
          );
        }
        const qty = Number(item.quantity ?? 1);
        if (!Number.isFinite(qty) || qty < 1) {
          return next(
            new AppError(`items[${i}].quantity must be >= 1`, 400, 'VALIDATION_ERROR'),
          );
        }
      }
    }

    const lineCount = items && Array.isArray(items) ? items.length : Number(itemCount) || 0;
    const unitCount =
      items && Array.isArray(items)
        ? items.reduce((sum, it) => sum + Number(it.quantity ?? 1), 0)
        : Number(itemCount) || 0;

    if (lineCount < 1 && (!itemCount || itemCount < 1)) {
      return next(new AppError('Order must include at least one item', 400, 'VALIDATION_ERROR'));
    }

    const now = new Date();
    let slaDueAt: Date | undefined;
    if (targetTime != null && Number(targetTime) > 0) {
      slaDueAt = new Date(now.getTime() + Number(targetTime) * 60 * 1000);
    }

    const order = await HHDOrder.create({
      orderId,
      userId,
      zone,
      itemCount: unitCount || itemCount || lineCount,
      lineCount,
      unitCount: unitCount || itemCount || lineCount,
      targetTime,
      recommendedBagSize,
      targetRackCode,
      targetRiderName,
      targetRiderId,
      priority:
        priority && Object.values(ORDER_PRIORITY).includes(priority as never)
          ? priority
          : ORDER_PRIORITY.HIGH,
      status: ORDER_STATUS.RECEIVED,
      assignedAt: now,
      slaDueAt,
      startedAt: now,
    });

    if (items && Array.isArray(items) && items.length > 0) {
      await HHDItem.insertMany(
        items.map((item) => ({
          orderId,
          itemCode: String(item.itemCode),
          name: String(item.name),
          quantity: Number(item.quantity ?? 1),
          scannedQuantity: 0,
          category: item.category,
          status: ITEM_STATUS.PENDING,
          location: item.location ?? item.bin,
          crate: item.crate,
          packSize: item.packSize ?? item.gram,
          mrp: item.mrp != null ? Number(item.mrp) : undefined,
          expiryDate: item.expiryDate ? new Date(String(item.expiryDate)) : undefined,
          notes: item.notes,
        })),
      );
    }

    logger.info('[HHD Order] Created', { orderId, userId });
    res.status(201).json(ResponseFormatter.success(mapOrderView(order), 'Order created'));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /orders/available
 * Read-only pool of unassigned pending tickets for this operator's hub.
 */
export async function getAvailableOrders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { limit } = parsePageLimit(req.query as Record<string, string | undefined>, {
      limit: 50,
    });
    const orders = await listAvailableHhdOrders(userId, limit);
    res.status(200).json(
      ResponseFormatter.success({
        orders: orders.map((order) => mapOrderView(order)),
      }),
    );
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /orders/:orderId/accept
 * Atomic first-accept-wins claim. Does not auto-assign on poll.
 */
export async function acceptAvailableOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { orderId } = req.params;
    const claimed = await claimHhdOrder(userId, orderId);
    const bag = await loadBagForOrder(claimed);
    const items = await HHDItem.find({ orderId: claimed.orderId }).sort({ createdAt: 1 });
    res.status(200).json(
      ResponseFormatter.success({
        accepted: true,
        order: mapOrderView(claimed, { bag }),
        items: items.map((i) => mapItemView(i)),
      }),
    );
  } catch (error) {
    next(error);
  }
}

/**
 * GET /orders/current
 * Returns the caller's in-progress order only. Does not claim from the pool.
 */
export async function getCurrentOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { includeItems } = req.query as { includeItems?: string };
    const withItems = includeItems !== 'false';

    let order =
      (await HHDOrder.findOne({
        userId,
        status: { $in: ACTIVE_CURRENT_STATUSES },
      }).sort({ assignedAt: 1, createdAt: 1 })) || null;

    if (order && (await fulfillment.isCustomerOrderCancelled(order.orderId))) {
      await HHDOrder.deleteOne({ _id: order._id });
      await HHDItem.deleteMany({ orderId: order.orderId });
      order = null;
    }

    if (!order) {
      res.status(200).json(ResponseFormatter.success({ order: null, items: [] }));
      return;
    }

    const items = withItems
      ? await HHDItem.find({ orderId: order.orderId }).sort({ createdAt: 1 })
      : [];
    const bag = await loadBagForOrder(order);
    const zoneCategory = mostCommonCategory(items);

    res.status(200).json(
      ResponseFormatter.success({
        order: mapOrderView(order, { bag, zoneCategory }),
        items: withItems ? items.map((i) => mapItemView(i)) : [],
      }),
    );
  } catch (error) {
    next(error);
  }
}

/**
 * GET /orders/status/:status
 */
export async function getOrdersByStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { status } = req.params;
    if (!isValidOrderStatus(status)) {
      return next(new AppError(`Invalid status '${status}'`, 400, 'VALIDATION_ERROR'));
    }

    const { page, limit } = parsePageLimit(req.query as Record<string, string | undefined>, {
      limit: 20,
    });
    const skip = (page - 1) * limit;
    const query = { userId, status };

    const [orders, total] = await Promise.all([
      HHDOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      HHDOrder.countDocuments(query),
    ]);

    const bagIds = orders.map((o) => o.bagId).filter(Boolean) as string[];
    const bags = bagIds.length ? await HHDBag.find({ bagId: { $in: bagIds } }) : [];
    const bagById = new Map(bags.map((b) => [b.bagId, b]));

    // Enrich zoneLabel with most common category when cheap (batch items for these orders)
    const orderIds = orders.map((o) => o.orderId);
    const allItems = orderIds.length
      ? await HHDItem.find({ orderId: { $in: orderIds } }).select('orderId category')
      : [];
    const itemsByOrder = new Map<string, IHHDItem[]>();
    for (const it of allItems) {
      const list = itemsByOrder.get(it.orderId) || [];
      list.push(it);
      itemsByOrder.set(it.orderId, list);
    }

    const data = orders.map((order) =>
      mapOrderView(order, {
        bag: order.bagId ? bagById.get(order.bagId) ?? null : null,
        zoneCategory: mostCommonCategory(itemsByOrder.get(order.orderId) || []),
      }),
    );

    res
      .status(200)
      .json(ResponseFormatter.paginated(data, total, page, limit, 'Orders fetched'));
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /orders/:orderId/status
 * Body: { status, bagId?, rackLocation?, riderName?, riderId?, pickTime?, priority? }
 */
export async function updateOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { orderId } = req.params;
    const { status, bagId, rackLocation, riderName, riderId, pickTime, priority } = req.body as {
      status?: string;
      bagId?: string;
      rackLocation?: string;
      riderName?: string;
      riderId?: string;
      pickTime?: number;
      priority?: string;
    };

    if (!status) {
      return next(new AppError('status is required', 400, 'VALIDATION_ERROR'));
    }
    if (!isValidOrderStatus(status)) {
      return next(new AppError(`Invalid status '${status}'`, 400, 'VALIDATION_ERROR'));
    }

    const idemKey = readIdempotencyKey(req);
    const result = await withHhdIdempotency(
      userId,
      `order-status:${orderId}`,
      idemKey,
      async () => {
        const owned = await HHDOrder.findOne({ orderId, userId });
        if (!owned) {
          const any = await HHDOrder.findOne({ orderId });
          if (any) {
            throw new AppError('Access denied for this order', 403, 'ACCESS_DENIED');
          }
          throw new AppError(`Order not found with id of ${orderId}`, 404, 'NOT_FOUND');
        }

        assertOrderTransition(owned.status, status);
        await fulfillment.assertCustomerOrderPickable(orderId);

        owned.status = status as OrderStatus;
        if (bagId) owned.bagId = bagId;
        if (rackLocation) owned.rackLocation = rackLocation;
        if (riderName) {
          owned.riderName = riderName;
          owned.targetRiderName = riderName;
        }
        if (riderId) {
          owned.riderId = riderId;
          owned.targetRiderId = riderId;
        }
        if (pickTime != null) {
          owned.pickTime = pickTime;
          owned.pickTimeSeconds = Math.round(Number(pickTime) * 60);
        }
        if (priority && Object.values(ORDER_PRIORITY).includes(priority as never)) {
          owned.priority = priority as (typeof owned.priority);
        }
        if (status === ORDER_STATUS.PICKING && !owned.startedAt) {
          owned.startedAt = new Date();
        }
        if (
          status === ORDER_STATUS.COMPLETED ||
          status === ORDER_STATUS.PHOTO_VERIFIED
        ) {
          if (!owned.completedAt) owned.completedAt = new Date();
        }

        await owned.save();
        await fulfillment.onHhdStatusChanged(orderId, status);
        const bag = await loadBagForOrder(owned);
        return { body: mapOrderView(owned, { bag }), statusCode: 200 };
      },
    );

    res.status(result.statusCode).json(ResponseFormatter.success(result.body));
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /orders/assignorders/:orderId/status
 * Body: { status } — uses HHDOrder as source of truth; syncs HHDAssignOrder.
 */
export async function updateAssignOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { orderId } = req.params;
    const { status } = req.body as { status?: string };

    if (!status) {
      return next(new AppError('Status is required', 400, 'BAD_REQUEST'));
    }
    if (!isValidOrderStatus(status)) {
      return next(new AppError(`Invalid status '${status}'`, 400, 'VALIDATION_ERROR'));
    }

    const idemKey = readIdempotencyKey(req);
    const result = await withHhdIdempotency(
      userId,
      `assign-order-status:${orderId}`,
      idemKey,
      async () => {
        const order = await HHDOrder.findOne({ orderId });
        if (!order) {
          throw new AppError(`Order not found with id of ${orderId}`, 404, 'NOT_FOUND');
        }
        const owner = order.userId ? String(order.userId) : null;
        if (owner && owner !== userId) {
          throw new AppError('Access denied for this order', 403, 'ACCESS_DENIED');
        }
        if (!owner) {
          throw new AppError(`Order not found with id of ${orderId}`, 404, 'NOT_FOUND');
        }

        if (status === ORDER_STATUS.COMPLETED || status === ORDER_STATUS.PHOTO_VERIFIED) {
          const items = await HHDItem.find({ orderId });
          const unresolved = items.filter((it) => !RESOLVED_ITEM_STATUSES.has(String(it.status)));
          if (unresolved.length > 0) {
            throw new AppError(
              'Cannot complete pick until all items are resolved',
              409,
              'INVALID_TRANSITION',
            );
          }
        }

        // Frontend sends "completed" for confirm-to-photo; allow picking → completed
        // (also allow picking → photo_verified if client sends that explicitly).
        const targetStatus =
          status === ORDER_STATUS.COMPLETED && order.status === ORDER_STATUS.PICKING
            ? ORDER_STATUS.COMPLETED
            : status;

        assertOrderTransition(order.status, targetStatus);
        await fulfillment.assertCustomerOrderPickable(orderId);

        const completedAt = new Date();
        order.status = targetStatus as OrderStatus;
        if (
          targetStatus === ORDER_STATUS.COMPLETED ||
          targetStatus === ORDER_STATUS.PHOTO_VERIFIED
        ) {
          order.completedAt = completedAt;
          if (order.startedAt) {
            order.pickTimeSeconds = Math.round(
              (completedAt.getTime() - new Date(order.startedAt).getTime()) / 1000,
            );
            order.pickTime = Math.round((order.pickTimeSeconds / 60) * 100) / 100;
          }
        }
        await order.save();
        await fulfillment.onHhdStatusChanged(orderId, targetStatus);

        await HHDAssignOrder.findOneAndUpdate(
          { orderId },
          {
            $set: {
              orderId,
              userId: order.userId,
              status: targetStatus,
              completedAt:
                targetStatus === ORDER_STATUS.COMPLETED ||
                targetStatus === ORDER_STATUS.PHOTO_VERIFIED
                  ? completedAt
                  : undefined,
            },
          },
          { upsert: true, new: true },
        );

        eventBus.emit(EVENT_TYPES.ORDER_PICKED, {
          orderId,
          userId,
          status: targetStatus,
          completedAt,
        });

        return {
          body: {
            id: orderId,
            status: targetStatus,
            completedAt:
              targetStatus === ORDER_STATUS.COMPLETED ||
              targetStatus === ORDER_STATUS.PHOTO_VERIFIED
                ? completedAt
                : order.completedAt ?? null,
          },
          statusCode: 200,
        };
      },
    );

    res
      .status(result.statusCode)
      .json(
        ResponseFormatter.success(
          result.body,
          `AssignOrder status updated to ${(result.body as { status: string }).status}`,
        ),
      );
  } catch (error) {
    next(error);
  }
}

/**
 * GET /orders/assignorders/status/:status
 */
export async function getAssignOrdersByStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { status } = req.params;
    const { page, limit } = parsePageLimit(req.query as Record<string, string | undefined>);
    const skip = (page - 1) * limit;

    const query = { status, userId: new mongoose.Types.ObjectId(userId) };
    const [orders, total] = await Promise.all([
      HHDAssignOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      HHDAssignOrder.countDocuments(query),
    ]);

    const data = orders.map((o) => ({
      id: o.orderId,
      orderId: o.orderId,
      status: o.status,
      userId: o.userId ? String(o.userId) : null,
      completedAt: o.completedAt ?? null,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));

    res
      .status(200)
      .json(ResponseFormatter.paginated(data, total, page, limit, 'Assign orders fetched'));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /orders/completed
 */
export async function getCompletedOrders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { page, limit } = parsePageLimit(req.query as Record<string, string | undefined>, {
      limit: 20,
    });
    const skip = (page - 1) * limit;

    const query = { userId };
    const [completedOrders, total] = await Promise.all([
      HHDCompletedOrder.find(query).sort({ completedAt: -1 }).skip(skip).limit(limit).exec(),
      HHDCompletedOrder.countDocuments(query),
    ]);

    const data = completedOrders.map((o) => mapOrderView(o as unknown as IHHDOrder));
    res
      .status(200)
      .json(ResponseFormatter.paginated(data, total, page, limit, 'Completed orders fetched'));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /orders/:orderId/summary
 */
export async function getOrderSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { orderId } = req.params;

    let source: Record<string, unknown> | null = null;

    const completed = await HHDCompletedOrder.findOne({ orderId });
    if (completed) {
      const owner = completed.userId ? String(completed.userId) : null;
      if (owner && owner !== userId) {
        return next(new AppError('Access denied for this order', 403, 'ACCESS_DENIED'));
      }
      if (!owner || owner !== userId) {
        return next(new AppError(`Order not found with id of ${orderId}`, 404, 'NOT_FOUND'));
      }
      source = completed.toObject();
    } else {
      const order = await HHDOrder.findOne({ orderId });
      if (!order) {
        return next(new AppError(`Order not found with id of ${orderId}`, 404, 'NOT_FOUND'));
      }
      const owner = order.userId ? String(order.userId) : null;
      if (owner && owner !== userId) {
        return next(new AppError('Access denied for this order', 403, 'ACCESS_DENIED'));
      }
      if (!owner || owner !== userId) {
        return next(new AppError(`Order not found with id of ${orderId}`, 404, 'NOT_FOUND'));
      }
      source = order.toObject();
    }

    const pickTimeSeconds = resolvePickTimeSeconds(source) ?? 0;
    const targetTimeSeconds = resolveTargetTimeSeconds(source);
    const vsTargetSeconds =
      targetTimeSeconds != null ? pickTimeSeconds - targetTimeSeconds : null;

    const rackCode =
      (source.rackLocation as string) ||
      (source.targetRackCode as string) ||
      null;
    let slot: string | null = null;
    if (rackCode) {
      const m = String(rackCode).match(/^Rack-([A-Z0-9]+)-Slot(\d+)$/i);
      if (m) slot = `${m[1].toUpperCase()}·S${parseInt(m[2], 10)}`;
    }

    res.status(200).json(
      ResponseFormatter.success({
        orderId,
        pickTimeSeconds,
        pickTimeLabel: formatPickTimeLabel(pickTimeSeconds),
        targetTimeSeconds,
        vsTargetSeconds,
        vsTargetLabel: formatVsTargetLabel(vsTargetSeconds),
        varianceSeconds: vsTargetSeconds,
        rack: {
          code: rackCode,
          slot,
          rider: (source.riderName as string) || (source.targetRiderName as string) || null,
        },
      }),
    );
  } catch (error) {
    next(error);
  }
}

/**
 * PUT admin assign — Body: { userId }
 * Sets assignment fields on an HHDOrder.
 */
export async function assignOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { orderId } = req.params;
    const { userId: assigneeId } = req.body as { userId?: string };

    if (!assigneeId || !mongoose.Types.ObjectId.isValid(assigneeId)) {
      return next(new AppError('userId must be a valid ObjectId', 400, 'VALIDATION_ERROR'));
    }

    const order = await HHDOrder.findOne({ orderId });
    if (!order) {
      return next(new AppError(`Order not found with id of ${orderId}`, 404, 'NOT_FOUND'));
    }

    const now = new Date();
    order.userId = new mongoose.Types.ObjectId(assigneeId);
    order.assignedAt = now;
    if (order.targetTime != null && order.targetTime > 0) {
      order.slaDueAt = new Date(now.getTime() + order.targetTime * 60 * 1000);
    }
    if (order.status === ORDER_STATUS.PENDING) {
      // Keep pending or leave as-is; assignment alone does not force received
    }
    await order.save();

    await HHDAssignOrder.findOneAndUpdate(
      { orderId },
      {
        $set: {
          orderId,
          userId: order.userId,
          status: order.status,
        },
      },
      { upsert: true },
    );

    logger.info('[HHD Order] Assigned', { orderId, userId: assigneeId });
    res.status(200).json(ResponseFormatter.success(mapOrderView(order), 'Order assigned'));
  } catch (error) {
    next(error);
  }
}
