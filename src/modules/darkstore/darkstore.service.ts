import mongoose from 'mongoose';
import {
  DarkstoreOrder, InventoryItem, InventoryAdjustment, Shelf, ShelfSKU, ShelfIssue, ShelfActivity,
  Picklist, PicklistItem, PackingOrder, GRN, GRNItem, PutawayTask, InterStoreTransfer,
  Alert, AlertHistory, OperationalAlert, RTOAlert, StockAlert,
  QCInspection, QCFailure, QCCheckLog, SampleTest, ComplianceDoc, ComplianceLog, WatchlistItem, BatchRejection, TemperatureLog, AuditStatus,
  DarkstoreStaff, StaffPerformance, ShiftCoverage, Absence, WeeklyRoster,
  HSDSession, HSDUserLogin, DarkstoreDevice, DeviceHistory, HSDDeviceIssue, HSDDeviceAction,
  DarkstoreSettings, CustomerCall, AuditLog, RestockTask, DamagedItemReport, MissingItemReport,
  CycleCountMetrics, CycleCountHeatmap, CycleCountVariance, LabelPrintJob,
  OutboundTransferRequest, Incident, BulkUpload, Truck, Restock, DarkstoreDispatch,
} from './darkstore.models';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveStoreId(storeId?: string): string {
  return storeId || process.env.DEFAULT_STORE_ID || 'DS-Adyar-01';
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary(storeId: string) {
  const sid = resolveStoreId(storeId);
  const now = new Date();

  const [orders, returnsCount, cancelledCount, activeStaff] = await Promise.all([
    DarkstoreOrder.find({ store_id: sid, status: { $in: ['new', 'processing', 'ready'] } }).lean(),
    DarkstoreOrder.countDocuments({ store_id: sid, status: 'rto' }),
    DarkstoreOrder.countDocuments({ store_id: sid, status: 'cancelled' }),
    DarkstoreStaff.countDocuments({ store_id: sid, is_active: true }),
  ]);

  const newOrders = orders.filter((o: any) => o.status === 'new').length;
  const breakdown = { normal: 0, priority: 0, express: 0 };
  for (const o of orders as any[]) {
    if (o.order_type === 'Normal') breakdown.normal++;
    else if (o.order_type === 'Priority') breakdown.priority++;
    else if (o.order_type === 'Express') breakdown.express++;
  }
  const total = breakdown.normal + breakdown.priority + breakdown.express;

  const ordersAtRisk = (orders as any[]).filter((o) => {
    if (!o.sla_deadline) return false;
    const diff = new Date(o.sla_deadline).getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    return minutes < 15 && minutes >= 0;
  }).length;

  const ordersUnder5Min = (orders as any[]).filter((o) => {
    if (!o.sla_deadline) return false;
    const diff = new Date(o.sla_deadline).getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    return minutes < 5 && minutes >= 0;
  }).length;

  return {
    queue: { total, new_orders: newOrders, returns_count: returnsCount, cancelled_count: cancelledCount, breakdown },
    sla_threat: { percentage: total > 0 ? Math.round((ordersAtRisk / total) * 100) : 0, orders_at_risk: ordersAtRisk, orders_under_5min: ordersUnder5Min },
    store_capacity: { percentage: Math.min(Math.round((activeStaff / 100) * 100), 100) },
  };
}

export async function getStaffLoad(storeId: string) {
  const sid = resolveStoreId(storeId);
  const [activeStaff, totalStaff] = await Promise.all([
    DarkstoreStaff.countDocuments({ store_id: sid, status: 'Active', is_active: true }),
    DarkstoreStaff.countDocuments({ store_id: sid, is_active: true }),
  ]);

  const byRole = await DarkstoreStaff.aggregate([
    { $match: { store_id: sid, is_active: true } },
    { $group: { _id: '$role', active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } }, total: { $sum: 1 } } },
  ]);

  return { active: activeStaff, total: totalStaff, by_role: byRole.map((r) => ({ role: r._id, active: r.active, total: r.total })) };
}

export async function getStockAlerts(storeId: string) {
  const sid = resolveStoreId(storeId);
  return StockAlert.find({ store_id: sid, resolved: false }).sort({ createdAt: -1 }).limit(50).lean();
}

export async function getRTOAlerts(storeId: string) {
  const sid = resolveStoreId(storeId);
  return RTOAlert.find({ store_id: sid, status: 'open' }).sort({ createdAt: -1 }).limit(50).lean();
}

export async function getLiveOrders(storeId: string) {
  const sid = resolveStoreId(storeId);
  return DarkstoreOrder.find({ store_id: sid, status: { $in: ['new', 'processing', 'ASSIGNED', 'PICKING', 'PICKED', 'PACKED', 'READY_FOR_DISPATCH'] } })
    .sort({ sla_deadline: 1 }).limit(100).lean();
}

export async function getAlertHistory(storeId: string, orderId?: string) {
  const query: any = {};
  if (storeId) query.store_id = resolveStoreId(storeId);
  if (orderId) query.order_id = orderId;
  return AlertHistory.find(query).sort({ createdAt: -1 }).limit(50).lean();
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function getOrders(storeId: string, filters: Record<string, string> = {}) {
  const sid = resolveStoreId(storeId);
  const query: any = { store_id: sid };
  if (filters.status) query.status = filters.status;
  if (filters.order_type) query.order_type = filters.order_type;
  if (filters.search) {
    query.$or = [{ order_id: { $regex: filters.search, $options: 'i' } }, { customer_name: { $regex: filters.search, $options: 'i' } }];
  }
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [orders, total] = await Promise.all([
    DarkstoreOrder.find(query).sort({ sla_deadline: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    DarkstoreOrder.countDocuments(query),
  ]);
  return { orders, total, page, limit };
}

export async function getOrderById(orderId: string) {
  return DarkstoreOrder.findOne({ order_id: orderId }).lean();
}

export async function updateOrder(orderId: string, updates: Record<string, unknown>, actor: string) {
  const order = await DarkstoreOrder.findOne({ order_id: orderId });
  if (!order) return null;
  Object.assign(order, updates);
  if (updates.status) {
    (order as any).timeline.push({ status: String(updates.status), timestamp: new Date(), updatedBy: actor });
  }
  await order.save();
  return order;
}

export async function markRTO(orderId: string, reason: string, notes: string, actor: string) {
  const order = await DarkstoreOrder.findOne({ order_id: orderId });
  if (!order) return null;
  (order as any).rto_risk = true;
  (order as any).rto_reason = reason;
  (order as any).rto_notes = notes;
  (order as any).rto_status = 'marked_rto';
  (order as any).status = 'rto';
  (order as any).timeline.push({ status: 'rto', timestamp: new Date(), updatedBy: actor });
  await order.save();
  await RTOAlert.create({ order_id: orderId, reason, store_id: (order as any).store_id });
  return order;
}

export async function assignOrderToPicker(orderId: string, pickerId: string, pickerName: string, actor: string) {
  const order = await DarkstoreOrder.findOne({ order_id: orderId });
  if (!order) return null;
  (order as any).pickerAssignment = { pickerId, pickerName, assignedAt: new Date() };
  (order as any).assignee = { id: pickerId, name: pickerName, initials: pickerName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 3) };
  (order as any).status = 'ASSIGNED';
  (order as any).timeline.push({ status: 'ASSIGNED', timestamp: new Date(), updatedBy: actor });
  await order.save();
  return order;
}

export async function startPicking(orderId: string, actor: string) {
  const order = await DarkstoreOrder.findOne({ order_id: orderId });
  if (!order) return null;
  (order as any).status = 'PICKING';
  (order as any).pickingData = { ...((order as any).pickingData || {}), startTime: new Date() };
  (order as any).timeline.push({ status: 'PICKING', timestamp: new Date(), updatedBy: actor });
  await order.save();
  return order;
}

export async function completePicking(orderId: string, pickingData: Record<string, unknown>, actor: string) {
  const order = await DarkstoreOrder.findOne({ order_id: orderId });
  if (!order) return null;
  (order as any).status = 'PICKED';
  (order as any).pickingData = { ...((order as any).pickingData || {}), endTime: new Date(), ...pickingData };
  (order as any).timeline.push({ status: 'PICKED', timestamp: new Date(), updatedBy: actor });
  await order.save();
  return order;
}

export async function updateBagRack(orderId: string, bagId: string, rackLocation: string) {
  return DarkstoreOrder.findOneAndUpdate({ order_id: orderId }, { bagId, rackLocation }, { new: true }).lean();
}

export async function callCustomer(orderId: string, caller: string, storeId: string) {
  await CustomerCall.create({ order_id: orderId, caller, store_id: resolveStoreId(storeId), called_at: new Date() });
  return { success: true };
}

export async function cancelOrder(orderId: string, reason: string, actor: string) {
  const order = await DarkstoreOrder.findOne({ order_id: orderId });
  if (!order) return null;
  (order as any).status = 'CANCELLED';
  (order as any).timeline.push({ status: 'CANCELLED', timestamp: new Date(), updatedBy: actor });
  await order.save();
  return order;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function getShelfView(storeId: string, zone: string, aisle: string, shelfLocation?: string) {
  const sid = resolveStoreId(storeId);
  const shelfQuery: any = { store_id: sid, zone };
  if (aisle !== 'all') shelfQuery.aisle = aisle;

  const [emptyShelves, misplacedShelves, damagedReports, shelves] = await Promise.all([
    Shelf.countDocuments({ store_id: sid, zone, status: 'critical', is_critical: true }),
    Shelf.countDocuments({ store_id: sid, zone, is_misplaced: true }),
    InventoryAdjustment.countDocuments({ store_id: sid, action: 'damage', createdAt: { $gte: new Date(Date.now() - 86400000) } }),
    Shelf.find(shelfQuery).sort({ aisle: 1, shelf_number: 1 }).lean(),
  ]);

  const aislesData: Record<string, any> = {};
  for (const shelf of shelves as any[]) {
    if (!aislesData[shelf.aisle]) aislesData[shelf.aisle] = { aisle: shelf.aisle, shelves: [] };
    const shelfSKUs = await ShelfSKU.find({ shelf_id: shelf.shelf_id }).lean();
    aislesData[shelf.aisle].shelves.push({ shelf_number: shelf.shelf_number, location_code: shelf.location_code, status: shelf.status, is_critical: shelf.is_critical, is_misplaced: shelf.is_misplaced, assigned_skus: (shelfSKUs as any[]).map((s) => ({ sku: s.sku, product_name: s.product_name, stock_count: s.stock_count })) });
  }

  return { alerts: { empty_shelves: emptyShelves, misplaced_items: misplacedShelves, damaged_goods_reports: damagedReports }, zone, aisles: Object.values(aislesData) };
}

export async function getStockLevels(storeId: string, category?: string, status?: string, page = 1, limit = 50) {
  const sid = resolveStoreId(storeId);
  const query: any = { store_id: sid };
  if (category) query.category = category;
  if (status) query.status = status;
  const [items, total] = await Promise.all([
    InventoryItem.find(query).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    InventoryItem.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function updateStockLevel(sku: string, quantity: number, actor: string, storeId: string) {
  const sid = resolveStoreId(storeId);
  const item = await InventoryItem.findOne({ sku, store_id: sid });
  if (!item) return null;
  const previousStock = (item as any).stock;
  (item as any).stock = quantity;
  (item as any).status = quantity === 0 ? 'Out of Stock' : quantity <= 10 ? 'Fast Movers' : 'Slow Movers';
  await item.save();
  await InventoryAdjustment.create({ adjustment_id: generateId('ADJ'), sku, product_name: (item as any).name, action: 'correction', quantity: quantity - previousStock, performed_by: actor, store_id: sid, previous_stock: previousStock, new_stock: quantity });
  return item;
}

export async function deleteInventoryItem(sku: string, storeId: string) {
  return InventoryItem.findOneAndDelete({ sku, store_id: resolveStoreId(storeId) }).lean();
}

export async function changeItemStatus(sku: string, status: string, storeId: string) {
  return InventoryItem.findOneAndUpdate({ sku, store_id: resolveStoreId(storeId) }, { status }, { new: true }).lean();
}

export async function getAdjustments(storeId: string, page = 1, limit = 50) {
  const sid = resolveStoreId(storeId);
  const [items, total] = await Promise.all([
    InventoryAdjustment.find({ store_id: sid }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    InventoryAdjustment.countDocuments({ store_id: sid }),
  ]);
  return { items, total, page, limit };
}

export async function createAdjustment(data: Record<string, unknown>, actor: string, storeId: string) {
  const sid = resolveStoreId(storeId);
  const physical = Number(data.physical_qty ?? data.new_stock ?? data.quantity ?? 0);
  const system = Number(data.system_qty ?? data.previous_stock ?? 0);
  const variance = Number.isFinite(Number(data.variance)) ? Number(data.variance) : physical - system;
  const quantity = data.quantity != null ? Number(data.quantity) : Math.abs(variance);
  const actionRaw = String(data.action || '').toLowerCase();
  const allowed = new Set(['add', 'remove', 'damage', 'expiry', 'transfer', 'correction']);
  const action = allowed.has(actionRaw)
    ? actionRaw
    : variance > 0
      ? 'add'
      : variance < 0
        ? 'remove'
        : 'correction';
  return InventoryAdjustment.create({
    adjustment_id: generateId('ADJ'),
    sku: String(data.sku || 'UNKNOWN'),
    product_name: data.product_name ? String(data.product_name) : undefined,
    action,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    reason: data.reason ? String(data.reason) : 'Stock audit adjustment',
    performed_by: actor,
    store_id: sid,
    previous_stock: Number.isFinite(system) ? system : undefined,
    new_stock: Number.isFinite(physical) ? physical : undefined,
  });
}

export async function getCycleCount(storeId: string) {
  const sid = resolveStoreId(storeId);
  const [metrics, variances, heatmap] = await Promise.all([
    CycleCountMetrics.find({ store_id: sid }).sort({ createdAt: -1 }).limit(5).lean(),
    CycleCountVariance.find({ store_id: sid }).sort({ createdAt: -1 }).limit(50).lean(),
    CycleCountHeatmap.find({ store_id: sid }).lean(),
  ]);
  return { metrics, variances, heatmap };
}

export async function scanInventoryItem(sku: string, storeId: string) {
  const sid = resolveStoreId(storeId);
  return InventoryItem.findOne({ sku, store_id: sid }).lean();
}

export async function updateInventoryItem(sku: string, updates: Record<string, unknown>, storeId: string) {
  return InventoryItem.findOneAndUpdate({ sku, store_id: resolveStoreId(storeId) }, updates, { new: true }).lean();
}

export async function listShelves(storeId: string, zone?: string) {
  const sid = resolveStoreId(storeId);
  const query: any = { store_id: sid };
  if (zone) query.zone = zone;
  return Shelf.find(query).sort({ aisle: 1, shelf_number: 1 }).lean();
}

export async function createShelf(data: Record<string, unknown>, storeId: string) {
  const sid = resolveStoreId(storeId);
  return Shelf.create({ shelf_id: generateId('SHELF'), ...data, store_id: sid });
}

export async function updateShelf(shelfId: string, updates: Record<string, unknown>) {
  return Shelf.findOneAndUpdate({ shelf_id: shelfId }, updates, { new: true }).lean();
}

export async function deleteShelf(shelfId: string) {
  return Shelf.findOneAndDelete({ shelf_id: shelfId }).lean();
}

export async function getProductLocation(sku: string, storeId: string) {
  const sid = resolveStoreId(storeId);
  const shelfSkus = await ShelfSKU.find({ sku, store_id: sid }).lean();
  const locations = [];
  for (const ss of shelfSkus as any[]) {
    const shelf = await Shelf.findOne({ shelf_id: ss.shelf_id }).lean() as any;
    if (shelf) locations.push({ location_code: shelf.location_code, aisle: shelf.aisle, zone: shelf.zone, stock_count: ss.stock_count });
  }
  return locations;
}

export async function getAuditLog(storeId: string, page = 1, limit = 50) {
  const sid = resolveStoreId(storeId);
  const skip = (page - 1) * limit;

  // Live HSD App writes product/bag/rack scan events to hhd_scanned_items — not darkstore AuditLog.
  const { HHDScannedItem, HHDUser } = await import('../hhd/hhd.models');

  const [dsLogs, dsTotal, hhdRows, hhdTotal] = await Promise.all([
    AuditLog.find({ store_id: sid }).sort({ createdAt: -1 }).limit(limit * 2).lean(),
    AuditLog.countDocuments({ store_id: sid }),
    HHDScannedItem.find({})
      .sort({ scannedAt: -1 })
      .limit(Math.min(500, limit * 5))
      .lean(),
    HHDScannedItem.countDocuments({}),
  ]);

  const userIds = [
    ...new Set(hhdRows.map((r) => (r.userId ? String(r.userId) : '')).filter(Boolean)),
  ];
  const users = userIds.length
    ? await HHDUser.find({ _id: { $in: userIds } })
        .select('name mobile deviceId')
        .lean()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const hhdMapped = hhdRows.map((r) => {
    const meta = (r.metadata || {}) as Record<string, unknown>;
    const verdict = String(meta.verdict || 'OK');
    const entityType = String(meta.entityType || (String(r.barcodeType || '').includes('bag') ? 'Bag' : 'Product'));
    const u = r.userId ? userMap.get(String(r.userId)) : null;
    return {
      _id: String(r._id),
      id: String(r._id),
      store_id: sid,
      barcode: r.barcodeData,
      code: r.barcodeData,
      entityType,
      reference: r.orderId || entityType,
      refId: r.orderId || null,
      orderId: r.orderId || null,
      order: r.orderId || null,
      picker: u?.name || (r.userId ? String(r.userId) : 'HSD'),
      user: u?.name || (r.userId ? String(r.userId) : 'HSD'),
      device: r.deviceId || u?.deviceId || 'HHD',
      deviceId: r.deviceId || u?.deviceId || null,
      status: verdict === 'reject' ? 'failed' : verdict === 'duplicate' ? 'warning' : 'OK',
      result: verdict,
      createdAt: r.scannedAt || (r as { createdAt?: Date }).createdAt || new Date(),
      source: 'hhd_scanned_items',
    };
  });

  const dsMapped = (dsLogs as Array<Record<string, unknown>>).map((e) => ({
    ...e,
    source: 'darkstore_audit',
    createdAt: (e.createdAt as Date | string | undefined) ?? new Date(0),
  }));

  const merged = [...hhdMapped, ...dsMapped].sort((a, b) => {
    const ta = new Date(a.createdAt as Date).getTime();
    const tb = new Date(b.createdAt as Date).getTime();
    return tb - ta;
  });

  const total = hhdTotal + dsTotal;
  const logs = merged.slice(skip, skip + limit);
  return { logs, total, page, limit };
}

export async function createRestockTask(data: Record<string, unknown>, storeId: string) {
  return RestockTask.create({ ...data, store_id: resolveStoreId(storeId) });
}

// ─── Picklist ─────────────────────────────────────────────────────────────────

export async function getPicklists(storeId: string, filters: Record<string, string> = {}) {
  const sid = resolveStoreId(storeId);
  const query: any = { store_id: sid };
  if (filters.status) query.status = filters.status;
  if (filters.zone) query.zone = filters.zone;
  return Picklist.find(query).sort({ createdAt: -1 }).lean();
}

export async function createPicklist(data: Record<string, unknown>, storeId: string) {
  const sid = resolveStoreId(storeId);
  const picklistId = generateId('PL');
  return Picklist.create({ picklist_id: picklistId, ...data, store_id: sid });
}

export async function getPicklistById(picklistId: string) {
  const picklist = await Picklist.findOne({ picklist_id: picklistId }).lean();
  if (!picklist) return null;
  const items = await PicklistItem.find({ picklist_id: picklistId }).lean();
  return { ...picklist, items };
}

export async function updatePicklistStatus(picklistId: string, status: string, updates: Record<string, unknown> = {}) {
  return Picklist.findOneAndUpdate({ picklist_id: picklistId }, { status, ...updates }, { new: true }).lean();
}

export async function assignPickerToPicklist(picklistId: string, pickerId: string) {
  return Picklist.findOneAndUpdate({ picklist_id: picklistId }, { picker_id: pickerId, status: 'inprogress' }, { new: true }).lean();
}

// ─── Packing ─────────────────────────────────────────────────────────────────

export async function getPackQueue(storeId: string, stationId?: string) {
  const sid = resolveStoreId(storeId);
  const query: any = { store_id: sid, status: { $in: ['pending', 'packing'] } };
  if (stationId) query.packing_station_id = stationId;
  return PackingOrder.find(query).sort({ sla_time: 1 }).lean();
}

export async function getPackingOrderDetails(orderId: string) {
  return PackingOrder.findOne({ order_id: orderId }).lean();
}

export async function completePackingOrder(orderId: string, actor: string) {
  return PackingOrder.findOneAndUpdate({ order_id: orderId }, { status: 'packed' }, { new: true }).lean();
}

export async function reportMissingItem(orderId: string, itemData: Record<string, unknown>, actor: string, storeId: string) {
  return MissingItemReport.create({ order_id: orderId, ...itemData, reported_by: actor, store_id: resolveStoreId(storeId) });
}

export async function reportDamagedItem(orderId: string, itemData: Record<string, unknown>, actor: string, storeId: string) {
  return DamagedItemReport.create({ order_id: orderId, ...itemData, reported_by: actor, store_id: resolveStoreId(storeId) });
}

// ─── Inbound ─────────────────────────────────────────────────────────────────

export async function getInboundSummary(storeId: string) {
  const sid = resolveStoreId(storeId);
  const [pendingGRN, inProgressGRN, pendingPutaway, pendingTransfers] = await Promise.all([
    GRN.countDocuments({ store_id: sid, status: 'pending' }),
    GRN.countDocuments({ store_id: sid, status: 'in_progress' }),
    PutawayTask.countDocuments({ store_id: sid, status: 'pending' }),
    InterStoreTransfer.countDocuments({ to_store: sid, status: 'pending' }),
  ]);
  return { grn: { pending: pendingGRN, in_progress: inProgressGRN }, putaway_pending: pendingPutaway, transfers_pending: pendingTransfers };
}

export async function getGRNList(storeId: string, status?: string) {
  const sid = resolveStoreId(storeId);
  const query: any = { store_id: sid };
  if (status) query.status = status;
  return GRN.find(query).sort({ createdAt: -1 }).lean();
}

export async function getGRNById(grnId: string) {
  const grn = await GRN.findOne({ grn_id: grnId }).lean();
  if (!grn) return null;
  const items = await GRNItem.find({ grn_id: grnId }).lean();
  return { ...grn, items };
}

export async function startGRN(grnId: string) {
  return GRN.findOneAndUpdate({ grn_id: grnId, status: 'pending' }, { status: 'in_progress' }, { new: true }).lean();
}

export async function updateGRNItemQty(grnId: string, sku: string, receivedQty: number) {
  return GRNItem.findOneAndUpdate({ grn_id: grnId, sku }, { received_qty: receivedQty }, { new: true }).lean();
}

export async function completeGRN(grnId: string) {
  const grn = await GRN.findOneAndUpdate({ grn_id: grnId }, { status: 'completed', actual_arrival: new Date().toISOString() }, { new: true }).lean() as any;
  if (grn) {
    const items = await GRNItem.find({ grn_id: grnId }).lean() as any[];
    for (const item of items) {
      await InventoryItem.findOneAndUpdate({ sku: item.sku, store_id: grn.store_id }, { $inc: { stock: item.received_qty } });
    }
  }
  return grn;
}

export async function getPutawayTasks(storeId: string, status?: string) {
  const sid = resolveStoreId(storeId);
  const query: any = { store_id: sid };
  if (status) query.status = status;
  return PutawayTask.find(query).sort({ createdAt: -1 }).lean();
}

export async function assignPutawayTask(taskId: string, assignedTo: string) {
  return PutawayTask.findByIdAndUpdate(taskId, { assigned_to: assignedTo, status: 'in_progress' }, { new: true }).lean();
}

export async function completePutawayTask(taskId: string) {
  return PutawayTask.findByIdAndUpdate(taskId, { status: 'completed' }, { new: true }).lean();
}

export async function getInterStoreTransfers(storeId: string) {
  const sid = resolveStoreId(storeId);
  return InterStoreTransfer.find({ $or: [{ from_store: sid }, { to_store: sid }] }).sort({ createdAt: -1 }).lean();
}

export async function receiveTransfer(transferId: string, receivedBy: string) {
  return InterStoreTransfer.findOneAndUpdate({ transfer_id: transferId }, { status: 'received', received_by: receivedBy }, { new: true }).lean();
}

// ─── Outbound ─────────────────────────────────────────────────────────────────

export async function getOutboundSummary(storeId: string) {
  const sid = resolveStoreId(storeId);
  const [readyOrders, pendingTransfers] = await Promise.all([
    DarkstoreOrder.countDocuments({ store_id: sid, status: 'READY_FOR_DISPATCH' }),
    OutboundTransferRequest.countDocuments({ from_store: sid, status: 'pending' }),
  ]);
  return { ready_for_dispatch: readyOrders, pending_transfers: pendingTransfers };
}

export async function getReadyForDispatchOrders(storeId: string) {
  const sid = resolveStoreId(storeId);
  return DarkstoreOrder.find({ store_id: sid, status: 'READY_FOR_DISPATCH' }).sort({ sla_deadline: 1 }).lean();
}

export async function batchDispatchOrders(orderIds: string[], riderId: string, riderName: string, storeId: string) {
  const sid = resolveStoreId(storeId);
  await DarkstoreOrder.updateMany({ order_id: { $in: orderIds }, store_id: sid }, { status: 'completed' });
  return DarkstoreDispatch.create({ dispatch_id: generateId('DISP'), order_ids: orderIds, rider_id: riderId, rider_name: riderName, store_id: sid, dispatched_at: new Date() });
}

export async function getOutboundTransferRequests(storeId: string) {
  return OutboundTransferRequest.find({ from_store: resolveStoreId(storeId) }).sort({ createdAt: -1 }).lean();
}

export async function approveTransferRequest(requestId: string, approvedBy: string) {
  return OutboundTransferRequest.findOneAndUpdate({ request_id: requestId }, { status: 'approved', approved_by: approvedBy }, { new: true }).lean();
}

export async function rejectTransferRequest(requestId: string) {
  return OutboundTransferRequest.findOneAndUpdate({ request_id: requestId }, { status: 'rejected' }, { new: true }).lean();
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function getAlerts(storeId: string, filters: Record<string, string> = {}) {
  const sid = resolveStoreId(storeId);
  const query: any = { store_id: sid };
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  if (filters.type) query.type = filters.type;
  return Alert.find(query).sort({ createdAt: -1 }).limit(100).lean();
}

export async function getAlertById(alertId: string) {
  return Alert.findOne({ alert_id: alertId }).lean();
}

export async function performAlertAction(alertId: string, action: string, note: string, actor: string) {
  const alert = await Alert.findOne({ alert_id: alertId });
  if (!alert) return null;
  const statusMap: Record<string, string> = { acknowledge: 'acknowledged', resolve: 'resolved', dismiss: 'dismissed', start: 'in_progress' };
  const newStatus = statusMap[action] || (alert as any).status;
  (alert as any).status = newStatus;
  (alert as any).timeline.push({ at: new Date().toISOString(), status: newStatus, note, actor });
  await alert.save();
  return alert;
}

export async function clearResolvedAlerts(storeId: string) {
  const sid = resolveStoreId(storeId);
  return Alert.deleteMany({ store_id: sid, status: { $in: ['resolved', 'dismissed'] } });
}

// ─── QC ───────────────────────────────────────────────────────────────────────

export async function getQCSummary(storeId: string) {
  const sid = resolveStoreId(storeId);
  const [total, passed, failed, pending, failures, watchlist] = await Promise.all([
    QCInspection.countDocuments({ store_id: sid }),
    QCInspection.countDocuments({ store_id: sid, status: 'passed' }),
    QCInspection.countDocuments({ store_id: sid, status: 'failed' }),
    QCInspection.countDocuments({ store_id: sid, status: 'pending' }),
    QCFailure.countDocuments({ store_id: sid, resolved: false }),
    WatchlistItem.countDocuments({ store_id: sid, resolved: false }),
  ]);
  return { total, passed, failed, pending, open_failures: failures, watchlist_items: watchlist, pass_rate: total > 0 ? Math.round((passed / total) * 100) : 0 };
}

export async function getQCInspections(storeId: string, status?: string) {
  const sid = resolveStoreId(storeId);
  const query: any = { store_id: sid };
  if (status) query.status = status;
  return QCInspection.find(query).sort({ createdAt: -1 }).limit(50).lean();
}

export async function createQCInspection(data: Record<string, unknown>, storeId: string) {
  return QCInspection.create({ inspection_id: generateId('QCI'), date: new Date().toISOString().split('T')[0], ...data, store_id: resolveStoreId(storeId) });
}

export async function getTemperatureLogs(storeId: string) {
  return TemperatureLog.find({ store_id: resolveStoreId(storeId) }).sort({ createdAt: -1 }).limit(50).lean();
}

export async function createTemperatureLog(data: Record<string, unknown>, storeId: string) {
  return TemperatureLog.create({ ...data, store_id: resolveStoreId(storeId) });
}

export async function getComplianceDocs(storeId: string) {
  return ComplianceDoc.find({ store_id: resolveStoreId(storeId) }).lean();
}

export async function getSampleTests(storeId: string) {
  return SampleTest.find({ store_id: resolveStoreId(storeId) }).sort({ createdAt: -1 }).lean();
}

export async function createSampleTest(data: Record<string, unknown>, storeId: string) {
  return SampleTest.create({ sample_id: generateId('SMPL'), ...data, store_id: resolveStoreId(storeId) });
}

export async function updateSampleResult(sampleId: string, result: string, notes: string) {
  return SampleTest.findOneAndUpdate({ sample_id: sampleId }, { result, notes, tested_at: new Date() }, { new: true }).lean();
}

export async function getQCFailures(storeId: string) {
  return QCFailure.find({ store_id: resolveStoreId(storeId), resolved: false }).sort({ createdAt: -1 }).lean();
}

export async function resolveQCFailure(failureId: string, resolvedBy: string) {
  return QCFailure.findByIdAndUpdate(failureId, { resolved: true, resolved_by: resolvedBy, resolved_at: new Date() }, { new: true }).lean();
}

export async function getWatchlist(storeId: string) {
  return WatchlistItem.find({ store_id: resolveStoreId(storeId), resolved: false }).lean();
}

export async function addWatchlistItem(data: Record<string, unknown>, storeId: string) {
  return WatchlistItem.create({ ...data, store_id: resolveStoreId(storeId) });
}

export async function getComplianceLogs(storeId: string) {
  return ComplianceLog.find({ store_id: resolveStoreId(storeId) }).sort({ createdAt: -1 }).limit(50).lean();
}

export async function addComplianceLog(data: Record<string, unknown>, storeId: string) {
  return ComplianceLog.create({ log_id: generateId('CL'), ...data, store_id: resolveStoreId(storeId) });
}

export async function getAuditStatus(storeId: string) {
  return AuditStatus.findOne({ store_id: resolveStoreId(storeId) }).lean();
}

export async function getRejections(storeId: string) {
  return BatchRejection.find({ store_id: resolveStoreId(storeId) }).sort({ createdAt: -1 }).lean();
}

export async function createRejection(data: Record<string, unknown>, storeId: string) {
  return BatchRejection.create({ rejection_id: generateId('REJ'), ...data, store_id: resolveStoreId(storeId) });
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export async function getStaffSummary(storeId: string) {
  const sid = resolveStoreId(storeId);
  const [total, active, onBreak, offline] = await Promise.all([
    DarkstoreStaff.countDocuments({ store_id: sid, is_active: true }),
    DarkstoreStaff.countDocuments({ store_id: sid, status: 'Active' }),
    DarkstoreStaff.countDocuments({ store_id: sid, status: 'Break' }),
    DarkstoreStaff.countDocuments({ store_id: sid, status: 'Offline' }),
  ]);
  return { total, active, on_break: onBreak, offline };
}

export async function getStaffRoster(storeId: string, role?: string) {
  const sid = resolveStoreId(storeId);
  const query: any = { store_id: sid, is_active: true };
  if (role) query.role = role;
  return DarkstoreStaff.find(query).sort({ role: 1, name: 1 }).lean();
}

export async function getShiftCoverage(storeId: string) {
  return ShiftCoverage.find({ store_id: resolveStoreId(storeId) }).sort({ date: -1 }).limit(10).lean();
}

export async function getAbsences(storeId: string) {
  return Absence.find({ store_id: resolveStoreId(storeId) }).sort({ date: -1 }).limit(50).lean();
}

export async function logAbsence(data: Record<string, unknown>, storeId: string) {
  return Absence.create({ ...data, store_id: resolveStoreId(storeId) });
}

export async function getWeeklyRoster(storeId: string) {
  return WeeklyRoster.findOne({ store_id: resolveStoreId(storeId), published: true }).sort({ week_start: -1 }).lean();
}

export async function publishRoster(rosterId: string) {
  return WeeklyRoster.findByIdAndUpdate(rosterId, { published: true, published_at: new Date() }, { new: true }).lean();
}

export async function getStaffPerformance(storeId: string) {
  return StaffPerformance.find({ store_id: resolveStoreId(storeId) }).sort({ createdAt: -1 }).limit(50).lean();
}

// ─── HSD (Handheld Devices) ───────────────────────────────────────────────────

export async function getHSDFleetOverview(storeId: string) {
  const sid = resolveStoreId(storeId);
  const [total, available, assigned, maintenance] = await Promise.all([
    DarkstoreDevice.countDocuments({ store_id: sid }),
    DarkstoreDevice.countDocuments({ store_id: sid, status: 'available' }),
    DarkstoreDevice.countDocuments({ store_id: sid, status: 'assigned' }),
    DarkstoreDevice.countDocuments({ store_id: sid, status: 'maintenance' }),
  ]);
  return { total, available, assigned, maintenance };
}

export async function getHSDUserList(storeId: string) {
  return HSDUserLogin.find({ store_id: resolveStoreId(storeId) }).sort({ createdAt: -1 }).limit(50).lean();
}

export async function registerHSDDevice(data: Record<string, unknown>, storeId: string) {
  const sid = resolveStoreId(storeId);
  return DarkstoreDevice.create({ device_id: generateId('DEV'), ...data, store_id: sid });
}

export async function assignHSDDevice(deviceId: string, userId: string) {
  const device = (await DarkstoreDevice.findOne({ device_id: deviceId }).lean()) as Record<string, any> | null;
  if (device && device.status === 'assigned' && device.assigned_to && String(device.assigned_to) !== String(userId)) {
    throw Object.assign(new Error('Device is already assigned to another user'), { statusCode: 409, code: 'DEVICE_ALREADY_ASSIGNED' });
  }
  const updated = (await DarkstoreDevice.findOneAndUpdate(
    { device_id: deviceId },
    { status: 'assigned', assigned_to: userId },
    { new: true },
  ).lean()) as Record<string, any> | null;
  await DeviceHistory.create({
    device_id: deviceId,
    action: 'assign',
    actor: userId,
    note: `Assigned to ${userId}`,
    store_id: updated?.store_id,
  });
  return updated;
}

export async function unassignHSDDevice(deviceId: string) {
  const updated = (await DarkstoreDevice.findOneAndUpdate(
    { device_id: deviceId },
    { status: 'available', assigned_to: null },
    { new: true },
  ).lean()) as Record<string, any> | null;
  await DeviceHistory.create({
    device_id: deviceId,
    action: 'unassign',
    actor: 'system',
    note: 'Device released',
    store_id: updated?.store_id,
  });
  return updated;
}

export async function getDeviceHistory(deviceId: string) {
  return DeviceHistory.find({ device_id: deviceId }).sort({ createdAt: -1 }).lean();
}

export async function getLiveSessions(storeId: string) {
  return HSDSession.find({ store_id: resolveStoreId(storeId) }).sort({ last_activity: -1 }).lean();
}

export async function getHSDIssues(storeId: string) {
  return HSDDeviceIssue.find({ store_id: resolveStoreId(storeId), status: { $ne: 'resolved' } }).lean();
}

export async function reportHSDIssue(data: Record<string, unknown>, storeId: string) {
  return HSDDeviceIssue.create({ ...data, store_id: resolveStoreId(storeId) });
}

export async function generateHSDUserOtp(userId: string, storeId: string) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 5 * 60000);
  const record = await HSDUserLogin.findOneAndUpdate({ user_id: userId }, { otp, otp_expires_at: expires, status: 'pending', store_id: resolveStoreId(storeId) }, { upsert: true, new: true }).lean();
  return { otp, expires_at: expires };
}

export async function getHSDUserOtp(userId: string) {
  return HSDUserLogin.findOne({ user_id: userId, status: 'pending', otp_expires_at: { $gt: new Date() } }).lean();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(storeId: string) {
  const sid = resolveStoreId(storeId);
  const settings = await DarkstoreSettings.findOne({ store_id: sid }).lean();
  if (settings) return settings;
  return DarkstoreSettings.create({ store_id: sid });
}

export async function updateSettings(storeId: string, updates: Record<string, unknown>, actor: string) {
  const sid = resolveStoreId(storeId);
  return DarkstoreSettings.findOneAndUpdate({ store_id: sid }, { ...updates, lastUpdated: new Date(), updatedBy: actor }, { upsert: true, new: true }).lean();
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getRiderPerformance(storeId: string) {
  const sid = resolveStoreId(storeId);
  return DarkstoreDispatch.aggregate([
    { $match: { store_id: sid } },
    { $group: { _id: '$rider_id', rider_name: { $first: '$rider_name' }, total_dispatches: { $sum: 1 }, total_orders: { $sum: { $size: '$order_ids' } } } },
  ]);
}

export async function getSlaAdherence(storeId: string, from?: Date, to?: Date) {
  const sid = resolveStoreId(storeId);
  const match: any = { store_id: sid };
  if (from || to) {
    match.sla_deadline = {};
    if (from) match.sla_deadline.$gte = from;
    if (to) match.sla_deadline.$lte = to;
  }
  const orders = await DarkstoreOrder.find({ ...match, status: { $in: ['completed', 'CANCELLED'] } }).lean() as any[];
  const onTime = orders.filter((o) => o.status === 'completed' && o.sla_status === 'safe').length;
  return { total: orders.length, on_time: onTime, rate: orders.length > 0 ? Math.round((onTime / orders.length) * 100) : 0 };
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function getInventoryReport(storeId: string) {
  const sid = resolveStoreId(storeId);
  const [byCategory, byStatus] = await Promise.all([
    InventoryItem.aggregate([{ $match: { store_id: sid } }, { $group: { _id: '$category', count: { $sum: 1 }, total_stock: { $sum: '$stock' } } }]),
    InventoryItem.aggregate([{ $match: { store_id: sid } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  return { by_category: byCategory, by_status: byStatus };
}

export async function getStaffReport(storeId: string) {
  return getStaffPerformance(storeId);
}

export async function getComplianceReport(storeId: string) {
  const sid = resolveStoreId(storeId);
  const [docs, logs, auditStat] = await Promise.all([
    ComplianceDoc.find({ store_id: sid }).lean(),
    ComplianceLog.find({ store_id: sid }).sort({ createdAt: -1 }).limit(20).lean(),
    AuditStatus.findOne({ store_id: sid }).lean(),
  ]);
  return { documents: docs, logs, audit_status: auditStat };
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function getSlaMonitor(storeId: string) {
  const sid = resolveStoreId(storeId);
  const now = new Date();
  const orders = await DarkstoreOrder.find({ store_id: sid, status: { $in: ['new', 'processing', 'ASSIGNED', 'PICKING'] } }).lean() as any[];
  const critical = orders.filter((o) => o.sla_deadline && (new Date(o.sla_deadline).getTime() - now.getTime()) < 5 * 60000);
  const warning = orders.filter((o) => o.sla_deadline && (new Date(o.sla_deadline).getTime() - now.getTime()) < 15 * 60000 && (new Date(o.sla_deadline).getTime() - now.getTime()) >= 5 * 60000);
  return { critical: critical.length, warning: warning.length, safe: orders.length - critical.length - warning.length, orders };
}

export async function getMissingItems(storeId: string) {
  return MissingItemReport.find({ store_id: resolveStoreId(storeId), status: 'open' }).sort({ createdAt: -1 }).lean();
}

export async function getOperationalAlerts(storeId: string) {
  return OperationalAlert.find({ store_id: resolveStoreId(storeId), resolved: false }).sort({ createdAt: -1 }).lean();
}

export async function getPipelineStats(storeId: string) {
  const sid = resolveStoreId(storeId);
  const statuses = ['new', 'ASSIGNED', 'PICKING', 'PICKED', 'PACKED', 'READY_FOR_DISPATCH'];
  const result: Record<string, number> = {};
  for (const s of statuses) {
    result[s] = await DarkstoreOrder.countDocuments({ store_id: sid, status: s });
  }
  return result;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export async function generateLabel(type: string, referenceId: string, labels: any[], actor: string, storeId: string) {
  return LabelPrintJob.create({ job_id: generateId('LBL'), type, reference_id: referenceId, labels, printed_by: actor, store_id: resolveStoreId(storeId), status: 'pending' });
}

export async function getSystemStatus(storeId: string) {
  return { status: 'operational', store_id: resolveStoreId(storeId), timestamp: new Date().toISOString() };
}

export async function getAuditLogs(storeId: string, page = 1, limit = 50) {
  return getAuditLog(storeId, page, limit);
}

// ─── Dashboard (extra) ────────────────────────────────────────────────────────

export async function getStoreProfile(storeId: string) {
  return { store_id: resolveStoreId(storeId), name: 'Selorg Darkstore', type: 'darkstore', status: 'active' };
}

export async function getWarehouseProfile(storeId: string) {
  return { store_id: resolveStoreId(storeId), name: 'Selorg Warehouse', type: 'warehouse', status: 'active' };
}

// ─── Outbound (extra) ─────────────────────────────────────────────────────────

export async function getActiveRiders(storeId: string) {
  return Truck.find({ store_id: resolveStoreId(storeId), status: 'active' }).lean();
}

export async function getTransferFulfillmentStatus(requestId: string) {
  const transfer = await OutboundTransferRequest.findById(requestId).lean();
  return transfer || { requestId, fulfillmentStatus: 'unknown' };
}

export async function getTransferSLASummary(storeId: string) {
  const sid = resolveStoreId(storeId);
  const total = await OutboundTransferRequest.countDocuments({ store_id: sid });
  const onTime = await OutboundTransferRequest.countDocuments({ store_id: sid, slaStatus: 'on_time' });
  return { total, onTime, breached: total - onTime, slaBreach: total > 0 ? ((total - onTime) / total) * 100 : 0 };
}

// ─── QC (extra) ───────────────────────────────────────────────────────────────

export async function getComplianceChecks(storeId: string) {
  const sid = resolveStoreId(storeId);
  return ComplianceDoc.find({ store_id: sid }).lean();
}

export async function toggleComplianceCheck(itemId: string, updates: Record<string, unknown>, storeId: string) {
  const sid = resolveStoreId(storeId);
  return ComplianceDoc.findOneAndUpdate({ _id: itemId, store_id: sid }, updates, { new: true }).lean() || { itemId, ...updates, store_id: sid };
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getHealthSummary(storeId: string) {
  const sid = resolveStoreId(storeId);
  const [openIncidents, equipment] = await Promise.all([
    Incident.countDocuments({ store_id: sid, status: 'open' }),
    Incident.countDocuments({ store_id: sid, type: 'equipment' }),
  ]);
  return { store_id: sid, open_incidents: openIncidents, equipment_issues: equipment, status: openIncidents === 0 ? 'healthy' : 'attention_needed' };
}

export async function getChecklists(storeId: string) {
  return Incident.find({ store_id: resolveStoreId(storeId), type: 'checklist' }).lean();
}

export async function updateChecklistItem(checklistId: string, itemId: string, updates: Record<string, unknown>) {
  return { checklistId, itemId, ...updates, updatedAt: new Date() };
}

export async function submitChecklist(checklistId: string, submittedBy: string) {
  return { checklistId, submittedBy, submittedAt: new Date(), status: 'submitted' };
}

export async function getEquipment(storeId: string) {
  return Incident.find({ store_id: resolveStoreId(storeId), type: 'equipment' }).lean();
}

export async function getIncidents(storeId: string) {
  return Incident.find({ store_id: resolveStoreId(storeId) }).sort({ createdAt: -1 }).lean();
}

export async function reportIncident(data: Record<string, unknown>, storeId: string, reportedBy: string) {
  return Incident.create({ incident_id: generateId('INC'), ...data, store_id: resolveStoreId(storeId), reported_by: reportedBy, status: 'open' });
}

export async function resolveIncident(incidentId: string, resolvedBy: string) {
  return Incident.findOneAndUpdate({ incident_id: incidentId }, { status: 'resolved', resolved_by: resolvedBy, resolved_at: new Date() }, { new: true }).lean();
}
