import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as storeWarehouseService from './store-warehouse.service';

export async function listStores(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, status, cityId, zoneId, type, page, limit } = req.query as Record<string, string | undefined>;
    const result = await storeWarehouseService.listStores({ search, status, cityId, zoneId, type, page, limit });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await storeWarehouseService.getStore(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function createStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(ResponseFormatter.success(await storeWarehouseService.createStore(req.body as storeWarehouseService.StoreInput)));
  } catch (err) {
    next(err);
  }
}

export async function updateStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await storeWarehouseService.updateStore(req.params.id, req.body as storeWarehouseService.StoreInput)));
  } catch (err) {
    next(err);
  }
}

export async function deleteStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await storeWarehouseService.deleteStore(req.params.id);
    res.json(ResponseFormatter.success(null, result.message));
  } catch (err) {
    next(err);
  }
}

export async function listWarehouses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, status, page, limit } = req.query as Record<string, string | undefined>;
    const result = await storeWarehouseService.listWarehouses({ search, status, page, limit });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await storeWarehouseService.getWarehouse(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function createWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(ResponseFormatter.success(await storeWarehouseService.createWarehouse(req.body as storeWarehouseService.StoreInput)));
  } catch (err) {
    next(err);
  }
}

export async function updateWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await storeWarehouseService.updateWarehouse(req.params.id, req.body as storeWarehouseService.StoreInput)));
  } catch (err) {
    next(err);
  }
}

export async function deleteWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await storeWarehouseService.deleteWarehouse(req.params.id);
    res.json(ResponseFormatter.success(null, result.message));
  } catch (err) {
    next(err);
  }
}

export async function getStorePerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await storeWarehouseService.getStorePerformance()));
  } catch (err) {
    next(err);
  }
}

export async function getStoreStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await storeWarehouseService.getStoreStats()));
  } catch (err) {
    next(err);
  }
}

// ── Staff CRUD ───────────────────────────────────────────────────────────────

export async function listStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Staff } = await import('../warehouse/warehouse.models');
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 20);
    const [items, total] = await Promise.all([
      Staff.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Staff.countDocuments(),
    ]);
    res.json(ResponseFormatter.success({ items, total, page, limit }));
  } catch (err) { next(err); }
}

export async function getStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Staff } = await import('../warehouse/warehouse.models');
    const item = await Staff.findById(req.params.id).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Staff not found' }); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
}

export async function createStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Staff } = await import('../warehouse/warehouse.models');
    const item = await Staff.create(req.body);
    res.status(201).json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
}

export async function updateStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Staff } = await import('../warehouse/warehouse.models');
    const body = { ...req.body };
    delete body._id;
    const item = await Staff.findByIdAndUpdate(req.params.id, { $set: body }, { new: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Staff not found' }); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
}

export async function deleteStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Staff } = await import('../warehouse/warehouse.models');
    await Staff.findByIdAndDelete(req.params.id);
    res.json(ResponseFormatter.success(null, 'Staff deleted'));
  } catch (err) { next(err); }
}

// ── Warehouse User Mappings ──────────────────────────────────────────────────

export async function listWarehouseUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { WarehouseStaffMapping } = await import('../warehouse/warehouse.models');
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 20);
    const filter: Record<string, unknown> = {};
    if (req.query.warehouseId) filter.warehouseId = req.query.warehouseId;
    const [items, total] = await Promise.all([
      WarehouseStaffMapping.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      WarehouseStaffMapping.countDocuments(filter),
    ]);
    res.json(ResponseFormatter.success({ items, total, page, limit }));
  } catch (err) { next(err); }
}

export async function getWarehouseUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { WarehouseStaffMapping } = await import('../warehouse/warehouse.models');
    const item = await WarehouseStaffMapping.findById(req.params.id).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Warehouse user mapping not found' }); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
}

export async function createWarehouseUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { WarehouseStaffMapping } = await import('../warehouse/warehouse.models');
    const { warehouseId, userId, role, status } = req.body as { warehouseId: string; userId: string; role: string; status?: boolean };
    if (!warehouseId || !userId || !role) {
      res.status(400).json({ success: false, message: 'warehouseId, userId and role are required' });
      return;
    }
    const item = await WarehouseStaffMapping.create({ warehouseId, userId, role, status: status ?? true });
    res.status(201).json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
}

export async function updateWarehouseUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { WarehouseStaffMapping } = await import('../warehouse/warehouse.models');
    const body = { ...req.body as Record<string, unknown> };
    delete body._id;
    const item = await WarehouseStaffMapping.findByIdAndUpdate(req.params.id, { $set: body }, { new: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Warehouse user mapping not found' }); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
}

export async function deleteWarehouseUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { WarehouseStaffMapping } = await import('../warehouse/warehouse.models');
    await WarehouseStaffMapping.findByIdAndDelete(req.params.id);
    res.json(ResponseFormatter.success(null, 'Warehouse user mapping removed'));
  } catch (err) { next(err); }
}

// ── Dark Store Staff ──────────────────────────────────────────────────────────

export async function listDarkStoreUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { DarkStoreStaff, DarkStore } = await import('../store/dark-store.model');
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 50);
    const filter: Record<string, unknown> = {};
    if (req.query.darkStoreId) filter.darkStoreId = req.query.darkStoreId;
    const [items, total] = await Promise.all([
      DarkStoreStaff.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      DarkStoreStaff.countDocuments(filter),
    ]);
    const storeIds = [...new Set(items.map((i) => String(i.darkStoreId)))];
    const stores = await DarkStore.find({ _id: { $in: storeIds } }).select('name code').lean();
    const storeMap = Object.fromEntries(stores.map((s) => [String(s._id), s]));
    const enriched = items.map((i) => ({
      ...i,
      darkStoreName: storeMap[String(i.darkStoreId)]?.name ?? null,
      darkStoreCode: storeMap[String(i.darkStoreId)]?.code ?? null,
    }));
    res.json(ResponseFormatter.success({ items: enriched, total, page, limit }));
  } catch (err) { next(err); }
}

export async function createDarkStoreUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { DarkStoreStaff } = await import('../store/dark-store.model');
    const { darkStoreId, name, email, phone, role, shift, isActive } = req.body as {
      darkStoreId: string; name: string; email: string; phone?: string;
      role: string; shift: string; isActive?: boolean;
    };
    if (!darkStoreId || !name || !email || !role || !shift) {
      res.status(400).json({ success: false, message: 'darkStoreId, name, email, role and shift are required' }); return;
    }
    const duplicate = await DarkStoreStaff.findOne({ darkStoreId, email: email.toLowerCase().trim() }).lean();
    if (duplicate) {
      res.status(409).json({ success: false, message: 'A staff member with this email already exists in this dark store' }); return;
    }
    if (role === 'manager') {
      const managerExists = await DarkStoreStaff.findOne({ darkStoreId, role: 'manager' }).lean();
      if (managerExists) {
        res.status(409).json({ success: false, message: 'This dark store already has a manager. Only one manager is allowed per store.' }); return;
      }
    }
    const item = await DarkStoreStaff.create({ darkStoreId, name, email, phone: phone ?? '', role, shift, isActive: isActive ?? true });
    res.status(201).json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
}

export async function updateDarkStoreUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { DarkStoreStaff } = await import('../store/dark-store.model');
    const body = { ...req.body as Record<string, unknown> };
    delete body._id;
    if (body.email) body.email = String(body.email).toLowerCase().trim();
    const item = await DarkStoreStaff.findByIdAndUpdate(req.params.id, { $set: body }, { new: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Dark store staff not found' }); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
}

export async function deleteDarkStoreUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { DarkStoreStaff } = await import('../store/dark-store.model');
    await DarkStoreStaff.findByIdAndDelete(req.params.id);
    res.json(ResponseFormatter.success(null, 'Dark store staff removed'));
  } catch (err) { next(err); }
}

// ── Warehouse Locations (schema-driven CRUD) ─────────────────────────────────

export async function listWarehouseLocations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { WarehouseLocation } = await import('../warehouse/warehouse.models');
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 20);
    const filter: Record<string, unknown> = {};
    if (req.query.status !== undefined) filter.status = req.query.status === 'true';
    if (req.query.type) filter.type = req.query.type;
    if (req.query.city) filter.city = { $regex: String(req.query.city), $options: 'i' };
    const [items, total] = await Promise.all([
      WarehouseLocation.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      WarehouseLocation.countDocuments(filter),
    ]);
    res.json(ResponseFormatter.success({ data: items, pagination: { page, limit, total } }));
  } catch (err) { next(err); }
}

export async function getWarehouseLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { WarehouseLocation } = await import('../warehouse/warehouse.models');
    const item = await WarehouseLocation.findById(req.params.id).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Warehouse not found' }); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
}

export async function createWarehouseLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { WarehouseLocation } = await import('../warehouse/warehouse.models');
    const body = req.body as Record<string, unknown>;
    const required = ['name', 'code', 'address', 'city', 'state', 'pincode', 'latitude', 'longitude'];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || String(body[field]).trim() === '') {
        res.status(400).json({ success: false, message: `${field} is required` });
        return;
      }
    }
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      res.status(400).json({ success: false, message: 'latitude must be between -90 and 90' }); return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      res.status(400).json({ success: false, message: 'longitude must be between -180 and 180' }); return;
    }
    const payload = {
      name: String(body.name).trim(),
      code: String(body.code).trim().toUpperCase(),
      type: ['warehouse', 'dark_store'].includes(String(body.type)) ? body.type : 'warehouse',
      address: String(body.address).trim(),
      city: String(body.city).trim(),
      state: String(body.state).trim(),
      pincode: String(body.pincode).trim(),
      latitude: lat,
      longitude: lng,
      service_radius_km: Math.max(1, Number(body.service_radius_km) || 5),
      status: body.status !== false && body.status !== 'false',
      open_time: String(body.open_time ?? '09:00'),
      close_time: String(body.close_time ?? '21:00'),
      max_orders_per_day: Math.max(1, Number(body.max_orders_per_day) || 500),
      max_orders_per_hour: Math.max(1, Number(body.max_orders_per_hour) || 50),
    };
    const item = await WarehouseLocation.create(payload);
    res.status(201).json(ResponseFormatter.success(item));
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ success: false, message: 'Warehouse code already exists' }); return;
    }
    next(err);
  }
}

export async function updateWarehouseLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { WarehouseLocation } = await import('../warehouse/warehouse.models');
    const body = { ...req.body as Record<string, unknown> };
    delete body._id;
    if (body.code) body.code = String(body.code).toUpperCase().trim();
    if (body.latitude !== undefined) body.latitude = Number(body.latitude);
    if (body.longitude !== undefined) body.longitude = Number(body.longitude);
    const item = await WarehouseLocation.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Warehouse not found' }); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ success: false, message: 'Warehouse code already exists' }); return;
    }
    next(err);
  }
}

export async function deleteWarehouseLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { WarehouseLocation } = await import('../warehouse/warehouse.models');
    const item = await WarehouseLocation.findByIdAndDelete(req.params.id).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Warehouse not found' }); return; }
    res.json(ResponseFormatter.success(null, 'Warehouse deleted'));
  } catch (err) { next(err); }
}
