import multer from 'multer';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

/** Multer middleware for Help & Support attachments. Max 5 MB; JPG, JPEG, PNG, PDF only. */

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  if (ALLOWED_MIME.has(mime) || ALLOWED_EXT.has(ext)) {
    cb(null, true);
    return;
  }
  const err = new Error('Invalid file type. Allowed: JPG, JPEG, PNG, PDF') as Error & { status?: number; code?: string };
  err.status = 400;
  err.code = 'INVALID_FILE_TYPE';
  cb(err);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 5 },
  fileFilter,
});

/** Accept `attachment` (single) and/or `attachments` (array). */
export const supportAttachmentUpload = upload.fields([
  { name: 'attachment', maxCount: 1 },
  { name: 'attachments', maxCount: 5 },
]);

export function supportUploadErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (!err) {
    next();
    return;
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, error: 'File too large. Maximum size is 5 MB.' });
      return;
    }
    res.status(400).json({ success: false, error: err.message });
    return;
  }
  const typed = err as { code?: string; status?: number; message?: string };
  if (typed.code === 'INVALID_FILE_TYPE' || typed.status === 400) {
    res.status(400).json({ success: false, error: typed.message });
    return;
  }
  next(err);
}
