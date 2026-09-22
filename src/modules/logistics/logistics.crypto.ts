import crypto from 'crypto';

const IV_LEN = 12;
const TAG_LEN = 16;

/**
 * Derives a 32-byte AES-256 key from the given secret string using SHA-256.
 */
function deriveKey(secret: string): Buffer | null {
  if (!secret || typeof secret !== 'string') return null;
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Encrypts a plain-object as AES-256-GCM and returns a base-64 string.
 * Layout: [IV (12 bytes)][AuthTag (16 bytes)][Ciphertext]
 */
export function encryptJson(obj: unknown, secret: string): string {
  const key = deriveKey(secret);
  if (!key) return '';
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(obj ?? {});
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * Decrypts a base-64 AES-256-GCM string back to a plain object.
 * Returns null on any failure (bad key, tampered ciphertext, etc.).
 */
export function decryptJson(b64: string, secret: string): unknown | null {
  const key = deriveKey(secret);
  if (!key || !b64) return null;
  try {
    const buf = Buffer.from(b64, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Convenience wrapper: encrypts `obj` using the env key.
 * Returns an empty string when no key is configured.
 */
export function encryptCredentialsIfKeyPresent(obj: unknown): string {
  const key = process.env.LOGISTICS_CRED_ENCRYPTION_KEY;
  if (!key || !obj) return '';
  return encryptJson(obj, key);
}

export { deriveKey };
