import crypto from 'crypto';
import mongoose, { Schema } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { recordAuditLog } from '../../services/audit.service';
import { getIO } from '../../services/realtime.service';
import { OPS_EFFECTS } from './ops-effects';
import screensJson from './data/screens.json';
import formsJson from './data/action-forms.json';
import type { ActionForm, Cell, FlatRecord, OpsLogEntry, OpsRouteState, Row, ScreenSeed, Tone } from './ops-types';

const SCREENS = screensJson as unknown as Record<string, ScreenSeed>;
const FORMS = formsJson as unknown as Record<string, ActionForm>;

const TERMINAL = /^(completed|all delivered|delivered|cancelled|retired|expired|ended|trip closed|resolved|paid|inactive|reconciled|refunded)\b/i;
const AFTER_CLOSE = /^(Change status|Create new version|Mark available|Flag as invalid|Reattribute conversion|Refund delivery|Refund order|Review performance|Report stop issue)$/;

interface RouteDoc {
  route: string;
  rows: Record<string, Row[]>;
  stage: Record<string, number>;
  log: Record<string, OpsLogEntry[]>;
}

const routeSchema = new Schema<RouteDoc>(
  {
    route: { type: String, required: true, unique: true },
    rows: { type: Schema.Types.Mixed, required: true },
    stage: { type: Schema.Types.Mixed, default: {} },
    log: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const OpsRouteModel =
  (mongoose.models.OpsRoute as mongoose.Model<RouteDoc>) || mongoose.model<RouteDoc>('OpsRoute', routeSchema, 'admin_ops_routes');

// Re-export for ops-live sync helpers
export type { RouteDoc };

export function screenOf(route: string): ScreenSeed {
  const screen = SCREENS[route];
  if (!screen) throw AppError.notFound('Screen', route);
  return screen;
}

export function cellText(cell: Cell | undefined): string {
  if (cell == null) return '—';
  return typeof cell === 'string' ? cell : cell.label;
}

export function recordId(row: Row): string {
  return cellText(row[0]);
}

function camel(label: string): string {
  const words = label
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return 'field';
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
}

export function actionSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function slugToAction(route: string, slug: string): string {
  const screen = screenOf(route);
  const hit = screen.actions.find((label) => actionSlug(label) === slug);
  if (!hit) throw AppError.badRequest(`Unknown action "${slug}"`);
  return hit;
}

function defaultStage(screen: ScreenSeed, row?: Row): number {
  if (!screen.flow.length) return 0;
  const fallback = screen.flowAt ?? Math.max(1, Math.round(screen.flow.length * 0.55));
  if (!row) return fallback;
  const status = cellText(row[screen.columns.length - 1]).toLowerCase();
  const labels = screen.flow.map((f) => f.label.toLowerCase());
  const exact = labels.findIndex((l) => status.includes(l) || l.includes(status));
  if (exact >= 0) return exact;
  const awaiting = status.match(/^awaiting (\w+)/);
  if (awaiting) {
    const i = labels.findIndex((l) => l.includes(awaiting[1]!));
    if (i > 0) return i - 1;
  }
  const byWord = labels.findIndex((l) => l.split(/\s+/).some((w) => w.length > 4 && status.includes(w)));
  return byWord >= 0 ? byWord : fallback;
}

function logEntry(action: string, by: string, note?: string): OpsLogEntry {
  return { id: crypto.randomUUID(), action, by, at: new Date().toISOString(), note };
}

function summary(values: Record<string, string>, labels: Record<string, string>): string {
  return Object.entries(values)
    .filter(([, val]) => val && val.trim())
    .map(([k, val]) => (k === 'note' ? val.trim() : `${labels[k] ?? k}: ${val.trim()}`))
    .join(' · ');
}

function mapRows(state: OpsRouteState, ids: string[], fn: (row: Row) => Row | null): OpsRouteState {
  const rows = Object.fromEntries(
    Object.entries(state.rows).map(([tab, list]) => [
      tab,
      list.flatMap((row) => {
        if (!ids.includes(recordId(row))) return [row];
        const next = fn(row);
        return next ? [next] : [];
      }),
    ]),
  );
  return { ...state, rows };
}

function findRow(state: OpsRouteState, id: string): Row | undefined {
  for (const list of Object.values(state.rows)) {
    const hit = list.find((r) => recordId(r) === id);
    if (hit) return hit;
  }
  return undefined;
}

export function toRecord(route: string, row: Row, state: OpsRouteState): FlatRecord {
  const screen = screenOf(route);
  const id = recordId(row);
  const rec: FlatRecord = {
    id,
    status: { label: '—', tone: 'grey' },
    stage: state.stage[id] ?? defaultStage(screen, row),
    activity: state.log[id] ?? [],
  };
  screen.columns.forEach((col, i) => {
    const cell = row[i];
    if (i === screen.columns.length - 1) {
      rec.status =
        cell && typeof cell === 'object'
          ? { label: cell.label, tone: cell.tone }
          : { label: cellText(cell), tone: 'grey' };
      return;
    }
    if (i === 0) return;
    rec[camel(col)] = cellText(cell);
  });
  return rec;
}

function uniqueRows(state: OpsRouteState, tab?: string): Row[] {
  const lists = tab ? [state.rows[tab] ?? []] : Object.values(state.rows);
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const list of lists) {
    for (const row of list) {
      const id = recordId(row);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
  }
  return out;
}

function tabCounts(state: OpsRouteState): Record<string, number> {
  return Object.fromEntries(Object.entries(state.rows).map(([tab, list]) => [actionSlug(tab), list.length]));
}

export async function ensureRoute(route: string): Promise<OpsRouteState> {
  const screen = screenOf(route);
  let doc = await OpsRouteModel.findOne({ route }).lean();
  if (!doc) {
    const rows = Object.fromEntries(screen.tabs.map((tab) => [tab, []]));
    await OpsRouteModel.create({ route, rows, stage: {}, log: {} });
    doc = await OpsRouteModel.findOne({ route }).lean();
  }
  if (!doc) throw AppError.internal('Could not seed ops route');
  return { rows: doc.rows, stage: doc.stage ?? {}, log: doc.log ?? {} };
}

async function saveRoute(route: string, state: OpsRouteState): Promise<OpsRouteState> {
  await OpsRouteModel.updateOne({ route }, { $set: { rows: state.rows, stage: state.stage, log: state.log } }, { upsert: true });
  return state;
}

async function audit(route: string, action: string, id: string, by: string, note?: string): Promise<void> {
  await recordAuditLog({
    module: route.startsWith('stall') ? 'container-stalls' : 'delivery',
    action,
    entityType: screenOf(route).entity,
    entityId: id,
    details: { by, note, route },
  });
}

function emit(route: string, record: FlatRecord): void {
  const io = getIO();
  if (!io) return;
  if (route === 'deliveries') io.to('admin').emit('delivery.updated', record);
  if (route === 'bd-track') io.to('admin').emit('bulk.vehicle.position', record);
  if (route === 'bd-stops') io.to('admin').emit('bulk.stop.updated', record);
  if (route === 'bd-exceptions') io.to('admin').emit('bulk.exception.raised', record);
  if (route === 'stall-conv') io.to('admin').emit('stall.conversion.updated', record);
}

export interface ListQuery {
  tab?: string;
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

function tabName(screen: ScreenSeed, tab?: string): string | undefined {
  if (!tab) return undefined;
  const hit = screen.tabs.find((name) => actionSlug(name) === tab || name === tab);
  return hit;
}

export async function listRecords(route: string, query: ListQuery) {
  if (/^stall-/.test(route) || route === 'stalls') {
    const { hydrateLiveRoute } = await import('./ops-live');
    await hydrateLiveRoute(route);
  }
  const screen = screenOf(route);
  const state = await ensureRoute(route);
  const tab = tabName(screen, query.tab);
  if (query.tab && !tab) throw AppError.badRequest(`Unknown tab "${query.tab}"`);
  let rows = uniqueRows(state, tab);
  const q = (query.q ?? '').trim().toLowerCase();
  if (q) {
    rows = rows.filter((row) => row.some((cell) => cellText(cell).toLowerCase().includes(q)));
  }
  if (query.status) {
    const last = screen.columns.length - 1;
    rows = rows.filter((row) => cellText(row[last]) === query.status);
  }
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(query.pageSize) || 25));
  const total = rows.length;
  const slice = rows.slice((page - 1) * pageSize, page * pageSize);
  return {
    items: slice.map((row) => toRecord(route, row, state)),
    total,
    page,
    pageSize,
    tabCounts: tabCounts(state),
  };
}

export async function getRecord(route: string, id: string): Promise<FlatRecord> {
  const state = await ensureRoute(route);
  const row = findRow(state, id);
  if (!row) throw AppError.notFound(screenOf(route).entity, id);
  return toRecord(route, row, state);
}

export async function getRouteState(route: string): Promise<OpsRouteState> {
  const { hydrateLiveRoute } = await import('./ops-live');
  return hydrateLiveRoute(route);
}

function rowFromBody(screen: ScreenSeed, body: Record<string, unknown>, previous?: Row): Row {
  return screen.columns.map((col, i) => {
    if (i === screen.columns.length - 1) {
      const status = body.status;
      if (status && typeof status === 'object' && status && 'label' in status) {
        const s = status as { label: string; tone?: Tone };
        return { label: String(s.label), tone: s.tone ?? 'grey' };
      }
      if (typeof status === 'string') return { label: status, tone: 'grey' as Tone };
      return previous?.[i] ?? { label: 'Planned', tone: 'grey' as Tone };
    }
    const key = i === 0 ? 'id' : camel(col);
    const raw = body[key];
    if (raw == null || raw === '') return previous?.[i] ?? '—';
    return String(raw);
  });
}

export async function saveRecordRow(route: string, tab: string, id: string | undefined, row: Row, by: string, note?: string): Promise<OpsRouteState> {
  const screen = screenOf(route);
  const newId = recordId(row);
  if (!newId || newId === '—') throw AppError.badRequest(`${screen.columns[0]} is required`);
  let state = await ensureRoute(route);
  if (id) {
    if (!findRow(state, id)) throw AppError.notFound(screen.entity, id);
    state = mapRows(state, [id], (old) => row.map((cell, i) => (cell === '' ? old[i] ?? '—' : cell)));
  } else {
    if (findRow(state, newId)) throw AppError.conflict(`${screen.entity} ${newId} already exists`, 'DUPLICATE_KEY');
    const target = screen.tabs.includes(tab) ? tab : screen.tabs[0]!;
    const first = screen.tabs[0]!;
    state.rows[first] = [row, ...(state.rows[first] ?? [])];
    if (target !== first) state.rows[target] = [row, ...(state.rows[target] ?? [])];
  }
  const prior = state.log[id ?? newId] ?? [];
  state.log[newId] = [logEntry(id ? 'Record updated' : 'Record created', by, note), ...prior];
  await saveRoute(route, state);
  await audit(route, id ? 'update' : 'create', newId, by, note);
  return state;
}

export async function createRecord(route: string, body: Record<string, unknown>, by: string): Promise<FlatRecord> {
  const screen = screenOf(route);
  if (!screen.cap.includes('c')) throw AppError.forbidden(`${screen.entity} cannot be created here`);
  const state = await ensureRoute(route);
  const row = rowFromBody(screen, body);
  const id = recordId(row);
  if (!id || id === '—') throw AppError.badRequest(`${screen.columns[0]} is required`, [{ field: 'id', message: 'Required' }]);
  if (findRow(state, id)) throw AppError.conflict(`${screen.entity} ${id} already exists`, 'DUPLICATE_KEY');
  const first = screen.tabs[0]!;
  state.rows[first] = [row, ...(state.rows[first] ?? [])];
  state.log[id] = [logEntry('Record created', by)];
  state.stage[id] = 0;
  await saveRoute(route, state);
  await audit(route, 'create', id, by);
  const rec = toRecord(route, row, state);
  emit(route, rec);
  return rec;
}

export async function patchRecord(route: string, id: string, body: Record<string, unknown>, by: string): Promise<FlatRecord> {
  const screen = screenOf(route);
  if (!screen.cap.includes('u') && screen.cap !== '') {
    // read-only screens still allow the documented PATCH that writes activity
  }
  let state = await ensureRoute(route);
  if (!findRow(state, id)) throw AppError.notFound(screen.entity, id);
  state = mapRows(state, [id], (old) => rowFromBody(screen, { ...flatten(route, old, state), ...body, id }, old));
  const row = findRow(state, id)!;
  state.log[recordId(row)] = [logEntry('Record updated', by), ...(state.log[id] ?? [])];
  await saveRoute(route, state);
  await audit(route, 'update', id, by);
  return toRecord(route, row, state);
}

function flatten(route: string, row: Row, state: OpsRouteState): Record<string, unknown> {
  return toRecord(route, row, state);
}

export async function deleteRecord(route: string, id: string, by: string): Promise<void> {
  let state = await ensureRoute(route);
  if (!findRow(state, id)) throw AppError.notFound(screenOf(route).entity, id);
  state = mapRows(state, [id], () => null);
  delete state.log[id];
  delete state.stage[id];
  await saveRoute(route, state);
  await audit(route, 'delete', id, by);
}

function assertFields(action: string, values: Record<string, string>): void {
  const form = FORMS[action];
  if (!form) return;
  const missing = form.fields.find((f) => f.required && !(values[f.id] ?? '').trim());
  if (missing) {
    throw AppError.badRequest(`${missing.label} is required`, [{ field: missing.id, message: `${missing.label} is required` }]);
  }
}

function checklistFailed(values: Record<string, string>): boolean {
  return Object.entries(values).some(([k, val]) => k !== 'note' && /^No/.test(val));
}

function assertDispatchReady(row: Row): void {
  const vehicle = cellText(row[2]);
  const operator = cellText(row[3]);
  if (!vehicle || vehicle === '—' || !operator || operator === '—') {
    throw AppError.conflict('Dispatch is blocked until a vehicle and an operator are assigned', 'DISPATCH_BLOCKED');
  }
  if (/checklist failed/i.test(cellText(row[row.length - 1]))) {
    throw AppError.conflict('Run the dispatch checklist with every item Yes before dispatch', 'CHECKLIST_FAILED');
  }
}

function assertEmployeeFree(state: OpsRouteState, stallId: string, who: string): void {
  const name = who.replace(/^EMP-\d+\s*/, '').trim();
  if (!name || /new hire/i.test(name)) return;
  for (const list of Object.values(state.rows)) {
    for (const row of list) {
      if (recordId(row) === stallId) continue;
      const employee = cellText(row[3]);
      const status = cellText(row[row.length - 1]);
      if (employee === name && /active/i.test(status)) {
        throw AppError.conflict(`${name} already holds an active stall (${recordId(row)})`, 'EMPLOYEE_ASSIGNED');
      }
    }
  }
}

async function sideEffects(
  route: string,
  action: string,
  ids: string[],
  values: Record<string, string>,
  by: string,
  before: OpsRouteState,
): Promise<void> {
  if (route === 'bd-queue' && action === 'Group into batch') {
    const batches = await ensureRoute('bd-batches');
    const id = `BDB-${Date.now().toString().slice(-4)}`;
    const row: Row = [
      id,
      values.area || '—',
      '—',
      '—',
      values.orders || String(ids.length),
      '0',
      '—',
      { label: 'Awaiting vehicle', tone: 'amber' },
    ];
    const first = screenOf('bd-batches').tabs[0]!;
    batches.rows[first] = [row, ...(batches.rows[first] ?? [])];
    batches.log[id] = [logEntry('Batch created from queue', by, ids.join(', '))];
    batches.stage[id] = 1;
    await saveRoute('bd-batches', batches);
  }

  if (route === 'stalls' && action === 'Deactivate stall') {
    const staff = await ensureRoute('stall-staff');
    for (const stallId of ids) {
      const previousName = cellText(findRow(before, stallId)?.[3]);
      if (!previousName || previousName === '—') continue;
      const next = mapRows(staff, staffIdsNamed(staff, previousName), (row) => {
        const copy = [...row];
        copy[2] = '—';
        copy[copy.length - 1] = { label: 'Unassigned', tone: 'amber' };
        return copy;
      });
      for (const staffId of staffIdsNamed(staff, previousName)) {
        next.log[staffId] = [logEntry('Unassigned — stall deactivated', by, stallId), ...(next.log[staffId] ?? [])];
      }
      await saveRoute('stall-staff', next);
    }
  }

  if (route === 'stall-conv' && action === 'Flag as invalid') {
    const earnings = await ensureRoute('stall-earnings');
    const conv = await ensureRoute('stall-conv');
    const row = findRow(conv, ids[0] ?? '');
    const employee = row ? cellText(row[2] ?? row[1]) : '';
    if (employee && employee !== '—') {
      const matched = uniqueRows(earnings)
        .filter((r) => r.some((c) => cellText(c).includes(employee)))
        .map(recordId);
      if (matched.length) {
        for (const id of matched) {
          earnings.log[id] = [logEntry('Incentive reversed', by, `Conversion ${ids[0]} flagged invalid`), ...(earnings.log[id] ?? [])];
        }
        await saveRoute('stall-earnings', earnings);
      }
    }
  }
}

function staffIdsNamed(state: OpsRouteState, name: string): string[] {
  return uniqueRows(state)
    .filter((row) => cellText(row[0]).includes(name) || cellText(row[1]) === name)
    .map(recordId);
}

export async function applyAction(
  route: string,
  ids: string[],
  action: string,
  values: Record<string, string>,
  by: string,
): Promise<FlatRecord[]> {
  const screen = screenOf(route);
  if (!ids.length) throw AppError.badRequest('ids is required', [{ field: 'ids', message: 'Select at least one record' }]);
  assertFields(action, values);
  const effect = OPS_EFFECTS[route]?.[action];
  const form = FORMS[action];
  let advances = Boolean(form?.advances);
  if (action === 'Run dispatch checklist' && checklistFailed(values)) advances = false;

  const before = await ensureRoute(route);
  const last = screen.columns.length - 1;
  const missing = ids.filter((id) => !findRow(before, id));
  if (missing.length) throw AppError.notFound(screen.entity, missing[0]);

  if (effect?.status && !AFTER_CLOSE.test(action)) {
    const closed = ids.filter((id) => TERMINAL.test(cellText(findRow(before, id)?.[last])));
    if (closed.length) {
      const which = closed.map((id) => `${id} (${cellText(findRow(before, id)?.[last])})`).join(', ');
      throw AppError.conflict(`${action} isn't possible — already closed: ${which}. Nothing was changed.`, 'RECORD_CLOSED');
    }
  }

  if (route === 'bd-batches' && action === 'Dispatch batch') {
    for (const id of ids) assertDispatchReady(findRow(before, id)!);
  }
  if (route === 'stalls' && action === 'Assign employee') {
    for (const id of ids) assertEmployeeFree(before, id, values.who ?? '');
  }
  if (route === 'vehicles' && action === 'Assign driver') {
    for (const id of ids) {
      const status = cellText(findRow(before, id)?.[last]);
      if (/charg|service|document|retired/i.test(status)) {
        throw AppError.conflict(`${id} cannot be assigned while ${status}`, 'VEHICLE_UNAVAILABLE');
      }
    }
  }
  if (route === 'bd-ops' && action === 'Assign batch') {
    for (const id of ids) {
      const licence = cellText(findRow(before, id)?.[1]);
      if (/expired/i.test(licence)) throw AppError.conflict(`${id} has an expired licence`, 'LICENCE_EXPIRED');
    }
  }

  // Real route geometry: Optimise route reorders stops via haversine NN (not a label-only flip).
  if (route === 'bd-route' && /^Optimise route$/i.test(action)) {
    const { optimizeRouteStops } = await import('./ops-live');
    await optimizeRouteStops(route, ids, by);
    const fresh = await ensureRoute(route);
    return ids.map((id) => {
      const row = findRow(fresh, id);
      if (!row) throw AppError.notFound(screen.entity, id);
      return toRecord(route, row, fresh);
    });
  }

  // Zone eligibility when grouping into bulk batches
  if (route === 'bd-queue' && /group into batch|add to existing batch/i.test(action)) {
    const { assertPointInActiveZone } = await import('./ops-live');
    const { Order } = await import('../orders/order.model');
    for (const id of ids) {
      const row = findRow(before, id)!;
      const eligibility = cellText(row[row.length - 1]);
      if (/not eligible|outside zone/i.test(eligibility)) {
        throw AppError.conflict(`${id} is not zone-eligible for bulk delivery`, 'ZONE_INELIGIBLE');
      }
      const order = await Order.findOne({
        $or: [{ orderId: id }, { orderId: id.replace(/^SEL-/, '') }],
      })
        .select('deliveryAddress')
        .lean();
      const addr = (order as { deliveryAddress?: { latitude?: number; longitude?: number } } | null)?.deliveryAddress;
      await assertPointInActiveZone(addr?.latitude, addr?.longitude);
    }
  }

  let state = before;
  if (effect) {
    state = mapRows(state, ids, (row) => {
      if (effect.remove) return null;
      const next = [...row];
      for (const [col, fn] of Object.entries(effect.set ?? {})) {
        next[Number(col)] = fn(values, row) || cellText(row[Number(col)]);
      }
      if (effect.status) {
        const [label, tone] = typeof effect.status === 'function' ? effect.status(values) : effect.status;
        next[last] = { label, tone };
      }
      return next;
    });
  }

  const labels = Object.fromEntries((form?.fields ?? []).map((f) => [f.id, f.label]));
  const note = summary(values, labels);
  for (const id of ids) {
    if (!findRow(state, id) && effect?.remove) {
      state.log[id] = [logEntry(action, by, note || undefined), ...(state.log[id] ?? [])];
      continue;
    }
    if (advances && screen.flow.length) {
      const current = state.stage[id] ?? defaultStage(screen, findRow(before, id));
      state.stage[id] = Math.min(current + 1, screen.flow.length - 1);
    }
    state.log[id] = [logEntry(action, by, note || undefined), ...(state.log[id] ?? [])];
  }

  await saveRoute(route, state);
  await sideEffects(route, action, ids, values, by, before);

  // Auto-raise Delivery Exceptions when a live delivery is marked failed
  if (route === 'deliveries' && /^Mark failed$/i.test(action)) {
    const { raiseExceptionFromDelivery } = await import('./ops-live');
    for (const id of ids) {
      await raiseExceptionFromDelivery(id, values, by).catch(() => undefined);
    }
  }

  for (const id of ids) await audit(route, actionSlug(action), id, by, note);

  const fresh = await ensureRoute(route);
  const records = ids.map((id) => {
    const row = findRow(fresh, id);
    return row ? toRecord(route, row, fresh) : ({ id, status: { label: 'Removed', tone: 'grey' }, stage: fresh.stage[id] ?? 0, activity: fresh.log[id] ?? [] } as FlatRecord);
  });
  for (const rec of records) emit(route, rec);
  return records;
}

export async function advanceStage(route: string, id: string, by: string): Promise<FlatRecord> {
  const screen = screenOf(route);
  const state = await ensureRoute(route);
  const row = findRow(state, id);
  if (!row) throw AppError.notFound(screen.entity, id);
  const last = screen.columns.length - 1;
  if (TERMINAL.test(cellText(row[last]))) {
    throw AppError.conflict(`${id} is already closed. Nothing was changed.`, 'RECORD_CLOSED');
  }
  if (!screen.flow.length) throw AppError.badRequest('This screen has no flow to advance');
  const current = state.stage[id] ?? defaultStage(screen, row);
  const next = Math.min(current + 1, screen.flow.length - 1);
  const step = screen.flow[next]?.label ?? 'Next stage';
  state.stage[id] = next;
  state.log[id] = [logEntry(`Marked ${step}`, by), ...(state.log[id] ?? [])];
  await saveRoute(route, state);
  await audit(route, 'advance', id, by, step);
  return toRecord(route, row, state);
}

export async function exportCsv(route: string, query: ListQuery): Promise<string> {
  const listed = await listRecords(route, { ...query, page: 1, pageSize: 500 });
  const screen = screenOf(route);
  const headers = ['id', ...screen.columns.slice(1, -1).map(camel), 'status', 'stage'];
  const lines = [headers.join(',')];
  for (const item of listed.items) {
    const cells = headers.map((h) => {
      const raw = h === 'status' ? item.status.label : item[h];
      const text = String(raw ?? '').replace(/"/g, '""');
      return `"${text}"`;
    });
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

/** Live KPIs from persisted route rows — never returns design-seed vanity numbers. */
export async function kpis(route: string) {
  const { computeLiveKpis } = await import('./ops-live');
  return computeLiveKpis(route);
}

/** Collection-level incentive preview. Amounts come from active rule cards. */
export async function previewIncentive(input: Record<string, string>) {
  const state = await ensureRoute('stall-incentives');
  const screen = screenOf('stall-incentives');
  const amountCol = screen.columns.findIndex((c) => /amount|payout|incentive/i.test(c));
  const metricCol = screen.columns.findIndex((c) => /metric/i.test(c));
  const active = uniqueRows(state).filter((row) => /active/i.test(cellText(row[row.length - 1])));
  const orders = Number(String(input.orders ?? input.firstOrders ?? '0').replace(/[^\d.]/g, '')) || 0;
  const registrations = Number(String(input.registrations ?? '0').replace(/[^\d.]/g, '')) || 0;
  const lines = active.map((row) => {
    const per = amountCol >= 0 ? parseInt(cellText(row[amountCol]).replace(/[^\d]/g, ''), 10) || 0 : 0;
    const metric = metricCol >= 0 ? cellText(row[metricCol]).toLowerCase() : '';
    const qty = /regist/.test(metric) ? registrations : /order|first/.test(metric) ? orders : 0;
    return { ruleId: recordId(row), version: cellText(row.find((_, i) => /version/i.test(screen.columns[i] ?? '')) ?? row[0]), amount: per * (qty || 1) };
  });
  return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0) };
}

/** Releases every approved earning onto the salary run. */
export async function releaseEarnings(body: Record<string, string>, by: string): Promise<FlatRecord[]> {
  const month = body.month || body.salaryMonth;
  const date = body.date || body.payDate;
  const method = body.method;
  if (!month || !date || !method) {
    throw AppError.badRequest('Salary month, pay date and method are required');
  }
  const state = await ensureRoute('stall-earnings');
  const approved = uniqueRows(state)
    .filter((row) => /^approved\b/i.test(cellText(row[row.length - 1])))
    .map(recordId);
  if (!approved.length) return [];
  return applyAction('stall-earnings', approved, 'Release with salary', { month, date, method, note: body.note ?? '' }, by);
}

export async function ingestInteraction(body: { stallId?: string; employeeId?: string; at?: string }, by: string) {
  if (!body.stallId) throw AppError.badRequest('stallId is required', [{ field: 'stallId', message: 'Required' }]);
  const id = `INT-${crypto.randomUUID().slice(0, 8)}`;
  const state = await ensureRoute('stall-conv');
  const screen = screenOf('stall-conv');
  const row: Row = screen.columns.map((_, i) => {
    if (i === 0) return id;
    if (i === screen.columns.length - 1) return { label: 'Interaction', tone: 'blue' as Tone };
    return '—';
  });
  const stallCol = screen.columns.findIndex((c) => /^stall$/i.test(c));
  const empCol = screen.columns.findIndex((c) => /employee/i.test(c));
  if (stallCol > 0) row[stallCol] = body.stallId;
  if (empCol > 0) row[empCol] = body.employeeId || '—';
  const first = screen.tabs[0]!;
  state.rows[first] = [row, ...(state.rows[first] ?? [])];
  state.stage[id] = 0;
  state.log[id] = [logEntry('Customer interaction', by, body.at)];
  await saveRoute('stall-conv', state);
  return toRecord('stall-conv', row, state);
}

export async function ingestConversion(
  body: {
    interactionId?: string;
    stage?: string;
    customerRef?: string;
    at?: string;
    orderId?: string;
    orderNumber?: string;
  },
  by: string,
) {
  const stage = body.stage;
  const allowed = ['downloaded', 'registered', 'first_order', 'delivered'];
  if (!stage || !allowed.includes(stage)) {
    throw AppError.badRequest('stage must be downloaded, registered, first_order, or delivered');
  }
  if (!body.interactionId) throw AppError.badRequest('interactionId is required');
  const state = await ensureRoute('stall-conv');
  const row = findRow(state, body.interactionId);
  if (!row) throw AppError.notFound('Conversion', body.interactionId);
  const screen = screenOf('stall-conv');
  const labelMap: Record<string, string> = {
    downloaded: 'App downloaded',
    registered: 'Registered',
    first_order: 'First order placed',
    delivered: 'Delivered',
  };
  const label = labelMap[stage]!;
  const next = [...row];
  next[next.length - 1] = { label, tone: stage === 'delivered' || stage === 'first_order' ? 'green' : 'blue' };
  const orderRef = body.orderNumber || body.orderId;
  if (orderRef) {
    const orderCol = screen.columns.findIndex((c) => /first order|order/i.test(c));
    if (orderCol >= 0) next[orderCol] = orderRef;
  }
  const id = body.interactionId;
  const updated = mapRows(state, [id], () => next);
  const flowIndex = screen.flow.findIndex((f) =>
    f.label.toLowerCase().includes(
      stage === 'downloaded'
        ? 'download'
        : stage === 'registered'
          ? 'regist'
          : stage === 'delivered'
            ? 'delivered'
            : 'first order',
    ),
  );
  if (flowIndex >= 0) updated.stage[id] = flowIndex;
  updated.log[id] = [logEntry(label, by, body.customerRef || orderRef), ...(updated.log[id] ?? [])];
  await saveRoute('stall-conv', updated);
  const fresh = findRow(updated, id)!;
  const rec = toRecord('stall-conv', fresh, updated);
  emit('stall-conv', rec);

  if ((stage === 'first_order' || stage === 'delivered') && orderRef) {
    const stallCol = screen.columns.findIndex((c) => /^stall$/i.test(c));
    const empCol = screen.columns.findIndex((c) => /employee/i.test(c));
    try {
      const { attributeOrderToStall } = await import('./ops-live');
      await attributeOrderToStall({
        orderNumber: orderRef,
        stallId: stallCol >= 0 ? cellText(fresh[stallCol]) : '—',
        employeeId: empCol >= 0 ? cellText(fresh[empCol]) : undefined,
        conversionId: id,
        by,
      });
    } catch {
      /* order may not exist yet — conversion row still updated */
    }
  }
  return rec;
}
