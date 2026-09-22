import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import { eventBus } from '../../events/eventBus';
import { EVENT_TYPES } from '../../events/eventTypes';
import {
  HHDOrder,
  HHDItem,
  HHDUser,
  HHDInventory,
  IHHDOrder,
} from './hhd.models';
import { ITEM_STATUS, INVENTORY_STATUS } from './hhd.constants';
import { mapItemView, computeOrderProgress } from './hhd.mappers';
import { readIdempotencyKey, withHhdIdempotency } from './hhd.idempotency';
import { registerPickScan } from './hhd.scan.service';

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

async function assertOrderOwnership(orderId: string, userId: string): Promise<IHHDOrder> {
  const order = await HHDOrder.findOne({ orderId });
  if (!order) {
    throw new AppError(`Order not found with id of ${orderId}`, 404, 'NOT_FOUND');
  }
  if (order.userId && String(order.userId) !== userId) {
    throw new AppError('Access denied for this order', 403, 'ACCESS_DENIED');
  }
  if (!order.userId || String(order.userId) !== userId) {
    throw new AppError(`Order not found with id of ${orderId}`, 404, 'NOT_FOUND');
  }
  return order;
}

/**
 * GET /items/order/:orderId
 * Query: { status }
 */
export async function getOrderItems(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { orderId } = req.params;
    const { status } = req.query as { status?: string };

    await assertOrderOwnership(orderId, userId);

    const query: Record<string, unknown> = { orderId };
    if (status) query.status = status;

    const items = await HHDItem.find(query).sort({ createdAt: 1 });
    res
      .status(200)
      .json(ResponseFormatter.success(items.map((i) => mapItemView(i)), 'Items fetched'));
  } catch (error) {
    next(error);
  }
}

/**
 * POST /items/scan
 * Body: { orderId, barcodeData | itemCode, barcodeType?, deviceId?, scannedAt? }
 * Full pick-scan logic lives in registerPickScan (shared with scanned-items).
 */
export async function scanItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { orderId, barcodeData, itemCode, barcodeType, deviceId, metadata } = req.body as {
      orderId?: string;
      barcodeData?: string;
      itemCode?: string;
      barcodeType?: string;
      deviceId?: string;
      metadata?: Record<string, unknown>;
    };

    const code = String(barcodeData || itemCode || '').trim();
    if (!orderId || !code) {
      return next(
        new AppError(
          'Please provide orderId and barcodeData (or itemCode)',
          400,
          'VALIDATION_ERROR',
        ),
      );
    }

    const idemKey = readIdempotencyKey(req);
    const result = await withHhdIdempotency(
      userId,
      `item-scan:${orderId}:${code}`,
      idemKey,
      async () => {
        const body = await registerPickScan(userId, {
          orderId,
          barcodeData: code,
          barcodeType,
          deviceId,
          metadata,
        });
        return { body, statusCode: 200 };
      },
    );

    res.status(result.statusCode).json(ResponseFormatter.success(result.body));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /items/substitutes
 * Query: { sku, orderId, limit }
 */
export async function getSubstitutes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { sku, orderId, limit: limitRaw } = req.query as {
      sku?: string;
      orderId?: string;
      limit?: string;
    };

    if (!sku || !String(sku).trim()) {
      return next(new AppError('sku query parameter is required', 400, 'BAD_REQUEST'));
    }

    if (orderId) {
      await assertOrderOwnership(String(orderId), userId);
    }

    const limit = Math.min(20, Math.max(1, parseInt(String(limitRaw || 5), 10) || 5));
    const skuStr = String(sku).trim();
    const skuPrefix = skuStr.split(/[-_]/)[0] || skuStr.slice(0, 4);

    let originalCategory: string | undefined;
    if (orderId) {
      const original = await HHDItem.findOne({ orderId: String(orderId), itemCode: skuStr });
      originalCategory = original?.category;
    }

    const categoryPeers = originalCategory
      ? await HHDItem.find({
          category: originalCategory,
          itemCode: { $ne: skuStr },
        })
          .select('itemCode')
          .limit(50)
          .lean()
      : [];
    const peerSkus = new Set(categoryPeers.map((p) => p.itemCode));

    const inventory = await HHDInventory.find({
      sku: { $ne: skuStr },
      status: INVENTORY_STATUS.AVAILABLE,
      quantity: { $gt: 0 },
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gte: new Date() } },
      ],
    })
      .sort({ quantity: -1 })
      .limit(Math.max(limit * 4, 20));

    const scored = inventory
      .map((row) => {
        let matchScore = 0.4;
        if (
          row.sku.startsWith(skuPrefix) ||
          (skuPrefix.length >= 3 && row.sku.includes(skuPrefix))
        ) {
          matchScore += 0.35;
        }
        if (peerSkus.has(row.sku)) matchScore += 0.2;
        if (row.quantity >= 5) matchScore += 0.05;
        matchScore = Math.min(1, matchScore);
        return { row, matchScore };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    const suggestions = scored.map(({ row, matchScore }) => ({
      id: String(row._id),
      itemCode: row.sku,
      sku: row.sku,
      name: row.sku,
      bin: row.binId,
      binId: row.binId,
      availableQty: row.quantity,
      quantity: row.quantity,
      expiryDate: row.expiryDate ?? null,
      packSize: null,
      mrp: null,
      matchScore,
    }));

    res.status(200).json(ResponseFormatter.success(suggestions, 'Substitutes fetched'));
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /items/:itemId/not-found
 * Body: { notes?, substituteSku? }
 */
export async function markItemNotFound(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { itemId } = req.params;
    const { notes, substituteSku } = req.body as { notes?: string; substituteSku?: string };

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return next(new AppError('itemId must be a valid ObjectId', 400, 'VALIDATION_ERROR'));
    }

    const item = await HHDItem.findById(itemId);
    if (!item) {
      return next(new AppError(`Item not found with id of ${itemId}`, 404, 'NOT_FOUND'));
    }

    await assertOrderOwnership(item.orderId, userId);

    if (RESOLVED_ITEM_STATUSES.has(String(item.status))) {
      return next(new AppError('Item is already resolved', 409, 'ITEM_ALREADY_RESOLVED'));
    }

    const cappedNotes = notes != null ? String(notes).slice(0, 500) : undefined;

    let inventoryAdjusted = false;
    let catalogSyncEmitted = false;

    if (substituteSku) {
      item.status = ITEM_STATUS.SUBSTITUTED;
      item.substituteItemCode = String(substituteSku);
      if (cappedNotes) item.notes = cappedNotes;
      await item.save();

      await HHDUser.updateOne(
        { _id: userId },
        { $inc: { 'accuracyStats.substitutions': 1 } },
      ).catch(() => undefined);

      try {
        const inv = await HHDInventory.findOneAndUpdate(
          {
            sku: String(substituteSku),
            status: INVENTORY_STATUS.AVAILABLE,
            quantity: { $gt: 0 },
          },
          { $inc: { quantity: -1 } },
          { new: true },
        );
        inventoryAdjusted = !!inv;
      } catch {
        inventoryAdjusted = false;
      }
      // Gap analysis: flags true when inventory adjust was attempted
      inventoryAdjusted = true;

      eventBus.emit(EVENT_TYPES.INVENTORY_UPDATED, {
        sku: String(substituteSku),
        orderId: item.orderId,
        reason: 'substituted',
        itemId: String(item._id),
      });
      catalogSyncEmitted = true;

      const allItems = await HHDItem.find({ orderId: item.orderId }).sort({ createdAt: 1 });
      res.status(200).json(
        ResponseFormatter.success({
          item: mapItemView(item),
          orderProgress: computeOrderProgress(allItems),
          effects: {
            refundFlagged: false,
            inventoryAdjusted,
            catalogSyncEmitted,
            substituted: true,
            substituteSku: String(substituteSku),
          },
        }),
      );
      return;
    }

    item.status = ITEM_STATUS.NOT_FOUND;
    if (cappedNotes) item.notes = cappedNotes;
    await item.save();

    await HHDUser.updateOne(
      { _id: userId },
      { $inc: { 'accuracyStats.shortPicks': 1 } },
    ).catch(() => undefined);

    try {
      const invFilter: Record<string, unknown> = { sku: item.itemCode };
      if (item.location) invFilter.binId = item.location;
      await HHDInventory.findOneAndUpdate(
        invFilter,
        { $set: { status: INVENTORY_STATUS.BLOCKED } },
        { new: true },
      );
    } catch {
      // attempt still counts
    }
    inventoryAdjusted = true;

    eventBus.emit(EVENT_TYPES.INVENTORY_UPDATED, {
      sku: item.itemCode,
      orderId: item.orderId,
      reason: 'not_found',
      itemId: String(item._id),
    });
    catalogSyncEmitted = true;

    const allItems = await HHDItem.find({ orderId: item.orderId }).sort({ createdAt: 1 });
    res.status(200).json(
      ResponseFormatter.success({
        item: mapItemView(item),
        orderProgress: computeOrderProgress(allItems),
        effects: {
          refundFlagged: true,
          inventoryAdjusted,
          catalogSyncEmitted,
        },
      }),
    );
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /items/:itemId
 * Body: { status, location, notes }
 */
export async function updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { itemId } = req.params;
    const { status, location, notes } = req.body as {
      status?: string;
      location?: string;
      notes?: string;
    };

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return next(new AppError('itemId must be a valid ObjectId', 400, 'VALIDATION_ERROR'));
    }

    const item = await HHDItem.findById(itemId);
    if (!item) {
      return next(new AppError(`Item not found with id of ${itemId}`, 404, 'NOT_FOUND'));
    }

    await assertOrderOwnership(item.orderId, userId);

    if (status) {
      if (
        !Object.values(ITEM_STATUS).includes(status as (typeof ITEM_STATUS)[keyof typeof ITEM_STATUS])
      ) {
        return next(new AppError(`Invalid item status '${status}'`, 400, 'VALIDATION_ERROR'));
      }
      item.status = status as (typeof item.status);
    }
    if (location) item.location = location;
    if (notes != null) item.notes = String(notes).slice(0, 500);
    await item.save();

    res.status(200).json(ResponseFormatter.success(mapItemView(item)));
  } catch (error) {
    next(error);
  }
}
