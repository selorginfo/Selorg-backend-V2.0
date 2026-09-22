import { Router } from 'express';
import { authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import * as ctrl from './production.controller';


const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, module: 'production', status: 'ok', ts: new Date().toISOString() });
});

const protected_ = Router();
protected_.use(authenticateAdmin, requireRole('production', 'admin', 'super_admin'));

// ─── Overview / Lines ─────────────────────────────────────────────────────────

protected_.get('/overview', ctrl.getOverview);
protected_.post('/overview/batch', ctrl.startBatch);
protected_.post('/overview/lines', ctrl.createLine);
protected_.put('/overview/lines/:lineId', ctrl.updateLineDetails);
protected_.patch('/overview/lines/:lineId', ctrl.updateLine);
protected_.delete('/overview/lines/:lineId', ctrl.deleteLine);

// ─── Factories ────────────────────────────────────────────────────────────────

protected_.get('/factories', ctrl.listFactories);

// ─── Raw Materials ────────────────────────────────────────────────────────────

protected_.get('/raw-materials/materials', ctrl.listMaterials);
protected_.post('/raw-materials/materials', ctrl.createMaterial);
protected_.put('/raw-materials/materials/:id', ctrl.updateMaterial);
protected_.delete('/raw-materials/materials/:id', ctrl.deleteMaterial);
protected_.post('/raw-materials/materials/:id/order', ctrl.orderMaterial);

// ─── Planning ─────────────────────────────────────────────────────────────────

protected_.get('/planning', ctrl.listPlans);
protected_.post('/planning', ctrl.createPlan);
protected_.put('/planning/:id', ctrl.updatePlan);
protected_.delete('/planning/:id', ctrl.deletePlan);

// ─── Work Orders ──────────────────────────────────────────────────────────────

protected_.get('/work-orders', ctrl.listWorkOrders);
protected_.post('/work-orders', ctrl.createWorkOrder);
protected_.get('/work-orders/:id', ctrl.getWorkOrder);
protected_.put('/work-orders/:id', ctrl.updateWorkOrder);
protected_.delete('/work-orders/:id', ctrl.deleteWorkOrder);
protected_.post('/work-orders/:id/assign', ctrl.assignOperator);
protected_.patch('/work-orders/:id/status', ctrl.updateWorkOrderStatus);

// ─── Dashboard ────────────────────────────────────────────────────────────────

protected_.get('/dashboard/summary', ctrl.getDashboardSummary);
protected_.get('/dashboard/alerts', ctrl.getProductionAlerts);
protected_.put('/dashboard/alerts/:alertId/status', ctrl.updateProductionAlertStatus);
protected_.delete('/dashboard/alerts/resolved', ctrl.clearResolvedAlerts);
protected_.get('/dashboard/alerts/:alertId', ctrl.getProductionAlertById);
protected_.get('/dashboard/incidents', ctrl.getProductionDashboardIncidents);
protected_.post('/dashboard/incidents', ctrl.createProductionDashboardIncident);
protected_.put('/dashboard/incidents/:incidentId/status', ctrl.updateProductionDashboardIncidentStatus);
protected_.get('/dashboard/reports', ctrl.getProductionReports);
protected_.get('/dashboard/reports/export', ctrl.exportProductionReports);

// ─── QC ───────────────────────────────────────────────────────────────────────

protected_.get('/qc/summary', ctrl.getQCSummary);
protected_.get('/qc/inspections', ctrl.getQCInspections);
protected_.post('/qc/inspections', ctrl.createQCInspection);
protected_.put('/qc/inspections/:id', ctrl.updateQCInspection);
protected_.delete('/qc/inspections/:id', ctrl.deleteQCInspection);
protected_.get('/qc/temperature', ctrl.getQCTemperatureLogs);
protected_.post('/qc/temperature', ctrl.createQCTemperatureLog);
protected_.get('/qc/checks', ctrl.getQCComplianceChecks);
protected_.put('/qc/checks/:itemId', ctrl.toggleQCComplianceCheck);
protected_.get('/qc/docs', ctrl.getQCComplianceDocs);
protected_.get('/qc/samples', ctrl.getQCSampleTests);
protected_.post('/qc/samples', ctrl.createQCSampleTest);
protected_.put('/qc/samples/:sampleId', ctrl.updateQCSampleResult);
protected_.delete('/qc/samples/:sampleId', ctrl.deleteQCSampleTest);
protected_.get('/qc/rejections', ctrl.getQCRejections);
protected_.post('/qc/rejections', ctrl.createQCRejection);
protected_.get('/qc/history', ctrl.getQCActionHistory);
protected_.get('/qc/failures', ctrl.getQCRecentFailures);
protected_.get('/qc/recent-failures', ctrl.getQCRecentFailures);
protected_.post('/qc/failures/:failureId/resolve', ctrl.resolveQCFailure);

// ─── Inbound / GRN ───────────────────────────────────────────────────────────

protected_.get('/inbound/summary', ctrl.getGRNList);
protected_.get('/inbound/grns', ctrl.getGRNList);
protected_.post('/inbound/grns', ctrl.createGRN);
protected_.patch('/inbound/grns/:id/status', ctrl.updateGRNStatus);
protected_.get('/inbound/grns/:grnId', ctrl.getGRNList);
protected_.post('/inbound/grns/:grnId/start', ctrl.updateGRNStatus);
protected_.put('/inbound/grns/:grnId/items/:sku', ctrl.updateGRNItemQuantity);
protected_.post('/inbound/grns/:grnId/complete', ctrl.updateGRNStatus);
protected_.get('/inbound/putaway', ctrl.getPutawayTasks);
protected_.post('/inbound/putaway/:taskId/assign', ctrl.assignPutawayTask);
protected_.post('/inbound/putaway/:taskId/complete', ctrl.completePutawayTask);
protected_.get('/inbound/transfers', ctrl.getInterStoreTransfers);
protected_.post('/inbound/transfers/sync', ctrl.syncInterStoreTransfers);
protected_.post('/inbound/transfers/:transferId/receive', ctrl.receiveInterStoreTransfer);

// ─── Inventory ────────────────────────────────────────────────────────────────

protected_.get('/inventory', ctrl.getInventory);
protected_.patch('/inventory/:id', ctrl.updateInventoryItem);
protected_.get('/inventory/shelf-view', ctrl.getShelfView);
protected_.get('/inventory/stock-levels', ctrl.getStockLevels);
protected_.put('/inventory/stock-levels/:sku', ctrl.updateStockLevel);
protected_.delete('/inventory/stock-levels/:sku', ctrl.deleteInventoryStockItem);
protected_.put('/inventory/stock-levels/:sku/status', ctrl.changeInventoryItemStatus);
protected_.get('/inventory/adjustments', ctrl.getInventoryAdjustments);
protected_.post('/inventory/adjustments', ctrl.createInventoryAdjustment);
protected_.get('/inventory/cycle-count', ctrl.getInventoryCycleCount);
protected_.post('/inventory/scan', ctrl.scanInventoryItem);
protected_.get('/inventory/audit-log', ctrl.getInventoryAuditLog);
protected_.post('/inventory/restock-task', ctrl.createRestockTask);

// ─── Analytics ────────────────────────────────────────────────────────────────

protected_.get('/analytics', ctrl.getProductionAnalytics);

// ─── Settings ─────────────────────────────────────────────────────────────────

protected_.get('/settings', ctrl.getSettings);
protected_.put('/settings', ctrl.updateSettings);

// ─── Maintenance ──────────────────────────────────────────────────────────────

protected_.get('/maintenance/equipment', ctrl.getMaintenanceEquipment);
protected_.post('/maintenance/equipment', ctrl.createMaintenanceEquipment);
protected_.put('/maintenance/equipment/:equipmentId', ctrl.updateMaintenanceEquipment);
protected_.delete('/maintenance/equipment/:equipmentId', ctrl.deleteMaintenanceEquipment);
protected_.get('/maintenance/tasks', ctrl.getMaintenanceTasks);
protected_.post('/maintenance/tasks', ctrl.createMaintenanceTask);
protected_.put('/maintenance/tasks/:taskId', ctrl.updateMaintenanceTask);
protected_.patch('/maintenance/tasks/:taskId/status', ctrl.updateMaintenanceTaskStatus);
protected_.delete('/maintenance/tasks/:taskId', ctrl.deleteMaintenanceTask);
protected_.get('/maintenance/iot', ctrl.getIotDevices);

// ─── Staff ────────────────────────────────────────────────────────────────────

protected_.post('/staff', ctrl.createProductionStaff);
protected_.get('/staff/summary', ctrl.getProductionStaffSummary);
protected_.get('/staff/roster', ctrl.getStaffRoster);
protected_.get('/staff/shift-coverage', ctrl.getProductionShiftCoverage);
protected_.post('/staff/shift-coverage', ctrl.createProductionShiftCoverage);
protected_.get('/staff/absences', ctrl.getProductionAbsences);
protected_.post('/staff/absences', ctrl.logProductionAbsence);
protected_.get('/staff/weekly-roster', ctrl.getProductionWeeklyRoster);
protected_.post('/staff/weekly-roster/publish', ctrl.publishProductionRoster);
protected_.post('/staff/shifts/auto-assign-ot', ctrl.autoAssignProductionOT);
protected_.get('/staff/performance', ctrl.getProductionStaffPerformance);
protected_.get('/staff/performance/download', ctrl.downloadProductionPerformanceReport);
protected_.get('/staff/attendance', ctrl.getProductionAttendance);
protected_.patch('/staff/attendance/:recordId/mark-present', ctrl.markProductionAttendancePresent);
protected_.patch('/staff/:staffId/status', ctrl.updateProductionStaffStatus);

// ─── Outbound ─────────────────────────────────────────────────────────────────

protected_.get('/outbound/summary', ctrl.getOutboundSummary);
protected_.get('/outbound/dispatch', ctrl.getDispatchQueue);
protected_.get('/outbound/riders', ctrl.getActiveRiders);
protected_.post('/outbound/dispatch/batch', ctrl.batchDispatchOrders);
protected_.post('/outbound/dispatch/assign', ctrl.manuallyAssignRider);
protected_.get('/outbound/transfers', ctrl.getOutboundTransferRequests);
protected_.post('/outbound/transfers/:requestId/approve', ctrl.approveOutboundTransferRequest);
protected_.post('/outbound/transfers/:requestId/reject', ctrl.rejectOutboundTransferRequest);
protected_.get('/outbound/transfers/:requestId/fulfillment', ctrl.getTransferFulfillmentStatus);
protected_.get('/outbound/transfers/sla-summary', ctrl.getTransferSLASummary);

// ─── Packing ──────────────────────────────────────────────────────────────────

protected_.get('/packing/queue', ctrl.getPackQueue);
protected_.get('/packing/orders/:orderId', ctrl.getPackingOrderDetails);
protected_.post('/packing/orders/:orderId/scan', ctrl.scanPackingItem);
protected_.post('/packing/orders/:orderId/complete', ctrl.completePackingOrder);
protected_.post('/packing/orders/:orderId/report-missing', ctrl.reportMissingPackingItem);
protected_.post('/packing/orders/:orderId/report-damaged', ctrl.reportDamagedPackingItem);

// ─── Picklist ─────────────────────────────────────────────────────────────────

protected_.get('/picklist', ctrl.getProductionPicklists);
protected_.post('/picklist', ctrl.createProductionPicklist);
protected_.get('/picklist/:picklistId', ctrl.getProductionPicklistDetails);
protected_.post('/picklist/:picklistId/start', ctrl.startProductionPicking);
protected_.post('/picklist/:picklistId/pause', ctrl.pauseProductionPicking);
protected_.post('/picklist/:picklistId/complete', ctrl.completeProductionPicking);
protected_.post('/picklist/:picklistId/assign', ctrl.assignProductionPicker);
protected_.post('/picklist/:picklistId/move-to-packing', ctrl.moveToProductionPacking);

// ─── HSD ──────────────────────────────────────────────────────────────────────

protected_.get('/hsd/fleet', ctrl.getHSDFleet);
protected_.get('/hsd/picker-users', ctrl.getHSDUsers);
protected_.post('/hsd/devices/register', ctrl.registerHSDDevice);
protected_.post('/hsd/devices/:deviceId/assign', ctrl.assignHSDDevice);
protected_.post('/hsd/devices/:deviceId/unassign', ctrl.unassignHSDDevice);
protected_.post('/hsd/devices/bulk-reset', ctrl.bulkResetHSDDevices);
protected_.get('/hsd/devices/:deviceId/history', ctrl.getHSDDeviceHistory);
protected_.get('/hsd/sessions/live', ctrl.getHSDLiveSessions);
protected_.get('/hsd/devices/:deviceId/actions', ctrl.getHSDDeviceActions);
protected_.post('/hsd/devices/:deviceId/control', ctrl.controlHSDDevice);
protected_.get('/hsd/issues', ctrl.getHSDIssues);
protected_.post('/hsd/issues/report', ctrl.reportHSDIssue);
protected_.get('/hsd/logs', ctrl.getHSDLogs);
protected_.post('/hsd/sessions/:deviceId/action', ctrl.handleHSDSessionAction);
protected_.post('/hsd/requisitions', ctrl.createHSDRequisition);

// ─── Utilities ────────────────────────────────────────────────────────────────

protected_.post('/utilities/labels/generate', ctrl.generateProductionLabel);
protected_.post('/utilities/inventory/bulk-upload', ctrl.bulkUploadProductionInventory);
protected_.get('/utilities/inventory/upload-template', ctrl.downloadProductionUploadTemplate);
protected_.get('/utilities/system/status', ctrl.getProductionSystemStatus);
protected_.post('/utilities/system/diagnostics', ctrl.runProductionDiagnostics);
protected_.post('/utilities/system/sync', ctrl.forceProductionSync);
protected_.get('/utilities/audit-logs', ctrl.getProductionAuditLogs);
protected_.post('/utilities/audit-logs/export', ctrl.exportProductionAuditLogs);

// ─── Health ───────────────────────────────────────────────────────────────────

protected_.get('/health-status/summary', ctrl.getProductionHealthSummary);
protected_.get('/health-status/checklists', ctrl.getHealthChecklists);
protected_.put('/health-status/checklists/:checklistId/items/:itemId', ctrl.updateHealthChecklistItem);
protected_.post('/health-status/checklists/:checklistId/submit', ctrl.submitHealthChecklist);
protected_.get('/health-status/equipment', ctrl.getHealthEquipment);
protected_.get('/health-status/incidents', ctrl.getProductionIncidents);
protected_.post('/health-status/incidents', ctrl.reportProductionIncident);
protected_.put('/health-status/incidents/:incidentId/resolve', ctrl.resolveProductionIncident);

// ─── Orders ───────────────────────────────────────────────────────────────────

protected_.get('/orders', ctrl.getProductionOrders);
protected_.get('/orders/:orderId/call-customer', ctrl.callProductionCustomerLog);
protected_.get('/orders/:orderId/mark-rto', ctrl.markProductionRTOStatus);
protected_.post('/orders/:orderId/call-customer', ctrl.callProductionCustomer);
protected_.post('/orders/:orderId/mark-rto', ctrl.markProductionRTO);

// ─── Raw Materials (additional) ───────────────────────────────────────────────

protected_.get('/raw-materials/receipts', ctrl.listReceipts);
protected_.post('/raw-materials/receipts/:id/receive', ctrl.markReceived);
protected_.get('/raw-materials/requisitions', ctrl.listRequisitions);
protected_.post('/raw-materials/requisitions', ctrl.createRequisition);
protected_.patch('/raw-materials/requisitions/:id/status', ctrl.updateRequisitionStatus);

// ─── QC (additional: compliance and watchlist) ────────────────────────────────

protected_.get('/qc/compliance/audit-status', ctrl.getQCComplianceAuditStatus);
protected_.get('/qc/compliance/logs', ctrl.getQCComplianceLogs);
protected_.post('/qc/compliance/logs', ctrl.createQCComplianceLog);
protected_.get('/qc/watchlist', ctrl.getQCWatchlist);
protected_.post('/qc/watchlist', ctrl.addToQCWatchlist);
protected_.post('/qc/watchlist/:sku/log-check', ctrl.logQCWatchlistCheck);

// ─── Inventory (additional) ───────────────────────────────────────────────────

protected_.get('/inventory/cycle-count/report', ctrl.getCycleCountReport);
protected_.get('/inventory/restock', ctrl.listRestocks);
protected_.post('/inventory/restock', ctrl.createRestock);
protected_.put('/inventory/items/:sku', ctrl.updateInventoryItemBySku);

// ─── Analytics (additional) ───────────────────────────────────────────────────

protected_.get('/analytics/rider-performance', ctrl.getRiderPerformanceAnalytics);
protected_.get('/analytics/sla-adherence', ctrl.getSlaAdherenceAnalytics);
protected_.get('/analytics/fleet-utilization', ctrl.getFleetUtilizationAnalytics);
protected_.post('/analytics/export', ctrl.exportAnalyticsReport);

// ─── Dashboard (additional legacy paths) ──────────────────────────────────────

protected_.get('/dashboard/alert-history', ctrl.getDashboardAlertHistory);
protected_.get('/dashboard/live-orders', ctrl.getDashboardLiveOrders);
protected_.get('/dashboard/refresh', ctrl.getDashboardRefresh);
protected_.post('/dashboard/refresh', ctrl.postDashboardRefresh);
protected_.get('/dashboard/rto-alerts', ctrl.getDashboardRtoAlerts);
protected_.get('/dashboard/staff-load', ctrl.getDashboardStaffLoad);
protected_.get('/dashboard/stock-alerts', ctrl.getDashboardStockAlerts);
protected_.get('/dashboard/utilities/settings', ctrl.getDashboardUtilitiesSettings);
protected_.put('/dashboard/utilities/settings', ctrl.updateDashboardUtilitiesSettings);
protected_.get('/dashboard/utilities/sync-history', ctrl.getDashboardUtilitiesSyncHistory);
protected_.get('/dashboard/utilities/upload-history', ctrl.getDashboardUtilitiesUploadHistory);
protected_.post('/dashboard/utilities/hsd-sync', ctrl.triggerDashboardHsdSync);

// ─── Alerts (legacy path aliases) ─────────────────────────────────────────────

protected_.get('/alerts/debug/ids', ctrl.getAlertsDebugIds);
protected_.post('/alerts/:alertId/action', ctrl.performAlertAction);

// ─── Picker ───────────────────────────────────────────────────────────────────

protected_.get('/picker/available', ctrl.getAvailablePickers);

router.use(protected_);

export default router;
