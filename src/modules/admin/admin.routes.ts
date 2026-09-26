import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateAdmin, requireRole, requirePermission, requirePermissionWhenMutating } from '../../middleware/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import * as authController from './admin-auth.controller';
import * as usersController from './admin-users.controller';
import * as rolesController from './roles.controller';
import * as permissionsController from './permissions.controller';
import * as masterDataController from './master-data.controller';
import * as riderCtrl from './rider-master-data.controller';
import * as supportCtrl from './admin-support.controller';
import * as customersCtrl from './admin-customers.controller';
import * as pickerCtrl from '../picker/picker.controller';
import * as trainingVideosCtrl from './admin-training-videos.controller';
import * as pickerConfigCtrl from './admin-picker-config.controller';
import * as pickerActionLogsCtrl from './admin-picker-action-logs.controller';
import * as adminOrdersCtrl from './admin-orders.controller';
import masterDataRoutes from './master-data.routes';
import storeWarehouseRoutes from './store-warehouse.routes';
import storeWarehouseSubRoutes from './store-warehouse-sub.routes';
import integrationRoutes from './integration.routes';
import platformConfigRoutes from './platform-config.routes';
import appSettingsRoutes from './app-settings.routes';
import systemConfigRoutes from './system-config.routes';
import complianceRoutes from './compliance.routes';
import fraudRoutes from './fraud.routes';
import notificationCampaignRoutes from './notification-campaign.routes';
import analyticsRoutes from './analytics.routes';
import deliveryStallsRoutes from '../delivery-stalls/ops.routes';
import deliveryAdminRoutes from '../delivery/delivery-admin.routes';
import opsFlowRoutes from './ops-flow.routes';
import { sessionsRouter, accessLogsRouter, auditLogsRouter } from './activity-logs.routes';
import {
  adminLoginSchema,
  createUserSchema,
  updateUserSchema,
  assignRoleSchema,
  resetPasswordSchema,
  bulkUserActionSchema,
  sendCreateUserOtpSchema,
  verifyCreateUserOtpSchema,
  createRoleSchema,
  updateRoleSchema,
  createRoleFromTemplateSchema,
  updateRoleMatrixSchema,
  importRoleConfigSchema,
  createPermissionSchema,
  updatePermissionSchema,
} from './admin.validation';

// --- Auth (login/logout) — no JWT required, matches legacy admin/routes/index.js -------
const authRouter = Router();
authRouter.post('/login', validate(adminLoginSchema), authController.login);
authRouter.post('/logout', authController.logout);

// --- Users -------------------------------------------------------------------------------
const usersRouter = Router();
// Managers list (for Master Data dropdowns) — must be before /:id, matches legacy mount.
usersRouter.get('/managers', requirePermission(PERMISSIONS.ADMIN_USERS_READ), masterDataController.listManagers);
usersRouter.get('/me', usersController.getCurrentUserProfile);
usersRouter.get('/', requirePermission(PERMISSIONS.ADMIN_USERS_READ), usersController.getUsers);
usersRouter.get('/:id', requirePermission(PERMISSIONS.ADMIN_USERS_READ), usersController.getUserById);
usersRouter.post('/bulk', requirePermission(PERMISSIONS.ADMIN_USERS_WRITE), validate(bulkUserActionSchema), usersController.bulkUserAction);
usersRouter.post(
  '/verification/send-otp',
  requirePermission(PERMISSIONS.ADMIN_USERS_WRITE),
  validate(sendCreateUserOtpSchema),
  usersController.sendCreateUserOtp,
);
usersRouter.post(
  '/verification/verify-otp',
  requirePermission(PERMISSIONS.ADMIN_USERS_WRITE),
  validate(verifyCreateUserOtpSchema),
  usersController.verifyCreateUserOtp,
);
usersRouter.post('/', requirePermission(PERMISSIONS.ADMIN_USERS_WRITE), validate(createUserSchema), usersController.createUser);
usersRouter.put('/:id/reset-password', requirePermission(PERMISSIONS.ADMIN_USERS_WRITE), validate(resetPasswordSchema), usersController.resetPassword);
usersRouter.put('/:id', requirePermission(PERMISSIONS.ADMIN_USERS_WRITE), validate(updateUserSchema), usersController.updateUser);
usersRouter.delete('/:id', requirePermission(PERMISSIONS.ADMIN_USERS_WRITE), usersController.deleteUser);
usersRouter.put('/:id/role', requirePermission(PERMISSIONS.ADMIN_ROLES_WRITE), validate(assignRoleSchema), usersController.assignRole);

// --- Roles -------------------------------------------------------------------------------
const rolesRouter = Router();
rolesRouter.get('/', requirePermission(PERMISSIONS.ADMIN_ROLES_READ), rolesController.getRoles);
rolesRouter.get('/templates', requirePermission(PERMISSIONS.ADMIN_ROLES_READ), rolesController.getRoleTemplates);
rolesRouter.get('/:id', requirePermission(PERMISSIONS.ADMIN_ROLES_READ), rolesController.getRoleById);
rolesRouter.get('/:id/export', requirePermission(PERMISSIONS.ADMIN_ROLES_READ), rolesController.exportRoleConfig);
rolesRouter.post('/', requirePermission(PERMISSIONS.ADMIN_ROLES_WRITE), validate(createRoleSchema), rolesController.createRole);
rolesRouter.post('/from-template', requirePermission(PERMISSIONS.ADMIN_ROLES_WRITE), validate(createRoleFromTemplateSchema), rolesController.createRoleFromTemplate);
rolesRouter.post('/import', requirePermission(PERMISSIONS.ADMIN_ROLES_WRITE), validate(importRoleConfigSchema), rolesController.importRoleConfig);
rolesRouter.put('/:id', requirePermission(PERMISSIONS.ADMIN_ROLES_WRITE), validate(updateRoleSchema), rolesController.updateRole);
rolesRouter.put('/:id/matrix', requirePermission(PERMISSIONS.ADMIN_ROLES_WRITE), validate(updateRoleMatrixSchema), rolesController.updateRoleMatrix);
rolesRouter.delete('/:id', requirePermission(PERMISSIONS.ADMIN_ROLES_WRITE), rolesController.deleteRole);

// --- Permissions -------------------------------------------------------------------------
const permissionsRouter = Router();
permissionsRouter.get('/', requirePermission(PERMISSIONS.ADMIN_ROLES_READ), permissionsController.getPermissions);
permissionsRouter.get('/matrix', requirePermission(PERMISSIONS.ADMIN_ROLES_READ), permissionsController.getPermissionsMatrix);
permissionsRouter.get('/:id', requirePermission(PERMISSIONS.ADMIN_ROLES_READ), permissionsController.getPermissionById);
permissionsRouter.post('/', requirePermission(PERMISSIONS.ADMIN_ROLES_WRITE), validate(createPermissionSchema), permissionsController.createPermission);
permissionsRouter.put('/:id', requirePermission(PERMISSIONS.ADMIN_ROLES_WRITE), validate(updatePermissionSchema), permissionsController.updatePermission);
permissionsRouter.delete('/:id', requirePermission(PERMISSIONS.ADMIN_ROLES_WRITE), permissionsController.deletePermission);

// --- Top-level admin router, matches legacy mount at /api/v1/admin -----------------------
const router = Router();
router.use('/auth', authRouter);

/** Console roles that may enter the admin API; fine-grained gates use requirePermission. */
const DASHBOARD_CONSOLE_ROLES = [
  'admin',
  'super_admin',
  'darkstore',
  'dark_store_manager',
  'store_manager',
  'warehouse',
  'warehouse_manager',
  'finance',
  'finance_admin',
  'rider',
  'rider_manager',
  'vendor',
  'production',
  'merch',
  'operations_admin',
  'operations',
  'customer_support',
  'catalog_manager',
  'catalog',
  'support',
] as const;

const protectedRouter = Router();
protectedRouter.use(authenticateAdmin, requireRole(...DASHBOARD_CONSOLE_ROLES));
protectedRouter.use('/users', usersRouter);
protectedRouter.use('/roles', rolesRouter);
protectedRouter.use('/permissions', permissionsRouter);
// Mounted at root, matching legacy `protectedRouter.use('/', masterDataRoutes)` /
// `protectedRouter.use('/', storeWarehouseRoutes)` — no requirePermission beyond the
// role check above, same as legacy (these routes had no fine-grained permission gate).
protectedRouter.use('/', masterDataRoutes);
protectedRouter.use('/', storeWarehouseRoutes);
protectedRouter.use('/store-warehouse', storeWarehouseSubRoutes);
protectedRouter.use('/integrations', integrationRoutes);
protectedRouter.use('/sessions', sessionsRouter);
protectedRouter.use('/access-logs', accessLogsRouter);
protectedRouter.use('/audit', auditLogsRouter);
protectedRouter.use('/platform-config', platformConfigRoutes);
protectedRouter.use('/app-settings', appSettingsRoutes);
protectedRouter.use('/system', systemConfigRoutes);
protectedRouter.use('/compliance', complianceRoutes);
protectedRouter.use('/fraud', fraudRoutes);
protectedRouter.use('/notifications', notificationCampaignRoutes);
protectedRouter.use('/analytics', analyticsRoutes);
protectedRouter.use('/', deliveryAdminRoutes);
protectedRouter.use('/', deliveryStallsRoutes);

// ─── Rider Master Data ────────────────────────────────────────────────────────
const riderMasterDataRouter = Router();
riderMasterDataRouter.get('/', riderCtrl.listRiders);
riderMasterDataRouter.get('/:id', riderCtrl.getRiderById);
riderMasterDataRouter.get('/:id/documents', riderCtrl.listRiderDocuments);
riderMasterDataRouter.patch('/:id/status', riderCtrl.updateRiderStatus);
protectedRouter.use('/riders', riderMasterDataRouter);

// ─── Support ──────────────────────────────────────────────────────────────────
const supportRouter = Router();
supportRouter.get('/tickets', supportCtrl.listTickets);
supportRouter.get('/tickets/:id', supportCtrl.getTicketById);
supportRouter.post('/tickets', supportCtrl.createTicket);
supportRouter.patch('/tickets/:id', supportCtrl.updateTicket);
supportRouter.post('/tickets/:id/assign', supportCtrl.assignTicket);
supportRouter.post('/tickets/:id/notes', supportCtrl.addTicketNote);
supportRouter.post('/tickets/:id/close', supportCtrl.closeTicket);
supportRouter.post('/tickets/:id/escalate', supportCtrl.escalateTicket);
supportRouter.post('/tickets/:id/refund', requirePermission(PERMISSIONS.ORDERS_REFUND), supportCtrl.refundTicket);
supportRouter.post('/tickets/:id/redelivery', supportCtrl.redeliveryTicket);
supportRouter.get('/agents', supportCtrl.listAgents);
supportRouter.get('/categories', supportCtrl.listCategories);
supportRouter.get('/canned-responses', supportCtrl.listCannedResponses);
supportRouter.get('/sla-metrics', supportCtrl.getSlaMetrics);
supportRouter.get('/live-chats', supportCtrl.listLiveChats);
supportRouter.post('/live-chats/:id/accept', supportCtrl.acceptLiveChat);
supportRouter.post('/live-chats/:id/messages', supportCtrl.sendLiveChatMessage);
supportRouter.get('/faqs', supportCtrl.listFaqs);
supportRouter.post('/faqs', supportCtrl.createFaq);
supportRouter.patch('/faqs/:id', supportCtrl.updateFaq);
supportRouter.delete('/faqs/:id', supportCtrl.deleteFaq);
supportRouter.get('/feedback', supportCtrl.listFeedback);
protectedRouter.use('/support', supportRouter);

// ─── Customers ────────────────────────────────────────────────────────────────
const customersRouter = Router();
customersRouter.post('/', customersCtrl.createCustomer);
customersRouter.get('/', customersCtrl.listCustomers);
customersRouter.get('/stats', customersCtrl.getCustomerStats);
customersRouter.get('/:id', customersCtrl.getCustomerById);
customersRouter.patch('/:id', customersCtrl.updateCustomer);
customersRouter.get('/:id/orders', customersCtrl.getCustomerOrders);
customersRouter.get('/:id/refunds', customersCtrl.getCustomerRefunds);
customersRouter.get('/:id/tickets', customersCtrl.getCustomerTickets);
customersRouter.get('/:id/risk', customersCtrl.getCustomerRisk);
customersRouter.get('/:id/wallet', customersCtrl.getCustomerWallet);
customersRouter.post('/:id/wallet/credit', requirePermission(PERMISSIONS.PAYMENTS_REFUND), customersCtrl.creditCustomerWallet);
customersRouter.get('/:id/addresses', customersCtrl.getCustomerAddresses);
customersRouter.get('/:id/payment-methods', customersCtrl.getCustomerPaymentMethods);
customersRouter.get('/:id/password-info', customersCtrl.getCustomerPasswordInfo);
customersRouter.put('/:id/reset-password', requirePermission(PERMISSIONS.ADMIN_USERS_WRITE), customersCtrl.resetCustomerPassword);
customersRouter.put('/:id/set-password', requirePermission(PERMISSIONS.ADMIN_USERS_WRITE), customersCtrl.setCustomerPassword);
protectedRouter.use('/customers', customersRouter);

// ─── Admin Orders ─────────────────────────────────────────────────────────────
const adminOrdersRouter = Router();
adminOrdersRouter.get('/', adminOrdersCtrl.listAdminOrders);
adminOrdersRouter.get('/:id/logs', adminOrdersCtrl.getAdminOrderLogs);
adminOrdersRouter.get('/:id', adminOrdersCtrl.getAdminOrder);
adminOrdersRouter.post('/', adminOrdersCtrl.placeOrderOnBehalf);
protectedRouter.use('/orders', adminOrdersRouter);

// ─── Picker Ops ───────────────────────────────────────────────────────────────
// `/api/v1/admin/picker/*` is served by pickerAdminRouter (src/modules/picker/
// picker.routes.ts), which holds the real implementations. This module must NOT
// register anything under /picker: app.ts mounts adminRoutes before
// pickerAdminRouter, so any route here wins and shadows the real handler.

// Legacy path alias: /pickers/* → the same handlers as /picker/pickers/*.
const pickerApprovalsAlias = Router();
pickerApprovalsAlias.get('/', pickerCtrl.adminListPickers);
pickerApprovalsAlias.get('/:id', pickerCtrl.adminGetPickerById);
pickerApprovalsAlias.patch('/:id', pickerCtrl.adminUpdatePickerStatus);
pickerApprovalsAlias.get('/:id/documents', pickerCtrl.adminListPickerDocuments);
pickerApprovalsAlias.get('/:id/action-logs', pickerCtrl.adminGetPickerActionLogs);
pickerApprovalsAlias.get('/:id/training-progress', pickerCtrl.adminGetPickerTrainingProgress);
pickerApprovalsAlias.get('/:id/face-verification', pickerCtrl.adminGetFaceVerification);
pickerApprovalsAlias.post('/:id/link-hhd', pickerCtrl.adminLinkHHD);
pickerApprovalsAlias.delete('/:id/link-hhd', pickerCtrl.adminUnlinkHHD);
pickerApprovalsAlias.patch('/:id/documents/review', pickerCtrl.adminReviewDocument);
pickerApprovalsAlias.patch('/:id/bank/:accountId/review', pickerCtrl.adminReviewBankAccount);
pickerApprovalsAlias.patch('/:id/face-verification/override', pickerCtrl.adminOverrideFaceVerification);
protectedRouter.use('/pickers', pickerApprovalsAlias);

// ─── Training Videos ──────────────────────────────────────────────────────────
const trainingVideosRouter = Router();
trainingVideosRouter.get('/', trainingVideosCtrl.listTrainingVideos);
trainingVideosRouter.get('/picker-progress', trainingVideosCtrl.getPickerProgress);
trainingVideosRouter.get('/:id', trainingVideosCtrl.getTrainingVideoById);
trainingVideosRouter.post('/', trainingVideosCtrl.createTrainingVideo);
trainingVideosRouter.put('/:id', trainingVideosCtrl.updateTrainingVideo);
trainingVideosRouter.delete('/:id', trainingVideosCtrl.deleteTrainingVideo);
protectedRouter.use('/training-videos', trainingVideosRouter);

// ─── Picker Config ────────────────────────────────────────────────────────────
const pickerConfigRouter = Router();
pickerConfigRouter.get('/', pickerConfigCtrl.getPickerConfig);
pickerConfigRouter.put('/', pickerConfigCtrl.updatePickerConfig);
protectedRouter.use('/picker-config', pickerConfigRouter);

// ─── Picker Action Logs ───────────────────────────────────────────────────────
const pickerActionLogsRouter = Router();
pickerActionLogsRouter.get('/', pickerActionLogsCtrl.listPickerActionLogs);
protectedRouter.use('/picker-action-logs', pickerActionLogsRouter);

// ─── System Tools (server-status, instances, logs, perf, cache, endpoints, migrations) ──────────────────
protectedRouter.get('/system/server-status', requirePermission(PERMISSIONS.ADMIN_CONFIG_READ), async (_req, res, next) => {
  try { res.json({ success: true, data: { uptime: process.uptime(), memory: process.memoryUsage(), pid: process.pid, version: process.version, ts: new Date().toISOString() } }); } catch (err) { next(err); }
});
protectedRouter.get('/system/instances', requirePermission(PERMISSIONS.ADMIN_CONFIG_READ), (_req, res) => {
  res.status(501).json({ success: false, message: 'Process instances are not implemented', error: { appCode: 'NOT_IMPLEMENTED', feature: 'system.instances' } });
});
protectedRouter.post('/system/instances/:id/restart', requirePermission(PERMISSIONS.ADMIN_CONFIG_WRITE), async (req, res, next) => {
  try {
    const { completeOpsAction } = await import('../../utils/ops-store');
    await completeOpsAction(req, res, `Instance restart ${req.params.id}`, { pid: process.pid, requested: true });
  } catch (err) { next(err); }
});
protectedRouter.get('/system/logs', requirePermission(PERMISSIONS.ADMIN_CONFIG_READ), (_req, res) => {
  res.status(501).json({ success: false, message: 'System logs are not implemented', error: { appCode: 'NOT_IMPLEMENTED', feature: 'system.logs' } });
});
protectedRouter.get('/system/performance', requirePermission(PERMISSIONS.ADMIN_CONFIG_READ), async (_req, res, next) => {
  try { res.json({ success: true, data: { memory: process.memoryUsage(), cpuUsage: process.cpuUsage(), uptime: process.uptime() } }); } catch (err) { next(err); }
});
protectedRouter.get('/system/api-endpoints', requirePermission(PERMISSIONS.ADMIN_CONFIG_READ), (_req, res) => {
  res.status(501).json({ success: false, message: 'API endpoint inventory is not implemented', error: { appCode: 'NOT_IMPLEMENTED', feature: 'system.api-endpoints' } });
});
protectedRouter.get('/system/migrations', requirePermission(PERMISSIONS.ADMIN_CONFIG_READ), (_req, res) => {
  res.status(501).json({ success: false, message: 'Migration status is not implemented', error: { appCode: 'NOT_IMPLEMENTED', feature: 'system.migrations' } });
});
protectedRouter.get('/system/cache/stats', requirePermission(PERMISSIONS.ADMIN_CONFIG_READ), async (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        hits: null,
        misses: null,
        keys: null,
        memoryUsage: process.memoryUsage().heapUsed,
        backend: 'in-memory',
        note: 'Hit/miss counters are not tracked by the in-memory cache',
        ts: new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
});
protectedRouter.post('/system/cache/clear', requirePermission(PERMISSIONS.ADMIN_CONFIG_WRITE), async (_req, res, next) => {
  try {
    const { cacheService } = await import('../../utils/cache');
    const cleared = await cacheService.delPattern('*');
    res.json({ success: true, message: 'Cache cleared', cleared });
  } catch (err) { next(err); }
});

// ─── Cache ────────────────────────────────────────────────────────────────────
const cacheRouter = Router();
cacheRouter.get('/stats', requirePermission(PERMISSIONS.ADMIN_CONFIG_READ), async (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        hits: null,
        misses: null,
        keys: null,
        memoryUsage: process.memoryUsage().heapUsed,
        backend: 'in-memory',
        ts: new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
});
cacheRouter.post('/clear', requirePermission(PERMISSIONS.ADMIN_CONFIG_WRITE), async (_req, res, next) => {
  try {
    const { cacheService } = await import('../../utils/cache');
    const cleared = await cacheService.delPattern('*');
    res.json({ success: true, message: 'Cache cleared', cleared });
  } catch (err) { next(err); }
});
protectedRouter.use('/cache', cacheRouter);

// ─── Applications ─────────────────────────────────────────────────────────────
const applicationsRouter = Router();
applicationsRouter.use(requirePermission(PERMISSIONS.ADMIN_CONFIG_READ));
applicationsRouter.use(requirePermissionWhenMutating(PERMISSIONS.ADMIN_CONFIG_WRITE));
applicationsRouter.use((_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Application registry is not implemented',
    error: { appCode: 'NOT_IMPLEMENTED', feature: 'applications' },
  });
});
protectedRouter.use('/applications', applicationsRouter);

protectedRouter.use('/ops', opsFlowRoutes);

router.use(protectedRouter);

export default router;
