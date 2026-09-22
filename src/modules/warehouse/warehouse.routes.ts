import { Router } from 'express';
import { authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import {
  getWarehouseMetrics,
  getOrderFlow,
  getDailyReport,
  getOperationsView,
  getAnalytics,
  // Attendance
  getLiveAttendance,
  // Devices
  listDevices,
  createDevice,
  patchDevice,
  // Equipment
  getEquipmentDevices,
  getEquipmentDeviceDetails,
  getMachinery,
  addMachinery,
  getMachineryDetails,
  reportEquipmentIssue,
  resolveEquipmentIssue,
  exportEquipment,
  // Exceptions
  getExceptions,
  reportException,
  exportExceptions,
  getExceptionDetails,
  updateExceptionStatus,
  rejectShipment,
  acceptPartial,
  // Inbound
  getInboundSummary,
  getGRNs,
  createGRN,
  exportGRNs,
  getGRNDetails,
  startGRN,
  completeGRN,
  logGRNDiscrepancy,
  getDocks,
  updateDock,
  // Inventory
  getInventorySummary,
  getInventoryMeta,
  listInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  listStorageLocations,
  getStorageLocationById,
  listAdjustments,
  createAdjustment,
  listCycleCounts,
  getCycleCountById,
  createCycleCount,
  updateCycleCount,
  startCycleCount,
  completeCycleCount,
  listInternalTransfers,
  getInternalTransferById,
  createInternalTransfer,
  updateTransferStatus,
  listStockAlerts,
  generateStockAlerts,
  createReorderRequest,
  exportInventory,
  // Notifications
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  // Orders
  listOrders,
  assignOrder,
  alertOrder,
  // Outbound
  getPicklists,
  getPicklistDetails,
  assignPicker,
  listBatches,
  createBatch,
  getBatchDetails,
  getPickers,
  getPickerOrders,
  getActiveRoutes,
  getRouteMap,
  getConsolidatedPicks,
  // QC
  getInspections,
  createInspection,
  getInspectionDetails,
  updateInspection,
  getTemperatureLogs,
  createTemperatureLog,
  getTempChart,
  getRejections,
  logRejection,
  getComplianceDocs,
  getComplianceDoc,
  getSamples,
  createSample,
  updateSample,
  getComplianceChecks,
  toggleComplianceCheck,
  // Staff
  getStaffSummary,
  listStaff,
  listShifts,
  createShift,
  getShiftById,
  updateShift,
  getShiftCoverage,
  getWeeklyRoster,
  publishWeeklyRoster,
  listAbsences,
  logAbsence,
  autoAssignShifts,
  getStaffPerformance,
  getIncentiveCriteria,
  // Transfers (inter-warehouse)
  listInterWarehouseTransfers,
  requestInterWarehouseTransfer,
  getInterWarehouseTransferDetails,
  getInterWarehouseTransferItems,
  updateInterWarehouseTransferStatus,
  exportInterWarehouseTransfers,
  // WD Transfer Requests (Warehouse → Darkstore)
  getWDTransferRequests,
  getWDTransferRequestById,
  getWDTransferLogs,
  acceptWDTransferRequest,
  rejectWDTransferRequest,
  packWDTransferRequest,
  dispatchWDTransferRequest,
  // Utilities
  getZones,
  uploadSKUs,
  getLogs,
  generateLabels,
  reassignBins,
  printBarcodes,
  // Reports
  getOperationalSLAs,
  exportSLAMetrics,
  getInventoryHealth,
  exportInventoryHealth,
  getProductivity,
  exportProductivity,
  getStorageUtilization,
  getOutputTrends,
  getReportsDaily,
  getReportsOperationsView,
  getInventoryByCategory,
  // Workforce
  getWorkforceStaff,
  addWorkforceStaff,
  getWorkforceStaffDetails,
  getWorkforceSchedule,
  createWorkforceSchedule,
  assignWorkforceStaff,
  getWorkforceAttendance,
  getWorkforcePerformance,
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveStatus,
  getTrainings,
  createTraining,
  getTrainingDetails,
  enrollStaff,
  logWorkforceAttendance,
} from './warehouse.controller';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, module: 'warehouse', status: 'ok', ts: new Date().toISOString() });
});

// All warehouse routes require admin auth
router.use(authenticateAdmin);

// ─── Core dashboard routes ────────────────────────────────────────────────────
router.get('/metrics', getWarehouseMetrics);
router.get('/order-flow', getOrderFlow);
router.get('/daily-report', getDailyReport);
router.get('/operations', getOperationsView);
router.get('/analytics', getAnalytics);

const wh = requireRole('warehouse', 'admin', 'super_admin');

// ─── Attendance ───────────────────────────────────────────────────────────────
router.get('/attendance/live', wh, getLiveAttendance);

// ─── Devices ──────────────────────────────────────────────────────────────────
router.get('/devices', wh, listDevices);
router.post('/devices', wh, createDevice);
router.patch('/devices/:id', wh, patchDevice);

// ─── Equipment ────────────────────────────────────────────────────────────────
router.get('/equipment/devices', wh, getEquipmentDevices);
router.get('/equipment/devices/:id', wh, getEquipmentDeviceDetails);
router.get('/equipment/machinery', wh, getMachinery);
router.post('/equipment/machinery', wh, addMachinery);
router.get('/equipment/machinery/:id', wh, getMachineryDetails);
router.post('/equipment/machinery/:id/issue', wh, reportEquipmentIssue);
router.post('/equipment/machinery/:id/resolve', wh, resolveEquipmentIssue);
router.get('/equipment/export', wh, exportEquipment);

// ─── Exceptions ───────────────────────────────────────────────────────────────
router.get('/exceptions', wh, getExceptions);
router.post('/exceptions', wh, reportException);
router.get('/exceptions/export', wh, exportExceptions);
router.get('/exceptions/:id', wh, getExceptionDetails);
router.put('/exceptions/:id/status', wh, updateExceptionStatus);
router.post('/exceptions/:id/reject-shipment', wh, rejectShipment);
router.post('/exceptions/:id/accept-partial', wh, acceptPartial);

// ─── Inbound ──────────────────────────────────────────────────────────────────
router.get('/inbound/summary', wh, getInboundSummary);
router.get('/inbound/grns', wh, getGRNs);
router.post('/inbound/grns', wh, createGRN);
router.get('/inbound/grns/export', wh, exportGRNs);
router.get('/inbound/grns/:id', wh, getGRNDetails);
router.post('/inbound/grns/:id/start', wh, startGRN);
router.post('/inbound/grns/:id/complete', wh, completeGRN);
router.post('/inbound/grns/:id/discrepancy', wh, logGRNDiscrepancy);
router.get('/inbound/docks', wh, getDocks);
router.put('/inbound/docks/:id', wh, updateDock);

// ─── Inventory ────────────────────────────────────────────────────────────────
router.get('/inventory/summary', wh, getInventorySummary);
router.get('/inventory/meta', wh, getInventoryMeta);
router.get('/inventory/items', wh, listInventoryItems);
router.get('/inventory/items/:id', wh, getInventoryItemById);
router.put('/inventory/items/:id', wh, updateInventoryItem);
router.get('/inventory/locations', wh, listStorageLocations);
router.get('/inventory/locations/:id', wh, getStorageLocationById);
router.get('/inventory/adjustments', wh, listAdjustments);
router.post('/inventory/adjustments', wh, createAdjustment);
router.get('/inventory/cycle-counts', wh, listCycleCounts);
router.get('/inventory/cycle-counts/:id', wh, getCycleCountById);
router.post('/inventory/cycle-counts', wh, createCycleCount);
router.put('/inventory/cycle-counts/:id', wh, updateCycleCount);
router.put('/inventory/cycle-counts/:id/start', wh, startCycleCount);
router.put('/inventory/cycle-counts/:id/complete', wh, completeCycleCount);
router.get('/inventory/transfers', wh, listInternalTransfers);
router.get('/inventory/transfers/:id', wh, getInternalTransferById);
router.post('/inventory/transfers', wh, createInternalTransfer);
router.put('/inventory/transfers/:id/status', wh, updateTransferStatus);
router.get('/inventory/alerts', wh, listStockAlerts);
router.post('/inventory/alerts/generate', wh, generateStockAlerts);
router.post('/inventory/reorder', wh, createReorderRequest);
router.post('/inventory/alerts/:id/reorder', wh, createReorderRequest);
router.post('/inventory/stock/:sku/adjust', wh, createAdjustment);
router.post('/inventory/cycle-counts/:id/start', wh, startCycleCount);
router.post('/inventory/cycle-counts/:id/complete', wh, completeCycleCount);
router.post('/inventory/transfers/:id/complete', wh, updateTransferStatus);
router.get('/inventory/export', wh, exportInventory);

// ─── Notifications ────────────────────────────────────────────────────────────
router.get('/notifications', wh, listNotifications);
router.patch('/notifications/:id/read', wh, markNotificationRead);
router.post('/notifications/read-all', wh, markAllNotificationsRead);

// ─── Orders ───────────────────────────────────────────────────────────────────
router.get('/orders', wh, listOrders);
router.post('/orders/:orderId/assign', wh, assignOrder);
router.post('/orders/:orderId/alert', wh, alertOrder);

// ─── Outbound ─────────────────────────────────────────────────────────────────
router.get('/outbound/picklists', wh, getPicklists);
router.get('/outbound/picklists/:id', wh, getPicklistDetails);
router.post('/outbound/picklists/:id/assign', wh, assignPicker);
router.get('/outbound/batches', wh, listBatches);
router.post('/outbound/batches', wh, createBatch);
router.get('/outbound/batches/:id', wh, getBatchDetails);
router.get('/outbound/pickers', wh, getPickers);
router.get('/outbound/pickers/:id/orders', wh, getPickerOrders);
router.get('/outbound/routes/active/map', wh, getActiveRoutes);
router.get('/outbound/routes/:id/map', wh, getRouteMap);
router.get('/outbound/consolidated-picks', wh, getConsolidatedPicks);

// ─── QC ───────────────────────────────────────────────────────────────────────
router.get('/qc/inspections', wh, getInspections);
router.post('/qc/inspections', wh, createInspection);
router.get('/qc/inspections/:id', wh, getInspectionDetails);
router.get('/qc/inspections/:id/report', wh, getInspectionDetails);
router.put('/qc/inspections/:id/update', wh, updateInspection);
router.get('/qc/temperature-logs', wh, getTemperatureLogs);
router.post('/qc/temperature-logs', wh, createTemperatureLog);
router.get('/qc/temperature-logs/:id/chart', wh, getTempChart);
router.get('/qc/rejections', wh, getRejections);
router.post('/qc/rejections', wh, logRejection);
router.get('/qc/compliance-docs', wh, getComplianceDocs);
router.get('/qc/compliance-docs/:id', wh, getComplianceDoc);
router.get('/qc/compliance-docs/:id/view', wh, getComplianceDoc);
router.get('/qc/compliance-docs/:id/download', wh, getComplianceDoc);
router.get('/qc/samples', wh, getSamples);
router.post('/qc/samples', wh, createSample);
router.get('/qc/samples/:id/report', wh, updateSample);
router.put('/qc/samples/:id/update', wh, updateSample);
router.get('/qc/checks', wh, getComplianceChecks);
router.put('/qc/checks/:id', wh, toggleComplianceCheck);

// ─── Staff ────────────────────────────────────────────────────────────────────
router.get('/staff/summary', wh, getStaffSummary);
router.get('/staff', wh, listStaff);
router.get('/staff/shifts', wh, listShifts);
router.post('/staff/shifts', wh, createShift);
router.get('/staff/shifts/coverage', wh, getShiftCoverage);
router.get('/staff/shifts/:id', wh, getShiftById);
router.put('/staff/shifts/:id', wh, updateShift);
router.get('/staff/roster/weekly', wh, getWeeklyRoster);
router.post('/staff/roster/weekly/publish', wh, publishWeeklyRoster);
router.get('/staff/absences', wh, listAbsences);
router.post('/staff/absences', wh, logAbsence);
router.post('/staff/shifts/auto-assign', wh, autoAssignShifts);
router.get('/staff/performance', wh, getStaffPerformance);
router.get('/staff/incentive-criteria', wh, getIncentiveCriteria);

// ─── Transfers (inter-warehouse) ──────────────────────────────────────────────
router.get('/transfers', wh, listInterWarehouseTransfers);
router.post('/transfers', wh, requestInterWarehouseTransfer);
router.get('/transfers/export', wh, exportInterWarehouseTransfers);
router.get('/transfers/:id', wh, getInterWarehouseTransferDetails);
router.get('/transfers/:id/items', wh, getInterWarehouseTransferItems);
router.put('/transfers/:id/status', wh, updateInterWarehouseTransferStatus);

// ─── WD Transfer Requests (Warehouse → Darkstore) ─────────────────────────────
router.get('/darkstore-requests', wh, getWDTransferRequests);
router.get('/darkstore-requests/:id', wh, getWDTransferRequestById);
router.get('/darkstore-requests/:id/logs', wh, getWDTransferLogs);
router.post('/darkstore-requests/:id/accept', wh, acceptWDTransferRequest);
router.post('/darkstore-requests/:id/reject', wh, rejectWDTransferRequest);
router.post('/darkstore-requests/:id/pack', wh, packWDTransferRequest);
router.post('/darkstore-requests/:id/dispatch', wh, dispatchWDTransferRequest);

// ─── Utilities ────────────────────────────────────────────────────────────────
router.get('/utilities/zones', wh, getZones);
router.post('/utilities/upload-skus', wh, uploadSKUs);
router.get('/utilities/logs', wh, getLogs);
router.post('/utilities/generate-labels', wh, generateLabels);
router.post('/utilities/bin-reassignment', wh, reassignBins);
router.post('/utilities/reassign-bins', wh, reassignBins);
router.post('/utilities/print-barcodes', wh, printBarcodes);

// ─── Reports ──────────────────────────────────────────────────────────────────
router.get('/reports/operational-slas', wh, getOperationalSLAs);
router.get('/reports/operational-slas/export', wh, exportSLAMetrics);
router.get('/reports/inventory-health', wh, getInventoryHealth);
router.get('/reports/inventory-health/export', wh, exportInventoryHealth);
router.get('/reports/productivity', wh, getProductivity);
router.get('/reports/productivity/export', wh, exportProductivity);
router.get('/reports/storage-utilization', wh, getStorageUtilization);
router.get('/reports/output-trends', wh, getOutputTrends);
router.get('/reports/inventory-by-category', wh, getInventoryByCategory);
router.get('/reports/daily', wh, getReportsDaily);
router.get('/reports/operations-view', wh, getReportsOperationsView);

// ─── Workforce ────────────────────────────────────────────────────────────────
router.get('/workforce/staff', wh, getWorkforceStaff);
router.post('/workforce/staff', wh, addWorkforceStaff);
router.get('/workforce/staff/:id/details', wh, getWorkforceStaffDetails);
router.get('/workforce/staff/:id', wh, getWorkforceStaffDetails);
router.get('/workforce/schedule', wh, getWorkforceSchedule);
router.post('/workforce/schedule', wh, createWorkforceSchedule);
router.get('/workforce/schedule/:id', wh, getWorkforceSchedule);
router.post('/workforce/schedule/:id/assign', wh, assignWorkforceStaff);
router.get('/workforce/attendance', wh, getWorkforceAttendance);
router.get('/workforce/performance', wh, getWorkforcePerformance);
router.get('/workforce/leave-requests', wh, getLeaveRequests);
router.post('/workforce/leave-requests', wh, createLeaveRequest);
router.put('/workforce/leave-requests/:id/status', wh, updateLeaveStatus);
router.get('/workforce/training', wh, getTrainings);
router.post('/workforce/training', wh, createTraining);
router.get('/workforce/training/:id/details', wh, getTrainingDetails);
router.get('/workforce/training/:id', wh, getTrainingDetails);
router.post('/workforce/training/:id/enroll', wh, enrollStaff);
router.post('/workforce/attendance', wh, logWorkforceAttendance);

export default router;
