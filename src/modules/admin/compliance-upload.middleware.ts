import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';

const MAX_BYTES = Number(process.env.MAX_UPLOAD_SIZE) || 10 * 1024 * 1024;
const ALLOWED_EXT = /\.(pdf|doc|docx|jpg|jpeg|png|gif|webp)$/i;

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
  if (ALLOWED_EXT.test(file.originalname || '')) {
    cb(null, true);
    return;
  }
  cb(new Error('Invalid file type. Allowed: pdf, doc, docx, jpg, jpeg, png, gif, webp'));
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES }, fileFilter });

export const complianceDocumentUpload = upload.single('file');

export function complianceUploadErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (!err) {
    next();
    return;
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, error: `File too large. Maximum size is ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` });
      return;
    }
    res.status(400).json({ success: false, error: err.message });
    return;
  }
  res.status(400).json({ success: false, error: (err as Error).message || 'Invalid file' });
}
