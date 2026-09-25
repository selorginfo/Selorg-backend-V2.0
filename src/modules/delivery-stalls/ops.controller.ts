import type { Request, Response, NextFunction } from 'express';
import { sendControllerError } from '../../utils/controller-error';
import { ResponseFormatter } from '../../utils/response';
import { actor, assertCanDelete, assertOpsAccess } from './ops-access';
import type { ResourceMount } from './ops-catalog';
import type { Row } from './ops-types';
import {
  advanceStage,
  applyAction,
  createRecord,
  deleteRecord,
  exportCsv,
  getRecord,
  getRouteState,
  ingestConversion,
  ingestInteraction,
  kpis,
  listRecords,
  patchRecord,
  previewIncentive,
  releaseEarnings,
  saveRecordRow,
  screenOf,
  slugToAction,
} from './ops-store';

function queryOf(req: Request) {
  return {
    tab: req.query.tab ? String(req.query.tab) : undefined,
    q: req.query.q ? String(req.query.q) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
  };
}

function valuesOf(body: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'ids') continue;
    if (v == null) continue;
    out[k] = String(v);
  }
  return out;
}

export function bindResource(mount: ResourceMount) {
  const route = mount.route;
  return {
    list: async (req: Request, res: Response, next: NextFunction) => {
      try {
        assertOpsAccess(req, route, 'view');
        const data = await listRecords(route, queryOf(req));
        res.json(ResponseFormatter.success(data));
      } catch (err) { next(err); }
    },
    kpis: async (req: Request, res: Response, next: NextFunction) => {
      try {
        assertOpsAccess(req, route, 'view');
        res.json(ResponseFormatter.success(await kpis(route)));
      } catch (err) { next(err); }
    },
    export: async (req: Request, res: Response, next: NextFunction) => {
      try {
        assertOpsAccess(req, route, 'view');
        const csv = await exportCsv(route, queryOf(req));
        const format = String(req.query.format || 'csv');
        if (format !== 'csv') {
          res.json(ResponseFormatter.success({ format, csv }));
          return;
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${route}.csv"`);
        res.send(csv);
      } catch (err) { next(err); }
    },
    get: async (req: Request, res: Response, next: NextFunction) => {
      try {
        assertOpsAccess(req, route, 'view');
        const data = await getRecord(route, String(req.params[mount.idParam]));
        res.json(ResponseFormatter.success(data));
      } catch (err) { next(err); }
    },
    create: async (req: Request, res: Response, next: NextFunction) => {
      try {
        assertOpsAccess(req, route, 'mutate');
        const data = await createRecord(route, req.body ?? {}, actor(req));
        res.status(201).json(ResponseFormatter.success(data, 'Created'));
      } catch (err) { next(err); }
    },
    patch: async (req: Request, res: Response, next: NextFunction) => {
      try {
        assertOpsAccess(req, route, 'mutate');
        const data = await patchRecord(route, String(req.params[mount.idParam]), req.body ?? {}, actor(req));
        res.json(ResponseFormatter.success(data, 'Updated'));
      } catch (err) { next(err); }
    },
    remove: async (req: Request, res: Response, next: NextFunction) => {
      try {
        assertCanDelete(req, route);
        await deleteRecord(route, String(req.params[mount.idParam]), actor(req));
        res.json(ResponseFormatter.success({ id: req.params[mount.idParam] }, 'Deleted'));
      } catch (err) { next(err); }
    },
    advance: async (req: Request, res: Response, next: NextFunction) => {
      try {
        assertOpsAccess(req, route, 'mutate');
        const data = await advanceStage(route, String(req.params[mount.idParam]), actor(req));
        res.json(ResponseFormatter.success(data));
      } catch (err) { next(err); }
    },
    action: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const label = slugToAction(route, String(req.params.action));
        assertOpsAccess(req, route, 'mutate', label);
        const records = await applyAction(route, [String(req.params[mount.idParam])], label, valuesOf(req.body ?? {}), actor(req));
        res.json(ResponseFormatter.success(records[0]));
      } catch (err) { next(err); }
    },
    bulk: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const label = slugToAction(route, String(req.params.action));
        assertOpsAccess(req, route, 'mutate', label);
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
        const records = await applyAction(route, ids, label, valuesOf(req.body ?? {}), actor(req));
        res.json(ResponseFormatter.success({ items: records }));
      } catch (err) { next(err); }
    },
  };
}

export async function getOpsRoute(req: Request, res: Response, next: NextFunction) {
  try {
    const route = String(req.params.route);
    screenOf(route);
    assertOpsAccess(req, route, 'view');
    res.json(ResponseFormatter.success(await getRouteState(route)));
  } catch (err) { next(err); }
}

export async function getOpsRouteKpis(req: Request, res: Response, next: NextFunction) {
  try {
    const route = String(req.params.route);
    screenOf(route);
    assertOpsAccess(req, route, 'view');
    res.json(ResponseFormatter.success(await kpis(route)));
  } catch (err) { next(err); }
}

export async function postRoutingCalculate(req: Request, res: Response, next: NextFunction) {
  try {
    assertOpsAccess(req, 'bd-route', 'view');
    const { calculateRoutePreview } = await import('./ops-live');
    const stops = Array.isArray(req.body?.stops) ? req.body.stops : [];
    const normalized = stops
      .map((s: { lat?: number; lng?: number; latitude?: number; longitude?: number; id?: string }) => ({
        lat: Number(s.lat ?? s.latitude),
        lng: Number(s.lng ?? s.longitude),
        id: s.id ? String(s.id) : undefined,
      }))
      .filter((s: { lat: number; lng: number }) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    res.json(ResponseFormatter.success(calculateRoutePreview(normalized)));
  } catch (err) { next(err); }
}

export async function postOpsAction(req: Request, res: Response, next: NextFunction) {
  try {
    const route = String(req.params.route);
    screenOf(route);
    assertOpsAccess(req, route, 'mutate', String(req.body?.action ?? ''));
    await applyAction(route, (req.body?.ids ?? []).map(String), String(req.body?.action ?? ''), valuesOf(req.body?.values ?? {}), actor(req));
    res.json(ResponseFormatter.success(await getRouteState(route)));
  } catch (err) { next(err); }
}

export async function postOpsSave(req: Request, res: Response, next: NextFunction) {
  try {
    const route = String(req.params.route);
    screenOf(route);
    assertOpsAccess(req, route, 'mutate');
    const by = actor(req);
    const row = req.body?.row as Row | undefined;
    if (row) {
      await saveRecordRow(route, String(req.body?.tab ?? ''), req.body?.id ? String(req.body.id) : undefined, row, by, req.body?.note);
    } else if (req.body?.id) {
      await patchRecord(route, String(req.body.id), req.body.fields ?? {}, by);
    } else {
      await createRecord(route, req.body?.fields ?? req.body ?? {}, by);
    }
    res.json(ResponseFormatter.success(await getRouteState(route)));
  } catch (err) { next(err); }
}

export async function deleteOpsRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const route = String(req.params.route);
    assertCanDelete(req, route);
    await deleteRecord(route, String(req.params.id), actor(req));
    res.json(ResponseFormatter.success(await getRouteState(route)));
  } catch (err) { next(err); }
}

export async function postOpsAdvance(req: Request, res: Response, next: NextFunction) {
  try {
    const route = String(req.params.route);
    assertOpsAccess(req, route, 'mutate');
    await advanceStage(route, String(req.params.id), actor(req));
    res.json(ResponseFormatter.success(await getRouteState(route)));
  } catch (err) { next(err); }
}

export async function postPreview(req: Request, res: Response, next: NextFunction) {
  try {
    assertOpsAccess(req, 'stall-incentives', 'view');
    res.json(ResponseFormatter.success(await previewIncentive(valuesOf(req.body ?? {}))));
  } catch (err) { next(err); }
}

export async function postRelease(req: Request, res: Response, next: NextFunction) {
  try {
    assertOpsAccess(req, 'stall-earnings', 'approve', 'Release with salary');
    const items = await releaseEarnings(valuesOf(req.body ?? {}), actor(req));
    res.json(ResponseFormatter.success({ items }));
  } catch (err) { next(err); }
}

export async function postInteraction(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await ingestInteraction(req.body ?? {}, actor(req));
    res.status(201).json(ResponseFormatter.success(data, 'Interaction recorded'));
  } catch (err) { sendControllerError(res, err); }
}

export async function postConversion(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await ingestConversion(req.body ?? {}, actor(req));
    res.json(ResponseFormatter.success(data, 'Conversion updated'));
  } catch (err) { next(err); }
}

export async function postAttributeOrder(req: Request, res: Response, next: NextFunction) {
  try {
    assertOpsAccess(req, 'stall-orders', 'mutate');
    const { attributeOrderToStall } = await import('./ops-live');
    const body = req.body ?? {};
    const data = await attributeOrderToStall({
      orderNumber: String(body.orderNumber || body.orderId || '__seed__'),
      stallId: String(body.stallId || ''),
      employeeId: body.employeeId ? String(body.employeeId) : undefined,
      conversionId: body.conversionId ? String(body.conversionId) : undefined,
      areaId: body.areaId ? String(body.areaId) : undefined,
      by: actor(req),
      seedIfMissing: body.seedIfMissing === true || body.seed === true || !body.orderNumber,
    });
    res.json(ResponseFormatter.success(data, 'Order attributed to stall'));
  } catch (err) { next(err); }
}
