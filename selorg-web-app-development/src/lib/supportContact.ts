/** Default Selorg customer support contacts (overridden by bootstrap `appConfig.support`). */

export interface SupportContactConfig {
  phone: string;
  email: string;
  whatsapp: string;
  workingHours: string;
  responseTime: string;
  liveChatEnabled: boolean;
}

export const DEFAULT_SUPPORT_CONTACT: SupportContactConfig = {
  phone: "+919444183378",
  email: "support@selorg.com",
  whatsapp: "+919444183378",
  workingHours: "Mon–Sat, 9:00 AM – 8:00 PM IST",
  responseTime: "Typically within 2–4 hours on business days",
  liveChatEnabled: true,
};

/** Digits-only for tel:/wa.me links. */
export function digitsOnlyPhone(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

export function formatDisplayPhone(phone: string): string {
  const d = digitsOnlyPhone(phone);
  if (d.length === 12 && d.startsWith("91")) {
    return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  }
  return phone || DEFAULT_SUPPORT_CONTACT.phone;
}

export function telHref(phone: string): string {
  const d = digitsOnlyPhone(phone);
  return d ? `tel:+${d}` : `tel:${DEFAULT_SUPPORT_CONTACT.phone}`;
}

export function mailtoHref(email: string, subject = "Selorg Support"): string {
  const addr = email || DEFAULT_SUPPORT_CONTACT.email;
  return `mailto:${addr}?subject=${encodeURIComponent(subject)}`;
}

export function whatsappHref(phone: string, message = "Hi Selorg Support, I need help with my order."): string {
  const d = digitsOnlyPhone(phone || DEFAULT_SUPPORT_CONTACT.whatsapp);
  return `https://wa.me/${d}?text=${encodeURIComponent(message)}`;
}
