import { Router } from 'express';
import { authenticateAdmin, requirePermission, requirePermissionWhenMutating } from '../../middleware/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import * as ctrl from './finance.controller';

const router = Router();

router.use(authenticateAdmin);
router.use(requirePermission(PERMISSIONS.PAYMENTS_READ));
router.use(requirePermissionWhenMutating(PERMISSIONS.PAYMENTS_REFUND));

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard/summary', ctrl.getFinanceSummary);
router.get('/dashboard/payment-method-split', ctrl.getPaymentMethodSplit);
router.get('/dashboard/live-transactions', ctrl.getLiveTransactions);
router.get('/dashboard/daily-metrics', ctrl.getDailyMetrics);
router.get('/dashboard/gateway-status', ctrl.getGatewayStatus);
router.get('/dashboard/hourly-trends', ctrl.getHourlyTrends);
router.get('/dashboard/wallet-liability', ctrl.getWalletLiability);
router.post('/dashboard/export', ctrl.exportFinanceReport);

// ─── Customer Payments ────────────────────────────────────────────────────────
router.get('/customer-payments', ctrl.getCustomerPayments);
router.get('/customer-payments/:id', ctrl.getCustomerPaymentDetails);
router.post('/customer-payments/:id/retry', ctrl.retryCustomerPayment);

// ─── Vendor Payments ──────────────────────────────────────────────────────────
router.get('/vendor-payments/summary', ctrl.getVendorPaymentsSummary);
router.get('/vendor-payments/vendors', ctrl.getVendors);
router.get('/vendor-payments/invoices', ctrl.getVendorInvoices);
router.post('/vendor-payments/invoices', ctrl.uploadVendorInvoice);
router.post('/vendor-payments/invoices/bulk-approve', ctrl.bulkApproveVendorInvoices);
router.get('/vendor-payments/invoices/:id', ctrl.getVendorInvoiceDetails);
router.post('/vendor-payments/invoices/:id/approve', ctrl.approveVendorInvoice);
router.post('/vendor-payments/invoices/:id/reject', ctrl.rejectVendorInvoice);
router.post('/vendor-payments/invoices/:id/mark-paid', ctrl.markVendorInvoicePaid);
router.get('/vendor-payments/payments', ctrl.listPayments);
router.post('/vendor-payments/payments', ctrl.createVendorPayment);
router.get('/vendor-payments/payments/:paymentId', ctrl.getPayment);
router.post('/vendor-payments/payments/:paymentId/invoices/:invoiceId/workflow/advance', ctrl.advanceWorkflowStep);
router.post('/vendor-payments/payments/:paymentId/advance', ctrl.advanceWorkflowStep);
router.post('/vendor-payments/payments/:paymentId/cancel', ctrl.cancelVendorPayment);

// ─── Picker Withdrawals ───────────────────────────────────────────────────────
router.get('/picker-withdrawals', ctrl.list);
router.get('/picker-withdrawals/:pickerId/earnings-breakdown', ctrl.getPickerEarningsBreakdown);
router.get('/picker-withdrawals/:pickerId/wallet-balance', ctrl.getPickerWalletBalance);
router.get('/picker-withdrawals/:id', ctrl.getDetails);
router.patch('/picker-withdrawals/:id', ctrl.updateAction);
router.get('/picker-earnings/:pickerId/breakdown', ctrl.getPickerEarningsBreakdown);
router.get('/picker-earnings/:pickerId/wallet', ctrl.getPickerWalletBalance);
router.get('/picker-transactions', ctrl.listAllPickerTransactions);
router.get('/picker-attendance', ctrl.getPickerAttendance);

// ─── Refunds ──────────────────────────────────────────────────────────────────
router.get('/wallet-transactions', ctrl.getWalletTransactions);
router.get('/refunds/summary', ctrl.getRefundsSummary);
router.get('/refunds/queue', ctrl.getRefundQueue);
router.get('/refunds/chargebacks', ctrl.getChargebacks);
router.get('/refunds/wallet-transactions', ctrl.getWalletTransactions);
router.get('/refunds/:id', ctrl.getRefundDetails);
router.post('/refunds/:id/approve', ctrl.approveRefund);
router.post('/refunds/:id/reject', ctrl.rejectRefund);
router.post('/refunds/:id/mark-completed', ctrl.markCompleted);
router.post('/refunds/:id/complete', ctrl.markCompleted);

// ─── Rider Cash ───────────────────────────────────────────────────────────────
router.get('/rider-cash/summary', ctrl.getRiderCashSummary);
router.get('/rider-cash/payouts', ctrl.getRiderPayouts);
router.get('/rider-cash/cod-reconciliation', ctrl.getCodReconciliation);
router.get('/rider-cash/riders/:riderId/payment-details', ctrl.getRiderPaymentDetails);
router.get('/rider-cash/:riderId', ctrl.getRiderPaymentDetails);

// ─── Reconciliation ───────────────────────────────────────────────────────────
router.get('/reconciliation/gateways', ctrl.getAvailableGateways);
router.get('/reconciliation/summary', ctrl.getReconSummary);
router.get('/reconciliation/exceptions', ctrl.getExceptions);
router.post('/reconciliation/run', ctrl.runReconciliation);
router.get('/reconciliation/runs/:id', ctrl.getRunStatus);
router.post('/reconciliation/exceptions/:id/investigate', ctrl.investigateException);
router.post('/reconciliation/exceptions/:id/resolve', ctrl.resolveException);
router.get('/reconciliation/gateways/:id', ctrl.getGatewayDetails);

// ─── Ledger / Accounting ──────────────────────────────────────────────────────
router.post('/accounting/sync', ctrl.syncLedger);
router.get('/accounting/summary', ctrl.getAccountingSummary);
router.get('/accounting/ledger', ctrl.getLedgerEntries);
router.get('/accounting/accounts', ctrl.getAccounts);
router.post('/accounting/journal', ctrl.createJournalEntry);
router.get('/accounting/journal/:id', ctrl.getJournalDetails);

// ─── Invoicing ────────────────────────────────────────────────────────────────
router.get('/invoices/summary', ctrl.getInvoiceSummary);
router.get('/invoices', ctrl.getInvoices);
router.post('/invoices', ctrl.createInvoice);
router.get('/invoices/:id', ctrl.getInvoiceDetails);
router.patch('/invoices/:id/status', ctrl.updateInvoiceStatus);
router.post('/invoices/:id/send', ctrl.sendInvoice);
router.post('/invoices/:id/send-reminder', ctrl.sendReminder);
router.post('/invoices/:id/reminder', ctrl.sendReminder);
router.post('/invoices/:id/mark-paid', ctrl.markInvoicePaid);

// ─── Finance Alerts ───────────────────────────────────────────────────────────
router.get('/alerts', ctrl.getAlerts);
router.post('/alerts/clear-resolved', ctrl.clearResolvedAlerts);
router.delete('/alerts/resolved', ctrl.clearResolvedAlerts);
router.post('/alerts/resolved/clear', ctrl.clearResolvedAlerts);
router.get('/alerts/:id', ctrl.getAlertDetails);
router.post('/alerts/:id/action', ctrl.performAlertAction);

// ─── Finance Analytics ────────────────────────────────────────────────────────
router.get('/analytics/revenue-growth', ctrl.getRevenueGrowth);
router.get('/analytics/cash-flow', ctrl.getCashFlow);
router.get('/analytics/expense-breakdown', ctrl.getExpenseBreakdown);
router.post('/analytics/export', ctrl.exportAnalyticsReport);

// ─── Approvals ────────────────────────────────────────────────────────────────
router.get('/approvals/summary', ctrl.getApprovalSummary);
router.get('/approvals/tasks', ctrl.getApprovalTasks);
router.get('/approvals/tasks/:id', ctrl.getTaskDetails);
router.post('/approvals/tasks/:id/decision', ctrl.submitTaskDecision);
router.get('/approvals', ctrl.getApprovalTasks);
router.get('/approvals/:id', ctrl.getTaskDetails);
router.post('/approvals/:id/decision', ctrl.submitTaskDecision);

// ─── Finance Config / Rules ───────────────────────────────────────────────────
router.get('/config/tax-rules', ctrl.getTaxRules);
router.post('/config/tax-rules', ctrl.createTaxRule);
router.put('/config/tax-rules/:ruleId', ctrl.updateTaxRule);
router.get('/config/payout-schedules', ctrl.getPayoutSchedules);
router.post('/config/payout-schedules', ctrl.createPayoutSchedule);
router.put('/config/payout-schedules/:scheduleId', ctrl.updatePayoutSchedule);
router.get('/config/commission-slabs', ctrl.getCommissionSlabs);
router.post('/config/commission-slabs', ctrl.createCommissionSlab);
router.put('/config/commission-slabs/:slabId', ctrl.updateCommissionSlab);
router.get('/config/reconciliation-rules', ctrl.getReconciliationRules);
router.put('/config/reconciliation-rules/:ruleId', ctrl.updateReconciliationRule);
router.get('/config/refund-policies', ctrl.getRefundPolicies);
router.put('/config/refund-policies/:policyId', ctrl.updateRefundPolicy);
router.get('/config/invoice-settings', ctrl.getInvoiceSettings);
router.put('/config/invoice-settings', ctrl.updateInvoiceSettings);
router.get('/config/payment-terms', ctrl.getPaymentTerms);
router.put('/config/payment-terms/:termId', ctrl.updatePaymentTerm);
router.get('/config/financial-limits', ctrl.getFinancialLimits);
router.put('/config/financial-limits/:limitId', ctrl.updateFinancialLimit);
router.get('/config/financial-year', ctrl.getFinancialYear);
router.put('/config/financial-year', ctrl.updateFinancialYear);

export default router;
