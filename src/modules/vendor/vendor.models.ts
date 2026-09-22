import mongoose, { Schema } from 'mongoose';

// ─── Vendor ───────────────────────────────────────────────────────────────────

const vendorMetadataSchema = new Schema({ registrationNumber: String, onboardingSource: { type: String, enum: ['direct', 'referral', 'field_sales', 'platform', 'existing'], default: 'direct' }, serviceableZones: [String], paymentTerms: { type: String, default: 'net15' }, creditLimit: { type: Number, default: 0 }, leadTimeDays: { type: Number, default: 2 }, minimumOrderValue: { type: Number, default: 0 }, deliveryWindows: [String], gstNumber: { type: String, default: '' }, panNumber: { type: String, default: '' }, bankName: { type: String, default: '' }, bankAccount: { type: String, default: '' }, ifscCode: { type: String, default: '' }, accountHolder: { type: String, default: '' }, selectedCategories: { type: Array, default: [] }, documents: { type: Array, default: [] }, inviteToken: { type: String, default: null }, inviteStatus: { type: String, default: null } }, { _id: false, strict: false });

const contactSchema = new Schema({ name: String, phone: String, email: String }, { _id: false });
const addressSchema = new Schema({ line1: String, line2: String, city: String, state: String, country: { type: String, default: 'India' }, zipCode: String, pincode: String }, { _id: false });
const taxInfoSchema = new Schema({ gstin: { type: String, default: '' }, pan: { type: String, default: '' } }, { _id: false });

const vendorSchema = new Schema(
  {
    vendorCode: { type: String, trim: true },
    vendorName: { type: String, trim: true, maxlength: 100 },
    taxInfo: { type: taxInfoSchema, default: () => ({}) },
    paymentTerms: { type: String, default: '30 days' },
    address: { type: addressSchema, default: () => ({}) },
    contact: { type: contactSchema, default: () => ({}) },
    currencyCode: { type: String, uppercase: true, default: 'INR' },
    name: { type: String, trim: true },
    code: { type: String, trim: true },
    status: { type: String, default: 'pending' },
    stage: { type: String, enum: ['invited', 'new_request', 'kyc_verification', 'docs_verification', 'review_pending', 'contract', 'tier_assignment', 'approved', 'rejected'], default: 'new_request' },
    sla: { type: Number, default: 0 },
    activeRelationships: { type: Number, default: 0 },
    onboarding: { type: Schema.Types.Mixed },
    metadata: vendorMetadataSchema,
    archived: { type: Boolean, default: false },
    hubKey: { type: String, trim: true, index: true },
  },
  { timestamps: true }
);
vendorSchema.index({ vendorCode: 1 }, { unique: true, sparse: true });
vendorSchema.index({ code: 1 }, { unique: true, sparse: true });
vendorSchema.index({ 'contact.email': 1 }, { unique: true, sparse: true });

export const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);

// ─── Purchase Order ───────────────────────────────────────────────────────────

const poItemSchema = new Schema({ sku: String, description: String, quantity: { type: Number, required: true }, unitPrice: { type: Number, required: true }, tax: Number });

const purchaseOrderSchema = new Schema(
  {
    vendorId: { type: String, required: true },
    reference: String,
    externalReference: String,
    currency: { type: String, default: 'INR' },
    status: { type: String, default: 'draft', enum: ['draft', 'submitted', 'approved', 'rejected', 'received', 'cancelled'] },
    items: [poItemSchema],
    totals: { subTotal: Number, taxTotal: Number, shipping: Number, grandTotal: Number },
    expectedDeliveryDate: Date,
    createdBy: String,
    archived: { type: Boolean, default: false },
    hubKey: { type: String, trim: true, index: true },
  },
  { timestamps: true }
);
purchaseOrderSchema.index({ vendorId: 1, status: 1 });
purchaseOrderSchema.index({ hubKey: 1, status: 1 });

export const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', purchaseOrderSchema);

// ─── GRN (Vendor Inbound) ─────────────────────────────────────────────────────

const vendorGrnSchema = new Schema(
  {
    grn_id: { type: String, required: true, unique: true },
    vendor_id: String,
    purchase_order_id: String,
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'rejected'], default: 'pending' },
    items: [{ sku: String, description: String, expected_qty: Number, received_qty: { type: Number, default: 0 }, rejected_qty: { type: Number, default: 0 } }],
    notes: String,
    hub_key: String,
  },
  { timestamps: true }
);

export const VendorGRN = mongoose.models.VendorGRN || mongoose.model('VendorGRN', vendorGrnSchema, 'vendor_grns');

// ─── Vendor Contract ──────────────────────────────────────────────────────────

const vendorContractSchema = new Schema(
  {
    vendorId: { type: String, required: true, index: true },
    contractNumber: String,
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ['draft', 'active', 'expired', 'terminated'], default: 'draft' },
    terms: String,
    signedBy: String,
    hubKey: String,
  },
  { timestamps: true }
);

export const VendorContract = mongoose.models.VendorContract || mongoose.model('VendorContract', vendorContractSchema);

// ─── Vendor Rating ────────────────────────────────────────────────────────────

const vendorRatingSchema = new Schema(
  {
    vendorId: { type: String, required: true, index: true },
    period: String,
    qualityScore: { type: Number, default: 0 },
    deliveryScore: { type: Number, default: 0 },
    responseScore: { type: Number, default: 0 },
    overallScore: { type: Number, default: 0 },
    reviewedBy: String,
  },
  { timestamps: true }
);

export const VendorRating = mongoose.models.VendorRating || mongoose.model('VendorRating', vendorRatingSchema);

// ─── Vendor Invoice ───────────────────────────────────────────────────────────

const vendorInvoiceSchema = new Schema(
  {
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
  },
  { timestamps: true }
);
vendorInvoiceSchema.index({ vendorId: 1, status: 1 });

export const VendorInvoice = mongoose.models.VendorInvoice || mongoose.model('VendorInvoice', vendorInvoiceSchema);

// ─── Vendor Payment ───────────────────────────────────────────────────────────

const vendorPaymentSchema = new Schema(
  {
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
  },
  { timestamps: true }
);

export const VendorPayment = mongoose.models.VendorPayment || mongoose.model('VendorPayment', vendorPaymentSchema);

// ─── QC Check ────────────────────────────────────────────────────────────────

const vendorQCCheckSchema = new Schema(
  {
    checkId: String,
    vendorId: String,
    grnId: String,
    sku: String,
    productName: String,
    status: { type: String, enum: ['pass', 'fail', 'pending'], default: 'pending' },
    notes: String,
    inspector: String,
    hubKey: String,
  },
  { timestamps: true }
);

export const VendorQCCheck = mongoose.models.VendorQCCheck || mongoose.model('VendorQCCheck', vendorQCCheckSchema, 'vendor_qc_checks');

// ─── Certificate ─────────────────────────────────────────────────────────────

const vendorCertSchema = new Schema(
  {
    vendorId: { type: String, required: true, index: true },
    type: String,
    name: String,
    expiryDate: Date,
    status: { type: String, enum: ['valid', 'expiring_soon', 'expired', 'pending'], default: 'pending' },
    fileUrl: String,
    hubKey: String,
  },
  { timestamps: true }
);

export const Certificate = mongoose.models.Certificate || mongoose.model('Certificate', vendorCertSchema);

// ─── Vendor Inventory Item ────────────────────────────────────────────────────

const vendorInventorySchema = new Schema(
  {
    vendorId: { type: String, required: true, index: true },
    sku: { type: String, required: true },
    name: String,
    stock: { type: Number, default: 0 },
    unitPrice: Number,
    category: String,
    status: { type: String, enum: ['active', 'inactive', 'discontinued'], default: 'active' },
    hubKey: String,
  },
  { timestamps: true }
);
vendorInventorySchema.index({ vendorId: 1, sku: 1 }, { unique: true });

export const VendorInventoryItem = mongoose.models.VendorInventoryItem || mongoose.model('VendorInventoryItem', vendorInventorySchema, 'vendor_inventory');

// ─── Vendor Alert ─────────────────────────────────────────────────────────────

const vendorAlertSchema = new Schema(
  {
    alertId: String,
    type: String,
    title: String,
    message: String,
    priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
    status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
    vendorId: String,
    hubKey: String,
  },
  { timestamps: true }
);

export const VendorAlert = mongoose.models.VendorAlert || mongoose.model('VendorAlert', vendorAlertSchema, 'vendor_alerts');

// ─── Shipment ─────────────────────────────────────────────────────────────────

const vendorShipmentSchema = new Schema(
  {
    shipmentId: String,
    vendorId: String,
    purchaseOrderId: String,
    status: { type: String, enum: ['pending', 'in_transit', 'delivered', 'cancelled'], default: 'pending' },
    trackingNumber: String,
    carrier: String,
    estimatedArrival: Date,
    actualArrival: Date,
    items: [{ sku: String, quantity: Number }],
    hubKey: String,
  },
  { timestamps: true }
);

export const Shipment = mongoose.models.Shipment || mongoose.model('Shipment', vendorShipmentSchema);

// ─── Procurement Approval ─────────────────────────────────────────────────────

const procurementApprovalSchema = new Schema(
  {
    approvalId: String,
    type: String,
    referenceId: String,
    amount: Number,
    requestedBy: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: String,
    rejectedBy: String,
    reason: String,
    hubKey: String,
  },
  { timestamps: true }
);

export const ProcurementApproval = mongoose.models.ProcurementApproval || mongoose.model('ProcurementApproval', procurementApprovalSchema);

// ─── System Log ───────────────────────────────────────────────────────────────

const systemLogSchema = new Schema(
  { action: String, actor: String, details: Schema.Types.Mixed, status: String, hubKey: String },
  { timestamps: true }
);

export const SystemLog = mongoose.models.SystemLog || mongoose.model('SystemLog', systemLogSchema);

// ─── Vendor Dashboard Notification ───────────────────────────────────────────

const vendorNotifSchema = new Schema(
  { vendorId: String, type: String, title: String, body: String, read: { type: Boolean, default: false }, hubKey: String },
  { timestamps: true }
);

export const VendorNotification = mongoose.models.VendorNotification || mongoose.model('VendorNotification', vendorNotifSchema, 'vendor_notifications');

// ─── RTV ─────────────────────────────────────────────────────────────────────

const rtvSchema = new Schema(
  { rtvId: String, vendorId: String, sku: String, quantity: Number, reason: String, status: { type: String, enum: ['pending', 'approved', 'completed', 'rejected'], default: 'pending' }, hubKey: String },
  { timestamps: true }
);

export const RTV = mongoose.models.RTV || mongoose.model('RTV', rtvSchema);

// ─── Temperature Compliance ───────────────────────────────────────────────────

const tempComplianceSchema = new Schema(
  { vendorId: String, shipmentId: String, zone: String, temperature: Number, humidity: Number, status: { type: String, enum: ['pass', 'fail', 'borderline'], default: 'pass' }, hubKey: String },
  { timestamps: true }
);

export const TemperatureCompliance = mongoose.models.TemperatureCompliance || mongoose.model('TemperatureCompliance', tempComplianceSchema);

// ─── Audit ────────────────────────────────────────────────────────────────────

const vendorAuditSchema = new Schema(
  { entity: String, entityId: String, action: String, actor: String, before: Schema.Types.Mixed, after: Schema.Types.Mixed, hubKey: String },
  { timestamps: true }
);

export const VendorAudit = mongoose.models.VendorAudit || mongoose.model('VendorAudit', vendorAuditSchema, 'vendor_audits');

// ─── Job ─────────────────────────────────────────────────────────────────────

const vendorJobSchema = new Schema(
  { jobId: String, type: String, status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' }, details: Schema.Types.Mixed, hubKey: String },
  { timestamps: true }
);

export const VendorJob = mongoose.models.VendorJob || mongoose.model('VendorJob', vendorJobSchema, 'vendor_jobs');
