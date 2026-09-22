import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import {
  Factory,
  ProductionLine,
  QCInspection,
  QCFailure,
  QCCheckLog,
  ComplianceDoc,
  SampleTest,
  WorkOrder,
  ProductionAlert,
  GRN,
  InventoryItem,
  InventoryAdjustment,
  CycleCountMetrics,
  Shelf,
  RestockTask,
  RawMaterial,
  ProductionSettings,
  ProductionPlan,
  Requisition,
  InboundReceipt,
  PutawayTask,
  InterStoreTransfer,
  Staff,
  Absence,
  Attendance,
  ShiftCoverage,
  WeeklyRoster,
  StaffPerformance,
  Picklist,
  PackingOrder,
  ProductionOrder,
  DispatchOrder,
  OutboundTransferRequest,
  ProductionRider,
  ChecklistItem,
  ProductionAuditLog,
  MaintenanceEquipment,
  MaintenanceTask,
  IoTDevice,
  ProductionHSDDevice,
  ProductionIncident,
} from './production.models';
import { logger } from '../../utils/logger';
import { sendControllerError } from '../../utils/controller-error';
import { completeOpsAction } from '../../utils/ops-store';

const DEFAULT_FACTORY =
  process.env.DASHBOARD_HUB_KEY || process.env.DEFAULT_FACTORY_ID || 'chennai-hub';

async function notImplemented(req: Request, res: Response, what: string): Promise<void> {
  await completeOpsAction(req, res, what);
}

function getStoreId(req: Request): string {
  return (
    (req.query?.storeId as string) ||
    (req.query?.factoryId as string) ||
    (req.body?.storeId as string) ||
    (req.body?.factoryId as string) ||
    process.env.DEFAULT_STORE_ID ||
    DEFAULT_FACTORY
  );
}

function transformLine(l: Record<string, unknown>) {
  return {
    id: l.line_id,
    name: l.name,
    currentJob: l.currentJob || undefined,
    status: l.status,
    output: l.output || 0,
    target: l.target || 0,
    efficiency: l.efficiency || 0,
  };
}

async function nextLineId(factoryId: string): Promise<string> {
  const count = await ProductionLine.countDocuments({ factory_id: factoryId });
  const factory = await Factory.findOne({ factory_id: factoryId }).lean() as Record<string, unknown> | null;
  const code = factory?.code;
  const prefix = typeof code === 'string' ? code.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase() : 'LINE';
  return `${prefix}-L${count + 1}`;
}

// ─── Overview ─────────────────────────────────────────────────────────────────

export async function getOverview(req: Request, res: Response): Promise<void> {
  try {
    const factoryId = (req.query.factoryId as string) || (req.query.storeId as string) || DEFAULT_FACTORY;
    const lines = await ProductionLine.find({ factory_id: factoryId }).lean();
    const totalOutput = lines.reduce((s, l) => s + (l.output || 0), 0);
    const totalTarget = lines.reduce((s, l) => s + (l.target || 0), 0);
    const avgEfficiency = lines.length > 0
      ? Math.round(lines.reduce((s, l) => s + (l.efficiency || 0), 0) / lines.length)
      : 0;
    const defectRateValues = lines.filter((l) => l.defect_rate != null).map((l) => l.defect_rate as number);
    let defectRate: number | null = defectRateValues.length > 0
      ? parseFloat((defectRateValues.reduce((a, b) => a + b, 0) / defectRateValues.length).toFixed(2))
      : null;

    if (defectRate == null) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const qcInspections = await QCInspection.find({ createdAt: { $gte: thirtyDaysAgo } }).lean();
      const totalItems = qcInspections.reduce((s, q) => s + (q.items_inspected || 0), 0);
      const totalDefects = qcInspections.reduce((s, q) => s + (q.defects_found || 0), 0);
      if (totalItems > 0) defectRate = parseFloat((totalDefects / totalItems).toFixed(2));
    }
    if (defectRate == null) defectRate = 0.40;

    const downtimeCount = lines.filter((l) => l.status !== 'running').length;
    res.status(200).json({
      success: true,
      lines: lines.map((l) => transformLine(l as unknown as Record<string, unknown>)),
      kpis: { totalOutput, totalTarget, avgEfficiency, defectRate, activeDowntime: downtimeCount * 15 },
    });
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch overview');
  }
}

export async function startBatch(req: Request, res: Response): Promise<void> {
  try {
    const { lineId, product, targetQuantity, factoryId: bodyFactoryId } = req.body;
    const factoryId = bodyFactoryId || (req.query.factoryId as string) || (req.query.storeId as string);
    if (!lineId || !product || !targetQuantity || targetQuantity < 1) {
      res.status(400).json({ success: false, error: 'lineId, product, and targetQuantity (positive) are required' });
      return;
    }
    const line = await ProductionLine.findOne({ line_id: lineId, factory_id: factoryId });
    if (!line) { res.status(404).json({ success: false, error: 'Line not found' }); return; }

    const batchNumber = Math.floor(1000 + Math.random() * 9000);
    line.currentJob = `Job #${batchNumber} - ${product}`;
    line.status = 'running';
    line.target = parseInt(targetQuantity, 10);
    line.output = 0;
    line.efficiency = 0;
    line.updated_at = new Date();
    await line.save();
    res.status(200).json({ success: true, line: transformLine(line.toObject() as unknown as Record<string, unknown>), message: 'Batch started' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to start batch');
  }
}

export async function updateLine(req: Request, res: Response): Promise<void> {
  try {
    const { lineId } = req.params;
    const { action, factoryId: bodyFactoryId } = req.body;
    const factoryId = bodyFactoryId || (req.query.factoryId as string) || (req.query.storeId as string);
    if (!action || !['pause', 'resume', 'stop'].includes(action)) {
      res.status(400).json({ success: false, error: 'action must be pause, resume, or stop' }); return;
    }
    const line = await ProductionLine.findOne({ line_id: lineId, factory_id: factoryId });
    if (!line) { res.status(404).json({ success: false, error: 'Line not found' }); return; }

    if (action === 'pause') { line.status = 'idle'; }
    else if (action === 'resume') {
      if (!line.currentJob) { res.status(400).json({ success: false, error: 'No current job to resume' }); return; }
      line.status = 'running';
    } else {
      line.status = 'idle'; line.currentJob = null; line.output = 0; line.target = 0; line.efficiency = 0;
    }
    line.updated_at = new Date();
    await line.save();
    res.status(200).json({ success: true, line: transformLine(line.toObject() as unknown as Record<string, unknown>), message: `Line ${action}d` });
  } catch (err) {
    sendControllerError(res, err, 'Failed to update line');
  }
}

export async function createLine(req: Request, res: Response): Promise<void> {
  try {
    const factoryId = getStoreId(req);
    const { name, status, currentJob, output, target, efficiency, lineId } = req.body || {};
    if (!name || !String(name).trim()) { res.status(400).json({ success: false, error: 'name is required' }); return; }
    const LINE_STATUSES = ['running', 'changeover', 'maintenance', 'idle'];
    if (status && !LINE_STATUSES.includes(status)) {
      res.status(400).json({ success: false, error: `status must be one of: ${LINE_STATUSES.join(', ')}` }); return;
    }
    const factory = await Factory.findOne({ factory_id: factoryId }).lean();
    if (!factory) { res.status(404).json({ success: false, error: 'Factory not found' }); return; }

    const resolvedLineId = lineId?.trim() || (await nextLineId(factoryId));
    if (await ProductionLine.findOne({ line_id: resolvedLineId }).lean()) {
      res.status(409).json({ success: false, error: 'Line ID already exists' }); return;
    }

    const outNum = Math.max(0, parseInt(output, 10) || 0);
    const targetNum = Math.max(0, parseInt(target, 10) || 0);
    let efficiencyNum = Math.max(0, Math.min(100, parseInt(efficiency, 10) || 0));
    if (!efficiency && targetNum > 0) efficiencyNum = Math.min(100, Math.round((outNum / targetNum) * 100));

    const now = new Date();
    const doc = await ProductionLine.create({
      line_id: resolvedLineId, factory_id: factoryId, name: String(name).trim(),
      currentJob: currentJob?.trim() || null, status: status || 'idle',
      output: outNum, target: targetNum, efficiency: efficiencyNum, defect_rate: 0,
      created_at: now, updated_at: now,
    });
    res.status(201).json({ success: true, line: transformLine(doc.toObject() as unknown as Record<string, unknown>), message: 'Production line created' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to create line');
  }
}

export async function updateLineDetails(req: Request, res: Response): Promise<void> {
  try {
    const { lineId } = req.params;
    const factoryId = getStoreId(req);
    const { name, status, currentJob, output, target, efficiency } = req.body || {};
    const line = await ProductionLine.findOne({ line_id: lineId, factory_id: factoryId });
    if (!line) { res.status(404).json({ success: false, error: 'Line not found' }); return; }

    const LINE_STATUSES = ['running', 'changeover', 'maintenance', 'idle'];
    if (name !== undefined) {
      if (!String(name).trim()) { res.status(400).json({ success: false, error: 'name cannot be empty' }); return; }
      line.name = String(name).trim();
    }
    if (status !== undefined) {
      if (!LINE_STATUSES.includes(status)) {
        res.status(400).json({ success: false, error: `status must be one of: ${LINE_STATUSES.join(', ')}` }); return;
      }
      line.status = status;
    }
    if (currentJob !== undefined) line.currentJob = currentJob?.trim() || null;
    if (output !== undefined) line.output = Math.max(0, parseInt(output, 10) || 0);
    if (target !== undefined) line.target = Math.max(0, parseInt(target, 10) || 0);
    if (efficiency !== undefined) line.efficiency = Math.max(0, Math.min(100, parseInt(efficiency, 10) || 0));
    else if (output !== undefined || target !== undefined) {
      const t = line.target || 0;
      line.efficiency = t > 0 ? Math.min(100, Math.round((line.output / t) * 100)) : 0;
    }
    line.updated_at = new Date();
    await line.save();
    res.status(200).json({ success: true, line: transformLine(line.toObject() as unknown as Record<string, unknown>), message: 'Line updated' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to update line');
  }
}

export async function deleteLine(req: Request, res: Response): Promise<void> {
  try {
    const { lineId } = req.params;
    const factoryId = getStoreId(req);
    const line = await ProductionLine.findOne({ line_id: lineId, factory_id: factoryId });
    if (!line) { res.status(404).json({ success: false, error: 'Line not found' }); return; }
    if (line.status === 'running') { res.status(400).json({ success: false, error: 'Stop the line before deleting it' }); return; }
    await ProductionLine.deleteOne({ line_id: lineId, factory_id: factoryId });
    res.status(200).json({ success: true, message: 'Production line deleted' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to delete line');
  }
}

export async function listFactories(req: Request, res: Response): Promise<void> {
  try {
    const factoryId = (req.query.factoryId as string) || (req.query.storeId as string) || DEFAULT_FACTORY;
    const factories = await Factory.find({ factory_id: factoryId }).lean();
    res.status(200).json({
      success: true,
      factories: factories.map((f) => ({ id: f.factory_id, name: f.name, code: f.code, status: f.status })),
    });
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch factories');
  }
}

// ─── Planning ─────────────────────────────────────────────────────────────────

const PLAN_STATUSES = ['scheduled', 'in-progress', 'completed'];

function toPlanDto(p: Record<string, unknown>) {
  return {
    id: String(p._id),
    product: p.product,
    line: p.line,
    startDate: p.startDate ? new Date(p.startDate as string).toISOString().split('T')[0] : '',
    endDate: p.endDate ? new Date(p.endDate as string).toISOString().split('T')[0] : '',
    quantity: p.quantity,
    status: p.status,
  };
}

export async function listPlans(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const plans = await ProductionPlan.find({ store_id: storeId }).sort({ startDate: 1 }).lean();
    res.status(200).json(plans.map((p) => toPlanDto(p as unknown as Record<string, unknown>)));
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch plans');
  }
}

export async function createPlan(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { product, line, startDate, endDate, quantity, status } = req.body || {};
    if (!product || !line || !startDate || quantity === undefined) {
      res.status(400).json({ success: false, error: 'product, line, startDate, and quantity are required' }); return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1) { res.status(400).json({ success: false, error: 'quantity must be a positive number' }); return; }
    if (status && !PLAN_STATUSES.includes(status)) {
      res.status(400).json({ success: false, error: `status must be one of: ${PLAN_STATUSES.join(', ')}` }); return;
    }
    const doc = await ProductionPlan.create({
      store_id: storeId, product: String(product).trim(), line: String(line).trim(),
      startDate: new Date(startDate), endDate: new Date(endDate || startDate), quantity: qty, status: status || 'scheduled',
    });
    res.status(201).json(toPlanDto(doc.toObject() as unknown as Record<string, unknown>));
  } catch (err) {
    sendControllerError(res, err, 'Failed to create plan');
  }
}

export async function updatePlan(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const { product, line, startDate, endDate, quantity, status } = req.body || {};
    const plan = await ProductionPlan.findOne({ _id: id, store_id: storeId });
    if (!plan) { res.status(404).json({ success: false, error: 'Plan not found' }); return; }

    if (product !== undefined) {
      if (!String(product).trim()) { res.status(400).json({ success: false, error: 'product cannot be empty' }); return; }
      plan.product = String(product).trim();
    }
    if (line !== undefined) {
      if (!String(line).trim()) { res.status(400).json({ success: false, error: 'line cannot be empty' }); return; }
      plan.line = String(line).trim();
    }
    if (startDate !== undefined) plan.startDate = new Date(startDate);
    if (endDate !== undefined) plan.endDate = new Date(endDate);
    else if (startDate !== undefined) plan.endDate = plan.startDate;
    if (quantity !== undefined) {
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty < 1) { res.status(400).json({ success: false, error: 'quantity must be a positive number' }); return; }
      plan.quantity = qty;
    }
    if (status !== undefined) {
      if (!PLAN_STATUSES.includes(status)) { res.status(400).json({ success: false, error: `status must be one of: ${PLAN_STATUSES.join(', ')}` }); return; }
      plan.status = status;
    }
    await plan.save();
    res.status(200).json(toPlanDto(plan.toObject() as unknown as Record<string, unknown>));
  } catch (err) {
    sendControllerError(res, err, 'Failed to update plan');
  }
}

export async function deletePlan(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const plan = await ProductionPlan.findOne({ _id: id, store_id: storeId });
    if (!plan) { res.status(404).json({ success: false, error: 'Plan not found' }); return; }
    await ProductionPlan.deleteOne({ _id: id, store_id: storeId });
    res.status(200).json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to delete plan');
  }
}

// ─── Work Orders ──────────────────────────────────────────────────────────────

const VALID_STATUSES = ['pending', 'in-progress', 'completed', 'on-hold'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

function toWorkOrderDto(o: Record<string, unknown>) {
  return {
    id: String(o._id),
    orderNumber: o.orderNumber,
    product: o.product,
    quantity: o.quantity,
    line: o.line || '',
    operator: o.operator,
    priority: o.priority,
    status: o.status,
    dueDate: o.dueDate ? new Date(o.dueDate as string).toISOString().split('T')[0] : '',
  };
}

export async function listWorkOrders(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const search = req.query.search as string || '';
    const query = search
      ? { store_id: storeId, $or: [{ orderNumber: { $regex: search, $options: 'i' } }, { product: { $regex: search, $options: 'i' } }] }
      : { store_id: storeId };
    const orders = await WorkOrder.find(query).sort({ createdAt: -1 }).lean();
    res.status(200).json(orders.map((o) => toWorkOrderDto(o as unknown as Record<string, unknown>)));
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch work orders');
  }
}

export async function createWorkOrder(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { product, quantity, line, priority, dueDate, status, operator } = req.body || {};
    if (!product || quantity === undefined) { res.status(400).json({ success: false, error: 'product and quantity are required' }); return; }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1) { res.status(400).json({ success: false, error: 'quantity must be a positive number' }); return; }
    if (priority && !VALID_PRIORITIES.includes(priority)) { res.status(400).json({ success: false, error: 'invalid priority' }); return; }
    if (status && !VALID_STATUSES.includes(status)) { res.status(400).json({ success: false, error: 'invalid status' }); return; }

    const doc = await WorkOrder.create({
      store_id: storeId,
      orderNumber: `WO-${Math.floor(1000 + Math.random() * 9000)}`,
      product: String(product).trim(),
      quantity: qty,
      line: line ? String(line).trim() : '',
      operator: operator ? String(operator).trim() : undefined,
      priority: priority || 'medium',
      status: status || 'pending',
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
    res.status(201).json(toWorkOrderDto(doc.toObject() as unknown as Record<string, unknown>));
  } catch (err) {
    sendControllerError(res, err, 'Failed to create work order');
  }
}

export async function getWorkOrder(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const order = await WorkOrder.findOne({ _id: id, store_id: storeId }).lean();
    if (!order) { res.status(404).json({ success: false, error: 'Work order not found' }); return; }
    res.status(200).json(toWorkOrderDto(order as unknown as Record<string, unknown>));
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch work order');
  }
}

export async function assignOperator(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const { operator } = req.body || {};
    const order = await WorkOrder.findOne({ _id: id, store_id: storeId });
    if (!order) { res.status(404).json({ success: false, error: 'Work order not found' }); return; }
    order.operator = operator || '';
    order.status = 'in-progress';
    await order.save();
    res.status(200).json({ id: order._id.toString(), operator: order.operator, status: order.status, message: 'Operator assigned' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to assign operator');
  }
}

export async function updateWorkOrderStatus(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const { status } = req.body || {};
    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ success: false, error: 'status must be pending, in-progress, completed, or on-hold' }); return;
    }
    const order = await WorkOrder.findOne({ _id: id, store_id: storeId });
    if (!order) { res.status(404).json({ success: false, error: 'Work order not found' }); return; }
    order.status = status;
    await order.save();
    res.status(200).json({ id: order._id.toString(), status: order.status, message: 'Status updated' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to update status');
  }
}

export async function updateWorkOrder(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const { product, quantity, line, priority, dueDate, status, operator } = req.body || {};
    const order = await WorkOrder.findOne({ _id: id, store_id: storeId });
    if (!order) { res.status(404).json({ success: false, error: 'Work order not found' }); return; }

    if (product !== undefined) {
      if (!String(product).trim()) { res.status(400).json({ success: false, error: 'product cannot be empty' }); return; }
      order.product = String(product).trim();
    }
    if (quantity !== undefined) {
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty < 1) { res.status(400).json({ success: false, error: 'quantity must be a positive number' }); return; }
      order.quantity = qty;
    }
    if (line !== undefined) order.line = line ? String(line).trim() : '';
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) { res.status(400).json({ success: false, error: 'invalid priority' }); return; }
      order.priority = priority;
    }
    if (dueDate !== undefined) order.dueDate = dueDate ? new Date(dueDate) : undefined;
    if (operator !== undefined) order.operator = operator ? String(operator).trim() : undefined;
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) { res.status(400).json({ success: false, error: 'invalid status' }); return; }
      order.status = status;
    }
    await order.save();
    res.status(200).json(toWorkOrderDto(order.toObject() as unknown as Record<string, unknown>));
  } catch (err) {
    sendControllerError(res, err, 'Failed to update work order');
  }
}

export async function deleteWorkOrder(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const order = await WorkOrder.findOne({ _id: id, store_id: storeId });
    if (!order) { res.status(404).json({ success: false, error: 'Work order not found' }); return; }
    await WorkOrder.deleteOne({ _id: id, store_id: storeId });
    res.status(200).json({ success: true, message: 'Work order deleted' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to delete work order');
  }
}

// ─── Raw Materials ────────────────────────────────────────────────────────────

function toMaterialDto(m: Record<string, unknown>) {
  return {
    id: String(m._id),
    name: m.name,
    currentStock: m.currentStock,
    unit: m.unit,
    safetyStock: m.safetyStock,
    reorderPoint: m.reorderPoint,
    supplier: m.supplier || '',
    category: m.category || '',
    lastOrderDate: m.lastOrderDate ? new Date(m.lastOrderDate as string).toISOString().split('T')[0] : undefined,
    orderStatus: m.orderStatus || 'none',
  };
}

export async function listMaterials(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const search = req.query.search as string || '';
    const query = search
      ? { store_id: storeId, $or: [{ name: { $regex: search, $options: 'i' } }, { category: { $regex: search, $options: 'i' } }] }
      : { store_id: storeId };
    const materials = await RawMaterial.find(query).sort({ name: 1 }).lean();
    res.status(200).json(materials.map((m) => toMaterialDto(m as unknown as Record<string, unknown>)));
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch materials');
  }
}

export async function createMaterial(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { name, currentStock, unit, safetyStock, reorderPoint, supplier, category } = req.body || {};
    if (!name || currentStock === undefined || !unit) {
      res.status(400).json({ success: false, error: 'name, currentStock, and unit are required' }); return;
    }
    const doc = await RawMaterial.create({
      store_id: storeId,
      name,
      currentStock: Number(currentStock) || 0,
      unit: unit || 'kg',
      safetyStock: Number(safetyStock) || 0,
      reorderPoint: Number(reorderPoint) || 0,
      supplier: supplier || '',
      category: category || '',
      orderStatus: 'none',
    });
    res.status(201).json(toMaterialDto(doc.toObject() as unknown as Record<string, unknown>));
  } catch (err) {
    sendControllerError(res, err, 'Failed to create material');
  }
}

export async function updateMaterial(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const material = await RawMaterial.findOne({ _id: id, store_id: storeId });
    if (!material) { res.status(404).json({ success: false, error: 'Material not found' }); return; }
    const { name, currentStock, unit, safetyStock, reorderPoint, supplier, category } = req.body || {};
    if (name !== undefined) {
      if (!String(name).trim()) { res.status(400).json({ success: false, error: 'name cannot be empty' }); return; }
      material.name = String(name).trim();
    }
    if (currentStock !== undefined) material.currentStock = Math.max(0, Number(currentStock) || 0);
    if (unit !== undefined) {
      if (!String(unit).trim()) { res.status(400).json({ success: false, error: 'unit cannot be empty' }); return; }
      material.unit = String(unit).trim();
    }
    if (safetyStock !== undefined) material.safetyStock = Math.max(0, Number(safetyStock) || 0);
    if (reorderPoint !== undefined) material.reorderPoint = Math.max(0, Number(reorderPoint) || 0);
    if (supplier !== undefined) material.supplier = supplier || '';
    if (category !== undefined) material.category = category || '';
    await material.save();
    res.status(200).json(toMaterialDto(material.toObject() as unknown as Record<string, unknown>));
  } catch (err) {
    sendControllerError(res, err, 'Failed to update material');
  }
}

export async function deleteMaterial(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const material = await RawMaterial.findOne({ _id: id, store_id: storeId });
    if (!material) { res.status(404).json({ success: false, error: 'Material not found' }); return; }
    await RawMaterial.deleteOne({ _id: id, store_id: storeId });
    res.status(200).json({ success: true, message: 'Material deleted' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to delete material');
  }
}

export async function orderMaterial(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const { quantity } = req.body || {};
    const material = await RawMaterial.findOne({ _id: id, store_id: storeId });
    if (!material) { res.status(404).json({ success: false, error: 'Material not found' }); return; }
    const qty = Number(quantity) || material.reorderPoint;
    material.orderStatus = 'ordered';
    material.lastOrderDate = new Date();
    await material.save();
    res.status(200).json({
      id: material._id.toString(),
      orderStatus: 'ordered',
      lastOrderDate: material.lastOrderDate!.toISOString().split('T')[0],
      message: `Purchase order created for ${qty} ${material.unit} of ${material.name}`,
    });
  } catch (err) {
    sendControllerError(res, err, 'Failed to order material');
  }
}

export async function listRequisitions(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const requisitions = await Requisition.find({ store_id: storeId }).sort({ createdAt: -1 }).lean();
    res.status(200).json(requisitions.map((r) => ({
      id: r._id.toString(),
      reqNumber: r.reqNumber,
      material: r.material,
      quantity: r.quantity,
      requestedBy: r.requestedBy,
      line: r.line,
      status: r.status,
      date: (r as unknown as { createdAt?: Date }).createdAt ? new Date((r as unknown as { createdAt: Date }).createdAt).toISOString().split('T')[0] : '',
    })));
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch requisitions');
  }
}

export async function createRequisition(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { material, quantity, line, requestedBy } = req.body || {};
    if (!material || !quantity || !line || !requestedBy) {
      res.status(400).json({ success: false, error: 'material, quantity, line, and requestedBy are required' }); return;
    }
    const doc = await Requisition.create({
      store_id: storeId,
      reqNumber: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      material, quantity: Number(quantity), line, requestedBy, status: 'pending',
    });
    res.status(201).json({ id: doc._id.toString(), reqNumber: doc.reqNumber, material: doc.material, quantity: doc.quantity, line: doc.line, requestedBy: doc.requestedBy, status: 'pending' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to create requisition');
  }
}

export async function updateRequisitionStatus(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const { status } = req.body || {};
    const validStatuses = ['approved', 'rejected', 'issued'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ success: false, error: 'status must be approved, rejected, or issued' }); return;
    }
    const reqDoc = await Requisition.findOne({ _id: id, store_id: storeId });
    if (!reqDoc) { res.status(404).json({ success: false, error: 'Requisition not found' }); return; }
    reqDoc.status = status;
    await reqDoc.save();
    res.status(200).json({ id: reqDoc._id.toString(), status: reqDoc.status, message: `Requisition ${status}` });
  } catch (err) {
    sendControllerError(res, err, 'Failed to update requisition');
  }
}

export async function listReceipts(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const receipts = await InboundReceipt.find({ store_id: storeId }).sort({ expectedDate: 1 }).lean();
    res.status(200).json(receipts.map((r) => ({
      id: r._id.toString(),
      poNumber: r.poNumber,
      supplier: r.supplier,
      expectedDate: r.expectedDate ? new Date(r.expectedDate).toISOString().split('T')[0] : '',
      status: r.status,
      items: r.items || '',
    })));
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch receipts');
  }
}

export async function markReceived(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const receipt = await InboundReceipt.findOne({ _id: id, store_id: storeId });
    if (!receipt) { res.status(404).json({ success: false, error: 'Receipt not found' }); return; }
    receipt.status = 'received';
    await receipt.save();
    res.status(200).json({ id: receipt._id.toString(), status: 'received', message: 'Shipment marked as received' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to mark received');
  }
}

// ─── QC ───────────────────────────────────────────────────────────────────────

export async function getQCSummary(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const inspections = await QCInspection.find({ store_id: storeId }).lean();
    const total = inspections.length;
    const passed = inspections.filter((i) => i.status === 'passed').length;
    const failed = inspections.filter((i) => i.status === 'failed').length;
    const pending = inspections.filter((i) => i.status === 'pending').length;
    const avgScore = total > 0 ? Math.round(inspections.reduce((s, i) => s + (i.score || 0), 0) / total) : 0;
    res.status(200).json({ success: true, summary: { total, passed, failed, pending, avgScore } });
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch QC summary');
  }
}

export async function getQCInspections(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const status = req.query.status as string;
    const query: Record<string, unknown> = { store_id: storeId };
    if (status && status !== 'all') query.status = status;
    const inspections = await QCInspection.find(query).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, inspections });
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch inspections');
  }
}

export async function createQCInspection(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { batch_id, product_name, inspector, date, status, score, items_inspected, defects_found } = req.body || {};
    if (!batch_id || !product_name || !inspector) {
      res.status(400).json({ success: false, error: 'batch_id, product_name, and inspector are required' }); return;
    }
    const doc = await QCInspection.create({
      inspection_id: `QCI-${Date.now().toString().slice(-6)}`,
      batch_id, product_name, inspector,
      date: date ? new Date(date) : new Date(),
      status: status || 'pending',
      score: score != null ? Number(score) : 0,
      items_inspected: Number(items_inspected) || 0,
      defects_found: Number(defects_found) || 0,
      store_id: storeId,
    });
    res.status(201).json({ success: true, inspection: doc.toObject() });
  } catch (err) {
    sendControllerError(res, err, 'Failed to create inspection');
  }
}

export async function updateQCInspection(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const inspection = await QCInspection.findOne({ _id: id, store_id: storeId });
    if (!inspection) { res.status(404).json({ success: false, error: 'Inspection not found' }); return; }
    const { status, score, items_inspected, defects_found } = req.body || {};
    if (status !== undefined) inspection.status = status;
    if (score !== undefined) inspection.score = Number(score);
    if (items_inspected !== undefined) inspection.items_inspected = Number(items_inspected);
    if (defects_found !== undefined) inspection.defects_found = Number(defects_found);
    await inspection.save();
    res.status(200).json({ success: true, inspection: inspection.toObject() });
  } catch (err) {
    sendControllerError(res, err, 'Failed to update inspection');
  }
}

export async function deleteQCInspection(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const inspection = await QCInspection.findOne({ _id: id, store_id: storeId });
    if (!inspection) { res.status(404).json({ success: false, error: 'Inspection not found' }); return; }
    await QCInspection.deleteOne({ _id: id, store_id: storeId });
    res.status(200).json({ success: true, message: 'Inspection deleted' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to delete inspection');
  }
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function getProductionAlerts(req: Request, res: Response): Promise<void> {
  try {
    const factoryId = getStoreId(req);
    const status = req.query.status as string || 'all';
    const query: Record<string, unknown> = { factory_id: factoryId };
    if (status !== 'all') query.status = status;
    const alerts = await ProductionAlert.find(query).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, alerts });
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch alerts');
  }
}

export async function getProductionAlertById(req: Request, res: Response): Promise<void> {
  try {
    const factoryId = getStoreId(req);
    const { alertId } = req.params;
    const alert = await ProductionAlert.findOne({
      $or: [{ alert_id: alertId }, ...(mongoose.isValidObjectId(alertId) ? [{ _id: alertId }] : [])],
      factory_id: factoryId,
    }).lean();
    if (!alert) { res.status(404).json({ success: false, error: 'Alert not found' }); return; }
    res.status(200).json({ success: true, alert });
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch alert');
  }
}

export async function updateProductionAlertStatus(req: Request, res: Response): Promise<void> {
  try {
    const factoryId = getStoreId(req);
    const { alertId } = req.params;
    const { status } = req.body || {};
    const validStatuses = ['active', 'resolved', 'acknowledged', 'dismissed'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ success: false, error: 'status must be active, resolved, acknowledged, or dismissed' }); return;
    }
    const alert = await ProductionAlert.findOne({
      $or: [{ alert_id: alertId }, ...(mongoose.isValidObjectId(alertId) ? [{ _id: alertId }] : [])],
      factory_id: factoryId,
    });
    if (!alert) { res.status(404).json({ success: false, error: 'Alert not found' }); return; }
    alert.status = status;
    if (status === 'resolved') { alert.resolved_at = new Date(); }
    await alert.save();
    res.status(200).json({ success: true, alert: alert.toObject(), message: 'Alert status updated' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to update alert');
  }
}

export async function clearResolvedAlerts(req: Request, res: Response): Promise<void> {
  try {
    const factoryId = getStoreId(req);
    const result = await ProductionAlert.deleteMany({ factory_id: factoryId, status: 'resolved' });
    res.status(200).json({ success: true, message: `Cleared ${result.deletedCount} resolved alert(s)` });
  } catch (err) {
    sendControllerError(res, err, 'Failed to clear alerts');
  }
}

// ─── Inbound / GRN ────────────────────────────────────────────────────────────

export async function getGRNList(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const status = req.query.status as string;
    const query: Record<string, unknown> = { store_id: storeId };
    if (status && status !== 'all') query.status = status;
    const grns = await GRN.find(query).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, grns });
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch GRNs');
  }
}

export async function createGRN(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { truck_id, supplier } = req.body || {};
    if (!supplier || !truck_id) { res.status(400).json({ success: false, error: 'supplier and truck_id are required' }); return; }
    const now = new Date().toISOString();
    const doc = await GRN.create({
      grn_id: `GRN-${Date.now().toString().slice(-6)}`,
      truck_id,
      supplier,
      status: 'pending',
      store_id: storeId,
      items_count: 0,
      total_quantity: 0,
      received_quantity: 0,
      expected_arrival: now,
      created_at: now,
      updated_at: now,
    });
    res.status(201).json({ success: true, grn: doc.toObject(), message: 'GRN created' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to create GRN');
  }
}

export async function updateGRNStatus(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const { status } = req.body || {};
    const grn = await GRN.findOne({ _id: id, store_id: storeId });
    if (!grn) { res.status(404).json({ success: false, error: 'GRN not found' }); return; }
    grn.status = status || grn.status;
    grn.updated_at = new Date().toISOString();
    await grn.save();
    res.status(200).json({ success: true, grn: grn.toObject() });
  } catch (err) {
    sendControllerError(res, err, 'Failed to update GRN');
  }
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function getInventory(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const items = await InventoryItem.find({ store_id: storeId }).lean();
    res.status(200).json({ success: true, inventory: items });
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch inventory');
  }
}

export async function updateInventoryItem(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { id } = req.params;
    const { stock, status } = req.body || {};
    const item = await InventoryItem.findOne({ _id: id, store_id: storeId });
    if (!item) { res.status(404).json({ success: false, error: 'Inventory item not found' }); return; }
    if (stock !== undefined) item.stock = Number(stock);
    if (status !== undefined) item.status = status;
    await item.save();
    res.status(200).json({ success: true, item: item.toObject() });
  } catch (err) {
    sendControllerError(res, err, 'Failed to update inventory');
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    let settings = await ProductionSettings.findOne({ store_id: storeId }).lean();
    if (!settings) {
      const created = await ProductionSettings.create({ store_id: storeId });
      settings = created.toObject();
    }
    res.status(200).json({ success: true, settings });
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch settings');
  }
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const updates = req.body || {};
    let settings = await ProductionSettings.findOne({ store_id: storeId });
    if (!settings) { settings = new ProductionSettings({ store_id: storeId }); }
    if (updates.storeMode) settings.storeMode = updates.storeMode;
    if (updates.notifications) settings.notifications = { ...settings.notifications, ...updates.notifications };
    if (updates.refreshIntervals) settings.refreshIntervals = { ...settings.refreshIntervals, ...updates.refreshIntervals };
    settings.lastUpdated = new Date();
    await settings.save();
    res.status(200).json({ success: true, settings: settings.toObject(), message: 'Settings saved' });
  } catch (err) {
    sendControllerError(res, err, 'Failed to update settings');
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getProductionAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const dateRange = req.query.dateRange as string || '7d';
    const daysBack = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const [totalWorkOrders, completedWorkOrders, totalInspections, passedInspections] = await Promise.all([
      WorkOrder.countDocuments({ store_id: storeId, createdAt: { $gte: startDate } }),
      WorkOrder.countDocuments({ store_id: storeId, status: 'completed', createdAt: { $gte: startDate } }),
      QCInspection.countDocuments({ store_id: storeId, createdAt: { $gte: startDate } }),
      QCInspection.countDocuments({ store_id: storeId, status: 'passed', createdAt: { $gte: startDate } }),
    ]);

    res.status(200).json({
      success: true,
      analytics: {
        dateRange,
        workOrders: { total: totalWorkOrders, completed: completedWorkOrders, completionRate: totalWorkOrders > 0 ? Math.round((completedWorkOrders / totalWorkOrders) * 100) : 0 },
        qc: { total: totalInspections, passed: passedInspections, passRate: totalInspections > 0 ? Math.round((passedInspections / totalInspections) * 100) : 0 },
      },
    });
  } catch (err) {
    logger.error('Production analytics error', { error: (err as Error).message });
    sendControllerError(res, err, 'Failed to fetch analytics');
  }
}

export async function getDashboardSummary(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const [lines, pendingOrders, activeAlerts] = await Promise.all([
      ProductionLine.find({ factory_id: storeId }).lean(),
      WorkOrder.countDocuments({ store_id: storeId, status: { $in: ['pending', 'in-progress'] } }),
      ProductionAlert.countDocuments({ factory_id: storeId, status: 'active' }),
    ]);

    const runningLines = lines.filter((l) => l.status === 'running').length;
    res.status(200).json({
      success: true,
      summary: {
        lines: { total: lines.length, running: runningLines },
        workOrders: { pending: pendingOrders },
        alerts: { active: activeAlerts },
      },
    });
  } catch (err) {
    sendControllerError(res, err, 'Failed to fetch dashboard');
  }
}

// ─── QC Extended ─────────────────────────────────────────────────────────────

export async function getQCTemperatureLogs(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await SampleTest.find({ store_id: storeId, type: 'temperature' }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function createQCTemperatureLog(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await SampleTest.create({ ...req.body, store_id: storeId, type: 'temperature' });
    res.status(201).json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function getQCComplianceChecks(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await QCCheckLog.find({ store_id: storeId }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function toggleQCComplianceCheck(req: Request, res: Response): Promise<void> {
  try {
    const item = await QCCheckLog.findOneAndUpdate(
      { _id: req.params.itemId },
      { $set: req.body },
      { new: true },
    ).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Check not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function getQCComplianceDocs(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await ComplianceDoc.find({ store_id: storeId }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function getQCSampleTests(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await SampleTest.find({ store_id: storeId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function createQCSampleTest(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await SampleTest.create({ ...req.body, store_id: storeId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function updateQCSampleResult(req: Request, res: Response): Promise<void> {
  try {
    const item = await SampleTest.findByIdAndUpdate(req.params.sampleId, { $set: req.body }, { new: true }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Sample not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function deleteQCSampleTest(req: Request, res: Response): Promise<void> {
  try {
    await SampleTest.findByIdAndDelete(req.params.sampleId);
    res.json({ success: true, message: 'Sample deleted' });
  } catch (err) { sendControllerError(res, err); }
}

export async function getQCRejections(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await QCFailure.find({ store_id: storeId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function createQCRejection(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await QCFailure.create({ ...req.body, store_id: storeId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function getQCActionHistory(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await QCCheckLog.find({ store_id: storeId }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function getQCRecentFailures(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await QCFailure.find({ store_id: storeId }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function resolveQCFailure(req: Request, res: Response): Promise<void> {
  try {
    const item = await QCFailure.findByIdAndUpdate(
      req.params.failureId,
      { $set: { status: 'resolved', resolvedAt: new Date(), resolutionNotes: req.body.notes } },
      { new: true },
    ).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Failure record not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

// ─── Inbound Extended ─────────────────────────────────────────────────────────

export async function getPutawayTasks(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await PutawayTask.find({ store_id: storeId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function assignPutawayTask(req: Request, res: Response): Promise<void> {
  try {
    const task = await PutawayTask.findByIdAndUpdate(
      req.params.taskId,
      { $set: { assignedTo: req.body.staffId, status: 'assigned' } },
      { new: true },
    ).lean();
    if (!task) { res.status(404).json({ success: false, message: 'Task not found' }); return; }
    res.json({ success: true, data: task });
  } catch (err) { sendControllerError(res, err); }
}

export async function completePutawayTask(req: Request, res: Response): Promise<void> {
  try {
    const task = await PutawayTask.findByIdAndUpdate(
      req.params.taskId,
      { $set: { status: 'completed', completedAt: new Date() } },
      { new: true },
    ).lean();
    if (!task) { res.status(404).json({ success: false, message: 'Task not found' }); return; }
    res.json({ success: true, data: task });
  } catch (err) { sendControllerError(res, err); }
}

export async function getInterStoreTransfers(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await InterStoreTransfer.find({ store_id: storeId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function syncInterStoreTransfers(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Inter-store transfer sync');
}

export async function receiveInterStoreTransfer(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const transfer = await InterStoreTransfer.findByIdAndUpdate(
      req.params.transferId,
      { $set: { store_id: storeId, status: 'received', receivedAt: new Date() } },
      { new: true },
    ).lean();
    if (!transfer) { res.status(404).json({ success: false, message: 'Transfer not found' }); return; }
    res.json({ success: true, data: transfer });
  } catch (err) { sendControllerError(res, err); }
}

export async function updateGRNItemQuantity(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const grn = await GRN.findOneAndUpdate(
      { _id: req.params.grnId, store_id: storeId },
      { $set: { [`items.${req.params.sku}.received`]: req.body.received } },
      { new: true },
    ).lean();
    if (!grn) { res.status(404).json({ success: false, message: 'GRN not found' }); return; }
    res.json({ success: true, data: grn });
  } catch (err) { sendControllerError(res, err); }
}

// ─── Dashboard Extended (incidents + reports) ─────────────────────────────────

export async function getProductionDashboardIncidents(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await ProductionIncident.find({ store_id: storeId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function createProductionDashboardIncident(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const incident = await ProductionIncident.create({
      ...body,
      title: String(body.title || 'Untitled incident'),
      store_id: storeId,
      status: 'open',
    });
    res.status(201).json({ success: true, data: incident });
  } catch (err) { sendControllerError(res, err); }
}

export async function updateProductionDashboardIncidentStatus(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const incident = await ProductionIncident.findOneAndUpdate(
      { _id: req.params.incidentId, store_id: storeId },
      { $set: { status: req.body.status, resolvedAt: req.body.status === 'resolved' ? new Date() : undefined } },
      { new: true },
    ).lean();
    if (!incident) { res.status(404).json({ success: false, message: 'Incident not found' }); return; }
    res.json({ success: true, data: incident });
  } catch (err) { sendControllerError(res, err); }
}

export async function getProductionReports(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const totalOrders = await ProductionOrder.countDocuments({ store_id: storeId });
    const completedOrders = await ProductionOrder.countDocuments({ store_id: storeId, status: 'completed' });
    const totalWorkOrders = await WorkOrder.countDocuments({ store_id: storeId });
    res.json({ success: true, data: { totalOrders, completedOrders, totalWorkOrders, generatedAt: new Date().toISOString() } });
  } catch (err) { sendControllerError(res, err); }
}

export async function exportProductionReports(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const orders = await ProductionOrder.find({ store_id: storeId }).lean();
    res.json({ success: true, data: orders, exportedAt: new Date().toISOString() });
  } catch (err) { sendControllerError(res, err); }
}

// ─── Inventory Extended ───────────────────────────────────────────────────────

export async function getShelfView(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await Shelf.find({ store_id: storeId }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function getStockLevels(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await InventoryItem.find({ store_id: storeId }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function updateStockLevel(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await InventoryItem.findOneAndUpdate(
      { sku: req.params.sku, store_id: storeId },
      { $set: req.body },
      { new: true, upsert: true },
    ).lean();
    res.json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function deleteInventoryStockItem(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    await InventoryItem.findOneAndDelete({ sku: req.params.sku, store_id: storeId });
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) { sendControllerError(res, err); }
}

export async function changeInventoryItemStatus(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await InventoryItem.findOneAndUpdate(
      { sku: req.params.sku, store_id: storeId },
      { $set: { status: req.body.status } },
      { new: true },
    ).lean();
    res.json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function getInventoryAdjustments(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await InventoryAdjustment.find({ store_id: storeId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function createInventoryAdjustment(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await InventoryAdjustment.create({ ...req.body, store_id: storeId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function getInventoryCycleCount(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await CycleCountMetrics.find({ store_id: storeId }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function scanInventoryItem(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await InventoryItem.findOne({ sku: req.body.barcode, store_id: storeId }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Item not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function getInventoryAuditLog(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await ProductionAuditLog.find({ store_id: storeId }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function createRestockTask(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const task = await RestockTask.create({ ...req.body, store_id: storeId, status: 'pending' });
    res.status(201).json({ success: true, data: task });
  } catch (err) { sendControllerError(res, err); }
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

export async function getMaintenanceEquipment(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await MaintenanceEquipment.find({ store_id: storeId }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function createMaintenanceEquipment(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await MaintenanceEquipment.create({ ...req.body, store_id: storeId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function updateMaintenanceEquipment(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await MaintenanceEquipment.findOneAndUpdate(
      { _id: req.params.equipmentId, store_id: storeId },
      { $set: req.body }, { new: true },
    ).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Equipment not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function deleteMaintenanceEquipment(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    await MaintenanceEquipment.findOneAndDelete({ _id: req.params.equipmentId, store_id: storeId });
    res.json({ success: true, message: 'Equipment deleted' });
  } catch (err) { sendControllerError(res, err); }
}

export async function getMaintenanceTasks(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await MaintenanceTask.find({ store_id: storeId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function createMaintenanceTask(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const task = await MaintenanceTask.create({ ...req.body, store_id: storeId });
    res.status(201).json({ success: true, data: task });
  } catch (err) { sendControllerError(res, err); }
}

export async function updateMaintenanceTask(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const task = await MaintenanceTask.findOneAndUpdate(
      { _id: req.params.taskId, store_id: storeId },
      { $set: req.body }, { new: true },
    ).lean();
    if (!task) { res.status(404).json({ success: false, message: 'Task not found' }); return; }
    res.json({ success: true, data: task });
  } catch (err) { sendControllerError(res, err); }
}

export async function updateMaintenanceTaskStatus(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const task = await MaintenanceTask.findOneAndUpdate(
      { _id: req.params.taskId, store_id: storeId },
      { $set: { status: req.body.status, completedAt: req.body.status === 'completed' ? new Date() : undefined } },
      { new: true },
    ).lean();
    if (!task) { res.status(404).json({ success: false, message: 'Task not found' }); return; }
    res.json({ success: true, data: task });
  } catch (err) { sendControllerError(res, err); }
}

export async function deleteMaintenanceTask(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    await MaintenanceTask.findOneAndDelete({ _id: req.params.taskId, store_id: storeId });
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) { sendControllerError(res, err); }
}

export async function getIotDevices(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await IoTDevice.find({ store_id: storeId }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

// ─── Staff (production) ───────────────────────────────────────────────────────

export async function createProductionStaff(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const staff = await Staff.create({ ...req.body, store_id: storeId });
    res.status(201).json({ success: true, data: staff });
  } catch (err) { sendControllerError(res, err); }
}

export async function getProductionStaffSummary(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const total = await Staff.countDocuments({ store_id: storeId });
    const active = await Staff.countDocuments({ store_id: storeId, status: 'active' });
    res.json({ success: true, data: { total, active, onLeave: total - active } });
  } catch (err) { sendControllerError(res, err); }
}

export async function getStaffRoster(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await Staff.find({ store_id: storeId }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function getProductionShiftCoverage(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await ShiftCoverage.find({ store_id: storeId }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function createProductionShiftCoverage(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await ShiftCoverage.create({ ...req.body, store_id: storeId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function getProductionAbsences(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await Absence.find({ store_id: storeId }).sort({ date: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function logProductionAbsence(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await Absence.create({ ...req.body, store_id: storeId, date: req.body.date || new Date() });
    res.status(201).json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function getProductionWeeklyRoster(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await WeeklyRoster.findOne({ store_id: storeId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function publishProductionRoster(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const roster = await WeeklyRoster.create({ ...req.body, store_id: storeId, published: true, publishedAt: new Date() });
    res.status(201).json({ success: true, data: roster });
  } catch (err) { sendControllerError(res, err); }
}

export async function autoAssignProductionOT(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Production OT auto-assign');
}

export async function getProductionStaffPerformance(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await StaffPerformance.find({ store_id: storeId }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function downloadProductionPerformanceReport(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await StaffPerformance.find({ store_id: storeId }).lean();
    res.json({ success: true, data, exportedAt: new Date().toISOString() });
  } catch (err) { sendControllerError(res, err); }
}

export async function getProductionAttendance(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await Attendance.find({ store_id: storeId }).sort({ date: -1 }).limit(100).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function markProductionAttendancePresent(req: Request, res: Response): Promise<void> {
  try {
    const record = await Attendance.findByIdAndUpdate(
      req.params.recordId,
      { $set: { status: 'present', markedAt: new Date() } },
      { new: true },
    ).lean();
    if (!record) { res.status(404).json({ success: false, message: 'Record not found' }); return; }
    res.json({ success: true, data: record });
  } catch (err) { sendControllerError(res, err); }
}

export async function updateProductionStaffStatus(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.staffId, store_id: storeId },
      { $set: { status: req.body.status } },
      { new: true },
    ).lean();
    if (!staff) { res.status(404).json({ success: false, message: 'Staff not found' }); return; }
    res.json({ success: true, data: staff });
  } catch (err) { sendControllerError(res, err); }
}

// ─── Outbound ─────────────────────────────────────────────────────────────────

export async function getOutboundSummary(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const pending = await DispatchOrder.countDocuments({ store_id: storeId, status: 'pending' });
    const dispatched = await DispatchOrder.countDocuments({ store_id: storeId, status: 'dispatched' });
    const activeRiders = await ProductionRider.countDocuments({ store_id: storeId, status: 'active' });
    res.json({ success: true, data: { pending, dispatched, activeRiders } });
  } catch (err) { sendControllerError(res, err); }
}

export async function getDispatchQueue(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await DispatchOrder.find({ store_id: storeId, status: { $in: ['pending', 'ready'] } }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function getActiveRiders(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await ProductionRider.find({ store_id: storeId, status: 'active' }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function batchDispatchOrders(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { orderIds } = req.body;
    await DispatchOrder.updateMany(
      { store_id: storeId, _id: { $in: orderIds } },
      { $set: { status: 'dispatched', dispatchedAt: new Date() } },
    );
    res.json({ success: true, message: `${(orderIds || []).length} orders dispatched` });
  } catch (err) { sendControllerError(res, err); }
}

export async function manuallyAssignRider(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const order = await DispatchOrder.findOneAndUpdate(
      { store_id: storeId, _id: req.body.orderId },
      { $set: { riderId: req.body.riderId, status: 'assigned' } },
      { new: true },
    ).lean();
    res.json({ success: true, data: order });
  } catch (err) { sendControllerError(res, err); }
}

export async function getOutboundTransferRequests(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await OutboundTransferRequest.find({ store_id: storeId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function approveOutboundTransferRequest(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await OutboundTransferRequest.findOneAndUpdate(
      { _id: req.params.requestId, store_id: storeId },
      { $set: { status: 'approved', approvedAt: new Date() } },
      { new: true },
    ).lean();
    res.json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function rejectOutboundTransferRequest(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await OutboundTransferRequest.findOneAndUpdate(
      { _id: req.params.requestId, store_id: storeId },
      { $set: { status: 'rejected', rejectedAt: new Date(), reason: req.body.reason } },
      { new: true },
    ).lean();
    res.json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function getTransferFulfillmentStatus(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await OutboundTransferRequest.findOne({ _id: req.params.requestId, store_id: storeId }).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Transfer request not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function getTransferSLASummary(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const total = await OutboundTransferRequest.countDocuments({ store_id: storeId });
    const approved = await OutboundTransferRequest.countDocuments({ store_id: storeId, status: 'approved' });
    const pending = await OutboundTransferRequest.countDocuments({ store_id: storeId, status: 'pending' });
    res.json({ success: true, data: { total, approved, pending, slaCompliance: total > 0 ? `${Math.round((approved / total) * 100)}%` : 'N/A' } });
  } catch (err) { sendControllerError(res, err); }
}

// ─── Packing ──────────────────────────────────────────────────────────────────

export async function getPackQueue(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await PackingOrder.find({ store_id: storeId, status: { $in: ['pending', 'packing'] } }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function getPackingOrderDetails(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const order = await PackingOrder.findOne({ _id: req.params.orderId, store_id: storeId }).lean();
    if (!order) { res.status(404).json({ success: false, message: 'Order not found' }); return; }
    res.json({ success: true, data: order });
  } catch (err) { sendControllerError(res, err); }
}

export async function scanPackingItem(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const barcode = String(req.body?.barcode || '').trim();
    if (!barcode) {
      res.status(400).json({ success: false, message: 'barcode is required' });
      return;
    }
    const orderId = String(req.params.orderId || req.body?.orderId || '').trim();
    if (!orderId) {
      await notImplemented(req, res, 'Packing item scan without orderId');
      return;
    }
    const order = await PackingOrder.findOneAndUpdate(
      { $or: [{ _id: orderId }, { order_id: orderId }], store_id: storeId },
      { $set: { status: 'packing' } },
      { new: true },
    ).lean();
    if (!order) {
      res.status(404).json({ success: false, message: 'Packing order not found' });
      return;
    }
    res.json({
      success: true,
      message: 'Item scanned — packing order marked in progress',
      barcode,
      data: order,
    });
  } catch (err) {
    sendControllerError(res, err);
  }
}

export async function completePackingOrder(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const order = await PackingOrder.findOneAndUpdate(
      { _id: req.params.orderId, store_id: storeId },
      { $set: { status: 'completed', completedAt: new Date() } },
      { new: true },
    ).lean();
    if (!order) { res.status(404).json({ success: false, message: 'Order not found' }); return; }
    res.json({ success: true, data: order });
  } catch (err) { sendControllerError(res, err); }
}

export async function reportMissingPackingItem(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const sku = req.body?.sku ? String(req.body.sku) : '';
    const incident = await ProductionIncident.create({
      store_id: storeId,
      title: `Missing item on packing order ${req.params.orderId}${sku ? ` · ${sku}` : ''}`,
      description: req.body?.notes || req.body?.reason || 'Missing item reported during packing',
      status: 'open',
      severity: 'high',
      reportedBy: (req as Request & { user?: { userId?: string } }).user?.userId,
    });
    res.status(201).json({ success: true, message: 'Missing item reported', data: incident });
  } catch (err) {
    sendControllerError(res, err);
  }
}

export async function reportDamagedPackingItem(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const sku = req.body?.sku ? String(req.body.sku) : '';
    const incident = await ProductionIncident.create({
      store_id: storeId,
      title: `Damaged item on packing order ${req.params.orderId}${sku ? ` · ${sku}` : ''}`,
      description: req.body?.notes || req.body?.reason || 'Damaged item reported during packing',
      status: 'open',
      severity: 'medium',
      reportedBy: (req as Request & { user?: { userId?: string } }).user?.userId,
    });
    res.status(201).json({ success: true, message: 'Damaged item reported', data: incident });
  } catch (err) {
    sendControllerError(res, err);
  }
}

// ─── Picklist (production) ────────────────────────────────────────────────────

export async function getProductionPicklists(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await Picklist.find({ store_id: storeId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function createProductionPicklist(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const pl = await Picklist.create({ ...req.body, store_id: storeId, status: 'pending' });
    res.status(201).json({ success: true, data: pl });
  } catch (err) { sendControllerError(res, err); }
}

export async function getProductionPicklistDetails(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const pl = await Picklist.findOne({ _id: req.params.picklistId, store_id: storeId }).lean();
    if (!pl) { res.status(404).json({ success: false, message: 'Picklist not found' }); return; }
    res.json({ success: true, data: pl });
  } catch (err) { sendControllerError(res, err); }
}

export async function startProductionPicking(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const pl = await Picklist.findOneAndUpdate(
      { _id: req.params.picklistId, store_id: storeId },
      { $set: { status: 'picking', startedAt: new Date() } }, { new: true },
    ).lean();
    res.json({ success: true, data: pl });
  } catch (err) { sendControllerError(res, err); }
}

export async function pauseProductionPicking(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const pl = await Picklist.findOneAndUpdate(
      { _id: req.params.picklistId, store_id: storeId },
      { $set: { status: 'paused' } }, { new: true },
    ).lean();
    res.json({ success: true, data: pl });
  } catch (err) { sendControllerError(res, err); }
}

export async function completeProductionPicking(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const pl = await Picklist.findOneAndUpdate(
      { _id: req.params.picklistId, store_id: storeId },
      { $set: { status: 'completed', completedAt: new Date() } }, { new: true },
    ).lean();
    res.json({ success: true, data: pl });
  } catch (err) { sendControllerError(res, err); }
}

export async function assignProductionPicker(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const pl = await Picklist.findOneAndUpdate(
      { _id: req.params.picklistId, store_id: storeId },
      { $set: { picker: req.body.pickerId, status: 'assigned' } }, { new: true },
    ).lean();
    res.json({ success: true, data: pl });
  } catch (err) { sendControllerError(res, err); }
}

export async function moveToProductionPacking(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const pl = await Picklist.findOneAndUpdate(
      { _id: req.params.picklistId, store_id: storeId },
      { $set: { status: 'packing', movedToPackingAt: new Date() } }, { new: true },
    ).lean();
    res.json({ success: true, data: pl });
  } catch (err) { sendControllerError(res, err); }
}

// ─── HSD (production) ─────────────────────────────────────────────────────────

export async function getHSDFleet(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const devices = await ProductionHSDDevice.find({ store_id: storeId }).lean();
    const assigned = devices.filter((d) => (d as Record<string, unknown>).assignedTo).length;
    res.json({ success: true, data: { total: devices.length, assigned, available: devices.length - assigned, devices } });
  } catch (err) { sendControllerError(res, err); }
}

export async function getHSDUsers(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await ProductionHSDDevice.find({ store_id: storeId, assignedTo: { $ne: null } }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function registerHSDDevice(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const device = await ProductionHSDDevice.create({ ...req.body, store_id: storeId, status: 'available' });
    res.status(201).json({ success: true, data: device });
  } catch (err) { sendControllerError(res, err); }
}

export async function assignHSDDevice(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const device = await ProductionHSDDevice.findOneAndUpdate(
      { deviceId: req.params.deviceId, store_id: storeId },
      { $set: { assignedTo: req.body.userId, status: 'assigned', lastAssigned: new Date() } },
      { new: true },
    ).lean();
    res.json({ success: true, data: device });
  } catch (err) { sendControllerError(res, err); }
}

export async function unassignHSDDevice(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const device = await ProductionHSDDevice.findOneAndUpdate(
      { deviceId: req.params.deviceId, store_id: storeId },
      { $set: { assignedTo: null, status: 'available' } },
      { new: true },
    ).lean();
    res.json({ success: true, data: device });
  } catch (err) { sendControllerError(res, err); }
}

export async function bulkResetHSDDevices(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const { deviceIds } = req.body;
    await ProductionHSDDevice.updateMany(
      { store_id: storeId, deviceId: { $in: deviceIds || [] } },
      { $set: { assignedTo: null, status: 'available' } },
    );
    res.json({ success: true, message: `${(deviceIds || []).length} devices reset` });
  } catch (err) { sendControllerError(res, err); }
}

export async function getHSDDeviceHistory(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const device = await ProductionHSDDevice.findOne({ deviceId: req.params.deviceId, store_id: storeId }).lean();
    if (!device) { res.status(404).json({ success: false, message: 'Device not found' }); return; }
    res.json({ success: true, data: (device as Record<string, unknown>).history || [] });
  } catch (err) { sendControllerError(res, err); }
}

export async function getHSDLiveSessions(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await ProductionHSDDevice.find({ store_id: storeId, status: 'assigned' }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function getHSDDeviceActions(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const device = await ProductionHSDDevice.findOne({ deviceId: req.params.deviceId, store_id: storeId }).lean();
    if (!device) { res.status(404).json({ success: false, message: 'Device not found' }); return; }
    res.json({ success: true, data: (device as Record<string, unknown>).actions || [] });
  } catch (err) { sendControllerError(res, err); }
}

export async function controlHSDDevice(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    await ProductionHSDDevice.findOneAndUpdate(
      { deviceId: req.params.deviceId, store_id: storeId },
      { $push: { actions: { action: req.body.action, at: new Date(), by: (req as Request & { user?: { userId?: string } }).user?.userId } } },
    );
    res.json({ success: true, message: `Device control action '${req.body.action}' executed` });
  } catch (err) { sendControllerError(res, err); }
}

export async function getHSDIssues(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const devices = await ProductionHSDDevice.find({ store_id: storeId }).lean();
    const issues = devices.flatMap((d) => ((d as Record<string, unknown>).issues as unknown[]) || []);
    res.json({ success: true, data: issues });
  } catch (err) { sendControllerError(res, err); }
}

export async function reportHSDIssue(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const device = await ProductionHSDDevice.findOneAndUpdate(
      { deviceId: req.body.deviceId, store_id: storeId },
      { $push: { issues: { ...req.body, reportedAt: new Date(), status: 'open' } } },
      { new: true },
    ).lean();
    res.json({ success: true, data: device });
  } catch (err) { sendControllerError(res, err); }
}

export async function getHSDLogs(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await ProductionAuditLog.find({ store_id: storeId, type: 'hsd' }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function handleHSDSessionAction(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    await ProductionHSDDevice.findOneAndUpdate(
      { deviceId: req.params.deviceId, store_id: storeId },
      { $push: { sessions: { action: req.body.action, at: new Date() } } },
    );
    res.json({ success: true, message: 'Session action recorded' });
  } catch (err) { sendControllerError(res, err); }
}

export async function createHSDRequisition(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const item = await Requisition.create({ ...req.body, store_id: storeId, type: 'hsd', status: 'pending' });
    res.status(201).json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

// ─── Utilities (production) ───────────────────────────────────────────────────

export async function generateProductionLabel(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Production label generation');
}

export async function bulkUploadProductionInventory(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Production inventory bulk upload');
}

export async function downloadProductionUploadTemplate(req: Request, res: Response): Promise<void> {
  const csv = 'sku,quantity,location,notes\nSEL-0001,10,A-01,\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="production-inventory-template.csv"');
  res.status(200).send(csv);
}

export async function getProductionSystemStatus(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: { status: 'healthy', uptime: process.uptime(), ts: new Date().toISOString() },
  });
}

export async function runProductionDiagnostics(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Production diagnostics');
}

export async function forceProductionSync(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Production force sync');
}

export async function getProductionAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await ProductionAuditLog.find({ store_id: storeId }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function exportProductionAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await ProductionAuditLog.find({ store_id: storeId }).lean();
    res.json({ success: true, data, exportedAt: new Date().toISOString() });
  } catch (err) { sendControllerError(res, err); }
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getProductionHealthSummary(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const openIncidents = await ProductionIncident.countDocuments({ store_id: storeId, status: 'open' });
    const equipment = await MaintenanceEquipment.countDocuments({ store_id: storeId });
    const pendingTasks = await MaintenanceTask.countDocuments({ store_id: storeId, status: 'pending' });
    res.json({ success: true, data: { openIncidents, equipment, pendingTasks, status: openIncidents > 0 ? 'warning' : 'healthy' } });
  } catch (err) { sendControllerError(res, err); }
}

export async function getHealthChecklists(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await ChecklistItem.find({ store_id: storeId }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function updateHealthChecklistItem(req: Request, res: Response): Promise<void> {
  try {
    const item = await ChecklistItem.findOneAndUpdate(
      { _id: req.params.itemId },
      { $set: req.body },
      { new: true },
    ).lean();
    if (!item) { res.status(404).json({ success: false, message: 'Checklist item not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { sendControllerError(res, err); }
}

export async function submitHealthChecklist(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    await ChecklistItem.updateMany(
      { store_id: storeId, checklist_id: req.params.checklistId },
      { $set: { submitted: true, submittedAt: new Date() } },
    );
    res.json({ success: true, message: 'Checklist submitted' });
  } catch (err) { sendControllerError(res, err); }
}

export async function getHealthEquipment(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await MaintenanceEquipment.find({ store_id: storeId }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function getProductionIncidents(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const data = await ProductionIncident.find({ store_id: storeId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function reportProductionIncident(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const incident = await ProductionIncident.create({
      ...body,
      title: String(body.title || 'Untitled incident'),
      store_id: storeId,
      status: 'open',
      reportedBy: (req as Request & { user?: { userId?: string } }).user?.userId,
    });
    res.status(201).json({ success: true, data: incident });
  } catch (err) { sendControllerError(res, err); }
}

export async function resolveProductionIncident(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const incident = await ProductionIncident.findOneAndUpdate(
      { _id: req.params.incidentId, store_id: storeId },
      { $set: { status: 'resolved', resolvedAt: new Date(), resolutionNotes: req.body.notes } },
      { new: true },
    ).lean();
    if (!incident) { res.status(404).json({ success: false, message: 'Incident not found' }); return; }
    res.json({ success: true, data: incident });
  } catch (err) { sendControllerError(res, err); }
}

// ─── Orders (production) ──────────────────────────────────────────────────────

export async function getProductionOrders(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const filter: Record<string, unknown> = { store_id: storeId };
    if (req.query.status) filter.status = req.query.status;
    const data = await ProductionOrder.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, data });
  } catch (err) { sendControllerError(res, err); }
}

export async function callProductionCustomer(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Production customer call (no telephony provider configured)');
}

export async function markProductionRTO(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getStoreId(req);
    const order = await ProductionOrder.findOneAndUpdate(
      { _id: req.params.orderId, store_id: storeId },
      { $set: { status: 'rto', rtoAt: new Date() } },
      { new: true },
    ).lean();
    if (!order) { res.status(404).json({ success: false, message: 'Order not found' }); return; }
    res.json({ success: true, data: order });
  } catch (err) { sendControllerError(res, err); }
}

// ── Legacy alias / additional endpoints (added to close gap with legacy backend) ──
// Empty/echo 200s that looked like live data are 501 until a real store exists.

export async function callProductionCustomerLog(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Production customer call log');
}

export async function markProductionRTOStatus(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Production RTO status probe (use mark-rto to persist)');
}

// QC compliance & watchlist
export async function getQCComplianceAuditStatus(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'QC compliance audit status');
}

export async function getQCComplianceLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { QCCheckLog } = await import('./production.models');
    const items = await QCCheckLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.status(200).json({ success: true, data: items });
  } catch (err) { next(err); }
}

export async function createQCComplianceLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { QCCheckLog } = await import('./production.models');
    const item = await QCCheckLog.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function getQCWatchlist(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'QC watchlist');
}

export async function addToQCWatchlist(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'QC watchlist add');
}

export async function logQCWatchlistCheck(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'QC watchlist check');
}

// Inventory extras
export async function getCycleCountReport(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Cycle count report');
}

export async function listRestocks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { RestockTask } = await import('./production.models');
    const items = await RestockTask.find().sort({ createdAt: -1 }).limit(100).lean();
    res.status(200).json({ success: true, data: items });
  } catch (err) { next(err); }
}

export async function createRestock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { RestockTask } = await import('./production.models');
    const item = await RestockTask.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function updateInventoryItemBySku(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Inventory SKU update (legacy alias)');
}

// Analytics extras
//
// The scalar metrics below previously answered 200 with zeros ("0 SLA breaches", "0% utilisation"),
// which is indistinguishable from a genuinely healthy fleet — a reader would draw exactly the
// wrong operational conclusion. Real per-store order/revenue/SLA figures are available from
// `admin/stores/performance` (see store-warehouse.service.getStorePerformance).
export async function getRiderPerformanceAnalytics(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Rider performance analytics');
}

export async function getSlaAdherenceAnalytics(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'SLA adherence analytics');
}

export async function getFleetUtilizationAnalytics(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Fleet utilisation analytics');
}

export async function exportAnalyticsReport(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Analytics report export');
}

// Dashboard extras — empty arrays / fake refresh timestamps looked like live ops data
export async function getDashboardAlertHistory(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Dashboard alert history');
}

export async function getDashboardLiveOrders(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Dashboard live orders');
}

export async function getDashboardRefresh(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Dashboard refresh');
}

export async function postDashboardRefresh(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Dashboard refresh');
}

export async function getDashboardRtoAlerts(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Dashboard RTO alerts');
}

export async function getDashboardStaffLoad(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Dashboard staff load');
}

export async function getDashboardStockAlerts(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Dashboard stock alerts');
}

export async function getDashboardUtilitiesSettings(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Dashboard utilities settings');
}

export async function updateDashboardUtilitiesSettings(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Dashboard utilities settings');
}

export async function getDashboardUtilitiesSyncHistory(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Dashboard utilities sync history');
}

export async function getDashboardUtilitiesUploadHistory(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Dashboard utilities upload history');
}

export async function triggerDashboardHsdSync(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Dashboard HSD sync');
}

// Alerts extras
export async function getAlertsDebugIds(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Alerts debug IDs');
}

export async function performAlertAction(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Production alert action');
}

// Picker extras
export async function getAvailablePickers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Staff } = await import('./production.models');
    const items = await Staff.find({ role: 'picker', status: 'available' }).lean();
    res.status(200).json({ success: true, data: items });
  } catch (err) { next(err); }
}
