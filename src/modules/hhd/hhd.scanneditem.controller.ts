import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import { HHDScannedItem } from './hhd.models';
import { readIdempotencyKey, withHhdIdempotency } from './hhd.idempotency';
import { registerPickScan, writeScanAuditOnly } from './hhd.scan.service';

/**
 * POST /scanned-items
 * When orderId is present, runs full pick-registration (same as /items/scan)
 * and returns the scan verdict payload with 200. Always writes an audit row.
 */
export async function createScannedItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.hhdUser?.id;
    if (!userId) {
      return next(new AppError('User not authenticated', 401, 'AUTH_REQUIRED'));
    }

    const { barcodeData, barcodeType, orderId, deviceId, metadata } = req.body as {
      barcodeData?: string;
      barcodeType?: string;
      orderId?: string;
      deviceId?: string;
      metadata?: Record<string, unknown>;
      userId?: string;
    };

    if (!barcodeData) {
      return next(new AppError('Please provide barcodeData', 400, 'VALIDATION_ERROR'));
    }

    const idempotencyKey = readIdempotencyKey(req);

    if (orderId) {
      const result = await withHhdIdempotency(
        userId,
        'scanned-items.create',
        idempotencyKey,
        async () => {
          const body = await registerPickScan(userId, {
            orderId,
            barcodeData,
            barcodeType,
            deviceId,
            metadata,
          });
          return { body, statusCode: 200 };
        },
      );
      res.status(result.statusCode).json(ResponseFormatter.success(result.body));
      return;
    }

    const result = await withHhdIdempotency(
      userId,
      'scanned-items.audit',
      idempotencyKey,
      async () => {
        const body = await writeScanAuditOnly(userId, {
          barcodeData,
          barcodeType,
          deviceId,
          metadata,
        });
        return { body, statusCode: 201 };
      },
    );
    res.status(result.statusCode).json(ResponseFormatter.success(result.body));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /scanned-items
 * Forces userId from token; caps limit at 100; validates dates.
 */
export async function getScannedItems(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const callerId = req.hhdUser?.id;
    if (!callerId) {
      return next(new AppError('User not authenticated', 401, 'AUTH_REQUIRED'));
    }

    const {
      orderId,
      deviceId,
      barcodeType,
      startDate,
      endDate,
      limit = '50',
      page = '1',
    } = req.query as Record<string, string | undefined>;

    const query: Record<string, unknown> = { userId: callerId };
    if (orderId) query.orderId = orderId;
    if (deviceId) query.deviceId = deviceId;
    if (barcodeType) query.barcodeType = barcodeType;

    if (startDate || endDate) {
      const range: Record<string, Date> = {};
      if (startDate) {
        const d = new Date(startDate);
        if (Number.isNaN(d.getTime())) {
          return next(new AppError('Invalid startDate', 400, 'VALIDATION_ERROR'));
        }
        range.$gte = d;
      }
      if (endDate) {
        const d = new Date(endDate);
        if (Number.isNaN(d.getTime())) {
          return next(new AppError('Invalid endDate', 400, 'VALIDATION_ERROR'));
        }
        range.$lte = d;
      }
      query.scannedAt = range;
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [scannedItems, total] = await Promise.all([
      HHDScannedItem.find(query).sort({ scannedAt: -1 }).limit(limitNum).skip(skip).lean(),
      HHDScannedItem.countDocuments(query),
    ]);

    const data = scannedItems.map((row) => ({
      id: String(row._id),
      barcodeData: row.barcodeData,
      barcodeType: row.barcodeType,
      orderId: row.orderId ?? null,
      deviceId: row.deviceId ?? null,
      scannedAt: row.scannedAt,
      metadata: row.metadata ?? {},
    }));

    res
      .status(200)
      .json(ResponseFormatter.paginated(data, total, pageNum, limitNum));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /scanned-items/:id — ownership required.
 */
export async function getScannedItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const callerId = req.hhdUser?.id;
    if (!callerId) {
      return next(new AppError('User not authenticated', 401, 'AUTH_REQUIRED'));
    }

    const { id } = req.params;
    const scannedItem = await HHDScannedItem.findById(id).lean();
    if (!scannedItem) {
      return next(new AppError(`Scanned item not found with id of ${id}`, 404, 'NOT_FOUND'));
    }
    if (String(scannedItem.userId) !== String(callerId)) {
      return next(new AppError('Scanned item belongs to another operator', 403, 'ACCESS_DENIED'));
    }

    res.status(200).json(
      ResponseFormatter.success({
        id: String(scannedItem._id),
        barcodeData: scannedItem.barcodeData,
        barcodeType: scannedItem.barcodeType,
        orderId: scannedItem.orderId ?? null,
        deviceId: scannedItem.deviceId ?? null,
        scannedAt: scannedItem.scannedAt,
        metadata: scannedItem.metadata ?? {},
      }),
    );
  } catch (error) {
    next(error);
  }
}
