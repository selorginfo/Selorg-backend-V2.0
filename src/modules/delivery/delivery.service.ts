import { DarkStore } from '../store/dark-store.model';
import { getPublishedValue } from '../../services/platformConfig.service';
import { computeDeliveryFee, getDeliveryPricingConfig } from '../../services/deliveryPricing.service';

function num(raw: unknown, fallback: number): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getEtaConfig() {
  const [avgSpeedKmh, bufferMin, promiseLowerDelta, promiseUpperDelta, minLowerBound] =
    await Promise.all([
      getPublishedValue<number>('delivery.eta.avg_speed_kmh', num(process.env.DELIVERY_ETA_AVG_SPEED_KMH, 30)),
      getPublishedValue<number>('delivery.eta.buffer_minutes', num(process.env.DELIVERY_ETA_BUFFER_MINUTES, 2)),
      getPublishedValue<number>('delivery.eta.promise_lower_delta', num(process.env.DELIVERY_ETA_PROMISE_LOWER_DELTA, 2)),
      getPublishedValue<number>('delivery.eta.promise_upper_delta', num(process.env.DELIVERY_ETA_PROMISE_UPPER_DELTA, 3)),
      getPublishedValue<number>('delivery.eta.min_lower_bound_mins', num(process.env.DELIVERY_ETA_MIN_LOWER_BOUND_MINS, 8)),
    ]);
  return {
    etaAvgSpeedKmh: num(avgSpeedKmh, 30),
    etaBufferMin: num(bufferMin, 2),
    etaPromiseLowerDelta: num(promiseLowerDelta, 2),
    etaPromiseUpperDelta: num(promiseUpperDelta, 3),
    etaMinLowerBound: num(minLowerBound, 8),
  };
}

export async function calculateDeliveryEstimate(
  storeId: string,
  latitude: number,
  longitude: number,
  cartItemCount: number,
) {
  const store = await DarkStore.findById(storeId).lean();
  if (!store) throw { status: 404, message: 'Store not found' };

  const cfg = await getEtaConfig();
  const distanceKm = getDistanceKm(latitude, longitude, store.location.coordinates[1], store.location.coordinates[0]);

  const pickPackTime = store.avgPickPackTime || 5;
  const itemBonus = Math.min(3, Math.floor((cartItemCount || 1) / 5));
  const avgSpeedKmPerMin = cfg.etaAvgSpeedKmh / 60;
  const travelTime = Math.ceil(distanceKm / avgSpeedKmPerMin);

  const totalMinutes = pickPackTime + itemBonus + travelTime + cfg.etaBufferMin;
  const lowerBound = Math.max(cfg.etaMinLowerBound, totalMinutes - cfg.etaPromiseLowerDelta);
  const upperBound = totalMinutes + cfg.etaPromiseUpperDelta;

  return {
    estimatedMinutes: totalMinutes,
    promiseText: `${lowerBound}-${upperBound} mins`,
    breakdown: {
      pickPackTime,
      travelTime,
      bufferTime: cfg.etaBufferMin,
      itemBonus,
      distanceKm: Math.round(distanceKm * 10) / 10,
    },
  };
}

export async function calculateDeliveryFee(
  storeId: string,
  latitude: number,
  longitude: number,
  orderTotal: number,
) {
  const store = (await DarkStore.findById(storeId).lean()) as any;
  if (!store) throw { status: 404, message: 'Store not found' };

  const [cfg, feeConfig] = await Promise.all([
    Promise.all([
      getPublishedValue<number>('delivery.fee.base', num(process.env.DELIVERY_FEE_BASE, 20)),
      getPublishedValue<number>('delivery.fee.distance_per_km', num(process.env.DELIVERY_FEE_PER_KM, 1)),
      getPublishedValue<number>('delivery.fee.min', num(process.env.DELIVERY_FEE_MIN, 20)),
      getPublishedValue<number>('delivery.fee.max', num(process.env.DELIVERY_FEE_MAX, 80)),
      getPublishedValue<number>('delivery.fee.platform_small_order_threshold', num(process.env.DELIVERY_PLATFORM_SMALL_ORDER_THRESHOLD, 99)),
      getPublishedValue<number>('delivery.fee.platform_fee_small_order', num(process.env.DELIVERY_PLATFORM_FEE_SMALL_ORDER, 5)),
    ]),
    getDeliveryPricingConfig(),
  ]);

  const [feeBase, feePerKm, feeMin, feeMax, platformSmallOrderThreshold, platformFeeSmallOrder] = cfg.map((v, i) =>
    num(v, [20, 1, 20, 80, 99, 5][i]),
  );

  const distanceKm = getDistanceKm(latitude, longitude, store.location.coordinates[1], store.location.coordinates[0]);
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  let surgeMult = 1.0;
  if (hour >= 12 && hour <= 14) surgeMult = 1.5;
  if (hour >= 19 && hour <= 21) surgeMult = 1.8;
  if (hour >= 22 || hour < 6) surgeMult = 1.3;
  if ((dayOfWeek === 5 || dayOfWeek === 6) && hour >= 18 && hour <= 22) {
    surgeMult = Math.max(surgeMult, 2.0);
  }
  const storeLoadMultiplier = store.currentOrderCount && store.currentOrderCount > 50 ? 1.2 : 1.0;

  // Distance/surge model — modelled for future dynamic pricing but NOT what an
  // order is billed with. Kept in `breakdown` only.
  const indicativeDynamicFee = Math.max(
    feeMin,
    Math.min(feeMax, Math.round((feeBase + distanceKm * feePerKm) * surgeMult * storeLoadMultiplier)),
  );

  // Billed amounts must come from the same engine order-create uses
  // (services/deliveryPricing.service.ts), otherwise the cart shows the customer
  // one fee and POST /orders charges another.
  const deliveryFee = computeDeliveryFee(orderTotal, feeConfig);
  const freeDeliveryApplied = orderTotal > 0 && orderTotal >= feeConfig.freeDeliveryThreshold;

  return {
    deliveryFee,
    // Order-create bills `handlingCharge` separately from AppConfig; no additional
    // platform fee is ever charged, so surfacing one here would overstate the bill.
    platformFee: 0,
    totalFee: deliveryFee,
    freeDeliveryApplied,
    freeDeliveryThreshold: feeConfig.freeDeliveryThreshold,
    handlingCharge: feeConfig.handlingCharge,
    surgeMult,
    breakdown: {
      base: feeBase,
      distanceSurcharge: Math.round(distanceKm * feePerKm * 100) / 100,
      surgeMult,
      distanceKm: Math.round(distanceKm * 10) / 10,
      indicativeDynamicFee,
      smallOrderPlatformFee: orderTotal < platformSmallOrderThreshold ? platformFeeSmallOrder : 0,
    },
  };
}

// ── Schedule delivery slots (from admin system-config.delivery.slots) ─────────

export interface ConfigDeliverySlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  maxOrders?: number;
  isActive?: boolean;
  surgeMultiplier?: number;
}

export interface DeliverySlotOptionDto {
  id: string;
  mode: 'express' | 'scheduled';
  slotId: string | null;
  title: string;
  sub: string;
  windowStart: string | null;
  windowEnd: string | null;
  surgeMultiplier: number;
  available: boolean;
}

const IST = 'Asia/Kolkata';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function parseHhMm(value: string): { h: number; m: number } | null {
  const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return { h, m: min };
}

function formatClock(hhmm: string): string {
  const p = parseHhMm(hhmm);
  if (!p) return hhmm;
  const suffix = p.h >= 12 ? 'PM' : 'AM';
  const h12 = p.h % 12 || 12;
  return `${h12}:${String(p.m).padStart(2, '0')} ${suffix}`;
}

function istNowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: IST,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: get('weekday'),
    minutesSinceMidnight: hour * 60 + minute,
  };
}

/** Build a UTC Date for an IST calendar day + HH:mm (IST = UTC+5:30, no DST). */
function istLocalToUtc(year: number, month: number, day: number, hhmm: string): Date | null {
  const p = parseHhMm(hhmm);
  if (!p) return null;
  const utcMs = Date.UTC(year, month - 1, day, p.h, p.m, 0) - (5 * 60 + 30) * 60 * 1000;
  return new Date(utcMs);
}

function addCalendarDays(year: number, month: number, day: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: DAY_NAMES[d.getUTCDay()]!,
  };
}

async function loadConfigSlots(): Promise<ConfigDeliverySlot[]> {
  try {
    const { getSection } = await import('../admin/system-config.service');
    const delivery = (await getSection('delivery')) as { slots?: ConfigDeliverySlot[] };
    const slots = Array.isArray(delivery?.slots) ? delivery.slots : [];
    return slots.filter((s) => s && s.isActive !== false && s.id && s.startTime && s.endTime);
  } catch {
    return [];
  }
}

function windowForDay(
  slot: ConfigDeliverySlot,
  cal: { year: number; month: number; day: number },
): { start: Date; end: Date } | null {
  const start = istLocalToUtc(cal.year, cal.month, cal.day, slot.startTime);
  let end = istLocalToUtc(cal.year, cal.month, cal.day, slot.endTime);
  if (!start || !end) return null;
  if (end.getTime() <= start.getTime()) {
    const next = addCalendarDays(cal.year, cal.month, cal.day, 1);
    end = istLocalToUtc(next.year, next.month, next.day, slot.endTime);
    if (!end) return null;
  }
  return { start, end };
}

/**
 * Customer-facing delivery options: Express (now) + scheduled windows for
 * today / tomorrow from admin system-config delivery.slots.
 */
export async function listAvailableDeliverySlots(opts?: {
  expressPromiseText?: string;
}): Promise<{ options: DeliverySlotOptionDto[]; timezone: string }> {
  const now = new Date();
  const ist = istNowParts(now);
  const configSlots = await loadConfigSlots();

  const options: DeliverySlotOptionDto[] = [
    {
      id: 'now',
      mode: 'express',
      slotId: null,
      title: 'Express',
      sub: opts?.expressPromiseText || 'As soon as possible',
      windowStart: null,
      windowEnd: null,
      surgeMultiplier: 1,
      available: true,
    },
  ];

  for (const { offset, label } of [
    { offset: 0, label: 'Today' },
    { offset: 1, label: 'Tomorrow' },
  ] as const) {
    const cal = addCalendarDays(ist.year, ist.month, ist.day, offset);
    for (const slot of configSlots) {
      const days = Array.isArray(slot.days) ? slot.days.map((d) => String(d)) : [];
      if (days.length && !days.some((d) => d.toLowerCase() === cal.weekday.toLowerCase())) continue;

      const win = windowForDay(slot, cal);
      if (!win) continue;

      // Cut off once within 30 minutes of window start (or past it).
      if (offset === 0 && now.getTime() >= win.start.getTime() - 30 * 60 * 1000) continue;

      options.push({
        id: `${offset === 0 ? 'today' : 'tomorrow'}:${slot.id}`,
        mode: 'scheduled',
        slotId: slot.id,
        title: `${label} · ${slot.name}`,
        sub: `${formatClock(slot.startTime)} – ${formatClock(slot.endTime)}`,
        windowStart: win.start.toISOString(),
        windowEnd: win.end.toISOString(),
        surgeMultiplier: typeof slot.surgeMultiplier === 'number' ? slot.surgeMultiplier : 1,
        available: true,
      });
    }
  }

  return { options, timezone: IST };
}

/** Re-resolve a client-selected option id against live config (rejects stale/past slots). */
export async function resolveDeliverySlotOption(
  optionId: string,
): Promise<DeliverySlotOptionDto | { error: string }> {
  const id = String(optionId || '').trim() || 'now';
  if (id === 'now') {
    return {
      id: 'now',
      mode: 'express',
      slotId: null,
      title: 'Express',
      sub: 'As soon as possible',
      windowStart: null,
      windowEnd: null,
      surgeMultiplier: 1,
      available: true,
    };
  }

  const { options } = await listAvailableDeliverySlots();
  const found = options.find((o) => o.id === id && o.available);
  if (!found) return { error: 'Selected delivery slot is no longer available. Please pick another.' };
  return found;
}
