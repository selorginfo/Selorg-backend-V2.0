import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import { eventBus } from '../../events/eventBus';
import { EVENT_TYPES } from '../../events/eventTypes';
import {
  HHDRack,
  HHDOrder,
  HHDCompletedOrder,
  HHDPhoto,
  HHDAssignOrder,
  HHDScannedItem,
} from './hhd.models';
import { ORDER_STATUS } from './hhd.constants';
import { deriveZoneFromRackIdentifier, formatRackSlot } from './hhd.mappers';
import { assertOrderTransition } from './hhd.order-state';
import { readIdempotencyKey, withHhdIdempotency } from './hhd.idempotency';
import * as fulfillment from '../orders/fulfillment.service';
import { DEFAULT_HUB_KEY } from '../orders/fulfillment.service';

interface ParsedRackQR {
  rackIdentifier: string;
  slotNumber: number;
  riderName: string;
  rackCode: string;
}

function parseRackQR(qrCode: string): ParsedRackQR {
  const trimmed = qrCode.trim();
  const fullPattern = /^Rack-([A-Z0-9]+)-Slot(\d+)\s*\(([^)]+)\)$/i;
  const match = trimmed.match(fullPattern);
  if (!match) {
    throw new AppError(
      'Invalid rack QR code format. Expected format: Rack-{identifier}-Slot{number} ({rider name}). Example: Rack-D1-Slot3 (John Doe)',
      400,
      'INVALID_RACK_QR',
    );
  }
  const rackIdentifier = match[1].toUpperCase();
  const slotNumber = parseInt(match[2], 10);
  const riderName = match[3].trim();
  if (isNaN(slotNumber) || slotNumber < 1) {
    throw new AppError('Invalid slot number in QR code', 400, 'INVALID_RACK_QR');
  }
  if (!riderName) {
    throw new AppError('Rider name is required in QR code format', 400, 'INVALID_RACK_QR');
  }
  const rackCode = `Rack-${rackIdentifier}-Slot${slotNumber}`;
  return { rackIdentifier, slotNumber, riderName, rackCode };
}

function serializeRack(rack: {
  rackCode: string;
  rackIdentifier: string;
  slotNumber: number;
  zone: string;
  riderName?: string | null;
  riderId?: string | null;
  assignedAt?: Date | null;
  isAvailable?: boolean;
  currentOrderId?: string | null;
  location?: string;
}) {
  return {
    code: rack.rackCode,
    slot: formatRackSlot(rack.rackIdentifier, rack.slotNumber),
    rider: rack.riderName ?? null,
    riderId: rack.riderId ?? null,
    zone: rack.zone,
    assignedAt: rack.assignedAt ?? null,
    isAvailable: rack.isAvailable,
    currentOrderId: rack.currentOrderId ?? null,
    location: rack.location,
  };
}

/**
 * POST /racks/scan
 * Body: { qrCode, orderId, riderId?, pickTime? }
 */
export async function scanRack(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.hhdUser?.id;
    if (!userId) {
      return next(new AppError('User ID is required', 401, 'AUTH_REQUIRED'));
    }

    const { qrCode, orderId, riderId, pickTime } = req.body as {
      qrCode?: string;
      orderId?: string;
      riderId?: string;
      pickTime?: number;
    };

    if (!qrCode || !orderId) {
      return next(new AppError('Please provide qrCode and orderId', 400, 'VALIDATION_ERROR'));
    }

    const idempotencyKey = readIdempotencyKey(req);
    const result = await withHhdIdempotency(
      userId,
      'racks.scan',
      idempotencyKey,
      async () => {
        const { rackIdentifier, slotNumber, riderName, rackCode: parsedRackCode } =
          parseRackQR(qrCode);

        const order = await HHDOrder.findOne({ orderId });
        if (!order) {
          throw new AppError(`Order not found with id of ${orderId}`, 404, 'ORDER_NOT_FOUND');
        }
        if (!order.userId || String(order.userId) !== String(userId)) {
          throw new AppError('Order belongs to another operator', 403, 'ACCESS_DENIED');
        }

        if (order.bagId) {
          const verifiedPhoto = await HHDPhoto.findOne({
            orderId,
            bagId: order.bagId,
            verified: true,
          });
          if (!verifiedPhoto) {
            throw new AppError(
              'Proof photo must be verified before rack assignment',
              409,
              'PHOTO_NOT_VERIFIED',
            );
          }
        }

        let rack = await HHDRack.findOne({ rackIdentifier, slotNumber });
        if (!rack) {
          const zone = deriveZoneFromRackIdentifier(rackIdentifier);
          rack = await HHDRack.create({
            rackCode: parsedRackCode,
            rackIdentifier,
            slotNumber,
            location: `${rackIdentifier}-Slot${slotNumber}`,
            zone,
            isAvailable: true,
          });
        }

        if (!rack.isAvailable && rack.currentOrderId && rack.currentOrderId !== orderId) {
          const occupying = await HHDOrder.findOne({ orderId: rack.currentOrderId })
            .select('status')
            .lean();
          const occupyingDone =
            !occupying ||
            occupying.status === ORDER_STATUS.COMPLETED ||
            occupying.status === ORDER_STATUS.HANDED_OFF ||
            occupying.status === ORDER_STATUS.RACK_ASSIGNED;
          if (occupyingDone) {
            // Previous bag already handed off / completed — free the slot for the next order
            rack.isAvailable = true;
            rack.currentOrderId = undefined;
            await rack.save();
          } else {
            throw new AppError(
              `Rack ${parsedRackCode} is not available. Currently assigned to order ${rack.currentOrderId}`,
              409,
              'RACK_OCCUPIED',
            );
          }
        }

        const completedAt = new Date();
        let pickTimeSeconds: number;
        if (typeof pickTime === 'number' && Number.isFinite(pickTime) && pickTime > 0) {
          // Client may send seconds; treat as seconds when large, else accept as seconds explicitly per contract
          pickTimeSeconds = Math.round(pickTime);
        } else if (order.startedAt) {
          pickTimeSeconds = Math.max(
            0,
            Math.round((completedAt.getTime() - new Date(order.startedAt).getTime()) / 1000),
          );
        } else if (order.pickTimeSeconds != null) {
          pickTimeSeconds = Math.round(Number(order.pickTimeSeconds));
        } else if (order.pickTime != null) {
          pickTimeSeconds = Math.round(Number(order.pickTime) * 60);
        } else {
          pickTimeSeconds = 0;
        }

        const pickTimeMinutes = Math.round((pickTimeSeconds / 60) * 100) / 100;

        // Canonical warehouse path: photo_verified → rack_assigned → completed (handover).
        if (order.status === ORDER_STATUS.PHOTO_VERIFIED) {
          assertOrderTransition(order.status, ORDER_STATUS.RACK_ASSIGNED);
          order.status = ORDER_STATUS.RACK_ASSIGNED;
        } else if (
          order.status !== ORDER_STATUS.RACK_ASSIGNED &&
          order.status !== ORDER_STATUS.COMPLETED &&
          order.status !== ORDER_STATUS.HANDED_OFF
        ) {
          assertOrderTransition(order.status, ORDER_STATUS.COMPLETED);
        }

        rack.isAvailable = false;
        rack.currentOrderId = orderId;
        rack.riderName = riderName;
        if (riderId) rack.riderId = riderId;
        rack.assignedAt = completedAt;
        await rack.save();

        order.rackLocation = parsedRackCode;
        order.targetRackCode = parsedRackCode;
        order.riderName = riderName;
        order.targetRiderName = riderName;
        if (riderId) {
          order.riderId = riderId;
          order.targetRiderId = riderId;
        }
        order.pickTimeSeconds = pickTimeSeconds;
        order.pickTime = pickTimeMinutes;
        await order.save();

        const hub = await fulfillment.resolveHhdHub(userId);
        // Persist rack on CustomerOrder.dispatchBay so Rider App shows the same location.
        await fulfillment.completeHandover({
          hhdOrderId: orderId,
          scannedBy: userId,
          hub,
          bagId: order.bagId || null,
          packageId: order.bagId || orderId,
          dispatchBay: parsedRackCode,
          rackCode: parsedRackCode,
        });

        await HHDScannedItem.create({
          barcodeData: parsedRackCode,
          barcodeType: 'qr',
          orderId,
          userId,
          metadata: { verdict: 'success', entityType: 'Rack', riderName },
          scannedAt: new Date(),
        }).catch(() => undefined);

        if (order.status !== ORDER_STATUS.COMPLETED && order.status !== ORDER_STATUS.HANDED_OFF) {
          if (order.status === ORDER_STATUS.RACK_ASSIGNED) {
            assertOrderTransition(order.status, ORDER_STATUS.COMPLETED);
          }
          order.status = ORDER_STATUS.COMPLETED;
        }
        order.completedAt = completedAt;
        await order.save();

        const lineCount = Number(order.lineCount ?? order.itemCount ?? 0);
        const unitCount = Number(order.unitCount ?? order.itemCount ?? 0);

        await HHDCompletedOrder.findOneAndUpdate(
          { orderId },
          {
            $set: {
              orderId: order.orderId,
              userId: order.userId,
              zone: order.zone,
              status: ORDER_STATUS.COMPLETED,
              itemCount: order.itemCount,
              lineCount,
              unitCount,
              targetTime: order.targetTime,
              pickTime: pickTimeMinutes,
              pickTimeSeconds,
              bagId: order.bagId,
              rackLocation: parsedRackCode,
              riderName,
              riderId: riderId ?? order.riderId,
              assignedAt: order.assignedAt,
              slaDueAt: order.slaDueAt,
              recommendedBagSize: order.recommendedBagSize,
              startedAt: order.startedAt,
              completedAt,
              rackAssignedAt: completedAt,
            },
          },
          { upsert: true, new: true },
        );

        await HHDAssignOrder.findOneAndUpdate(
          { orderId },
          {
            $set: {
              orderId,
              userId: order.userId,
              status: 'handed_off',
              completedAt,
              handedOver: true,
            },
          },
          { upsert: true },
        );

        eventBus.emit(EVENT_TYPES.ORDER_PICKED, {
          orderId,
          userId,
          rackCode: parsedRackCode,
          dispatchBay: parsedRackCode,
          hubKey: hub || DEFAULT_HUB_KEY,
          offerHubKey: hub || DEFAULT_HUB_KEY,
        });

        const body = {
          rack: {
            code: rack.rackCode,
            slot: formatRackSlot(rack.rackIdentifier, rack.slotNumber),
            rider: riderName,
            riderId: riderId ?? rack.riderId ?? null,
            zone: rack.zone,
            assignedAt: completedAt,
          },
          order: {
            id: order.orderId,
            status: ORDER_STATUS.COMPLETED,
            completedAt,
            pickTimeSeconds,
          },
        };

        return { body, statusCode: 200 };
      },
    );

    res
      .status(result.statusCode)
      .json(ResponseFormatter.success(result.body, 'Rack assigned. Order completed.'));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /racks/available
 * Query: { zone }
 */
export async function getAvailableRacks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { zone } = req.query as { zone?: string };
    const query: Record<string, unknown> = { isAvailable: true };
    if (zone) query.zone = zone;
    const racks = await HHDRack.find(query).lean();
    const data = racks.map((r) => serializeRack(r));
    res.status(200).json(ResponseFormatter.success(data));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /racks/:rackCode
 */
export async function getRack(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rackCode } = req.params;
    const rack = await HHDRack.findOne({ rackCode }).lean();
    if (!rack) {
      return next(new AppError(`Rack not found with code ${rackCode}`, 404, 'NOT_FOUND'));
    }
    res.status(200).json(ResponseFormatter.success(serializeRack(rack)));
  } catch (error) {
    next(error);
  }
}
