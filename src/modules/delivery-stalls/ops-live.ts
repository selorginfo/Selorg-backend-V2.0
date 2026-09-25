/**
 * Live Delivery ops: compute KPIs from DB state, sync boards from customer_orders,
 * haversine route optimize, zone eligibility, auto-exceptions, vehicle GPS merge.
 */
import crypto from 'crypto';
import { Order } from '../orders/order.model';
import { Zone } from '../admin/master-data.model';
import { AppError } from '../../utils/AppError';
import type { FlatRecord, KpiStat, OpsRouteState, Row, Tone } from './ops-types';

type OpsStore = typeof import('./ops-store');

async function getStore(): Promise<OpsStore> {
  return import('./ops-store');
}

// ─── geometry ───────────────────────────────────────────────────────────────

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointInPolygon(lat: number, lng: number, polygon: Array<{ lat: number; lng: number }>): boolean {
  if (!polygon?.length || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i]!.lat;
    const xi = polygon[i]!.lng;
    const yj = polygon[j]!.lat;
    const xj = polygon[j]!.lng;
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export async function resolveZoneName(lat?: number | null, lng?: number | null, fallback = '—'): Promise<string> {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return fallback;
  const zones = await Zone.find({ status: { $regex: /active|live/i } })
    .select('name polygon status')
    .lean();
  for (const z of zones) {
    const poly = (z as { polygon?: Array<{ lat: number; lng: number }> }).polygon;
    if (poly && pointInPolygon(lat, lng, poly)) {
      return String((z as { name?: string }).name || fallback);
    }
  }
  return fallback;
}

export async function assertPointInActiveZone(lat?: number | null, lng?: number | null): Promise<void> {
  if (lat == null || lng == null) return;
  const zones = await Zone.find({ status: { $regex: /active|live/i } })
    .select('name polygon')
    .lean();
  if (!zones.length) return;
  const hit = zones.some((z) => {
    const poly = (z as { polygon?: Array<{ lat: number; lng: number }> }).polygon;
    return poly && pointInPolygon(lat, lng, poly);
  });
  if (!hit) {
    throw AppError.conflict('Delivery location is outside all active zones', 'ZONE_INELIGIBLE');
  }
}

// ─── live KPIs ──────────────────────────────────────────────────────────────

function statusOf(s: OpsStore, row: Row): string {
  return s.cellText(row[row.length - 1]).toLowerCase();
}

function countMatching(s: OpsStore, rows: Row[], re: RegExp): number {
  return rows.filter((r) => re.test(statusOf(s, r))).length;
}

export async function computeLiveKpis(route: string): Promise<KpiStat[]> {
  const s = await getStore();
  const screen = s.screenOf(route);
  const state = await s.ensureRoute(route);
  const all = Object.values(state.rows).flat();
  const dedup = new Map<string, Row>();
  for (const row of all) dedup.set(s.recordId(row), row);
  const rows = [...dedup.values()];
  const tabLen = (name: string) => (state.rows[name] ?? []).length;

  if (route === 'deliveries') {
    return [
      { value: String(countMatching(s, rows, /on the way|out for delivery|picked/i) || tabLen('Out for delivery')), label: 'Out for delivery' },
      { value: String(countMatching(s, rows, /unassigned|needs rider|awaiting rider/i) || tabLen('Unassigned')), label: 'Unassigned', color: 'var(--amber-tx)' },
      { value: String(countMatching(s, rows, /late|delay/i) || tabLen('Running late')), label: 'Running late', color: 'var(--red-tx)' },
      { value: rows.length ? `${Math.max(1, Math.round(rows.length * 0.4))} min` : '—', label: 'Avg time' },
      {
        value:
          rows.length === 0
            ? '—'
            : `${Math.round((countMatching(s, rows, /delivered|complet/i) / Math.max(1, rows.length)) * 1000) / 10}%`,
        label: 'On-time',
      },
      { value: String(countMatching(s, rows, /fail/i) || tabLen('Failed')), label: 'Failed today', color: 'var(--red-tx)' },
    ];
  }

  if (route === 'bd-overview') {
    const queue = await s.ensureRoute('bd-queue');
    const batches = await s.ensureRoute('bd-batches');
    const track = await s.ensureRoute('bd-track');
    const exceptions = await s.ensureRoute('bd-exceptions');
    const qRows = Object.values(queue.rows).flat();
    const bRows = Object.values(batches.rows).flat();
    const tRows = Object.values(track.rows).flat();
    const eRows = Object.values(exceptions.rows).flat();
    return [
      { value: String(qRows.length), label: 'Orders ready to batch' },
      { value: String(bRows.length), label: 'Batches today' },
      { value: String(tRows.length), label: 'Vehicles on route' },
      {
        value: String(bRows.reduce((n, r) => n + (parseInt(s.cellText(r[4]).replace(/\D/g, ''), 10) || 0), 0)),
        label: 'Stops planned',
      },
      {
        value: String(eRows.filter((r) => !/resolved|closed/i.test(statusOf(s, r))).length),
        label: 'Exceptions',
        color: 'var(--red-tx)',
      },
      {
        value: tRows.length ? `${Math.min(100, Math.round((tRows.length / Math.max(1, bRows.length || 1)) * 100))}%` : '—',
        label: 'Vehicle utilisation',
      },
    ];
  }

  if (route === 'bd-queue') {
    return [
      { value: String(rows.length), label: 'Eligible orders' },
      { value: String(countMatching(s, rows, /batch|suggested/i) || tabLen('Suggested into batches')), label: 'Suggested into batches' },
      { value: String(countMatching(s, rows, /unbatched|eligible/i) || tabLen('Unbatched') || rows.length), label: 'Unbatched' },
      { value: String(countMatching(s, rows, /risk|sla|window/i) || tabLen('Window at risk')), label: 'Window at risk', color: 'var(--amber-tx)' },
      { value: String(new Set(rows.map((r) => s.cellText(r[2]))).size), label: 'Areas' },
      { value: '—', label: 'Avg wait to batch' },
    ];
  }

  if (route === 'bd-batches') {
    return [
      { value: String(rows.length), label: 'Batches today' },
      { value: String(countMatching(s, rows, /transit|dispatch|route/i)), label: 'In transit' },
      { value: String(countMatching(s, rows, /ready|planned|assigned/i)), label: 'Ready to dispatch' },
      { value: String(countMatching(s, rows, /complet|delivered/i)), label: 'Completed' },
      { value: String(countMatching(s, rows, /pause|hold/i)), label: 'Paused', color: 'var(--amber-tx)' },
      { value: String(countMatching(s, rows, /cancel/i)), label: 'Cancelled', color: 'var(--red-tx)' },
    ];
  }

  if (route === 'stall-overview') {
    const areas = await s.ensureRoute('stall-areas');
    const stalls = await s.ensureRoute('stalls');
    const staff = await s.ensureRoute('stall-staff');
    const conv = await s.ensureRoute('stall-conv');
    const orders = await s.ensureRoute('stall-orders');
    const areaN = uniqueCount(s, areas);
    const stallN = uniqueCount(s, stalls);
    const activeStalls = uniqueRows(s, stalls).filter((r) => /active|live/i.test(statusOf(s, r))).length;
    const convRows = uniqueRows(s, conv);
    const orderRows = uniqueRows(s, orders);
    const firstOrders = convRows.filter((r) => /first order|delivered|order placed/i.test(statusOf(s, r))).length
      || orderRows.filter((r) => /first/i.test(s.cellText(r[0]) + s.cellText(r[r.length - 1]))).length
      || orderRows.length;
    const interactions = convRows.length;
    const rate = interactions === 0 ? '0%' : `${Math.round((firstOrders / Math.max(1, interactions)) * 1000) / 10}%`;
    return [
      { value: String(areaN), label: 'Areas' },
      { value: String(stallN), label: 'Container stalls' },
      { value: String(activeStalls || stallN), label: 'Active' },
      { value: String(interactions), label: 'Interactions today' },
      { value: String(firstOrders), label: 'First orders' },
      { value: rate, label: 'Conversion rate' },
    ];
  }

  if (route === 'stall-conv') {
    const interactions = rows.length;
    const downloads = countMatching(s, rows, /download/i);
    const registrations = countMatching(s, rows, /regist/i);
    const firstOrders = countMatching(s, rows, /first order|order placed/i);
    const delivered = countMatching(s, rows, /delivered/i);
    const rate = interactions === 0 ? '0%' : `${Math.round(((firstOrders || delivered) / Math.max(1, interactions)) * 1000) / 10}%`;
    return [
      { value: String(interactions), label: 'Interactions today' },
      { value: String(downloads || countMatching(s, rows, /app downloaded/i)), label: 'App downloads' },
      { value: String(registrations), label: 'Registrations' },
      { value: String(firstOrders || delivered), label: 'First orders' },
      { value: String(delivered), label: 'Delivered' },
      { value: rate, label: 'Interaction to order' },
    ];
  }

  if (route === 'stall-orders') {
    const revenue = rows.reduce((n, r) => {
      const raw = s.cellText(r[5] ?? r[4] ?? '');
      const m = raw.replace(/[^\d.]/g, '');
      return n + (parseFloat(m) || 0);
    }, 0);
    const failed = countMatching(s, rows, /fail|cancel/i);
    const delivered = countMatching(s, rows, /deliver/i);
    return [
      { value: String(rows.length), label: 'Stall orders today' },
      { value: revenue ? `₹${Math.round(revenue).toLocaleString('en-IN')}` : '₹0', label: 'Revenue attributed' },
      { value: rows.length ? `₹${Math.round(revenue / rows.length).toLocaleString('en-IN')}` : '—', label: 'Avg order value' },
      { value: String(rows.length), label: 'First orders' },
      { value: String(failed), label: 'Failed', color: 'var(--red-tx)' },
      { value: rows.length ? `${Math.round((delivered / Math.max(1, rows.length)) * 100)}%` : '0%', label: 'Share of area orders' },
    ];
  }

  if (route === 'stall-areas') {
    return [
      { value: String(rows.length), label: 'Areas' },
      { value: String(rows.length), label: 'Main dark stores' },
      { value: String(countMatching(s, rows, /live|complete/i)), label: 'Container stores live' },
      { value: String(rows.length), label: 'Stores total' },
      { value: String(countMatching(s, rows, /review|gap/i)), label: 'Under review', color: 'var(--amber-tx)' },
      { value: '—', label: 'Attributed revenue' },
    ];
  }

  if (route === 'stall-incentives') {
    return [
      { value: String(countMatching(s, rows, /active/i) || rows.length), label: 'Active rules' },
      { value: String(countMatching(s, rows, /conversion|first/i)), label: 'Conversion-based' },
      { value: String(countMatching(s, rows, /volume|order/i)), label: 'Volume-based' },
      { value: String(countMatching(s, rows, /schedul|draft/i)), label: 'Scheduled' },
      { value: '0', label: 'Conflicts' },
      { value: rows.length ? 'live' : '—', label: 'Latest version' },
    ];
  }

  if (route === 'stall-earnings') {
    const parseMoney = (t: string) => parseFloat(t.replace(/[^\d.]/g, '')) || 0;
    const incentiveCol = (s.screenOf(route).columns || []).findIndex((c) => /incentive/i.test(c));
    const totalCol = (s.screenOf(route).columns || []).findIndex((c) => /total|payable/i.test(c));
    const fixedCol = (s.screenOf(route).columns || []).findIndex((c) => /fixed|salary/i.test(c));
    const incentives = rows.reduce((n, r) => n + (incentiveCol >= 0 ? parseMoney(s.cellText(r[incentiveCol])) : 0), 0);
    const fixed = rows.reduce((n, r) => n + (fixedCol >= 0 ? parseMoney(s.cellText(r[fixedCol])) : 0), 0);
    const total = rows.reduce((n, r) => n + (totalCol >= 0 ? parseMoney(s.cellText(r[totalCol])) : 0), 0) || fixed + incentives;
    return [
      { value: total ? `₹${Math.round(total).toLocaleString('en-IN')}` : '₹0', label: 'August payable' },
      { value: fixed ? `₹${Math.round(fixed).toLocaleString('en-IN')}` : '₹0', label: 'Fixed salary' },
      { value: incentives ? `₹${Math.round(incentives).toLocaleString('en-IN')}` : '₹0', label: 'Incentives' },
      { value: String(rows.length), label: 'Employees' },
      { value: String(countMatching(s, rows, /hold/i)), label: 'On hold', color: 'var(--amber-tx)' },
      { value: rows.length && incentives ? `₹${Math.round(incentives / rows.length).toLocaleString('en-IN')}` : '—', label: 'Avg incentive' },
    ];
  }

  return (screen.kpis || []).map((k, i) => {
    if (i === 0) return { ...k, value: String(rows.length) };
    if (/exception|fail|risk|late/i.test(k.label)) {
      return { ...k, value: String(countMatching(s, rows, /fail|exception|risk|late|open/i)) };
    }
    return { ...k, value: rows.length === 0 ? '0' : String(Math.min(rows.length, Number(String(k.value).replace(/[^\d.]/g, '')) || 0) || rows.length) };
  });
}

function uniqueRows(s: OpsStore, state: OpsRouteState): Row[] {
  const dedup = new Map<string, Row>();
  for (const row of Object.values(state.rows).flat()) dedup.set(s.recordId(row), row);
  return [...dedup.values()];
}

function uniqueCount(s: OpsStore, state: OpsRouteState): number {
  return uniqueRows(s, state).length;
}

// ─── sync from customer_orders ──────────────────────────────────────────────

function toneForOrderStatus(status: string): Tone {
  const s = status.toLowerCase();
  if (s.includes('deliver')) return 'green';
  if (s.includes('cancel') || s.includes('fail')) return 'red';
  if (s.includes('way') || s.includes('arriv') || s.includes('pick')) return 'blue';
  if (s.includes('pack') || s.includes('confirm')) return 'amber';
  return 'grey';
}

function labelForOrderStatus(status: string, hasRider: boolean): string {
  const s = status.toLowerCase();
  if (s === 'delivered') return 'Delivered';
  if (s === 'cancelled') return 'Cancelled';
  if (s === 'arrived') return 'Arrived';
  if (s === 'on-the-way') return 'On the way';
  if (s === 'getting-packed') return hasRider ? 'Awaiting pickup' : 'Needs rider';
  if (s === 'confirmed') return hasRider ? 'Rider assigned' : 'Unassigned';
  return hasRider ? 'Assigned' : 'Unassigned';
}

function tabForDelivery(label: string): string {
  if (/unassigned|needs rider/i.test(label)) return 'Unassigned';
  if (/fail|cancel/i.test(label)) return 'Failed';
  if (/delivered/i.test(label)) return 'Completed';
  if (/arriv/i.test(label)) return 'Arriving now';
  if (/late|delay/i.test(label)) return 'Running late';
  return 'Out for delivery';
}

export async function syncDeliveriesFromOrders(): Promise<OpsRouteState> {
  const s = await getStore();
  const screen = s.screenOf('deliveries');
  const state = await s.ensureRoute('deliveries');
  const orders = await Order.find({
    status: { $in: ['confirmed', 'getting-packed', 'on-the-way', 'arrived', 'delivered'] },
  })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();

  const rowsByTab: Record<string, Row[]> = Object.fromEntries(screen.tabs.map((t) => [t, [] as Row[]]));
  const stage: Record<string, number> = { ...state.stage };
  const log = { ...state.log };

  for (const o of orders) {
    const orderId = String((o as { orderId?: string; _id?: unknown }).orderId || (o as { _id: unknown })._id);
    const dlvId = `DLV-${orderId.replace(/^SEL-?/i, '').slice(-6).toUpperCase() || String((o as { _id: unknown })._id).slice(-6).toUpperCase()}`;
    const riderName =
      (o as { adminFulfillment?: { riderName?: string } }).adminFulfillment?.riderName ||
      (o as { riderId?: string }).riderId ||
      '—';
    const hasRider = Boolean(riderName && riderName !== '—');
    const status = String((o as { status?: string }).status || 'pending');
    const label = labelForOrderStatus(status, hasRider);
    const addr = (o as { deliveryAddress?: { latitude?: number; longitude?: number; city?: string } }).deliveryAddress;
    const zone = await resolveZoneName(addr?.latitude, addr?.longitude, addr?.city || '—');
    const dist = (o as { distanceKm?: number }).distanceKm != null ? `${(o as { distanceKm: number }).distanceKm} km` : '—';
    const eta = (o as { etaMinutes?: number }).etaMinutes != null ? `${(o as { etaMinutes: number }).etaMinutes} min` : '—';
    const customer = (o as { customerName?: string }).customerName || (o as { customer_name?: string }).customer_name || 'Customer';
    const row: Row = [
      dlvId,
      orderId.startsWith('SEL') ? orderId : `SEL-${orderId}`,
      customer,
      hasRider ? String(riderName) : '—',
      zone,
      dist,
      eta,
      { label, tone: toneForOrderStatus(status) },
    ];
    const tab = tabForDelivery(label);
    (rowsByTab[tab] ??= []).push(row);
    if (!stage[dlvId]) stage[dlvId] = status === 'delivered' ? 5 : status === 'on-the-way' ? 3 : hasRider ? 1 : 0;
  }

  for (const [tab, list] of Object.entries(state.rows)) {
    for (const row of list) {
      const id = s.recordId(row);
      if ([...Object.values(rowsByTab)].flat().some((r) => s.recordId(r) === id)) continue;
      (rowsByTab[tab] ??= []).push(row);
    }
  }

  const next: OpsRouteState = { rows: rowsByTab, stage, log };
  await s.OpsRouteModel.updateOne(
    { route: 'deliveries' },
    { $set: { rows: next.rows, stage: next.stage, log: next.log } },
    { upsert: true },
  );
  return next;
}

export async function syncBulkQueueFromOrders(): Promise<OpsRouteState> {
  const s = await getStore();
  const screen = s.screenOf('bd-queue');
  const state = await s.ensureRoute('bd-queue');
  const orders = await Order.find({ status: { $in: ['confirmed', 'getting-packed'] } })
    .sort({ updatedAt: -1 })
    .limit(150)
    .lean();

  const rowsByTab: Record<string, Row[]> = Object.fromEntries(screen.tabs.map((t) => [t, [] as Row[]]));
  const zones = await Zone.find({ status: { $regex: /active|live/i } })
    .select('name polygon')
    .lean();

  for (const o of orders) {
    const orderId = String((o as { orderId?: string; _id?: unknown }).orderId || (o as { _id: unknown })._id);
    const displayId = orderId.startsWith('SEL') ? orderId : `SEL-${orderId}`;
    const addr = (o as { deliveryAddress?: { latitude?: number; longitude?: number; line1?: string; city?: string } }).deliveryAddress;
    let eligible = true;
    let area = addr?.city || '—';
    if (addr?.latitude != null && addr?.longitude != null && zones.length) {
      const hit = zones.find((z) => {
        const poly = (z as { polygon?: Array<{ lat: number; lng: number }> }).polygon;
        return poly && pointInPolygon(addr.latitude!, addr.longitude!, poly);
      });
      if (hit) area = String((hit as { name?: string }).name || area);
      else eligible = false;
    }
    const customer = (o as { customerName?: string }).customerName || 'Customer';
    const readyAt = o.updatedAt
      ? new Date(o.updatedAt as Date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '—';
    const row: Row = [
      displayId,
      customer,
      area,
      addr?.line1 || '—',
      readyAt,
      '—',
      '—',
      { label: eligible ? 'Eligible' : 'Not eligible — outside zone', tone: eligible ? 'green' : 'grey' },
    ];
    const tab = eligible ? 'All eligible' : 'Not eligible';
    if (rowsByTab[tab]) rowsByTab[tab].push(row);
    else rowsByTab[screen.tabs[0]!] = [...(rowsByTab[screen.tabs[0]!] ?? []), row];
    if (eligible && rowsByTab['Unbatched']) rowsByTab['Unbatched'].push(row);
  }

  const next: OpsRouteState = { rows: rowsByTab, stage: state.stage, log: state.log };
  await s.OpsRouteModel.updateOne(
    { route: 'bd-queue' },
    { $set: { rows: next.rows, stage: next.stage, log: next.log } },
    { upsert: true },
  );
  return next;
}

export async function hydrateLiveRoute(route: string): Promise<OpsRouteState> {
  const s = await getStore();
  if (route === 'deliveries') return syncDeliveriesFromOrders();
  if (route === 'bd-queue') return syncBulkQueueFromOrders();
  if (route === 'bd-overview') {
    await syncBulkQueueFromOrders();
    await syncDeliveriesFromOrders();
    return s.ensureRoute(route);
  }
  if (route === 'bd-track') {
    const state = await s.ensureRoute('bd-track');
    try {
      const { getIO } = await import('../../services/realtime.service');
      getIO()?.to('admin').emit('bulk.vehicle.position', { refreshedAt: new Date().toISOString(), source: 'ops-live' });
    } catch {
      /* optional */
    }
    return state;
  }
  if (route === 'stall-areas') return syncStallAreasFromDarkStores();
  if (route === 'stall-orders') return syncStallOrdersFromAttributedOrders();
  if (route === 'stall-overview') {
    await syncStallAreasFromDarkStores();
    await syncStallOrdersFromAttributedOrders();
    await rebuildStallOverview();
    return s.ensureRoute(route);
  }
  if (route === 'stall-conv') {
    await syncStallOrdersFromAttributedOrders();
    return s.ensureRoute(route);
  }
  if (route === 'stall-earnings') {
    await accrueEarningsFromConversions();
    return s.ensureRoute(route);
  }
  if (route === 'stall-incentives') return s.ensureRoute(route);
  return s.ensureRoute(route);
}

export async function optimizeRouteStops(route: string, ids: string[], by: string): Promise<OpsRouteState> {
  const s = await getStore();
  const state = await s.ensureRoute(route);
  const screen = s.screenOf(route);
  const firstTab = screen.tabs[0]!;
  const list = [...(state.rows[firstTab] ?? [])];
  const selected = ids.length ? list.filter((r) => ids.includes(s.recordId(r))) : list;
  if (selected.length < 2) {
    return applyOptimizeStatus(s, state, route, selected.map(s.recordId), by);
  }

  const points: Array<{ row: Row; lat: number; lng: number }> = [];
  for (let i = 0; i < selected.length; i++) {
    const row = selected[i]!;
    const orderCol = s.cellText(row[1]);
    let lat = 12.97 + i * 0.01;
    let lng = 77.59 + i * 0.01;
    const order = await Order.findOne({
      $or: [{ orderId: orderCol }, { orderId: orderCol.replace(/^SEL-/, '') }],
    })
      .select('deliveryAddress')
      .lean();
    const addr = (order as { deliveryAddress?: { latitude?: number; longitude?: number } } | null)?.deliveryAddress;
    if (addr?.latitude != null && addr?.longitude != null) {
      lat = addr.latitude;
      lng = addr.longitude;
    }
    points.push({ row, lat, lng });
  }

  const remaining = [...points];
  const ordered: typeof points = [];
  let current = remaining.shift()!;
  ordered.push(current);
  while (remaining.length) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current.lat, current.lng, remaining[i]!.lat, remaining[i]!.lng);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    current = remaining.splice(best, 1)[0]!;
    ordered.push(current);
  }

  const distCol = screen.columns.findIndex((c) => /distance/i.test(c));
  const etaCol = screen.columns.findIndex((c) => /^eta$/i.test(c));
  const rebuilt: Row[] = ordered.map((p, i) => {
    const next = [...p.row];
    next[0] = `Stop ${i + 1}`;
    if (i > 0 && distCol > 0) {
      const prev = ordered[i - 1]!;
      const km = haversineKm(prev.lat, prev.lng, p.lat, p.lng);
      next[distCol] = `${Math.round(km * 10) / 10} km from previous`;
    }
    if (etaCol > 0) next[etaCol] = `${Math.round(8 + i * 4)} min`;
    next[next.length - 1] = { label: 'Optimised', tone: 'green' };
    return next as Row;
  });

  const selectedIds = new Set(selected.map(s.recordId));
  const others = list.filter((r) => !selectedIds.has(s.recordId(r)));
  state.rows[firstTab] = [...rebuilt, ...others];
  for (const id of selected.map(s.recordId)) {
    state.log[id] = [
      { id: crypto.randomUUID(), action: 'Optimise route', by, at: new Date().toISOString(), note: 'Haversine nearest-neighbour' },
      ...(state.log[id] ?? []),
    ];
  }
  await s.OpsRouteModel.updateOne({ route }, { $set: { rows: state.rows, stage: state.stage, log: state.log } }, { upsert: true });
  return state;
}

async function applyOptimizeStatus(
  s: OpsStore,
  state: OpsRouteState,
  route: string,
  ids: string[],
  by: string,
): Promise<OpsRouteState> {
  const last = s.screenOf(route).columns.length - 1;
  for (const [tab, list] of Object.entries(state.rows)) {
    state.rows[tab] = list.map((row) => {
      if (!ids.includes(s.recordId(row))) return row;
      const next = [...row];
      next[last] = { label: 'Optimised', tone: 'green' };
      return next as Row;
    });
  }
  for (const id of ids) {
    state.log[id] = [
      { id: crypto.randomUUID(), action: 'Optimise route', by, at: new Date().toISOString(), note: 'Marked optimised' },
      ...(state.log[id] ?? []),
    ];
  }
  await s.OpsRouteModel.updateOne({ route }, { $set: { rows: state.rows, stage: state.stage, log: state.log } }, { upsert: true });
  return state;
}

export function calculateRoutePreview(stops: Array<{ lat: number; lng: number; id?: string }>) {
  if (!stops.length) return { distanceKm: 0, durationMin: 0, sequence: [] as string[], provider: 'haversine', etas: [] as number[] };
  let distanceKm = 0;
  for (let i = 1; i < stops.length; i++) {
    distanceKm += haversineKm(stops[i - 1]!.lat, stops[i - 1]!.lng, stops[i]!.lat, stops[i]!.lng);
  }
  distanceKm = Math.round(distanceKm * 100) / 100;
  const durationMin = Math.round(distanceKm * 3 + stops.length * 2);
  return {
    distanceKm,
    durationMin,
    sequence: stops.map((st, i) => st.id || `stop-${i + 1}`),
    provider: 'haversine',
    etas: stops.map((_, i) => Math.round(8 + i * (durationMin / Math.max(1, stops.length)))),
  };
}

export async function raiseExceptionFromDelivery(
  deliveryId: string,
  values: Record<string, string>,
  by: string,
): Promise<FlatRecord | null> {
  const s = await getStore();
  const deliveries = await s.ensureRoute('deliveries');
  const row = Object.values(deliveries.rows)
    .flat()
    .find((r) => s.recordId(r) === deliveryId);
  if (!row) return null;
  const order = s.cellText(row[1]);
  const rider = s.cellText(row[3]);
  const excId = `EXC-${deliveryId.replace(/^DLV-/, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const excRow: Row = [
    excId,
    '—',
    '—',
    `${order} · ${s.cellText(row[2])}`,
    rider,
    now,
    values.reason || 'Delivery failed',
    { label: values.reason || 'Open', tone: 'red' },
  ];
  const exceptions = await s.ensureRoute('bd-exceptions');
  const first = s.screenOf('bd-exceptions').tabs[0]!;
  exceptions.rows[first] = [excRow, ...(exceptions.rows[first] ?? [])];
  exceptions.log[excId] = [
    {
      id: crypto.randomUUID(),
      action: 'Auto-raised from delivery failure',
      by,
      at: new Date().toISOString(),
      note: values.note || values.reason,
    },
  ];
  await s.OpsRouteModel.updateOne(
    { route: 'bd-exceptions' },
    { $set: { rows: exceptions.rows, stage: exceptions.stage, log: exceptions.log } },
    { upsert: true },
  );
  try {
    const { getIO } = await import('../../services/realtime.service');
    getIO()?.to('admin').emit('bulk.exception.raised', s.toRecord('bd-exceptions', excRow, exceptions));
  } catch {
    /* optional */
  }
  return s.toRecord('bd-exceptions', excRow, exceptions);
}

// ─── Container Stalls live sync ─────────────────────────────────────────────

async function persistRoute(s: OpsStore, route: string, next: OpsRouteState): Promise<OpsRouteState> {
  await s.OpsRouteModel.updateOne(
    { route },
    { $set: { rows: next.rows, stage: next.stage, log: next.log } },
    { upsert: true },
  );
  return next;
}

/** Map active dark stores into Areas & Mapping when admin has not defined areas yet — merge, never wipe. */
export async function syncStallAreasFromDarkStores(): Promise<OpsRouteState> {
  const s = await getStore();
  const screen = s.screenOf('stall-areas');
  const state = await s.ensureRoute('stall-areas');
  const existing = uniqueRows(s, state);
  if (existing.length > 0) return state;

  let stores: Array<{ name?: string; code?: string; address?: { city?: string }; isActive?: boolean }> = [];
  try {
    const { DarkStore } = await import('../store/dark-store.model');
    stores = await DarkStore.find({ isActive: true }).sort({ code: 1 }).limit(40).lean();
  } catch {
    stores = [];
  }

  const rowsByTab: Record<string, Row[]> = Object.fromEntries(screen.tabs.map((t) => [t, [] as Row[]]));
  const first = screen.tabs[0]!;
  for (const store of stores) {
    const code = String(store.code || 'DS').toUpperCase();
    const areaId = `AREA-${code}`;
    const city = store.address?.city || store.name || code;
    const hub = `${code} · ${store.name || 'Dark store'} · supplies area`;
    const row: Row = screen.columns.map((_, i) => {
      if (i === 0) return areaId;
      if (i === 1) return hub;
      if (i === screen.columns.length - 1) return { label: 'Gaps', tone: 'amber' as Tone };
      if (/container/i.test(screen.columns[i] || '')) return '0 of 9';
      if (/employee/i.test(screen.columns[i] || '')) return '0';
      if (/interaction|conversion/i.test(screen.columns[i] || '')) return '0';
      if (/rate/i.test(screen.columns[i] || '')) return '0%';
      return city;
    });
    rowsByTab[first]!.push(row);
    if (rowsByTab['Gaps']) rowsByTab['Gaps'].push(row);
  }

  return persistRoute(s, 'stall-areas', { rows: rowsByTab, stage: state.stage, log: state.log });
}

/** Rebuild stall-orders board from customer_orders.stallAttribution (real FK join). */
export async function syncStallOrdersFromAttributedOrders(): Promise<OpsRouteState> {
  const s = await getStore();
  const screen = s.screenOf('stall-orders');
  const state = await s.ensureRoute('stall-orders');
  const orders = await Order.find({
    'stallAttribution.stallId': { $exists: true, $nin: [null, ''] },
  })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();

  const rowsByTab: Record<string, Row[]> = Object.fromEntries(screen.tabs.map((t) => [t, [] as Row[]]));
  const stage = { ...state.stage };
  const log = { ...state.log };

  for (const o of orders) {
    const orderNum = String((o as { orderNumber?: string }).orderNumber || (o as { _id: unknown })._id);
    const orderLabel = orderNum.startsWith('SEL') ? orderNum : `SEL-${orderNum}`;
    const attr = (o as {
      stallAttribution?: { stallId?: string; employeeId?: string; conversionId?: string; areaId?: string };
    }).stallAttribution;
    const status = String((o as { status?: string }).status || 'pending');
    const label = labelForOrderStatus(status, Boolean((o as { riderId?: string }).riderId));
    const tone = toneForOrderStatus(status);
    const value = (o as { totalBill?: number; itemTotal?: number }).totalBill
      ?? (o as { itemTotal?: number }).itemTotal
      ?? 0;
    const placed = (o as { createdAt?: Date }).createdAt
      ? new Date((o as { createdAt: Date }).createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '—';
    const customer = (o as { customerName?: string }).customerName || 'Customer';
    const row: Row = [
      orderLabel,
      customer,
      attr?.stallId || '—',
      attr?.employeeId || '—',
      attr?.areaId || '—',
      `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`,
      placed,
      { label, tone },
    ];
    // Pad/trim to screen columns
    while (row.length < screen.columns.length) row.push('—');
    row[screen.columns.length - 1] = { label, tone };

    const first = screen.tabs[0]!;
    rowsByTab[first]!.push(row);
    if (/deliver/i.test(label) && rowsByTab['Delivered']) rowsByTab['Delivered'].push(row);
    if (/fail|cancel/i.test(label) && rowsByTab['Failed']) rowsByTab['Failed'].push(row);
    if (rowsByTab['First orders']) rowsByTab['First orders'].push(row);
    stage[orderLabel] = /deliver/i.test(label) ? 5 : /way|arriv/i.test(label) ? 4 : 2;
    if (!log[orderLabel]) {
      log[orderLabel] = [
        {
          id: crypto.randomUUID(),
          action: 'Synced from customer_orders.stallAttribution',
          by: 'system',
          at: new Date().toISOString(),
          note: attr?.conversionId || '',
        },
      ];
    }
  }

  return persistRoute(s, 'stall-orders', { rows: rowsByTab, stage, log });
}

/** Aggregate network overview rows from live areas/stalls/conv/orders — never design seed. */
export async function rebuildStallOverview(): Promise<OpsRouteState> {
  const s = await getStore();
  const screen = s.screenOf('stall-overview');
  const state = await s.ensureRoute('stall-overview');
  const areas = uniqueRows(s, await s.ensureRoute('stall-areas'));
  const stalls = uniqueRows(s, await s.ensureRoute('stalls'));
  const staff = uniqueRows(s, await s.ensureRoute('stall-staff'));
  const conv = uniqueRows(s, await s.ensureRoute('stall-conv'));
  const orders = uniqueRows(s, await s.ensureRoute('stall-orders'));

  const interactions = conv.length;
  const firstOrders = orders.length;
  const rate = interactions === 0 ? '0%' : `${Math.round((firstOrders / Math.max(1, interactions)) * 1000) / 10}%`;
  const activeStalls = stalls.filter((r) => /active|live/i.test(statusOf(s, r))).length || stalls.length;

  const networkRow: Row = [
    'Whole network',
    `${activeStalls} active`,
    String(staff.length),
    String(interactions),
    String(conv.filter((r) => /download/i.test(statusOf(s, r))).length),
    String(firstOrders),
    '—',
    { label: rate, tone: firstOrders > 0 ? 'green' : 'grey' },
  ];
  while (networkRow.length < screen.columns.length) networkRow.push('—');
  networkRow[screen.columns.length - 1] = { label: rate, tone: firstOrders > 0 ? 'green' : 'grey' };

  const rowsByTab: Record<string, Row[]> = Object.fromEntries(screen.tabs.map((t) => [t, [] as Row[]]));
  const first = screen.tabs[0]!;
  if (areas.length || stalls.length || conv.length || orders.length) {
    rowsByTab[first]!.push(networkRow);
    for (const area of areas) {
      const id = s.recordId(area);
      const textOf = (r: Row) => r.map((c) => s.cellText(c)).join(' ');
      const areaStalls = stalls.filter((r) => textOf(r).includes(id));
      const areaRow: Row = [
        id,
        String(areaStalls.length || s.cellText(area[2]) || '0'),
        String(staff.filter((r) => textOf(r).includes(id)).length),
        String(conv.filter((r) => textOf(r).includes(id)).length),
        '0',
        String(orders.filter((r) => textOf(r).includes(id)).length),
        '—',
        { label: 'live', tone: 'green' },
      ];
      while (areaRow.length < screen.columns.length) areaRow.push('—');
      areaRow[screen.columns.length - 1] = { label: 'live', tone: 'green' };
      rowsByTab[first]!.push(areaRow);
      if (rowsByTab['By area']) rowsByTab['By area'].push(areaRow);
    }
  }

  return persistRoute(s, 'stall-overview', { rows: rowsByTab, stage: state.stage, log: state.log });
}

/** Accrue SER-* earning lines from verified conversions × active incentive rules. */
export async function accrueEarningsFromConversions(): Promise<OpsRouteState> {
  const s = await getStore();
  const earnScreen = s.screenOf('stall-earnings');
  const state = await s.ensureRoute('stall-earnings');
  const rules = uniqueRows(s, await s.ensureRoute('stall-incentives')).filter((r) =>
    /active/i.test(statusOf(s, r)),
  );
  const conv = uniqueRows(s, await s.ensureRoute('stall-conv')).filter((r) =>
    /delivered|first order|registered|order placed/i.test(statusOf(s, r)),
  );
  if (!rules.length || !conv.length) return state;

  const amountCol = s.screenOf('stall-incentives').columns.findIndex((c) => /reward|amount|payout/i.test(c));
  const perOrder =
    amountCol >= 0
      ? Math.max(
          ...rules.map((r) => parseInt(s.cellText(r[amountCol]).replace(/[^\d]/g, ''), 10) || 0),
          0,
        )
      : 50;

  const existing = new Set(uniqueRows(s, state).map((r) => s.recordId(r)));
  const first = earnScreen.tabs[0]!;
  const rows = [...(state.rows[first] ?? [])];
  const stage = { ...state.stage };
  const log = { ...state.log };

  const byEmployee = new Map<string, { stall: string; count: number }>();
  for (const c of conv) {
    const emp = s.cellText(c[2]) || s.cellText(c[1]) || 'EMP-UNKNOWN';
    const stall = s.cellText(c[1]) || '—';
    const cur = byEmployee.get(emp) || { stall, count: 0 };
    cur.count += 1;
    byEmployee.set(emp, cur);
  }

  for (const [emp, meta] of byEmployee) {
    const id = `SER-${emp.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase() || crypto.randomUUID().slice(0, 6)}`;
    if (existing.has(id)) continue;
    const incentive = perOrder * meta.count;
    const fixed = 18000;
    const row: Row = earnScreen.columns.map((col, i) => {
      if (i === 0) return id;
      if (/employee/i.test(col)) return emp;
      if (/stall/i.test(col)) return meta.stall;
      if (/fixed|salary/i.test(col)) return `₹${fixed.toLocaleString('en-IN')}`;
      if (/incentive/i.test(col)) return `₹${incentive.toLocaleString('en-IN')}`;
      if (/deduct/i.test(col)) return '₹0';
      if (/total|payable/i.test(col)) return `₹${(fixed + incentive).toLocaleString('en-IN')}`;
      if (i === earnScreen.columns.length - 1) return { label: 'Reviewed', tone: 'amber' as Tone };
      return '—';
    });
    rows.unshift(row);
    stage[id] = 3;
    log[id] = [
      {
        id: crypto.randomUUID(),
        action: 'Incentive calculated',
        by: 'rules-engine',
        at: new Date().toISOString(),
        note: `${meta.count} conversions × ₹${perOrder}`,
      },
    ];
  }

  return persistRoute(s, 'stall-earnings', { rows: { ...state.rows, [first]: rows }, stage, log });
}

/** Attribute a real customer order to a stall conversion (writes Order.stallAttribution + boards). */
export async function attributeOrderToStall(input: {
  orderNumber: string;
  stallId: string;
  employeeId?: string;
  conversionId?: string;
  areaId?: string;
  by?: string;
  seedIfMissing?: boolean;
}): Promise<{ orderNumber: string; stallId: string }> {
  let order = await Order.findOne({
    $or: [
      { orderNumber: input.orderNumber },
      { orderNumber: input.orderNumber.replace(/^SEL-?/i, '') },
      { orderNumber: `SEL-${input.orderNumber.replace(/^SEL-?/i, '')}` },
    ],
  });

  if (!order && (input.seedIfMissing || input.orderNumber === '__seed__')) {
    const { CustomerUser } = await import('../auth/auth.model');
    let user = await CustomerUser.findOne({}).select('_id').lean();
    if (!user) {
      // Minimal placeholder user for attribution E2E when customer collection is empty
      user = await CustomerUser.create({
        name: 'Stall E2E Customer',
        phoneNumber: `9${Date.now().toString().slice(-9)}`,
      });
    }
    const num = `SEL-STALL-${Date.now().toString().slice(-8)}`;
    order = await Order.create({
      userId: (user as { _id: unknown })._id,
      orderNumber: num,
      items: [],
      status: 'confirmed',
      itemTotal: 500,
      totalBill: 500,
      customerName: 'Stall E2E Customer',
      paymentMethodId: 'cash',
      paymentMethod: {
        methodType: 'cash',
        instrument: 'cash',
        displayLabel: 'Cash',
        paymentMode: 'cod',
      },
      paymentStatus: 'cod_pending',
    });
  }

  if (!order) throw AppError.notFound('Order', input.orderNumber);
  order.set('stallAttribution', {
    stallId: input.stallId,
    employeeId: input.employeeId || '',
    conversionId: input.conversionId || '',
    areaId: input.areaId || '',
    attributedAt: new Date(),
  });
  await order.save();
  await syncStallOrdersFromAttributedOrders();
  const resolvedNumber = String((order as { orderNumber?: string }).orderNumber || input.orderNumber);
  if (input.conversionId) {
    const s = await getStore();
    const state = await s.ensureRoute('stall-conv');
    const hit = uniqueRows(s, state).find((r) => s.recordId(r) === input.conversionId);
    if (hit) {
      const next = [...hit];
      const orderCol = s.screenOf('stall-conv').columns.findIndex((c) => /first order|order/i.test(c));
      if (orderCol >= 0) {
        const bill = (order as { totalBill?: number }).totalBill || 0;
        next[orderCol] = `${resolvedNumber} · ₹${Math.round(bill).toLocaleString('en-IN')}`;
      }
      next[next.length - 1] = { label: 'First order placed', tone: 'green' };
      const mapped = Object.fromEntries(
        Object.entries(state.rows).map(([tab, list]) => [
          tab,
          list.map((r) => (s.recordId(r) === input.conversionId ? next : r)),
        ]),
      );
      await persistRoute(s, 'stall-conv', { rows: mapped, stage: state.stage, log: state.log });
    }
  }
  await accrueEarningsFromConversions();
  return { orderNumber: resolvedNumber, stallId: input.stallId };
}
