import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth.middleware';
import * as ctrl from './shared.controller';

const router = Router();

router.use(authenticateAdmin);

// Alerts
router.get('/alerts', ctrl.listAlerts);
router.put('/alerts/read-all', ctrl.markAllAlertsRead);
router.delete('/alerts', ctrl.clearResolvedAlerts);
router.get('/alerts/:id', ctrl.getAlertById);
router.post('/alerts/:id/action', ctrl.performAlertAction);

// Approvals
router.get('/approvals/summary', ctrl.getApprovalSummary);
router.get('/approvals/queue', ctrl.listApprovals);
router.post('/approvals/queue', ctrl.createApprovalRequest);
router.post('/approvals/batch-approve', ctrl.batchApprove);
router.get('/approvals/queue/:id', ctrl.getApprovalById);
router.post('/approvals/queue/:id/approve', ctrl.approveRequest);
router.post('/approvals/queue/:id/reject', ctrl.rejectRequest);

// Call logs
router.post('/call-logs', ctrl.createCallLog);
router.get('/call-logs/by-order/:orderId', ctrl.getCallLogsByOrder);
router.get('/call-logs/by-ticket/:ticketId', ctrl.getCallLogsByTicket);
router.get('/call-logs/by-customer/:customerId', ctrl.getCallLogsByCustomer);

// Escalations
router.post('/escalations', ctrl.createEscalation);
router.get('/escalations/by-team/:team', ctrl.getEscalationsByTeam);
router.get('/escalations/:id', ctrl.getEscalationById);
router.patch('/escalations/:id/resolve', ctrl.resolveEscalation);
router.patch('/escalations/:id/assign', ctrl.assignEscalation);
router.patch('/escalations/:id', ctrl.updateEscalation);

// Cross-module search
router.get('/search', ctrl.globalSearch);
router.get('/search/suggestions', ctrl.getSearchSuggestions);
router.get('/search/recent', ctrl.getRecentSearches);

// System health
router.get('/system-health', ctrl.getSystemHealthSummary);
router.get('/system-health/devices', ctrl.listSystemDevices);
router.get('/system-health/devices/:id', ctrl.getSystemDeviceById);
router.post('/system-health/diagnostics/run', ctrl.runDiagnostics);
router.get('/system-health/diagnostics/reports/:reportId', ctrl.getDiagnosticsReport);

// Analytics
router.get('/analytics/rider-performance', ctrl.getRiderPerformance);
router.get('/analytics/sla-adherence', ctrl.getSlaAdherence);
router.get('/analytics/fleet-utilization', ctrl.getFleetUtilization);
router.get('/analytics/drill-down', ctrl.getDrillDown);
router.get('/analytics/hub-comparison', ctrl.getHubComparison);
router.get('/analytics/rider-leaderboard', ctrl.getRiderLeaderboard);
router.get('/analytics/dispatch-efficiency', ctrl.getDispatchEfficiency);
router.get('/analytics/reports/schedules', ctrl.getReportSchedules);
router.post('/analytics/reports/schedules', ctrl.createReportSchedule);
router.post('/analytics/reports/export', ctrl.exportReport);

// Bulk Operations
router.post('/bulk-ops/orders', ctrl.bulkOrders);
router.post('/bulk-ops/products', ctrl.bulkProducts);
router.post('/bulk-ops/inventory', ctrl.bulkInventory);
router.post('/bulk-ops/import/products', ctrl.importProducts);
router.get('/bulk-ops/export/:type', ctrl.exportByType);
router.delete('/bulk-ops/:type', ctrl.deleteByType);

// Dashboard
router.get('/dashboard/summary', ctrl.getDashboardSummary);

// Communication
router.get('/communication/chats', ctrl.listChats);
router.get('/communication/chats/:id', ctrl.getChatById);
router.post('/communication/chats/:id/messages', ctrl.sendChatMessage);
router.put('/communication/chats/:id/read', ctrl.markChatRead);
router.post('/communication/broadcasts', ctrl.createBroadcast);
router.post('/communication/chats/:id/flag', ctrl.flagChat);

// Inventory Sync
router.post('/inventory-sync/warehouse-to-store', ctrl.syncWarehouseToStore);
router.post('/inventory-sync/store-to-warehouse', ctrl.syncStoreToWarehouse);
router.post('/inventory-sync/bulk', ctrl.bulkInventorySync);
router.get('/inventory-sync/status', ctrl.getInventorySyncStatus);

// Workflow Automation
router.post('/workflow/rules', ctrl.createWorkflowRule);
router.post('/workflow/trigger', ctrl.triggerWorkflow);
router.post('/workflow/schedule', ctrl.scheduleWorkflow);
router.get('/workflow/rules', ctrl.listWorkflowRules);

export default router;
