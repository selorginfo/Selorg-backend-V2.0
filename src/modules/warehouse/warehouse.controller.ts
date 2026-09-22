import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import {
  GRN,
  Picklist,
  WarehouseOrder,
  InventoryItem,
  StockAlert,
  StorageLocation,
  InventoryAdjustment,
  QCInspection,
  Staff,
  WarehouseEquipment,
  WarehouseException,
  WarehouseNotification,
  WarehouseAttendance,
  WarehouseEquipment as HSDDevice,
  EquipmentIssue,
  DockSlot,
  CycleCount,
  InternalTransfer,
  ReorderRequest,
  InterWarehouseTransfer,
  WDTransferRequest,
  WDTransferLog,
  Shift,
  Absence,
  PickingBatch,
  TemperatureLog,
  BatchRejection,
  ComplianceDoc,
  ComplianceCheck,
  SampleTest,
  AccessLog,
  LeaveRequest,
  WarehouseTraining,
  WarehouseShiftSlot,
  warehouseFieldsForCreate,
  mergeWarehouseFilter,
  warehouseKeyMatch,
} from './warehouse.models';
import { WarehouseInventory } from '../products/store-inventory.model';

const ACTIVE_PICKLIST_FILTER = { status: { $nin: ['completed', 'cancelled'] } };

const PENDING_STATUSES = new Set(['queued', 'pending', 'assigned']);
const PICKING_STATUSES = new Set(['picking', 'inprogress', 'in-progress', 'paused']);
const DISPATCHING_STATUSES = new Set(['dispatching', 'packing', 'ready', 'ready_to_dispatch', 'staged', 'dispatch']);

function normalizePicklistStatus(status: string | undefined): string {
  const raw = (status && String(status).trim()) || 'pending';
  const s = raw.toLowerCase();
  if (s === 'queued') return 'pending';
  return s;
}

/** Shared 501 for warehouse surfaces that answer success without doing work. */
async function notImplemented(req: Request, res: Response, what: string): Promise<void> {
  const { completeOpsAction } = await import('../../utils/ops-store');
  await completeOpsAction(req, res, what);
}

function resolvePicklistItemCount(picklist: Record<string, unknown>, order: Record<string, unknown> | undefined): number {
  const n = Number(picklist?.items);
  if (Number.isFinite(n) && n > 0) return n;
  if (Array.isArray(picklist?.items) && (picklist.items as unknown[]).length > 0) return (picklist.items as unknown[]).length;
  if (Array.isArray(order?.items) && (order.items as unknown[]).length > 0) return (order.items as unknown[]).length;
  return 0;
}

function resolvePicklistDestination(picklist: Record<string, unknown>, order: Record<string, unknown> | undefined): string {
  const fromPicklist =
    (picklist?.customer as string) ||
    (picklist?.customerName as string) ||
    (picklist?.customer_name as string) ||
    (picklist?.destination as string) ||
    (picklist?.dropLocation as string);
  if (fromPicklist && String(fromPicklist).trim()) return String(fromPicklist).trim();

  if (order) {
    const fromOrder =
      (order.dropLocation as string) ||
      (order.customerName as string) ||
      (order.pickupLocation as string);
    if (fromOrder && String(fromOrder).trim()) return String(fromOrder).trim();
  }

  const zone = (picklist?.zone as string) || (picklist?.locationZone as string);
  if (zone && String(zone).trim()) return `Zone ${String(zone).trim()}`;

  return '';
}

function mapPicklistToFlowEntry(picklist: Record<string, unknown>, orderByKey: Map<string, Record<string, unknown>>) {
  const orderKey = (picklist.orderId || picklist.order_id || picklist.id) as string;
  const order =
    orderByKey.get(orderKey) ||
    orderByKey.get(picklist.orderId as string) ||
    orderByKey.get(picklist.order_id as string) ||
    orderByKey.get(picklist.id as string);

  return {
    id: picklist.id || picklist.orderId || picklist.order_id || String(picklist._id || ''),
    orderId: picklist.orderId || picklist.order_id || picklist.id || String(picklist._id || ''),
    customer: resolvePicklistDestination(picklist, order),
    items: resolvePicklistItemCount(picklist, order),
    priority: picklist.priority === 'high' || picklist.priority === 'urgent' ? 'urgent' : picklist.priority === 'medium' ? 'high' : 'standard',
    status: normalizePicklistStatus(picklist.status as string),
    zone: picklist.zone || picklist.locationZone || order?.zone || '',
    updatedAt: picklist.updatedAt,
  };
}

async function loadOrdersForPicklists(warehouseKey: string, picklists: Record<string, unknown>[]): Promise<Map<string, Record<string, unknown>>> {
  const keys = new Set<string>();
  for (const p of picklists) {
    for (const k of [p.orderId, p.order_id, p.id]) {
      if (k && String(k).trim()) keys.add(String(k).trim());
    }
  }
  if (keys.size === 0) return new Map();

  const keyList = [...keys];
  const orders = await WarehouseOrder.find(
    mergeWarehouseFilter({ $or: [{ id: { $in: keyList } }, { order_id: { $in: keyList } }] }, warehouseKey),
  ).lean();

  const orderByKey = new Map<string, Record<string, unknown>>();
  for (const o of orders as unknown as Record<string, unknown>[]) {
    if (o.id) orderByKey.set(o.id as string, o);
    if (o.order_id) orderByKey.set(o.order_id as string, o);
  }
  return orderByKey;
}

async function countOrderFlowByStatus(warehouseKey: string) {
  const rows = await Picklist.aggregate([
    { $match: mergeWarehouseFilter(ACTIVE_PICKLIST_FILTER, warehouseKey) },
    { $project: { statusNorm: { $toLower: { $ifNull: ['$status', 'pending'] } } } },
    { $group: { _id: '$statusNorm', count: { $sum: 1 } } },
  ]);

  let pending = 0;
  let picking = 0;
  let dispatching = 0;

  for (const row of rows) {
    const status = normalizePicklistStatus(row._id as string);
    const count = row.count || 0;
    if (PENDING_STATUSES.has(status)) pending += count;
    else if (PICKING_STATUSES.has(status)) picking += count;
    else dispatching += count;
  }

  return { pending, picking, dispatching, total: pending + picking + dispatching };
}

function deriveOperationalStatus(metrics: Record<string, unknown>, openExceptions: number) {
  const inboundQueue = (metrics.inboundQueue as number) || 0;
  const outboundQueue = (metrics.outboundQueue as number) || 0;
  const criticalAlerts = (metrics.criticalAlerts as number) || 0;
  const capacityUtilization = (metrics.capacityUtilization as Record<string, number>) || {};
  const bins = capacityUtilization.bins ?? 0;
  if (criticalAlerts > 0 || openExceptions > 2 || outboundQueue > 50 || inboundQueue > 25) {
    return { status: 'critical', message: 'Immediate attention required' };
  }
  if (outboundQueue > 20 || inboundQueue > 12 || bins >= 90 || openExceptions > 0) {
    return { status: 'warning', message: 'Elevated load — monitor closely' };
  }
  return { status: 'healthy', message: 'Operations running normally' };
}

async function getMetrics(warehouseKey: string) {
  const inboundQueue = await GRN.countDocuments(mergeWarehouseFilter({ status: { $in: ['pending', 'in-progress'] } }, warehouseKey));
  const outboundQueue = await Picklist.countDocuments(mergeWarehouseFilter(ACTIVE_PICKLIST_FILTER, warehouseKey));
  const criticalAlerts = await StockAlert.countDocuments(mergeWarehouseFilter({ priority: 'high' }, warehouseKey));

  const totalSKUs = await InventoryItem.countDocuments(warehouseKeyMatch(warehouseKey));
  let inventoryHealth = 0;
  if (totalSKUs > 0) {
    const healthySKUs = await InventoryItem.countDocuments(
      mergeWarehouseFilter({ $expr: { $gte: ['$currentStock', '$minStock'] } }, warehouseKey),
    );
    inventoryHealth = Math.round((healthySKUs / totalSKUs) * 1000) / 10;
  }

  const totalBins = await StorageLocation.countDocuments(warehouseKeyMatch(warehouseKey));
  const occupiedBins = await StorageLocation.countDocuments(mergeWarehouseFilter({ status: 'occupied' }, warehouseKey));
  const binsUtil = totalBins > 0 ? Math.round((occupiedBins / totalBins) * 1000) / 10 : 0;

  const coldTotal = await StorageLocation.countDocuments(mergeWarehouseFilter({ zone: { $regex: 'cold', $options: 'i' } }, warehouseKey));
  const coldOccupied = await StorageLocation.countDocuments(
    mergeWarehouseFilter({ zone: { $regex: 'cold', $options: 'i' }, status: 'occupied' }, warehouseKey),
  );
  const coldUtil = coldTotal > 0 ? Math.round((coldOccupied / coldTotal) * 1000) / 10 : 0;

  const stageTotal = await StorageLocation.countDocuments(mergeWarehouseFilter({ zone: { $regex: 'stage', $options: 'i' } }, warehouseKey));
  const stageOccupied = await StorageLocation.countDocuments(
    mergeWarehouseFilter({ zone: { $regex: 'stage', $options: 'i' }, status: 'occupied' }, warehouseKey),
  );
  const stageUtil = stageTotal > 0 ? Math.round((stageOccupied / stageTotal) * 1000) / 10 : 0;

  const ambientTotal = Math.max(0, totalBins - coldTotal - stageTotal);
  const ambientOccupied = Math.max(0, occupiedBins - coldOccupied - stageOccupied);
  const ambientUtil = ambientTotal > 0 ? Math.round((ambientOccupied / ambientTotal) * 1000) / 10 : 0;

  return {
    inboundQueue,
    outboundQueue,
    inventoryHealth,
    criticalAlerts,
    capacityUtilization: { bins: binsUtil, coldStorage: coldUtil, stage: stageUtil, ambient: ambientUtil },
  };
}

export async function getWarehouseMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const metrics = await getMetrics(req.user!.warehouseKey!);
    res.status(200).json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
}

export async function getOrderFlow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const picklists = await Picklist.find(mergeWarehouseFilter(ACTIVE_PICKLIST_FILTER, req.user!.warehouseKey!))
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();
    const orderByKey = await loadOrdersForPicklists(req.user!.warehouseKey!, picklists as unknown as Record<string, unknown>[]);
    const flow = (picklists as unknown as Record<string, unknown>[]).map((p) => mapPicklistToFlowEntry(p, orderByKey));
    res.status(200).json({ success: true, data: flow, meta: { count: flow.length } });
  } catch (err) {
    next(err);
  }
}

export async function getDailyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const warehouseKey = req.user!.warehouseKey!;
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const totalGRNsProcessed = await GRN.countDocuments(mergeWarehouseFilter({ status: 'completed', updatedAt: { $gte: start, $lt: end } }, warehouseKey));
    const totalOrdersPicked = await Picklist.countDocuments(mergeWarehouseFilter({ status: 'completed', updatedAt: { $gte: start, $lt: end } }, warehouseKey));
    const totalItemsAdjusted = await InventoryAdjustment.countDocuments(mergeWarehouseFilter({ timestamp: { $gte: start, $lt: end } }, warehouseKey));

    const qcTotal = await QCInspection.countDocuments(mergeWarehouseFilter({ date: { $gte: start, $lt: end } }, warehouseKey));
    const qcPassed = qcTotal > 0
      ? await QCInspection.countDocuments(mergeWarehouseFilter({ date: { $gte: start, $lt: end }, status: 'passed' }, warehouseKey))
      : 0;
    const qcPassRate = qcTotal > 0 ? `${Math.round((qcPassed / qcTotal) * 1000) / 10}%` : 'N/A';

    const activeStaff = await Staff.countDocuments(mergeWarehouseFilter({ status: { $in: ['active', 'Active'] } }, warehouseKey));

    const topPerformers = await Picklist.aggregate([
      { $match: mergeWarehouseFilter({ status: 'completed', updatedAt: { $gte: start, $lt: end } }, warehouseKey) },
      { $group: { _id: '$picker', tasks: { $sum: 1 } } },
      { $sort: { tasks: -1 } },
      { $limit: 5 },
      { $project: { name: '$_id', tasks: 1, _id: 0 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        date: start.toISOString().split('T')[0],
        stats: { totalGRNsProcessed, totalOrdersPicked, totalItemsAdjusted, qcPassRate, activeStaff },
        topPerformers,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getOperationsView(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const warehouseKey = req.user!.warehouseKey!;
    const lastUpdate = new Date().toISOString();
    const metrics = await getMetrics(warehouseKey);

    const picklists = await Picklist.find(mergeWarehouseFilter(ACTIVE_PICKLIST_FILTER, warehouseKey))
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();
    const orderByKey = await loadOrdersForPicklists(warehouseKey, picklists as unknown as Record<string, unknown>[]);
    const recentOrders = (picklists as unknown as Record<string, unknown>[]).map((p) => mapPicklistToFlowEntry(p, orderByKey));
    const orderFlowCounts = await countOrderFlowByStatus(warehouseKey);

    const openExceptions = await WarehouseException.countDocuments(
      mergeWarehouseFilter({ status: { $in: ['open', 'investigating'] } }, warehouseKey),
    );
    const activeStaff = await Staff.countDocuments(mergeWarehouseFilter({ status: { $in: ['active', 'Active'] } }, warehouseKey));

    const zonesAgg = await StorageLocation.aggregate([
      { $match: warehouseKeyMatch(warehouseKey) },
      {
        $group: {
          _id: '$zone',
          total: { $sum: 1 },
          occupied: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } },
        },
      },
      {
        $project: {
          id: '$_id',
          name: '$_id',
          utilization: { $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$occupied', '$total'] }, 100] }, 0] },
          total: 1,
          occupied: 1,
        },
      },
      { $sort: { utilization: -1 } },
      { $limit: 12 },
    ]);

    const zones = zonesAgg.map((z) => ({
      id: z.id || 'unknown',
      name: z.name || 'unknown',
      utilization: Math.round((z.utilization || 0) * 10) / 10,
      total: z.total || 0,
      occupied: z.occupied || 0,
    }));

    const equipmentAgg = await WarehouseEquipment.aggregate([
      { $match: warehouseKeyMatch(warehouseKey) },
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          maintenance: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } },
        },
      },
    ]);
    const equipmentStatus: Record<string, { total: number; active: number; maintenance: number }> = {};
    for (const e of equipmentAgg) {
      const key = (e._id as string) || 'other';
      equipmentStatus[key] = { total: e.total, active: e.active, maintenance: e.maintenance };
    }

    const { status: operationalStatus, message: statusMessage } = deriveOperationalStatus(
      metrics as unknown as Record<string, unknown>,
      openExceptions,
    );

    res.status(200).json({
      success: true,
      data: {
        lastUpdate,
        operationalStatus,
        statusMessage,
        metrics,
        orderFlow: {
          total: orderFlowCounts.total,
          byStatus: { picking: orderFlowCounts.picking, pending: orderFlowCounts.pending, dispatching: orderFlowCounts.dispatching },
          recent: recentOrders,
        },
        zones,
        equipmentStatus,
        openExceptions,
        activeStaff,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const warehouseKey = req.user!.warehouseKey!;
    const weeklyData = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const inbound = await GRN.countDocuments(mergeWarehouseFilter({ status: 'completed', updatedAt: { $gte: start, $lt: end } }, warehouseKey));
      const outbound = await Picklist.countDocuments(mergeWarehouseFilter({ status: 'completed', updatedAt: { $gte: start, $lt: end } }, warehouseKey));

      weeklyData.push({ day: days[start.getDay()], inbound, outbound, productivity: 85 + (inbound + outbound) });
    }

    const totalLocations = await StorageLocation.countDocuments(warehouseKeyMatch(warehouseKey));
    const occupied = await StorageLocation.countDocuments(mergeWarehouseFilter({ status: 'occupied' }, warehouseKey));
    const restricted = await StorageLocation.countDocuments(mergeWarehouseFilter({ status: 'restricted' }, warehouseKey));
    const empty = totalLocations - occupied - restricted;

    const storageData = [
      { name: 'Occupied', value: totalLocations > 0 ? Math.round((occupied / totalLocations) * 100) : 0, color: '#0891b2' },
      { name: 'Empty', value: totalLocations > 0 ? Math.round((empty / totalLocations) * 100) : 0, color: '#64748B' },
      { name: 'Restricted', value: totalLocations > 0 ? Math.round((restricted / totalLocations) * 100) : 0, color: '#EF4444' },
    ];

    const inventoryByCategory = await InventoryItem.aggregate([
      { $match: warehouseKeyMatch(warehouseKey) },
      { $group: { _id: '$category', value: { $sum: '$currentStock' } } },
      { $project: { category: '$_id', value: 1, _id: 0 } },
      { $sort: { value: -1 } },
      { $limit: 5 },
    ]);

    const totalStaff = await Staff.countDocuments(warehouseKeyMatch(warehouseKey));
    const activeStaff = await Staff.countDocuments(mergeWarehouseFilter({ status: 'Active' }, warehouseKey));
    const attendanceRate = totalStaff > 0 ? Math.round((activeStaff / totalStaff) * 100) : 0;

    const totalSKUs = await InventoryItem.countDocuments(warehouseKeyMatch(warehouseKey));
    const stockouts = await InventoryItem.countDocuments(mergeWarehouseFilter({ $expr: { $lte: ['$currentStock', 0] } }, warehouseKey));

    const metricsPayload = {
      inboundTurnaround: '94%',
      outboundOnTime: '92%',
      pickingSpeed: '88',
      accuracy: '99.8%',
      shrinkage: '0.15%',
      turnoverRate: '14 days',
      avgUPH: '92',
      errorRate: '2%',
      attendance: `${attendanceRate}%`,
      totalStaff: String(totalStaff),
      activeStaff: String(activeStaff),
      totalSKUs: String(totalSKUs),
      stockouts: String(stockouts),
      expiringSoon: '0',
    };

    res.status(200).json({
      success: true,
      data: { weeklyData, storageData, inventoryData: inventoryByCategory, metrics: metricsPayload },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export async function getLiveAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkedIn = await WarehouseAttendance.find(
      mergeWarehouseFilter({ status: 'check-in', timestamp: { $gte: today } }, wk),
    ).lean();
    const staffIds = checkedIn.map((a) => (a as Record<string, unknown>).staffId);
    const staffList = staffIds.length
      ? await Staff.find(mergeWarehouseFilter({ id: { $in: staffIds } }, wk)).lean()
      : [];
    res.json({ success: true, data: { count: staffList.length, staff: staffList } });
  } catch (err) {
    next(err);
  }
}

// ─── Devices ──────────────────────────────────────────────────────────────────

export async function listDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const devices = await HSDDevice.find(mergeWarehouseFilter({ type: 'hsd-device' }, wk)).lean();
    res.json({ success: true, data: devices });
  } catch (err) {
    next(err);
  }
}

export async function createDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `DEV-${Date.now()}`;
    const device = await HSDDevice.create({ ...req.body, id, type: 'hsd-device', ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
}

export async function patchDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const device = await HSDDevice.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $set: req.body },
      { new: true },
    ).lean();
    if (!device) { res.status(404).json({ success: false, message: 'Device not found' }); return; }
    res.json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
}

// ─── Equipment ────────────────────────────────────────────────────────────────

export async function getEquipmentDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const devices = await WarehouseEquipment.find(mergeWarehouseFilter({ type: 'hsd-device' }, wk)).lean();
    res.json({ success: true, data: devices });
  } catch (err) {
    next(err);
  }
}

export async function getEquipmentDeviceDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const device = await WarehouseEquipment.findOne(mergeWarehouseFilter({ id: req.params.id, type: 'hsd-device' }, wk)).lean();
    if (!device) { res.status(404).json({ success: false, message: 'Device not found' }); return; }
    res.json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
}

export async function getMachinery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const machinery = await WarehouseEquipment.find(
      mergeWarehouseFilter({ type: { $nin: ['hsd-device'] } }, wk),
    ).lean();
    res.json({ success: true, data: machinery });
  } catch (err) {
    next(err);
  }
}

export async function addMachinery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `EQ-${Date.now()}`;
    const item = await WarehouseEquipment.create({ ...req.body, id, ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function getMachineryDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const item = await WarehouseEquipment.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Equipment not found' }); return; }
    const issues = await EquipmentIssue.find(mergeWarehouseFilter({ equipmentId: req.params.id }, wk)).lean();
    res.json({ success: true, data: { ...item as Record<string, unknown>, issues } });
  } catch (err) {
    next(err);
  }
}

export async function reportEquipmentIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `EI-${Date.now()}`;
    const issue = await EquipmentIssue.create({
      ...req.body,
      id,
      equipmentId: req.params.id,
      reportedBy: req.user!.userId,
      reportedAt: new Date(),
      status: 'open',
      ...warehouseFieldsForCreate(wk),
    });
    res.status(201).json({ success: true, data: issue });
  } catch (err) {
    next(err);
  }
}

export async function resolveEquipmentIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const issue = await EquipmentIssue.findOneAndUpdate(
      mergeWarehouseFilter({ equipmentId: req.params.id, status: { $ne: 'resolved' } }, wk),
      { $set: { status: 'resolved', resolvedAt: new Date(), resolutionNotes: req.body.notes || '' } },
      { new: true },
    ).lean();
    res.json({ success: true, data: issue });
  } catch (err) {
    next(err);
  }
}

export async function exportEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const data = await WarehouseEquipment.find(warehouseKeyMatch(wk)).lean();
    res.json({ success: true, data, exportedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

// ─── Exceptions ───────────────────────────────────────────────────────────────

export async function getExceptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    const exceptions = await WarehouseException.find(mergeWarehouseFilter(filter, wk)).sort({ reportedAt: -1 }).lean();
    res.json({ success: true, data: exceptions, meta: { count: exceptions.length } });
  } catch (err) {
    next(err);
  }
}

export async function reportException(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `EXC-${Date.now()}`;
    const exc = await WarehouseException.create({
      ...req.body,
      id,
      reportedBy: req.user!.userId,
      reportedAt: new Date(),
      status: 'open',
      ...warehouseFieldsForCreate(wk),
    });
    res.status(201).json({ success: true, data: exc });
  } catch (err) {
    next(err);
  }
}

export async function exportExceptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const data = await WarehouseException.find(warehouseKeyMatch(wk)).lean();
    res.json({ success: true, data, exportedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getExceptionDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const exc = await WarehouseException.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!exc) { res.status(404).json({ success: false, message: 'Exception not found' }); return; }
    res.json({ success: true, data: exc });
  } catch (err) {
    next(err);
  }
}

export async function updateExceptionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const exc = await WarehouseException.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $set: { status: req.body.status, resolutionNotes: req.body.notes, resolvedAt: req.body.status === 'resolved' ? new Date() : undefined } },
      { new: true },
    ).lean();
    if (!exc) { res.status(404).json({ success: false, message: 'Exception not found' }); return; }
    res.json({ success: true, data: exc });
  } catch (err) {
    next(err);
  }
}

export async function rejectShipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const exc = await WarehouseException.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $set: { status: 'resolved', resolutionNotes: `Shipment rejected: ${req.body.reason || ''}`, resolvedAt: new Date() } },
      { new: true },
    ).lean();
    res.json({ success: true, data: exc });
  } catch (err) {
    next(err);
  }
}

export async function acceptPartial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const exc = await WarehouseException.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $set: { status: 'resolved', resolutionNotes: `Partial acceptance: ${req.body.notes || ''}`, resolvedAt: new Date() } },
      { new: true },
    ).lean();
    res.json({ success: true, data: exc });
  } catch (err) {
    next(err);
  }
}

// ─── Inbound ──────────────────────────────────────────────────────────────────

export async function getInboundSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const pending = await GRN.countDocuments(mergeWarehouseFilter({ status: 'pending' }, wk));
    const inProgress = await GRN.countDocuments(mergeWarehouseFilter({ status: 'in-progress' }, wk));
    const completed = await GRN.countDocuments(mergeWarehouseFilter({ status: 'completed' }, wk));
    const discrepancy = await GRN.countDocuments(mergeWarehouseFilter({ status: 'discrepancy' }, wk));
    const docks = await DockSlot.find(warehouseKeyMatch(wk)).lean();
    res.json({ success: true, data: { pending, inProgress, completed, discrepancy, totalDocks: docks.length, docks } });
  } catch (err) {
    next(err);
  }
}

export async function getGRNs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    const grns = await GRN.find(mergeWarehouseFilter(filter, wk)).sort({ timestamp: -1 }).lean();
    res.json({ success: true, data: grns, meta: { count: grns.length } });
  } catch (err) {
    next(err);
  }
}

export async function createGRN(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `GRN-${Date.now()}`;
    const grn = await GRN.create({ ...req.body, id, status: 'pending', timestamp: new Date(), ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: grn });
  } catch (err) {
    next(err);
  }
}

export async function exportGRNs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const data = await GRN.find(warehouseKeyMatch(wk)).lean();
    res.json({ success: true, data, exportedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getGRNDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const grn = await GRN.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!grn) { res.status(404).json({ success: false, message: 'GRN not found' }); return; }
    res.json({ success: true, data: grn });
  } catch (err) {
    next(err);
  }
}

export async function startGRN(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const grn = await GRN.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $set: { status: 'in-progress' } },
      { new: true },
    ).lean();
    if (!grn) { res.status(404).json({ success: false, message: 'GRN not found' }); return; }
    res.json({ success: true, data: grn });
  } catch (err) {
    next(err);
  }
}

export async function completeGRN(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const grn = await GRN.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $set: { status: 'completed' } },
      { new: true },
    ).lean();
    if (!grn) { res.status(404).json({ success: false, message: 'GRN not found' }); return; }
    res.json({ success: true, data: grn });
  } catch (err) {
    next(err);
  }
}

export async function logGRNDiscrepancy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const grn = await GRN.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $set: { status: 'discrepancy', discrepancyNotes: req.body.notes, discrepancyType: req.body.type } },
      { new: true },
    ).lean();
    if (!grn) { res.status(404).json({ success: false, message: 'GRN not found' }); return; }
    res.json({ success: true, data: grn });
  } catch (err) {
    next(err);
  }
}

export async function getDocks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const docks = await DockSlot.find(warehouseKeyMatch(wk)).lean();
    res.json({ success: true, data: docks });
  } catch (err) {
    next(err);
  }
}

export async function updateDock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const dock = await DockSlot.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $set: req.body },
      { new: true },
    ).lean();
    if (!dock) { res.status(404).json({ success: false, message: 'Dock not found' }); return; }
    res.json({ success: true, data: dock });
  } catch (err) {
    next(err);
  }
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function getInventorySummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const totalSKUs = await InventoryItem.countDocuments(warehouseKeyMatch(wk));
    const lowStock = await InventoryItem.countDocuments(mergeWarehouseFilter({ $expr: { $lt: ['$currentStock', '$minStock'] } }, wk));
    const outOfStock = await InventoryItem.countDocuments(mergeWarehouseFilter({ $expr: { $lte: ['$currentStock', 0] } }, wk));
    const totalLocations = await StorageLocation.countDocuments(warehouseKeyMatch(wk));
    const occupied = await StorageLocation.countDocuments(mergeWarehouseFilter({ status: 'occupied' }, wk));
    const totalAlerts = await StockAlert.countDocuments(warehouseKeyMatch(wk));
    res.json({ success: true, data: { totalSKUs, lowStock, outOfStock, totalLocations, occupied, emptyLocations: totalLocations - occupied, totalAlerts } });
  } catch (err) {
    next(err);
  }
}

export async function getInventoryMeta(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const categories = await InventoryItem.distinct('category', warehouseKeyMatch(wk));
    const zones = await StorageLocation.distinct('zone', warehouseKeyMatch(wk));
    res.json({ success: true, data: { categories, zones } });
  } catch (err) {
    next(err);
  }
}

export async function listInventoryItems(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const filter: Record<string, unknown> = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) filter.$or = [{ sku: { $regex: req.query.search, $options: 'i' } }, { productName: { $regex: req.query.search, $options: 'i' } }];
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const items = await InventoryItem.find(mergeWarehouseFilter(filter, wk)).sort({ productName: 1 }).skip((page - 1) * limit).limit(limit).lean();
    const total = await InventoryItem.countDocuments(mergeWarehouseFilter(filter, wk));
    res.json({ success: true, data: items, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
}

export async function getInventoryItemById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const item = await InventoryItem.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Item not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function updateInventoryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const item = await InventoryItem.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $set: { ...req.body, lastUpdated: new Date() } },
      { new: true },
    ).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Item not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function listStorageLocations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.zone) filter.zone = req.query.zone;
    const locations = await StorageLocation.find(mergeWarehouseFilter(filter, wk)).lean();
    res.json({ success: true, data: locations, meta: { count: locations.length } });
  } catch (err) {
    next(err);
  }
}

export async function getStorageLocationById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const loc = await StorageLocation.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!loc) { res.status(404).json({ success: false, message: 'Location not found' }); return; }
    res.json({ success: true, data: loc });
  } catch (err) {
    next(err);
  }
}

export async function listAdjustments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const adjustments = await InventoryAdjustment.find(warehouseKeyMatch(wk)).sort({ timestamp: -1 }).limit(100).lean();
    res.json({ success: true, data: adjustments });
  } catch (err) {
    next(err);
  }
}

export async function createAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `ADJ-${Date.now()}`;
    const adj = await InventoryAdjustment.create({ ...req.body, id, user: req.user!.userId, timestamp: new Date(), ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: adj });
  } catch (err) {
    next(err);
  }
}

export async function listCycleCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const counts = await CycleCount.find(warehouseKeyMatch(wk)).sort({ scheduledDate: -1 }).lean();
    res.json({ success: true, data: counts });
  } catch (err) {
    next(err);
  }
}

export async function getCycleCountById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const count = await CycleCount.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!count) { res.status(404).json({ success: false, message: 'Cycle count not found' }); return; }
    res.json({ success: true, data: count });
  } catch (err) {
    next(err);
  }
}

export async function createCycleCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `CC-${Date.now()}`;
    const countId = `CNT-${Date.now()}`;
    const cc = await CycleCount.create({ ...req.body, id, countId, status: 'scheduled', itemsTotal: 0, itemsCounted: 0, discrepancies: 0, items: [], ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: cc });
  } catch (err) {
    next(err);
  }
}

export async function updateCycleCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const cc = await CycleCount.findOneAndUpdate(mergeWarehouseFilter({ id: req.params.id }, wk), { $set: req.body }, { new: true }).lean();
    if (!cc) { res.status(404).json({ success: false, message: 'Cycle count not found' }); return; }
    res.json({ success: true, data: cc });
  } catch (err) {
    next(err);
  }
}

export async function startCycleCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const cc = await CycleCount.findOneAndUpdate(mergeWarehouseFilter({ id: req.params.id }, wk), { $set: { status: 'in-progress' } }, { new: true }).lean();
    if (!cc) { res.status(404).json({ success: false, message: 'Cycle count not found' }); return; }
    res.json({ success: true, data: cc });
  } catch (err) {
    next(err);
  }
}

export async function completeCycleCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const cc = await CycleCount.findOneAndUpdate(mergeWarehouseFilter({ id: req.params.id }, wk), { $set: { status: 'completed', ...req.body } }, { new: true }).lean();
    if (!cc) { res.status(404).json({ success: false, message: 'Cycle count not found' }); return; }
    res.json({ success: true, data: cc });
  } catch (err) {
    next(err);
  }
}

export async function listInternalTransfers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const transfers = await InternalTransfer.find(warehouseKeyMatch(wk)).sort({ timestamp: -1 }).lean();
    res.json({ success: true, data: transfers });
  } catch (err) {
    next(err);
  }
}

export async function getInternalTransferById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const t = await InternalTransfer.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!t) { res.status(404).json({ success: false, message: 'Transfer not found' }); return; }
    res.json({ success: true, data: t });
  } catch (err) {
    next(err);
  }
}

export async function createInternalTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `IT-${Date.now()}`;
    const transferId = `TRF-${Date.now()}`;
    const t = await InternalTransfer.create({ ...req.body, id, transferId, initiatedBy: req.user!.userId, status: 'pending', timestamp: new Date(), ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: t });
  } catch (err) {
    next(err);
  }
}

export async function updateTransferStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const t = await InternalTransfer.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $set: { status: req.body.status, completedAt: req.body.status === 'completed' ? new Date() : null } },
      { new: true },
    ).lean();
    if (!t) { res.status(404).json({ success: false, message: 'Transfer not found' }); return; }
    res.json({ success: true, data: t });
  } catch (err) {
    next(err);
  }
}

export async function listStockAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const alerts = await StockAlert.find(warehouseKeyMatch(wk)).sort({ priority: 1, lastUpdated: -1 }).lean();
    res.json({ success: true, data: alerts });
  } catch (err) {
    next(err);
  }
}

export async function generateStockAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const lowItems = await InventoryItem.find(mergeWarehouseFilter({ $expr: { $lt: ['$currentStock', '$minStock'] } }, wk)).lean();
    const created: unknown[] = [];
    for (const item of lowItems as Record<string, unknown>[]) {
      const existing = await StockAlert.findOne(mergeWarehouseFilter({ sku: item.sku as string, type: 'low-stock' }, wk)).lean();
      if (!existing) {
        const id = `SA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const alert = await StockAlert.create({
          id, sku: item.sku, productName: item.productName, type: 'low-stock',
          currentLevel: item.currentStock, threshold: item.minStock,
          priority: (item.currentStock as number) === 0 ? 'high' : 'medium',
          lastUpdated: new Date(), ...warehouseFieldsForCreate(wk),
        });
        created.push(alert);
      }
    }
    res.json({ success: true, data: { generated: created.length, alerts: created } });
  } catch (err) {
    next(err);
  }
}

export async function createReorderRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `RO-${Date.now()}`;
    const reorder = await ReorderRequest.create({ ...req.body, id, requestedBy: req.user!.userId, timestamp: new Date(), status: 'pending', ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: reorder });
  } catch (err) {
    next(err);
  }
}

export async function exportInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const data = await InventoryItem.find(warehouseKeyMatch(wk)).lean();
    res.json({ success: true, data, exportedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const userId = req.user!.userId;
    const limit = Math.min(100, Number(req.query.limit) || 30);
    const notifications = await WarehouseNotification.find(warehouseKeyMatch(wk)).sort({ createdAt: -1 }).limit(limit).lean();
    const result = (notifications as Record<string, unknown>[]).map((n) => ({
      ...n,
      read: Array.isArray(n.readByUserIds) && (n.readByUserIds as string[]).includes(userId),
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const userId = req.user!.userId;
    const n = await WarehouseNotification.findOneAndUpdate(
      mergeWarehouseFilter({ _id: req.params.id }, wk),
      { $addToSet: { readByUserIds: userId } },
      { new: true },
    ).lean();
    if (!n) { res.status(404).json({ success: false, message: 'Notification not found' }); return; }
    res.json({ success: true, data: n });
  } catch (err) {
    next(err);
  }
}

export async function markAllNotificationsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const userId = req.user!.userId;
    await WarehouseNotification.updateMany(warehouseKeyMatch(wk), { $addToSet: { readByUserIds: userId } });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    const orders = await WarehouseOrder.find(mergeWarehouseFilter(filter, wk)).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, data: orders, meta: { count: orders.length } });
  } catch (err) {
    next(err);
  }
}

export async function assignOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const order = await WarehouseOrder.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.orderId }, wk),
      { $set: { riderId: req.body.riderId, status: 'assigned' } },
      { new: true },
    ).lean();
    if (!order) { res.status(404).json({ success: false, message: 'Order not found' }); return; }
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function alertOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const order = await WarehouseOrder.findOne(mergeWarehouseFilter({ id: req.params.orderId }, wk)).lean();
    if (!order) { res.status(404).json({ success: false, message: 'Order not found' }); return; }
    const id = `NOT-${Date.now()}`;
    const notif = await WarehouseNotification.create({
      title: `Alert: Order ${req.params.orderId}`,
      body: req.body.message || 'Alert raised for order',
      category: 'outbound',
      channel: 'in-app',
      refType: 'order',
      refId: req.params.orderId,
      readByUserIds: [],
      ...warehouseFieldsForCreate(wk),
    });
    void id;
    res.json({ success: true, data: notif });
  } catch (err) {
    next(err);
  }
}

// ─── Outbound ─────────────────────────────────────────────────────────────────

export async function getPicklists(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    const picklists = await Picklist.find(mergeWarehouseFilter(filter, wk)).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: picklists, meta: { count: picklists.length } });
  } catch (err) {
    next(err);
  }
}

export async function getPicklistDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const pl = await Picklist.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!pl) { res.status(404).json({ success: false, message: 'Picklist not found' }); return; }
    res.json({ success: true, data: pl });
  } catch (err) {
    next(err);
  }
}

export async function assignPicker(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const pl = await Picklist.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $set: { pickerId: req.body.pickerId, picker: req.body.pickerName, status: 'assigned' } },
      { new: true },
    ).lean();
    if (!pl) { res.status(404).json({ success: false, message: 'Picklist not found' }); return; }
    res.json({ success: true, data: pl });
  } catch (err) {
    next(err);
  }
}

export async function listBatches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const batches = await PickingBatch.find(warehouseKeyMatch(wk)).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: batches });
  } catch (err) {
    next(err);
  }
}

export async function createBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `BATCH-${Date.now()}`;
    const batch = await PickingBatch.create({ ...req.body, id, status: 'pending', ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
}

export async function getBatchDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const batch = await PickingBatch.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!batch) { res.status(404).json({ success: false, message: 'Batch not found' }); return; }
    res.json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
}

export async function getPickers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const pickers = await Staff.find(mergeWarehouseFilter({ role: 'Picker' }, wk)).lean();
    res.json({ success: true, data: pickers });
  } catch (err) {
    next(err);
  }
}

export async function getPickerOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const picklists = await Picklist.find(mergeWarehouseFilter({ pickerId: req.params.id, status: { $nin: ['completed'] } }, wk)).lean();
    res.json({ success: true, data: picklists });
  } catch (err) {
    next(err);
  }
}

export async function getActiveRoutes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const orders = await WarehouseOrder.find(mergeWarehouseFilter({ status: { $in: ['assigned', 'in_transit', 'picked_up'] } }, wk))
      .select('id riderId zone pickupLocation dropLocation status delivery')
      .lean();
    res.json({ success: true, data: { routes: orders } });
  } catch (err) {
    next(err);
  }
}

export async function getRouteMap(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const order = await WarehouseOrder.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!order) { res.status(404).json({ success: false, message: 'Route not found' }); return; }
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function getConsolidatedPicks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const batches = await PickingBatch.find(mergeWarehouseFilter({ status: { $nin: ['completed'] } }, wk)).lean();
    res.json({ success: true, data: batches });
  } catch (err) {
    next(err);
  }
}

// ─── QC ───────────────────────────────────────────────────────────────────────

export async function getInspections(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    const items = await QCInspection.find(mergeWarehouseFilter(filter, wk)).sort({ date: -1 }).lean();
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

export async function createInspection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `QC-${Date.now()}`;
    const inspectionId = `INS-${Date.now()}`;
    const item = await QCInspection.create({ ...req.body, id, inspectionId, status: 'pending', date: new Date(), ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function getInspectionDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const item = await QCInspection.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Inspection not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function updateInspection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const item = await QCInspection.findOneAndUpdate(mergeWarehouseFilter({ id: req.params.id }, wk), { $set: req.body }, { new: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Inspection not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function getTemperatureLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const logs = await TemperatureLog.find(warehouseKeyMatch(wk)).sort({ timestamp: -1 }).limit(100).lean();
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

export async function createTemperatureLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `TL-${Date.now()}`;
    const log = await TemperatureLog.create({ ...req.body, id, timestamp: new Date(), ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
}

export async function getTempChart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const log = await TemperatureLog.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!log) { res.status(404).json({ success: false, message: 'Log not found' }); return; }
    const zone = (log as Record<string, unknown>).zone as string;
    const history = await TemperatureLog.find(mergeWarehouseFilter({ zone }, wk)).sort({ timestamp: -1 }).limit(24).lean();
    res.json({ success: true, data: { log, history } });
  } catch (err) {
    next(err);
  }
}

export async function getRejections(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const items = await BatchRejection.find(warehouseKeyMatch(wk)).sort({ rejectedAt: -1 }).lean();
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

export async function logRejection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `REJ-${Date.now()}`;
    const item = await BatchRejection.create({ ...req.body, id, rejectedBy: req.user!.userId, rejectedAt: new Date(), ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function getComplianceDocs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const docs = await ComplianceDoc.find(warehouseKeyMatch(wk)).lean();
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
}

export async function getComplianceDoc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const doc = await ComplianceDoc.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!doc) { res.status(404).json({ success: false, message: 'Document not found' }); return; }
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

export async function getSamples(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const samples = await SampleTest.find(warehouseKeyMatch(wk)).sort({ testDate: -1 }).lean();
    res.json({ success: true, data: samples });
  } catch (err) {
    next(err);
  }
}

export async function createSample(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `ST-${Date.now()}`;
    const sampleId = `SMP-${Date.now()}`;
    const sample = await SampleTest.create({ ...req.body, id, sampleId, result: 'pending', testDate: new Date(), ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: sample });
  } catch (err) {
    next(err);
  }
}

export async function updateSample(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const sample = await SampleTest.findOneAndUpdate(mergeWarehouseFilter({ id: req.params.id }, wk), { $set: req.body }, { new: true }).lean();
    if (!sample) { res.status(404).json({ success: false, message: 'Sample not found' }); return; }
    res.json({ success: true, data: sample });
  } catch (err) {
    next(err);
  }
}

export async function getComplianceChecks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const checks = await ComplianceCheck.find(warehouseKeyMatch(wk)).lean();
    res.json({ success: true, data: checks });
  } catch (err) {
    next(err);
  }
}

export async function toggleComplianceCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const check = await ComplianceCheck.findOne(mergeWarehouseFilter({ id: req.params.id }, wk));
    if (!check) { res.status(404).json({ success: false, message: 'Check not found' }); return; }
    check.completed = !check.completed;
    if (check.completed) { check.completedAt = new Date(); check.completedBy = req.user!.userId; }
    await check.save();
    res.json({ success: true, data: check });
  } catch (err) {
    next(err);
  }
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export async function getStaffSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const total = await Staff.countDocuments(warehouseKeyMatch(wk));
    const active = await Staff.countDocuments(mergeWarehouseFilter({ status: 'Active' }, wk));
    const onBreak = await Staff.countDocuments(mergeWarehouseFilter({ status: 'Break' }, wk));
    const offline = await Staff.countDocuments(mergeWarehouseFilter({ status: 'Offline' }, wk));
    const byRole = await Staff.aggregate([{ $match: warehouseKeyMatch(wk) }, { $group: { _id: '$role', count: { $sum: 1 } } }]);
    res.json({ success: true, data: { total, active, onBreak, offline, byRole } });
  } catch (err) {
    next(err);
  }
}

export async function listStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const filter: Record<string, unknown> = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;
    const staff = await Staff.find(mergeWarehouseFilter(filter, wk)).lean();
    res.json({ success: true, data: staff });
  } catch (err) {
    next(err);
  }
}

export async function listShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const filter: Record<string, unknown> = {};
    if (req.query.date) filter.date = { $gte: new Date(req.query.date as string) };
    const shifts = await Shift.find(mergeWarehouseFilter(filter, wk)).sort({ date: -1 }).lean();
    res.json({ success: true, data: shifts });
  } catch (err) {
    next(err);
  }
}

export async function createShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `SHF-${Date.now()}`;
    const shift = await Shift.create({ ...req.body, id, ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
}

export async function getShiftById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const shift = await Shift.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!shift) { res.status(404).json({ success: false, message: 'Shift not found' }); return; }
    res.json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
}

export async function updateShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const shift = await Shift.findOneAndUpdate(mergeWarehouseFilter({ id: req.params.id }, wk), { $set: req.body }, { new: true }).lean();
    if (!shift) { res.status(404).json({ success: false, message: 'Shift not found' }); return; }
    res.json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
}

export async function getShiftCoverage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    const slots = await WarehouseShiftSlot.find(mergeWarehouseFilter({ date: { $gte: today, $lt: end } }, wk)).lean();
    res.json({ success: true, data: slots });
  } catch (err) {
    next(err);
  }
}

export async function getWeeklyRoster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    const shifts = await Shift.find(mergeWarehouseFilter({ date: { $gte: today, $lt: end } }, wk)).sort({ date: 1 }).lean();
    res.json({ success: true, data: shifts });
  } catch (err) {
    next(err);
  }
}

export async function publishWeeklyRoster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    const result = await Shift.updateMany(
      mergeWarehouseFilter({ date: { $gte: today, $lt: end }, status: 'scheduled' }, wk),
      { $set: { status: 'scheduled' } },
    );
    // Persist a publish marker via notification so ops can see the action landed.
    await WarehouseNotification.create({
      title: 'Weekly roster published',
      body: `${result.modifiedCount} scheduled shift(s) confirmed for the next 7 days`,
      category: 'workforce',
      channel: 'in-app',
      refType: 'roster',
      refId: `week-${today.toISOString().slice(0, 10)}`,
      readByUserIds: [],
      ...warehouseFieldsForCreate(wk),
    });
    res.json({
      success: true,
      message: 'Weekly roster published',
      publishedAt: new Date().toISOString(),
      shiftsConfirmed: result.matchedCount,
    });
  } catch (err) {
    next(err);
  }
}

export async function listAbsences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const absences = await Absence.find(warehouseKeyMatch(wk)).sort({ date: -1 }).lean();
    res.json({ success: true, data: absences });
  } catch (err) {
    next(err);
  }
}

export async function logAbsence(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `ABS-${Date.now()}`;
    const absence = await Absence.create({ ...req.body, id, date: req.body.date ? new Date(req.body.date) : new Date(), ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: absence });
  } catch (err) {
    next(err);
  }
}

export async function autoAssignShifts(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Warehouse shift auto-assign');
}

export async function getStaffPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const staff = await Staff.find(warehouseKeyMatch(wk)).select('id name role performance productivity status').lean();
    res.json({ success: true, data: staff });
  } catch (err) {
    next(err);
  }
}

export async function getIncentiveCriteria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({
      success: true,
      data: {
        criteria: [
          { label: 'Orders Completed', target: 50, bonus: 500 },
          { label: 'Attendance', target: '100%', bonus: 300 },
          { label: 'Zero Errors', target: true, bonus: 200 },
        ],
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Transfers (Inter-Warehouse) ──────────────────────────────────────────────

export async function listInterWarehouseTransfers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const transfers = await InterWarehouseTransfer.find(warehouseKeyMatch(wk)).sort({ requestedAt: -1 }).lean();
    res.json({ success: true, data: transfers });
  } catch (err) {
    next(err);
  }
}

export async function requestInterWarehouseTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `IWT-${Date.now()}`;
    const t = await InterWarehouseTransfer.create({ ...req.body, id, status: 'pending', progress: 0, requestedBy: req.user!.userId, requestedAt: new Date(), ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: t });
  } catch (err) {
    next(err);
  }
}

export async function getInterWarehouseTransferDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const t = await InterWarehouseTransfer.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!t) { res.status(404).json({ success: false, message: 'Transfer not found' }); return; }
    res.json({ success: true, data: t });
  } catch (err) {
    next(err);
  }
}

export async function getInterWarehouseTransferItems(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const t = await InterWarehouseTransfer.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!t) { res.status(404).json({ success: false, message: 'Transfer not found' }); return; }
    res.json({ success: true, data: { transferId: req.params.id, items: [] } });
  } catch (err) {
    next(err);
  }
}

export async function updateInterWarehouseTransferStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const t = await InterWarehouseTransfer.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $set: { status: req.body.status } },
      { new: true },
    ).lean();
    if (!t) { res.status(404).json({ success: false, message: 'Transfer not found' }); return; }
    res.json({ success: true, data: t });
  } catch (err) {
    next(err);
  }
}

export async function exportInterWarehouseTransfers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const data = await InterWarehouseTransfer.find(warehouseKeyMatch(wk)).lean();
    res.json({ success: true, data, exportedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

// ─── WD Transfer Requests (Warehouse → Darkstore) ────────────────────────────

export async function getWDTransferRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, warehouseId } = req.query;
    const filter: Record<string, unknown> = {};
    if (warehouseId) filter.warehouse_id = warehouseId;
    if (status) filter.status = status;
    const requests = await WDTransferRequest.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: requests });
  } catch (err) { next(err); }
}

export async function getWDTransferRequestById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request = await WDTransferRequest.findOne({ transfer_id: req.params.id }).lean();
    if (!request) { res.status(404).json({ success: false, message: 'Transfer request not found' }); return; }
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
}

export async function getWDTransferLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const logs = await WDTransferLog.find({ transfer_id: req.params.id }).sort({ createdAt: 1 }).lean();
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
}

export async function acceptWDTransferRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { items } = req.body as { items?: Array<{ sku: string; approved_qty: number }> };
    const request = await WDTransferRequest.findOne({ transfer_id: req.params.id });
    if (!request) { res.status(404).json({ success: false, message: 'Transfer request not found' }); return; }
    if (request.status !== 'pending') { res.status(400).json({ success: false, message: `Cannot accept a request with status: ${request.status}` }); return; }

    if (items && items.length > 0) {
      const itemMap = new Map(items.map((i) => [i.sku, i.approved_qty]));
      request.items = request.items.map((item) => ({
        ...item,
        approved_qty: itemMap.has(item.sku) ? itemMap.get(item.sku)! : item.requested_qty,
      })) as typeof request.items;
    } else {
      request.items = request.items.map((item) => ({ ...item, approved_qty: item.requested_qty })) as typeof request.items;
    }

    const actor = req.user?.userId || req.user?.email || 'system';
    request.status = 'accepted';
    request.accepted_by = actor;
    await request.save();
    await WDTransferLog.create({ transfer_id: request.transfer_id, action: 'accepted', performed_by: actor, snapshot: { items: request.items } });
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
}

export async function rejectWDTransferRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request = await WDTransferRequest.findOne({ transfer_id: req.params.id });
    if (!request) { res.status(404).json({ success: false, message: 'Transfer request not found' }); return; }
    if (!['pending'].includes(request.status)) { res.status(400).json({ success: false, message: `Cannot reject a request with status: ${request.status}` }); return; }
    const actor = req.user?.userId || req.user?.email || 'system';
    request.status = 'rejected';
    if (req.body.notes) request.notes = req.body.notes;
    await request.save();
    await WDTransferLog.create({ transfer_id: request.transfer_id, action: 'rejected', performed_by: actor, note: req.body.notes });
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
}

export async function packWDTransferRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { items } = req.body as { items?: Array<{ sku: string; packed_qty: number }> };
    const request = await WDTransferRequest.findOne({ transfer_id: req.params.id });
    if (!request) { res.status(404).json({ success: false, message: 'Transfer request not found' }); return; }
    if (request.status !== 'accepted') { res.status(400).json({ success: false, message: `Cannot pack a request with status: ${request.status}` }); return; }

    if (items && items.length > 0) {
      const itemMap = new Map(items.map((i) => [i.sku, i.packed_qty]));
      request.items = request.items.map((item) => ({
        ...item,
        packed_qty: itemMap.has(item.sku) ? itemMap.get(item.sku)! : item.approved_qty,
      })) as typeof request.items;
    } else {
      request.items = request.items.map((item) => ({ ...item, packed_qty: item.approved_qty })) as typeof request.items;
    }

    const actor = req.user?.userId || req.user?.email || 'system';
    request.status = 'packed';
    await request.save();
    await WDTransferLog.create({ transfer_id: request.transfer_id, action: 'packed', performed_by: actor, snapshot: { items: request.items } });
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
}

export async function dispatchWDTransferRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { driver_name, driver_phone, vehicle_no, notes } = req.body;
    const request = await WDTransferRequest.findOne({ transfer_id: req.params.id });
    if (!request) { res.status(404).json({ success: false, message: 'Transfer request not found' }); return; }
    if (request.status !== 'packed') { res.status(400).json({ success: false, message: `Cannot dispatch a request with status: ${request.status}` }); return; }

    const actor = req.user?.userId || req.user?.email || 'system';
    request.status = 'dispatched';
    request.dispatch_date = new Date();
    if (driver_name) request.driver_name = driver_name;
    if (driver_phone) request.driver_phone = driver_phone;
    if (vehicle_no) request.vehicle_no = vehicle_no;
    if (notes) request.notes = notes;
    await request.save();
    await WDTransferLog.create({ transfer_id: request.transfer_id, action: 'dispatched', performed_by: actor, note: `Driver: ${driver_name || '—'}, Vehicle: ${vehicle_no || '—'}` });
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export async function getZones(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const zones = await StorageLocation.distinct('zone', warehouseKeyMatch(wk));
    res.json({ success: true, data: zones.filter(Boolean) });
  } catch (err) {
    next(err);
  }
}

export async function uploadSKUs(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Warehouse SKU bulk upload');
}

export async function getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const logs = await AccessLog.find(warehouseKeyMatch(wk)).sort({ timestamp: -1 }).limit(100).lean();
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

export async function generateLabels(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Alias of printBarcodes — downloadable CSV, not a silent empty success.
  return printBarcodes(req, res, next);
}

export async function reassignBins(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Warehouse bin reassignment');
}

/**
 * Generate a barcode label sheet for the requested SKUs.
 *
 * There is no physical printer integration in this service — the previous handler answered
 * `200 { message: 'Barcodes sent to printer', count: 0 }` while sending nothing. Operators now
 * get a downloadable CSV they can feed into a label printer, with one row per SKU resolved from
 * the product catalog (falling back to the submitted code when the product is unknown).
 */
export async function printBarcodes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as { skus?: string[]; codes?: string[]; qty?: number };
    const codes = [...(body.skus || []), ...(body.codes || [])]
      .map((c) => String(c || '').trim())
      .filter(Boolean);
    if (!codes.length) {
      res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Provide skus[] or codes[] to print.' });
      return;
    }

    const copies = Math.min(50, Math.max(1, Number(body.qty) || 1));
    const { Product } = await import('../products/products.model');
    const products = await Product.find({ sku: { $in: codes } })
      .select('sku name upcEan size uom')
      .lean();
    const bySku = new Map(products.map((p) => [String(p.sku).toUpperCase(), p]));

    const lines: string[] = ['SKU,Barcode,Product Name,Size,Copies'];
    for (const code of codes) {
      const product = bySku.get(code.toUpperCase());
      const barcode = String(product?.upcEan || code).trim() || code;
      const name = String(product?.name || '').replace(/"/g, '""');
      const size = String(product?.size || product?.uom || '').replace(/"/g, '""');
      lines.push(`"${code}","${barcode}","${name}","${size}",${copies}`);
    }

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="barcode-labels-${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function getOperationalSLAs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const total = await WarehouseOrder.countDocuments(warehouseKeyMatch(wk));
    const onTime = await WarehouseOrder.countDocuments(mergeWarehouseFilter({ status: 'delivered' }, wk));
    res.json({ success: true, data: { total, onTime, missed: total - onTime, slaRate: total > 0 ? Math.round((onTime / total) * 100) : 0 } });
  } catch (err) {
    next(err);
  }
}

export async function exportSLAMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const data = await WarehouseOrder.find(warehouseKeyMatch(wk)).select('id status slaDeadline completedAt').lean();
    res.json({ success: true, data, exportedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getInventoryHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const total = await InventoryItem.countDocuments(warehouseKeyMatch(wk));
    const healthy = total > 0 ? await InventoryItem.countDocuments(mergeWarehouseFilter({ $expr: { $gte: ['$currentStock', '$minStock'] } }, wk)) : 0;
    const lowStock = total - healthy;
    const outOfStock = await InventoryItem.countDocuments(mergeWarehouseFilter({ $expr: { $lte: ['$currentStock', 0] } }, wk));
    res.json({ success: true, data: { total, healthy, lowStock, outOfStock, healthRate: total > 0 ? Math.round((healthy / total) * 100) : 0 } });
  } catch (err) {
    next(err);
  }
}

export async function exportInventoryHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const data = await InventoryItem.find(warehouseKeyMatch(wk)).lean();
    res.json({ success: true, data, exportedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getProductivity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const totalStaff = await Staff.countDocuments(warehouseKeyMatch(wk));
    const completed = await Picklist.countDocuments(mergeWarehouseFilter({ status: 'completed' }, wk));
    res.json({ success: true, data: { totalStaff, ordersCompleted: completed, avgOrdersPerStaff: totalStaff > 0 ? Math.round((completed / totalStaff) * 10) / 10 : 0 } });
  } catch (err) {
    next(err);
  }
}

export async function exportProductivity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const data = await Staff.find(warehouseKeyMatch(wk)).select('id name role performance productivity').lean();
    res.json({ success: true, data, exportedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getStorageUtilization(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const total = await StorageLocation.countDocuments(warehouseKeyMatch(wk));
    const occupied = await StorageLocation.countDocuments(mergeWarehouseFilter({ status: 'occupied' }, wk));
    const empty = await StorageLocation.countDocuments(mergeWarehouseFilter({ status: 'empty' }, wk));
    const restricted = await StorageLocation.countDocuments(mergeWarehouseFilter({ status: 'restricted' }, wk));
    res.json({ success: true, data: { total, occupied, empty, restricted, utilizationRate: total > 0 ? Math.round((occupied / total) * 100) : 0 } });
  } catch (err) {
    next(err);
  }
}

export async function getOutputTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const days = 7;
    const trends = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const inbound = await GRN.countDocuments(mergeWarehouseFilter({ status: 'completed', updatedAt: { $gte: start, $lt: end } }, wk));
      const outbound = await Picklist.countDocuments(mergeWarehouseFilter({ status: 'completed', updatedAt: { $gte: start, $lt: end } }, wk));
      trends.push({ date: start.toISOString().split('T')[0], inbound, outbound });
    }
    res.json({ success: true, data: trends });
  } catch (err) {
    next(err);
  }
}

export async function getInventoryByCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const data = await InventoryItem.aggregate([
      { $match: warehouseKeyMatch(wk) },
      { $group: { _id: '$category', totalStock: { $sum: '$currentStock' }, skuCount: { $sum: 1 } } },
      { $project: { category: '$_id', totalStock: 1, skuCount: 1, _id: 0 } },
      { $sort: { totalStock: -1 } },
    ]);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ─── Workforce ────────────────────────────────────────────────────────────────

export async function getWorkforceStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const staff = await Staff.find(warehouseKeyMatch(wk)).lean();
    res.json({ success: true, data: staff });
  } catch (err) {
    next(err);
  }
}

export async function addWorkforceStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `STF-${Date.now()}`;
    const member = await Staff.create({ ...req.body, id, ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}

export async function getWorkforceStaffDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const member = await Staff.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!member) { res.status(404).json({ success: false, message: 'Staff not found' }); return; }
    const recentShifts = await Shift.find(mergeWarehouseFilter({ staffId: req.params.id }, wk)).sort({ date: -1 }).limit(10).lean();
    res.json({ success: true, data: { ...member as Record<string, unknown>, recentShifts } });
  } catch (err) {
    next(err);
  }
}

export async function getWorkforceSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const scheduleId = req.params.id;
    if (scheduleId) {
      const slot = await WarehouseShiftSlot.findOne(mergeWarehouseFilter({ id: scheduleId }, wk)).lean();
      if (!slot) { res.status(404).json({ success: false, message: 'Schedule not found' }); return; }
      res.json({ success: true, data: slot });
      return;
    }
    const slots = await WarehouseShiftSlot.find(warehouseKeyMatch(wk)).sort({ date: 1 }).lean();
    res.json({ success: true, data: slots });
  } catch (err) {
    next(err);
  }
}

export async function createWorkforceSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `SCH-${Date.now()}`;
    const slot = await WarehouseShiftSlot.create({ ...req.body, id, assignedStaff: [], ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: slot });
  } catch (err) {
    next(err);
  }
}

export async function assignWorkforceStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const slot = await WarehouseShiftSlot.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $addToSet: { assignedStaff: req.body.staffId } },
      { new: true },
    ).lean();
    if (!slot) { res.status(404).json({ success: false, message: 'Schedule not found' }); return; }
    res.json({ success: true, data: slot });
  } catch (err) {
    next(err);
  }
}

export async function getWorkforceAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const records = await WarehouseAttendance.find(mergeWarehouseFilter({ timestamp: { $gte: today } }, wk)).lean();
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
}

export async function getWorkforcePerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const staff = await Staff.find(warehouseKeyMatch(wk)).select('id name role performance productivity').lean();
    res.json({ success: true, data: staff });
  } catch (err) {
    next(err);
  }
}

export async function getLeaveRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const requests = await LeaveRequest.find(warehouseKeyMatch(wk)).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
}

export async function createLeaveRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `LR-${Date.now()}`;
    const lr = await LeaveRequest.create({ ...req.body, id, status: 'pending', ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: lr });
  } catch (err) {
    next(err);
  }
}

export async function updateLeaveStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const lr = await LeaveRequest.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $set: { status: req.body.status } },
      { new: true },
    ).lean();
    if (!lr) { res.status(404).json({ success: false, message: 'Leave request not found' }); return; }
    res.json({ success: true, data: lr });
  } catch (err) {
    next(err);
  }
}

export async function getTrainings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const trainings = await WarehouseTraining.find(warehouseKeyMatch(wk)).sort({ date: -1 }).lean();
    res.json({ success: true, data: trainings });
  } catch (err) {
    next(err);
  }
}

export async function createTraining(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `TRN-${Date.now()}`;
    const trainingId = `TRNID-${Date.now()}`;
    const training = await WarehouseTraining.create({ ...req.body, id, trainingId, enrolled: 0, enrolledStaff: [], ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: training });
  } catch (err) {
    next(err);
  }
}

export async function getTrainingDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const training = await WarehouseTraining.findOne(mergeWarehouseFilter({ id: req.params.id }, wk)).lean();
    if (!training) { res.status(404).json({ success: false, message: 'Training not found' }); return; }
    res.json({ success: true, data: training });
  } catch (err) {
    next(err);
  }
}

export async function enrollStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const training = await WarehouseTraining.findOneAndUpdate(
      mergeWarehouseFilter({ id: req.params.id }, wk),
      { $addToSet: { enrolledStaff: req.body.staffId }, $inc: { enrolled: 1 } },
      { new: true },
    ).lean();
    if (!training) { res.status(404).json({ success: false, message: 'Training not found' }); return; }
    res.json({ success: true, data: training });
  } catch (err) {
    next(err);
  }
}

export async function logWorkforceAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wk = req.user!.warehouseKey!;
    const id = `ATT-${Date.now()}`;
    const record = await WarehouseAttendance.create({ ...req.body, id, timestamp: new Date(), ...warehouseFieldsForCreate(wk) });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

export async function getReportsDaily(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await notImplemented(req, res, 'Warehouse daily report');
  } catch (err) { next(err); }
}

export async function getReportsOperationsView(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await notImplemented(req, res, 'Warehouse operations report');
  } catch (err) { next(err); }
}
