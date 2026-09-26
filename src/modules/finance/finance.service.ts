import mongoose from 'mongoose';
import {
  Invoice, PaymentRecord, FinanceSummary, LiveTransaction,
  FinanceVendorPayment, FinanceVendorInvoice, RefundRequest, ChargebackCase,
  ReconciliationRun, ReconciliationException, LedgerEntry, JournalEntry,
  FinanceAlert, ApprovalTask, TaxRule, PayoutSchedule, CommissionSlab,
  ReconciliationRule, RefundPolicy, InvoiceSettingsConfig, PaymentTerm,
  FinancialLimit, FinancialYearConfig, CustomerPayment,
} from './finance.models';
import { PickerAttendance, PickerTransaction, PickerWithdrawalRequest } from '../picker/picker.models';
import { getEarningsSummary, getWalletBalance } from '../picker/picker.dashboard.service';

function genId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }

// ─── Finance Dashboard ────────────────────────────────────────────────────────

export async function getFinanceSummary(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  const latest = await FinanceSummary.findOne(query).sort({ date: -1 }).lean();
  if (latest) return latest;
  const [totalPayments, pendingPayments, failedPayments] = await Promise.all([
    PaymentRecord.countDocuments({}),
    PaymentRecord.countDocuments({ status: 'pending' }),
    PaymentRecord.countDocuments({ status: 'failed' }),
  ]);
  return { totalReceivedToday: 0, totalReceivedChangePercent: 0, pendingSettlementsAmount: 0, pendingSettlementsGateways: 0, vendorPayoutsAmount: 0, vendorPayoutsStatusText: 'No data', failedPaymentsRatePercent: totalPayments > 0 ? (failedPayments / totalPayments) * 100 : 0, failedPaymentsCount: failedPayments };
}

export async function getPaymentMethodSplit(entityId?: string) {
  const match: any = {};
  if (entityId) match.entityId = entityId;
  const result = await PaymentRecord.aggregate([
    { $match: match },
    { $group: { _id: '$methodType', count: { $sum: 1 }, total: { $sum: '$amount' } } },
  ]);
  return result.map((r: any) => ({ method: r._id, count: r.count, total: r.total }));
}

export async function getLiveTransactions(entityId?: string, limit = 20) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  return LiveTransaction.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

export async function getDailyMetrics(entityId?: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const match: any = { createdAt: { $gte: since } };
  if (entityId) match.entityId = entityId;
  const result = await CustomerPayment.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return result;
}

export async function getGatewayStatus() {
  const result = await PaymentRecord.aggregate([
    { $group: { _id: null, total: { $sum: 1 }, success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } }, failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } } } },
  ]);
  const stats = result[0] || { total: 0, success: 0, failed: 0 };
  return [{ gateway: 'default', status: 'operational', successRate: stats.total > 0 ? (stats.success / stats.total) * 100 : 100, ...stats }];
}

export async function getHourlyTrends(entityId?: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const match: any = { createdAt: { $gte: since } };
  if (entityId) match.entityId = entityId;
  const result = await CustomerPayment.aggregate([
    { $match: match },
    { $group: { _id: { $hour: '$createdAt' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return result;
}

export async function getWalletLiability(entityId?: string) {
  return { totalLiability: 0, activeWallets: 0, frozenAmount: 0, entityId };
}

export async function exportFinanceReport(filters: Record<string, unknown>) {
  return { exportId: genId('EXP'), status: 'queued', filters };
}

// ─── Customer Payments ────────────────────────────────────────────────────────

export async function listCustomerPayments(filters: Record<string, string> = {}) {
  const query: any = {};
  if (filters.status) query.status = filters.status;
  if (filters.customerId) query.customerId = filters.customerId;
  if (filters.entityId) query.entityId = filters.entityId;
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [items, total] = await Promise.all([
    CustomerPayment.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    CustomerPayment.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function getCustomerPaymentById(paymentId: string) {
  return CustomerPayment.findById(paymentId).lean();
}

export async function retryCustomerPayment(paymentId: string) {
  return CustomerPayment.findByIdAndUpdate(paymentId, { status: 'pending' }, { new: true }).lean();
}

// ─── Vendor Payments ──────────────────────────────────────────────────────────

export async function getVendorPaymentsSummary(hubKey?: string) {
  const query: any = {};
  if (hubKey) query.hubKey = hubKey;
  const [total, pending, completed, failed] = await Promise.all([
    FinanceVendorPayment.countDocuments(query),
    FinanceVendorPayment.countDocuments({ ...query, status: 'pending' }),
    FinanceVendorPayment.countDocuments({ ...query, status: 'completed' }),
    FinanceVendorPayment.countDocuments({ ...query, status: 'failed' }),
  ]);
  const amtResult = await FinanceVendorPayment.aggregate([{ $match: query }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  return { total, pending, completed, failed, totalAmount: amtResult[0]?.total || 0 };
}

export async function listVendorInvoices(filters: Record<string, string> = {}, hubKey?: string) {
  const query: any = {};
  if (hubKey) query.hubKey = hubKey;
  if (filters.vendorId) query.vendorId = filters.vendorId;
  if (filters.status) query.status = filters.status;
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [items, total] = await Promise.all([
    FinanceVendorInvoice.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    FinanceVendorInvoice.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function getVendorInvoiceById(invoiceId: string) {
  return FinanceVendorInvoice.findById(invoiceId).lean();
}

export async function approveVendorInvoice(invoiceId: string, approvedBy: string) {
  return FinanceVendorInvoice.findByIdAndUpdate(invoiceId, { status: 'approved', approvedBy }, { new: true }).lean();
}

export async function bulkApproveVendorInvoices(invoiceIds: string[], approvedBy: string) {
  await FinanceVendorInvoice.updateMany({ _id: { $in: invoiceIds } }, { status: 'approved', approvedBy });
  return { approved: invoiceIds.length };
}

export async function rejectVendorInvoice(invoiceId: string, rejectedBy: string, reason: string) {
  return FinanceVendorInvoice.findByIdAndUpdate(invoiceId, { status: 'rejected', rejectedBy, rejectionReason: reason }, { new: true }).lean();
}

export async function markVendorInvoicePaid(invoiceId: string) {
  return FinanceVendorInvoice.findByIdAndUpdate(invoiceId, { status: 'paid', paidAt: new Date() }, { new: true }).lean();
}

export async function uploadVendorInvoice(data: Record<string, unknown>, hubKey?: string) {
  const invoiceNumber = genId('VINV');
  return FinanceVendorInvoice.create({ invoiceNumber, ...data, hubKey });
}

export async function listVendorPayments(filters: Record<string, string> = {}, hubKey?: string) {
  const query: any = {};
  if (hubKey) query.hubKey = hubKey;
  if (filters.vendorId) query.vendorId = filters.vendorId;
  if (filters.status) query.status = filters.status;
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [items, total] = await Promise.all([
    FinanceVendorPayment.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    FinanceVendorPayment.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function getVendorPaymentById(paymentId: string) {
  return FinanceVendorPayment.findOne({ paymentId }).lean();
}

export async function createVendorPayment(data: Record<string, unknown>, hubKey?: string) {
  const paymentId = genId('FPAY');
  return FinanceVendorPayment.create({ paymentId, ...data, hubKey });
}

export async function advanceVendorPaymentWorkflow(paymentId: string, step: string) {
  return FinanceVendorPayment.findOneAndUpdate({ paymentId }, { workflowStep: step }, { new: true }).lean();
}

export async function cancelVendorPayment(paymentId: string) {
  return FinanceVendorPayment.findOneAndUpdate({ paymentId }, { status: 'cancelled' }, { new: true }).lean();
}

export async function getFinanceVendors(hubKey?: string) {
  const query: any = {};
  if (hubKey) query.hubKey = hubKey;
  return FinanceVendorPayment.distinct('vendorId', query);
}

// ─── Picker Withdrawals ───────────────────────────────────────────────────────

export async function listPickerWithdrawals(filters: Record<string, string> = {}) {
  const { listPickerWithdrawalsFixed } = await import('../rider/pickerOps.bridge');
  return listPickerWithdrawalsFixed(filters);
}

export async function getPickerWithdrawalById(id: string) {
  if (mongoose.isValidObjectId(id)) {
    const row = await PickerWithdrawalRequest.findById(id).populate('userId', 'name phone email').lean();
    if (row) return row;
  }
  return RefundRequest.findById(id).lean();
}

export async function updatePickerWithdrawal(id: string, update: Record<string, unknown>) {
  if (mongoose.isValidObjectId(id)) {
    const statusRaw = update.status ?? update.action ?? update.decision;
    const patch: Record<string, unknown> = { ...update };
    if (statusRaw != null) {
      const s = String(statusRaw).toUpperCase();
      if (s.includes('APPROV')) patch.status = 'APPROVED';
      else if (s.includes('REJECT')) patch.status = 'REJECTED';
      else if (s.includes('PAID') || s.includes('SETTLE')) patch.status = 'PAID';
      else patch.status = s;
    }
    delete patch.action;
    delete patch.decision;
    const updated = await PickerWithdrawalRequest.findByIdAndUpdate(id, patch, { new: true }).lean();
    if (updated) return updated;
  }
  return RefundRequest.findByIdAndUpdate(id, update, { new: true }).lean();
}

export async function getPickerEarningsBreakdown(pickerId: string) {
  const summary = await getEarningsSummary(pickerId, { period: 'week' });
  const withdrawn = await PickerWithdrawalRequest.aggregate<{ total: number }>([
    { $match: { userId: new mongoose.Types.ObjectId(pickerId), status: { $in: ['PAID', 'APPROVED'] } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return {
    pickerId,
    totalEarned: summary.total,
    totalWithdrawn: Math.round(withdrawn[0]?.total || 0),
    pending: summary.nextPayout?.amount ?? 0,
    breakdown: summary.breakdown,
  };
}

export async function getPickerWalletBalance(pickerId: string) {
  const wallet = await getWalletBalance(pickerId);
  return {
    pickerId,
    balance: wallet.availableBalance,
    availableBalance: wallet.availableBalance,
    pendingBalance: wallet.pendingBalance,
    reservedBalance: wallet.reservedBalance,
    totalEarnings: wallet.totalEarnings,
    currency: wallet.currency,
  };
}

export async function listAllPickerTransactions(filters: Record<string, string> = {}) {
  const page = Math.max(1, parseInt(filters.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '50', 10) || 50));
  const query: Record<string, unknown> = {};
  if (filters.pickerId && mongoose.isValidObjectId(filters.pickerId)) {
    query.userId = new mongoose.Types.ObjectId(filters.pickerId);
  }
  const [items, total] = await Promise.all([
    PickerTransaction.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    PickerTransaction.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function getPickerAttendance(filters: Record<string, string> = {}) {
  const query: Record<string, unknown> = {};
  if (filters.pickerId && mongoose.isValidObjectId(filters.pickerId)) {
    query.userId = new mongoose.Types.ObjectId(filters.pickerId);
  }
  const items = await PickerAttendance.find(query).sort({ punchIn: -1 }).limit(200).lean();
  return { items, total: items.length };
}

// ─── Refunds ──────────────────────────────────────────────────────────────────

export async function getWalletTransactions(filters: Record<string, string> = {}) {
  return { items: [], total: 0, page: 1, limit: 50 };
}

export async function getRefundsSummary(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  const [total, pending, approved, completed, rejected] = await Promise.all([
    RefundRequest.countDocuments(query),
    RefundRequest.countDocuments({ ...query, status: 'pending' }),
    RefundRequest.countDocuments({ ...query, status: 'approved' }),
    RefundRequest.countDocuments({ ...query, status: 'completed' }),
    RefundRequest.countDocuments({ ...query, status: 'rejected' }),
  ]);
  return { total, pending, approved, completed, rejected };
}

export async function getRefundQueue(filters: Record<string, string> = {}, entityId?: string) {
  const query: any = { status: 'pending' };
  if (entityId) query.entityId = entityId;
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [items, total] = await Promise.all([
    RefundRequest.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    RefundRequest.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function getChargebacks(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  return ChargebackCase.find(query).sort({ createdAt: -1 }).lean();
}

export async function getRefundById(id: string) {
  return RefundRequest.findById(id).lean();
}

export async function approveRefund(id: string, approvedBy: string) {
  return RefundRequest.findByIdAndUpdate(id, { status: 'approved', approvedBy }, { new: true }).lean();
}

export async function rejectRefund(id: string, rejectedBy: string, reason: string) {
  return RefundRequest.findByIdAndUpdate(id, { status: 'rejected', rejectedBy, rejectionReason: reason }, { new: true }).lean();
}

export async function markRefundCompleted(id: string) {
  return RefundRequest.findByIdAndUpdate(id, { status: 'completed', completedAt: new Date() }, { new: true }).lean();
}

// ─── Rider Cash ───────────────────────────────────────────────────────────────

export async function getRiderCashSummary() {
  const { getRiderCashSummaryFromPickers } = await import('../rider/pickerOps.bridge');
  return getRiderCashSummaryFromPickers();
}

export async function getRiderPayouts(filters: Record<string, string> = {}) {
  const { listRiderPayoutsFromPickers } = await import('../rider/pickerOps.bridge');
  return listRiderPayoutsFromPickers(filters);
}

export async function getCodReconciliation() {
  return { matched: 0, unmatched: 0, total: 0, items: [] };
}

export async function getRiderPaymentDetails(riderId: string) {
  return { riderId, collected: 0, deposited: 0, pending: 0, transactions: [] };
}

// ─── Reconciliation ───────────────────────────────────────────────────────────

export async function getAvailableGateways() {
  const worldlineConfigured = Boolean(process.env.WORLDLINE_MERCHANT_ID || process.env.WORLDLINE_SALT);
  return [
    { id: 'worldline', name: 'Worldline', status: worldlineConfigured ? 'active' : 'inactive' },
    { id: 'razorpay', name: 'Razorpay', status: 'inactive' },
    { id: 'cashfree', name: 'Cashfree', status: 'inactive' },
  ];
}

export async function getReconSummary(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  const [total, running, completed, failed] = await Promise.all([
    ReconciliationRun.countDocuments(query),
    ReconciliationRun.countDocuments({ ...query, status: 'running' }),
    ReconciliationRun.countDocuments({ ...query, status: 'completed' }),
    ReconciliationRun.countDocuments({ ...query, status: 'failed' }),
  ]);
  return { total, running, completed, failed };
}

export async function getReconciliationExceptions(filters: Record<string, string> = {}, entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  if (filters.status) query.status = filters.status;
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [items, total] = await Promise.all([
    ReconciliationException.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ReconciliationException.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function runReconciliation(data: Record<string, unknown>, entityId?: string) {
  const runId = genId('RECON');
  return ReconciliationRun.create({ runId, gateway: data.gateway || 'default', status: 'pending', entityId });
}

export async function getReconRunById(runId: string) {
  return ReconciliationRun.findOne({ runId }).lean();
}

export async function investigateException(exceptionId: string) {
  return ReconciliationException.findOneAndUpdate({ exceptionId }, { status: 'investigating' }, { new: true }).lean();
}

export async function resolveException(exceptionId: string, resolvedBy: string) {
  return ReconciliationException.findOneAndUpdate({ exceptionId }, { status: 'resolved', resolvedBy }, { new: true }).lean();
}

export async function getGatewayDetails(gatewayId: string) {
  return { id: gatewayId, name: gatewayId, status: 'active', successRate: 98.5, totalTransactions: 0 };
}

// ─── Ledger / Accounting ──────────────────────────────────────────────────────

export async function syncLedger(entityId?: string) {
  return { synced: true, entityId, timestamp: new Date() };
}

export async function getAccountingSummary(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  const result = await LedgerEntry.aggregate([{ $match: query }, { $group: { _id: null, totalDebit: { $sum: '$debit' }, totalCredit: { $sum: '$credit' }, balance: { $sum: '$balance' } } }]);
  return result[0] || { totalDebit: 0, totalCredit: 0, balance: 0 };
}

export async function getLedgerEntries(filters: Record<string, string> = {}, entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  if (filters.account) query.account = filters.account;
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [items, total] = await Promise.all([
    LedgerEntry.find(query).sort({ entryDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    LedgerEntry.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function getAccounts(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  return LedgerEntry.distinct('account', query);
}

export async function createJournalEntry(data: Record<string, unknown>, createdBy: string, entityId?: string) {
  const journalId = genId('JNL');
  return JournalEntry.create({ journalId, ...data, createdBy, entityId });
}

export async function getJournalEntryById(journalId: string) {
  return JournalEntry.findOne({ journalId }).lean();
}

// ─── Invoicing ────────────────────────────────────────────────────────────────

export async function getInvoiceSummary(entityId?: string) {
  const query: any = {};
  if (entityId) query.customerId = entityId;
  const [total, sent, paid, overdue, pending] = await Promise.all([
    Invoice.countDocuments(query),
    Invoice.countDocuments({ ...query, status: 'sent' }),
    Invoice.countDocuments({ ...query, status: 'paid' }),
    Invoice.countDocuments({ ...query, status: 'overdue' }),
    Invoice.countDocuments({ ...query, status: 'pending' }),
  ]);
  return { total, sent, paid, overdue, pending };
}

export async function listInvoices(filters: Record<string, string> = {}) {
  const query: any = {};
  if (filters.status) query.status = filters.status;
  if (filters.customerId) query.customerId = filters.customerId;
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [items, total] = await Promise.all([
    Invoice.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Invoice.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function createInvoice(data: Record<string, unknown>) {
  const invoiceNumber = genId('INV');
  return Invoice.create({ invoiceNumber, ...data, status: 'draft' });
}

export async function getInvoiceById(invoiceId: string) {
  return Invoice.findById(invoiceId).lean();
}

export async function updateInvoiceStatus(invoiceId: string, status: string) {
  return Invoice.findByIdAndUpdate(invoiceId, { status }, { new: true }).lean();
}

export async function sendInvoice(invoiceId: string) {
  return Invoice.findByIdAndUpdate(invoiceId, { status: 'sent' }, { new: true }).lean();
}

export async function sendInvoiceReminder(invoiceId: string) {
  return Invoice.findByIdAndUpdate(invoiceId, { lastReminderAt: new Date() }, { new: true }).lean();
}

export async function markInvoicePaid(invoiceId: string) {
  return Invoice.findByIdAndUpdate(invoiceId, { status: 'paid' }, { new: true }).lean();
}

// ─── Finance Alerts ───────────────────────────────────────────────────────────

export async function listFinanceAlerts(filters: Record<string, string> = {}, entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [items, total] = await Promise.all([
    FinanceAlert.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    FinanceAlert.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function getFinanceAlertById(alertId: string) {
  return FinanceAlert.findOne({ alertId }).lean();
}

export async function performAlertAction(alertId: string, action: string) {
  const update: any = {};
  if (action === 'acknowledge') update.status = 'acknowledged';
  else if (action === 'resolve') update.status = 'resolved';
  else if (action === 'dismiss') update.status = 'dismissed';
  return FinanceAlert.findOneAndUpdate({ alertId }, update, { new: true }).lean();
}

export async function clearResolvedAlerts(entityId?: string) {
  const query: any = { status: { $in: ['resolved', 'dismissed'] } };
  if (entityId) query.entityId = entityId;
  const result = await FinanceAlert.deleteMany(query);
  return { cleared: result.deletedCount };
}

// ─── Finance Analytics ────────────────────────────────────────────────────────

export async function getRevenueGrowth(filters: Record<string, string> = {}, entityId?: string) {
  const days = parseInt(filters.days) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const match: any = { createdAt: { $gte: since }, status: 'success' };
  if (entityId) match.entityId = entityId;
  const result = await CustomerPayment.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$amount' }, orders: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return { data: result, period: `${days}d` };
}

export async function getCashFlow(filters: Record<string, string> = {}, entityId?: string) {
  return { inflow: 0, outflow: 0, net: 0, period: filters.period || '30d', entityId };
}

export async function getExpenseBreakdown(filters: Record<string, string> = {}, entityId?: string) {
  return { breakdown: [], total: 0, period: filters.period || '30d', entityId };
}

export async function exportAnalyticsReport(data: Record<string, unknown>) {
  return { exportId: genId('AEXP'), status: 'queued', ...data };
}

// ─── Approvals ────────────────────────────────────────────────────────────────

export async function getApprovalSummary(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  const [total, pending, approved, rejected] = await Promise.all([
    ApprovalTask.countDocuments(query),
    ApprovalTask.countDocuments({ ...query, status: 'pending' }),
    ApprovalTask.countDocuments({ ...query, status: 'approved' }),
    ApprovalTask.countDocuments({ ...query, status: 'rejected' }),
  ]);
  return { total, pending, approved, rejected };
}

export async function listApprovalTasks(filters: Record<string, string> = {}, entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [items, total] = await Promise.all([
    ApprovalTask.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ApprovalTask.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function getApprovalTaskById(taskId: string) {
  return ApprovalTask.findOne({ taskId }).lean();
}

export async function submitApprovalDecision(taskId: string, decision: string, approvedBy: string, reason?: string) {
  const status = decision === 'approve' ? 'approved' : 'rejected';
  return ApprovalTask.findOneAndUpdate({ taskId }, { status, approvedBy, decision, reason }, { new: true }).lean();
}

// ─── Finance Rules / Config ───────────────────────────────────────────────────

export async function getTaxRules(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  return TaxRule.find(query).lean();
}

export async function createTaxRule(data: Record<string, unknown>, entityId?: string) {
  return TaxRule.create({ ...data, entityId });
}

export async function updateTaxRule(ruleId: string, updates: Record<string, unknown>) {
  return TaxRule.findByIdAndUpdate(ruleId, updates, { new: true }).lean();
}

export async function getPayoutSchedules(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  return PayoutSchedule.find(query).lean();
}

export async function createPayoutSchedule(data: Record<string, unknown>, entityId?: string) {
  return PayoutSchedule.create({ ...data, entityId });
}

export async function updatePayoutSchedule(scheduleId: string, updates: Record<string, unknown>) {
  return PayoutSchedule.findByIdAndUpdate(scheduleId, updates, { new: true }).lean();
}

export async function getCommissionSlabs(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  return CommissionSlab.find(query).lean();
}

export async function createCommissionSlab(data: Record<string, unknown>, entityId?: string) {
  return CommissionSlab.create({ ...data, entityId });
}

export async function updateCommissionSlab(slabId: string, updates: Record<string, unknown>) {
  return CommissionSlab.findByIdAndUpdate(slabId, updates, { new: true }).lean();
}

export async function getReconciliationRules(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  return ReconciliationRule.find(query).lean();
}

export async function updateReconciliationRule(ruleId: string, updates: Record<string, unknown>) {
  return ReconciliationRule.findByIdAndUpdate(ruleId, updates, { new: true }).lean();
}

export async function getRefundPolicies(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  return RefundPolicy.find(query).lean();
}

export async function updateRefundPolicy(policyId: string, updates: Record<string, unknown>) {
  return RefundPolicy.findByIdAndUpdate(policyId, updates, { new: true }).lean();
}

export async function getInvoiceSettings(entityId?: string) {
  return InvoiceSettingsConfig.findOne(entityId ? { entityId } : {}).lean();
}

export async function updateInvoiceSettings(entityId: string, updates: Record<string, unknown>) {
  return InvoiceSettingsConfig.findOneAndUpdate({ entityId }, { ...updates, entityId }, { new: true, upsert: true }).lean();
}

export async function getPaymentTerms(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  return PaymentTerm.find(query).lean();
}

export async function updatePaymentTerm(termId: string, updates: Record<string, unknown>) {
  return PaymentTerm.findByIdAndUpdate(termId, updates, { new: true }).lean();
}

export async function getFinancialLimits(entityId?: string) {
  const query: any = {};
  if (entityId) query.entityId = entityId;
  return FinancialLimit.find(query).lean();
}

export async function updateFinancialLimit(limitId: string, updates: Record<string, unknown>) {
  return FinancialLimit.findByIdAndUpdate(limitId, updates, { new: true }).lean();
}

export async function getFinancialYear(entityId?: string) {
  return FinancialYearConfig.findOne(entityId ? { entityId } : { active: true }).lean();
}

export async function updateFinancialYear(entityId: string, updates: Record<string, unknown>) {
  return FinancialYearConfig.findOneAndUpdate({ entityId }, { ...updates, entityId }, { new: true, upsert: true }).lean();
}
