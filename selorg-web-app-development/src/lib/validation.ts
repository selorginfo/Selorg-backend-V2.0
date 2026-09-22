export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Strips non-digits and takes the last 10 — matches source `_digits()` behavior. */
export function last10Digits(value: string): string {
  return onlyDigits(value).slice(-10);
}

export function isValidPhone10(value: string): boolean {
  return onlyDigits(value).length === 10;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

const VPA_RE = /^[\w.-]{2,}@[a-z]{2,}$/i;
export function isValidVpa(value: string): boolean {
  return VPA_RE.test(value);
}

export function isValidCardNumber(value: string): boolean {
  return onlyDigits(value).length >= 16;
}

const EXPIRY_RE = /^\d{2}\/\d{2}$/;
export function isValidExpiry(value: string): boolean {
  return EXPIRY_RE.test(value);
}

export function isValidCvv(value: string): boolean {
  return onlyDigits(value).length >= 3;
}

export function isValidAuthOtp(value: string): boolean {
  return onlyDigits(value).length >= 4;
}
