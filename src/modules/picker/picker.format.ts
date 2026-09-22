/**
 * Display-string helpers for the rider app contract. The app renders several
 * pre-formatted values (`"₹6,480"`, `"6:00 AM – 10:00 AM"`, `"Today, 11:42 AM"`),
 * so they are produced here once rather than in each service.
 *
 * All times are rendered in the hub timezone (IST) because shift windows, the
 * "today" dashboard and the deposit deadline are all local-day concepts.
 */

export const HUB_TIMEZONE = process.env.PICKER_HUB_TIMEZONE || 'Asia/Kolkata';
/** IST is UTC+5:30 and has no DST, so a fixed offset is exact. */
const HUB_OFFSET_MINUTES = parseInt(process.env.PICKER_HUB_UTC_OFFSET_MINUTES || '330', 10);

export function rupees(amount: number | null | undefined): string {
  const value = Math.round(Number(amount) || 0);
  return `₹${value.toLocaleString('en-IN')}`;
}

export function signedRupees(amount: number, direction: 'in' | 'out'): string {
  return `${direction === 'in' ? '+' : '−'}${rupees(amount)}`;
}

export function distanceDisplay(km: number | null | undefined): string | null {
  if (km == null || Number.isNaN(Number(km))) return null;
  return `${(Math.round(Number(km) * 10) / 10).toFixed(1)} km`;
}

export function durationDisplay(minutes: number | null | undefined): string | null {
  if (minutes == null || Number.isNaN(Number(minutes))) return null;
  const total = Math.max(0, Math.round(Number(minutes)));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function hoursDisplay(hours: number): string {
  return `${(Math.round(hours * 10) / 10).toFixed(1)}h`;
}

/** Shifts the instant so that its UTC getters read as hub-local values. */
function toHubTime(date: Date): Date {
  return new Date(date.getTime() + HUB_OFFSET_MINUTES * 60000);
}

/** Midnight of `date`'s hub-local day, expressed as a UTC instant. */
export function hubDayStart(date: Date = new Date()): Date {
  const shifted = toHubTime(date);
  const midnightShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(midnightShifted - HUB_OFFSET_MINUTES * 60000);
}

export function hubDayEnd(date: Date = new Date()): Date {
  return new Date(hubDayStart(date).getTime() + 86400000 - 1);
}

/** `YYYY-MM-DD` in the hub timezone. */
export function hubDateKey(date: Date = new Date()): string {
  const shifted = toHubTime(date);
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${m}-${d}`;
}

/** Parses `YYYY-MM-DD` as hub-local midnight. Returns null when malformed. */
export function parseHubDate(value?: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const utcMidnight = Date.UTC(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(utcMidnight)) return null;
  return new Date(utcMidnight - HUB_OFFSET_MINUTES * 60000);
}

const WEEKDAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WEEKDAYS_TITLE = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `"MON"` — the weekday chip on the Earnings daily breakdown. */
export function weekdayShort(date: Date): string {
  return WEEKDAYS_SHORT[toHubTime(date).getUTCDay()];
}

/** `"Mon, 12 Feb"`. */
export function dateDisplay(date: Date): string {
  const s = toHubTime(date);
  return `${WEEKDAYS_TITLE[s.getUTCDay()]}, ${s.getUTCDate()} ${MONTHS_SHORT[s.getUTCMonth()]}`;
}

/** `"1 Jan 2026"`. */
export function longDateDisplay(date: Date): string {
  const s = toHubTime(date);
  return `${s.getUTCDate()} ${MONTHS_SHORT[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
}

/** `"11:42 AM"` from a Date. */
export function timeOfDayDisplay(date: Date): string {
  const s = toHubTime(date);
  return formatClock(s.getUTCHours(), s.getUTCMinutes());
}

/** `"6:00 AM"` from `"06:00"`. Returns the input unchanged when unparseable. */
export function formatHhMm(hhmm?: string | null): string | null {
  if (!hhmm) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(String(hhmm).trim());
  if (!match) return String(hhmm).trim() || null;
  return formatClock(Number(match[1]), Number(match[2]));
}

function formatClock(hours24: number, minutes: number): string {
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const h = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${h}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** `"6:00 AM – 10:00 AM"` — exactly what `SlotCard` renders. */
export function timeRangeDisplay(startTime?: string | null, endTime?: string | null, fallback?: string | null): string {
  const from = formatHhMm(startTime);
  const to = formatHhMm(endTime);
  if (from && to) return `${from} – ${to}`;
  return from || to || fallback || '';
}

/** `"Today, 11:42 AM"` / `"Yesterday, 6:20 PM"` / `"Mon, 12 Feb, 6:20 PM"`. */
export function relativeDateTimeDisplay(date: Date, now: Date = new Date()): string {
  const dayKey = hubDateKey(date);
  const todayKey = hubDateKey(now);
  const yesterdayKey = hubDateKey(new Date(now.getTime() - 86400000));
  const clock = timeOfDayDisplay(date);
  if (dayKey === todayKey) return `Today, ${clock}`;
  if (dayKey === yesterdayKey) return `Yesterday, ${clock}`;
  return `${dateDisplay(date)}, ${clock}`;
}

/** `"in 2 days"` / `"tomorrow"` / `"today"`. */
export function relativeFutureDisplay(target: Date, now: Date = new Date()): string {
  const days = Math.round((hubDayStart(target).getTime() - hubDayStart(now).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** Monday-anchored week containing `date`, as hub-local bounds. */
export function hubWeekBounds(date: Date = new Date()): { from: Date; to: Date } {
  const start = hubDayStart(date);
  const weekday = toHubTime(start).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const from = new Date(start.getTime() - daysSinceMonday * 86400000);
  return { from, to: new Date(from.getTime() + 7 * 86400000 - 1) };
}

export function hubMonthBounds(date: Date = new Date()): { from: Date; to: Date } {
  const s = toHubTime(date);
  const firstUtc = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1);
  const nextUtc = Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1);
  return {
    from: new Date(firstUtc - HUB_OFFSET_MINUTES * 60000),
    to: new Date(nextUtc - HUB_OFFSET_MINUTES * 60000 - 1),
  };
}

/** Masks a 10-digit Indian mobile to `"+91 98XXX XX210"`. */
export function maskPhone(phone?: string | null): string | null {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return null;
  return `+91 ${digits.slice(0, 2)}XXX XX${digits.slice(7)}`;
}

/** Dialable E.164 number for assigned riders (Call / Chat). */
export function dialablePhone(phone?: string | null): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

/** Great-circle distance in km. Same formula as `dispatch.service`, without its address-hash fallback. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function hasCoords(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    !Number.isNaN(lat) && !Number.isNaN(lng) && !(lat === 0 && lng === 0)
  );
}

/** Formats a delivery address subdocument into the single line the app renders. */
export function formatAddressLine(address?: {
  line1?: string; line2?: string; city?: string; state?: string; pincode?: string; landmark?: string;
} | null): string {
  if (!address) return '';
  return [address.line1, address.line2, address.landmark, address.city, address.pincode]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ');
}

/** `"#SG-2048"` / `"2048"` from an order number of any shape. */
export function orderDisplayNumbers(orderNumber?: string | null, fallbackId?: string): { num: string; raw: string } {
  const source = String(orderNumber || '').trim() || String(fallbackId || '');
  const digits = source.replace(/\D/g, '');
  const raw = digits || source.slice(-6);
  const num = source.startsWith('#') ? source : `#${source}`;
  return { num, raw };
}

/** `"March 2026"`. */
export function monthLabel(date: Date = new Date()): string {
  const s = toHubTime(date);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
}

/** `"5 Apr 2026"`. */
export function payDateDisplay(date: Date): string {
  return longDateDisplay(date);
}

/** `"9h 02m"` from total minutes. */
export function hoursMinutesDisplay(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(Number(minutes))) return '—';
  const total = Math.max(0, Math.round(Number(minutes)));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** `"HH:MM:SS"` elapsed clock. */
export function elapsedClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** `"2h ago"` / `"Yesterday"` / `"3 days ago"`. */
export function relativeTimeAgo(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return dateDisplay(date);
}

/** Display phone `"+91 98765 43210"`. */
export function formatPhoneDisplay(phone?: string | null): string {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return String(phone || '');
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/** `"MMM YYYY"` from a Date — `"Jan 2026"`. */
export function memberSinceDisplay(date: Date): string {
  const s = toHubTime(date);
  return `${MONTHS_SHORT[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
}

export function parseYearMonth(value?: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(String(value).trim());
  if (!match) return null;
  const utcMidnight = Date.UTC(Number(match[1]), Number(match[2]) - 1, 1);
  if (Number.isNaN(utcMidnight)) return null;
  return new Date(utcMidnight - HUB_OFFSET_MINUTES * 60000);
}

export function maskAccountNumber(accountNumber?: string | null): string {
  const digits = String(accountNumber || '').replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `••••••••${digits.slice(-4)}`;
}

export function bankLabel(bankName?: string | null, accountNumber?: string | null): string | null {
  const digits = String(accountNumber || '').replace(/\D/g, '');
  if (!digits) return bankName || null;
  const short = (bankName || 'Bank').split(' ')[0];
  return `${short} ••${digits.slice(-4)}`;
}

export function maskDocumentNumber(number?: string | null): string | null {
  const raw = String(number || '').replace(/\s/g, '');
  if (!raw) return null;
  if (raw.length <= 4) return `•••• ${raw}`;
  return `•••• •••• ${raw.slice(-4)}`;
}

export function titleCase(value?: string | null): string | null {
  if (!value) return null;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export const VEHICLE_LABELS: Record<string, string> = {
  bike: 'Motorbike',
  scooter: 'Scooter',
  ev: 'EV Scooter',
  cycle: 'Bicycle',
  auto: 'Auto',
  van: 'Van',
  ev_auto: 'EV Auto',
  motorcycle: 'Motorbike',
};
