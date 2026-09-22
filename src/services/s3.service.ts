import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

// Falls back to the default AWS credential provider chain (IAM role, shared config, etc.)
// when explicit keys aren't set, instead of passing `undefined` fields the SDK's types reject.
const explicitCredentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
    : undefined;

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(explicitCredentials ? { credentials: explicitCredentials } : {}),
});

function bucketUrl(bucket: string, key: string): string {
  return `https://${bucket}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;
}

/** Uploads a base64-encoded image (with or without a `data:...;base64,` prefix) to S3. Returns the public URL. */
export async function uploadBase64ImageToS3(base64Data: string, bucket: string, folder: string, fileName?: string): Promise<string> {
  try {
    let base64Image = base64Data;
    let contentType = 'image/jpeg';

    if (base64Data.startsWith('data:')) {
      const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        contentType = matches[1];
        base64Image = matches[2];
      }
    }

    const imageBuffer = Buffer.from(base64Image, 'base64');
    const fileExtension = contentType.split('/')[1] || 'jpg';
    const finalFileName = fileName || `${randomUUID()}.${fileExtension}`;
    const key = folder ? `${folder}/${finalFileName}` : finalFileName;

    await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: imageBuffer, ContentType: contentType, ACL: 'public-read' }));

    return bucketUrl(bucket, key);
  } catch (error) {
    console.error('[S3 Upload] Error uploading image:', error);
    throw new Error('Failed to upload image to S3');
  }
}

export async function uploadBufferToS3(buffer: Buffer, bucket: string, folder: string, fileName: string, contentType: string): Promise<string> {
  try {
    const key = folder ? `${folder}/${fileName}` : fileName;
    await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType, ACL: 'public-read' }));
    return bucketUrl(bucket, key);
  } catch (error) {
    console.error('[S3 Upload] Error uploading buffer:', error);
    throw new Error('Failed to upload file to S3');
  }
}

export function uploadPickerProfileImage(userId: string, base64Data: string) {
  return uploadBase64ImageToS3(base64Data, process.env.AWS_S3_BUCKET_PICKER_PROFILE || 'selorg-picker-profile', `profiles/${userId}`);
}

export function uploadRiderProfileImage(userId: string, base64Data: string) {
  return uploadBase64ImageToS3(base64Data, process.env.AWS_S3_BUCKET_RIDER_PROFILE || 'selorg-rider-profile', `profiles/${userId}`);
}

export function uploadProductImage(base64Data: string) {
  return uploadBase64ImageToS3(base64Data, process.env.AWS_S3_BUCKET_PRODUCT_IMAGES || 'selorg-product-images', 'products');
}

export function getFinanceDocumentsBucket(): string {
  return process.env.AWS_S3_BUCKET_FINANCE_DOCUMENTS || process.env.AWS_S3_BUCKET_COMPLIANCE || 'selorg-finance-documents';
}

export function uploadVendorPaymentDocument(buffer: Buffer, hubKey: string | undefined, paymentId: string, fileName: string, contentType: string) {
  return uploadBufferToS3(buffer, getFinanceDocumentsBucket(), `vendor-payments/${hubKey || 'default'}/${paymentId}`, fileName, contentType);
}

export function uploadCustomerAvatarImage(userId: string, base64Data: string) {
  const bucket = process.env.AWS_S3_BUCKET_CUSTOMER_AVATARS || process.env.AWS_S3_BUCKET_PRODUCT_IMAGES || 'selorg-product-images';
  return uploadBase64ImageToS3(base64Data, bucket, `customer-avatars/${userId}`);
}

export function uploadCmsIllustrationImage(base64Data: string, folder = 'cms-images') {
  return uploadBase64ImageToS3(base64Data, process.env.AWS_S3_BUCKET_PRODUCT_IMAGES || 'selorg-product-images', folder);
}

/** Best-effort delete by public bucket URL — silently no-ops if the URL isn't a recognized S3 URL for `bucket`. */
export async function deleteObjectFromS3ByUrl(url: string | null | undefined, bucket: string): Promise<void> {
  if (!url) return;
  const marker = '.amazonaws.com/';
  const idx = url.indexOf(marker);
  if (!url.includes(`https://${bucket}.s3`) || idx === -1) return;
  const key = url.slice(idx + marker.length);
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
