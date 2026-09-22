import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import * as activityLogsController from './activity-logs.controller';

export const sessionsRouter = Router();
sessionsRouter.get('/', requirePermission(PERMISSIONS.COMPLIANCE_AUDIT_READ), activityLogsController.getSessions);
sessionsRouter.delete('/:id', requirePermission(PERMISSIONS.COMPLIANCE_AUDIT_READ), activityLogsController.revokeSession);

export const accessLogsRouter = Router();
accessLogsRouter.get('/', requirePermission(PERMISSIONS.COMPLIANCE_AUDIT_READ), activityLogsController.getAccessLogs);

export const auditLogsRouter = Router();
auditLogsRouter.get('/logs', requirePermission(PERMISSIONS.COMPLIANCE_AUDIT_READ), activityLogsController.listAuditLogs);
auditLogsRouter.get('/logs/stats', requirePermission(PERMISSIONS.COMPLIANCE_AUDIT_READ), activityLogsController.getAuditLogStats);
auditLogsRouter.get('/logs/:id', requirePermission(PERMISSIONS.COMPLIANCE_AUDIT_READ), activityLogsController.getAuditLog);
