import mongoose, { Schema } from 'mongoose';

// ─── Invoice ──────────────────────────────────────────────────────────────────
const invoiceItemSchema = new Schema({ id: String, description: { type: String, required: true }, quantity: { type: Number, required: true }, unitPrice: { type: Number, required: true }, taxPercent: { type: Number, default: 0 } }, { _id: false });

const invoiceSchema = new Schema({
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, index: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true, index: true },
  issueDate: { type: Date, required: true, index: true },
  dueDate: { type: Date, required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true, default: 'INR' },
  status: { type: String, required: true, enum: ['sent', 'pending', 'overdue', 'paid', 'draft', 'cancelled'], index: true },
  items: [invoiceItemSchema],
  notes: String,
  pdfUrl: String,
  lastReminderAt: Date,
}, { timestamps: true });
invoiceSchema.index({ customerId: 1, status: 1 });
invoiceSchema.index({ dueDate: 1, status: 1 });

export const Invoice = mongoose.models.FinanceInvoice || mongoose.model('FinanceInvoice', invoiceSchema, 'finance_invoices');

// ─── Payment Record ───────────────────────────────────────────────────────────
const paymentRecordSchema = new Schema({
  orderId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  methodType: { type: String, required: true, enum: ['card', 'wallet', 'net_banking', 'upi', 'cod'] },
  status: { type: String, required: true, enum: ['pending', 'success', 'failed'], default: 'pending', index: true },
  gatewayRef: String,
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

export const PaymentRecord = mongoose.models.PaymentRecord || mongoose.model('PaymentRecord', paymentRecordSchema);

// ─── Finance Summary ──────────────────────────────────────────────────────────
const financeSummarySchema = new Schema({
  entityId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  totalReceivedToday: { type: Number, default: 0 },
  totalReceivedChangePercent: { type: Number, default: 0 },
  pendingSettlementsAmount: { type: Number, default: 0 },
  pendingSettlementsGateways: { type: Number, default: 0 },
  vendorPayoutsAmount: { type: Number, default: 0 },
  vendorPayoutsStatusText: { type: String, required: true, default: '' },
  failedPaymentsRatePercent: { type: Number, default: 0 },
  failedPaymentsCount: { type: Number, default: 0 },
}, { timestamps: true });

export const FinanceSummary = mongoose.models.FinanceSummary || mongoose.model('FinanceSummary', financeSummarySchema);

// ─── Live Transaction ─────────────────────────────────────────────────────────
const liveTransactionSchema = new Schema({
  txnId: String,
  orderId: String,
  customerId: String,
  amount: Number,
  currency: { type: String, default: 'INR' },
  method: String,
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  gateway: String,
  entityId: String,
}, { timestamps: true });
liveTransactionSchema.index({ entityId: 1, createdAt: -1 });

export const LiveTransaction = mongoose.models.LiveTransaction || mongoose.model('LiveTransaction', liveTransactionSchema);

// ─── Vendor Payment ───────────────────────────────────────────────────────────
const financeVendorPaymentSchema = new Schema({
  paymentId: { type: String, required: true, unique: true },
  vendorId: { type: String, required: true, index: true },
  invoiceId: String,
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  method: { type: String, enum: ['neft', 'rtgs', 'imps', 'upi', 'cheque'], default: 'neft' },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'], default: 'pending' },
  referenceNumber: String,
  paidAt: Date,
  hubKey: String,
  workflowStep: { type: String, default: 'initiated' },
  receiptUrl: String,
}, { timestamps: true });

export const FinanceVendorPayment = mongoose.models.FinanceVendorPayment || mongoose.model('FinanceVendorPayment', financeVendorPaymentSchema, 'finance_vendor_payments');

// ─── Vendor Invoice ───────────────────────────────────────────────────────────
const financeVendorInvoiceSchema = new Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  vendorId: { type: String, required: true, index: true },
  purchaseOrderId: String,
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid', 'overdue'], default: 'pending', index: true },
  dueDate: Date,
  pdfUrl: String,
  approvedBy: String,
  rejectedBy: String,
  rejectionReason: String,
  paidAt: Date,
  hubKey: String,
}, { timestamps: true });

export const FinanceVendorInvoice = mongoose.models.FinanceVendorInvoice || mongoose.model('FinanceVendorInvoice', financeVendorInvoiceSchema, 'finance_vendor_invoices');

// ─── Refund Request ───────────────────────────────────────────────────────────
const refundRequestSchema = new Schema({
  refundId: String,
  orderId: String,
  customerId: String,
  amount: Number,
  reason: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'completed'], default: 'pending', index: true },
  approvedBy: String,
  rejectedBy: String,
  rejectionReason: String,
  completedAt: Date,
  entityId: String,
}, { timestamps: true });
refundRequestSchema.index({ entityId: 1, status: 1 });

export const RefundRequest = mongoose.models.FinanceRefundRequest || mongoose.model('FinanceRefundRequest', refundRequestSchema, 'finance_refund_requests');

// ─── Chargeback Case ──────────────────────────────────────────────────────────
const chargebackSchema = new Schema({
  caseId: String,
  orderId: String,
  customerId: String,
  amount: Number,
  reason: String,
  status: { type: String, enum: ['open', 'investigating', 'resolved', 'lost'], default: 'open' },
  entityId: String,
}, { timestamps: true });

export const ChargebackCase = mongoose.models.ChargebackCase || mongoose.model('ChargebackCase', chargebackSchema);

// ─── Reconciliation Run ───────────────────────────────────────────────────────
const reconRunSchema = new Schema({
  runId: { type: String, required: true, unique: true },
  gateway: String,
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
  totalTransactions: { type: Number, default: 0 },
  matched: { type: Number, default: 0 },
  mismatched: { type: Number, default: 0 },
  exceptions: { type: Number, default: 0 },
  entityId: String,
}, { timestamps: true });

export const ReconciliationRun = mongoose.models.ReconciliationRun || mongoose.model('ReconciliationRun', reconRunSchema);

// ─── Reconciliation Exception ─────────────────────────────────────────────────
const reconExceptionSchema = new Schema({
  exceptionId: String,
  runId: String,
  type: String,
  description: String,
  amount: Number,
  status: { type: String, enum: ['open', 'investigating', 'resolved'], default: 'open' },
  resolvedBy: String,
  entityId: String,
}, { timestamps: true });

export const ReconciliationException = mongoose.models.ReconciliationException || mongoose.model('ReconciliationException', reconExceptionSchema);

// ─── Ledger Entry ────────────────────────────────────────────────────────────
const ledgerEntrySchema = new Schema({
  entryId: String,
  account: String,
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  description: String,
  reference: String,
  entityId: String,
  entryDate: { type: Date, default: Date.now },
}, { timestamps: true });
ledgerEntrySchema.index({ entityId: 1, entryDate: -1 });

export const LedgerEntry = mongoose.models.LedgerEntry || mongoose.model('LedgerEntry', ledgerEntrySchema);

// ─── Journal Entry ────────────────────────────────────────────────────────────
const journalEntrySchema = new Schema({
  journalId: String,
  description: String,
  lines: [{ account: String, debit: Number, credit: Number, description: String }],
  reference: String,
  createdBy: String,
  entityId: String,
  entryDate: { type: Date, default: Date.now },
}, { timestamps: true });

export const JournalEntry = mongoose.models.JournalEntry || mongoose.model('JournalEntry', journalEntrySchema);

// ─── Finance Alert ────────────────────────────────────────────────────────────
const financeAlertSchema = new Schema({
  alertId: String,
  type: String,
  title: String,
  description: String,
  priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
  status: { type: String, enum: ['open', 'acknowledged', 'resolved', 'dismissed'], default: 'open' },
  entityId: String,
}, { timestamps: true });
financeAlertSchema.index({ entityId: 1, status: 1 });

export const FinanceAlert = mongoose.models.FinanceAlert || mongoose.model('FinanceAlert', financeAlertSchema);

// ─── Approval Task ────────────────────────────────────────────────────────────
const approvalTaskSchema = new Schema({
  taskId: String,
  type: String,
  referenceId: String,
  amount: Number,
  requestedBy: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy: String,
  decision: String,
  reason: String,
  entityId: String,
}, { timestamps: true });

export const ApprovalTask = mongoose.models.FinanceApprovalTask || mongoose.model('FinanceApprovalTask', approvalTaskSchema, 'finance_approval_tasks');

// ─── Tax Rule ─────────────────────────────────────────────────────────────────
const taxRuleSchema = new Schema({ name: String, rate: Number, type: String, applicableTo: [String], active: { type: Boolean, default: true }, entityId: String }, { timestamps: true });
export const TaxRule = mongoose.models.TaxRule || mongoose.model('TaxRule', taxRuleSchema);

// ─── Payout Schedule ──────────────────────────────────────────────────────────
const payoutScheduleSchema = new Schema({ name: String, frequency: String, day: Number, active: { type: Boolean, default: true }, entityId: String }, { timestamps: true });
export const PayoutSchedule = mongoose.models.PayoutSchedule || mongoose.model('PayoutSchedule', payoutScheduleSchema);

// ─── Commission Slab ─────────────────────────────────────────────────────────
const commissionSlabSchema = new Schema({ name: String, minAmount: Number, maxAmount: Number, rate: Number, type: String, active: { type: Boolean, default: true }, entityId: String }, { timestamps: true });
export const CommissionSlab = mongoose.models.CommissionSlab || mongoose.model('CommissionSlab', commissionSlabSchema);

// ─── Reconciliation Rule ──────────────────────────────────────────────────────
const reconRuleSchema = new Schema({ name: String, gateway: String, toleranceAmount: Number, autoResolve: { type: Boolean, default: false }, active: { type: Boolean, default: true }, entityId: String }, { timestamps: true });
export const ReconciliationRule = mongoose.models.ReconciliationRule || mongoose.model('ReconciliationRule', reconRuleSchema);

// ─── Refund Policy ────────────────────────────────────────────────────────────
const refundPolicySchema = new Schema({ name: String, maxDays: Number, maxAmount: Number, requiresApproval: { type: Boolean, default: true }, active: { type: Boolean, default: true }, entityId: String }, { timestamps: true });
export const RefundPolicy = mongoose.models.RefundPolicy || mongoose.model('RefundPolicy', refundPolicySchema);

// ─── Invoice Settings Config ─────────────────────────────────────────────────
const invoiceSettingsSchema = new Schema({ entityId: String, prefix: String, nextNumber: Number, dueDays: Number, notes: String, footer: String }, { timestamps: true });
export const InvoiceSettingsConfig = mongoose.models.InvoiceSettingsConfig || mongoose.model('InvoiceSettingsConfig', invoiceSettingsSchema);

// ─── Payment Term ─────────────────────────────────────────────────────────────
const paymentTermSchema = new Schema({ name: String, days: Number, discountPercent: Number, active: { type: Boolean, default: true }, entityId: String }, { timestamps: true });
export const PaymentTerm = mongoose.models.PaymentTerm || mongoose.model('PaymentTerm', paymentTermSchema);

// ─── Financial Limit ──────────────────────────────────────────────────────────
const financialLimitSchema = new Schema({ type: String, limit: Number, currency: { type: String, default: 'INR' }, active: { type: Boolean, default: true }, entityId: String }, { timestamps: true });
export const FinancialLimit = mongoose.models.FinancialLimit || mongoose.model('FinancialLimit', financialLimitSchema);

// ─── Financial Year Config ────────────────────────────────────────────────────
const financialYearSchema = new Schema({ startDate: Date, endDate: Date, label: String, active: { type: Boolean, default: true }, entityId: String }, { timestamps: true });
export const FinancialYearConfig = mongoose.models.FinancialYearConfig || mongoose.model('FinancialYearConfig', financialYearSchema);

// ─── Customer Payment ─────────────────────────────────────────────────────────
const customerPaymentSchema = new Schema({
  paymentId: String,
  orderId: String,
  customerId: String,
  amount: Number,
  currency: { type: String, default: 'INR' },
  method: String,
  status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' },
  gateway: String,
  gatewayRef: String,
  entityId: String,
}, { timestamps: true });
customerPaymentSchema.index({ entityId: 1, status: 1 });
customerPaymentSchema.index({ orderId: 1 });

export const CustomerPayment = mongoose.models.CustomerPayment || mongoose.model('CustomerPayment', customerPaymentSchema);
