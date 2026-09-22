import { Router, type Request, type Response, type NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';

const router = Router();

// ── Warehouse Inventory ───────────────────────────────────────────────────────

router.get('/warehouse-inventory', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { WarehouseInventory } = await import('../products/store-inventory.model');
    const { Product } = await import('../products/products.model');
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string, 10) || 50);
    const { warehouseId } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (warehouseId) query.warehouseId = warehouseId;
    const [items, total] = await Promise.all([
      WarehouseInventory.find(query).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      WarehouseInventory.countDocuments(query),
    ]);
    const productIds = [...new Set(items.map((i) => String(i.productId)))];
    const whIds = [...new Set(items.map((i) => String(i.warehouseId)))];
    const { WarehouseLocation } = await import('../warehouse/warehouse.models');
    const [products, warehouses] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).select('name sku price mrp imageUrl thumbnailUrl status').lean(),
      WarehouseLocation.find({ _id: { $in: whIds } }).select('name code').lean(),
    ]);
    const productMap = Object.fromEntries(products.map((p) => [String(p._id), p]));
    const warehouseMap = Object.fromEntries(warehouses.map((w) => [String(w._id), w]));
    const enriched = items.map((i) => ({
      ...i,
      product: productMap[String(i.productId)] ?? null,
      warehouse: warehouseMap[String(i.warehouseId)] ?? null,
    }));
    res.json(ResponseFormatter.success({ items: enriched, total, page, limit }));
  } catch (err) { next(err); }
});

router.post('/warehouse-inventory', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { WarehouseInventory } = await import('../products/store-inventory.model');
    const { warehouseId, productId, quantity, isAvailable, lowStockThreshold } = req.body as Record<string, unknown>;
    if (!warehouseId || !productId) {
      res.status(400).json({ success: false, message: 'warehouseId and productId are required' }); return;
    }
    const existing = await WarehouseInventory.findOne({ warehouseId, productId }).lean();
    if (existing) {
      res.status(409).json({ success: false, message: 'This product is already added to this warehouse' }); return;
    }
    const item = await WarehouseInventory.create({
      warehouseId, productId,
      quantity: Number(quantity) || 0,
      isAvailable: isAvailable !== false,
      reservedQty: 0,
      lowStockThreshold: Number(lowStockThreshold) || 5,
    });
    res.status(201).json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
});

router.put('/warehouse-inventory/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { WarehouseInventory } = await import('../products/store-inventory.model');
    const body = { ...req.body as Record<string, unknown> };
    delete body._id; delete body.warehouseId; delete body.productId;
    if (body.quantity !== undefined) body.quantity = Math.max(0, Number(body.quantity));
    if (body.lowStockThreshold !== undefined) body.lowStockThreshold = Math.max(0, Number(body.lowStockThreshold));
    const item = await WarehouseInventory.findByIdAndUpdate(req.params.id, { $set: body }, { new: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Warehouse inventory record not found' }); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
});

router.delete('/warehouse-inventory/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { WarehouseInventory } = await import('../products/store-inventory.model');
    await WarehouseInventory.findByIdAndDelete(req.params.id);
    res.json(ResponseFormatter.success(null, 'Product removed from warehouse'));
  } catch (err) { next(err); }
});

router.get('/delivery-zones', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { Zone } = await import('./master-data.model');
    const items = await Zone.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json(ResponseFormatter.success(items));
  } catch (err) { next(err); }
});

router.get('/inventories', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { StoreInventory } = await import('../products/store-inventory.model');
    const { Product } = await import('../products/products.model');
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string, 10) || 50);
    const { storeId } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (storeId) query.storeId = storeId;
    const [items, total] = await Promise.all([
      StoreInventory.find(query).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      StoreInventory.countDocuments(query),
    ]);
    // Enrich with product details
    const productIds = [...new Set(items.map((i) => String(i.productId)))];
    const products = await Product.find({ _id: { $in: productIds } }).select('name sku price mrp imageUrl thumbnailUrl status').lean();
    const productMap = Object.fromEntries(products.map((p) => [String(p._id), p]));
    const enriched = items.map((i) => ({ ...i, product: productMap[String(i.productId)] ?? null }));
    res.json(ResponseFormatter.success({ items: enriched, total, page, limit }));
  } catch (err) { next(err); }
});

router.get('/inventories/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { StoreInventory } = await import('../products/store-inventory.model');
    const item = await StoreInventory.findById(req.params.id).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Inventory not found' }); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
});

router.post('/inventories', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { StoreInventory } = await import('../products/store-inventory.model');
    const { storeId, productId, quantity, isAvailable, lowStockThreshold } = req.body as Record<string, unknown>;
    if (!storeId || !productId) {
      res.status(400).json({ success: false, message: 'storeId and productId are required' }); return;
    }
    const existing = await StoreInventory.findOne({ storeId, productId }).lean();
    if (existing) {
      res.status(409).json({ success: false, message: 'This product is already added to this dark store' }); return;
    }
    const item = await StoreInventory.create({
      storeId,
      productId,
      quantity: Number(quantity) || 0,
      isAvailable: isAvailable !== false,
      reservedQty: 0,
      lowStockThreshold: Number(lowStockThreshold) || 5,
    });
    res.status(201).json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
});

router.put('/inventories/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { StoreInventory } = await import('../products/store-inventory.model');
    const body = { ...req.body as Record<string, unknown> };
    delete body._id; delete body.storeId; delete body.productId;
    if (body.quantity !== undefined) body.quantity = Math.max(0, Number(body.quantity));
    if (body.lowStockThreshold !== undefined) body.lowStockThreshold = Math.max(0, Number(body.lowStockThreshold));
    const item = await StoreInventory.findByIdAndUpdate(req.params.id, { $set: body }, { new: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Inventory not found' }); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
});

router.delete('/inventories/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { StoreInventory } = await import('../products/store-inventory.model');
    await StoreInventory.findByIdAndDelete(req.params.id);
    res.json(ResponseFormatter.success(null, 'Product removed from dark store'));
  } catch (err) { next(err); }
});

router.get('/stock-movements', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { StoreInventory } = await import('../products/store-inventory.model');
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string, 10) || 50);
    const items = await StoreInventory.find().sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    res.json(ResponseFormatter.success(items));
  } catch (err) { next(err); }
});

router.get('/grns', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { GRN } = await import('../warehouse/warehouse.models');
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string, 10) || 50);
    const [items, total] = await Promise.all([
      GRN.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      GRN.countDocuments(),
    ]);
    res.json(ResponseFormatter.success({ items, total, page, limit }));
  } catch (err) { next(err); }
});

router.get('/grns/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { GRN } = await import('../warehouse/warehouse.models');
    const item = await GRN.findById(req.params.id).lean();
    if (!item) { res.status(404).json({ success: false, message: 'GRN not found' }); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
});

router.get('/putaway', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { PutawayTask } = await import('../production/production.models');
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string, 10) || 50);
    const [items, total] = await Promise.all([
      PutawayTask.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      PutawayTask.countDocuments(),
    ]);
    res.json(ResponseFormatter.success({ items, total, page, limit }));
  } catch (err) { next(err); }
});

router.get('/bins', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { Shelf } = await import('../production/production.models');
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string, 10) || 50);
    const [items, total] = await Promise.all([
      Shelf.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Shelf.countDocuments(),
    ]);
    res.json(ResponseFormatter.success({ items, total, page, limit }));
  } catch (err) { next(err); }
});

router.get('/bins/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { Shelf } = await import('../production/production.models');
    const item = await Shelf.findById(req.params.id).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Bin not found' }); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
});

export default router;
