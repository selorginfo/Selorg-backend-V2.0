import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import {
  HHDOrder,
  HHDItem,
  HHDScannedItem,
  HHDUser,
  IHHDItem,
  IHHDOrder,
} from './hhd.models';
import { ORDER_STATUS, ITEM_STATUS } from './hhd.constants';
import { assertOrderTransition } from './hhd.order-state';
import { computeOrderProgress, mapItemView } from './hhd.mappers';

const BARCODE_TYPES = new Set(['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc', 'other']);

export type ScanVerdict = 'success' | 'duplicate' | 'reject';

export type PickScanResult = {
  verdict: ScanVerdict;
  message?: string;
  item: Record<string, unknown> | null;
  orderProgress: ReturnType<typeof computeOrderProgress>;
  orderStatus: string;
};

export type RegisterPickScanInput = {
  orderId: string;
  barcodeData: string;
  barcodeType?: string;
  deviceId?: string;
  metadata?: Record<string, unknown>;
};

function normalizeBarcodeType(raw?: string): string {
  const t = String(raw || 'other').toLowerCase();
  return BARCODE_TYPES.has(t) ? t : 'other';
}

function assertOrderOwnership(order: IHHDOrder, userId: string): void {
  if (!order.userId) {
    throw new AppError('Order is not assigned', 403, 'ACCESS_DENIED');
  }
  if (String(order.userId) !== String(userId)) {
    throw new AppError('Order belongs to another operator', 403, 'ACCESS_DENIED');
  }
}

function capMetadata(raw?: Record<string, unknown>): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw).slice(0, 50)) {
    if (typeof value === 'string') {
      out[key] = value.length > 500 ? value.slice(0, 500) : value;
    } else if (value == null || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else {
      try {
        out[key] = JSON.parse(JSON.stringify(value));
      } catch {
        out[key] = String(value);
      }
    }
  }
  return out;
}

async function writeAuditRow(
  userId: string,
  input: RegisterPickScanInput,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await HHDScannedItem.create({
    barcodeData: input.barcodeData,
    barcodeType: normalizeBarcodeType(input.barcodeType),
    orderId: input.orderId,
    userId,
    deviceId: input.deviceId,
    metadata: { ...capMetadata(input.metadata), ...extra },
    scannedAt: new Date(),
  });
}

async function bumpAccuracy(
  userId: string,
  field: 'successfulUnits' | 'misScans' | 'rescans',
): Promise<void> {
  await HHDUser.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $inc: { [`accuracyStats.${field}`]: 1 } },
  ).catch(() => {});
}

/**
 * Shared pick-scan registration used by POST /items/scan and POST /scanned-items.
 * Always writes an audit row. Returns HTTP-200 verdict payloads (including reject/duplicate).
 */
export async function registerPickScan(
  userId: string,
  input: RegisterPickScanInput,
): Promise<PickScanResult> {
  const orderId = String(input.orderId || '').trim();
  const barcodeData = String(input.barcodeData || '').trim();

  if (!orderId || !barcodeData) {
    throw new AppError('Please provide orderId and barcodeData', 400, 'VALIDATION_ERROR');
  }
  if (barcodeData.length > 128) {
    throw new AppError('barcodeData must be at most 128 characters', 400, 'VALIDATION_ERROR');
  }

  const order = await HHDOrder.findOne({ orderId });
  if (!order) {
    throw new AppError(`Order not found with id of ${orderId}`, 404, 'ORDER_NOT_FOUND');
  }
  assertOrderOwnership(order, userId);

  const pickable =
    order.status === ORDER_STATUS.BAG_SCANNED || order.status === ORDER_STATUS.PICKING;
  if (!pickable) {
    throw new AppError(
      `Order is not pickable in status '${order.status}'`,
      409,
      'ORDER_NOT_PICKABLE',
    );
  }

  const items = await HHDItem.find({ orderId }).sort({ createdAt: 1 });
  const match = items.find((it) => {
    const code = String(it.itemCode || '').trim();
    const crate = String(it.crate || '').trim();
    return (
      code.toLowerCase() === barcodeData.toLowerCase() ||
      (crate.length > 0 && crate.toLowerCase() === barcodeData.toLowerCase())
    );
  }) as IHHDItem | undefined;

  const progressBefore = computeOrderProgress(items);

  if (!match) {
    await writeAuditRow(userId, input, { verdict: 'reject' });
    await bumpAccuracy(userId, 'misScans');
    return {
      verdict: 'reject',
      message: `This item isn't part of ${orderId}.`,
      item: null,
      orderProgress: progressBefore,
      orderStatus: order.status,
    };
  }

  const qty = Number(match.quantity ?? 1);
  const scannedQty = Number(match.scannedQuantity ?? 0);

  if (scannedQty >= qty) {
    await writeAuditRow(userId, input, { verdict: 'duplicate', itemId: String(match._id) });
    await bumpAccuracy(userId, 'rescans');
    return {
      verdict: 'duplicate',
      message: 'This unit is already in the bag.',
      item: mapItemView(match),
      orderProgress: progressBefore,
      orderStatus: order.status,
    };
  }

  match.scannedQuantity = scannedQty + 1;
  match.scannedAt = new Date();
  if (match.scannedQuantity >= qty) {
    match.status = ITEM_STATUS.SCANNED;
  }
  await match.save();

  if (order.status === ORDER_STATUS.BAG_SCANNED) {
    assertOrderTransition(order.status, ORDER_STATUS.PICKING);
    order.status = ORDER_STATUS.PICKING;
    if (!order.startedAt) order.startedAt = new Date();
    await order.save();
  }

  const refreshed = await HHDItem.find({ orderId }).sort({ createdAt: 1 });
  const orderProgress = computeOrderProgress(refreshed);

  await writeAuditRow(userId, input, {
    verdict: 'success',
    itemId: String(match._id),
    scannedQuantity: match.scannedQuantity,
  });
  await bumpAccuracy(userId, 'successfulUnits');

  return {
    verdict: 'success',
    item: mapItemView(match),
    orderProgress,
    orderStatus: order.status,
  };
}

/** Audit-only path when no orderId is supplied (still writes a scanned-items row). */
export async function writeScanAuditOnly(
  userId: string,
  input: Omit<RegisterPickScanInput, 'orderId'> & { orderId?: string },
): Promise<Record<string, unknown>> {
  const barcodeData = String(input.barcodeData || '').trim();
  if (!barcodeData) {
    throw new AppError('Please provide barcodeData', 400, 'VALIDATION_ERROR');
  }

  const doc = await HHDScannedItem.create({
    barcodeData,
    barcodeType: normalizeBarcodeType(input.barcodeType),
    orderId: input.orderId,
    userId,
    deviceId: input.deviceId,
    metadata: capMetadata(input.metadata),
    scannedAt: new Date(),
  });

  return {
    id: String(doc._id),
    barcodeData: doc.barcodeData,
    barcodeType: doc.barcodeType,
    orderId: doc.orderId ?? null,
    deviceId: doc.deviceId ?? null,
    scannedAt: doc.scannedAt,
  };
}
