const GENERIC_NAMES = new Set(['customer', 'unknown', 'user', '']);

/** Synthetic emails assigned historically to phone-only OTP users. */
const PLACEHOLDER_EMAIL_RE = /^no-email-.*@no-email\.selorg$/i;

export function formatPhoneForDisplay(phone?: string | null): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length > 10) return `+${digits}`;
  return String(phone || '').trim();
}

export function isPlaceholderCustomerEmail(email?: string | null): boolean {
  if (email == null) return true;
  const trimmed = String(email).trim();
  if (!trimmed) return true;
  if (PLACEHOLDER_EMAIL_RE.test(trimmed)) return true;
  if (trimmed.includes('no-email')) return true;
  if (trimmed.startsWith('customer-') && trimmed.endsWith('@selorg.com')) return true;
  return false;
}

/** Returns a real customer email, or empty string when missing/placeholder. Never invents a fake address. */
export function sanitizeCustomerEmail(email?: string | null): string {
  if (isPlaceholderCustomerEmail(email)) return '';
  return String(email).trim();
}

export interface CustomerIdentityInput {
  user?: { name?: string; savedCheckoutContact?: { fullName?: string; phone?: string }; phoneNumber?: string };
  ticket?: { customerName?: string; customerPhone?: string; customerId?: string };
}

export function isGenericCustomerName(name?: string | null): boolean {
  return !name || GENERIC_NAMES.has(String(name).trim().toLowerCase());
}

/** Resolves how a customer should appear in support/live-chat UIs: real name, then formatted phone, then short id. */
export function resolveCustomerIdentity({ user, ticket }: CustomerIdentityInput = {}) {
  const rawName =
    (user?.name && String(user.name).trim()) ||
    (user?.savedCheckoutContact?.fullName && String(user.savedCheckoutContact.fullName).trim()) ||
    (ticket?.customerName && String(ticket.customerName).trim()) ||
    '';

  const phone =
    (user?.phoneNumber && String(user.phoneNumber).trim()) ||
    (user?.savedCheckoutContact?.phone && String(user.savedCheckoutContact.phone).trim()) ||
    (ticket?.customerPhone && String(ticket.customerPhone).trim()) ||
    '';

  const isGeneric = isGenericCustomerName(rawName);

  let displayName = !isGeneric ? rawName : '';
  if (!displayName && phone) displayName = formatPhoneForDisplay(phone);
  if (!displayName && ticket?.customerId) displayName = `Customer ···${String(ticket.customerId).slice(-6)}`;
  if (!displayName) displayName = 'Customer';

  const customerName = !isGeneric ? rawName : displayName;

  return { customerName, displayName, customerPhone: phone };
}
