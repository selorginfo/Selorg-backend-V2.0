import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth.middleware';
import * as ctrl from './rider.controller';

const router = Router();

// Health
router.get('/health', (_req, res) => res.status(200).json({ ok: true, service: 'rider', timestamp: new Date().toISOString() }));

// ─── Legal (public, rider-app facing) ────────────────────────────────────────
router.get('/legal/config', ctrl.getLegalConfig);
router.get('/legal/terms', ctrl.getLegalTerms);
router.get('/legal/privacy', ctrl.getLegalPrivacy);

// Overview
router.get('/summary', authenticateAdmin, ctrl.getSummary);
router.get('/dashboard/counts', authenticateAdmin, ctrl.getDashboardCounts);

// Search
router.get('/search', authenticateAdmin, ctrl.search);

// ─── Dispatch ──────────────────────────────────────────────────────────────────
router.get('/dispatch/unassigned', authenticateAdmin, ctrl.listUnassignedOrders);
router.get('/dispatch/unassigned/count', authenticateAdmin, ctrl.getUnassignedOrdersCount);
router.get('/dispatch/map', authenticateAdmin, ctrl.getMapData);
router.get('/dispatch/map/riders', authenticateAdmin, ctrl.getMapRiders);
router.get('/dispatch/map/orders', authenticateAdmin, ctrl.getMapOrders);
router.get('/dispatch/orders/:orderId/recommendations', authenticateAdmin, ctrl.getRecommendedRiders);
router.get('/dispatch/orders/:orderId/assignment', authenticateAdmin, ctrl.getOrderAssignmentDetails);
router.post('/dispatch/assign', authenticateAdmin, ctrl.assignOrder);
router.post('/dispatch/batch-assign', authenticateAdmin, ctrl.batchAssignOrders);
router.post('/dispatch/batch-assign-by-store', authenticateAdmin, ctrl.batchAssignByStore);
router.get('/live-positions', authenticateAdmin, ctrl.getLiveRiderPositions);
router.post('/dispatch/auto-assign', authenticateAdmin, ctrl.autoAssignOrders);
router.post('/dispatch/simulate', authenticateAdmin, ctrl.simulateAutoAssign);
router.post('/dispatch/manual-order', authenticateAdmin, ctrl.createManualOrder);
router.get('/dispatch/auto-assign/rules', authenticateAdmin, ctrl.getAutoAssignRules);
router.put('/dispatch/auto-assign/rules', authenticateAdmin, ctrl.updateAutoAssignRule);
router.get('/dispatch/group-delivery', authenticateAdmin, ctrl.listGroupDeliveryOrders);
router.get('/dispatch/group-delivery/filter-options', authenticateAdmin, ctrl.getGroupDeliveryFilterOptions);
router.get('/dispatch/group-orders', authenticateAdmin, ctrl.groupOrders);
router.post('/dispatch/cluster-metrics', authenticateAdmin, ctrl.computeClusterMetrics);
router.get('/dispatch/clusters', authenticateAdmin, ctrl.listClusters);
router.post('/dispatch/clusters', authenticateAdmin, ctrl.saveClusters);
router.delete('/dispatch/clusters/:clusterId', authenticateAdmin, ctrl.deleteCluster);
router.post('/dispatch/clusters/:clusterId/assign', authenticateAdmin, ctrl.assignCluster);
router.put('/dispatch/clusters/:clusterId/orders', authenticateAdmin, ctrl.updateClusterOrders);

// ─── Audit ────────────────────────────────────────────────────────────────────
router.get('/audit/logs', authenticateAdmin, ctrl.listAuditLogs);

// ─── Fleet ────────────────────────────────────────────────────────────────────
router.get('/fleet/summary', authenticateAdmin, ctrl.getFleetSummary);
router.get('/fleet/vehicles', authenticateAdmin, ctrl.listVehicles);
router.post('/fleet/vehicles', authenticateAdmin, ctrl.createVehicle);
router.get('/fleet/vehicles/:vehicleId', authenticateAdmin, ctrl.getVehicleById);
router.put('/fleet/vehicles/:vehicleId', authenticateAdmin, ctrl.updateVehicle);
router.get('/fleet/maintenance', authenticateAdmin, ctrl.listMaintenanceTasks);
router.post('/fleet/maintenance', authenticateAdmin, ctrl.createMaintenanceTask);
router.get('/fleet/maintenance/:taskId', authenticateAdmin, ctrl.getMaintenanceTaskById);
router.put('/fleet/maintenance/:taskId', authenticateAdmin, ctrl.updateMaintenanceTask);
router.get('/fleet', authenticateAdmin, ctrl.listVehicles);
router.post('/fleet', authenticateAdmin, ctrl.createVehicle);
router.put('/fleet/:vehicleId', authenticateAdmin, ctrl.updateVehicle);
router.delete('/fleet/:vehicleId', authenticateAdmin, ctrl.deleteVehicle);

// Rider-app facing shift routes — locked to admin tokens. The rider app uses
// `/api/v1/picker/shifts/*`; these `/rider/shifts/*` paths previously accepted
// an unauthenticated `riderId` from the body/query (gap A2).
router.get('/shifts/available/list', authenticateAdmin, ctrl.listAvailableShiftsForRider);
router.get('/shifts/my', authenticateAdmin, ctrl.getMyShiftsForRider);
router.post('/shifts/select', authenticateAdmin, ctrl.selectShiftForRider);
router.post('/shifts/cancel', authenticateAdmin, ctrl.cancelShiftForRider);
router.post('/shifts/start', authenticateAdmin, ctrl.startShiftForRider);
router.post('/shifts/end', authenticateAdmin, ctrl.endShiftForRider);

// ─── Rider order routes ───────────────────────────────────────────────────────
router.get('/orders', authenticateAdmin, ctrl.listRiderOrders);
router.post('/orders/:orderId/assign', authenticateAdmin, ctrl.assignRiderOrder);
router.post('/orders/:orderId/alert', authenticateAdmin, ctrl.alertRiderOrder);

// ─── Shifts ───────────────────────────────────────────────────────────────────
router.get('/shifts', authenticateAdmin, ctrl.listShifts);
router.get('/shifts/filter-options', authenticateAdmin, ctrl.getShiftFilterOptions);
router.post('/shifts', authenticateAdmin, ctrl.createShift);
router.get('/shifts/:shiftId', authenticateAdmin, ctrl.getShiftById);
router.put('/shifts/:shiftId', authenticateAdmin, ctrl.updateShift);
router.delete('/shifts/:shiftId', authenticateAdmin, ctrl.deleteShift);
router.get('/shifts/:shiftId/assignments', authenticateAdmin, ctrl.getShiftAssignments);
router.post('/shifts/:shiftId/assign', authenticateAdmin, ctrl.adminAssignRiderToShift);
router.post('/shifts/:shiftId/unassign', authenticateAdmin, ctrl.adminUnassignRiderFromShift);
router.delete('/shifts/:shiftId/assignments/:riderId', authenticateAdmin, ctrl.adminUnassignRiderFromShift);

// ─── Compliance ───────────────────────────────────────────────────────────────
router.get('/compliance', authenticateAdmin, ctrl.listCompliance);
router.get('/compliance/:riderId', authenticateAdmin, ctrl.getRiderCompliance);
router.post('/compliance/:riderId/suspend', authenticateAdmin, ctrl.suspendRider);
router.post('/compliance/:riderId/unsuspend', authenticateAdmin, ctrl.unsuspendRider);

// ─── Contracts ────────────────────────────────────────────────────────────────
router.get('/contracts', authenticateAdmin, ctrl.listContracts);
router.get('/contracts/:riderId', authenticateAdmin, ctrl.getRiderContract);
router.post('/contracts/:riderId/renew', authenticateAdmin, ctrl.renewContract);
router.post('/contracts/:riderId/terminate', authenticateAdmin, ctrl.terminateContract);

// ─── HR ───────────────────────────────────────────────────────────────────────
router.get('/hr/dashboard/summary', authenticateAdmin, ctrl.getHRDashboardSummary);
router.get('/hr/documents', authenticateAdmin, ctrl.listDocuments);
router.get('/hr/documents/:documentId', authenticateAdmin, ctrl.getDocumentById);
router.put('/hr/documents/:documentId', authenticateAdmin, ctrl.reviewDocument);
router.get('/hr/documents/:documentId/download', authenticateAdmin, ctrl.downloadDocument);
router.get('/hr/documents/:documentId/rejection-reason', authenticateAdmin, ctrl.getDocumentRejectionReason);
router.get('/hr/documents/:documentId/history', authenticateAdmin, ctrl.getDocumentHistory);
router.get('/hr/training', authenticateAdmin, ctrl.listTraining);
router.put('/hr/training/:riderId', authenticateAdmin, ctrl.markTrainingCompleted);
router.get('/hr/access', authenticateAdmin, ctrl.listRiderAccess);
router.put('/hr/access/:riderId', authenticateAdmin, ctrl.updateRiderAccess);
router.post('/hr/devices/:riderId', authenticateAdmin, ctrl.assignDevice);
router.delete('/hr/devices/:riderId', authenticateAdmin, ctrl.unassignDevice);
router.get('/hr/compliance/alerts', authenticateAdmin, ctrl.listComplianceAlerts);
router.get('/hr/compliance/:riderId/suspension', authenticateAdmin, ctrl.getRiderSuspension);
router.put('/hr/compliance/:riderId/suspension', authenticateAdmin, ctrl.manageSuspension);
router.get('/hr/compliance/:riderId/violations', authenticateAdmin, ctrl.getRiderViolations);
router.get('/hr/contracts', authenticateAdmin, ctrl.listContracts);
router.get('/hr/contracts/:riderId', authenticateAdmin, ctrl.getRiderContract);
router.put('/hr/contracts/:riderId', authenticateAdmin, ctrl.updateContract);
router.post('/hr/contracts/:riderId/renew', authenticateAdmin, ctrl.renewContract);
router.post('/hr/contracts/:riderId/terminate', authenticateAdmin, ctrl.terminateContract);
router.get('/hr/riders', authenticateAdmin, ctrl.listHRRiders);
router.post('/hr/riders', authenticateAdmin, ctrl.onboardRider);
router.get('/hr/riders/:riderId', authenticateAdmin, ctrl.getRiderHR);
router.put('/hr/riders/:riderId', authenticateAdmin, ctrl.updateRiderHR);
router.post('/hr/riders/:riderId/approve', authenticateAdmin, ctrl.approveOnboarding);
router.post('/hr/riders/:riderId/remind', authenticateAdmin, ctrl.sendRiderReminder);

// ─── Training ─────────────────────────────────────────────────────────────────
router.get('/training/:riderId', authenticateAdmin, ctrl.getRiderTraining);
router.post('/training/:riderId/modules/:moduleId/complete', authenticateAdmin, ctrl.markModuleComplete);

// ─── Kit ──────────────────────────────────────────────────────────────────────
router.get('/kit/config', ctrl.getKitConfig);
router.get('/kit/training-videos', ctrl.getKitTrainingVideos);
router.post('/kit/config', authenticateAdmin, ctrl.updateKitConfig);
router.post('/kit/training-videos', authenticateAdmin, ctrl.createKitTrainingVideo);
router.put('/kit/training-videos/:id', authenticateAdmin, ctrl.updateKitTrainingVideo);
router.delete('/kit/training-videos/:id', authenticateAdmin, ctrl.deleteKitTrainingVideo);

// ─── Dashboard Notifications ──────────────────────────────────────────────────
router.get('/notifications', authenticateAdmin, ctrl.listDashboardNotifications);
router.put('/notifications/:notificationId/read', authenticateAdmin, ctrl.markNotificationRead);
router.post('/notifications/read-all', authenticateAdmin, ctrl.markAllNotificationsRead);

// ─── Riders CRUD (mounted last to avoid shadowing specific paths) ─────────────
router.get('/distribution', authenticateAdmin, ctrl.getRiderDistribution);
router.get('/', authenticateAdmin, ctrl.listRiders);
router.post('/', authenticateAdmin, ctrl.createRider);
router.get('/:riderId', authenticateAdmin, ctrl.getRiderById);
router.put('/:riderId', authenticateAdmin, ctrl.updateRider);
router.get('/:riderId/location', authenticateAdmin, ctrl.getRiderLocation);
router.get('/:riderId/shifts', authenticateAdmin, ctrl.listRiderShifts);
router.get('/:riderId/compliance', authenticateAdmin, ctrl.getRiderCompliance);
router.get('/:riderId/contract', authenticateAdmin, ctrl.getRiderContract);
router.get('/:riderId/training', authenticateAdmin, ctrl.getRiderTraining);

export default router;
