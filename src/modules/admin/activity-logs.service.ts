import { AuditLogModel } from '../../services/audit.service';
import { AdminDirectoryUser } from './admin-directory.model';
import { AppError } from '../../utils/AppError';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Sessions (AuditLog-based; JWT is stateless, so "revoke" is a logged event) -----------

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

function parseExpiryToMs(expiry: string): number {
  const match = String(expiry || '1h').trim().match(/^(\d+)([smhd])$/i);
  if (!match) return 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return n * (multipliers[unit] || 60 * 60 * 1000);
}
const SESSION_TTL_MS = parseExpiryToMs(JWT_EXPIRES_IN);

export async function getSessions(userId?: string, limit = 50) {
  const limitNum = Math.min(limit, 100);
  const query: Record<string, unknown> = { module: 'auth', action: 'login_success' };
  if (userId) query.userId = userId;

  const logs = await AuditLogModel.find(query).sort({ createdAt: -1 }).limit(limitNum).populate('userId', 'name email').lean();

  const sessionIds = logs.map((log: any) => String(log._id));
  const revokedIds = new Set<string>();

  if (sessionIds.length > 0) {
    const revokedLogs = await AuditLogModel.find({
      module: 'auth',
      action: 'session_revoked',
      $or: [{ entityId: { $in: sessionIds } }, { 'details.revokedSessionId': { $in: sessionIds } }],
    })
      .select('entityId details')
      .lean();
    revokedLogs.forEach((entry: any) => {
      if (entry.entityId) revokedIds.add(String(entry.entityId));
      if (entry.details?.revokedSessionId) revokedIds.add(String(entry.details.revokedSessionId));
    });
  }

  const now = Date.now();
  return logs.map((log: any) => {
    const user = log.userId;
    const ua = log.userAgent || '';
    let deviceType = 'desktop';
    if (/mobile|android|iphone|ipad/i.test(ua)) deviceType = 'mobile';
    else if (/laptop|macintosh|windows/i.test(ua)) deviceType = 'laptop';

    const id = String(log._id);
    const loginAt = log.createdAt ? new Date(log.createdAt).getTime() : now;
    const isRevoked = revokedIds.has(id);
    const withinTokenTtl = now - loginAt <= SESSION_TTL_MS;
    const status = !isRevoked && withinTokenTtl ? 'active' : 'inactive';

    return {
      id,
      userId: user?._id?.toString() || log.userId?.toString() || '',
      userName: user?.name || 'Unknown',
      userEmail: user?.email || log.details?.email || '—',
      device: ua || 'Unknown',
      deviceType,
      ipAddress: log.ipAddress || '—',
      location: '—',
      lastActivity: log.createdAt?.toISOString() || new Date().toISOString(),
      status,
    };
  });
}

export async function revokeSession(sessionId: string, actorId?: string, actorLabel?: string, reason?: string, ip?: string, userAgent?: string) {
  const now = new Date();
  await AuditLogModel.create({
    module: 'auth',
    action: 'session_revoked',
    entityType: 'session',
    entityId: String(sessionId),
    userId: actorId || undefined,
    severity: 'warning',
    details: { revokedSessionId: String(sessionId), reason: reason || 'Revoked from admin dashboard', revokedBy: actorLabel || 'admin' },
    ipAddress: ip,
    userAgent,
    createdAt: now,
  });
  return { id: String(sessionId), status: 'inactive', revokedAt: now.toISOString() };
}

// --- Access logs -----------------------------------------------------------------------------

const ACTION_MAP: Record<string, string> = {
  login_success: 'login',
  login_failure: 'failed_login',
  user_create: 'update_user',
  user_update: 'update_user',
  user_delete: 'update_user',
  role_assign: 'assign_role',
  permissions_update: 'update_permissions',
  user_suspend: 'suspend_user',
  picker_approved: 'picker_approved',
  picker_rejected: 'picker_rejected',
  picker_blocked: 'picker_blocked',
  picker_unblocked: 'picker_unblocked',
  order_cancelled: 'order_cancelled',
  device_assigned: 'device_assigned',
  device_returned: 'device_returned',
};

export interface AccessLogFilter {
  userId?: string;
  action?: string;
  status?: 'failed' | 'success';
  startDate?: string;
  endDate?: string;
  page?: string | number;
  limit?: string | number;
}

export async function getAccessLogs(filter: AccessLogFilter) {
  const conditions: Record<string, unknown>[] = [{ module: { $in: ['auth', 'admin'] } }];
  if (filter.userId) conditions.push({ userId: filter.userId });
  if (filter.action) {
    const backendActions = Object.entries(ACTION_MAP).filter(([, front]) => front === filter.action).map(([back]) => back);
    if (backendActions.length > 0) conditions.push({ action: { $in: backendActions } });
  }
  if (filter.status === 'failed') {
    conditions.push({ $or: [{ action: 'login_failure' }, { severity: { $in: ['error', 'critical'] } }] });
  } else if (filter.status === 'success') {
    conditions.push({ action: { $ne: 'login_failure' } });
    conditions.push({ severity: { $nin: ['error', 'critical'] } });
  }
  if (filter.startDate || filter.endDate) {
    const createdAt: Record<string, Date> = {};
    if (filter.startDate) createdAt.$gte = new Date(filter.startDate);
    if (filter.endDate) createdAt.$lte = new Date(filter.endDate);
    conditions.push({ createdAt });
  }

  const query = conditions.length > 1 ? { $and: conditions } : conditions[0];

  const page = parseInt(String(filter.page ?? 1), 10) || 1;
  const limit = parseInt(String(filter.limit ?? 50), 10) || 50;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userId', 'name email').lean(),
    AuditLogModel.countDocuments(query),
  ]);

  const data = logs.map((log: any) => {
    const user = log.userId;
    const frontendAction = ACTION_MAP[log.action] || log.action;
    const logStatus = log.action === 'login_failure' || ['error', 'critical'].includes(log.severity) ? 'failed' : 'success';
    const details = typeof log.details === 'object' ? JSON.stringify(log.details) : log.details || '';
    return {
      id: String(log._id),
      timestamp: log.createdAt?.toISOString() || new Date().toISOString(),
      userId: log.userId ? user?._id?.toString() || log.userId.toString() : 'unknown',
      userName: user?.name || 'Unknown',
      userEmail: user?.email || log.details?.email || '—',
      action: frontendAction,
      details,
      status: logStatus,
      ipAddress: log.ipAddress,
      browser: log.userAgent,
    };
  });

  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

// --- Audit logs (dedicated /audit/logs viewer, richer detail shape than access-logs) -------

function transformAuditLog(log: any) {
  if (!log) return null;
  const userIdPop = log.userId;
  const userName = userIdPop?.name || 'System';
  const userEmail = userIdPop?.email || 'system@internal';
  const details = log.details || {};
  const description = typeof details === 'string' ? details : details.message || details.description || JSON.stringify(details);
  const changes = Array.isArray(details.changes) ? details.changes : [];
  const severity = log.severity === 'error' ? 'warning' : log.severity || 'info';

  return {
    id: log._id?.toString?.(),
    timestamp: log.createdAt?.toISOString?.() || new Date(log.createdAt).toISOString(),
    user: userName,
    userEmail,
    action: log.action || 'view',
    module: log.module || 'config',
    resource: log.entityType || details.entityType || 'N/A',
    resourceId: log.entityId || details.entityId,
    severity: ['info', 'warning', 'critical', 'success'].includes(severity) ? severity : 'info',
    description,
    ipAddress: log.ipAddress || 'N/A',
    userAgent: log.userAgent || '',
    changes: changes.length
      ? changes.map((c: any) => ({ field: c.field || c.key || 'field', oldValue: c.oldValue ?? c.before ?? '', newValue: c.newValue ?? c.after ?? '' }))
      : undefined,
    metadata: typeof details === 'object' && !Array.isArray(details) ? details : undefined,
  };
}

export interface AuditLogFilter {
  module?: string;
  action?: string;
  severity?: string;
  user?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: string | number;
  limit?: string | number;
}

export async function listAuditLogs(filter: AuditLogFilter) {
  const query: Record<string, unknown> = {};
  if (filter.module) query.module = filter.module;
  if (filter.action) query.action = filter.action;
  if (filter.severity) query.severity = filter.severity;

  const page = parseInt(String(filter.page ?? 1), 10) || 1;
  const limitNum = Math.min(parseInt(String(filter.limit ?? 50), 10) || 50, 100);

  if (filter.user?.trim()) {
    const esc = escapeRegex(filter.user.trim());
    const users = await AdminDirectoryUser.find({ email: new RegExp(esc, 'i') }).select('_id').lean();
    if (users.length > 0) {
      query.userId = { $in: users.map((u) => u._id) };
    } else {
      return { data: [], meta: { total: 0, page, limit: limitNum, pages: 0 } };
    }
  }

  if (filter.startDate || filter.endDate) {
    const createdAt: Record<string, Date> = {};
    if (filter.startDate) createdAt.$gte = new Date(filter.startDate);
    if (filter.endDate) {
      const end = new Date(filter.endDate);
      end.setHours(23, 59, 59, 999);
      createdAt.$lte = end;
    }
    query.createdAt = createdAt;
  }

  if (filter.search?.trim()) {
    const term = filter.search.trim();
    const orFilters: Record<string, unknown>[] = [
      { module: { $regex: term, $options: 'i' } },
      { action: { $regex: term, $options: 'i' } },
      { entityType: { $regex: term, $options: 'i' } },
      { entityId: { $regex: term, $options: 'i' } },
      { 'details.message': { $regex: term, $options: 'i' } },
      { 'details.description': { $regex: term, $options: 'i' } },
    ];
    const matchedUsers = await AdminDirectoryUser.find({ $or: [{ email: { $regex: term, $options: 'i' } }, { name: { $regex: term, $options: 'i' } }] })
      .select('_id')
      .lean();
    if (matchedUsers.length > 0) orFilters.push({ userId: { $in: matchedUsers.map((u) => u._id) } });
    query.$or = orFilters;
  }

  const skip = (page - 1) * limitNum;
  const [logs, total] = await Promise.all([
    AuditLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).populate('userId', 'name email').lean(),
    AuditLogModel.countDocuments(query),
  ]);

  return { data: logs.map(transformAuditLog), meta: { total, page, limit: limitNum, pages: Math.ceil(total / limitNum) || 1 } };
}

export async function getAuditLog(id: string) {
  const log = await AuditLogModel.findById(id).populate('userId', 'name email').lean();
  if (!log) throw AppError.notFound('Log', id);
  return transformAuditLog(log);
}

export async function getAuditLogStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalEvents, todayEvents, criticalEvents, distinctUsers, topActionAgg, topModuleAgg] = await Promise.all([
    AuditLogModel.countDocuments(),
    AuditLogModel.countDocuments({ createdAt: { $gte: today } }),
    AuditLogModel.countDocuments({ severity: 'critical' }),
    AuditLogModel.distinct('userId'),
    AuditLogModel.aggregate([{ $group: { _id: '$action', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }]),
    AuditLogModel.aggregate([{ $group: { _id: '$module', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }]),
  ]);

  return {
    totalEvents,
    todayEvents,
    criticalEvents,
    uniqueUsers: distinctUsers.length,
    topAction: topActionAgg[0]?._id || 'N/A',
    topModule: topModuleAgg[0]?._id || 'N/A',
  };
}
