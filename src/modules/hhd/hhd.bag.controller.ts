import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import { HHDBag, HHDOrder, HHDScannedItem, IHHDOrder } from './hhd.models';
import { BAG_STATUS, ORDER_STATUS, BagStatus } from './hhd.constants';
import { mapBagView, bagSizeLabel } from './hhd.mappers';
import { assertOrderTransition } from './hhd.order-state';
import { readIdempotencyKey, withHhdIdempotency } from './hhd.idempotency';
import * as fulfillment from '../orders/fulfillment.service';

interface ParsedBagQR {
  bagId: string;
  litres: number;
  size: string;
  sizeLabel: string;
}

function parseBagQR(qrCode: string): ParsedBagQR {
  const trimmed = String(qrCode || '').trim();
  const match = trimmed.match(/^BAG-(\d+)-([A-Za-z]+)-([A-Za-z0-9-]+)$/);
  if (!match) {
    throw new AppError(
      'Invalid bag QR code format. Expected: BAG-{litres}-{size}-{serial} (e.g. BAG-25-M-4471)',
      400,
      'INVALID_BAG_QR',
    );
  }
  const litres = parseInt(match[1], 10);
  const size = match[2].toUpperCase();
  const bagId = trimmed; // full QR string is the unique identity
  const sizeLabel = bagSizeLabel(size, litres);
  return { bagId, litres, size, sizeLabel };
}

function requireUserId(req: Request): string {
  const userId = req.hhdUser?.id;
  if (!userId) {
    throw new AppError('User ID is required', 401, 'AUTH_REQUIRED');
  }
  return userId;
}

async function assertOrderOwnership(orderId: string, userId: string): Promise<IHHDOrder> {
  const owned = await HHDOrder.findOne({ orderId, userId });
  if (owned) return owned;

  const any = await HHDOrder.findOne({ orderId });
  if (any) {
    throw new AppError('Access denied for this order', 403, 'ACCESS_DENIED');
  }
  throw new AppError(`Order not found with id of ${orderId}`, 404, 'ORDER_NOT_FOUND');
}

const OPEN_ORDER_STATUSES = new Set<string>([
  ORDER_STATUS.PENDING,
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.BAG_SCANNED,
  ORDER_STATUS.PICKING,
  ORDER_STATUS.PHOTO_VERIFIED,
  ORDER_STATUS.RACK_ASSIGNED,
]);

/**
 * POST /bags/scan
 * Body: { qrCode, orderId }
 */
export async function scanBag(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { qrCode, orderId } = req.body as { qrCode?: string; orderId?: string };

    if (!qrCode || !orderId) {
      return next(new AppError('Please provide qrCode and orderId', 400, 'VALIDATION_ERROR'));
    }

    const customer = await fulfillment.findCustomerOrderByHhdOrderId(orderId);
    let parsed: ParsedBagQR;
    try {
      parsed = fulfillment.resolvePackageScan(qrCode, orderId, customer?.bagCode);
    } catch (err) {
      return next(err);
    }

    const idemKey = readIdempotencyKey(req);
    const result = await withHhdIdempotency(
      userId,
      `bag-scan:${orderId}:${parsed.bagId}`,
      idemKey,
      async () => {
        const order = await assertOrderOwnership(orderId, userId);
        await fulfillment.assertCustomerOrderPickable(orderId);

        if (
          order.status !== ORDER_STATUS.RECEIVED &&
          order.status !== ORDER_STATUS.PENDING
        ) {
          // Idempotent: same bag already linked to this order
          if (order.bagId === parsed.bagId) {
            const existing = await HHDBag.findOne({ bagId: parsed.bagId, orderId });
            return {
              body: mapBagView(existing) || {
                code: parsed.bagId,
                size: parsed.size,
                sizeLabel: parsed.sizeLabel,
                status: BAG_STATUS.SCANNED,
                orderId,
                scannedAt: order.updatedAt,
              },
              statusCode: 200,
            };
          }
          throw new AppError(
            `Order must be in 'received' (or 'pending') status to scan a bag`,
            409,
            'INVALID_TRANSITION',
          );
        }

        const existingBag = await HHDBag.findOne({ bagId: parsed.bagId });
        if (existingBag) {
          if (existingBag.orderId === orderId) {
            return {
              body: mapBagView(existingBag),
              statusCode: 200,
            };
          }

          const otherOrder = await HHDOrder.findOne({ orderId: existingBag.orderId });
          if (otherOrder && OPEN_ORDER_STATUSES.has(otherOrder.status)) {
            throw new AppError(
              `Bag ${parsed.bagId} is already linked to open order ${existingBag.orderId}`,
              409,
              'BAG_ALREADY_USED',
            );
          }
          // Reuse bag from a closed order
          existingBag.orderId = orderId;
          existingBag.userId = order.userId!;
          existingBag.status = BAG_STATUS.SCANNED;
          existingBag.size = parsed.size;
          existingBag.sizeLabel = parsed.sizeLabel;
          existingBag.litres = parsed.litres;
          existingBag.scannedAt = new Date();
          await existingBag.save();
        }

        const createdNew = !existingBag;
        const bag =
          existingBag ||
          (await HHDBag.create({
            bagId: parsed.bagId,
            orderId,
            userId,
            size: parsed.size,
            sizeLabel: parsed.sizeLabel,
            litres: parsed.litres,
            status: BAG_STATUS.SCANNED,
            scannedAt: new Date(),
          }));

        // Transition pending → received if needed, then received → bag_scanned
        if (order.status === ORDER_STATUS.PENDING) {
          assertOrderTransition(order.status, ORDER_STATUS.RECEIVED);
          order.status = ORDER_STATUS.RECEIVED;
        }
        if (order.status === ORDER_STATUS.RECEIVED) {
          assertOrderTransition(order.status, ORDER_STATUS.BAG_SCANNED);
          order.status = ORDER_STATUS.BAG_SCANNED;
        }
        order.bagId = parsed.bagId;
        await order.save();

        await HHDScannedItem.create({
          barcodeData: parsed.bagId,
          barcodeType: 'qr',
          orderId,
          userId,
          metadata: { verdict: 'success', entityType: 'Bag' },
          scannedAt: new Date(),
        }).catch(() => undefined);

        return {
          body: mapBagView(bag),
          statusCode: createdNew ? 201 : 200,
        };
      },
    );

    res
      .status(result.statusCode)
      .json(ResponseFormatter.success(result.body, 'Bag scanned successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /bags/:bagId
 * Body: { status, photoUrl }
 */
export async function updateBag(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { bagId } = req.params;
    const { status, photoUrl } = req.body as { status?: string; photoUrl?: string };

    const bag = await HHDBag.findOne({ bagId });
    if (!bag) {
      return next(new AppError(`Bag not found with id of ${bagId}`, 404, 'NOT_FOUND'));
    }

    if (String(bag.userId) !== userId) {
      return next(new AppError('Access denied for this bag', 403, 'ACCESS_DENIED'));
    }

    if (status) {
      if (!Object.values(BAG_STATUS).includes(status as BagStatus)) {
        return next(new AppError(`Invalid bag status '${status}'`, 400, 'VALIDATION_ERROR'));
      }
      bag.status = status as BagStatus;
    }
    if (photoUrl) bag.photoUrl = photoUrl;
    await bag.save();

    res.status(200).json(ResponseFormatter.success(mapBagView(bag)));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /bags/:bagId
 */
export async function getBag(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { bagId } = req.params;

    const bag = await HHDBag.findOne({ bagId });
    if (!bag) {
      return next(new AppError(`Bag not found with id of ${bagId}`, 404, 'NOT_FOUND'));
    }

    if (String(bag.userId) !== userId) {
      return next(new AppError('Access denied for this bag', 403, 'ACCESS_DENIED'));
    }

    res.status(200).json(ResponseFormatter.success(mapBagView(bag)));
  } catch (error) {
    next(error);
  }
}
