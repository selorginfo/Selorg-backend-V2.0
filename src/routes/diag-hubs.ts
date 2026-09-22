import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { PickerWorkLocation, PickerUser } from '../modules/picker/picker.models';
import { ResponseFormatter } from '../utils/response';

export const diagHubRouter = Router();

diagHubRouter.get('/hubs', async (_req: Request, res: Response) => {
  const { ensureOperationalHubs } = await import('../modules/picker/picker.hub');
  await ensureOperationalHubs();
  const hubs = await PickerWorkLocation.find({})
    .select('warehouseKey name address _id')
    .lean();
  res.json(
    ResponseFormatter.success({
      hubs: hubs.map((h: any) => ({
        id: String(h._id),
        warehouseKey: h.warehouseKey,
        name: h.name,
      })),
    }),
  );
});

diagHubRouter.get('/resolve-hub', async (req: Request, res: Response) => {
  const raw = String(req.query.id || '').trim();
  let byId: any = null;
  if (mongoose.isValidObjectId(raw)) {
    byId = await PickerWorkLocation.findById(raw).select('warehouseKey name').lean();
  }
  const byKey = await PickerWorkLocation.findOne({ warehouseKey: raw }).select('warehouseKey name').lean();
  const { resolveWarehouseKey } = await import('../modules/picker/picker.hub');
  const resolved = await resolveWarehouseKey(raw, { fallbackToDefault: true });
  res.json(
    ResponseFormatter.success({
      input: raw,
      resolved,
      byId: byId
        ? { id: String(byId._id), warehouseKey: byId.warehouseKey, name: byId.name }
        : null,
      byKey: byKey
        ? { id: String((byKey as any)._id), warehouseKey: (byKey as any).warehouseKey, name: (byKey as any).name }
        : null,
    }),
  );
});

diagHubRouter.post('/normalize-rider-hub', async (req: Request, res: Response) => {
  const pickerId = String(req.body?.pickerId || req.query.pickerId || '').trim();
  if (!pickerId || !mongoose.isValidObjectId(pickerId)) {
    res.status(400).json(ResponseFormatter.error('pickerId required', 400));
    return;
  }
  const { normalizeRiderHubKey } = await import('../modules/picker/picker.hub');
  const before = await PickerUser.findById(pickerId).select('currentLocationId isOnline name').lean();
  if (!before) {
    res.status(404).json(ResponseFormatter.error('Rider not found', 404));
    return;
  }
  const next = await normalizeRiderHubKey(pickerId, (before as any).currentLocationId);
  if (req.body?.setOnline === true) {
    await PickerUser.updateOne(
      { _id: new mongoose.Types.ObjectId(pickerId) },
      { $set: { isOnline: true, onlineSince: new Date() } },
    );
  }
  const after = await PickerUser.findById(pickerId).select('currentLocationId isOnline').lean();
  const { listAvailableOrders } = await import('../modules/picker/picker.order.service');
  let preview: unknown = null;
  try {
    preview = await listAvailableOrders(pickerId, { scope: 'all', page: 1, limit: 20 });
  } catch (err) {
    preview = { error: (err as Error).message };
  }
  res.json(
    ResponseFormatter.success({
      pickerId,
      name: (before as any).name || null,
      before: (before as any).currentLocationId ?? null,
      after: (after as any)?.currentLocationId ?? null,
      resolved: next,
      isOnline: Boolean((after as any)?.isOnline),
      availablePreview: preview,
    }),
  );
});
