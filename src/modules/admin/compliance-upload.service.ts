import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadBufferToS3, deleteObjectFromS3ByUrl } from '../../services/s3.service';
import { logger } from '../../utils/logger';

export function getComplianceBucket(): string {
  return process.env.AWS_S3_BUCKET_COMPLIANCE || process.env.AWS_S3_BUCKET || 'selorg-compliance-documents';
}

function hasS3Credentials(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

function sanitizeFileName(name?: string): string {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export function formatFileSize(bytes = 0): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

async function uploadLocal(buffer: Buffer, originalName: string): Promise<string> {
  const uploadsRoot = path.join(process.cwd(), 'uploads', 'compliance');
  fs.mkdirSync(uploadsRoot, { recursive: true });
  const diskName = `compliance-${Date.now()}-${uuidv4().slice(0, 8)}-${sanitizeFileName(originalName)}`;
  fs.writeFileSync(path.join(uploadsRoot, diskName), buffer);
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3333}`;
  return `${String(base).replace(/\/$/, '')}/uploads/compliance/${diskName}`;
}

/** Uploads a compliance document file to S3, falling back to local disk when S3 credentials are unset. */
export async function uploadComplianceFile(file: Express.Multer.File): Promise<{ url: string; size: string }> {
  const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
  const fileName = `compliance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

  if (hasS3Credentials()) {
    try {
      const url = await uploadBufferToS3(file.buffer, getComplianceBucket(), 'compliance', fileName, file.mimetype || 'application/octet-stream');
      return { url, size: formatFileSize(file.size || 0) };
    } catch (err) {
      logger.warn('[Compliance] S3 upload failed, falling back to local', { error: (err as Error).message });
    }
  }

  const url = await uploadLocal(file.buffer, file.originalname || fileName);
  return { url, size: formatFileSize(file.size || 0) };
}

export async function deleteComplianceFile(url?: string | null): Promise<void> {
  if (!url) return;
  try {
    await deleteObjectFromS3ByUrl(url, getComplianceBucket());
  } catch (err) {
    logger.warn('[Compliance] failed to delete S3 object', { url, error: (err as Error).message });
  }
}
