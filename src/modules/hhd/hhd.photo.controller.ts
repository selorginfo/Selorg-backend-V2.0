import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import { HHDPhoto, HHDOrder, HHDBag } from './hhd.models';
import { ORDER_STATUS, BAG_STATUS } from './hhd.constants';
import { assertOrderTransition } from './hhd.order-state';
import { readIdempotencyKey, withHhdIdempotency } from './hhd.idempotency';

function getUploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
}

function getFileUrl(filename: string): string {
  const baseUrl = process.env.FILE_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `${baseUrl}/uploads/${filename}`;
}

function ensureUploadDir(): void {
  const dir = getUploadDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extFromMime(mime: string): string {
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  return '.jpg';
}

function parseDataUrl(raw: string): { buffer: Buffer; ext: string } {
  const trimmed = raw.trim();
  const dataUrlMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (dataUrlMatch) {
    const mime = dataUrlMatch[1].toLowerCase();
    const b64 = dataUrlMatch[2].replace(/\s/g, '');
    return { buffer: Buffer.from(b64, 'base64'), ext: extFromMime(mime) };
  }
  // Raw base64
  const b64 = trimmed.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(b64.slice(0, 100)) || b64.length < 32) {
    throw new AppError('Invalid image dataUrl / base64 payload', 400, 'UNSUPPORTED_MEDIA_TYPE');
  }
  return { buffer: Buffer.from(b64, 'base64'), ext: '.jpg' };
}

/**
 * POST /photos
 * Accepts multipart file OR JSON { orderId, bagId, dataUrl|base64 }.
 * Returns { id, url, verified } only.
 */
export async function uploadPhoto(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.hhdUser?.id;
    if (!userId) {
      return next(new AppError('User not authenticated', 401, 'AUTH_REQUIRED'));
    }

    const body = req.body as {
      orderId?: string;
      bagId?: string;
      dataUrl?: string;
      base64?: string;
    };
    const orderId = body.orderId?.trim();
    const bagId = body.bagId?.trim();

    if (!orderId || !bagId) {
      return next(new AppError('Please provide orderId and bagId', 400, 'VALIDATION_ERROR'));
    }

    const idempotencyKey = readIdempotencyKey(req);
    const result = await withHhdIdempotency(
      userId,
      'photos.upload',
      idempotencyKey,
      async () => {
        const order = await HHDOrder.findOne({ orderId });
        if (!order) {
          throw new AppError(`Order not found with id of ${orderId}`, 404, 'ORDER_NOT_FOUND');
        }
        if (!order.userId || String(order.userId) !== String(userId)) {
          throw new AppError('Order belongs to another operator', 403, 'ACCESS_DENIED');
        }

        ensureUploadDir();
        let filename: string;
        let photoUrl: string;

        if (req.file) {
          filename = req.file.filename;
          photoUrl = getFileUrl(filename);
        } else {
          const raw = body.dataUrl || body.base64;
          if (!raw) {
            throw new AppError('Please upload a photo or provide dataUrl/base64', 400, 'PHOTO_REQUIRED');
          }
          const { buffer, ext } = parseDataUrl(raw);
          if (buffer.length > 10 * 1024 * 1024) {
            throw new AppError('Photo exceeds 10 MB limit', 413, 'PAYLOAD_TOO_LARGE');
          }
          if (buffer.length < 8) {
            throw new AppError('Invalid image payload', 400, 'UNSUPPORTED_MEDIA_TYPE');
          }
          filename = `hhd-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
          fs.writeFileSync(path.join(getUploadDir(), filename), buffer);
          photoUrl = getFileUrl(filename);
        }

        const photo = await HHDPhoto.create({
          orderId,
          bagId,
          userId,
          photoUrl,
          photoKey: filename,
          verified: false,
        });

        await HHDBag.updateOne(
          { bagId, orderId },
          { $set: { photoUrl, status: BAG_STATUS.PHOTO_TAKEN } },
        ).catch(() => {});

        return {
          body: {
            id: String(photo._id),
            url: photoUrl,
            verified: false,
          },
          statusCode: 201,
        };
      },
    );

    res.status(result.statusCode).json(ResponseFormatter.success(result.body));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /photos/order/:orderId/bag/:bagId
 */
export async function getPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.hhdUser?.id;
    if (!userId) {
      return next(new AppError('User not authenticated', 401, 'AUTH_REQUIRED'));
    }

    const { orderId, bagId } = req.params;
    const photo = await HHDPhoto.findOne({ orderId, bagId });
    if (!photo) {
      return next(new AppError('Photo not found', 404, 'NOT_FOUND'));
    }
    if (String(photo.userId) !== String(userId)) {
      return next(new AppError('Photo belongs to another operator', 403, 'ACCESS_DENIED'));
    }

    res.status(200).json(
      ResponseFormatter.success({
        id: String(photo._id),
        url: photo.photoUrl,
        verified: photo.verified,
        orderId: photo.orderId,
        bagId: photo.bagId,
        verifiedAt: photo.verifiedAt ?? null,
        createdAt: photo.createdAt,
      }),
    );
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /photos/:photoId/verify
 * Ownership: photo.userId === caller. Returns { verified: true, id, url }.
 */
export async function verifyPhoto(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.hhdUser?.id;
    if (!userId) {
      return next(new AppError('User not authenticated', 401, 'AUTH_REQUIRED'));
    }

    const { photoId } = req.params;
    const photo = await HHDPhoto.findById(photoId);
    if (!photo) {
      return next(new AppError(`Photo not found with id of ${photoId}`, 404, 'NOT_FOUND'));
    }
    if (String(photo.userId) !== String(userId)) {
      return next(new AppError('Photo belongs to another operator', 403, 'ACCESS_DENIED'));
    }

    photo.verified = true;
    photo.verifiedAt = new Date();
    await photo.save();

    const order = await HHDOrder.findOne({ orderId: photo.orderId, userId });
    if (
      order &&
      (order.status === ORDER_STATUS.PICKING || order.status === ORDER_STATUS.BAG_SCANNED)
    ) {
      try {
        assertOrderTransition(order.status, ORDER_STATUS.PHOTO_VERIFIED);
        order.status = ORDER_STATUS.PHOTO_VERIFIED;
        await order.save();
      } catch {
        // Transition may already be past photo_verified; ignore.
      }
    }

    res.status(200).json(
      ResponseFormatter.success({
        verified: true,
        id: String(photo._id),
        url: photo.photoUrl,
      }),
    );
  } catch (error) {
    next(error);
  }
}
