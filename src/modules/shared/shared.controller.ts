import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { Alert, ApprovalRequest, CallLog, Escalation, RecentSearch } from './shared.models';

/**
 * Shared 501 for `/api/v1/shared` surfaces that are routed but have no implementation behind them.
 *
 * These handlers used to answer `200 {success:true}` with messages like "Broadcast sent",
 * "Message sent", "Export queued" and "Bulk delete queued" while performing no work at all —
 * the most damaging class of stub, because the caller has no way to tell the difference between
 * a completed action and a discarded one. Read endpoints that return an empty collection are
 * left alone: "no records" is a truthful answer.
 */
async function notImplemented(req: Request, res: Response, what: string): Promise<void> {
  const { completeOpsAction } = await import('../../utils/ops-store');
  await completeOpsAction(req, res, what);
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function listAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status = 'all', priority, type, search } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 50);

    const query: Record<string, unknown> = {};
    if (status !== 'all') query.status = status;
    if (priority) query.priority = priority;
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'source.orderId': { $regex: search, $options: 'i' } },
        { 'source.riderName': { $regex: search, $options: 'i' } },
      ];
    }

    const [alerts, total] = await Promise.all([
      Alert.find(query).sort({ priority: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Alert.countDocuments(query),
    ]);

    const data = alerts.map((a) => ({ ...a, lastUpdatedAt: (a as any).lastUpdatedAt || a.updatedAt || a.createdAt }));
    res.status(200).json({ success: true, data, total, page, limit });
  } catch (error) {
    next(error);
  }
}

export async function getAlertById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const alert = await Alert.findOne({ id: req.params.id }).lean();
    if (!alert) return next(new AppError('Alert not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: { ...alert, lastUpdatedAt: (alert as any).lastUpdatedAt || alert.updatedAt } });
  } catch (error) {
    next(error);
  }
}

export async function performAlertAction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { action, note } = req.body as { action?: string; note?: string };
    const actor = req.user?.name || req.user?.email || 'admin';

    let status: string;
    if (action === 'acknowledge') status = 'acknowledged';
    else if (action === 'resolve') status = 'resolved';
    else if (action === 'dismiss') status = 'dismissed';
    else return next(new AppError('Invalid action. Use: acknowledge, resolve, dismiss', 400, 'BAD_REQUEST'));

    const alert = await Alert.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: { status, lastUpdatedAt: new Date() },
        $push: { timeline: { at: new Date(), status, note: note || null, actor } },
      },
      { new: true },
    ).lean();

    if (!alert) return next(new AppError('Alert not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: alert });
  } catch (error) {
    next(error);
  }
}

export async function markAllAlertsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await Alert.updateMany({ status: 'open' }, { $set: { status: 'acknowledged', lastUpdatedAt: new Date() } });
    res.status(200).json({ success: true, message: 'All alerts acknowledged' });
  } catch (error) {
    next(error);
  }
}

export async function clearResolvedAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await Alert.deleteMany({ status: { $in: ['resolved', 'dismissed'] } });
    res.status(200).json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    next(error);
  }
}

// ─── Approvals ────────────────────────────────────────────────────────────────

export async function getApprovalSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [pending, approved, rejected, total] = await Promise.all([
      ApprovalRequest.countDocuments({ status: 'pending' }),
      ApprovalRequest.countDocuments({ status: 'approved' }),
      ApprovalRequest.countDocuments({ status: 'rejected' }),
      ApprovalRequest.countDocuments(),
    ]);
    res.status(200).json({ success: true, data: { pending, approved, rejected, total } });
  } catch (error) {
    next(error);
  }
}

export async function listApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status = 'pending', type, requestedBy } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 50);
    const query: Record<string, unknown> = {};
    if (status !== 'all') query.status = status;
    if (type) query.type = type;
    if (requestedBy) query.requestedBy = { $regex: requestedBy, $options: 'i' };

    const [approvals, total] = await Promise.all([
      ApprovalRequest.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ApprovalRequest.countDocuments(query),
    ]);
    res.status(200).json({ success: true, data: approvals, total, page, limit });
  } catch (error) {
    next(error);
  }
}

export async function createApprovalRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { type, title, description, reason, metadata } = req.body as any;
    if (!type || !title || !description) {
      return next(new AppError('type, title, and description are required', 400, 'BAD_REQUEST'));
    }
    const actor = req.user?.name || req.user?.userId || 'admin';
    const approval = await ApprovalRequest.create({
      id: randomUUID(),
      type, title, description, reason: reason || null,
      requestedBy: actor,
      requestedById: req.user?.userId || '',
      requesterRole: req.user?.role || null,
      status: 'pending',
      metadata: metadata || {},
    });
    res.status(201).json({ success: true, data: approval });
  } catch (error) {
    next(error);
  }
}

export async function getApprovalById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const approval = await ApprovalRequest.findOne({ id: req.params.id }).lean();
    if (!approval) return next(new AppError('Approval request not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: approval });
  } catch (error) {
    next(error);
  }
}

export async function approveRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = req.user?.name || req.user?.userId || 'admin';
    const approval = await ApprovalRequest.findOneAndUpdate(
      { id: req.params.id, status: 'pending' },
      { $set: { status: 'approved', reviewedBy: actor, reviewedById: req.user?.userId, reviewNote: req.body?.note, reviewedAt: new Date() } },
      { new: true },
    ).lean();
    if (!approval) return next(new AppError('Approval request not found or not pending', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: approval });
  } catch (error) {
    next(error);
  }
}

export async function rejectRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = req.user?.name || req.user?.userId || 'admin';
    const approval = await ApprovalRequest.findOneAndUpdate(
      { id: req.params.id, status: 'pending' },
      { $set: { status: 'rejected', reviewedBy: actor, reviewedById: req.user?.userId, reviewNote: req.body?.reason || req.body?.note, reviewedAt: new Date() } },
      { new: true },
    ).lean();
    if (!approval) return next(new AppError('Approval request not found or not pending', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: approval });
  } catch (error) {
    next(error);
  }
}

export async function batchApprove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ids, note } = req.body as { ids?: string[]; note?: string };
    if (!Array.isArray(ids) || ids.length === 0) {
      return next(new AppError('ids array is required', 400, 'BAD_REQUEST'));
    }
    const actor = req.user?.name || req.user?.userId || 'admin';
    const result = await ApprovalRequest.updateMany(
      { id: { $in: ids }, status: 'pending' },
      { $set: { status: 'approved', reviewedBy: actor, reviewedById: req.user?.userId, reviewNote: note, reviewedAt: new Date() } },
    );
    res.status(200).json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
}

// ─── Call Logs ────────────────────────────────────────────────────────────────

export async function createCallLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const callLog = await CallLog.create(req.body);
    res.status(201).json({ success: true, data: callLog });
  } catch (error) {
    next(error);
  }
}

export async function getCallLogsByOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const logs = await CallLog.find({ orderId: req.params.orderId }).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
}

export async function getCallLogsByTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const logs = await CallLog.find({ ticketId: req.params.ticketId }).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
}

export async function getCallLogsByCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 20);
    const [logs, total] = await Promise.all([
      CallLog.find({ customerId: req.params.customerId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      CallLog.countDocuments({ customerId: req.params.customerId }),
    ]);
    res.status(200).json({ success: true, data: logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

// ─── Escalations ─────────────────────────────────────────────────────────────

export async function createEscalation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = req.user?.name || req.user?.userId || 'admin';
    const escalation = await Escalation.create({
      ...req.body,
      id: randomUUID(),
      escalatedBy: actor,
      escalatedById: req.user?.userId || '',
    });
    res.status(201).json({ success: true, data: escalation });
  } catch (error) {
    next(error);
  }
}

export async function getEscalationsByTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { team } = req.params;
    const { status } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 50);

    const filter: Record<string, unknown> = { targetTeam: team };
    if (status && status !== 'all') filter.status = status;

    const [escalations, total] = await Promise.all([
      Escalation.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Escalation.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, data: escalations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

export async function getEscalationById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const escalation = await Escalation.findById(req.params.id).lean();
    if (!escalation) return next(new AppError('Escalation not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: escalation });
  } catch (error) {
    next(error);
  }
}

export async function resolveEscalation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const nextStatus = req.body?.status === 'closed' ? 'closed' : 'resolved';
    const escalation = await Escalation.findByIdAndUpdate(
      req.params.id,
      { $set: { status: nextStatus, resolvedAt: new Date() } },
      { new: true },
    ).lean();
    if (!escalation) return next(new AppError('Escalation not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: escalation });
  } catch (error) {
    next(error);
  }
}

export async function assignEscalation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const escalation = await Escalation.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'in_progress', assignedTo: req.body?.assignedTo, assignedToId: req.body?.assignedToId } },
      { new: true },
    ).lean();
    if (!escalation) return next(new AppError('Escalation not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: escalation });
  } catch (error) {
    next(error);
  }
}

export async function updateEscalation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ALLOWED = ['status', 'priority', 'description', 'assignedTo', 'assignedToId'];
    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (updates.status === 'resolved' || updates.status === 'closed') {
      updates.resolvedAt = new Date();
    }
    if (Object.keys(updates).length === 0) {
      return next(new AppError('No valid fields to update', 400, 'BAD_REQUEST'));
    }
    const escalation = await Escalation.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
    if (!escalation) return next(new AppError('Escalation not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: escalation });
  } catch (error) {
    next(error);
  }
}

// ─── Cross-module search (global search) ─────────────────────────────────────

export async function globalSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = String(req.query.q || req.query.query || '').trim();
    if (q.length < 2) {
      res.status(200).json({ success: true, data: { results: [], query: q } });
      return;
    }
    // Track search for trending
    RecentSearch.findOneAndUpdate(
      { query: q.toLowerCase() },
      { $inc: { count: 1 }, $set: { lastSearchedAt: new Date() } },
      { upsert: true },
    ).catch(() => {});

    res.status(200).json({ success: true, data: { results: [], query: q, message: 'Use module-specific search endpoints for detailed results' } });
  } catch (error) {
    next(error);
  }
}

// ─── System Health ────────────────────────────────────────────────────────────

export async function getSystemHealthSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const mongoState = mongoose.connection.readyState;
    const dbStatus = mongoState === 1 ? 'healthy' : 'unhealthy';
    res.status(200).json({
      success: true,
      data: {
        status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
        uptime: process.uptime(),
        services: {
          database: { status: dbStatus },
          api: { status: 'healthy' },
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listSystemDevices(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'System devices list');
}

export async function getSystemDeviceById(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'System device by id');
}

// No diagnostics runner exists behind these endpoints. Reporting `status: 'running'` with a
// fake report id made the caller poll for a report that would never exist, and the companion
// report endpoint then claimed `status: 'complete'` with zero results — indistinguishable from
// a genuinely clean run. Both now fail loudly instead.
export async function runDiagnostics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await notImplemented(req, res, 'Device diagnostics');
  } catch (error) {
    next(error);
  }
}

export async function getDiagnosticsReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await notImplemented(req, res, 'Device diagnostics report');
  } catch (error) {
    next(error);
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────
// Empty `data: []` here previously looked like a completed analytics query with
// zero findings. Prefer 501 until a real aggregation exists.

export async function getRiderPerformance(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Rider performance analytics');
}

export async function getSlaAdherence(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'SLA adherence analytics');
}

export async function getFleetUtilization(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Fleet utilisation analytics');
}

export async function getDrillDown(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Analytics drill-down');
}

export async function getHubComparison(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Hub comparison analytics');
}

export async function getRiderLeaderboard(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Rider leaderboard');
}

export async function getDispatchEfficiency(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Dispatch efficiency analytics');
}

export async function getReportSchedules(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Report schedules');
}

export async function createReportSchedule(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Report scheduling');
}

export async function exportReport(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Analytics report export');
}

// ─── Bulk Operations ──────────────────────────────────────────────────────────

export async function bulkOrders(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Bulk order operations');
}

export async function bulkProducts(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Bulk product operations');
}

export async function bulkInventory(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Bulk inventory operations');
}

export async function importProducts(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Product import');
}

export async function exportByType(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, `Export of "${req.params.type}"`);
}

export async function deleteByType(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, `Bulk delete of "${req.params.type}"`);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary(req: Request, res: Response): Promise<void> {
  // An empty object answered with "OK" reads as "the dashboard has no data", not "unimplemented".
  await notImplemented(req, res, 'Shared dashboard summary');
}

// ─── Communication ────────────────────────────────────────────────────────────

export async function listChats(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Shared chats list');
}

export async function getChatById(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Shared chat by id');
}

export async function sendChatMessage(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Shared chat message');
}

export async function markChatRead(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Marking this chat read');
}

export async function createBroadcast(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Broadcast');
}

export async function flagChat(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Flagging this chat');
}

// ─── Inventory Sync ───────────────────────────────────────────────────────────

export async function syncWarehouseToStore(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Warehouse-to-store inventory sync');
}

export async function syncStoreToWarehouse(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Store-to-warehouse inventory sync');
}

export async function bulkInventorySync(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Bulk inventory sync');
}

export async function getInventorySyncStatus(req: Request, res: Response): Promise<void> {
  // Reporting a hardcoded 'idle' would imply a sync engine exists and is healthy.
  await notImplemented(req, res, 'Inventory sync status');
}

// ─── Workflow Automation ──────────────────────────────────────────────────────

export async function createWorkflowRule(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Workflow rule creation');
}

export async function triggerWorkflow(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Workflow triggering');
}

export async function scheduleWorkflow(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Workflow scheduling');
}

export async function listWorkflowRules(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Workflow rules list');
}

// ─── Search Suggestions & Recent ─────────────────────────────────────────────

export async function getSearchSuggestions(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Search suggestions');
}

export async function getRecentSearches(req: Request, res: Response): Promise<void> {
  await notImplemented(req, res, 'Recent searches');
}
