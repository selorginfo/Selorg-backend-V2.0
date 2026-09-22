import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Request } from 'express';
import { uploadBufferToS3 } from '../../services/s3.service';
import { logger } from '../../utils/logger';
import { SupportAttachment } from './support-attachment.schema';
import { AppError } from '../../utils/AppError';

/** Upload support attachments to S3, with local disk fallback when S3 is unavailable. */

function getSupportBucket(): string {
  return process.env.AWS_S3_BUCKET_SUPPORT || process.env.AWS_S3_BUCKET || 'selorg-support-attachments';
}

function hasS3Credentials(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

function sanitizeFileName(name?: string): string {
  return String(name || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

function extFromMime(mime: string, originalName?: string): string {
  const fromName = path.extname(originalName || '').toLowerCase();
  if (fromName) return fromName;
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'image/png') return '.png';
  return '.jpg';
}

async function uploadLocal(buffer: Buffer, fileName: string, mimeType: string): Promise<SupportAttachment> {
  const uploadsRoot = path.join(process.cwd(), 'uploads', 'support');
  fs.mkdirSync(uploadsRoot, { recursive: true });
  const diskName = `${Date.now()}-${uuidv4().slice(0, 8)}-${sanitizeFileName(fileName)}`;
  const diskPath = path.join(uploadsRoot, diskName);
  fs.writeFileSync(diskPath, buffer);
  const base = process.env.SUPPORT_ATTACHMENT_PUBLIC_BASE || process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3333}`;
  const url = `${String(base).replace(/\/$/, '')}/uploads/support/${diskName}`;
  return { url, fileName, mimeType, sizeBytes: buffer.length };
}

export interface SupportUploadMeta {
  userId?: string;
  ticketId?: string;
}

export async function uploadSupportFile(file: Express.Multer.File, meta: SupportUploadMeta = {}): Promise<SupportAttachment> {
  if (!file?.buffer) {
    throw AppError.badRequest('No file provided');
  }

  const mimeType = file.mimetype || 'application/octet-stream';
  const original = sanitizeFileName(file.originalname || 'attachment');
  const ext = extFromMime(mimeType, original);
  const fileName = `${uuidv4()}${ext}`;
  const folder = `support/${meta.userId || 'anonymous'}/${meta.ticketId || 'new'}`;

  if (hasS3Credentials()) {
    try {
      const url = await uploadBufferToS3(file.buffer, getSupportBucket(), folder, fileName, mimeType);
      return { url, fileName: original, mimeType, sizeBytes: file.size || file.buffer.length };
    } catch (err) {
      logger.warn('[SupportAttachment] S3 upload failed, falling back to local', { error: (err as Error).message });
    }
  }

  return uploadLocal(file.buffer, original, mimeType);
}

/** Collect files from multer fields `attachment` and `attachments`. */
export function collectUploadedFiles(req: Request): Express.Multer.File[] {
  const files: Express.Multer.File[] = [];
  const reqFiles = req.files as Record<string, Express.Multer.File[]> | undefined;
  if (Array.isArray(reqFiles?.attachment)) files.push(...reqFiles.attachment);
  if (Array.isArray(reqFiles?.attachments)) files.push(...reqFiles.attachments);
  if (req.file) files.push(req.file);
  return files;
}

export async function processSupportUploads(req: Request, meta: SupportUploadMeta = {}): Promise<SupportAttachment[]> {
  const files = collectUploadedFiles(req);
  if (files.length === 0) return [];
  const attachments: SupportAttachment[] = [];
  for (const file of files) {
    attachments.push(await uploadSupportFile(file, meta));
  }
  return attachments;
}
