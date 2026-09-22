import mongoose, { Document, Schema } from 'mongoose';

// ─── Factory ──────────────────────────────────────────────────────────────────

export interface IFactory extends Document {
  factory_id: string;
  name: string;
  code: string;
  status: 'operational' | 'maintenance';
  created_at: Date;
  updated_at: Date;
}

const FactorySchema = new Schema<IFactory>(
  {
    factory_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    status: { type: String, required: true, enum: ['operational', 'maintenance'], default: 'operational' },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

FactorySchema.index({ factory_id: 1 });
FactorySchema.index({ status: 1 });

export const Factory =
  (mongoose.models.Factory as mongoose.Model<IFactory>) ||
  mongoose.model<IFactory>('Factory', FactorySchema);

// ─── ProductionLine ───────────────────────────────────────────────────────────

export interface IProductionLine extends Document {
  line_id: string;
  factory_id: string;
  name: string;
  currentJob?: string | null;
  status: 'running' | 'changeover' | 'maintenance' | 'idle';
  output: number;
  target: number;
  efficiency: number;
  defect_rate: number;
  created_at: Date;
  updated_at: Date;
}

const ProductionLineSchema = new Schema<IProductionLine>(
  {
    line_id: { type: String, required: true, unique: true },
    factory_id: { type: String, required: true },
    name: { type: String, required: true },
    currentJob: { type: String, default: null },
    status: { type: String, required: true, enum: ['running', 'changeover', 'maintenance', 'idle'], default: 'idle' },
    output: { type: Number, default: 0 },
    target: { type: Number, default: 0 },
    efficiency: { type: Number, default: 0 },
    defect_rate: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

ProductionLineSchema.index({ factory_id: 1 });
ProductionLineSchema.index({ line_id: 1 });

export const ProductionLine =
  (mongoose.models.ProductionLine as mongoose.Model<IProductionLine>) ||
  mongoose.model<IProductionLine>('ProductionLine', ProductionLineSchema);

// ─── WorkOrder ────────────────────────────────────────────────────────────────

export interface IWorkOrder extends Document {
  store_id?: string;
  orderNumber: string;
  product: string;
  quantity: number;
  line: string;
  operator?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold';
  dueDate?: Date;
}

const WorkOrderSchema = new Schema<IWorkOrder>(
  {
    store_id: { type: String, required: false, index: true },
    orderNumber: { type: String, required: true },
    product: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    line: { type: String, default: '' },
    operator: { type: String },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['pending', 'in-progress', 'completed', 'on-hold'], default: 'pending' },
    dueDate: { type: Date },
  },
  { timestamps: true },
);

WorkOrderSchema.index({ status: 1 });
WorkOrderSchema.index({ orderNumber: 1 });
WorkOrderSchema.index({ store_id: 1, status: 1 });

export const WorkOrder =
  (mongoose.models.WorkOrder as mongoose.Model<IWorkOrder>) ||
  mongoose.model<IWorkOrder>('WorkOrder', WorkOrderSchema, 'prod_work_orders');

// ─── ProductionPlan ───────────────────────────────────────────────────────────

export interface IProductionPlan extends Document {
  store_id?: string;
  product: string;
  line: string;
  startDate: Date;
  endDate: Date;
  quantity: number;
  status: 'scheduled' | 'in-progress' | 'completed';
}

const ProductionPlanSchema = new Schema<IProductionPlan>(
  {
    store_id: { type: String, required: false, index: true },
    product: { type: String, required: true },
    line: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['scheduled', 'in-progress', 'completed'], default: 'scheduled' },
  },
  { timestamps: true },
);

ProductionPlanSchema.index({ status: 1 });
ProductionPlanSchema.index({ startDate: 1, endDate: 1 });
ProductionPlanSchema.index({ store_id: 1, startDate: 1 });

export const ProductionPlan =
  (mongoose.models.ProductionPlan as mongoose.Model<IProductionPlan>) ||
  mongoose.model<IProductionPlan>('ProductionPlan', ProductionPlanSchema, 'prod_planning_schedule');

// ─── RawMaterial ──────────────────────────────────────────────────────────────

export interface IRawMaterial extends Document {
  store_id?: string;
  name: string;
  currentStock: number;
  unit: string;
  safetyStock: number;
  reorderPoint: number;
  supplier: string;
  category: string;
  lastOrderDate?: Date;
  orderStatus: 'none' | 'ordered';
}

const RawMaterialSchema = new Schema<IRawMaterial>(
  {
    store_id: { type: String, required: false, index: true },
    name: { type: String, required: true },
    currentStock: { type: Number, required: true, min: 0, default: 0 },
    unit: { type: String, required: true, default: 'kg' },
    safetyStock: { type: Number, required: true, min: 0, default: 0 },
    reorderPoint: { type: Number, required: true, min: 0, default: 0 },
    supplier: { type: String, default: '' },
    category: { type: String, default: '' },
    lastOrderDate: { type: Date },
    orderStatus: { type: String, enum: ['none', 'ordered'], default: 'none' },
  },
  { timestamps: true },
);

RawMaterialSchema.index({ name: 'text', category: 'text' });
RawMaterialSchema.index({ currentStock: 1 });
RawMaterialSchema.index({ store_id: 1, name: 1 });

export const RawMaterial =
  (mongoose.models.RawMaterial as mongoose.Model<IRawMaterial>) ||
  mongoose.model<IRawMaterial>('RawMaterial', RawMaterialSchema, 'prod_raw_materials');

// ─── InboundReceipt ───────────────────────────────────────────────────────────

export interface IInboundReceipt extends Document {
  store_id?: string;
  poNumber: string;
  supplier: string;
  expectedDate: Date;
  status: 'pending' | 'received' | 'cancelled';
  items?: string;
}

const InboundReceiptSchema = new Schema<IInboundReceipt>(
  {
    store_id: { type: String, required: false, index: true },
    poNumber: { type: String, required: true },
    supplier: { type: String, required: true },
    expectedDate: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'received', 'cancelled'], default: 'pending' },
    items: { type: String },
  },
  { timestamps: true },
);

InboundReceiptSchema.index({ store_id: 1, status: 1 });

export const InboundReceipt =
  (mongoose.models.InboundReceipt as mongoose.Model<IInboundReceipt>) ||
  mongoose.model<IInboundReceipt>('InboundReceipt', InboundReceiptSchema);

// ─── Requisition ──────────────────────────────────────────────────────────────

export interface IRequisition extends Document {
  store_id?: string;
  reqNumber: string;
  material: string;
  quantity: number;
  line: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected' | 'issued';
}

const RequisitionSchema = new Schema<IRequisition>(
  {
    store_id: { type: String, required: false, index: true },
    reqNumber: { type: String, required: true },
    material: { type: String, required: true },
    quantity: { type: Number, required: true },
    line: { type: String, required: true },
    requestedBy: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'issued'], default: 'pending' },
  },
  { timestamps: true },
);

RequisitionSchema.index({ store_id: 1, status: 1 });

export const Requisition =
  (mongoose.models.Requisition as mongoose.Model<IRequisition>) ||
  mongoose.model<IRequisition>('Requisition', RequisitionSchema);

// ─── QCInspection ─────────────────────────────────────────────────────────────

export interface IQCInspection extends Document {
  inspection_id: string;
  batch_id: string;
  product_name: string;
  inspector: string;
  date: string;
  status: 'passed' | 'failed' | 'pending';
  score: number;
  items_inspected: number;
  defects_found: number;
  check_type?: string;
  notes?: string;
  store_id?: string;
  line_id?: string;
  factory_id?: string;
}

const QCInspectionSchema = new Schema<IQCInspection>(
  {
    inspection_id: { type: String, required: true, unique: true },
    batch_id: { type: String, required: true },
    product_name: { type: String, required: true },
    inspector: { type: String, required: true },
    date: { type: String, required: true },
    status: { type: String, required: true, enum: ['passed', 'failed', 'pending'] },
    score: { type: Number, required: true },
    items_inspected: { type: Number, required: true },
    defects_found: { type: Number, required: true },
    check_type: { type: String },
    notes: { type: String },
    store_id: { type: String, required: false },
    line_id: { type: String, required: false, index: true },
    factory_id: { type: String, required: false, index: true },
  },
  { timestamps: true },
);

QCInspectionSchema.index({ store_id: 1, date: -1 });
QCInspectionSchema.index({ inspection_id: 1 });

export const QCInspection =
  (mongoose.models.QCInspection as mongoose.Model<IQCInspection>) ||
  mongoose.model<IQCInspection>('QCInspection', QCInspectionSchema);

// ─── QCFailure ────────────────────────────────────────────────────────────────

export interface IQCFailure extends Document {
  failure_id: string;
  order_id: string;
  product_name: string;
  sku: string;
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_by: string;
  detected_at: Date;
  status: 'pending' | 'resolved';
  action_taken?: string;
  resolution_notes?: string;
  store_id: string;
}

const QCFailureSchema = new Schema<IQCFailure>(
  {
    failure_id: { type: String, required: true, unique: true },
    order_id: { type: String, required: true },
    product_name: { type: String, required: true },
    sku: { type: String, required: true },
    issue: { type: String, required: true },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    detected_by: { type: String, required: true },
    detected_at: { type: Date, required: true },
    status: { type: String, required: true, enum: ['pending', 'resolved'], default: 'pending' },
    action_taken: { type: String },
    resolution_notes: { type: String },
    store_id: { type: String, required: true },
  },
  { timestamps: true },
);

QCFailureSchema.index({ store_id: 1, status: 1 });
QCFailureSchema.index({ failure_id: 1 });
QCFailureSchema.index({ store_id: 1, detected_at: -1 });

export const QCFailure =
  (mongoose.models.QCFailure as mongoose.Model<IQCFailure>) ||
  mongoose.model<IQCFailure>('QCFailure', QCFailureSchema);

// ─── WatchlistItem ────────────────────────────────────────────────────────────

export interface IWatchlistItem extends Document {
  sku: string;
  product_name: string;
  reason?: string;
  required_check: string;
  last_check?: Date;
  next_check?: Date;
  status: 'active' | 'acknowledged' | 'inactive';
  store_id: string;
}

const WatchlistItemSchema = new Schema<IWatchlistItem>(
  {
    sku: { type: String, required: true },
    product_name: { type: String, required: true },
    reason: { type: String },
    required_check: { type: String, required: true },
    last_check: { type: Date },
    next_check: { type: Date },
    status: { type: String, enum: ['active', 'acknowledged', 'inactive'], default: 'active' },
    store_id: { type: String, required: true },
  },
  { timestamps: true },
);

WatchlistItemSchema.index({ store_id: 1, status: 1 });
WatchlistItemSchema.index({ sku: 1 });

export const WatchlistItem =
  (mongoose.models.WatchlistItem as mongoose.Model<IWatchlistItem>) ||
  mongoose.model<IWatchlistItem>('WatchlistItem', WatchlistItemSchema);

// ─── QCCheckLog ───────────────────────────────────────────────────────────────

export interface IQCCheckLog extends Document {
  sku: string;
  store_id: string;
  check_result: string;
  check_notes?: string;
  checked_by: string;
  checked_at: Date;
}

const QCCheckLogSchema = new Schema<IQCCheckLog>(
  {
    sku: { type: String, required: true },
    store_id: { type: String, required: true },
    check_result: { type: String, required: true },
    check_notes: { type: String },
    checked_by: { type: String, required: true },
    checked_at: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

QCCheckLogSchema.index({ store_id: 1, sku: 1 });

export const QCCheckLog =
  (mongoose.models.QCCheckLog as mongoose.Model<IQCCheckLog>) ||
  mongoose.model<IQCCheckLog>('QCCheckLog', QCCheckLogSchema);

// ─── ComplianceLog ────────────────────────────────────────────────────────────

export interface IComplianceLog extends Document {
  log_id: string;
  category: string;
  zone: string;
  reading: string;
  threshold: string;
  status: string;
  logged_by: string;
  logged_at: Date;
  notes?: string;
  store_id: string;
}

const ComplianceLogSchema = new Schema<IComplianceLog>(
  {
    log_id: { type: String, required: true },
    category: { type: String, required: true },
    zone: { type: String, required: true },
    reading: { type: String, required: true },
    threshold: { type: String, required: true },
    status: { type: String, required: true },
    logged_by: { type: String, required: true },
    logged_at: { type: Date, required: true },
    notes: { type: String },
    store_id: { type: String, required: true },
  },
  { timestamps: true },
);

ComplianceLogSchema.index({ store_id: 1, category: 1 });
ComplianceLogSchema.index({ store_id: 1, logged_at: -1 });

export const ComplianceLog =
  (mongoose.models.ProductionComplianceLog as mongoose.Model<IComplianceLog>) ||
  mongoose.model<IComplianceLog>('ProductionComplianceLog', ComplianceLogSchema, 'compliance_logs');

// ─── ComplianceDoc ────────────────────────────────────────────────────────────

export interface IComplianceDoc extends Document {
  doc_id: string;
  title: string;
  type: string;
  status: string;
  expiry_date?: Date;
  store_id: string;
}

const ComplianceDocSchema = new Schema<IComplianceDoc>(
  {
    doc_id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    type: { type: String, required: true },
    status: { type: String, required: true },
    expiry_date: { type: Date },
    store_id: { type: String, required: true },
  },
  { timestamps: true },
);

ComplianceDocSchema.index({ store_id: 1, status: 1 });

export const ComplianceDoc =
  (mongoose.models.ProductionComplianceDoc as mongoose.Model<IComplianceDoc>) ||
  mongoose.model<IComplianceDoc>('ProductionComplianceDoc', ComplianceDocSchema, 'compliance_docs');

// ─── SampleTest ───────────────────────────────────────────────────────────────

export interface ISampleTest extends Document {
  sample_id: string;
  batch_id: string;
  product_name: string;
  test_type: string;
  source?: string;
  priority: 'low' | 'normal' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result: 'pending' | 'pass' | 'fail';
  result_notes?: string;
  tested_by: string;
  date: string;
  received_date: string;
  completed_date?: string;
  store_id: string;
}

const SampleTestSchema = new Schema<ISampleTest>(
  {
    sample_id: { type: String, required: true, unique: true },
    batch_id: { type: String, required: true },
    product_name: { type: String, required: true },
    test_type: { type: String, required: true },
    source: { type: String },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed'], default: 'pending' },
    result: { type: String, enum: ['pending', 'pass', 'fail'], default: 'pending' },
    result_notes: { type: String },
    tested_by: { type: String, required: true },
    date: { type: String, required: true },
    received_date: { type: String, required: true },
    completed_date: { type: String },
    store_id: { type: String, required: true },
  },
  { timestamps: true },
);

SampleTestSchema.index({ store_id: 1, result: 1 });
SampleTestSchema.index({ sample_id: 1 });

export const SampleTest =
  (mongoose.models.SampleTest as mongoose.Model<ISampleTest>) ||
  mongoose.model<ISampleTest>('SampleTest', SampleTestSchema);

// ─── ChecklistItem ────────────────────────────────────────────────────────────

export interface IChecklistItem extends Document {
  item_id: string;
  title: string;
  category: string;
  status: 'pending' | 'completed' | 'skipped';
  completed_at?: Date;
  completed_by?: string;
  store_id: string;
}

const ChecklistItemSchema = new Schema<IChecklistItem>(
  {
    item_id: { type: String, required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    status: { type: String, enum: ['pending', 'completed', 'skipped'], default: 'pending' },
    completed_at: { type: Date },
    completed_by: { type: String },
    store_id: { type: String, required: true },
  },
  { timestamps: true },
);

ChecklistItemSchema.index({ store_id: 1, status: 1 });

export const ChecklistItem =
  (mongoose.models.ChecklistItem as mongoose.Model<IChecklistItem>) ||
  mongoose.model<IChecklistItem>('ChecklistItem', ChecklistItemSchema);

// ─── AuditStatus ──────────────────────────────────────────────────────────────

export interface IAuditStatus extends Document {
  status: 'compliant' | 'non_compliant' | 'pending';
  last_passed?: Date;
  next_audit?: Date;
  critical_checks_up_to_date: boolean;
  message?: string;
  store_id: string;
}

const AuditStatusSchema = new Schema<IAuditStatus>(
  {
    status: { type: String, enum: ['compliant', 'non_compliant', 'pending'], default: 'compliant' },
    last_passed: { type: Date },
    next_audit: { type: Date },
    critical_checks_up_to_date: { type: Boolean, default: true },
    message: { type: String },
    store_id: { type: String, required: true },
  },
  { timestamps: true },
);

AuditStatusSchema.index({ store_id: 1 });

export const AuditStatus =
  (mongoose.models.AuditStatus as mongoose.Model<IAuditStatus>) ||
  mongoose.model<IAuditStatus>('AuditStatus', AuditStatusSchema);

// ─── ProductionAlert ──────────────────────────────────────────────────────────

export interface IProductionAlert extends Document {
  alert_id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'equipment' | 'material' | 'quality' | 'safety' | 'shift' | 'production';
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  location?: string;
  assigned_to?: string;
  resolved_by?: string;
  resolved_at?: Date;
  factory_id: string;
  created_at: Date;
  updated_at: Date;
}

const ProductionAlertSchema = new Schema<IProductionAlert>(
  {
    alert_id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    severity: { type: String, required: true, enum: ['critical', 'warning', 'info'], default: 'warning' },
    category: { type: String, required: true, enum: ['equipment', 'material', 'quality', 'safety', 'shift', 'production'] },
    status: { type: String, required: true, enum: ['active', 'acknowledged', 'resolved', 'dismissed'], default: 'active' },
    location: { type: String },
    assigned_to: { type: String },
    resolved_by: { type: String },
    resolved_at: { type: Date },
    factory_id: { type: String, required: true, default: () => process.env.DEFAULT_FACTORY_ID || 'FAC-Austin-01' },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

ProductionAlertSchema.index({ factory_id: 1, status: 1 });
ProductionAlertSchema.index({ factory_id: 1, severity: 1 });
ProductionAlertSchema.index({ factory_id: 1, category: 1 });
ProductionAlertSchema.index({ alert_id: 1 });

export const ProductionAlert =
  (mongoose.models.ProductionAlert as mongoose.Model<IProductionAlert>) ||
  mongoose.model<IProductionAlert>('ProductionAlert', ProductionAlertSchema);

// ─── Settings (Production/Darkstore) ─────────────────────────────────────────

export interface IProductionSettings extends Document {
  store_id: string;
  refreshIntervals: {
    dashboard: number;
    alerts: number;
    orders: number;
    inventory: number;
    analytics: number;
  };
  storeMode: 'online' | 'pause' | 'maintenance';
  notifications: {
    enabled: boolean;
    sound: boolean;
    criticalOnly: boolean;
    email: boolean;
  };
  display: {
    theme: 'light' | 'dark' | 'auto';
    timeFormat: '12h' | '24h';
    dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  };
  performance: {
    enableRealTimeUpdates: boolean;
    enableOptimisticUpdates: boolean;
    cacheTimeout: number;
  };
  outbound: {
    autoDispatchEnabled: boolean;
    autoDispatchThreshold: number;
    maxOrdersPerRider: number;
    enableRiderAutoAssignment: boolean;
  };
  lastUpdated: Date;
  updatedBy: string;
}

const ProductionSettingsSchema = new Schema<IProductionSettings>(
  {
    store_id: { type: String, required: true, default: 'DS-Brooklyn-04', index: true },
    refreshIntervals: {
      dashboard: { type: Number, default: 30, min: 5, max: 300 },
      alerts: { type: Number, default: 15, min: 5, max: 300 },
      orders: { type: Number, default: 10, min: 5, max: 300 },
      inventory: { type: Number, default: 20, min: 5, max: 300 },
      analytics: { type: Number, default: 30, min: 5, max: 300 },
    },
    storeMode: { type: String, enum: ['online', 'pause', 'maintenance'], default: 'online' },
    notifications: {
      enabled: { type: Boolean, default: true },
      sound: { type: Boolean, default: true },
      criticalOnly: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
    },
    display: {
      theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
      timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' },
      dateFormat: { type: String, enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'], default: 'MM/DD/YYYY' },
    },
    performance: {
      enableRealTimeUpdates: { type: Boolean, default: true },
      enableOptimisticUpdates: { type: Boolean, default: true },
      cacheTimeout: { type: Number, default: 60, min: 10, max: 300 },
    },
    outbound: {
      autoDispatchEnabled: { type: Boolean, default: true },
      autoDispatchThreshold: { type: Number, default: 5, min: 1, max: 20 },
      maxOrdersPerRider: { type: Number, default: 5, min: 1, max: 10 },
      enableRiderAutoAssignment: { type: Boolean, default: true },
    },
    lastUpdated: { type: Date, default: Date.now },
    updatedBy: { type: String, default: 'system' },
  },
  { timestamps: true },
);

ProductionSettingsSchema.index({ store_id: 1 }, { unique: true });

export const ProductionSettings =
  (mongoose.models.ProductionSettings as mongoose.Model<IProductionSettings>) ||
  mongoose.model<IProductionSettings>('ProductionSettings', ProductionSettingsSchema, 'production_settings');

// ─── InventoryItem ────────────────────────────────────────────────────────────

export interface IInventoryItem extends Document {
  id: string;
  sku: string;
  name: string;
  category: 'Produce' | 'Dairy' | 'Bakery' | 'Pantry' | 'Snacks' | 'Spreads' | 'Supplements';
  stock: number;
  status: 'Fast Movers' | 'Slow Movers' | 'Out of Stock' | 'Near Expiry' | 'Overstocked';
  trend: 'up' | 'down' | 'stable';
  store_id: string;
  location?: string;
  barcode?: string;
}

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    id: { type: String, required: true, unique: true },
    sku: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ['Produce', 'Dairy', 'Bakery', 'Pantry', 'Snacks', 'Spreads', 'Supplements'],
    },
    stock: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      enum: ['Fast Movers', 'Slow Movers', 'Out of Stock', 'Near Expiry', 'Overstocked'],
      default: 'Slow Movers',
    },
    trend: { type: String, required: true, enum: ['up', 'down', 'stable'], default: 'stable' },
    store_id: { type: String, required: true },
    location: { type: String, required: false },
    barcode: { type: String, required: false },
  },
  { timestamps: true },
);

InventoryItemSchema.index({ store_id: 1, category: 1 });
InventoryItemSchema.index({ sku: 1 });
InventoryItemSchema.index({ barcode: 1 });
InventoryItemSchema.index({ status: 1 });
InventoryItemSchema.index({ store_id: 1, status: 1 });

export const InventoryItem =
  (mongoose.models.InventoryItem as mongoose.Model<IInventoryItem>) ||
  mongoose.model<IInventoryItem>('InventoryItem', InventoryItemSchema);

// ─── InventoryAdjustment ──────────────────────────────────────────────────────

export interface IInventoryAdjustment extends Document {
  id: string;
  adjustment_id: string;
  time?: string;
  sku: string;
  action: string;
  quantity: number;
  user: string;
  reason?: string;
  reason_code?: string;
  notes?: string;
  mode?: string;
  new_stock?: number;
  store_id: string;
}

const InventoryAdjustmentSchema = new Schema<IInventoryAdjustment>(
  {
    id: { type: String, required: true, unique: true },
    adjustment_id: { type: String, required: true },
    time: { type: String },
    sku: { type: String, required: true },
    action: { type: String, required: true },
    quantity: { type: Number, required: true },
    user: { type: String, required: true },
    reason: { type: String },
    reason_code: { type: String },
    notes: { type: String },
    mode: { type: String },
    new_stock: { type: Number },
    store_id: { type: String, required: true },
  },
  { timestamps: true },
);

InventoryAdjustmentSchema.index({ store_id: 1, action: 1 });
InventoryAdjustmentSchema.index({ sku: 1 });

export const InventoryAdjustment =
  (mongoose.models.InventoryAdjustment as mongoose.Model<IInventoryAdjustment>) ||
  mongoose.model<IInventoryAdjustment>('InventoryAdjustment', InventoryAdjustmentSchema);

// ─── CycleCountMetrics ────────────────────────────────────────────────────────

export interface ICycleCountMetrics extends Document {
  store_id: string;
  date: string;
  daily_count_progress: { percentage: number; items_counted: number; items_total: number };
  accuracy_rate: { percentage: number; target: number };
  variance_value: { amount: number; currency: string; items_missing: number; items_extra: number };
}

const CycleCountMetricsSchema = new Schema<ICycleCountMetrics>(
  {
    store_id: { type: String, required: true },
    date: { type: String, required: true },
    daily_count_progress: {
      percentage: { type: Number, default: 0 },
      items_counted: { type: Number, default: 0 },
      items_total: { type: Number, default: 0 },
    },
    accuracy_rate: {
      percentage: { type: Number, default: 0 },
      target: { type: Number, default: 99.0 },
    },
    variance_value: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
      items_missing: { type: Number, default: 0 },
      items_extra: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

CycleCountMetricsSchema.index({ store_id: 1, date: -1 });

export const CycleCountMetrics =
  (mongoose.models.CycleCountMetrics as mongoose.Model<ICycleCountMetrics>) ||
  mongoose.model<ICycleCountMetrics>('CycleCountMetrics', CycleCountMetricsSchema);

// ─── CycleCountHeatmap ────────────────────────────────────────────────────────

export interface ICycleCountHeatmap extends Document {
  store_id: string;
  date: string;
  zone_id: string;
  variance_level: string;
  accuracy: number;
}

const CycleCountHeatmapSchema = new Schema<ICycleCountHeatmap>(
  {
    store_id: { type: String, required: true },
    date: { type: String, required: true },
    zone_id: { type: String, required: true },
    variance_level: { type: String, required: true },
    accuracy: { type: Number, required: true },
  },
  { timestamps: true },
);

CycleCountHeatmapSchema.index({ store_id: 1, date: 1 });

export const CycleCountHeatmap =
  (mongoose.models.CycleCountHeatmap as mongoose.Model<ICycleCountHeatmap>) ||
  mongoose.model<ICycleCountHeatmap>('CycleCountHeatmap', CycleCountHeatmapSchema);

// ─── CycleCountVariance ───────────────────────────────────────────────────────

export interface ICycleCountVariance extends Document {
  store_id: string;
  date: string;
  sku: string;
  expected: number;
  counted: number;
  difference: number;
}

const CycleCountVarianceSchema = new Schema<ICycleCountVariance>(
  {
    store_id: { type: String, required: true },
    date: { type: String, required: true },
    sku: { type: String, required: true },
    expected: { type: Number, required: true },
    counted: { type: Number, required: true },
    difference: { type: Number, required: true },
  },
  { timestamps: true },
);

CycleCountVarianceSchema.index({ store_id: 1, date: 1 });

export const CycleCountVariance =
  (mongoose.models.CycleCountVariance as mongoose.Model<ICycleCountVariance>) ||
  mongoose.model<ICycleCountVariance>('CycleCountVariance', CycleCountVarianceSchema);

// ─── Shelf ────────────────────────────────────────────────────────────────────

export interface IShelf extends Document {
  shelf_id: string;
  store_id: string;
  zone: string;
  aisle: string;
  shelf_number: string;
  location_code: string;
  section?: string;
  status: string;
  is_critical: boolean;
  is_misplaced: boolean;
}

const ShelfSchema = new Schema<IShelf>(
  {
    shelf_id: { type: String, required: true, unique: true },
    store_id: { type: String, required: true },
    zone: { type: String, required: true },
    aisle: { type: String, required: true },
    shelf_number: { type: String, required: true },
    location_code: { type: String, required: true },
    section: { type: String },
    status: { type: String, required: true, default: 'normal' },
    is_critical: { type: Boolean, default: false },
    is_misplaced: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ShelfSchema.index({ store_id: 1, zone: 1 });
ShelfSchema.index({ location_code: 1 });

export const Shelf =
  (mongoose.models.Shelf as mongoose.Model<IShelf>) ||
  mongoose.model<IShelf>('Shelf', ShelfSchema);

// ─── ShelfSKU ─────────────────────────────────────────────────────────────────

export interface IShelfSKU extends Document {
  shelf_id: string;
  sku: string;
  product_name: string;
  stock_count: number;
}

const ShelfSKUSchema = new Schema<IShelfSKU>(
  {
    shelf_id: { type: String, required: true },
    sku: { type: String, required: true },
    product_name: { type: String, required: true },
    stock_count: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

ShelfSKUSchema.index({ shelf_id: 1 });

export const ShelfSKU =
  (mongoose.models.ShelfSKU as mongoose.Model<IShelfSKU>) ||
  mongoose.model<IShelfSKU>('ShelfSKU', ShelfSKUSchema);

// ─── ShelfIssue ───────────────────────────────────────────────────────────────

export interface IShelfIssue extends Document {
  shelf_id: string;
  type: string;
  message: string;
  severity: string;
}

const ShelfIssueSchema = new Schema<IShelfIssue>(
  {
    shelf_id: { type: String, required: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, required: true },
  },
  { timestamps: true },
);

ShelfIssueSchema.index({ shelf_id: 1 });

export const ShelfIssue =
  (mongoose.models.ShelfIssue as mongoose.Model<IShelfIssue>) ||
  mongoose.model<IShelfIssue>('ShelfIssue', ShelfIssueSchema);

// ─── ShelfActivity ────────────────────────────────────────────────────────────

export interface IShelfActivity extends Document {
  shelf_id: string;
  action: string;
  timestamp: Date;
}

const ShelfActivitySchema = new Schema<IShelfActivity>(
  {
    shelf_id: { type: String, required: true },
    action: { type: String, required: true },
    timestamp: { type: Date, required: true },
  },
  { timestamps: true },
);

ShelfActivitySchema.index({ shelf_id: 1 });

export const ShelfActivity =
  (mongoose.models.ShelfActivity as mongoose.Model<IShelfActivity>) ||
  mongoose.model<IShelfActivity>('ShelfActivity', ShelfActivitySchema);

// ─── RestockTask ──────────────────────────────────────────────────────────────

export interface IRestockTask extends Document {
  task_id: string;
  shelf_location: string;
  sku: string;
  reason: string;
  status: 'pending' | 'in_progress' | 'completed';
  store_id: string;
}

const RestockTaskSchema = new Schema<IRestockTask>(
  {
    task_id: { type: String, required: true, unique: true },
    shelf_location: { type: String, required: true },
    sku: { type: String, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    store_id: { type: String, required: true },
  },
  { timestamps: true },
);

RestockTaskSchema.index({ store_id: 1, status: 1 });

export const RestockTask =
  (mongoose.models.RestockTask as mongoose.Model<IRestockTask>) ||
  mongoose.model<IRestockTask>('RestockTask', RestockTaskSchema);

// ─── ProductionOrder ──────────────────────────────────────────────────────────

export interface IProductionOrder extends Document {
  order_id: string;
  store_id: string;
  order_type: 'Normal' | 'Priority' | 'Express' | 'Premium';
  status: 'new' | 'processing' | 'ready' | 'completed' | 'cancelled' | 'rto';
  item_count: number;
  sla_timer: string;
  sla_status: 'safe' | 'warning' | 'critical';
  sla_deadline: Date;
  assignee?: { id?: string; name?: string; initials?: string };
  rto_risk: boolean;
  rto_reason?: string;
  rto_notes?: string;
  rto_status?: 'marked_rto' | 'pending_confirmation' | 'rto_confirmed';
}

const ProductionOrderSchema = new Schema<IProductionOrder>(
  {
    order_id: { type: String, required: true, unique: true, match: /^ORD-\d+$/ },
    store_id: { type: String, required: true },
    order_type: { type: String, required: true, enum: ['Normal', 'Priority', 'Express', 'Premium'], default: 'Normal' },
    status: { type: String, required: true, enum: ['new', 'processing', 'ready', 'completed', 'cancelled', 'rto'], default: 'new' },
    item_count: { type: Number, required: true, min: 1 },
    sla_timer: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    sla_status: { type: String, required: true, enum: ['safe', 'warning', 'critical'], default: 'safe' },
    sla_deadline: { type: Date, required: true },
    assignee: {
      id: { type: String, required: false },
      name: { type: String, required: false },
      initials: { type: String, required: false, match: /^[A-Z]{1,3}$/ },
    },
    rto_risk: { type: Boolean, default: false },
    rto_reason: { type: String, required: false },
    rto_notes: { type: String, required: false, maxlength: 1000 },
    rto_status: { type: String, enum: ['marked_rto', 'pending_confirmation', 'rto_confirmed'], required: false },
  },
  { timestamps: true },
);

ProductionOrderSchema.index({ store_id: 1, status: 1 });
ProductionOrderSchema.index({ order_id: 1 });
ProductionOrderSchema.index({ sla_deadline: 1 });
ProductionOrderSchema.index({ rto_risk: 1 });

export const ProductionOrder =
  (mongoose.models.ProductionOrder as mongoose.Model<IProductionOrder>) ||
  mongoose.model<IProductionOrder>('ProductionOrder', ProductionOrderSchema);

// ─── StockAlert ───────────────────────────────────────────────────────────────

export interface IStockAlert extends Document {
  store_id: string;
  item_name: string;
  sku: string;
  current_count: number;
  threshold: number;
  severity: 'critical' | 'warning' | 'low';
  is_restocked: boolean;
  restock_id?: string;
}

const StockAlertSchema = new Schema<IStockAlert>(
  {
    store_id: { type: String, required: true },
    item_name: { type: String, required: true },
    sku: { type: String, required: true, match: /^[A-Z0-9]+$/ },
    current_count: { type: Number, required: true, min: 0 },
    threshold: { type: Number, required: true, min: 0 },
    severity: { type: String, required: true, enum: ['critical', 'warning', 'low'], default: 'warning' },
    is_restocked: { type: Boolean, default: false },
    restock_id: { type: String, required: false },
  },
  { timestamps: true },
);

StockAlertSchema.index({ store_id: 1, severity: 1 });
StockAlertSchema.index({ sku: 1 });

export const StockAlert =
  (mongoose.models.StockAlert as mongoose.Model<IStockAlert>) ||
  mongoose.model<IStockAlert>('StockAlert', StockAlertSchema);

// ─── RTOAlert ─────────────────────────────────────────────────────────────────

export interface IRTOAlert extends Document {
  order_id: string;
  store_id: string;
  issue_type: 'address_issue' | 'customer_unreachable' | 'payment_failed' | 'delivery_failed' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  customer_reachable: boolean;
  is_resolved: boolean;
}

const RTOAlertSchema = new Schema<IRTOAlert>(
  {
    order_id: { type: String, required: true, match: /^ORD-\d+$/ },
    store_id: { type: String, required: true },
    issue_type: {
      type: String,
      required: true,
      enum: ['address_issue', 'customer_unreachable', 'payment_failed', 'delivery_failed', 'other'],
    },
    description: { type: String, required: true },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    customer_reachable: { type: Boolean, default: false },
    is_resolved: { type: Boolean, default: false },
  },
  { timestamps: true },
);

RTOAlertSchema.index({ order_id: 1 });
RTOAlertSchema.index({ store_id: 1, is_resolved: 1 });
RTOAlertSchema.index({ severity: 1 });

export const RTOAlert =
  (mongoose.models.RTOAlert as mongoose.Model<IRTOAlert>) ||
  mongoose.model<IRTOAlert>('RTOAlert', RTOAlertSchema);

// ─── Picker ───────────────────────────────────────────────────────────────────

export interface IPicker extends Document {
  id: string;
  name: string;
  avatar?: string;
  status: 'available' | 'busy' | 'break';
  zone_expertise: string[];
  current_picklists: number;
  store_id?: string;
}

const PickerSchema = new Schema<IPicker>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    avatar: { type: String, required: false },
    status: { type: String, required: false, enum: ['available', 'busy', 'break'], default: 'available' },
    zone_expertise: { type: [String], required: false, enum: ['Ambient A', 'Ambient B', 'Chiller', 'Frozen'] },
    current_picklists: { type: Number, required: false, default: 0, min: 0 },
    store_id: { type: String, required: false },
  },
  { timestamps: true },
);

PickerSchema.index({ id: 1 });
PickerSchema.index({ store_id: 1, status: 1 });

export const Picker =
  (mongoose.models.Picker as mongoose.Model<IPicker>) ||
  mongoose.model<IPicker>('Picker', PickerSchema);

// ─── Picklist ─────────────────────────────────────────────────────────────────

export interface IPicklist extends Document {
  picklist_id: string;
  store_id?: string;
  zone: 'Ambient A' | 'Ambient B' | 'Chiller' | 'Frozen';
  sla_time?: string;
  sla_status?: 'safe' | 'atrisk' | 'urgent';
  items_count: number;
  orders_count: number;
  status: 'pending' | 'inprogress' | 'completed' | 'paused';
  progress?: number;
  priority: 'normal' | 'high' | 'urgent';
  picker_id?: string;
  suggested_picker?: string;
  type?: 'auto' | 'manual';
  packing_station_id?: string;
}

const PicklistSchema = new Schema<IPicklist>(
  {
    picklist_id: { type: String, required: true, unique: true },
    store_id: { type: String, required: false },
    zone: { type: String, required: true, enum: ['Ambient A', 'Ambient B', 'Chiller', 'Frozen'] },
    sla_time: { type: String, required: false },
    sla_status: { type: String, required: false, enum: ['safe', 'atrisk', 'urgent'] },
    items_count: { type: Number, required: false, default: 0 },
    orders_count: { type: Number, required: false, default: 0 },
    status: { type: String, required: true, enum: ['pending', 'inprogress', 'completed', 'paused'], default: 'pending' },
    progress: { type: Number, required: false, min: 0, max: 100 },
    priority: { type: String, required: false, enum: ['normal', 'high', 'urgent'], default: 'normal' },
    picker_id: { type: String, required: false },
    suggested_picker: { type: String, required: false },
    type: { type: String, required: false, enum: ['auto', 'manual'] },
    packing_station_id: { type: String, required: false },
  },
  { timestamps: true },
);

PicklistSchema.index({ store_id: 1, status: 1 });
PicklistSchema.index({ picklist_id: 1 });

export const Picklist =
  (mongoose.models.Picklist as mongoose.Model<IPicklist>) ||
  mongoose.model<IPicklist>('Picklist', PicklistSchema);

// ─── PackingOrder ─────────────────────────────────────────────────────────────

export interface IPackingOrder extends Document {
  order_id: string;
  customer_name?: string;
  order_type?: string;
  sla_time?: string;
  sla_status?: 'urgent' | 'warning' | 'normal';
  picker?: string;
  packing_station_id?: string;
  status: 'pending' | 'packing' | 'packed';
  store_id?: string;
}

const PackingOrderSchema = new Schema<IPackingOrder>(
  {
    order_id: { type: String, required: true, unique: true },
    customer_name: { type: String, required: false },
    order_type: { type: String, required: false },
    sla_time: { type: String, required: false },
    sla_status: { type: String, required: false, enum: ['urgent', 'warning', 'normal'] },
    picker: { type: String, required: false },
    packing_station_id: { type: String, required: false },
    status: { type: String, required: false, enum: ['pending', 'packing', 'packed'], default: 'pending' },
    store_id: { type: String, required: false },
  },
  { timestamps: true },
);

PackingOrderSchema.index({ order_id: 1 });
PackingOrderSchema.index({ store_id: 1, status: 1 });

export const PackingOrder =
  (mongoose.models.PackingOrder as mongoose.Model<IPackingOrder>) ||
  mongoose.model<IPackingOrder>('PackingOrder', PackingOrderSchema);

// ─── GRN ──────────────────────────────────────────────────────────────────────

export interface IGRN extends Document {
  grn_id: string;
  truck_id: string;
  supplier: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  store_id: string;
  items_count: number;
  total_quantity: number;
  received_quantity: number;
  expected_arrival: string;
  actual_arrival?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

const GRNSchema = new Schema<IGRN>(
  {
    grn_id: { type: String, required: true, unique: true },
    truck_id: { type: String, required: true },
    supplier: { type: String, required: true },
    status: { type: String, required: true, enum: ['pending', 'in_progress', 'completed', 'rejected'], default: 'pending' },
    store_id: { type: String, required: true },
    items_count: { type: Number, required: true, default: 0 },
    total_quantity: { type: Number, required: true, default: 0 },
    received_quantity: { type: Number, required: false, default: 0 },
    expected_arrival: { type: String, required: true },
    actual_arrival: { type: String, required: false },
    notes: { type: String, required: false },
    created_at: { type: String, required: true },
    updated_at: { type: String, required: true },
  },
  { timestamps: false },
);

GRNSchema.index({ grn_id: 1 });
GRNSchema.index({ store_id: 1, status: 1 });

export const GRN =
  (mongoose.models.GRN as mongoose.Model<IGRN>) ||
  mongoose.model<IGRN>('GRN', GRNSchema);

// ─── GRNItem ──────────────────────────────────────────────────────────────────

export interface IGRNItem extends Document {
  grn_id: string;
  sku: string;
  product_name: string;
  expected_quantity: number;
  received_quantity: number;
  damaged_quantity: number;
  status: 'pending' | 'received' | 'damaged';
  updated_at: string;
}

const GRNItemSchema = new Schema<IGRNItem>(
  {
    grn_id: { type: String, required: true },
    sku: { type: String, required: true },
    product_name: { type: String, required: true },
    expected_quantity: { type: Number, required: true, default: 0 },
    received_quantity: { type: Number, required: false, default: 0 },
    damaged_quantity: { type: Number, required: false, default: 0 },
    status: { type: String, enum: ['pending', 'received', 'damaged'], default: 'pending' },
    updated_at: { type: String, required: false },
  },
  { timestamps: false },
);

GRNItemSchema.index({ grn_id: 1, sku: 1 });

export const GRNItem =
  (mongoose.models.GRNItem as mongoose.Model<IGRNItem>) ||
  mongoose.model<IGRNItem>('GRNItem', GRNItemSchema);

// ─── PutawayTask ──────────────────────────────────────────────────────────────

export interface IPutawayTask extends Document {
  task_id: string;
  grn_id?: string;
  transfer_id?: string;
  sku: string;
  product_name: string;
  quantity: number;
  location: string;
  actual_location?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  assigned_to?: string;
  staff_id?: string;
  staff_name?: string;
  notes?: string;
  store_id: string;
  created_at: string;
  updated_at: string;
}

const PutawayTaskSchema = new Schema<IPutawayTask>(
  {
    task_id: { type: String, required: true, unique: true },
    grn_id: { type: String },
    transfer_id: { type: String },
    sku: { type: String, required: true },
    product_name: { type: String, required: true },
    quantity: { type: Number, required: true },
    location: { type: String, required: true },
    actual_location: { type: String },
    status: { type: String, enum: ['pending', 'assigned', 'in_progress', 'completed'], default: 'pending' },
    assigned_to: { type: String },
    staff_id: { type: String },
    staff_name: { type: String },
    notes: { type: String },
    store_id: { type: String, required: true },
    created_at: { type: String, required: true },
    updated_at: { type: String, required: true },
  },
  { timestamps: false },
);

PutawayTaskSchema.index({ store_id: 1, status: 1 });
PutawayTaskSchema.index({ grn_id: 1 });

export const PutawayTask =
  (mongoose.models.PutawayTask as mongoose.Model<IPutawayTask>) ||
  mongoose.model<IPutawayTask>('PutawayTask', PutawayTaskSchema);

// ─── InterStoreTransfer ───────────────────────────────────────────────────────

export interface IInterStoreTransfer extends Document {
  transfer_id: string;
  from_store: string;
  to_store: string;
  status: 'pending' | 'in_transit' | 'received' | 'rejected';
  items_count: number;
  requested_at?: string;
  expected_arrival?: string;
  actual_arrival?: string;
  notes?: string;
  updated_at?: string;
}

const InterStoreTransferSchema = new Schema<IInterStoreTransfer>(
  {
    transfer_id: { type: String, required: true, unique: true },
    from_store: { type: String, required: true },
    to_store: { type: String, required: true },
    status: { type: String, enum: ['pending', 'in_transit', 'received', 'rejected'], default: 'pending' },
    items_count: { type: Number, required: true, default: 0 },
    requested_at: { type: String },
    expected_arrival: { type: String },
    actual_arrival: { type: String },
    notes: { type: String },
    updated_at: { type: String },
  },
  { timestamps: false },
);

InterStoreTransferSchema.index({ to_store: 1, status: 1 });
InterStoreTransferSchema.index({ from_store: 1, status: 1 });

export const InterStoreTransfer =
  (mongoose.models.InterStoreTransfer as mongoose.Model<IInterStoreTransfer>) ||
  mongoose.model<IInterStoreTransfer>('InterStoreTransfer', InterStoreTransferSchema);

// ─── TransferItem ─────────────────────────────────────────────────────────────

export interface ITransferItem extends Document {
  transfer_id: string;
  sku: string;
  product_name: string;
  quantity: number;
}

const TransferItemSchema = new Schema<ITransferItem>(
  {
    transfer_id: { type: String, required: true },
    sku: { type: String, required: true },
    product_name: { type: String, required: true },
    quantity: { type: Number, required: true },
  },
  { timestamps: true },
);

TransferItemSchema.index({ transfer_id: 1 });

export const TransferItem =
  (mongoose.models.TransferItem as mongoose.Model<ITransferItem>) ||
  mongoose.model<ITransferItem>('TransferItem', TransferItemSchema);

// ─── Truck ────────────────────────────────────────────────────────────────────

export interface ITruck extends Document {
  truck_id: string;
  store_id: string;
  date: string;
  supplier: string;
  status: string;
}

const TruckSchema = new Schema<ITruck>(
  {
    truck_id: { type: String, required: true, unique: true },
    store_id: { type: String, required: true },
    date: { type: String, required: true },
    supplier: { type: String, required: true },
    status: { type: String, required: true, default: 'scheduled' },
  },
  { timestamps: true },
);

TruckSchema.index({ store_id: 1, date: 1 });

export const Truck =
  (mongoose.models.Truck as mongoose.Model<ITruck>) ||
  mongoose.model<ITruck>('Truck', TruckSchema);

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export interface IDispatch extends Document {
  dispatch_id: string;
  rider_id?: string;
  rider_name?: string;
  status: 'waiting' | 'assigned' | 'delayed' | 'in_transit';
  orders_count: number;
  eta?: string;
  dispatch_type: string;
  store_id: string;
  created_at: string;
  updated_at: string;
}

const DispatchSchema = new Schema<IDispatch>(
  {
    dispatch_id: { type: String, required: true, unique: true },
    rider_id: { type: String },
    rider_name: { type: String },
    status: { type: String, required: true, enum: ['waiting', 'assigned', 'delayed', 'in_transit'], default: 'waiting' },
    orders_count: { type: Number, required: true, default: 0 },
    eta: { type: String },
    dispatch_type: { type: String, required: true },
    store_id: { type: String, required: true },
    created_at: { type: String, required: true },
    updated_at: { type: String, required: true },
  },
  { timestamps: false },
);

DispatchSchema.index({ dispatch_id: 1 });
DispatchSchema.index({ store_id: 1, status: 1 });

export const Dispatch =
  (mongoose.models.Dispatch as mongoose.Model<IDispatch>) ||
  mongoose.model<IDispatch>('Dispatch', DispatchSchema);

// ─── DispatchOrder ────────────────────────────────────────────────────────────

export interface IDispatchOrder extends Document {
  dispatch_id: string;
  order_id: string;
  rider_id: string;
  assigned_at: string;
  store_id: string;
}

const DispatchOrderSchema = new Schema<IDispatchOrder>(
  {
    dispatch_id: { type: String, required: true },
    order_id: { type: String, required: true },
    rider_id: { type: String, required: true },
    assigned_at: { type: String, required: true },
    store_id: { type: String, required: true },
  },
  { timestamps: true },
);

DispatchOrderSchema.index({ dispatch_id: 1 });
DispatchOrderSchema.index({ order_id: 1 });

export const DispatchOrder =
  (mongoose.models.DispatchOrder as mongoose.Model<IDispatchOrder>) ||
  mongoose.model<IDispatchOrder>('DispatchOrder', DispatchOrderSchema);

// ─── OutboundTransferRequest ──────────────────────────────────────────────────

export interface IOutboundTransferRequest extends Document {
  request_id: string;
  from_store: string;
  to_store: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  items_count: number;
  requested_at?: string;
  expected_dispatch?: string;
  priority?: string;
  reason?: string;
  notes?: string;
  updated_at?: string;
}

const OutboundTransferRequestSchema = new Schema<IOutboundTransferRequest>(
  {
    request_id: { type: String, required: true, unique: true },
    from_store: { type: String, required: true },
    to_store: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'completed'], default: 'pending' },
    items_count: { type: Number, required: true, default: 0 },
    requested_at: { type: String },
    expected_dispatch: { type: String },
    priority: { type: String },
    reason: { type: String },
    notes: { type: String },
    updated_at: { type: String },
  },
  { timestamps: false },
);

OutboundTransferRequestSchema.index({ from_store: 1, status: 1 });

export const OutboundTransferRequest =
  (mongoose.models.OutboundTransferRequest as mongoose.Model<IOutboundTransferRequest>) ||
  mongoose.model<IOutboundTransferRequest>('OutboundTransferRequest', OutboundTransferRequestSchema);

// ─── PickPackTask ─────────────────────────────────────────────────────────────

export interface IPickPackTask extends Document {
  pick_pack_task_id: string;
  request_id: string;
  status: 'pending' | 'in_progress' | 'completed';
  picked: number;
  total: number;
  picker?: string;
  vehicle_id?: string;
  estimated_completion?: string;
  store_id: string;
  created_at: string;
  updated_at: string;
}

const PickPackTaskSchema = new Schema<IPickPackTask>(
  {
    pick_pack_task_id: { type: String, required: true, unique: true },
    request_id: { type: String, required: true },
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    picked: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    picker: { type: String },
    vehicle_id: { type: String },
    estimated_completion: { type: String },
    store_id: { type: String, required: true },
    created_at: { type: String, required: true },
    updated_at: { type: String, required: true },
  },
  { timestamps: false },
);

PickPackTaskSchema.index({ request_id: 1 });

export const PickPackTask =
  (mongoose.models.PickPackTask as mongoose.Model<IPickPackTask>) ||
  mongoose.model<IPickPackTask>('PickPackTask', PickPackTaskSchema);

// ─── ProductionRider ──────────────────────────────────────────────────────────

export interface IProductionRider extends Document {
  rider_id: string;
  rider_name: string;
  status: 'online' | 'offline' | 'busy' | 'waiting';
  location?: { lat?: number; lng?: number };
  current_orders: number;
  max_capacity: number;
  store_id: string;
  last_update: string;
}

const ProductionRiderSchema = new Schema<IProductionRider>(
  {
    rider_id: { type: String, required: true, unique: true },
    rider_name: { type: String, required: true },
    status: { type: String, required: true, enum: ['online', 'offline', 'busy', 'waiting'], default: 'online' },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    current_orders: { type: Number, required: true, default: 0 },
    max_capacity: { type: Number, required: true, default: 5 },
    store_id: { type: String, required: true },
    last_update: { type: String, required: true },
  },
  { timestamps: false },
);

ProductionRiderSchema.index({ rider_id: 1 });
ProductionRiderSchema.index({ store_id: 1, status: 1 });

export const ProductionRider =
  (mongoose.models.ProductionRider as mongoose.Model<IProductionRider>) ||
  mongoose.model<IProductionRider>('ProductionRider', ProductionRiderSchema);

// ─── DarkstoreAlert ───────────────────────────────────────────────────────────

export interface IDarkstoreAlert extends Document {
  alert_id: string;
  type: 'sla_breach' | 'delayed_delivery' | 'rider_no_show' | 'zone_deviation' | 'vehicle_breakdown' | 'rto_return' | 'other';
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';
  source?: {
    orderId?: string;
    riderId?: string;
    riderName?: string;
    vehicleId?: string;
    zone?: string;
    lat?: number;
    lng?: number;
  };
  actionsSuggested: string[];
  timeline: Array<{ at: string; status: string; note?: string; actor?: string }>;
  store_id: string;
  created_at: string;
  updated_at: string;
}

const DarkstoreAlertSchema = new Schema<IDarkstoreAlert>(
  {
    alert_id: { type: String, required: true, unique: true },
    type: {
      type: String,
      required: true,
      enum: ['sla_breach', 'delayed_delivery', 'rider_no_show', 'zone_deviation', 'vehicle_breakdown', 'rto_return', 'other'],
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, required: true, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
    status: { type: String, required: true, enum: ['open', 'acknowledged', 'in_progress', 'resolved', 'dismissed'], default: 'open' },
    source: {
      orderId: { type: String },
      riderId: { type: String },
      riderName: { type: String },
      vehicleId: { type: String },
      zone: { type: String },
      lat: { type: Number },
      lng: { type: Number },
    },
    actionsSuggested: { type: [String], default: [] },
    timeline: {
      type: [
        {
          at: { type: String, required: true },
          status: { type: String, required: true },
          note: { type: String },
          actor: { type: String },
        },
      ],
      default: [],
    },
    store_id: { type: String, required: true },
    created_at: { type: String, required: true },
    updated_at: { type: String, required: true },
  },
  { timestamps: false },
);

DarkstoreAlertSchema.index({ alert_id: 1 });
DarkstoreAlertSchema.index({ store_id: 1, status: 1 });
DarkstoreAlertSchema.index({ store_id: 1, priority: 1 });

export const DarkstoreAlert =
  (mongoose.models.DarkstoreAlert as mongoose.Model<IDarkstoreAlert>) ||
  mongoose.model<IDarkstoreAlert>('DarkstoreAlert', DarkstoreAlertSchema, 'darkstore_alerts');

// ─── CustomerCall ─────────────────────────────────────────────────────────────

export interface ICustomerCall extends Document {
  call_id: string;
  order_id: string;
  store_id: string;
  reason: string;
  status: 'initiated' | 'completed' | 'failed';
  duration?: number;
}

const CustomerCallSchema = new Schema<ICustomerCall>(
  {
    call_id: { type: String, required: true, unique: true },
    order_id: { type: String, required: true },
    store_id: { type: String, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['initiated', 'completed', 'failed'], default: 'initiated' },
    duration: { type: Number },
  },
  { timestamps: true },
);

CustomerCallSchema.index({ order_id: 1 });

export const CustomerCall =
  (mongoose.models.CustomerCall as mongoose.Model<ICustomerCall>) ||
  mongoose.model<ICustomerCall>('CustomerCall', CustomerCallSchema);

// ─── AlertHistory ─────────────────────────────────────────────────────────────

export interface IAlertHistory extends Document {
  entity_type: string;
  entity_id: string;
  alert_type: string;
  action: string;
  metadata?: Record<string, unknown>;
  performed_by: string;
  store_id: string;
}

const AlertHistorySchema = new Schema<IAlertHistory>(
  {
    entity_type: { type: String, required: true },
    entity_id: { type: String, required: true },
    alert_type: { type: String, required: true },
    action: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    performed_by: { type: String, required: true },
    store_id: { type: String, required: true },
  },
  { timestamps: true },
);

AlertHistorySchema.index({ entity_type: 1, entity_id: 1 });

export const AlertHistory =
  (mongoose.models.AlertHistory as mongoose.Model<IAlertHistory>) ||
  mongoose.model<IAlertHistory>('AlertHistory', AlertHistorySchema);

// ─── ProductionAuditLog ───────────────────────────────────────────────────────

export interface IProductionAuditLog extends Document {
  id: string;
  timestamp: string;
  action_type: string;
  action: string;
  user: string;
  sku?: string;
  module?: string;
  details?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  store_id: string;
}

const ProductionAuditLogSchema = new Schema<IProductionAuditLog>(
  {
    id: { type: String, required: true, unique: true },
    timestamp: { type: String, required: true },
    action_type: { type: String, required: true },
    action: { type: String, required: true },
    user: { type: String, required: true },
    sku: { type: String },
    module: { type: String },
    details: { type: Schema.Types.Mixed },
    changes: { type: Schema.Types.Mixed },
    store_id: { type: String, required: true },
  },
  { timestamps: true },
);

ProductionAuditLogSchema.index({ store_id: 1, action_type: 1 });
ProductionAuditLogSchema.index({ store_id: 1, module: 1 });

export const ProductionAuditLog =
  (mongoose.models.ProductionAuditLog as mongoose.Model<IProductionAuditLog>) ||
  mongoose.model<IProductionAuditLog>('ProductionAuditLog', ProductionAuditLogSchema, 'production_audit_logs');

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface IStaff extends Document {
  staff_id: string;
  store_id: string;
  name: string;
  role: string;
  department?: string;
  zone?: string;
  status: 'Active' | 'Break' | 'Offline' | 'Meeting';
  current_shift?: string;
  current_task?: string;
  shift_start?: Date;
  shift_end?: Date;
  is_active: boolean;
  current_load: number;
}

const StaffSchema = new Schema<IStaff>(
  {
    staff_id: { type: String, required: true, unique: true },
    store_id: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    department: { type: String },
    zone: { type: String },
    status: { type: String, required: true, enum: ['Active', 'Break', 'Offline', 'Meeting'], default: 'Offline' },
    current_shift: { type: String },
    current_task: { type: String },
    shift_start: { type: Date },
    shift_end: { type: Date },
    is_active: { type: Boolean, default: true },
    current_load: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true },
);

StaffSchema.index({ store_id: 1, role: 1, is_active: 1 });
StaffSchema.index({ store_id: 1, status: 1 });
StaffSchema.index({ store_id: 1, zone: 1 });

export const Staff =
  (mongoose.models.ProductionStaff as mongoose.Model<IStaff>) ||
  mongoose.model<IStaff>('ProductionStaff', StaffSchema, 'production_staff');

// ─── Absence ──────────────────────────────────────────────────────────────────

export interface IAbsence extends Document {
  staff_id: string;
  store_id: string;
  date: Date;
  reason: string;
  approved: boolean;
}

const AbsenceSchema = new Schema<IAbsence>(
  {
    staff_id: { type: String, required: true },
    store_id: { type: String, required: true },
    date: { type: Date, required: true },
    reason: { type: String, required: true },
    approved: { type: Boolean, default: false },
  },
  { timestamps: true },
);

AbsenceSchema.index({ store_id: 1, date: -1 });

export const Absence =
  (mongoose.models.ProductionAbsence as mongoose.Model<IAbsence>) ||
  mongoose.model<IAbsence>('ProductionAbsence', AbsenceSchema, 'production_absences');

// ─── Attendance ───────────────────────────────────────────────────────────────

export interface IAttendance extends Document {
  staff_id: string;
  store_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  check_in?: Date;
  check_out?: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    staff_id: { type: String, required: true },
    store_id: { type: String, required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ['present', 'absent', 'late'], default: 'absent' },
    check_in: { type: Date },
    check_out: { type: Date },
  },
  { timestamps: true },
);

AttendanceSchema.index({ store_id: 1, date: 1 });

export const Attendance =
  (mongoose.models.ProductionAttendance as mongoose.Model<IAttendance>) ||
  mongoose.model<IAttendance>('ProductionAttendance', AttendanceSchema, 'production_attendance');

// ─── ShiftCoverage ────────────────────────────────────────────────────────────

export interface IShiftCoverage extends Document {
  store_id: string;
  shift: string;
  date: string;
  required: number;
  available: number;
  status: string;
}

const ShiftCoverageSchema = new Schema<IShiftCoverage>(
  {
    store_id: { type: String, required: true },
    shift: { type: String, required: true },
    date: { type: String, required: true },
    required: { type: Number, required: true },
    available: { type: Number, required: true },
    status: { type: String, required: true },
  },
  { timestamps: true },
);

ShiftCoverageSchema.index({ store_id: 1, date: 1 });

export const ShiftCoverage =
  (mongoose.models.ShiftCoverage as mongoose.Model<IShiftCoverage>) ||
  mongoose.model<IShiftCoverage>('ShiftCoverage', ShiftCoverageSchema);

// ─── WeeklyRoster ─────────────────────────────────────────────────────────────

export interface IWeeklyRoster extends Document {
  store_id: string;
  week: number;
  year: number;
  status: 'draft' | 'published';
  assignments: Array<{ staff_id: string; shifts: string[] }>;
}

const WeeklyRosterSchema = new Schema<IWeeklyRoster>(
  {
    store_id: { type: String, required: true },
    week: { type: Number, required: true },
    year: { type: Number, required: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    assignments: [
      {
        staff_id: { type: String, required: true },
        shifts: { type: [String], required: true },
      },
    ],
  },
  { timestamps: true },
);

WeeklyRosterSchema.index({ store_id: 1, week: 1, year: 1 });

export const WeeklyRoster =
  (mongoose.models.WeeklyRoster as mongoose.Model<IWeeklyRoster>) ||
  mongoose.model<IWeeklyRoster>('WeeklyRoster', WeeklyRosterSchema);

// ─── StaffPerformance ─────────────────────────────────────────────────────────

export interface IStaffPerformance extends Document {
  staff_id: string;
  store_id: string;
  period: string;
  orders_handled: number;
  accuracy_rate: number;
  avg_time_per_order: number;
  rating: number;
}

const StaffPerformanceSchema = new Schema<IStaffPerformance>(
  {
    staff_id: { type: String, required: true },
    store_id: { type: String, required: true },
    period: { type: String, required: true },
    orders_handled: { type: Number, required: true, default: 0 },
    accuracy_rate: { type: Number, required: true, default: 0 },
    avg_time_per_order: { type: Number, required: true, default: 0 },
    rating: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

StaffPerformanceSchema.index({ store_id: 1, period: 1 });

export const StaffPerformance =
  (mongoose.models.StaffPerformance as mongoose.Model<IStaffPerformance>) ||
  mongoose.model<IStaffPerformance>('StaffPerformance', StaffPerformanceSchema);

// ─── MaintenanceEquipment ─────────────────────────────────────────────────────

const MaintenanceEquipmentSchema = new Schema(
  {
    store_id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String },
    status: { type: String, default: 'active' },
    location: { type: String },
    lastMaintenance: { type: Date },
    nextMaintenance: { type: Date },
    notes: { type: String },
  },
  { timestamps: true },
);
MaintenanceEquipmentSchema.index({ store_id: 1, status: 1 });
export const MaintenanceEquipment =
  (mongoose.models.MaintenanceEquipment as mongoose.Model<mongoose.Document>) ||
  mongoose.model('MaintenanceEquipment', MaintenanceEquipmentSchema);

// ─── MaintenanceTask ──────────────────────────────────────────────────────────

const MaintenanceTaskSchema = new Schema(
  {
    store_id: { type: String, required: true },
    equipmentId: { type: String },
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, default: 'pending' },
    priority: { type: String, default: 'medium' },
    assignedTo: { type: String },
    dueDate: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true },
);
MaintenanceTaskSchema.index({ store_id: 1, status: 1 });
export const MaintenanceTask =
  (mongoose.models.MaintenanceTask as mongoose.Model<mongoose.Document>) ||
  mongoose.model('MaintenanceTask', MaintenanceTaskSchema);

// ─── IoTDevice ────────────────────────────────────────────────────────────────

const IoTDeviceSchema = new Schema(
  {
    store_id: { type: String, required: true },
    deviceId: { type: String, required: true },
    type: { type: String },
    status: { type: String, default: 'active' },
    lastSeen: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);
IoTDeviceSchema.index({ store_id: 1, deviceId: 1 }, { unique: true });
export const IoTDevice =
  (mongoose.models.IoTDevice as mongoose.Model<mongoose.Document>) ||
  mongoose.model('IoTDevice', IoTDeviceSchema);

// ─── ProductionHSDDevice ──────────────────────────────────────────────────────

const ProductionHSDDeviceSchema = new Schema(
  {
    store_id: { type: String, required: true },
    deviceId: { type: String, required: true },
    assignedTo: { type: String },
    status: { type: String, default: 'available' },
    lastAssigned: { type: Date },
    history: [{ type: Schema.Types.Mixed }],
    actions: [{ type: Schema.Types.Mixed }],
    issues: [{ type: Schema.Types.Mixed }],
    sessions: [{ type: Schema.Types.Mixed }],
  },
  { timestamps: true },
);
ProductionHSDDeviceSchema.index({ store_id: 1, deviceId: 1 });
export const ProductionHSDDevice =
  (mongoose.models.ProductionHSDDevice as mongoose.Model<mongoose.Document>) ||
  mongoose.model('ProductionHSDDevice', ProductionHSDDeviceSchema);

// ─── ProductionIncident ───────────────────────────────────────────────────────

const ProductionIncidentSchema = new Schema(
  {
    store_id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, default: 'open' },
    severity: { type: String, default: 'medium' },
    reportedBy: { type: String },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String },
  },
  { timestamps: true },
);
ProductionIncidentSchema.index({ store_id: 1, status: 1 });
export const ProductionIncident =
  (mongoose.models.ProductionIncident as mongoose.Model<mongoose.Document>) ||
  mongoose.model('ProductionIncident', ProductionIncidentSchema);
