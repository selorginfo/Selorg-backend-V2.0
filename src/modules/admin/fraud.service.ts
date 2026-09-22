import { FilterQuery } from 'mongoose';
import { AppError } from '../../utils/AppError';
import {
  FraudAlert,
  IFraudAlert,
  BlockedEntity,
  IBlockedEntity,
  FraudRule,
  IFraudRule,
  RiskProfile,
  IRiskProfile,
  FraudPattern,
  IFraudPattern,
  FraudInvestigation,
  IFraudInvestigation,
  Chargeback,
  IChargeback,
} from './fraud.model';

function toAlert(d: IFraudAlert) {
  return {
    id: d._id.toString(),
    alertNumber: d.alertNumber,
    type: d.type,
    severity: d.severity,
    status: d.status,
    customerId: d.customerId,
    customerName: d.customerName,
    customerEmail: d.customerEmail,
    description: d.description,
    detectedAt: d.createdAt,
    resolvedAt: d.resolvedAt,
    assignedTo: d.assignedTo?.toString(),
    riskScore: d.riskScore,
    evidence: (d.evidence || []).map((e) => ({
      id: e._id?.toString(),
      type: e.type,
      description: e.description,
      timestamp: e.timestamp,
      data: e.data,
    })),
    actions: d.actions || [],
    orderNumbers: d.orderNumbers || [],
    amountInvolved: d.amountInvolved,
    deviceId: d.deviceId,
    ipAddress: d.ipAddress,
    location: d.location,
  };
}

export interface ListAlertsFilter {
  status?: string;
  severity?: string;
  type?: string;
  page?: number;
  limit?: number;
}

export async function listAlerts(filter: ListAlertsFilter) {
  const { status, severity, type, page = 1, limit = 50 } = filter;
  const query: FilterQuery<IFraudAlert> = {};
  if (status && status !== 'all') query.status = status;
  if (severity && severity !== 'all') query.severity = severity;
  if (type && type !== 'all') query.type = type;

  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    FraudAlert.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    FraudAlert.countDocuments(query),
  ]);

  return { data: docs.map(toAlert), meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

export async function getAlert(id: string) {
  const doc = await FraudAlert.findById(id);
  if (!doc) throw AppError.notFound('Alert', id);
  return toAlert(doc);
}

export async function updateAlert(id: string, patch: Record<string, unknown>) {
  const doc = await FraudAlert.findByIdAndUpdate(id, patch, { new: true });
  if (!doc) throw AppError.notFound('Alert', id);
  return toAlert(doc);
}

function toBlockedEntity(d: IBlockedEntity) {
  return {
    id: d._id.toString(),
    type: d.type,
    value: d.value,
    reason: d.reason,
    blockedBy: d.blockedBy,
    blockedByName: d.blockedByName,
    blockedAt: d.createdAt,
    expiresAt: d.expiresAt,
    isPermanent: d.isPermanent,
    relatedAlerts: d.relatedAlerts || [],
    notes: d.notes,
  };
}

export async function listBlockedEntities() {
  const docs = await BlockedEntity.find({}).sort({ createdAt: -1 });
  return docs.map(toBlockedEntity);
}

export interface CreateBlockedEntityPayload {
  type: string;
  value: string;
  reason: string;
  isPermanent?: boolean;
  expiresAt?: string;
  relatedAlerts?: string[];
  notes?: string;
}

export async function createBlockedEntity(payload: CreateBlockedEntityPayload, blockedBy: string, blockedByName: string) {
  const entity = await BlockedEntity.create({
    type: payload.type,
    value: payload.value,
    reason: payload.reason,
    blockedBy,
    blockedByName,
    isPermanent: !!payload.isPermanent,
    expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
    relatedAlerts: payload.relatedAlerts || [],
    notes: payload.notes,
  });
  return toBlockedEntity(entity);
}

export async function unblockEntity(id: string) {
  const doc = await BlockedEntity.findByIdAndDelete(id);
  if (!doc) throw AppError.notFound('Blocked entity', id);
}

function toRule(d: IFraudRule) {
  return {
    id: d._id.toString(),
    name: d.name,
    type: d.type,
    condition: d.condition,
    threshold: d.threshold,
    action: d.action,
    isActive: d.isActive,
    priority: d.priority,
    triggeredCount: d.triggeredCount || 0,
    falsePositiveRate: d.falsePositiveRate || 0,
    createdAt: d.createdAt,
    lastTriggered: d.lastTriggered,
  };
}

const DEFAULT_FRAUD_RULES = [
  { name: 'Velocity Limit - Orders', type: 'velocity', condition: 'Orders per hour > threshold', threshold: 5, action: 'flag', isActive: true, priority: 1 },
  { name: 'High Value Transaction', type: 'amount', condition: 'Order amount > threshold', threshold: 10000, action: 'review', isActive: true, priority: 2 },
  { name: 'Multiple Device Accounts', type: 'device', condition: 'Accounts per device > threshold', threshold: 3, action: 'block', isActive: true, priority: 1 },
  { name: 'Payment Failure Rate', type: 'behavior', condition: 'Failed payments > threshold', threshold: 5, action: 'alert', isActive: true, priority: 1 },
  { name: 'Geolocation Change', type: 'location', condition: 'Location change > threshold km', threshold: 500, action: 'flag', isActive: false, priority: 3 },
];

export async function listFraudRules() {
  const count = await FraudRule.countDocuments();
  if (count === 0) {
    await FraudRule.insertMany(DEFAULT_FRAUD_RULES);
  }
  const docs = await FraudRule.find({}).sort({ priority: 1, createdAt: 1 });
  return docs.map(toRule);
}

export async function toggleFraudRule(id: string) {
  const doc = await FraudRule.findById(id);
  if (!doc) throw AppError.notFound('Rule', id);
  doc.isActive = !doc.isActive;
  await doc.save();
  return toRule(doc);
}

function toRiskProfile(d: IRiskProfile) {
  return {
    id: d._id.toString(),
    entityType: d.entityType,
    entityId: d.entityId,
    entityName: d.entityName,
    riskScore: d.riskScore,
    riskLevel: d.riskLevel,
    factors: (d.factors || []).map((f) => ({ name: f.name, score: f.score, weight: f.weight, description: f.description })),
    totalOrders: d.totalOrders || 0,
    totalSpent: d.totalSpent || 0,
    refundRate: d.refundRate || 0,
    chargebackCount: d.chargebackCount || 0,
    accountAge: d.accountAge || 0,
    lastActivity: d.lastActivity,
    flags: d.flags || [],
  };
}

export async function listRiskProfiles() {
  const docs = await RiskProfile.find({}).sort({ riskScore: -1 });
  return docs.map(toRiskProfile);
}

function toFraudPattern(d: IFraudPattern) {
  return {
    id: d._id.toString(),
    name: d.name,
    type: d.type,
    description: d.description,
    occurrences: d.occurrences || 0,
    totalLoss: d.totalLoss || 0,
    detectedCount: d.detectedCount || 0,
    preventedCount: d.preventedCount || 0,
    trend: d.trend || 'stable',
    lastDetected: d.lastDetected,
    affectedCustomers: d.affectedCustomers || 0,
  };
}

export async function listFraudPatterns() {
  const docs = await FraudPattern.find({}).sort({ occurrences: -1 });
  return docs.map(toFraudPattern);
}

function toInvestigation(d: IFraudInvestigation) {
  return {
    id: d._id.toString(),
    caseNumber: d.caseNumber,
    title: d.title,
    type: d.type,
    status: d.status,
    priority: d.priority,
    investigator: d.investigator?.toString(),
    openedAt: d.createdAt,
    closedAt: d.closedAt,
    customerId: d.customerId,
    customerName: d.customerName,
    totalLoss: d.totalLoss || 0,
    timeline: (d.timeline || []).map((t) => ({
      id: t._id?.toString(),
      action: t.action,
      performedBy: t.performedBy?.toString(),
      performedByName: t.performedByName,
      timestamp: t.timestamp,
      details: t.details,
    })),
    outcome: d.outcome,
  };
}

export async function listInvestigations() {
  const docs = await FraudInvestigation.find({}).sort({ createdAt: -1 });
  return docs.map(toInvestigation);
}

function toChargeback(d: IChargeback) {
  return {
    id: d._id.toString(),
    chargebackId: d.chargebackId,
    orderId: d.orderId,
    customerId: d.customerId,
    customerName: d.customerName,
    amount: d.amount,
    reason: d.reason,
    status: d.status,
    receivedAt: d.receivedAt || d.createdAt,
    dueDate: d.dueDate,
    resolvedAt: d.resolvedAt,
    merchantNotes: d.merchantNotes,
    evidence: d.evidence || [],
  };
}

export async function listChargebacks() {
  const docs = await Chargeback.find({}).sort({ dueDate: 1 });
  return docs.map(toChargeback);
}

export interface UpdateChargebackPayload {
  status?: string;
  merchantNotes?: string;
  evidence?: string[];
}

export async function updateChargeback(id: string, payload: UpdateChargebackPayload) {
  const update: Record<string, unknown> = {};
  if (payload.status) update.status = payload.status;
  if (payload.merchantNotes !== undefined) update.merchantNotes = payload.merchantNotes;
  if (payload.evidence) update.evidence = payload.evidence;
  if (payload.status === 'won' || payload.status === 'lost') update.resolvedAt = new Date();

  const doc = await Chargeback.findByIdAndUpdate(id, update, { new: true });
  if (!doc) throw AppError.notFound('Chargeback', id);
  return toChargeback(doc);
}

export async function getMetrics() {
  const [totalAlerts, openAlerts, resolvedAlerts, falsePositives, blockedCount, activeInvestigations, alertsForLoss] = await Promise.all([
    FraudAlert.countDocuments(),
    FraudAlert.countDocuments({ status: { $in: ['open', 'investigating'] } }),
    FraudAlert.countDocuments({ status: 'resolved' }),
    FraudAlert.countDocuments({ status: 'false_positive' }),
    BlockedEntity.countDocuments(),
    FraudInvestigation.countDocuments({ status: { $ne: 'closed' } }),
    FraudAlert.aggregate([{ $match: { amountInvolved: { $exists: true, $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$amountInvolved' } } }]),
  ]);

  const totalLossIncurred = alertsForLoss[0]?.total || 0;
  const avgRisk = await FraudAlert.aggregate([{ $group: { _id: null, avg: { $avg: '$riskScore' } } }]);
  const averageRiskScore = Math.round(avgRisk[0]?.avg || 0);
  const chargebackCount = await Chargeback.countDocuments({ status: { $nin: ['won', 'lost'] } });
  const totalChargebacks = await Chargeback.countDocuments();
  const chargebackRate = totalChargebacks > 0 ? (chargebackCount / totalChargebacks) * 100 : 0;

  return {
    totalAlerts,
    openAlerts,
    resolvedAlerts,
    falsePositives,
    totalLossPrevented: 0,
    totalLossIncurred,
    averageRiskScore,
    blockedEntities: blockedCount,
    activeInvestigations,
    chargebackRate,
  };
}
