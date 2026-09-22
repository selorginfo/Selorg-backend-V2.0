import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadBufferToS3 } from '../../services/s3.service';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/AppError';

/**
 * Stores picker-uploaded files (KYC documents, proof-of-delivery photos) on S3,
 * falling back to local disk when credentials are absent — mirroring
 * `support-attachment.service` so both upload paths behave identically.
 */

export interface StoredFile {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

function getBucket(): string {
  return process.env.AWS_S3_BUCKET_PICKER_DOCUMENTS || process.env.AWS_S3_BUCKET || 'selorg-picker-documents';
}

function hasS3Credentials(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

function sanitizeFileName(name?: string): string {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function extFromMime(mime: string, originalName?: string): string {
  const fromName = path.extname(originalName || '').toLowerCase();
  if (fromName) return fromName;
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'image/png') return '.png';
  return '.jpg';
}

function publicBase(): string {
  const base = process.env.PICKER_UPLOAD_PUBLIC_BASE || process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3333}`;
  return String(base).replace(/\/$/, '');
}

function storeLocally(buffer: Buffer, folder: string, diskName: string, originalName: string, mimeType: string): StoredFile {
  const uploadsRoot = path.join(process.cwd(), 'uploads', folder);
  fs.mkdirSync(uploadsRoot, { recursive: true });
  fs.writeFileSync(path.join(uploadsRoot, diskName), buffer);
  return {
    url: `${publicBase()}/uploads/${folder}/${diskName}`,
    fileName: originalName,
    mimeType,
    sizeBytes: buffer.length,
  };
}

async function store(file: Express.Multer.File, folder: string, s3Folder: string): Promise<StoredFile> {
  if (!file?.buffer) throw AppError.badRequest('No file provided');

  const mimeType = file.mimetype || 'application/octet-stream';
  const originalName = sanitizeFileName(file.originalname || 'upload');
  const diskName = `${Date.now()}-${uuidv4().slice(0, 8)}${extFromMime(mimeType, originalName)}`;

  if (hasS3Credentials()) {
    try {
      const url = await uploadBufferToS3(file.buffer, getBucket(), s3Folder, diskName, mimeType);
      return { url, fileName: originalName, mimeType, sizeBytes: file.size || file.buffer.length };
    } catch (err) {
      logger.warn('[PickerUpload] S3 upload failed, falling back to local disk', { error: (err as Error).message });
    }
  }

  return storeLocally(file.buffer, folder, diskName, originalName, mimeType);
}

export function storeKycDocument(file: Express.Multer.File, pickerId: string, type: string): Promise<StoredFile> {
  return store(file, 'picker-documents', `documents/${pickerId}/${type}`);
}

export function storeProofOfDeliveryPhoto(file: Express.Multer.File, pickerId: string): Promise<StoredFile> {
  return store(file, 'picker-pod', `pod/${pickerId}`);
}

const PURPOSE_FOLDERS: Record<string, string> = {
  kyc: 'picker-documents',
  face: 'picker-face',
  avatar: 'picker-avatars',
  device: 'picker-devices',
};

export function storePickerUpload(
  file: Express.Multer.File,
  pickerId: string,
  purpose: 'kyc' | 'face' | 'avatar' | 'device',
): Promise<StoredFile> {
  const folder = PURPOSE_FOLDERS[purpose] || 'picker-uploads';
  return store(file, folder, `${purpose}/${pickerId}`);
}
