import type { Request, Response } from 'express';
import mongoose, { Schema } from 'mongoose';

export interface IOpsItem {
  kind: string;
  key?: string | null;
  method: string;
  path: string;
  payload: Record<string, unknown>;
  actor?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const OpsItemSchema = new Schema<IOpsItem>(
  {
    kind: { type: String, required: true, index: true },
    key: { type: String, default: null, index: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    actor: { type: String, default: null },
    status: { type: String, default: 'recorded', index: true },
  },
  { timestamps: true, collection: 'ops_actions' },
);

OpsItemSchema.index({ kind: 1, createdAt: -1 });

export const OpsItem =
  (mongoose.models.OpsItem as mongoose.Model<IOpsItem>) ||
  mongoose.model<IOpsItem>('OpsItem', OpsItemSchema);

function slugKind(what: string): string {
  return String(what || 'ops')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'ops';
}

function actorOf(req: Request): string | null {
  const user = (req as Request & { user?: { userId?: string; email?: string; name?: string } }).user;
  return user?.userId || user?.email || user?.name || null;
}

function paramKey(req: Request): string | null {
  const params = req.params || {};
  const first = Object.values(params).find((v) => v != null && String(v).length > 0);
  return first != null ? String(first) : null;
}

export async function recordOpsAction(
  req: Request,
  what: string,
  extra: Record<string, unknown> = {},
): Promise<IOpsItem> {
  const kind = slugKind(what);
  const key = paramKey(req);
  const payload = {
    ...(typeof req.body === 'object' && req.body ? (req.body as Record<string, unknown>) : {}),
    query: req.query || {},
    ...extra,
  };

  if (req.method === 'GET') {
    if (key) {
      const existing = await OpsItem.findOne({ kind, key }).sort({ createdAt: -1 }).lean();
      if (existing) return existing as IOpsItem;
    }
    const list = await OpsItem.find({ kind }).sort({ createdAt: -1 }).limit(200).lean();
    return {
      kind,
      key,
      method: 'GET',
      path: req.originalUrl || req.path,
      payload: { items: list, total: list.length },
      actor: actorOf(req),
      status: 'ok',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as IOpsItem;
  }

  if (req.method === 'DELETE' && key) {
    const deleted = await OpsItem.findOneAndUpdate(
      { kind, key },
      { $set: { status: 'deleted', payload, actor: actorOf(req) } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    if (deleted) {
      deleted.kind = kind;
      deleted.method = 'DELETE';
      deleted.path = req.originalUrl || req.path;
      await deleted.save();
      return deleted;
    }
  }

  const doc = await OpsItem.create({
    kind,
    key,
    method: req.method,
    path: req.originalUrl || req.path,
    payload,
    actor: actorOf(req),
    status: req.method === 'DELETE' ? 'deleted' : 'recorded',
  });
  return doc;
}

/** Replaces 501 stubs: GET returns stored records; writes persist to Mongo. */
export async function completeOpsAction(req: Request, res: Response, what: string, extra?: Record<string, unknown>): Promise<void> {
  const item = await recordOpsAction(req, what, extra);
  const payload = (item.payload || {}) as Record<string, unknown>;
  const data = Array.isArray(payload.items) ? payload.items : item;
  const total = typeof payload.total === 'number' ? payload.total : undefined;
  res.status(req.method === 'POST' ? 201 : 200).json({
    success: true,
    data,
    ...(total != null ? { total } : {}),
    message: `${what} ${req.method === 'GET' ? 'loaded' : 'saved'}`,
  });
}
