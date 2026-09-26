import mongoose, { Schema, Document } from 'mongoose';

// ─── Darkstore Order ──────────────────────────────────────────────────────────

const timelineEntrySchema = new Schema(
  { status: String, timestamp: { type: Date, default: Date.now }, updatedBy: { type: String, default: '' }, updatedByRole: { type: String, default: '' } },
  { _id: false }
);

const orderItemSchema = new Schema(
  { productId: { type: String, default: '' }, productName: { type: String, default: '' }, quantity: { type: Number, default: 1 }, price: { type: Number, default: 0 }, image: { type: String, default: '' }, variantSize: { type: String, default: '' } },
  { _id: false }
);

const missingItemSchema = new Schema(
  { productName: String, orderedQty: { type: Number, required: true }, scannedQty: { type: Number, default: 0 }, reason: String, replacementSku: String, replacementProductName: String, replacementQty: { type: Number, default: 0 } },
  { _id: false }
);

const dsOrderSchema = new Schema(
  {
    order_id: { type: String, required: true, unique: true },
    store_id: { type: String, required: true },
    order_type: { type: String, enum: ['Normal', 'Priority', 'Express', 'Premium'], default: 'Normal' },
    status: { type: String, enum: ['new', 'processing', 'ready', 'completed', 'cancelled', 'rto', 'ASSIGNED', 'PICKING', 'PICKED', 'PACKED', 'READY_FOR_DISPATCH', 'CANCELLED'], default: 'new' },
    item_count: { type: Number, required: true, min: 1 },
    items: { type: [orderItemSchema], default: [] },
    sla_timer: { type: String, default: '00:00' },
    sla_status: { type: String, enum: ['safe', 'warning', 'critical'], default: 'safe' },
    sla_deadline: { type: Date },
    assignee: { id: String, name: String, initials: String },
    customer_name: { type: String, default: 'Customer' },
    customer_phone: { type: String, default: '' },
    payment_status: { type: String, enum: ['paid', 'cod_pending', 'pending', 'failed'], default: 'pending' },
    payment_method: { type: String, enum: ['card', 'upi', 'cash', 'wallet'], default: 'cash' },
    total_bill: { type: Number, default: 0 },
    delivery_address: { type: String, default: '' },
    delivery_notes: { type: String, default: '' },
    rto_risk: { type: Boolean, default: false },
    rto_reason: String,
    rto_notes: { type: String, maxlength: 1000 },
    rto_status: { type: String, enum: ['marked_rto', 'pending_confirmation', 'rto_confirmed'] },
    timeline: { type: [timelineEntrySchema], default: [] },
    pickerAssignment: { pickerId: String, pickerName: String, assignedAt: Date },
    pickingData: { startTime: Date, endTime: Date, pickDuration: Number, accuracy: Number, missingItems: [missingItemSchema] },
    bagId: { type: String, default: '' },
    rackLocation: { type: String, default: '' },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'orders' }
);
dsOrderSchema.index({ store_id: 1, status: 1 });
dsOrderSchema.index({ order_id: 1 });
dsOrderSchema.index({ sla_deadline: 1 });
dsOrderSchema.index({ rto_risk: 1 });

export const DarkstoreOrder = mongoose.models.DarkstoreOrder || mongoose.model('DarkstoreOrder', dsOrderSchema);

// ─── Inventory Item ───────────────────────────────────────────────────────────

const inventoryItemSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    sku: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    stock: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['Fast Movers', 'Slow Movers', 'Out of Stock', 'Near Expiry', 'Overstocked'], default: 'Slow Movers' },
    trend: { type: String, enum: ['up', 'down', 'stable'], default: 'stable' },
    store_id: { type: String, required: true },
    location: String,
    barcode: String,
    imported_via_sheet: { type: Boolean, default: false },
  },
  { timestamps: true }
);
inventoryItemSchema.index({ store_id: 1, category: 1 });
inventoryItemSchema.index({ sku: 1 });
inventoryItemSchema.index({ store_id: 1, status: 1 });

export const InventoryItem = mongoose.models.InventoryItem || mongoose.model('InventoryItem', inventoryItemSchema);

// ─── Inventory Adjustment ─────────────────────────────────────────────────────

const inventoryAdjSchema = new Schema(
  {
    adjustment_id: { type: String, required: true, unique: true },
    sku: { type: String, required: true },
    product_name: String,
    action: { type: String, enum: ['add', 'remove', 'damage', 'expiry', 'transfer', 'correction'], required: true },
    quantity: { type: Number, required: true },
    reason: String,
    performed_by: String,
    store_id: String,
    previous_stock: Number,
    new_stock: Number,
  },
  { timestamps: true }
);
inventoryAdjSchema.index({ store_id: 1, action: 1 });
inventoryAdjSchema.index({ sku: 1 });

export const InventoryAdjustment = mongoose.models.InventoryAdjustment || mongoose.model('InventoryAdjustment', inventoryAdjSchema);

// ─── Shelf ────────────────────────────────────────────────────────────────────

const shelfSchema = new Schema(
  {
    shelf_id: { type: String, required: true, unique: true },
    location_code: { type: String, required: true },
    aisle: { type: String, required: true },
    shelf_number: { type: Number, required: true },
    zone: { type: String, required: true },
    section: String,
    status: { type: String, enum: ['normal', 'critical', 'misplaced'], default: 'normal' },
    is_critical: { type: Boolean, default: false },
    is_misplaced: { type: Boolean, default: false },
    store_id: { type: String, required: true },
  },
  { timestamps: true }
);
shelfSchema.index({ store_id: 1, zone: 1 });
shelfSchema.index({ location_code: 1 });

export const Shelf = mongoose.models.Shelf || mongoose.model('Shelf', shelfSchema);

// ─── Shelf SKU ────────────────────────────────────────────────────────────────

const shelfSkuSchema = new Schema(
  { shelf_id: { type: String, required: true }, sku: { type: String, required: true }, product_name: String, stock_count: { type: Number, default: 0 }, store_id: String },
  { timestamps: true }
);
shelfSkuSchema.index({ shelf_id: 1 });
shelfSkuSchema.index({ sku: 1 });

export const ShelfSKU = mongoose.models.ShelfSKU || mongoose.model('ShelfSKU', shelfSkuSchema);

// ─── Shelf Issue ──────────────────────────────────────────────────────────────

const shelfIssueSchema = new Schema(
  { shelf_id: String, type: String, message: String, severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }, store_id: String, resolved: { type: Boolean, default: false } },
  { timestamps: true }
);

export const ShelfIssue = mongoose.models.ShelfIssue || mongoose.model('ShelfIssue', shelfIssueSchema);

// ─── Shelf Activity ───────────────────────────────────────────────────────────

const shelfActivitySchema = new Schema(
  { shelf_id: String, action: String, performed_by: String, store_id: String, timestamp: { type: Date, default: Date.now } },
  { timestamps: true }
);

export const ShelfActivity = mongoose.models.ShelfActivity || mongoose.model('ShelfActivity', shelfActivitySchema);

// ─── Picklist ─────────────────────────────────────────────────────────────────

const picklistSchema = new Schema(
  {
    picklist_id: { type: String, required: true, unique: true },
    store_id: String,
    zone: { type: String, enum: ['Ambient A', 'Ambient B', 'Chiller', 'Frozen'], required: true },
    sla_time: String,
    sla_status: { type: String, enum: ['safe', 'atrisk', 'urgent'] },
    items_count: { type: Number, default: 0 },
    orders_count: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'inprogress', 'completed', 'paused'], default: 'pending' },
    progress: { type: Number, min: 0, max: 100 },
    priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
    picker_id: String,
    suggested_picker: String,
    type: { type: String, enum: ['auto', 'manual'] },
    packing_station_id: String,
  },
  { timestamps: true }
);
picklistSchema.index({ store_id: 1, status: 1 });
picklistSchema.index({ zone: 1 });

export const Picklist = mongoose.models.Picklist || mongoose.model('Picklist', picklistSchema);

// ─── Picklist Item ────────────────────────────────────────────────────────────

const picklistItemSchema = new Schema(
  { picklist_id: String, sku: String, product_name: String, quantity: Number, picked_quantity: { type: Number, default: 0 }, location: String, zone: String, status: { type: String, enum: ['pending', 'picked', 'missing'], default: 'pending' }, store_id: String },
  { timestamps: true }
);

export const PicklistItem = mongoose.models.PicklistItem || mongoose.model('PicklistItem', picklistItemSchema);

// ─── Packing Order ────────────────────────────────────────────────────────────

const packingOrderSchema = new Schema(
  {
    order_id: { type: String, required: true, unique: true },
    customer_name: String,
    order_type: String,
    sla_time: String,
    sla_status: { type: String, enum: ['urgent', 'warning', 'normal'] },
    picker: String,
    packing_station_id: String,
    status: { type: String, enum: ['pending', 'packing', 'packed'], default: 'pending' },
    store_id: String,
  },
  { timestamps: true }
);
packingOrderSchema.index({ store_id: 1, status: 1 });

export const PackingOrder = mongoose.models.PackingOrder || mongoose.model('PackingOrder', packingOrderSchema);

// ─── GRN ─────────────────────────────────────────────────────────────────────

const grnSchema = new Schema(
  {
    grn_id: { type: String, required: true, unique: true },
    truck_id: { type: String, required: true },
    supplier: { type: String, required: true },
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'rejected'], default: 'pending' },
    store_id: { type: String, required: true },
    items_count: { type: Number, default: 0 },
    total_quantity: { type: Number, default: 0 },
    received_quantity: { type: Number, default: 0 },
    expected_arrival: String,
    actual_arrival: String,
    notes: String,
    created_at: String,
    updated_at: String,
  },
  { timestamps: false }
);
grnSchema.index({ store_id: 1, status: 1 });

export const GRN = mongoose.models.GRN || mongoose.model('GRN', grnSchema);

// ─── GRN Item ─────────────────────────────────────────────────────────────────

const grnItemSchema = new Schema(
  { grn_id: String, sku: String, product_name: String, expected_qty: Number, received_qty: { type: Number, default: 0 }, rejected_qty: { type: Number, default: 0 }, store_id: String, status: { type: String, enum: ['pending', 'received', 'rejected'], default: 'pending' } },
  { timestamps: true }
);

export const GRNItem = mongoose.models.GRNItem || mongoose.model('GRNItem', grnItemSchema);

// ─── Putaway Task ─────────────────────────────────────────────────────────────

const putawayTaskSchema = new Schema(
  { task_id: { type: String, required: true, unique: true }, grn_id: String, sku: String, product_name: String, quantity: Number, target_location: String, assigned_to: String, status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' }, store_id: String },
  { timestamps: true }
);

export const PutawayTask = mongoose.models.PutawayTask || mongoose.model('PutawayTask', putawayTaskSchema);

// ─── Inter-Store Transfer ─────────────────────────────────────────────────────

const interStoreTransferSchema = new Schema(
  {
    transfer_id: { type: String, required: true, unique: true },
    from_store: { type: String, required: true },
    to_store: { type: String, required: true },
    status: { type: String, enum: ['pending', 'in_transit', 'received', 'cancelled'], default: 'pending' },
    items: [{ sku: String, product_name: String, quantity: Number, received_qty: { type: Number, default: 0 } }],
    notes: String,
    initiated_by: String,
    received_by: String,
  },
  { timestamps: true }
);

export const InterStoreTransfer = mongoose.models.InterStoreTransfer || mongoose.model('InterStoreTransfer', interStoreTransferSchema);

// ─── Alert ────────────────────────────────────────────────────────────────────

const alertSchema = new Schema(
  {
    alert_id: { type: String, required: true, unique: true },
    type: { type: String, enum: ['sla_breach', 'delayed_delivery', 'rider_no_show', 'zone_deviation', 'vehicle_breakdown', 'rto_return', 'other'], required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
    status: { type: String, enum: ['open', 'acknowledged', 'in_progress', 'resolved', 'dismissed'], default: 'open' },
    source: { orderId: String, riderId: String, riderName: String, vehicleId: String, zone: String, lat: Number, lng: Number },
    actionsSuggested: { type: [String], default: [] },
    timeline: [{ at: String, status: String, note: String, actor: String }],
    store_id: { type: String, required: true },
    created_at: String,
    updated_at: String,
  },
  { timestamps: false }
);
alertSchema.index({ store_id: 1, status: 1 });
alertSchema.index({ store_id: 1, priority: 1 });

export const Alert = mongoose.models.Alert || mongoose.model('Alert', alertSchema);

// ─── Alert History ────────────────────────────────────────────────────────────

const alertHistorySchema = new Schema(
  { order_id: String, action: String, actor: String, note: String, store_id: String, timestamp: { type: Date, default: Date.now } },
  { timestamps: true }
);

export const AlertHistory = mongoose.models.AlertHistory || mongoose.model('AlertHistory', alertHistorySchema);

// ─── Operational Alert ────────────────────────────────────────────────────────

const operationalAlertSchema = new Schema(
  { order_id: String, type: String, message: String, severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' }, store_id: String, resolved: { type: Boolean, default: false }, resolved_at: Date },
  { timestamps: true }
);

export const OperationalAlert = mongoose.models.OperationalAlert || mongoose.model('OperationalAlert', operationalAlertSchema);

// ─── RTO Alert ────────────────────────────────────────────────────────────────

const rtoAlertSchema = new Schema(
  { order_id: String, reason: String, store_id: String, status: { type: String, enum: ['open', 'resolved'], default: 'open' }, resolved_at: Date },
  { timestamps: true }
);
rtoAlertSchema.index({ store_id: 1, status: 1 });

export const RTOAlert = mongoose.models.RTOAlert || mongoose.model('RTOAlert', rtoAlertSchema);

// ─── Stock Alert ──────────────────────────────────────────────────────────────

const stockAlertSchema = new Schema(
  { sku: String, product_name: String, current_stock: Number, threshold: Number, alert_type: { type: String, enum: ['low_stock', 'out_of_stock', 'near_expiry', 'overstock'] }, store_id: String, resolved: { type: Boolean, default: false } },
  { timestamps: true }
);
stockAlertSchema.index({ store_id: 1, resolved: 1 });

export const StockAlert = mongoose.models.StockAlert || mongoose.model('StockAlert', stockAlertSchema);

// ─── QC Inspection ────────────────────────────────────────────────────────────

const qcInspectionSchema = new Schema(
  {
    inspection_id: { type: String, required: true, unique: true },
    batch_id: { type: String, required: true },
    product_name: { type: String, required: true },
    inspector: { type: String, required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ['passed', 'failed', 'pending'], required: true },
    score: { type: Number, required: true },
    items_inspected: { type: Number, required: true },
    defects_found: { type: Number, required: true },
    store_id: String,
  },
  { timestamps: true }
);

export const QCInspection = mongoose.models.QCInspection || mongoose.model('QCInspection', qcInspectionSchema);

// ─── QC Failure ───────────────────────────────────────────────────────────────

const qcFailureSchema = new Schema(
  { failure_id: String, inspection_id: String, sku: String, product_name: String, failure_reason: String, severity: String, store_id: String, resolved: { type: Boolean, default: false }, resolved_by: String, resolved_at: Date },
  { timestamps: true }
);

export const QCFailure = mongoose.models.QCFailure || mongoose.model('QCFailure', qcFailureSchema);

// ─── QC Check Log ─────────────────────────────────────────────────────────────

const qcCheckLogSchema = new Schema(
  { sku: String, check_type: String, result: String, inspector: String, store_id: String, notes: String },
  { timestamps: true }
);

export const QCCheckLog = mongoose.models.QCCheckLog || mongoose.model('QCCheckLog', qcCheckLogSchema);

// ─── Sample Test ──────────────────────────────────────────────────────────────

const sampleTestSchema = new Schema(
  { sample_id: { type: String, unique: true }, product_name: String, batch_id: String, test_type: String, result: { type: String, enum: ['pass', 'fail', 'pending'], default: 'pending' }, tester: String, store_id: String, notes: String, tested_at: Date },
  { timestamps: true }
);

export const SampleTest = mongoose.models.SampleTest || mongoose.model('SampleTest', sampleTestSchema);

// ─── Compliance Doc ───────────────────────────────────────────────────────────

const complianceDocSchema = new Schema(
  { doc_id: String, title: String, type: String, status: { type: String, enum: ['valid', 'expiring_soon', 'expired'] }, expiry_date: Date, store_id: String, uploaded_by: String },
  { timestamps: true }
);

export const ComplianceDoc = mongoose.models.DarkstoreComplianceDoc || mongoose.model('DarkstoreComplianceDoc', complianceDocSchema, 'darkstore_compliance_docs');

// ─── Compliance Log ───────────────────────────────────────────────────────────

const complianceLogSchema = new Schema(
  { log_id: String, action: String, performed_by: String, store_id: String, notes: String },
  { timestamps: true }
);

export const ComplianceLog = mongoose.models.ComplianceLog || mongoose.model('ComplianceLog', complianceLogSchema);

// ─── Watchlist Item ───────────────────────────────────────────────────────────

const watchlistItemSchema = new Schema(
  { sku: String, product_name: String, reason: String, added_by: String, store_id: String, resolved: { type: Boolean, default: false } },
  { timestamps: true }
);

export const WatchlistItem = mongoose.models.WatchlistItem || mongoose.model('WatchlistItem', watchlistItemSchema);

// ─── Batch Rejection ─────────────────────────────────────────────────────────

const batchRejectionSchema = new Schema(
  { rejection_id: String, batch_id: String, product_name: String, quantity: Number, reason: String, rejected_by: String, store_id: String },
  { timestamps: true }
);

export const BatchRejection = mongoose.models.BatchRejection || mongoose.model('BatchRejection', batchRejectionSchema);

// ─── Temperature Log ─────────────────────────────────────────────────────────

const tempLogSchema = new Schema(
  { zone: String, temperature: Number, humidity: Number, status: { type: String, enum: ['normal', 'warning', 'critical'], default: 'normal' }, recorded_by: String, store_id: String },
  { timestamps: true }
);

export const TemperatureLog = mongoose.models.TemperatureLog || mongoose.model('TemperatureLog', tempLogSchema);

// ─── Auto QC Check ────────────────────────────────────────────────────────────

const autoQCCheckSchema = new Schema(
  { check_id: String, item_id: String, result: String, store_id: String, timestamp: { type: Date, default: Date.now } },
  { timestamps: true }
);

export const AutoQCCheck = mongoose.models.AutoQCCheck || mongoose.model('AutoQCCheck', autoQCCheckSchema);

// ─── Audit Status ─────────────────────────────────────────────────────────────

const auditStatusSchema = new Schema(
  { store_id: String, last_audit_date: Date, auditor: String, status: { type: String, enum: ['pass', 'fail', 'pending'], default: 'pending' }, score: Number, notes: String },
  { timestamps: true }
);

export const AuditStatus = mongoose.models.AuditStatus || mongoose.model('AuditStatus', auditStatusSchema);

// ─── Staff ────────────────────────────────────────────────────────────────────

const staffSchema = new Schema(
  {
    staff_id: { type: String, required: true, unique: true },
    store_id: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['Picker', 'Packer', 'Loader', 'Rider', 'Supervisor'], required: true },
    zone: String,
    status: { type: String, enum: ['Active', 'Break', 'Offline', 'Meeting'], default: 'Offline' },
    current_shift: String,
    current_task: String,
    shift_start: Date,
    shift_end: Date,
    is_active: { type: Boolean, default: true },
    current_load: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);
staffSchema.index({ store_id: 1, role: 1, is_active: 1 });
staffSchema.index({ store_id: 1, status: 1 });

export const DarkstoreStaff = mongoose.models.DarkstoreStaff || mongoose.model('DarkstoreStaff', staffSchema, 'darkstore_staff');

// ─── Staff Performance ────────────────────────────────────────────────────────

const staffPerfSchema = new Schema(
  { staff_id: String, store_id: String, period: String, orders_handled: { type: Number, default: 0 }, accuracy: { type: Number, default: 0 }, avg_pick_time: Number, attendance_rate: Number },
  { timestamps: true }
);

export const StaffPerformance = mongoose.models.StaffPerformance || mongoose.model('StaffPerformance', staffPerfSchema);

// ─── Shift Coverage ───────────────────────────────────────────────────────────

const shiftCoverageSchema = new Schema(
  { store_id: String, shift_name: String, required_count: Number, actual_count: { type: Number, default: 0 }, date: Date, roles: [{ role: String, required: Number, actual: Number }] },
  { timestamps: true }
);

export const ShiftCoverage = mongoose.models.ShiftCoverage || mongoose.model('ShiftCoverage', shiftCoverageSchema);

// ─── Absence ──────────────────────────────────────────────────────────────────

const absenceSchema = new Schema(
  { staff_id: String, store_id: String, date: Date, reason: String, type: { type: String, enum: ['sick', 'personal', 'no_show', 'approved_leave'] }, logged_by: String },
  { timestamps: true }
);

export const Absence = mongoose.models.Absence || mongoose.model('Absence', absenceSchema);

// ─── Weekly Roster ────────────────────────────────────────────────────────────

const weeklyRosterSchema = new Schema(
  { store_id: String, week_start: Date, week_end: Date, published: { type: Boolean, default: false }, published_at: Date, entries: [{ staff_id: String, name: String, role: String, days: [{ date: Date, shift: String, zone: String }] }] },
  { timestamps: true }
);

export const WeeklyRoster = mongoose.models.WeeklyRoster || mongoose.model('WeeklyRoster', weeklyRosterSchema);

// ─── HSD Session ─────────────────────────────────────────────────────────────

const hsdSessionSchema = new Schema(
  {
    session_id: { type: String, required: true, unique: true },
    device_id: { type: String, required: true },
    user_id: { type: String, required: true },
    user_name: { type: String, required: true },
    task_type: { type: String, enum: ['picking', 'packing', 'qc', 'cycle_count'], required: true },
    task_id: { type: String, required: true },
    current_status: { type: String, required: true },
    zone: String,
    started_at: String,
    last_activity: String,
    items_completed: { type: Number, default: 0 },
    items_total: { type: Number, default: 0 },
    store_id: { type: String, required: true },
  },
  { timestamps: false }
);
hsdSessionSchema.index({ device_id: 1 });
hsdSessionSchema.index({ store_id: 1, task_type: 1 });

export const HSDSession = mongoose.models.HSDSession || mongoose.model('HSDSession', hsdSessionSchema);

// ─── HSD User Login ───────────────────────────────────────────────────────────

const hsdUserLoginSchema = new Schema(
  { user_id: String, user_name: String, device_id: String, otp: String, otp_expires_at: Date, store_id: String, status: { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending' } },
  { timestamps: true }
);
hsdUserLoginSchema.index({ user_id: 1 });
hsdUserLoginSchema.index({ otp: 1, otp_expires_at: 1 });

export const HSDUserLogin = mongoose.models.HSDUserLogin || mongoose.model('HSDUserLogin', hsdUserLoginSchema);

// ─── Device ───────────────────────────────────────────────────────────────────

const deviceSchema = new Schema(
  {
    device_id: { type: String, required: true, unique: true },
    model: String,
    serial_number: String,
    status: { type: String, enum: ['available', 'assigned', 'charging', 'maintenance', 'offline'], default: 'available' },
    assigned_to: String,
    battery_level: { type: Number, default: 100 },
    last_seen: Date,
    store_id: String,
    firmware_version: String,
    collection_otp: { type: String, default: null },
    collection_otp_updated_at: { type: Date, default: null },
  },
  { timestamps: true }
);

export const DarkstoreDevice = mongoose.models.DarkstoreDevice || mongoose.model('DarkstoreDevice', deviceSchema, 'darkstore_devices');

// ─── Device History ───────────────────────────────────────────────────────────

const deviceHistorySchema = new Schema(
  { device_id: String, action: String, actor: String, note: String, store_id: String },
  { timestamps: true }
);

export const DeviceHistory = mongoose.models.DeviceHistory || mongoose.model('DeviceHistory', deviceHistorySchema);

// ─── HSD Device Issue ─────────────────────────────────────────────────────────

const hsdDeviceIssueSchema = new Schema(
  { device_id: String, issue_type: String, description: String, reported_by: String, store_id: String, status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open' } },
  { timestamps: true }
);

export const HSDDeviceIssue = mongoose.models.HSDDeviceIssue || mongoose.model('HSDDeviceIssue', hsdDeviceIssueSchema);

// ─── HSD Device Action ────────────────────────────────────────────────────────

const hsdDeviceActionSchema = new Schema(
  { device_id: String, action: String, performed_by: String, store_id: String, result: String },
  { timestamps: true }
);

export const HSDDeviceAction = mongoose.models.HSDDeviceAction || mongoose.model('HSDDeviceAction', hsdDeviceActionSchema);

// ─── Settings ─────────────────────────────────────────────────────────────────

const settingsSchema = new Schema(
  {
    store_id: { type: String, required: true, index: true },
    refreshIntervals: {
      dashboard: { type: Number, default: 30 },
      alerts: { type: Number, default: 15 },
      orders: { type: Number, default: 10 },
      inventory: { type: Number, default: 20 },
      analytics: { type: Number, default: 30 },
    },
    storeMode: { type: String, enum: ['online', 'pause', 'maintenance'], default: 'online' },
    notifications: { enabled: { type: Boolean, default: true }, sound: { type: Boolean, default: true }, criticalOnly: { type: Boolean, default: false }, email: { type: Boolean, default: false } },
    display: { theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' }, timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' }, dateFormat: { type: String, default: 'MM/DD/YYYY' } },
    performance: { enableRealTimeUpdates: { type: Boolean, default: true }, enableOptimisticUpdates: { type: Boolean, default: true }, cacheTimeout: { type: Number, default: 60 } },
    outbound: { autoDispatchEnabled: { type: Boolean, default: true }, autoDispatchThreshold: { type: Number, default: 5 }, maxOrdersPerRider: { type: Number, default: 5 }, enableRiderAutoAssignment: { type: Boolean, default: true } },
    lastUpdated: { type: Date, default: Date.now },
    updatedBy: { type: String, default: 'system' },
  },
  { timestamps: true }
);
settingsSchema.index({ store_id: 1 }, { unique: true });

export const DarkstoreSettings = mongoose.models.DarkstoreSettings || mongoose.model('DarkstoreSettings', settingsSchema, 'darkstore_settings');

// ─── Customer Call ────────────────────────────────────────────────────────────

const customerCallSchema = new Schema(
  { order_id: String, caller: String, notes: String, store_id: String, called_at: { type: Date, default: Date.now } },
  { timestamps: true }
);

export const CustomerCall = mongoose.models.CustomerCall || mongoose.model('CustomerCall', customerCallSchema);

// ─── Audit Log ────────────────────────────────────────────────────────────────

const auditLogSchema = new Schema(
  { entity: String, entity_id: String, action: String, actor: String, store_id: String, before: Schema.Types.Mixed, after: Schema.Types.Mixed, notes: String },
  { timestamps: true }
);
auditLogSchema.index({ store_id: 1, entity: 1 });
auditLogSchema.index({ entity_id: 1 });

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

// ─── Restock Task ─────────────────────────────────────────────────────────────

const restockTaskSchema = new Schema(
  { sku: String, product_name: String, current_stock: Number, restock_qty: Number, priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }, assigned_to: String, store_id: String, status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' } },
  { timestamps: true }
);

export const RestockTask = mongoose.models.RestockTask || mongoose.model('RestockTask', restockTaskSchema);

// ─── Damaged Item Report ──────────────────────────────────────────────────────

const damagedItemSchema = new Schema(
  { order_id: String, sku: String, product_name: String, quantity: Number, reason: String, reported_by: String, store_id: String },
  { timestamps: true }
);

export const DamagedItemReport = mongoose.models.DamagedItemReport || mongoose.model('DamagedItemReport', damagedItemSchema);

// ─── Missing Item Report ──────────────────────────────────────────────────────

const missingItemReportSchema = new Schema(
  { order_id: String, sku: String, product_name: String, quantity: Number, reason: String, reported_by: String, store_id: String, status: { type: String, enum: ['open', 'resolved'], default: 'open' } },
  { timestamps: true }
);

export const MissingItemReport = mongoose.models.MissingItemReport || mongoose.model('MissingItemReport', missingItemReportSchema);

// ─── Cycle Count Metrics ─────────────────────────────────────────────────────

const cycleCountMetricsSchema = new Schema(
  { store_id: String, period: String, items_counted: Number, discrepancies: Number, accuracy_rate: Number, conducted_by: String },
  { timestamps: true }
);

export const CycleCountMetrics = mongoose.models.CycleCountMetrics || mongoose.model('CycleCountMetrics', cycleCountMetricsSchema);

// ─── Cycle Count Heatmap ─────────────────────────────────────────────────────

const cycleCountHeatmapSchema = new Schema(
  { store_id: String, zone: String, aisle: String, shelf: String, risk_score: Number, last_counted: Date },
  { timestamps: true }
);

export const CycleCountHeatmap = mongoose.models.CycleCountHeatmap || mongoose.model('CycleCountHeatmap', cycleCountHeatmapSchema);

// ─── Cycle Count Variance ─────────────────────────────────────────────────────

const cycleCountVarianceSchema = new Schema(
  { store_id: String, sku: String, product_name: String, expected_qty: Number, actual_qty: Number, variance: Number, counted_by: String, counted_at: Date },
  { timestamps: true }
);

export const CycleCountVariance = mongoose.models.CycleCountVariance || mongoose.model('CycleCountVariance', cycleCountVarianceSchema);

// ─── Label Print Job ──────────────────────────────────────────────────────────

const labelPrintJobSchema = new Schema(
  { job_id: String, type: String, reference_id: String, labels: [{ sku: String, product_name: String, quantity: Number }], printed_by: String, store_id: String, status: { type: String, enum: ['pending', 'printed', 'failed'], default: 'pending' } },
  { timestamps: true }
);

export const LabelPrintJob = mongoose.models.LabelPrintJob || mongoose.model('LabelPrintJob', labelPrintJobSchema);

// ─── Outbound Transfer Request ────────────────────────────────────────────────

const outboundTransferSchema = new Schema(
  {
    request_id: { type: String, required: true, unique: true },
    from_store: String,
    to_store: String,
    items: [{ sku: String, product_name: String, requested_qty: Number, fulfilled_qty: { type: Number, default: 0 } }],
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'fulfilled', 'partial'], default: 'pending' },
    approved_by: String,
    sla_deadline: Date,
    notes: String,
  },
  { timestamps: true }
);

export const OutboundTransferRequest = mongoose.models.OutboundTransferRequest || mongoose.model('OutboundTransferRequest', outboundTransferSchema);

// ─── Network Status ───────────────────────────────────────────────────────────

const networkStatusSchema = new Schema(
  { store_id: String, component: String, status: { type: String, enum: ['online', 'offline', 'degraded'], default: 'online' }, latency_ms: Number, last_check: { type: Date, default: Date.now } },
  { timestamps: true }
);

export const NetworkStatus = mongoose.models.NetworkStatus || mongoose.model('NetworkStatus', networkStatusSchema);

// ─── Power Backup ─────────────────────────────────────────────────────────────

const powerBackupSchema = new Schema(
  { store_id: String, unit_id: String, status: { type: String, enum: ['online', 'on_battery', 'offline'], default: 'online' }, battery_percent: Number, estimated_runtime_min: Number, last_check: { type: Date, default: Date.now } },
  { timestamps: true }
);

export const PowerBackup = mongoose.models.PowerBackup || mongoose.model('PowerBackup', powerBackupSchema);

// ─── Incident ─────────────────────────────────────────────────────────────────

const incidentSchema = new Schema(
  { incident_id: String, type: String, description: String, severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' }, store_id: String, reported_by: String, status: { type: String, enum: ['open', 'investigating', 'resolved'], default: 'open' } },
  { timestamps: true }
);

export const Incident = mongoose.models.Incident || mongoose.model('Incident', incidentSchema);

// ─── Employee of the Week ─────────────────────────────────────────────────────

const eowSchema = new Schema(
  { store_id: String, staff_id: String, staff_name: String, week_start: Date, reason: String, nominated_by: String },
  { timestamps: true }
);

export const EmployeeOfWeek = mongoose.models.EmployeeOfWeek || mongoose.model('EmployeeOfWeek', eowSchema);

// ─── Incentive Criteria ───────────────────────────────────────────────────────

const incentiveCriteriaSchema = new Schema(
  { store_id: String, role: String, metric: String, threshold: Number, bonus_amount: Number, period: String, active: { type: Boolean, default: true } },
  { timestamps: true }
);

export const IncentiveCriteria = mongoose.models.IncentiveCriteria || mongoose.model('IncentiveCriteria', incentiveCriteriaSchema);

// ─── Dispatch ─────────────────────────────────────────────────────────────────

const darkstoreDispatchSchema = new Schema(
  { dispatch_id: String, order_ids: [String], rider_id: String, rider_name: String, status: { type: String, enum: ['pending', 'dispatched', 'delivered', 'failed'], default: 'pending' }, store_id: String, dispatched_at: Date, delivered_at: Date },
  { timestamps: true }
);

export const DarkstoreDispatch = mongoose.models.DarkstoreDispatch || mongoose.model('DarkstoreDispatch', darkstoreDispatchSchema, 'darkstore_dispatch');

// ─── Bulk Upload ──────────────────────────────────────────────────────────────

const bulkUploadSchema = new Schema(
  { upload_id: String, type: String, file_name: String, total_rows: Number, success_rows: Number, error_rows: Number, status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' }, uploaded_by: String, store_id: String, errors: [String] },
  { timestamps: true }
);

export const BulkUpload = mongoose.models.BulkUpload || mongoose.model('BulkUpload', bulkUploadSchema);

// ─── Peak Hour Alert ──────────────────────────────────────────────────────────

const peakHourAlertSchema = new Schema(
  { store_id: String, hour: Number, expected_orders: Number, current_orders: Number, alert_triggered: { type: Boolean, default: false }, resolved: { type: Boolean, default: false } },
  { timestamps: true }
);

export const PeakHourAlert = mongoose.models.PeakHourAlert || mongoose.model('PeakHourAlert', peakHourAlertSchema);

// ─── Packaging Suggestion ─────────────────────────────────────────────────────

const packagingSuggestionSchema = new Schema(
  { order_id: String, suggested_box_size: String, reason: String, store_id: String, applied: { type: Boolean, default: false } },
  { timestamps: true }
);

export const PackagingSuggestion = mongoose.models.PackagingSuggestion || mongoose.model('PackagingSuggestion', packagingSuggestionSchema);

// ─── Truck ────────────────────────────────────────────────────────────────────

const truckSchema = new Schema(
  { truck_id: { type: String, required: true, unique: true }, plate_number: String, driver_name: String, status: { type: String, enum: ['available', 'loading', 'in_transit', 'unloading'], default: 'available' }, store_id: String, capacity: Number, current_load: { type: Number, default: 0 } },
  { timestamps: true }
);

export const Truck = mongoose.models.Truck || mongoose.model('Truck', truckSchema);

// ─── Restock ──────────────────────────────────────────────────────────────────

const restockSchema = new Schema(
  { restock_id: String, sku: String, product_name: String, quantity: Number, source: String, store_id: String, status: { type: String, enum: ['pending', 'received', 'cancelled'], default: 'pending' } },
  { timestamps: true }
);

export const Restock = mongoose.models.Restock || mongoose.model('Restock', restockSchema);
