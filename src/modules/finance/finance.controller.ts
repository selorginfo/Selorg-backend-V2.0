import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as svc from './finance.service';

function entityId(req: Request): string | undefined { return req.query.entityId as string | undefined; }
function actor(req: Request): string { return req.user?.userId || req.user?.email || 'system'; }

// ─── Finance Dashboard ────────────────────────────────────────────────────────

export async function getFinanceSummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getFinanceSummary(entityId(req)))); } catch (err) { next(err); }
}

export async function getPaymentMethodSplit(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getPaymentMethodSplit(entityId(req)))); } catch (err) { next(err); }
}

export async function getLiveTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    res.json(ResponseFormatter.success(await svc.getLiveTransactions(entityId(req), limit)));
  } catch (err) { next(err); }
}

export async function getDailyMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const days = parseInt(req.query.days as string) || 30;
    res.json(ResponseFormatter.success(await svc.getDailyMetrics(entityId(req), days)));
  } catch (err) { next(err); }
}

export async function getGatewayStatus(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getGatewayStatus())); } catch (err) { next(err); }
}

export async function getHourlyTrends(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getHourlyTrends(entityId(req)))); } catch (err) { next(err); }
}

export async function getWalletLiability(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getWalletLiability(entityId(req)))); } catch (err) { next(err); }
}

export async function exportFinanceReport(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.exportFinanceReport(req.body))); } catch (err) { next(err); }
}

// ─── Customer Payments ────────────────────────────────────────────────────────

export async function getCustomerPayments(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listCustomerPayments(req.query as Record<string, string>))); } catch (err) { next(err); }
}

export async function getCustomerPaymentDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const p = await svc.getCustomerPaymentById(req.params.id);
    if (!p) { res.status(404).json(ResponseFormatter.error('Payment not found', 404)); return; }
    res.json(ResponseFormatter.success(p));
  } catch (err) { next(err); }
}

export async function retryCustomerPayment(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.retryCustomerPayment(req.params.id))); } catch (err) { next(err); }
}

// ─── Vendor Payments ──────────────────────────────────────────────────────────

export async function getVendorPaymentsSummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getVendorPaymentsSummary((req as any).vendorHubKey))); } catch (err) { next(err); }
}

export async function getVendorInvoices(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listVendorInvoices(req.query as Record<string, string>, (req as any).vendorHubKey))); } catch (err) { next(err); }
}

export async function getVendorInvoiceDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const inv = await svc.getVendorInvoiceById(req.params.id);
    if (!inv) { res.status(404).json(ResponseFormatter.error('Invoice not found', 404)); return; }
    res.json(ResponseFormatter.success(inv));
  } catch (err) { next(err); }
}

export async function approveVendorInvoice(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.approveVendorInvoice(req.params.id, actor(req)))); } catch (err) { next(err); }
}

export async function bulkApproveVendorInvoices(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.bulkApproveVendorInvoices(req.body.invoiceIds || [], actor(req)))); } catch (err) { next(err); }
}

export async function rejectVendorInvoice(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.rejectVendorInvoice(req.params.id, actor(req), req.body.reason || ''))); } catch (err) { next(err); }
}

export async function markVendorInvoicePaid(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.markVendorInvoicePaid(req.params.id))); } catch (err) { next(err); }
}

export async function uploadVendorInvoice(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.uploadVendorInvoice(req.body, (req as any).vendorHubKey))); } catch (err) { next(err); }
}

export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listVendorPayments(req.query as Record<string, string>, (req as any).vendorHubKey))); } catch (err) { next(err); }
}

export async function getPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const p = await svc.getVendorPaymentById(req.params.paymentId);
    if (!p) { res.status(404).json(ResponseFormatter.error('Payment not found', 404)); return; }
    res.json(ResponseFormatter.success(p));
  } catch (err) { next(err); }
}

export async function createVendorPayment(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.createVendorPayment(req.body, (req as any).vendorHubKey))); } catch (err) { next(err); }
}

export async function advanceWorkflowStep(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.advanceVendorPaymentWorkflow(req.params.paymentId, req.body.step || ''))); } catch (err) { next(err); }
}

export async function cancelVendorPayment(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.cancelVendorPayment(req.params.paymentId))); } catch (err) { next(err); }
}

export async function getVendors(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getFinanceVendors((req as any).vendorHubKey))); } catch (err) { next(err); }
}

// ─── Picker Withdrawals ───────────────────────────────────────────────────────

export async function list(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listPickerWithdrawals(req.query as Record<string, string>))); } catch (err) { next(err); }
}

export async function getDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const w = await svc.getPickerWithdrawalById(req.params.id);
    if (!w) { res.status(404).json(ResponseFormatter.error('Withdrawal not found', 404)); return; }
    res.json(ResponseFormatter.success(w));
  } catch (err) { next(err); }
}

export async function updateAction(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updatePickerWithdrawal(req.params.id, req.body))); } catch (err) { next(err); }
}

export async function getPickerEarningsBreakdown(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getPickerEarningsBreakdown(req.params.pickerId))); } catch (err) { next(err); }
}

export async function getPickerWalletBalance(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getPickerWalletBalance(req.params.pickerId))); } catch (err) { next(err); }
}

export async function listAllPickerTransactions(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listAllPickerTransactions(req.query as Record<string, string>))); } catch (err) { next(err); }
}

export async function getPickerAttendance(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getPickerAttendance(req.query as Record<string, string>))); } catch (err) { next(err); }
}

// ─── Refunds ──────────────────────────────────────────────────────────────────

export async function getWalletTransactions(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getWalletTransactions(req.query as Record<string, string>))); } catch (err) { next(err); }
}

export async function getRefundsSummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getRefundsSummary(entityId(req)))); } catch (err) { next(err); }
}

export async function getRefundQueue(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getRefundQueue(req.query as Record<string, string>, entityId(req)))); } catch (err) { next(err); }
}

export async function getChargebacks(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getChargebacks(entityId(req)))); } catch (err) { next(err); }
}

export async function getRefundDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await svc.getRefundById(req.params.id);
    if (!r) { res.status(404).json(ResponseFormatter.error('Refund not found', 404)); return; }
    res.json(ResponseFormatter.success(r));
  } catch (err) { next(err); }
}

export async function approveRefund(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.approveRefund(req.params.id, actor(req)))); } catch (err) { next(err); }
}

export async function rejectRefund(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.rejectRefund(req.params.id, actor(req), req.body.reason || ''))); } catch (err) { next(err); }
}

export async function markCompleted(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.markRefundCompleted(req.params.id))); } catch (err) { next(err); }
}

// ─── Rider Cash ───────────────────────────────────────────────────────────────

export async function getRiderCashSummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getRiderCashSummary())); } catch (err) { next(err); }
}

export async function getRiderPayouts(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getRiderPayouts(req.query as Record<string, string>))); } catch (err) { next(err); }
}

export async function getCodReconciliation(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getCodReconciliation())); } catch (err) { next(err); }
}

export async function getRiderPaymentDetails(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getRiderPaymentDetails(req.params.riderId))); } catch (err) { next(err); }
}

// ─── Reconciliation ───────────────────────────────────────────────────────────

export async function getAvailableGateways(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getAvailableGateways())); } catch (err) { next(err); }
}

export async function getReconSummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getReconSummary(entityId(req)))); } catch (err) { next(err); }
}

export async function getExceptions(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getReconciliationExceptions(req.query as Record<string, string>, entityId(req)))); } catch (err) { next(err); }
}

export async function runReconciliation(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.runReconciliation(req.body, entityId(req)))); } catch (err) { next(err); }
}

export async function getRunStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const run = await svc.getReconRunById(req.params.id);
    if (!run) { res.status(404).json(ResponseFormatter.error('Run not found', 404)); return; }
    res.json(ResponseFormatter.success(run));
  } catch (err) { next(err); }
}

export async function investigateException(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.investigateException(req.params.id))); } catch (err) { next(err); }
}

export async function resolveException(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.resolveException(req.params.id, actor(req)))); } catch (err) { next(err); }
}

export async function getGatewayDetails(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getGatewayDetails(req.params.id))); } catch (err) { next(err); }
}

// ─── Ledger / Accounting ──────────────────────────────────────────────────────

export async function syncLedger(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.syncLedger(entityId(req)))); } catch (err) { next(err); }
}

export async function getAccountingSummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getAccountingSummary(entityId(req)))); } catch (err) { next(err); }
}

export async function getLedgerEntries(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getLedgerEntries(req.query as Record<string, string>, entityId(req)))); } catch (err) { next(err); }
}

export async function getAccounts(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getAccounts(entityId(req)))); } catch (err) { next(err); }
}

export async function createJournalEntry(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.createJournalEntry(req.body, actor(req), entityId(req)))); } catch (err) { next(err); }
}

export async function getJournalDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const j = await svc.getJournalEntryById(req.params.id);
    if (!j) { res.status(404).json(ResponseFormatter.error('Journal entry not found', 404)); return; }
    res.json(ResponseFormatter.success(j));
  } catch (err) { next(err); }
}

// ─── Invoicing ────────────────────────────────────────────────────────────────

export async function getInvoiceSummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getInvoiceSummary(entityId(req)))); } catch (err) { next(err); }
}

export async function getInvoices(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listInvoices(req.query as Record<string, string>))); } catch (err) { next(err); }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.createInvoice(req.body))); } catch (err) { next(err); }
}

export async function getInvoiceDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const inv = await svc.getInvoiceById(req.params.id);
    if (!inv) { res.status(404).json(ResponseFormatter.error('Invoice not found', 404)); return; }
    res.json(ResponseFormatter.success(inv));
  } catch (err) { next(err); }
}

export async function updateInvoiceStatus(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updateInvoiceStatus(req.params.id, req.body.status))); } catch (err) { next(err); }
}

export async function sendInvoice(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.sendInvoice(req.params.id))); } catch (err) { next(err); }
}

export async function sendReminder(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.sendInvoiceReminder(req.params.id))); } catch (err) { next(err); }
}

export async function markInvoicePaid(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.markInvoicePaid(req.params.id))); } catch (err) { next(err); }
}

// ─── Finance Alerts ───────────────────────────────────────────────────────────

export async function getAlerts(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listFinanceAlerts(req.query as Record<string, string>, entityId(req)))); } catch (err) { next(err); }
}

export async function getAlertDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const a = await svc.getFinanceAlertById(req.params.id);
    if (!a) { res.status(404).json(ResponseFormatter.error('Alert not found', 404)); return; }
    res.json(ResponseFormatter.success(a));
  } catch (err) { next(err); }
}

export async function performAlertAction(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.performAlertAction(req.params.id, req.body.action || ''))); } catch (err) { next(err); }
}

export async function clearResolvedAlerts(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.clearResolvedAlerts(entityId(req)))); } catch (err) { next(err); }
}

// ─── Finance Analytics ────────────────────────────────────────────────────────

export async function getRevenueGrowth(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getRevenueGrowth(req.query as Record<string, string>, entityId(req)))); } catch (err) { next(err); }
}

export async function getCashFlow(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getCashFlow(req.query as Record<string, string>, entityId(req)))); } catch (err) { next(err); }
}

export async function getExpenseBreakdown(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getExpenseBreakdown(req.query as Record<string, string>, entityId(req)))); } catch (err) { next(err); }
}

export async function exportAnalyticsReport(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.exportAnalyticsReport(req.body))); } catch (err) { next(err); }
}

// ─── Approvals ────────────────────────────────────────────────────────────────

export async function getApprovalSummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getApprovalSummary(entityId(req)))); } catch (err) { next(err); }
}

export async function getApprovalTasks(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listApprovalTasks(req.query as Record<string, string>, entityId(req)))); } catch (err) { next(err); }
}

export async function getTaskDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const t = await svc.getApprovalTaskById(req.params.id);
    if (!t) { res.status(404).json(ResponseFormatter.error('Task not found', 404)); return; }
    res.json(ResponseFormatter.success(t));
  } catch (err) { next(err); }
}

export async function submitTaskDecision(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.submitApprovalDecision(req.params.id, req.body.decision || '', actor(req), req.body.reason))); } catch (err) { next(err); }
}

// ─── Finance Rules / Config ───────────────────────────────────────────────────

export async function getTaxRules(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getTaxRules(entityId(req)))); } catch (err) { next(err); }
}

export async function createTaxRule(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.createTaxRule(req.body, entityId(req)))); } catch (err) { next(err); }
}

export async function updateTaxRule(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updateTaxRule(req.params.ruleId, req.body))); } catch (err) { next(err); }
}

export async function getPayoutSchedules(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getPayoutSchedules(entityId(req)))); } catch (err) { next(err); }
}

export async function createPayoutSchedule(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.createPayoutSchedule(req.body, entityId(req)))); } catch (err) { next(err); }
}

export async function updatePayoutSchedule(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updatePayoutSchedule(req.params.scheduleId, req.body))); } catch (err) { next(err); }
}

export async function getCommissionSlabs(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getCommissionSlabs(entityId(req)))); } catch (err) { next(err); }
}

export async function createCommissionSlab(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.createCommissionSlab(req.body, entityId(req)))); } catch (err) { next(err); }
}

export async function updateCommissionSlab(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updateCommissionSlab(req.params.slabId, req.body))); } catch (err) { next(err); }
}

export async function getReconciliationRules(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getReconciliationRules(entityId(req)))); } catch (err) { next(err); }
}

export async function updateReconciliationRule(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updateReconciliationRule(req.params.ruleId, req.body))); } catch (err) { next(err); }
}

export async function getRefundPolicies(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getRefundPolicies(entityId(req)))); } catch (err) { next(err); }
}

export async function updateRefundPolicy(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updateRefundPolicy(req.params.policyId, req.body))); } catch (err) { next(err); }
}

export async function getInvoiceSettings(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getInvoiceSettings(entityId(req)))); } catch (err) { next(err); }
}

export async function updateInvoiceSettings(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updateInvoiceSettings(entityId(req) || 'default', req.body))); } catch (err) { next(err); }
}

export async function getPaymentTerms(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getPaymentTerms(entityId(req)))); } catch (err) { next(err); }
}

export async function updatePaymentTerm(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updatePaymentTerm(req.params.termId, req.body))); } catch (err) { next(err); }
}

export async function getFinancialLimits(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getFinancialLimits(entityId(req)))); } catch (err) { next(err); }
}

export async function updateFinancialLimit(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updateFinancialLimit(req.params.limitId, req.body))); } catch (err) { next(err); }
}

export async function getFinancialYear(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getFinancialYear(entityId(req)))); } catch (err) { next(err); }
}

export async function updateFinancialYear(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updateFinancialYear(entityId(req) || 'default', req.body))); } catch (err) { next(err); }
}
