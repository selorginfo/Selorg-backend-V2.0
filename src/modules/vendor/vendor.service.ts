import { Vendor, PurchaseOrder, VendorGRN, VendorContract, VendorRating, VendorInvoice, VendorPayment, VendorQCCheck, Certificate, VendorInventoryItem, VendorAlert, Shipment, ProcurementApproval, VendorNotification, RTV, SystemLog } from './vendor.models';

function genId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }

// ─── Vendors ──────────────────────────────────────────────────────────────────

export async function listVendors(filters: Record<string, string> = {}, hubKey?: string) {
  const query: any = {};
  if (hubKey) query.hubKey = hubKey;
  if (filters.status) query.status = filters.status;
  if (filters.stage) query.stage = filters.stage;
  if (filters.search) query.$or = [{ vendorName: { $regex: filters.search, $options: 'i' } }, { name: { $regex: filters.search, $options: 'i' } }, { vendorCode: { $regex: filters.search, $options: 'i' } }];
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [vendors, total] = await Promise.all([Vendor.find(query).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 }).lean(), Vendor.countDocuments(query)]);
  return { vendors, total, page, limit };
}

export async function getVendorById(vendorId: string) {
  return Vendor.findById(vendorId).lean();
}

export async function createVendor(data: Record<string, unknown>, hubKey?: string) {
  const vendorCode = genId('VND');
  return Vendor.create({ vendorCode, code: vendorCode, ...data, hubKey });
}

export async function updateVendor(vendorId: string, updates: Record<string, unknown>) {
  return Vendor.findByIdAndUpdate(vendorId, updates, { new: true }).lean();
}

export async function updateVendorStage(vendorId: string, stage: string, updatedBy: string) {
  return Vendor.findByIdAndUpdate(vendorId, { stage, [`metadata.stage_${stage}_at`]: new Date().toISOString() }, { new: true }).lean();
}

export async function archiveVendor(vendorId: string) {
  return Vendor.findByIdAndUpdate(vendorId, { archived: true }, { new: true }).lean();
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export async function listPurchaseOrders(filters: Record<string, string> = {}, hubKey?: string) {
  const query: any = {};
  if (hubKey) query.hubKey = hubKey;
  if (filters.vendorId) query.vendorId = filters.vendorId;
  if (filters.status) query.status = filters.status;
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [items, total] = await Promise.all([PurchaseOrder.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), PurchaseOrder.countDocuments(query)]);
  return { items, total, page, limit };
}

export async function getPurchaseOrderById(poId: string) {
  return PurchaseOrder.findById(poId).lean();
}

export async function createPurchaseOrder(data: Record<string, unknown>, createdBy: string, hubKey?: string) {
  return PurchaseOrder.create({ ...data, createdBy, hubKey, status: 'draft' });
}

export async function updatePurchaseOrder(poId: string, updates: Record<string, unknown>) {
  return PurchaseOrder.findByIdAndUpdate(poId, updates, { new: true }).lean();
}

export async function approvePurchaseOrder(poId: string, approvedBy: string) {
  return PurchaseOrder.findByIdAndUpdate(poId, { status: 'approved' }, { new: true }).lean();
}

export async function rejectPurchaseOrder(poId: string, reason: string) {
  return PurchaseOrder.findByIdAndUpdate(poId, { status: 'rejected' }, { new: true }).lean();
}

// ─── Inbound / GRN ───────────────────────────────────────────────────────────

export async function listGRNs(hubKey?: string) {
  const query: any = {};
  if (hubKey) query.hub_key = hubKey;
  return VendorGRN.find(query).sort({ createdAt: -1 }).lean();
}

export async function getGRNById(grnId: string) {
  return VendorGRN.findOne({ grn_id: grnId }).lean();
}

export async function createGRN(data: Record<string, unknown>, hubKey?: string) {
  return VendorGRN.create({ grn_id: genId('VGRN'), ...data, hub_key: hubKey, status: 'pending' });
}

export async function updateGRN(grnId: string, updates: Record<string, unknown>) {
  return VendorGRN.findOneAndUpdate({ grn_id: grnId }, updates, { new: true }).lean();
}

// ─── QC ───────────────────────────────────────────────────────────────────────

export async function listQCChecks(hubKey?: string, vendorId?: string) {
  const query: any = {};
  if (hubKey) query.hubKey = hubKey;
  if (vendorId) query.vendorId = vendorId;
  return VendorQCCheck.find(query).sort({ createdAt: -1 }).lean();
}

export async function createQCCheck(data: Record<string, unknown>, hubKey?: string) {
  return VendorQCCheck.create({ checkId: genId('QC'), ...data, hubKey });
}

export async function updateQCCheck(checkId: string, updates: Record<string, unknown>) {
  return VendorQCCheck.findOneAndUpdate({ checkId }, updates, { new: true }).lean();
}

// ─── Certificates ─────────────────────────────────────────────────────────────

export async function listCertificates(vendorId: string, hubKey?: string) {
  const query: any = { vendorId };
  if (hubKey) query.hubKey = hubKey;
  return Certificate.find(query).lean();
}

export async function createCertificate(vendorId: string, data: Record<string, unknown>, hubKey?: string) {
  return Certificate.create({ vendorId, ...data, hubKey });
}

export async function updateCertificate(certId: string, updates: Record<string, unknown>) {
  return Certificate.findByIdAndUpdate(certId, updates, { new: true }).lean();
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function listVendorInventory(vendorId: string, hubKey?: string) {
  const query: any = { vendorId };
  if (hubKey) query.hubKey = hubKey;
  return VendorInventoryItem.find(query).lean();
}

export async function updateVendorInventoryItem(vendorId: string, sku: string, updates: Record<string, unknown>) {
  return VendorInventoryItem.findOneAndUpdate({ vendorId, sku }, updates, { new: true, upsert: true }).lean();
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function getVendorReports(hubKey?: string) {
  const query: any = {};
  if (hubKey) query.hubKey = hubKey;
  const [totalVendors, approved, pending, totalPOs] = await Promise.all([
    Vendor.countDocuments({ ...query, archived: false }),
    Vendor.countDocuments({ ...query, status: 'approved' }),
    Vendor.countDocuments({ ...query, status: 'pending' }),
    PurchaseOrder.countDocuments(query),
  ]);
  return { total_vendors: totalVendors, approved, pending, total_purchase_orders: totalPOs };
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function listVendorInvoices(filters: Record<string, string> = {}, hubKey?: string) {
  const query: any = {};
  if (hubKey) query.hubKey = hubKey;
  if (filters.vendorId) query.vendorId = filters.vendorId;
  if (filters.status) query.status = filters.status;
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [items, total] = await Promise.all([VendorInvoice.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), VendorInvoice.countDocuments(query)]);
  return { items, total, page, limit };
}

export async function getVendorInvoiceById(invoiceId: string) {
  return VendorInvoice.findById(invoiceId).lean();
}

export async function approveVendorInvoice(invoiceId: string, approvedBy: string) {
  return VendorInvoice.findByIdAndUpdate(invoiceId, { status: 'approved', approvedBy }, { new: true }).lean();
}

export async function rejectVendorInvoice(invoiceId: string, rejectedBy: string, reason: string) {
  return VendorInvoice.findByIdAndUpdate(invoiceId, { status: 'rejected', rejectedBy, rejectionReason: reason }, { new: true }).lean();
}

export async function markVendorInvoicePaid(invoiceId: string) {
  return VendorInvoice.findByIdAndUpdate(invoiceId, { status: 'paid', paidAt: new Date() }, { new: true }).lean();
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function listVendorPayments(filters: Record<string, string> = {}, hubKey?: string) {
  const query: any = {};
  if (hubKey) query.hubKey = hubKey;
  if (filters.vendorId) query.vendorId = filters.vendorId;
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const [items, total] = await Promise.all([VendorPayment.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), VendorPayment.countDocuments(query)]);
  return { items, total, page, limit };
}

export async function createVendorPayment(data: Record<string, unknown>, hubKey?: string) {
  return VendorPayment.create({ paymentId: genId('VPAY'), ...data, hubKey });
}

export async function cancelVendorPayment(paymentId: string) {
  return VendorPayment.findOneAndUpdate({ paymentId }, { status: 'cancelled' }, { new: true }).lean();
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function listVendorNotifications(vendorId: string) {
  return VendorNotification.find({ vendorId }).sort({ createdAt: -1 }).limit(50).lean();
}

export async function markVendorNotificationRead(notifId: string) {
  return VendorNotification.findByIdAndUpdate(notifId, { read: true }, { new: true }).lean();
}

// ─── Procurement Approvals ────────────────────────────────────────────────────

export async function listProcurementApprovals(hubKey?: string) {
  return ProcurementApproval.find(hubKey ? { hubKey } : {}).sort({ createdAt: -1 }).lean();
}

export async function approveProcurement(approvalId: string, approvedBy: string) {
  return ProcurementApproval.findOneAndUpdate({ approvalId }, { status: 'approved', approvedBy }, { new: true }).lean();
}

export async function rejectProcurement(approvalId: string, rejectedBy: string, reason: string) {
  return ProcurementApproval.findOneAndUpdate({ approvalId }, { status: 'rejected', rejectedBy, reason }, { new: true }).lean();
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export async function getQCCheckById(qcId: string) {
  return VendorQCCheck.findById(qcId).lean();
}

export async function getVendorDashboardSummary(hubKey?: string) {
  const query: any = hubKey ? { hubKey } : {};
  const [activeVendors, pendingInvoices, pendingApprovals, openAlerts] = await Promise.all([
    Vendor.countDocuments({ ...query, status: 'approved', archived: false }),
    VendorInvoice.countDocuments({ ...query, status: 'pending' }),
    ProcurementApproval.countDocuments({ ...query, status: 'pending' }),
    VendorAlert.countDocuments({ ...query, status: 'open' }),
  ]);
  return { active_vendors: activeVendors, pending_invoices: pendingInvoices, pending_approvals: pendingApprovals, open_alerts: openAlerts };
}

export async function listVendorAlerts(vendorId: string, hubKey?: string) {
  const query: Record<string, unknown> = { vendorId };
  if (hubKey) query.hubKey = hubKey;
  return VendorAlert.find(query).sort({ createdAt: -1 }).limit(100).lean();
}

export async function createVendorAlert(
  vendorId: string,
  data: { type?: string; title?: string; message?: string; priority?: string },
  hubKey?: string,
) {
  return VendorAlert.create({
    alertId: genId('VAL'),
    vendorId,
    type: data.type || 'general',
    title: data.title || 'Vendor alert',
    message: data.message || '',
    priority: data.priority || 'medium',
    status: 'open',
    hubKey,
  });
}

/**
 * Record a document request as an open alert + in-app notification.
 * Outbound email is not wired (see sendDocumentRequestEmail 501) — this persists the ops
 * follow-up so the dashboard action is not a silent no-op.
 */
export async function requestVendorDocuments(
  vendorId: string,
  opts: { note?: string; requestedBy?: string } = {},
  hubKey?: string,
) {
  const title = 'Documents requested';
  const message = opts.note?.trim() || 'Please upload the outstanding compliance documents.';
  const [alert, notification] = await Promise.all([
    createVendorAlert(vendorId, { type: 'document_request', title, message, priority: 'high' }, hubKey),
    VendorNotification.create({
      vendorId,
      type: 'document_request',
      title,
      body: message,
      hubKey,
    }),
  ]);
  await SystemLog.create({
    action: 'vendor_documents_requested',
    actor: opts.requestedBy || 'admin',
    details: { vendorId, alertId: (alert as { alertId?: string }).alertId },
    status: 'ok',
    hubKey,
  }).catch(() => undefined);
  return { alert, notification, emailSent: false };
}

/** Aggregate QC outcomes for a vendor — replaces the empty `performance: {}` stub. */
export async function getVendorPerformance(vendorId: string, hubKey?: string) {
  const query: Record<string, unknown> = { vendorId };
  if (hubKey) query.hubKey = hubKey;
  const [checks, alerts, certificates] = await Promise.all([
    VendorQCCheck.find(query).lean(),
    VendorAlert.countDocuments({ ...query, status: 'open' }),
    Certificate.find(query).lean(),
  ]);
  const pass = checks.filter((c) => c.status === 'pass').length;
  const fail = checks.filter((c) => c.status === 'fail').length;
  const pending = checks.filter((c) => c.status === 'pending').length;
  return {
    vendorId,
    qc: { total: checks.length, pass, fail, pending, passRate: checks.length ? Math.round((pass / checks.length) * 1000) / 10 : 0 },
    openAlerts: alerts,
    certificates: {
      total: certificates.length,
      valid: certificates.filter((c) => c.status === 'valid').length,
      expired: certificates.filter((c) => c.status === 'expired').length,
    },
  };
}
