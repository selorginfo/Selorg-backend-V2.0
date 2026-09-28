import crypto from 'crypto';

const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(secret: string): Buffer | null {
  if (!secret || typeof secret !== 'string') return null;
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * AES-256-GCM encrypt a JSON-serializable value.
 * Layout (base64): [IV 12][AuthTag 16][Ciphertext]
 */
export function encryptPayload(obj: unknown, secret: string): string {
  const key = deriveKey(secret);
  if (!key) throw new Error('Encryption secret is not configured');
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(obj ?? {});
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

/**
 * Decrypt a base64url AES-256-GCM payload. Returns null if tampered or invalid.
 */
export function decryptPayload<T = unknown>(token: string, secret: string): T | null {
  const key = deriveKey(secret);
  if (!key || !token) return null;
  try {
    const buf = Buffer.from(token, 'base64url');
    if (buf.length <= IV_LEN + TAG_LEN) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
