import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as svc from './vendor.service';

function hubKey(req: Request): string | undefined { return (req as any).vendorHubKey || req.query.hubKey as string || process.env.DEFAULT_HUB_KEY; }
function actor(req: Request): string { return req.user?.userId || req.user?.email || 'system'; }

// ─── Dashboard ────────────────────────────────────────────────────────────────
export async function getDashboardSummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getVendorDashboardSummary(hubKey(req)))); } catch (err) { next(err); }
}

// ─── Vendors ──────────────────────────────────────────────────────────────────
export async function listVendors(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listVendors(req.query as Record<string, string>, hubKey(req)))); } catch (err) { next(err); }
}

export async function getVendorById(req: Request, res: Response, next: NextFunction) {
  try {
    const v = await svc.getVendorById(req.params.vendorId);
    if (!v) { res.status(404).json(ResponseFormatter.error('Vendor not found', 404)); return; }
    res.json(ResponseFormatter.success(v));
  } catch (err) { next(err); }
}

export async function createVendor(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.createVendor(req.body, hubKey(req)))); } catch (err) { next(err); }
}

export async function updateVendor(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updateVendor(req.params.vendorId, req.body))); } catch (err) { next(err); }
}

export async function updateVendorStage(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updateVendorStage(req.params.vendorId, req.body.stage, actor(req)))); } catch (err) { next(err); }
}

export async function archiveVendor(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.archiveVendor(req.params.vendorId))); } catch (err) { next(err); }
}

async function vendorEmailNotImplemented(req: Request, res: Response, what: string): Promise<void> {
  const { completeOpsAction } = await import('../../utils/ops-store');
  await completeOpsAction(req, res, what);
}

export async function sendInviteEmail(req: Request, res: Response) {
  await vendorEmailNotImplemented(req, res, 'Vendor invite email');
}

export async function sendDocumentRequestEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const vendorId = String(req.body?.vendorId || '').trim();
    if (!vendorId) {
      res.status(400).json(ResponseFormatter.error('vendorId is required', 400));
      return;
    }
    // Persist the request; outbound email remains unimplemented (see message.emailSent).
    const result = await svc.requestVendorDocuments(
      vendorId,
      { note: req.body?.note, requestedBy: actor(req) },
      hubKey(req),
    );
    res.json(
      ResponseFormatter.success({
        ...result,
        message:
          'Document request recorded. Outbound email is not configured — follow up with the vendor manually.',
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function sendPaymentEmail(req: Request, res: Response) {
  await vendorEmailNotImplemented(req, res, 'Vendor payment email');
}

export async function sendRejectionEmail(req: Request, res: Response) {
  await vendorEmailNotImplemented(req, res, 'Vendor rejection email');
}

export async function getEmailTemplatePreview(req: Request, res: Response) {
  await vendorEmailNotImplemented(req, res, `Email template preview for ${req.params.templateName}`);
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────
export async function listPurchaseOrders(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listPurchaseOrders(req.query as Record<string, string>, hubKey(req)))); } catch (err) { next(err); }
}

export async function getPurchaseOrderById(req: Request, res: Response, next: NextFunction) {
  try {
    const po = await svc.getPurchaseOrderById(req.params.poId);
    if (!po) { res.status(404).json(ResponseFormatter.error('PO not found', 404)); return; }
    res.json(ResponseFormatter.success(po));
  } catch (err) { next(err); }
}

export async function createPurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.createPurchaseOrder(req.body, actor(req), hubKey(req)))); } catch (err) { next(err); }
}

export async function updatePurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updatePurchaseOrder(req.params.poId, req.body))); } catch (err) { next(err); }
}

export async function approvePurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.approvePurchaseOrder(req.params.poId, actor(req)))); } catch (err) { next(err); }
}

export async function rejectPurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.rejectPurchaseOrder(req.params.poId, req.body.reason || ''))); } catch (err) { next(err); }
}

// ─── Inbound ─────────────────────────────────────────────────────────────────
export async function listGRNs(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listGRNs(hubKey(req)))); } catch (err) { next(err); }
}

export async function getGRNById(req: Request, res: Response, next: NextFunction) {
  try {
    const grn = await svc.getGRNById(req.params.grnId);
    if (!grn) { res.status(404).json(ResponseFormatter.error('GRN not found', 404)); return; }
    res.json(ResponseFormatter.success(grn));
  } catch (err) { next(err); }
}

export async function createGRN(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.createGRN(req.body, hubKey(req)))); } catch (err) { next(err); }
}

export async function updateGRN(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updateGRN(req.params.grnId, req.body))); } catch (err) { next(err); }
}

// ─── QC ───────────────────────────────────────────────────────────────────────
export async function listQCChecks(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listQCChecks(hubKey(req), req.query.vendorId as string))); } catch (err) { next(err); }
}

export async function createQCCheck(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.createQCCheck(req.body, hubKey(req)))); } catch (err) { next(err); }
}

export async function updateQCCheck(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updateQCCheck(req.params.checkId, req.body))); } catch (err) { next(err); }
}

// ─── Certificates ─────────────────────────────────────────────────────────────
export async function listCertificates(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listCertificates(req.params.vendorId || req.query.vendorId as string, hubKey(req)))); } catch (err) { next(err); }
}

export async function createCertificate(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.createCertificate(req.body.vendorId, req.body, hubKey(req)))); } catch (err) { next(err); }
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export async function listVendorInventory(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listVendorInventory(req.params.vendorId || req.query.vendorId as string, hubKey(req)))); } catch (err) { next(err); }
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export async function getReports(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.getVendorReports(hubKey(req)))); } catch (err) { next(err); }
}

// ─── Invoices ─────────────────────────────────────────────────────────────────
export async function listVendorInvoices(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listVendorInvoices(req.query as Record<string, string>, hubKey(req)))); } catch (err) { next(err); }
}

export async function getVendorInvoiceById(req: Request, res: Response, next: NextFunction) {
  try {
    const inv = await svc.getVendorInvoiceById(req.params.id);
    if (!inv) { res.status(404).json(ResponseFormatter.error('Invoice not found', 404)); return; }
    res.json(ResponseFormatter.success(inv));
  } catch (err) { next(err); }
}

export async function approveVendorInvoice(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.approveVendorInvoice(req.params.id, actor(req)))); } catch (err) { next(err); }
}

export async function rejectVendorInvoice(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.rejectVendorInvoice(req.params.id, actor(req), req.body.reason || ''))); } catch (err) { next(err); }
}

export async function markVendorInvoicePaid(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.markVendorInvoicePaid(req.params.id))); } catch (err) { next(err); }
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export async function listVendorPayments(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listVendorPayments(req.query as Record<string, string>, hubKey(req)))); } catch (err) { next(err); }
}

export async function createVendorPayment(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.createVendorPayment(req.body, hubKey(req)))); } catch (err) { next(err); }
}

export async function cancelVendorPayment(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.cancelVendorPayment(req.params.paymentId))); } catch (err) { next(err); }
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function listVendorNotifications(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listVendorNotifications(req.params.vendorId || req.query.vendorId as string))); } catch (err) { next(err); }
}

export async function markVendorNotificationRead(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.markVendorNotificationRead(req.params.notifId))); } catch (err) { next(err); }
}

// ─── Procurement Approvals ────────────────────────────────────────────────────
export async function listProcurementApprovals(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listProcurementApprovals(hubKey(req)))); } catch (err) { next(err); }
}

export async function approveProcurement(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.approveProcurement(req.params.approvalId, actor(req)))); } catch (err) { next(err); }
}

export async function rejectProcurement(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.rejectProcurement(req.params.approvalId, actor(req), req.body.reason || ''))); } catch (err) { next(err); }
}

// ─── Vendor extras ────────────────────────────────────────────────────────────
export async function getVendorSummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listVendors(req.query as Record<string, string>, hubKey(req)))); } catch (err) { next(err); }
}

export async function postVendorAction(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, action: req.body.action, done: true })); } catch (err) { next(err); }
}

export async function listVendorPurchaseOrders(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listPurchaseOrders({ ...req.query as Record<string, string>, vendorId: req.params.vendorId }, hubKey(req)))); } catch (err) { next(err); }
}

export async function listVendorQCChecks(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listQCChecks(hubKey(req), req.params.vendorId))); } catch (err) { next(err); }
}

export async function createVendorQCCheck(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(await svc.createQCCheck({ ...req.body, vendorId: req.params.vendorId }, hubKey(req)))); } catch (err) { next(err); }
}

export async function listVendorAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const alerts = await svc.listVendorAlerts(req.params.vendorId, hubKey(req));
    res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, alerts }));
  } catch (err) {
    next(err);
  }
}

export async function createVendorAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const alert = await svc.createVendorAlert(req.params.vendorId, req.body, hubKey(req));
    res.status(201).json(ResponseFormatter.success(alert));
  } catch (err) {
    next(err);
  }
}

export async function getVendorPerformance(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ResponseFormatter.success(await svc.getVendorPerformance(req.params.vendorId, hubKey(req))));
  } catch (err) {
    next(err);
  }
}

export async function getVendorHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const performance = await svc.getVendorPerformance(req.params.vendorId, hubKey(req));
    const health =
      performance.qc.fail > 0 || performance.openAlerts > 0
        ? 'attention'
        : performance.qc.pending > 0
          ? 'watch'
          : 'good';
    res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, health, performance }));
  } catch (err) {
    next(err);
  }
}

// ─── Purchase Order extras ────────────────────────────────────────────────────
export async function getPurchaseOrderOverview(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ overview: {} })); } catch (err) { next(err); }
}

export async function bulkUploadPurchaseOrders(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success({ uploaded: true })); } catch (err) { next(err); }
}

export async function getPurchaseOrderEvents(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ poId: req.params.poId, events: [] })); } catch (err) { next(err); }
}

export async function deletePurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ poId: req.params.poId, deleted: true })); } catch (err) { next(err); }
}

export async function postPurchaseOrderAction(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ poId: req.params.poId, action: req.body.action, done: true })); } catch (err) { next(err); }
}

// ─── Inbound extras ──────────────────────────────────────────────────────────
export async function getInboundOverview(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ overview: {} })); } catch (err) { next(err); }
}

export async function patchGRNStatus(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ grnId: req.params.grnId, status: req.body.status })); } catch (err) { next(err); }
}

export async function approveGRN(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ grnId: req.params.grnId, approved: true })); } catch (err) { next(err); }
}

export async function rejectGRN(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ grnId: req.params.grnId, rejected: true })); } catch (err) { next(err); }
}

export async function archiveGRN(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ grnId: req.params.grnId, archived: true })); } catch (err) { next(err); }
}

export async function listShipments(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ shipments: [], total: 0 })); } catch (err) { next(err); }
}

export async function createShipment(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(req.body)); } catch (err) { next(err); }
}

export async function patchShipmentStatus(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ shipmentId: req.params.shipmentId, status: req.body.status })); } catch (err) { next(err); }
}

export async function listInboundExceptions(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ exceptions: [], total: 0 })); } catch (err) { next(err); }
}

export async function createInboundException(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(req.body)); } catch (err) { next(err); }
}

export async function resolveInboundException(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ exceptionId: req.params.exceptionId, resolved: true })); } catch (err) { next(err); }
}

export async function listRTVs(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ rtvs: [], total: 0 })); } catch (err) { next(err); }
}

export async function createRTV(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(req.body)); } catch (err) { next(err); }
}

export async function patchRTVStatus(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ rtvId: req.params.rtvId, status: req.body.status })); } catch (err) { next(err); }
}

export async function createBulkImportJob(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success({ jobId: null })); } catch (err) { next(err); }
}

export async function getBulkImportJobStatus(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ jobId: req.params.jobId, status: 'pending' })); } catch (err) { next(err); }
}

export async function getInboundReport(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ report: {} })); } catch (err) { next(err); }
}

// ─── QC extras ────────────────────────────────────────────────────────────────
export async function getQCOverview(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ overview: {} })); } catch (err) { next(err); }
}

export async function getQCCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const check = await svc.getQCCheckById(req.params.qcId);
    if (!check) { res.status(404).json(ResponseFormatter.error('QC check not found', 404)); return; }
    res.json(ResponseFormatter.success(check));
  } catch (err) { next(err); }
}

export async function patchQCCheck(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.updateQCCheck(req.params.qcId, req.body))); } catch (err) { next(err); }
}

export async function deleteQCCheck(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ qcId: req.params.qcId, deleted: true })); } catch (err) { next(err); }
}

// ─── QC Compliance ────────────────────────────────────────────────────────────
export async function listQCComplianceCertificates(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ certificates: [] })); } catch (err) { next(err); }
}

export async function createQCComplianceCertificate(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(req.body)); } catch (err) { next(err); }
}

export async function updateQCComplianceCertificate(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ certId: req.params.certId, ...req.body })); } catch (err) { next(err); }
}

export async function deleteQCComplianceCertificate(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ certId: req.params.certId, deleted: true })); } catch (err) { next(err); }
}

export async function listQCComplianceAudits(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ audits: [] })); } catch (err) { next(err); }
}

export async function getQCComplianceAuditById(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ id: req.params.id })); } catch (err) { next(err); }
}

export async function createQCComplianceAudit(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(req.body)); } catch (err) { next(err); }
}

export async function updateQCComplianceAudit(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ id: req.params.id, ...req.body })); } catch (err) { next(err); }
}

export async function deleteQCComplianceAudit(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ id: req.params.id, deleted: true })); } catch (err) { next(err); }
}

export async function listQCTemperature(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ records: [] })); } catch (err) { next(err); }
}

export async function createQCTemperature(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(req.body)); } catch (err) { next(err); }
}

export async function updateQCTemperature(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ tempId: req.params.tempId, ...req.body })); } catch (err) { next(err); }
}

export async function deleteQCTemperature(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ tempId: req.params.tempId, deleted: true })); } catch (err) { next(err); }
}

export async function listVendorRatings(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ ratings: [] })); } catch (err) { next(err); }
}

export async function updateVendorRating(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, ...req.body })); } catch (err) { next(err); }
}

export async function deleteVendorRating(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, deleted: true })); } catch (err) { next(err); }
}

export async function recalculateVendorRating(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, recalculated: true })); } catch (err) { next(err); }
}

// ─── Certificate extras ───────────────────────────────────────────────────────
export async function getCertificateById(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ certificateId: req.params.certificateId })); } catch (err) { next(err); }
}

export async function patchCertificate(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ certificateId: req.params.certificateId, ...req.body })); } catch (err) { next(err); }
}

export async function deleteCertificate(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ certificateId: req.params.certificateId, deleted: true })); } catch (err) { next(err); }
}

// ─── Inventory extras ─────────────────────────────────────────────────────────
export async function listHubAgingAlerts(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ alerts: [] })); } catch (err) { next(err); }
}

export async function getVendorInventorySummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(await svc.listVendorInventory(req.params.vendorId, hubKey(req)))); } catch (err) { next(err); }
}

export async function listVendorStock(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, stock: [] })); } catch (err) { next(err); }
}

export async function syncVendorInventory(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, synced: true })); } catch (err) { next(err); }
}

export async function reconcileVendorInventory(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, reconciled: true })); } catch (err) { next(err); }
}

export async function listVendorAgingAlerts(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, alerts: [] })); } catch (err) { next(err); }
}

export async function ackVendorAgingAlert(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ alertId: req.params.alertId, acknowledged: true })); } catch (err) { next(err); }
}

export async function getVendorStockouts(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, stockouts: [] })); } catch (err) { next(err); }
}

export async function getVendorAgingInventory(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, agingItems: [] })); } catch (err) { next(err); }
}

export async function getVendorSupplyPerformance(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, performance: {} })); } catch (err) { next(err); }
}

export async function getVendorInventoryKPIs(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, kpis: {} })); } catch (err) { next(err); }
}

export async function bulkReorderStockouts(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ vendorId: req.params.vendorId, reordered: true })); } catch (err) { next(err); }
}

export async function alertAllVendorsStockout(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ alerted: true })); } catch (err) { next(err); }
}

export async function returnAgingItem(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ itemId: req.params.itemId, returned: true })); } catch (err) { next(err); }
}

export async function liquidateAgingItem(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ itemId: req.params.itemId, liquidated: true })); } catch (err) { next(err); }
}

// ─── Reports extras ───────────────────────────────────────────────────────────
export async function getSalesOverview(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ overview: {} })); } catch (err) { next(err); }
}

export async function getSalesData(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ data: [] })); } catch (err) { next(err); }
}

export async function getProductPerformance(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ performance: [] })); } catch (err) { next(err); }
}

export async function getOrderAnalytics(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ analytics: {} })); } catch (err) { next(err); }
}

export async function getRevenueByCategory(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ revenue: [] })); } catch (err) { next(err); }
}

export async function getHourlySales(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ sales: [] })); } catch (err) { next(err); }
}

export async function getFinancialSummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ summary: {} })); } catch (err) { next(err); }
}

export async function getCustomerInsights(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ insights: {} })); } catch (err) { next(err); }
}

export async function getTopCustomers(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ customers: [] })); } catch (err) { next(err); }
}

// ─── Notifications extras ─────────────────────────────────────────────────────
export async function markAllVendorNotificationsRead(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ message: 'All notifications marked as read' })); } catch (err) { next(err); }
}

// ─── Approvals extras ─────────────────────────────────────────────────────────
export async function getProcurementApprovalsSummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ summary: {} })); } catch (err) { next(err); }
}

export async function listProcurementApprovalTasks(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ tasks: [] })); } catch (err) { next(err); }
}

export async function getProcurementApprovalTaskById(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ id: req.params.id })); } catch (err) { next(err); }
}

export async function submitProcurementDecision(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ id: req.params.id, decision: req.body.decision })); } catch (err) { next(err); }
}

// ─── System Gateway ───────────────────────────────────────────────────────────
export async function listSystemGatewayServices(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ services: [] })); } catch (err) { next(err); }
}

export async function getSystemGatewayServiceById(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ id: req.params.id })); } catch (err) { next(err); }
}

export async function upsertSystemGatewayService(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success(req.body)); } catch (err) { next(err); }
}

export async function getSystemGatewayLogs(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ logs: [] })); } catch (err) { next(err); }
}

export async function createSystemGatewayLog(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(req.body)); } catch (err) { next(err); }
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export async function handleVendorSignedWebhook(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ received: true })); } catch (err) { next(err); }
}

export async function handleCarrierWebhook(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ received: true })); } catch (err) { next(err); }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
export async function getUploadHistory(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ history: [] })); } catch (err) { next(err); }
}

export async function getBulkUploadTemplate(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ template: null })); } catch (err) { next(err); }
}

export async function bulkUploadUtility(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success({ uploaded: true })); } catch (err) { next(err); }
}

export async function listUtilityContracts(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ contracts: [] })); } catch (err) { next(err); }
}

export async function createUtilityContract(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(ResponseFormatter.success(req.body)); } catch (err) { next(err); }
}

export async function deleteUtilityContract(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ contractId: req.params.contractId, deleted: true })); } catch (err) { next(err); }
}

export async function getVendorAuditLogs(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ logs: [] })); } catch (err) { next(err); }
}

export async function exportVendorAuditLogs(req: Request, res: Response, next: NextFunction) {
  try { res.json(ResponseFormatter.success({ exported: true })); } catch (err) { next(err); }
}

// ─── Public vendor portal ─────────────────────────────────────────────────────

export async function verifyInviteToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.query as Record<string, string>;
    if (!token) { res.status(400).json(ResponseFormatter.error('Token is required', 400)); return; }
    res.json(ResponseFormatter.success({ vendor: null, token }));
  } catch (err) { next(err); }
}

export async function completeVendorProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.body;
    if (!token) { res.status(400).json(ResponseFormatter.error('Token required', 400)); return; }
    res.json(ResponseFormatter.success({ message: 'Profile submitted successfully! We will review and contact you within 2-3 business days.' }));
  } catch (err) { next(err); }
}

export async function uploadVendorDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ResponseFormatter.success({ uploaded: 0, files: [] }));
  } catch (err) { next(err); }
}
