import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth.middleware';
import * as ctrl from './vendor.controller';

const router = Router();

// ─── Public vendor portal (no auth required) ──────────────────────────────────
router.get('/public/verify-token', ctrl.verifyInviteToken);
router.post('/public/complete-profile', ctrl.completeVendorProfile);
router.post('/public/upload-documents/:vendorId', ctrl.uploadVendorDocuments);

// All other vendor routes require admin auth
router.use(authenticateAdmin);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard/summary', ctrl.getDashboardSummary);

// ─── Vendors ──────────────────────────────────────────────────────────────────
router.get('/vendors/summary', ctrl.getVendorSummary);
router.get('/vendors/email-preview/:templateName', ctrl.getEmailTemplatePreview);
router.post('/vendors/send-invite-email', ctrl.sendInviteEmail);
router.post('/vendors/send-doc-request-email', ctrl.sendDocumentRequestEmail);
router.post('/vendors/send-payment-email', ctrl.sendPaymentEmail);
router.post('/vendors/send-rejection-email', ctrl.sendRejectionEmail);
router.get('/vendors', ctrl.listVendors);
router.post('/vendors', ctrl.createVendor);
router.get('/vendors/:vendorId/certificates', ctrl.listCertificates);
router.get('/vendors/:vendorId/inventory', ctrl.listVendorInventory);
router.get('/vendors/:vendorId/invoices', ctrl.listVendorInvoices);
router.get('/vendors/:vendorId/notifications', ctrl.listVendorNotifications);
router.get('/vendors/:vendorId/purchase-orders', ctrl.listVendorPurchaseOrders);
router.get('/vendors/:vendorId/qc-checks', ctrl.listVendorQCChecks);
router.post('/vendors/:vendorId/qc-checks', ctrl.createVendorQCCheck);
router.get('/vendors/:vendorId/alerts', ctrl.listVendorAlerts);
router.post('/vendors/:vendorId/alerts', ctrl.createVendorAlert);
router.get('/vendors/:vendorId/performance', ctrl.getVendorPerformance);
router.get('/vendors/:vendorId/health', ctrl.getVendorHealth);
router.get('/vendors/:vendorId', ctrl.getVendorById);
router.put('/vendors/:vendorId', ctrl.updateVendor);
router.patch('/vendors/:vendorId/stage', ctrl.updateVendorStage);
router.patch('/vendors/:vendorId', ctrl.updateVendor);
router.delete('/vendors/:vendorId', ctrl.archiveVendor);
router.post('/vendors/:vendorId/actions', ctrl.postVendorAction);

// ─── Purchase Orders ──────────────────────────────────────────────────────────
router.get('/purchase-orders/overview', ctrl.getPurchaseOrderOverview);
router.get('/purchase-orders', ctrl.listPurchaseOrders);
router.post('/purchase-orders/bulk-upload', ctrl.bulkUploadPurchaseOrders);
router.post('/purchase-orders', ctrl.createPurchaseOrder);
router.get('/purchase-orders/:poId/events', ctrl.getPurchaseOrderEvents);
router.get('/purchase-orders/:poId', ctrl.getPurchaseOrderById);
router.put('/purchase-orders/:poId', ctrl.updatePurchaseOrder);
router.patch('/purchase-orders/:poId', ctrl.updatePurchaseOrder);
router.delete('/purchase-orders/:poId', ctrl.deletePurchaseOrder);
router.post('/purchase-orders/:poId/actions', ctrl.postPurchaseOrderAction);
router.post('/purchase-orders/:poId/approve', ctrl.approvePurchaseOrder);
router.post('/purchase-orders/:poId/reject', ctrl.rejectPurchaseOrder);

// ─── Inbound ─────────────────────────────────────────────────────────────────
router.get('/inbound/overview', ctrl.getInboundOverview);
router.get('/inbound/grns', ctrl.listGRNs);
router.post('/inbound/grns', ctrl.createGRN);
router.get('/inbound/grns/:grnId', ctrl.getGRNById);
router.put('/inbound/grns/:grnId', ctrl.updateGRN);
router.patch('/inbound/grns/:grnId/status', ctrl.patchGRNStatus);
router.post('/inbound/grns/:grnId/approve', ctrl.approveGRN);
router.post('/inbound/grns/:grnId/reject', ctrl.rejectGRN);
router.post('/inbound/grns/:grnId/archive', ctrl.archiveGRN);
router.get('/inbound/grn', ctrl.listGRNs);
router.post('/inbound/grn', ctrl.createGRN);
router.get('/inbound/grn/:grnId', ctrl.getGRNById);
router.put('/inbound/grn/:grnId', ctrl.updateGRN);
router.get('/inbound/shipments', ctrl.listShipments);
router.post('/inbound/shipments', ctrl.createShipment);
router.patch('/inbound/shipments/:shipmentId/status', ctrl.patchShipmentStatus);
router.get('/inbound/exceptions', ctrl.listInboundExceptions);
router.post('/inbound/exceptions', ctrl.createInboundException);
router.post('/inbound/exceptions/:exceptionId/resolve', ctrl.resolveInboundException);
router.get('/inbound/rtvs', ctrl.listRTVs);
router.post('/inbound/rtvs', ctrl.createRTV);
router.patch('/inbound/rtvs/:rtvId/status', ctrl.patchRTVStatus);
router.post('/inbound/bulk-import', ctrl.createBulkImportJob);
router.get('/inbound/bulk-import/:jobId', ctrl.getBulkImportJobStatus);
router.get('/inbound/report', ctrl.getInboundReport);

// ─── QC ───────────────────────────────────────────────────────────────────────
router.get('/qc/overview', ctrl.getQCOverview);
router.get('/qc', ctrl.listQCChecks);
router.post('/qc', ctrl.createQCCheck);
router.get('/qc/:qcId', ctrl.getQCCheck);
router.patch('/qc/:qcId', ctrl.patchQCCheck);
router.put('/qc/:checkId', ctrl.updateQCCheck);
router.delete('/qc/:qcId', ctrl.deleteQCCheck);

// ─── QC Compliance ────────────────────────────────────────────────────────────
router.get('/qc-compliance/certificates', ctrl.listQCComplianceCertificates);
router.post('/qc-compliance/certificates', ctrl.createQCComplianceCertificate);
router.patch('/qc-compliance/certificates/:certId', ctrl.updateQCComplianceCertificate);
router.delete('/qc-compliance/certificates/:certId', ctrl.deleteQCComplianceCertificate);
router.get('/qc-compliance/audits', ctrl.listQCComplianceAudits);
router.get('/qc-compliance/audits/:id', ctrl.getQCComplianceAuditById);
router.post('/qc-compliance/audits', ctrl.createQCComplianceAudit);
router.patch('/qc-compliance/audits/:id', ctrl.updateQCComplianceAudit);
router.delete('/qc-compliance/audits/:id', ctrl.deleteQCComplianceAudit);
router.get('/qc-compliance/temperature', ctrl.listQCTemperature);
router.post('/qc-compliance/temperature', ctrl.createQCTemperature);
router.patch('/qc-compliance/temperature/:tempId', ctrl.updateQCTemperature);
router.delete('/qc-compliance/temperature/:tempId', ctrl.deleteQCTemperature);
router.get('/qc-compliance/ratings', ctrl.listVendorRatings);
router.patch('/qc-compliance/ratings/:vendorId', ctrl.updateVendorRating);
router.delete('/qc-compliance/ratings/:vendorId', ctrl.deleteVendorRating);
router.post('/qc-compliance/ratings/:vendorId/recalculate', ctrl.recalculateVendorRating);

// ─── Certificates ─────────────────────────────────────────────────────────────
router.get('/certificates', ctrl.listCertificates);
router.post('/certificates', ctrl.createCertificate);
router.get('/certificates/:certificateId', ctrl.getCertificateById);
router.patch('/certificates/:certificateId', ctrl.patchCertificate);
router.delete('/certificates/:certificateId', ctrl.deleteCertificate);

// ─── Inventory ────────────────────────────────────────────────────────────────
router.get('/inventory/hub/aging-alerts', ctrl.listHubAgingAlerts);
router.get('/inventory', ctrl.listVendorInventory);
router.get('/inventory/:vendorId/stock', ctrl.listVendorStock);
router.post('/inventory/:vendorId/sync', ctrl.syncVendorInventory);
router.post('/inventory/:vendorId/reconcile', ctrl.reconcileVendorInventory);
router.get('/inventory/:vendorId/aging-alerts', ctrl.listVendorAgingAlerts);
router.post('/inventory/:vendorId/aging-alerts/:alertId/ack', ctrl.ackVendorAgingAlert);
router.get('/inventory/:vendorId/stockouts', ctrl.getVendorStockouts);
router.get('/inventory/:vendorId/aging-inventory', ctrl.getVendorAgingInventory);
router.get('/inventory/:vendorId/supply-performance', ctrl.getVendorSupplyPerformance);
router.get('/inventory/:vendorId/kpis', ctrl.getVendorInventoryKPIs);
router.post('/inventory/:vendorId/stockouts/bulk-reorder', ctrl.bulkReorderStockouts);
router.post('/inventory/:vendorId/stockouts/alert-all', ctrl.alertAllVendorsStockout);
router.post('/inventory/:vendorId/aging-inventory/:itemId/return', ctrl.returnAgingItem);
router.post('/inventory/:vendorId/aging-inventory/:itemId/liquidate', ctrl.liquidateAgingItem);
router.get('/inventory/:vendorId', ctrl.getVendorInventorySummary);

// ─── Reports ──────────────────────────────────────────────────────────────────
router.get('/reports/sales/overview', ctrl.getSalesOverview);
router.get('/reports/sales/data', ctrl.getSalesData);
router.get('/reports/products/performance', ctrl.getProductPerformance);
router.get('/reports/orders/analytics', ctrl.getOrderAnalytics);
router.get('/reports/revenue/category', ctrl.getRevenueByCategory);
router.get('/reports/sales/hourly', ctrl.getHourlySales);
router.get('/reports/financial/summary', ctrl.getFinancialSummary);
router.get('/reports/customers/insights', ctrl.getCustomerInsights);
router.get('/reports/customers/top', ctrl.getTopCustomers);
router.get('/reports', ctrl.getReports);

// ─── Invoices ─────────────────────────────────────────────────────────────────
router.get('/invoices', ctrl.listVendorInvoices);
router.get('/invoices/:id', ctrl.getVendorInvoiceById);
router.post('/invoices/:id/approve', ctrl.approveVendorInvoice);
router.post('/invoices/:id/reject', ctrl.rejectVendorInvoice);
router.post('/invoices/:id/mark-paid', ctrl.markVendorInvoicePaid);

// ─── Payments ─────────────────────────────────────────────────────────────────
router.get('/payments', ctrl.listVendorPayments);
router.post('/payments', ctrl.createVendorPayment);
router.post('/payments/:paymentId/cancel', ctrl.cancelVendorPayment);

// ─── Notifications ────────────────────────────────────────────────────────────
router.get('/notifications', ctrl.listVendorNotifications);
router.post('/notifications/read-all', ctrl.markAllVendorNotificationsRead);
router.put('/notifications/:notifId/read', ctrl.markVendorNotificationRead);
router.patch('/notifications/:notifId/read', ctrl.markVendorNotificationRead);

// ─── Approvals ────────────────────────────────────────────────────────────────
router.get('/approvals/summary', ctrl.getProcurementApprovalsSummary);
router.get('/approvals/tasks', ctrl.listProcurementApprovalTasks);
router.get('/approvals/tasks/:id', ctrl.getProcurementApprovalTaskById);
router.post('/approvals/tasks/:id/decision', ctrl.submitProcurementDecision);
router.get('/approvals', ctrl.listProcurementApprovals);
router.post('/approvals/:approvalId/approve', ctrl.approveProcurement);
router.post('/approvals/:approvalId/reject', ctrl.rejectProcurement);

// ─── System Gateway ───────────────────────────────────────────────────────────
router.get('/system-gateway/services', ctrl.listSystemGatewayServices);
router.get('/system-gateway/services/:id', ctrl.getSystemGatewayServiceById);
router.post('/system-gateway/services', ctrl.upsertSystemGatewayService);
router.put('/system-gateway/services/:id', ctrl.upsertSystemGatewayService);
router.get('/system-gateway/logs', ctrl.getSystemGatewayLogs);
router.post('/system-gateway/logs', ctrl.createSystemGatewayLog);

// ─── Webhooks ─────────────────────────────────────────────────────────────────
router.post('/webhooks/vendor-signed', ctrl.handleVendorSignedWebhook);
router.post('/webhooks/carrier', ctrl.handleCarrierWebhook);

// ─── Utilities ────────────────────────────────────────────────────────────────
router.get('/utilities/upload-history', ctrl.getUploadHistory);
router.get('/utilities/bulk-upload/template', ctrl.getBulkUploadTemplate);
router.post('/utilities/bulk-upload', ctrl.bulkUploadUtility);
router.get('/utilities/contracts', ctrl.listUtilityContracts);
router.post('/utilities/contracts', ctrl.createUtilityContract);
router.delete('/utilities/contracts/:contractId', ctrl.deleteUtilityContract);
router.get('/utilities/audit-logs', ctrl.getVendorAuditLogs);
router.post('/utilities/audit-logs/export', ctrl.exportVendorAuditLogs);

export default router;
