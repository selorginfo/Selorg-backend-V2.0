import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth.middleware';
import * as ctrl from './darkstore.controller';

const router = Router();

// All darkstore routes require admin auth
router.use(authenticateAdmin);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard/summary', ctrl.getDashboardSummary);
router.get('/dashboard/store-profile', ctrl.getStoreProfile);
router.get('/dashboard/warehouse-profile', ctrl.getWarehouseProfile);
router.get('/dashboard/staff-load', ctrl.getStaffLoad);
router.get('/dashboard/stock-alerts', ctrl.getStockAlerts);
router.get('/dashboard/rto-alerts', ctrl.getRTOAlerts);
router.get('/dashboard/live-orders', ctrl.getLiveOrders);
router.get('/dashboard/alert-history', ctrl.getAlertHistory);
router.post('/dashboard/refresh', (_req, res) => res.json({ success: true, refreshed: true }));
router.get('/dashboard/refresh', (_req, res) => res.json({ success: true, refreshed: true }));

// ─── Orders ───────────────────────────────────────────────────────────────────
router.get('/orders', ctrl.getOrders);
router.get('/orders/:orderId/action-logs', ctrl.getAlertHistory);
router.get('/orders/:orderId', ctrl.getOrderById);
router.get('/orders/:orderId/call-customer', ctrl.getCallCustomerLog);
router.get('/orders/:orderId/mark-rto', ctrl.getMarkRTOStatus);
router.post('/orders/:orderId/call-customer', ctrl.callCustomer);
router.post('/orders/:orderId/mark-rto', ctrl.markRTO);
router.patch('/orders/:orderId', ctrl.updateOrder);
router.patch('/orders/:orderId/assign', ctrl.assignOrder);
router.patch('/orders/:orderId/start-picking', ctrl.startPicking);
router.patch('/orders/:orderId/complete-picking', ctrl.completePicking);
router.patch('/orders/:orderId/bag-rack', ctrl.updateBagRack);
router.post('/orders/:orderId/cancel', ctrl.cancelOrder);

// ─── Inventory ────────────────────────────────────────────────────────────────
router.get('/inventory/shelf-view', ctrl.getShelfView);
router.get('/inventory/shelves', ctrl.listShelves);
router.post('/inventory/shelves', ctrl.createShelf);
router.put('/inventory/shelves/:shelfId', ctrl.updateShelf);
router.delete('/inventory/shelves/:shelfId', ctrl.deleteShelf);
router.get('/inventory/product-location/:sku', ctrl.getProductLocation);
router.get('/inventory/stock-levels', ctrl.getStockLevels);
router.put('/inventory/items/:sku', ctrl.updateInventoryItem);
router.put('/inventory/stock-levels/:sku', ctrl.updateStockLevel);
router.delete('/inventory/stock-levels/:sku', ctrl.deleteInventoryItem);
router.put('/inventory/stock-levels/:sku/status', ctrl.changeItemStatus);
router.get('/inventory/adjustments', ctrl.getAdjustments);
router.post('/inventory/adjustments', ctrl.createAdjustment);
router.get('/inventory/import-template', ctrl.downloadInventoryImportTemplate);
router.post('/inventory/bulk-import', ctrl.bulkImportInventory);
router.get('/inventory/cycle-count', ctrl.getCycleCount);
router.get('/inventory/cycle-count/report', ctrl.downloadCycleCountReport);
router.post('/inventory/scan', ctrl.scanItem);
router.get('/inventory/restock', ctrl.listRestocks);
router.post('/inventory/restock', ctrl.createRestock);
router.get('/inventory/audit-log', ctrl.getAuditLog);
router.post('/inventory/restock-task', ctrl.createRestockTask);

// ─── Picklists ────────────────────────────────────────────────────────────────
router.get('/picklists', ctrl.getPicklists);
router.post('/picklists', ctrl.createPicklist);
router.get('/picklists/:picklistId', ctrl.getPicklistDetails);
router.post('/picklists/:picklistId/start', ctrl.startPicklistPicking);
router.post('/picklists/:picklistId/progress', ctrl.updatePicklistProgress);
router.post('/picklists/:picklistId/pause', ctrl.pausePicklist);
router.post('/picklists/:picklistId/complete', ctrl.completePicklist);
router.post('/picklists/:picklistId/assign', ctrl.assignPickerToPicklist);
router.post('/picklists/:picklistId/move-to-packing', ctrl.movePicklistToPacking);

// ─── Packing ─────────────────────────────────────────────────────────────────
router.get('/packing/queue', ctrl.getPackQueue);
router.get('/packing/orders/:orderId', ctrl.getPackingOrderDetails);
router.post('/packing/orders/:orderId/scan', ctrl.scanPackingItem);
router.post('/packing/orders/:orderId/complete', ctrl.completePackingOrder);
router.post('/packing/orders/:orderId/report-missing', ctrl.reportMissingItem);
router.post('/packing/orders/:orderId/report-damaged', ctrl.reportDamagedItem);

// ─── Inbound ─────────────────────────────────────────────────────────────────
router.get('/inbound/summary', ctrl.getInboundSummary);
router.get('/inbound/grn', ctrl.getGRNList);
router.post('/inbound/grn/:grnId/start', ctrl.startGRNProcessing);
router.put('/inbound/grn/:grnId/items/:sku', ctrl.updateGRNItemQuantity);
router.post('/inbound/grn/:grnId/complete', ctrl.completeGRNProcessing);
router.get('/inbound/grn/:grnId', ctrl.getGRNDetails);
router.get('/inbound/putaway', ctrl.getPutawayTasks);
router.post('/inbound/putaway/:taskId/assign', ctrl.assignPutawayTask);
router.post('/inbound/putaway/:taskId/complete', ctrl.completePutawayTask);
router.get('/inbound/transfers', ctrl.getInterStoreTransfers);
router.post('/inbound/transfers/sync', ctrl.syncInterStoreTransfers);
router.get('/inbound/transfers/:transferId', ctrl.getInterStoreTransfers);
router.post('/inbound/transfers/:transferId/receive', ctrl.receiveInterStoreTransfer);

// ─── Outbound ─────────────────────────────────────────────────────────────────
router.get('/outbound/summary', ctrl.getOutboundSummary);
router.get('/outbound/ready-orders', ctrl.getReadyForDispatchOrders);
router.get('/outbound/dispatch', ctrl.getReadyForDispatchOrders);
router.get('/outbound/riders', ctrl.getActiveRiders);
router.post('/outbound/dispatch/batch', ctrl.batchDispatchOrders);
router.post('/outbound/dispatch/assign', ctrl.manuallyAssignRider);
router.get('/outbound/transfers/sla-summary', ctrl.getTransferSLASummary);
router.get('/outbound/transfers', ctrl.getOutboundTransferRequests);
router.post('/outbound/transfers/:requestId/approve', ctrl.approveTransferRequest);
router.post('/outbound/transfers/:requestId/reject', ctrl.rejectTransferRequest);
router.get('/outbound/transfers/:requestId/fulfillment', ctrl.getTransferFulfillmentStatus);

// ─── Alerts ───────────────────────────────────────────────────────────────────
router.get('/alerts', ctrl.getAlerts);
router.delete('/alerts/resolved', ctrl.clearResolvedAlerts);
router.post('/alerts/resolved/clear', ctrl.clearResolvedAlerts);
router.get('/alerts/debug/ids', ctrl.getAlertsDebugIds);
router.get('/alerts/:alertId', ctrl.getAlertById);
router.post('/alerts/:alertId/action', ctrl.performAlertAction);

// ─── QC ───────────────────────────────────────────────────────────────────────
router.get('/qc/summary', ctrl.getQCSummary);
router.get('/qc/inspections', ctrl.getQCInspections);
router.post('/qc/inspections', ctrl.createQCInspection);
router.get('/qc/temperature', ctrl.getTemperatureLogs);
router.post('/qc/temperature', ctrl.createTemperatureLog);
router.get('/qc/checks', ctrl.getComplianceChecks);
router.put('/qc/checks/:itemId', ctrl.toggleComplianceCheck);
router.get('/qc/docs', ctrl.getComplianceDocs);
router.get('/qc/samples', ctrl.getSampleTests);
router.post('/qc/samples', ctrl.createSampleTest);
router.put('/qc/samples/:sampleId', ctrl.updateSampleResult);
router.get('/qc/rejections', ctrl.getRejections);
router.post('/qc/rejections', ctrl.createRejection);
router.get('/qc/failures', ctrl.getQCFailures);
router.get('/qc/recent-failures', ctrl.getQCFailures);
router.post('/qc/failures/:failureId/resolve', ctrl.resolveQCFailure);
router.get('/qc/watchlist', ctrl.getWatchlist);
router.post('/qc/watchlist', ctrl.addWatchlistItem);
router.post('/qc/watchlist/:sku/log-check', ctrl.logQCCheck);
router.get('/qc/compliance/logs', ctrl.getComplianceLogs);
router.post('/qc/compliance/logs', ctrl.addComplianceLog);
router.get('/qc/compliance/audit-status', ctrl.getAuditStatus);
router.get('/qc/history', ctrl.getAlertHistory);

// ─── Staff ────────────────────────────────────────────────────────────────────
router.get('/staff/summary', ctrl.getStaffSummary);
router.get('/staff/roster', ctrl.getStaffRoster);
router.get('/staff/shift-coverage', ctrl.getShiftCoverage);
router.get('/staff/absences', ctrl.getAbsences);
router.post('/staff/absences', ctrl.logAbsence);
router.get('/staff/weekly-roster', ctrl.getWeeklyRoster);
router.post('/staff/weekly-roster/publish', ctrl.publishRoster);
router.post('/staff/shifts/auto-assign-ot', ctrl.autoAssignOT);
router.get('/staff/performance', ctrl.getStaffPerformance);
router.get('/staff/performance/download', ctrl.downloadStaffPerformance);

// ─── Health ───────────────────────────────────────────────────────────────────
router.get('/health/summary', ctrl.getHealthSummary);
router.get('/health/checklists', ctrl.getChecklists);
router.put('/health/checklists/:checklistId/items/:itemId', ctrl.updateChecklistItem);
router.post('/health/checklists/:checklistId/submit', ctrl.submitChecklist);
router.get('/health/equipment', ctrl.getEquipment);
router.get('/health/incidents', ctrl.getIncidents);
router.post('/health/incidents', ctrl.reportIncident);
router.put('/health/incidents/:incidentId/resolve', ctrl.resolveIncident);

// ─── HSD ─────────────────────────────────────────────────────────────────────
router.get('/hsd/fleet', ctrl.getHSDFleetOverview);
router.get('/hsd/picker-users', ctrl.getHSDPickerUsers);
router.get('/hsd/users', ctrl.getHSDUserList);
router.post('/hsd/devices/register', ctrl.registerHSDDevice);
router.post('/hsd/devices/bulk-reset', ctrl.bulkResetHSDDevices);
router.post('/hsd/devices/:deviceId/assign', ctrl.assignHSDDevice);
router.post('/hsd/devices/:deviceId/unassign', ctrl.unassignHSDDevice);
router.get('/hsd/devices/:deviceId/history', ctrl.getDeviceHistory);
router.get('/hsd/devices/:deviceId/actions', ctrl.getDeviceHistory);
router.post('/hsd/devices/:deviceId/control', ctrl.deviceControl);
router.get('/hsd/sessions/live', ctrl.getLiveSessions);
router.post('/hsd/sessions/:deviceId/action', ctrl.sessionAction);
router.get('/hsd/issues', ctrl.getHSDIssues);
router.post('/hsd/issues/report', ctrl.reportHSDIssue);
router.get('/hsd/logs', ctrl.getAuditLogs);
router.post('/hsd/requisitions', ctrl.createHSDRequisition);
router.get('/hsd/users/:userId/device-request-otp', ctrl.getHSDUserOtp);
router.post('/hsd/users/:userId/generate-device-otp', ctrl.generateHSDUserOtp);

// ─── Analytics ────────────────────────────────────────────────────────────────
router.get('/analytics/rider-performance', ctrl.getRiderPerformance);
router.get('/analytics/sla-adherence', ctrl.getSlaAdherence);
router.get('/analytics/fleet-utilization', ctrl.getRiderPerformance);
router.post('/analytics/export', ctrl.exportReport);

// ─── Settings ─────────────────────────────────────────────────────────────────
router.get('/settings', ctrl.getSettings);
router.put('/settings', ctrl.updateSettings);

// ─── Operations ───────────────────────────────────────────────────────────────
router.get('/operations/sla-monitor', ctrl.getSlaMonitor);
router.get('/operations/missing-items', ctrl.getMissingItems);
router.get('/operations/live-picking', ctrl.getLivePickingMonitor);
router.get('/operations/alerts', ctrl.getOperationalAlerts);
router.get('/operations/exception-queue', ctrl.getExceptionQueue);
router.get('/operations/pipeline', ctrl.getPipelineStats);
router.get('/operations/activity-feed', ctrl.getActivityFeed);
router.get('/operations/order-workflow/:orderId', ctrl.getOrderWorkflow);
router.get('/operations/workflow-sla-metrics', ctrl.getWorkflowSlaMetrics);
router.get('/operations/regional-pipeline', ctrl.getRegionalPipeline);
router.get('/operations/escalation-suggestions', ctrl.getEscalationSuggestions);

// ─── Reports ──────────────────────────────────────────────────────────────────
router.get('/reports/inventory', ctrl.getInventoryReport);
router.get('/reports/staff', ctrl.getStaffReport);
router.get('/reports/compliance', ctrl.getComplianceReport);
router.get('/reports/export', ctrl.exportReport);
router.post('/reports/export', ctrl.exportReport);

// ─── Utilities ────────────────────────────────────────────────────────────────
router.post('/utilities/labels/generate', ctrl.generateLabel);
router.post('/utilities/inventory/bulk-upload', ctrl.bulkUploadInventory);
router.get('/utilities/inventory/upload-template', ctrl.downloadInventoryTemplate);
router.get('/utilities/system/status', ctrl.getSystemStatus);
router.post('/utilities/system/diagnostics', ctrl.runSystemDiagnostics);
router.post('/utilities/system/sync', ctrl.forceGlobalSync);
router.get('/utilities/audit-logs', ctrl.getAuditLogs);
router.post('/utilities/audit-logs/export', ctrl.exportAuditLogs);

// ─── Logistics ────────────────────────────────────────────────────────────────
router.get('/logistics/orders', ctrl.listLogisticsOrders);
router.post('/logistics/orders', ctrl.createLogisticsOrder);
router.get('/logistics/orders/:id', ctrl.getLogisticsOrder);
router.post('/logistics/orders/:id/cancel', ctrl.cancelLogisticsOrder);
router.get('/logistics/orders/:id/tracking', ctrl.getLogisticsOrderTracking);
router.post('/logistics/estimate', ctrl.getLogisticsEstimate);

// ─── WD Transfer Requests (Darkstore → Warehouse) ─────────────────────────────
router.post('/transfer-requests', ctrl.createWDTransferRequest);
router.get('/transfer-requests', ctrl.getDarkstoreWDTransferRequests);
router.get('/transfer-requests/:id', ctrl.getDarkstoreWDTransferRequestById);
router.get('/transfer-requests/:id/logs', ctrl.getDarkstoreWDTransferLogs);
router.post('/transfer-requests/:id/receive', ctrl.receiveWDTransferRequest);

// ─── Pick Ops ─────────────────────────────────────────────────────────────────
router.get('/pick-ops', ctrl.getPicklists);

// ─── Pickers (darkstore view) ─────────────────────────────────────────────────
router.get('/pickers/performance/summary', ctrl.getPickerPerformanceSummary);
router.get('/pickers/registry', ctrl.getPickerRegistry);
router.get('/pickers/available', ctrl.getStaffRoster);
router.get('/pickers/live', ctrl.getStaffRoster);
router.get('/pickers/:id/performance', ctrl.getPickerPerformance);
router.get('/pickers', ctrl.getStaffRoster);

// ─── Issues ───────────────────────────────────────────────────────────────────
router.get('/issues/ops-users', ctrl.getOpsUsers);
router.get('/issues', ctrl.listIssues);
router.get('/issues/:id', ctrl.getIssueById);
router.patch('/issues/:id', ctrl.updateIssue);

export default router;
