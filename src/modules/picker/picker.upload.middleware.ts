import multer from 'multer';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import { pickerConfig } from './picker.config';

/**
 * Multipart handling for the two picker upload surfaces: KYC documents
 * (images or PDF) and proof-of-delivery photos (images only).
 *
 * Files are buffered in memory and handed to `picker.upload.service`, which
 * pushes them to S3 with a local-disk fallback — the same shape as the support
 * attachment pipeline, rather than HHD's direct-to-disk multer storage.
 */

const KYC_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);
const KYC_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.pdf']);
const PHOTO_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

function makeFilter(mimes: Set<string>, exts: Set<string>, allowedLabel: string) {
  return (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    if (mimes.has(mime) || (!mime && exts.has(ext))) {
      cb(null, true);
      return;
    }
    const err = new Error(`Unsupported media type. Allowed: ${allowedLabel}`) as Error & { code?: string };
    err.code = 'UNSUPPORTED_MEDIA_TYPE';
    cb(err);
  };
}

const kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: pickerConfig.maxUploadBytes, files: 1 },
  fileFilter: makeFilter(KYC_MIME, KYC_EXT, 'JPG, PNG, WEBP, HEIC, PDF'),
});

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: pickerConfig.maxUploadBytes, files: 1 },
  fileFilter: makeFilter(PHOTO_MIME, PHOTO_EXT, 'JPG, PNG, WEBP, HEIC'),
});

/** KYC document upload — form field `file`. */
export const pickerDocumentUpload = kycUpload.single('file');

/** Proof-of-delivery upload — form field `photo`. */
export const pickerPhotoUpload = photoUpload.single('photo');

/** Maps multer rejections onto the contract's 413 / 415 / 400 responses. */
export function pickerUploadErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (!err) {
    next();
    return;
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = Math.floor(pickerConfig.maxUploadBytes / (1024 * 1024));
      res.status(413).json(
        ResponseFormatter.error(`File too large. Maximum size is ${mb} MB.`, 413, null, { appCode: 'FILE_TOO_LARGE' }),
      );
      return;
    }
    res.status(400).json(ResponseFormatter.error(err.message, 400, null, { appCode: 'VALIDATION_ERROR' }));
    return;
  }
  const typed = err as { code?: string; message?: string };
  if (typed.code === 'UNSUPPORTED_MEDIA_TYPE') {
    res.status(415).json(
      ResponseFormatter.error(typed.message || 'Unsupported media type', 415, null, { appCode: 'UNSUPPORTED_MEDIA_TYPE' }),
    );
    return;
  }
  next(err);
}
