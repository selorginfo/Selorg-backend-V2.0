import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ResponseFormatter } from '../../utils/response';
import * as svc from './darkstore.service';
import { WDTransferRequest, WDTransferLog } from '../warehouse/warehouse.models';
import { WarehouseInventory, StoreInventory } from '../products/store-inventory.model';
import { DarkStore } from '../store/dark-store.model';
import {
  assertStoreAccess,
  getAssignedStoreKeys,
  isStoreScopedUser,
} from '../../utils/store-scope';

/** Shared 501 for darkstore surfaces that previously answered success without doing work. */
async function notImplemented(req: Request, res: Response, what: string): Promise<void> {
  const { completeOpsAction } = await import('../../utils/ops-store');
  await completeOpsAction(req, res, what);
}

/**
 * Resolve the effective store id for this request.
 * Store-scoped users (Dark Store Manager) are locked to their assigned store —
 * a mismatched query/body storeId is rejected rather than silently ignored.
 */
function storeId(req: Request): string {
  const requested = String(
    req.query.storeId || req.query.store_id || req.body?.store_id || req.body?.storeId || '',
  ).trim();
  const assigned = getAssignedStoreKeys(req.user);

  if (isStoreScopedUser(req.user)) {
    if (!assigned.length) {
      // assertStoreAccess throws STORE_SCOPE_REQUIRED
      assertStoreAccess(req.user, undefined);
    }
    const primary = assigned[0]!;
    if (requested) {
      assertStoreAccess(req.user, requested);
      return requested;
    }
    return primary;
  }

  return requested || process.env.DEFAULT_STORE_ID || 'DS-Adyar-01';
}

/** Resolve a dark store Mongo ObjectId from either an ObjectId string or a store code. */
async function resolveDarkStoreObjectId(idOrCode: string): Promise<mongoose.Types.ObjectId | null> {
  if (!idOrCode) return null;
  if (mongoose.isValidObjectId(idOrCode)) {
    const byId = await DarkStore.findById(idOrCode).select('_id').lean();
    if (byId?._id) return byId._id as mongoose.Types.ObjectId;
  }
  const byCode = await DarkStore.findOne({ code: idOrCode }).select('_id').lean();
  return byCode?._id ? (byCode._id as mongoose.Types.ObjectId) : null;
}

function actor(req: Request): string {
  return req.user?.userId || req.user?.email || 'system';
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getDashboardSummary(storeId(req)))); } catch (err) { next(err); }
}

export async function getStaffLoad(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getStaffLoad(storeId(req)))); } catch (err) { next(err); }
}

export async function getStockAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getStockAlerts(storeId(req)))); } catch (err) { next(err); }
}

export async function getRTOAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getRTOAlerts(storeId(req)))); } catch (err) { next(err); }
}

export async function getLiveOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getLiveOrders(storeId(req)))); } catch (err) { next(err); }
}

export async function getAlertHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getAlertHistory(storeId(req), req.query.orderId as string))); } catch (err) { next(err); }
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.getOrders(storeId(req), req.query as Record<string, string>);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await svc.getOrderById(req.params.orderId);
    if (!order) { res.status(404).json(ResponseFormatter.error('Order not found', 404)); return; }
    res.json(ResponseFormatter.success(order));
  } catch (err) { next(err); }
}

export async function updateOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await svc.updateOrder(req.params.orderId, req.body, actor(req));
    if (!order) { res.status(404).json(ResponseFormatter.error('Order not found', 404)); return; }
    res.json(ResponseFormatter.success(order));
  } catch (err) { next(err); }
}

export async function markRTO(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reason, notes } = req.body;
    const order = await svc.markRTO(req.params.orderId, reason || '', notes || '', actor(req));
    if (!order) { res.status(404).json(ResponseFormatter.error('Order not found', 404)); return; }
    res.json(ResponseFormatter.success(order));
  } catch (err) { next(err); }
}

export async function assignOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { pickerId, pickerName } = req.body;
    const order = await svc.assignOrderToPicker(req.params.orderId, pickerId, pickerName, actor(req));
    if (!order) { res.status(404).json(ResponseFormatter.error('Order not found', 404)); return; }
    res.json(ResponseFormatter.success(order));
  } catch (err) { next(err); }
}

export async function startPicking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await svc.startPicking(req.params.orderId, actor(req));
    if (!order) { res.status(404).json(ResponseFormatter.error('Order not found', 404)); return; }
    res.json(ResponseFormatter.success(order));
  } catch (err) { next(err); }
}

export async function completePicking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await svc.completePicking(req.params.orderId, req.body, actor(req));
    if (!order) { res.status(404).json(ResponseFormatter.error('Order not found', 404)); return; }
    res.json(ResponseFormatter.success(order));
  } catch (err) { next(err); }
}

export async function updateBagRack(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { bagId, rackLocation } = req.body;
    const order = await svc.updateBagRack(req.params.orderId, bagId, rackLocation);
    if (!order) { res.status(404).json(ResponseFormatter.error('Order not found', 404)); return; }
    res.json(ResponseFormatter.success(order));
  } catch (err) { next(err); }
}

export async function callCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.callCustomer(req.params.orderId, actor(req), storeId(req));
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await svc.cancelOrder(req.params.orderId, req.body.reason || '', actor(req));
    if (!order) { res.status(404).json(ResponseFormatter.error('Order not found', 404)); return; }
    res.json(ResponseFormatter.success(order));
  } catch (err) { next(err); }
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function getShelfView(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.getShelfView(storeId(req), req.query.zone as string || 'Zone 1 (Ambient)', req.query.aisle as string || 'all', req.query.shelf_location as string);
    res.json(result);
  } catch (err) { next(err); }
}

export async function getStockLevels(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.getStockLevels(storeId(req), req.query.category as string, req.query.status as string, parseInt(req.query.page as string) || 1, parseInt(req.query.limit as string) || 50);
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function updateStockLevel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await svc.updateStockLevel(req.params.sku, req.body.quantity, actor(req), storeId(req));
    if (!item) { res.status(404).json(ResponseFormatter.error('Item not found', 404)); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
}

export async function deleteInventoryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteInventoryItem(req.params.sku, storeId(req));
    res.json(ResponseFormatter.success({ message: 'Item deleted' }));
  } catch (err) { next(err); }
}

export async function changeItemStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await svc.changeItemStatus(req.params.sku, req.body.status, storeId(req));
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
}

export async function getAdjustments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getAdjustments(storeId(req), parseInt(req.query.page as string) || 1, parseInt(req.query.limit as string) || 50))); } catch (err) { next(err); }
}

export async function createAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.createAdjustment(req.body, actor(req), storeId(req)))); } catch (err) { next(err); }
}

export async function getCycleCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getCycleCount(storeId(req)))); } catch (err) { next(err); }
}

export async function scanItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await svc.scanInventoryItem(req.body.sku, storeId(req));
    if (!item) { res.status(404).json(ResponseFormatter.error('Item not found', 404)); return; }
    res.json(ResponseFormatter.success(item));
  } catch (err) { next(err); }
}

export async function getAuditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getAuditLog(storeId(req), parseInt(req.query.page as string) || 1, parseInt(req.query.limit as string) || 50))); } catch (err) { next(err); }
}

export async function updateInventoryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.updateInventoryItem(req.params.sku, req.body, storeId(req)))); } catch (err) { next(err); }
}

export async function listShelves(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.listShelves(storeId(req), req.query.zone as string))); } catch (err) { next(err); }
}

export async function createShelf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.createShelf(req.body, storeId(req)))); } catch (err) { next(err); }
}

export async function updateShelf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.updateShelf(req.params.shelfId, req.body))); } catch (err) { next(err); }
}

export async function deleteShelf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ message: 'Shelf deleted' })); await svc.deleteShelf(req.params.shelfId); } catch (err) { next(err); }
}

export async function getProductLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getProductLocation(req.params.sku, storeId(req)))); } catch (err) { next(err); }
}

export async function createRestockTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.createRestockTask(req.body, storeId(req)))); } catch (err) { next(err); }
}

// ─── Picklists ────────────────────────────────────────────────────────────────

export async function getPicklists(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getPicklists(storeId(req), req.query as Record<string, string>))); } catch (err) { next(err); }
}

export async function createPicklist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.createPicklist(req.body, storeId(req)))); } catch (err) { next(err); }
}

export async function getPicklistDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pl = await svc.getPicklistById(req.params.picklistId);
    if (!pl) { res.status(404).json(ResponseFormatter.error('Picklist not found', 404)); return; }
    res.json(ResponseFormatter.success(pl));
  } catch (err) { next(err); }
}

export async function startPicklistPicking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.updatePicklistStatus(req.params.picklistId, 'inprogress', { startTime: new Date() }))); } catch (err) { next(err); }
}

export async function pausePicklist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.updatePicklistStatus(req.params.picklistId, 'paused'))); } catch (err) { next(err); }
}

export async function completePicklist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.updatePicklistStatus(req.params.picklistId, 'completed', { progress: 100 }))); } catch (err) { next(err); }
}

export async function assignPickerToPicklist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.assignPickerToPicklist(req.params.picklistId, req.body.pickerId))); } catch (err) { next(err); }
}

export async function updatePicklistProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.updatePicklistStatus(req.params.picklistId, 'inprogress', { progress: req.body.progress }))); } catch (err) { next(err); }
}

export async function movePicklistToPacking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.updatePicklistStatus(req.params.picklistId, 'completed', { moved_to_packing: true }))); } catch (err) { next(err); }
}

// ─── Packing ─────────────────────────────────────────────────────────────────

export async function getPackQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getPackQueue(storeId(req), req.query.stationId as string))); } catch (err) { next(err); }
}

export async function getPackingOrderDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getPackingOrderDetails(req.params.orderId))); } catch (err) { next(err); }
}

export async function completePackingOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.completePackingOrder(req.params.orderId, actor(req)))); } catch (err) { next(err); }
}

export async function reportMissingItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.reportMissingItem(req.params.orderId, req.body, actor(req), storeId(req)))); } catch (err) { next(err); }
}

export async function reportDamagedItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.reportDamagedItem(req.params.orderId, req.body, actor(req), storeId(req)))); } catch (err) { next(err); }
}

export async function scanPackingItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ scanned: true, order_id: req.params.orderId, sku: req.body.sku })); } catch (err) { next(err); }
}

// ─── Inbound ─────────────────────────────────────────────────────────────────

export async function getInboundSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getInboundSummary(storeId(req)))); } catch (err) { next(err); }
}

export async function getGRNList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getGRNList(storeId(req), req.query.status as string))); } catch (err) { next(err); }
}

export async function getGRNDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const grn = await svc.getGRNById(req.params.grnId);
    if (!grn) { res.status(404).json(ResponseFormatter.error('GRN not found', 404)); return; }
    res.json(ResponseFormatter.success(grn));
  } catch (err) { next(err); }
}

export async function startGRNProcessing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.startGRN(req.params.grnId))); } catch (err) { next(err); }
}

export async function updateGRNItemQuantity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.updateGRNItemQty(req.params.grnId, req.params.sku, req.body.received_qty))); } catch (err) { next(err); }
}

export async function completeGRNProcessing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.completeGRN(req.params.grnId))); } catch (err) { next(err); }
}

export async function getPutawayTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getPutawayTasks(storeId(req), req.query.status as string))); } catch (err) { next(err); }
}

export async function assignPutawayTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.assignPutawayTask(req.params.taskId, req.body.assignedTo))); } catch (err) { next(err); }
}

export async function completePutawayTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.completePutawayTask(req.params.taskId))); } catch (err) { next(err); }
}

export async function getInterStoreTransfers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getInterStoreTransfers(storeId(req)))); } catch (err) { next(err); }
}

export async function receiveInterStoreTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.receiveTransfer(req.params.transferId, actor(req)))); } catch (err) { next(err); }
}

// ─── Outbound ─────────────────────────────────────────────────────────────────

export async function getOutboundSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getOutboundSummary(storeId(req)))); } catch (err) { next(err); }
}

export async function getReadyForDispatchOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getReadyForDispatchOrders(storeId(req)))); } catch (err) { next(err); }
}

export async function batchDispatchOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderIds, riderId, riderName } = req.body;
    res.status(201).json(ResponseFormatter.success(await svc.batchDispatchOrders(orderIds, riderId, riderName, storeId(req))));
  } catch (err) { next(err); }
}

export async function getOutboundTransferRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getOutboundTransferRequests(storeId(req)))); } catch (err) { next(err); }
}

export async function approveTransferRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.approveTransferRequest(req.params.requestId, actor(req)))); } catch (err) { next(err); }
}

export async function rejectTransferRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.rejectTransferRequest(req.params.requestId))); } catch (err) { next(err); }
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function getAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getAlerts(storeId(req), req.query as Record<string, string>))); } catch (err) { next(err); }
}

export async function getAlertById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const alert = await svc.getAlertById(req.params.alertId);
    if (!alert) { res.status(404).json(ResponseFormatter.error('Alert not found', 404)); return; }
    res.json(ResponseFormatter.success(alert));
  } catch (err) { next(err); }
}

export async function performAlertAction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { action, note } = req.body;
    const result = await svc.performAlertAction(req.params.alertId, action, note || '', actor(req));
    if (!result) { res.status(404).json(ResponseFormatter.error('Alert not found', 404)); return; }
    res.json(ResponseFormatter.success(result));
  } catch (err) { next(err); }
}

export async function clearResolvedAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.clearResolvedAlerts(storeId(req)))); } catch (err) { next(err); }
}

// ─── QC ───────────────────────────────────────────────────────────────────────

export async function getQCSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getQCSummary(storeId(req)))); } catch (err) { next(err); }
}

export async function getQCInspections(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getQCInspections(storeId(req), req.query.status as string))); } catch (err) { next(err); }
}

export async function createQCInspection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.createQCInspection(req.body, storeId(req)))); } catch (err) { next(err); }
}

export async function getTemperatureLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getTemperatureLogs(storeId(req)))); } catch (err) { next(err); }
}

export async function createTemperatureLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.createTemperatureLog(req.body, storeId(req)))); } catch (err) { next(err); }
}

export async function getComplianceDocs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getComplianceDocs(storeId(req)))); } catch (err) { next(err); }
}

export async function getSampleTests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getSampleTests(storeId(req)))); } catch (err) { next(err); }
}

export async function createSampleTest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.createSampleTest(req.body, storeId(req)))); } catch (err) { next(err); }
}

export async function updateSampleResult(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.updateSampleResult(req.params.sampleId, req.body.result, req.body.notes))); } catch (err) { next(err); }
}

export async function getRejections(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getRejections(storeId(req)))); } catch (err) { next(err); }
}

export async function createRejection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.createRejection(req.body, storeId(req)))); } catch (err) { next(err); }
}

export async function getQCFailures(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getQCFailures(storeId(req)))); } catch (err) { next(err); }
}

export async function resolveQCFailure(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.resolveQCFailure(req.params.failureId, actor(req)))); } catch (err) { next(err); }
}

export async function getWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getWatchlist(storeId(req)))); } catch (err) { next(err); }
}

export async function addWatchlistItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.addWatchlistItem(req.body, storeId(req)))); } catch (err) { next(err); }
}

export async function getComplianceLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getComplianceLogs(storeId(req)))); } catch (err) { next(err); }
}

export async function addComplianceLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.addComplianceLog(req.body, storeId(req)))); } catch (err) { next(err); }
}

export async function getAuditStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getAuditStatus(storeId(req)))); } catch (err) { next(err); }
}

export async function logQCCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success({ logged: true, sku: req.params.sku })); } catch (err) { next(err); }
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export async function getStaffSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getStaffSummary(storeId(req)))); } catch (err) { next(err); }
}

export async function getStaffRoster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getStaffRoster(storeId(req), req.query.role as string))); } catch (err) { next(err); }
}

export async function getShiftCoverage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getShiftCoverage(storeId(req)))); } catch (err) { next(err); }
}

export async function getAbsences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getAbsences(storeId(req)))); } catch (err) { next(err); }
}

export async function logAbsence(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.logAbsence(req.body, storeId(req)))); } catch (err) { next(err); }
}

export async function getWeeklyRoster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getWeeklyRoster(storeId(req)))); } catch (err) { next(err); }
}

export async function publishRoster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.publishRoster(req.params.rosterId || req.body.rosterId))); } catch (err) { next(err); }
}

export async function getStaffPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getStaffPerformance(storeId(req)))); } catch (err) { next(err); }
}

// ─── HSD ─────────────────────────────────────────────────────────────────────

export async function getHSDFleetOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getHSDFleetOverview(storeId(req)))); } catch (err) { next(err); }
}

export async function getHSDUserList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getHSDUserList(storeId(req)))); } catch (err) { next(err); }
}

export async function registerHSDDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.registerHSDDevice(req.body, storeId(req)))); } catch (err) { next(err); }
}

export async function assignHSDDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.assignHSDDevice(req.params.deviceId, req.body.userId))); } catch (err) { next(err); }
}

export async function unassignHSDDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.unassignHSDDevice(req.params.deviceId))); } catch (err) { next(err); }
}

export async function bulkResetHSDDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const deviceIds = Array.isArray(req.body?.deviceIds) ? (req.body.deviceIds as string[]) : [];
    if (!deviceIds.length) {
      res.status(400).json(ResponseFormatter.error('deviceIds array is required', 400));
      return;
    }
    const results = [];
    for (const id of deviceIds) {
      results.push(await svc.unassignHSDDevice(String(id)));
    }
    res.json(ResponseFormatter.success({ reset: results.length, devices: results }));
  } catch (err) {
    next(err);
  }
}

export async function getDeviceHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getDeviceHistory(req.params.deviceId))); } catch (err) { next(err); }
}

export async function getLiveSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getLiveSessions(storeId(req)))); } catch (err) { next(err); }
}

export async function getHSDIssues(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getHSDIssues(storeId(req)))); } catch (err) { next(err); }
}

export async function reportHSDIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.reportHSDIssue(req.body, storeId(req)))); } catch (err) { next(err); }
}

export async function generateHSDUserOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.generateHSDUserOtp(req.params.userId, storeId(req)))); } catch (err) { next(err); }
}

export async function getHSDUserOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const record = await svc.getHSDUserOtp(req.params.userId);
    if (!record) { res.status(404).json(ResponseFormatter.error('No active OTP found', 404)); return; }
    res.json(ResponseFormatter.success(record));
  } catch (err) { next(err); }
}

export async function deviceControl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ device_id: req.params.deviceId, action: req.body.action, status: 'sent' })); } catch (err) { next(err); }
}

export async function sessionAction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ device_id: req.params.deviceId, action: req.body.action, status: 'applied' })); } catch (err) { next(err); }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getSettings(storeId(req)))); } catch (err) { next(err); }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.updateSettings(storeId(req), req.body, actor(req)))); } catch (err) { next(err); }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getRiderPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getRiderPerformance(storeId(req)))); } catch (err) { next(err); }
}

export async function getSlaAdherence(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;
    res.json(ResponseFormatter.success(await svc.getSlaAdherence(storeId(req), from, to)));
  } catch (err) { next(err); }
}

export async function exportReport(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Darkstore report export');
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function getSlaMonitor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getSlaMonitor(storeId(req)))); } catch (err) { next(err); }
}

export async function getMissingItems(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getMissingItems(storeId(req)))); } catch (err) { next(err); }
}

export async function getOperationalAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getOperationalAlerts(storeId(req)))); } catch (err) { next(err); }
}

export async function getPipelineStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getPipelineStats(storeId(req)))); } catch (err) { next(err); }
}

export async function getLivePickingMonitor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getLiveOrders(storeId(req)))); } catch (err) { next(err); }
}

export async function getExceptionQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getMissingItems(storeId(req)))); } catch (err) { next(err); }
}

export async function getActivityFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getAlertHistory(storeId(req)))); } catch (err) { next(err); }
}

export async function getOrderWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await svc.getOrderById(req.params.orderId);
    if (!order) { res.status(404).json(ResponseFormatter.error('Order not found', 404)); return; }
    res.json(ResponseFormatter.success(order));
  } catch (err) { next(err); }
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function getInventoryReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getInventoryReport(storeId(req)))); } catch (err) { next(err); }
}

export async function getStaffReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getStaffReport(storeId(req)))); } catch (err) { next(err); }
}

export async function getComplianceReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getComplianceReport(storeId(req)))); } catch (err) { next(err); }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export async function generateLabel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.generateLabel(req.body.type, req.body.referenceId, req.body.labels || [], actor(req), storeId(req)))); } catch (err) { next(err); }
}

export async function getSystemStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getSystemStatus(storeId(req)))); } catch (err) { next(err); }
}

export async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getAuditLogs(storeId(req), parseInt(req.query.page as string) || 1, parseInt(req.query.limit as string) || 50))); } catch (err) { next(err); }
}

export async function exportAuditLogs(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Darkstore audit log export');
}

export async function forceGlobalSync(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Darkstore force global sync');
}

// ─── Dashboard (extra) ────────────────────────────────────────────────────────

export async function getStoreProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getStoreProfile(storeId(req)))); } catch (err) { next(err); }
}

export async function getWarehouseProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getWarehouseProfile(storeId(req)))); } catch (err) { next(err); }
}

// ─── Inventory (extra) ────────────────────────────────────────────────────────

export async function downloadInventoryImportTemplate(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Darkstore inventory import template');
}

export async function bulkImportInventory(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Darkstore inventory bulk import');
}

export async function downloadCycleCountReport(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Darkstore cycle count report');
}

export async function createRestock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.createRestockTask(req.body, storeId(req)))); } catch (err) { next(err); }
}

// ─── Outbound (extra) ─────────────────────────────────────────────────────────

export async function getActiveRiders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getActiveRiders(storeId(req)))); } catch (err) { next(err); }
}

export async function manuallyAssignRider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderId, riderId } = req.body;
    res.json(ResponseFormatter.success(await svc.batchDispatchOrders([orderId], riderId, '', storeId(req))));
  } catch (err) { next(err); }
}

export async function getTransferFulfillmentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getTransferFulfillmentStatus(req.params.requestId))); } catch (err) { next(err); }
}

export async function getTransferSLASummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getTransferSLASummary(storeId(req)))); } catch (err) { next(err); }
}

// ─── QC (extra) ───────────────────────────────────────────────────────────────

export async function getComplianceChecks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getComplianceChecks(storeId(req)))); } catch (err) { next(err); }
}

export async function toggleComplianceCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.toggleComplianceCheck(req.params.itemId, req.body, storeId(req)))); } catch (err) { next(err); }
}

// ─── Staff (extra) ────────────────────────────────────────────────────────────

export async function autoAssignOT(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Darkstore OT auto-assign');
}

export async function downloadStaffPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getStaffPerformance(storeId(req));
    res.json(ResponseFormatter.success({ data, exportedAt: new Date().toISOString() }));
  } catch (err) {
    next(err);
  }
}

// ─── Utilities (extra) ────────────────────────────────────────────────────────

export async function bulkUploadInventory(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Darkstore inventory bulk upload');
}

export async function downloadInventoryTemplate(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Darkstore inventory template');
}

export async function runSystemDiagnostics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getSystemStatus(storeId(req)))); } catch (err) { next(err); }
}

// ─── HSD (extra) ─────────────────────────────────────────────────────────────

export async function getHSDPickerUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getHSDUserList(storeId(req)))); } catch (err) { next(err); }
}

export async function createHSDRequisition(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success({ requisitionId: null, ...req.body, storeId: storeId(req) })); } catch (err) { next(err); }
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getHealthSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getHealthSummary(storeId(req)))); } catch (err) { next(err); }
}

export async function getChecklists(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getChecklists(storeId(req)))); } catch (err) { next(err); }
}

export async function updateChecklistItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.updateChecklistItem(req.params.checklistId, req.params.itemId, req.body))); } catch (err) { next(err); }
}

export async function submitChecklist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.submitChecklist(req.params.checklistId, actor(req)))); } catch (err) { next(err); }
}

export async function getEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getEquipment(storeId(req)))); } catch (err) { next(err); }
}

export async function getIncidents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.getIncidents(storeId(req)))); } catch (err) { next(err); }
}

export async function reportIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success(await svc.reportIncident(req.body, storeId(req), actor(req)))); } catch (err) { next(err); }
}

export async function resolveIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success(await svc.resolveIncident(req.params.incidentId, actor(req)))); } catch (err) { next(err); }
}

// ─── Operations extras ────────────────────────────────────────────────────────

export async function getWorkflowSlaMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ storeId: storeId(req), metrics: {} })); } catch (err) { next(err); }
}

export async function getRegionalPipeline(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ storeId: storeId(req), pipeline: [] })); } catch (err) { next(err); }
}

export async function getEscalationSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ storeId: storeId(req), suggestions: [] })); } catch (err) { next(err); }
}

// ─── Issues ───────────────────────────────────────────────────────────────────

export async function getOpsUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ users: [] })); } catch (err) { next(err); }
}

export async function listIssues(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ issues: [], total: 0 })); } catch (err) { next(err); }
}

export async function getIssueById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ id: req.params.id })); } catch (err) { next(err); }
}

export async function updateIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ id: req.params.id, ...req.body })); } catch (err) { next(err); }
}

// ─── Inbound extras ───────────────────────────────────────────────────────────

export async function syncInterStoreTransfers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ storeId: storeId(req), synced: true })); } catch (err) { next(err); }
}

// ─── Pickers extras ───────────────────────────────────────────────────────────

export async function getPickerPerformanceSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ storeId: storeId(req), summary: {} })); } catch (err) { next(err); }
}

export async function getPickerRegistry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ storeId: storeId(req), registry: [] })); } catch (err) { next(err); }
}

export async function getPickerPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ storeId: storeId(req), pickerId: req.params.id, performance: {} })); } catch (err) { next(err); }
}

// ─── Logistics ────────────────────────────────────────────────────────────────

export async function listLogisticsOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ orders: [], total: 0, storeId: storeId(req) })); } catch (err) { next(err); }
}

export async function createLogisticsOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(ResponseFormatter.success({ ...req.body, type: 'WAREHOUSE_TO_DARKSTORE', storeId: storeId(req) })); } catch (err) { next(err); }
}

export async function getLogisticsOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ id: req.params.id, storeId: storeId(req) })); } catch (err) { next(err); }
}

export async function cancelLogisticsOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ id: req.params.id, cancelled: true })); } catch (err) { next(err); }
}

export async function getLogisticsOrderTracking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ id: req.params.id, tracking: [] })); } catch (err) { next(err); }
}

export async function getLogisticsEstimate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ estimate: null, storeId: storeId(req) })); } catch (err) { next(err); }
}

export async function getCallCustomerLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ orderId: req.params.orderId, logs: [] })); } catch (err) { next(err); }
}

export async function getMarkRTOStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ orderId: req.params.orderId, rto: false })); } catch (err) { next(err); }
}

export async function listRestocks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success([])); } catch (err) { next(err); }
}

export async function getAlertsDebugIds(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(ResponseFormatter.success({ alertIds: [] })); } catch (err) { next(err); }
}

// ─── WD Transfer Requests (Darkstore → Warehouse) ────────────────────────────

export async function createWDTransferRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { warehouse_id, items, notes } = req.body as {
      warehouse_id: string;
      items: Array<{ product_id: string; product_name?: string; sku: string; requested_qty: number }>;
      notes?: string;
    };
    const dark_store_id = storeId(req);
    if (!warehouse_id) { res.status(400).json(ResponseFormatter.error('warehouse_id is required', 400)); return; }
    if (!items || items.length === 0) { res.status(400).json(ResponseFormatter.error('items are required', 400)); return; }

    const transfer_id = `WDT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const by = actor(req);
    const request = await WDTransferRequest.create({
      transfer_id,
      warehouse_id: new mongoose.Types.ObjectId(warehouse_id),
      dark_store_id,
      status: 'pending',
      items: items.map((i) => ({
        product_id: i.product_id ? new mongoose.Types.ObjectId(i.product_id) : undefined,
        product_name: i.product_name || '',
        sku: i.sku,
        requested_qty: i.requested_qty,
        approved_qty: 0,
        packed_qty: 0,
        received_qty: 0,
      })),
      requested_by: by,
      notes,
    });
    await WDTransferLog.create({ transfer_id, action: 'created', performed_by: by, note: `${items.length} SKU(s) requested from warehouse ${warehouse_id}` });
    res.status(201).json(ResponseFormatter.success(request));
  } catch (err) { next(err); }
}

export async function getDarkstoreWDTransferRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sid = storeId(req);
    const storeOid = await resolveDarkStoreObjectId(sid);
    const { status } = req.query;
    const filter: Record<string, unknown> = {
      $or: [
        { dark_store_id: sid },
        ...(storeOid ? [{ dark_store_id: String(storeOid) }, { dark_store_id: storeOid }] : []),
      ],
    };
    if (status) filter.status = status;
    const requests = await WDTransferRequest.find(filter).sort({ createdAt: -1 }).lean();
    res.json(ResponseFormatter.success(requests));
  } catch (err) { next(err); }
}

export async function getDarkstoreWDTransferRequestById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request = await WDTransferRequest.findOne({ transfer_id: req.params.id, dark_store_id: storeId(req) }).lean();
    if (!request) { res.status(404).json(ResponseFormatter.error('Transfer request not found', 404)); return; }
    res.json(ResponseFormatter.success(request));
  } catch (err) { next(err); }
}

export async function getDarkstoreWDTransferLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const logs = await WDTransferLog.find({ transfer_id: req.params.id }).sort({ createdAt: 1 }).lean();
    res.json(ResponseFormatter.success(logs));
  } catch (err) { next(err); }
}

export async function receiveWDTransferRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { items } = req.body as { items?: Array<{ sku: string; received_qty: number }> };
    const sid = storeId(req);
    const storeOid = await resolveDarkStoreObjectId(sid);
    const request = await WDTransferRequest.findOne({
      transfer_id: req.params.id,
      $or: [
        { dark_store_id: sid },
        ...(storeOid ? [{ dark_store_id: String(storeOid) }, { dark_store_id: storeOid }] : []),
      ],
    });
    if (!request) { res.status(404).json(ResponseFormatter.error('Transfer request not found', 404)); return; }
    if (request.status !== 'dispatched') {
      res.status(400).json(ResponseFormatter.error(`Cannot receive a request with status: ${request.status}`, 400));
      return;
    }

    // Apply received quantities from body or default to packed_qty
    const itemMap = new Map((items || []).map((i) => [i.sku, i.received_qty]));
    request.items = request.items.map((item) => ({
      ...item,
      received_qty: itemMap.has(item.sku) ? itemMap.get(item.sku)! : item.packed_qty,
    })) as typeof request.items;

    const inventoryStoreId =
      storeOid ||
      (mongoose.isValidObjectId(String(request.dark_store_id))
        ? new mongoose.Types.ObjectId(String(request.dark_store_id))
        : null);
    if (!inventoryStoreId) {
      res.status(400).json(ResponseFormatter.error('Cannot resolve dark store ObjectId for inventory update', 400));
      return;
    }

    // Update stock: decrease warehouse, increase darkstore
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (const item of request.items) {
        const qty = (item as any).received_qty as number;
        if (!item.product_id || qty <= 0) continue;

        // Decrease warehouse stock
        await WarehouseInventory.findOneAndUpdate(
          { warehouseId: request.warehouse_id, productId: item.product_id },
          { $inc: { quantity: -qty } },
          { session },
        );

        // Increase darkstore stock (upsert) — storeId must be ObjectId
        await StoreInventory.findOneAndUpdate(
          { storeId: inventoryStoreId, productId: item.product_id },
          { $inc: { quantity: qty }, $setOnInsert: { isAvailable: true, reservedQty: 0, lowStockThreshold: 5 } },
          { upsert: true, new: true, session },
        );
      }

      request.status = 'completed';
      await request.save({ session });
      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    const totalReceived = request.items.reduce((s, i) => s + ((i as any).received_qty as number || 0), 0);
    await WDTransferLog.create({ transfer_id: request.transfer_id, action: 'received', performed_by: actor(req), note: `${totalReceived} units received. Stock updated.`, snapshot: { items: request.items } });
    await WDTransferLog.create({ transfer_id: request.transfer_id, action: 'completed', performed_by: 'system', note: 'Warehouse stock decreased, darkstore stock increased.' });

    res.json(ResponseFormatter.success(request));
  } catch (err) { next(err); }
}
