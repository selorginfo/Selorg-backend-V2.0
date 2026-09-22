import mongoose, { Document, Schema } from 'mongoose';

const DEFAULT_WAREHOUSE_KEY =
  (process.env.DASHBOARD_WAREHOUSE_KEY && String(process.env.DASHBOARD_WAREHOUSE_KEY).trim()) ||
  (process.env.DASHBOARD_HUB_KEY && String(process.env.DASHBOARD_HUB_KEY).trim()) ||
  'chennai-hub';

export function normalizeWarehouseKey(warehouseKey?: string | null): string {
  const k =
    warehouseKey && typeof warehouseKey === 'string'
      ? warehouseKey.trim()
      : warehouseKey == null
        ? ''
        : String(warehouseKey).trim();
  return k || DEFAULT_WAREHOUSE_KEY;
}

export function warehouseKeyMatch(warehouseKey?: string | null): Record<string, unknown> {
  const k = normalizeWarehouseKey(warehouseKey);
  if (k === DEFAULT_WAREHOUSE_KEY) {
    return {
      $or: [
        { warehouseKey: DEFAULT_WAREHOUSE_KEY },
        { warehouseKey: { $exists: false } },
        { warehouseKey: null },
      ],
    };
  }
  return { warehouseKey: k };
}

export function mergeWarehouseFilter(
  baseFilter: Record<string, unknown>,
  warehouseKey?: string | null,
): Record<string, unknown> {
  const base =
    baseFilter && typeof baseFilter === 'object' ? { ...baseFilter } : {};
  if (Object.keys(base).length === 0) {
    return warehouseKeyMatch(warehouseKey);
  }
  return { $and: [base, warehouseKeyMatch(warehouseKey)] };
}

export function warehouseFieldsForCreate(warehouseKey?: string | null): { warehouseKey: string } {
  return { warehouseKey: normalizeWarehouseKey(warehouseKey) };
}

// ─── Absence ─────────────────────────────────────────────────────────────────

export interface IAbsence extends Document {
  warehouseKey?: string;
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  reason: string;
  type: 'Planned' | 'Unplanned';
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AbsenceSchema = new Schema<IAbsence>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    staffId: { type: String, required: true, index: true },
    staffName: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['Planned', 'Unplanned'], index: true },
    date: { type: Date, required: true, index: true },
  },
  { timestamps: true, collection: 'warehouse_absences' },
);

AbsenceSchema.index({ staffId: 1, date: 1 });
AbsenceSchema.index({ date: 1, type: 1 });
AbsenceSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const Absence =
  (mongoose.models.Absence as mongoose.Model<IAbsence>) ||
  mongoose.model<IAbsence>('Absence', AbsenceSchema, 'warehouse_absences');

// ─── AccessLog ───────────────────────────────────────────────────────────────

export interface IAccessLog extends Document {
  warehouseKey?: string;
  id: string;
  user: string;
  action: string;
  details?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AccessLogSchema = new Schema<IAccessLog>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    user: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'warehouse_access_logs' },
);

AccessLogSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const AccessLog =
  (mongoose.models.AccessLog as mongoose.Model<IAccessLog>) ||
  mongoose.model<IAccessLog>('AccessLog', AccessLogSchema, 'warehouse_access_logs');

// ─── BatchRejection ───────────────────────────────────────────────────────────

export interface IBatchRejection extends Document {
  warehouseKey?: string;
  id: string;
  batchId: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  itemsCount?: number;
  rejectedBy?: string;
  rejectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BatchRejectionSchema = new Schema<IBatchRejection>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    batchId: { type: String, required: true },
    reason: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    itemsCount: { type: Number },
    rejectedBy: { type: String },
    rejectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'warehouse_batch_rejections' },
);

BatchRejectionSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const BatchRejection =
  (mongoose.models.BatchRejection as mongoose.Model<IBatchRejection>) ||
  mongoose.model<IBatchRejection>('BatchRejection', BatchRejectionSchema, 'warehouse_batch_rejections');

// ─── ComplianceCheck ─────────────────────────────────────────────────────────

export interface IComplianceCheck extends Document {
  warehouseKey?: string;
  id: string;
  name: string;
  category: string;
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ComplianceCheckSchema = new Schema<IComplianceCheck>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, default: 'General' },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    completedBy: { type: String },
  },
  { timestamps: true, collection: 'warehouse_compliance_checks' },
);

ComplianceCheckSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const ComplianceCheck =
  (mongoose.models.WarehouseComplianceCheck as mongoose.Model<IComplianceCheck>) ||
  mongoose.model<IComplianceCheck>('WarehouseComplianceCheck', ComplianceCheckSchema, 'warehouse_compliance_checks');

// ─── ComplianceDoc ───────────────────────────────────────────────────────────

export interface IComplianceDoc extends Document {
  warehouseKey?: string;
  id: string;
  title: string;
  type: string;
  expiryDate?: Date;
  status: 'active' | 'expired' | 'pending';
  fileUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ComplianceDocSchema = new Schema<IComplianceDoc>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    title: { type: String, required: true },
    type: { type: String, required: true },
    expiryDate: { type: Date },
    status: { type: String, enum: ['active', 'expired', 'pending'], default: 'active' },
    fileUrl: { type: String },
  },
  { timestamps: true, collection: 'warehouse_compliance_docs' },
);

ComplianceDocSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const ComplianceDoc =
  (mongoose.models.WarehouseComplianceDoc as mongoose.Model<IComplianceDoc>) ||
  mongoose.model<IComplianceDoc>('WarehouseComplianceDoc', ComplianceDocSchema, 'warehouse_compliance_docs');

// ─── CycleCount ───────────────────────────────────────────────────────────────

export interface ICycleCountItem {
  sku: string;
  productName: string;
  expected: number;
  counted: number;
  discrepancy: number;
  location: string;
}

export interface ICycleCount extends Document {
  warehouseKey?: string;
  id: string;
  countId: string;
  zone: string;
  assignedTo: string;
  scheduledDate: Date;
  status: 'scheduled' | 'in-progress' | 'completed';
  itemsTotal: number;
  itemsCounted: number;
  discrepancies: number;
  items: ICycleCountItem[];
  createdAt: Date;
  updatedAt: Date;
}

const CycleCountItemSchema = new Schema<ICycleCountItem>(
  {
    sku: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    expected: { type: Number, required: true, min: 0 },
    counted: { type: Number, required: true, min: 0 },
    discrepancy: { type: Number, required: true },
    location: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const CycleCountSchema = new Schema<ICycleCount>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    countId: { type: String, required: true, trim: true, index: true },
    zone: { type: String, required: true, trim: true, index: true },
    assignedTo: { type: String, required: true, trim: true, index: true },
    scheduledDate: { type: Date, required: true, index: true },
    status: { type: String, required: true, enum: ['scheduled', 'in-progress', 'completed'], default: 'scheduled', index: true },
    itemsTotal: { type: Number, required: true, min: 0, default: 0 },
    itemsCounted: { type: Number, required: true, min: 0, default: 0 },
    discrepancies: { type: Number, required: true, min: 0, default: 0 },
    items: { type: [CycleCountItemSchema], default: [] },
  },
  { timestamps: true, collection: 'warehouse_cycle_counts' },
);

CycleCountSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });
CycleCountSchema.index({ warehouseKey: 1, countId: 1 }, { unique: true });
CycleCountSchema.index({ zone: 1, status: 1 });
CycleCountSchema.index({ assignedTo: 1, status: 1 });
CycleCountSchema.index({ scheduledDate: 1, status: 1 });

export const CycleCount =
  (mongoose.models.WarehouseCycleCount as mongoose.Model<ICycleCount>) ||
  mongoose.model<ICycleCount>('WarehouseCycleCount', CycleCountSchema, 'warehouse_cycle_counts');

// ─── DockSlot ────────────────────────────────────────────────────────────────

export interface IDockSlot extends Document {
  warehouseKey?: string;
  id: string;
  name: string;
  status: 'active' | 'empty' | 'offline';
  truck?: string;
  vendor?: string;
  eta?: string;
  grnId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DockSlotSchema = new Schema<IDockSlot>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['active', 'empty', 'offline'], default: 'empty' },
    truck: { type: String },
    vendor: { type: String },
    eta: { type: String },
    grnId: { type: String, trim: true, index: true },
  },
  { timestamps: true, collection: 'warehouse_dock_slots' },
);

DockSlotSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const DockSlot =
  (mongoose.models.DockSlot as mongoose.Model<IDockSlot>) ||
  mongoose.model<IDockSlot>('DockSlot', DockSlotSchema, 'warehouse_dock_slots');

// ─── EquipmentIssue ───────────────────────────────────────────────────────────

export interface IEquipmentIssue extends Document {
  warehouseKey?: string;
  id: string;
  equipmentId: string;
  reportedBy: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved';
  reportedAt: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EquipmentIssueSchema = new Schema<IEquipmentIssue>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    equipmentId: { type: String, required: true, index: true },
    reportedBy: { type: String, required: true },
    description: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: { type: String, enum: ['open', 'investigating', 'resolved'], default: 'open' },
    reportedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String },
  },
  { timestamps: true, collection: 'warehouse_equipment_issues' },
);

EquipmentIssueSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const EquipmentIssue =
  (mongoose.models.EquipmentIssue as mongoose.Model<IEquipmentIssue>) ||
  mongoose.model<IEquipmentIssue>('EquipmentIssue', EquipmentIssueSchema, 'warehouse_equipment_issues');

// ─── GRN ─────────────────────────────────────────────────────────────────────

export interface IGRN extends Document {
  warehouseKey?: string;
  id: string;
  poNumber: string;
  vendor: string;
  status: 'pending' | 'in-progress' | 'discrepancy' | 'completed';
  items: number;
  timestamp: Date;
  discrepancyNotes?: string;
  discrepancyType?: string;
  vendorPOId?: mongoose.Types.ObjectId;
  dockId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GRNSchema = new Schema<IGRN>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    poNumber: { type: String, required: true },
    vendor: { type: String, required: true },
    status: { type: String, enum: ['pending', 'in-progress', 'discrepancy', 'completed'], default: 'pending' },
    items: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
    discrepancyNotes: { type: String },
    discrepancyType: { type: String },
    vendorPOId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', index: true },
    dockId: { type: String, trim: true, index: true },
  },
  { timestamps: true, collection: 'warehouse_grns' },
);

GRNSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const GRN =
  (mongoose.models.WarehouseGRN as mongoose.Model<IGRN>) ||
  mongoose.model<IGRN>('WarehouseGRN', GRNSchema, 'warehouse_grns');

// ─── InterWarehouseTransfer ───────────────────────────────────────────────────

export interface IInterWarehouseTransfer extends Document {
  warehouseKey?: string;
  id: string;
  origin: string;
  destination: string;
  status: 'pending' | 'loading' | 'en-route' | 'completed' | 'cancelled';
  items: number;
  vehicleId?: string;
  distance?: string;
  eta?: string;
  progress: number;
  requestedBy?: string;
  requestedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InterWarehouseTransferSchema = new Schema<IInterWarehouseTransfer>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    origin: { type: String, default: 'Current Warehouse' },
    destination: { type: String, required: true },
    status: { type: String, enum: ['pending', 'loading', 'en-route', 'completed', 'cancelled'], default: 'pending' },
    items: { type: Number, required: true },
    vehicleId: { type: String },
    distance: { type: String },
    eta: { type: String },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    requestedBy: { type: String },
    requestedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'warehouse_inter_transfers' },
);

InterWarehouseTransferSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const InterWarehouseTransfer =
  (mongoose.models.InterWarehouseTransfer as mongoose.Model<IInterWarehouseTransfer>) ||
  mongoose.model<IInterWarehouseTransfer>('InterWarehouseTransfer', InterWarehouseTransferSchema, 'warehouse_inter_transfers');

// ─── InternalTransfer ─────────────────────────────────────────────────────────

export interface IInternalTransfer extends Document {
  warehouseKey?: string;
  id: string;
  transferId: string;
  fromLocation: string;
  toLocation: string;
  sku: string;
  productName: string;
  quantity: number;
  status: 'pending' | 'in-transit' | 'completed';
  initiatedBy: string;
  timestamp: Date;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const InternalTransferSchema = new Schema<IInternalTransfer>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    transferId: { type: String, required: true, trim: true, index: true },
    fromLocation: { type: String, required: true, trim: true, index: true },
    toLocation: { type: String, required: true, trim: true, index: true },
    sku: { type: String, required: true, trim: true, index: true },
    productName: { type: String, required: true, maxlength: 200, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, required: true, enum: ['pending', 'in-transit', 'completed'], default: 'pending', index: true },
    initiatedBy: { type: String, required: true, trim: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'warehouse_internal_transfers' },
);

InternalTransferSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });
InternalTransferSchema.index({ warehouseKey: 1, transferId: 1 }, { unique: true });
InternalTransferSchema.index({ status: 1, timestamp: -1 });
InternalTransferSchema.index({ sku: 1, status: 1 });
InternalTransferSchema.index({ fromLocation: 1, toLocation: 1 });

export const InternalTransfer =
  (mongoose.models.WarehouseInternalTransfer as mongoose.Model<IInternalTransfer>) ||
  mongoose.model<IInternalTransfer>('WarehouseInternalTransfer', InternalTransferSchema, 'warehouse_internal_transfers');

// ─── InventoryAdjustment ─────────────────────────────────────────────────────

export type InventoryAdjustmentType =
  | 'Damage Write-off'
  | 'Cycle Count Adj.'
  | 'Expiry Removal'
  | 'Manual Adjustment'
  | 'Found Items'
  | 'Manual Correction';

export interface IInventoryAdjustment extends Document {
  warehouseKey?: string;
  id: string;
  type: InventoryAdjustmentType;
  sku: string;
  productName: string;
  change: number;
  reason: string;
  user: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryAdjustmentSchema = new Schema<IInventoryAdjustment>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['Damage Write-off', 'Cycle Count Adj.', 'Expiry Removal', 'Manual Adjustment', 'Found Items', 'Manual Correction'],
      index: true,
    },
    sku: { type: String, required: true, trim: true, index: true },
    productName: { type: String, required: true, maxlength: 200, trim: true },
    change: { type: Number, required: true },
    reason: { type: String, required: true, maxlength: 500, trim: true },
    user: { type: String, required: true, trim: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'warehouse_inventory_adjustments' },
);

InventoryAdjustmentSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });
InventoryAdjustmentSchema.index({ sku: 1, timestamp: -1 });
InventoryAdjustmentSchema.index({ type: 1, timestamp: -1 });
InventoryAdjustmentSchema.index({ user: 1, timestamp: -1 });

export const InventoryAdjustment =
  (mongoose.models.WarehouseInventoryAdjustment as mongoose.Model<IInventoryAdjustment>) ||
  mongoose.model<IInventoryAdjustment>('WarehouseInventoryAdjustment', InventoryAdjustmentSchema, 'warehouse_inventory_adjustments');

// ─── InventoryItem ───────────────────────────────────────────────────────────

export interface IInventoryItem extends Document {
  warehouseKey?: string;
  id: string;
  sku: string;
  productName: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  location: string;
  value: number;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    sku: { type: String, required: true, trim: true, index: true },
    productName: { type: String, required: true, maxlength: 200, trim: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    currentStock: { type: Number, required: true, min: 0, default: 0 },
    minStock: { type: Number, required: true, min: 0, default: 0 },
    maxStock: { type: Number, required: true, min: 1, default: 1000 },
    location: { type: String, required: true, trim: true, index: true },
    value: { type: Number, required: true, min: 0, default: 0 },
    lastUpdated: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'warehouse_inventory_items' },
);

InventoryItemSchema.pre('save', function (next) {
  if (this.currentStock > this.maxStock) {
    return next(new Error('Current stock cannot exceed max stock'));
  }
  next();
});

InventoryItemSchema.index({ warehouseKey: 1, sku: 1 }, { unique: true });
InventoryItemSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });
InventoryItemSchema.index({ category: 1, currentStock: 1 });
InventoryItemSchema.index({ sku: 'text', productName: 'text' });
InventoryItemSchema.index({ location: 1 });

export const InventoryItem =
  (mongoose.models.WarehouseInventoryItem as mongoose.Model<IInventoryItem>) ||
  mongoose.model<IInventoryItem>('WarehouseInventoryItem', InventoryItemSchema, 'warehouse_inventory_items');

// ─── LeaveRequest ─────────────────────────────────────────────────────────────

export interface ILeaveRequest extends Document {
  warehouseKey?: string;
  id: string;
  staffId: string;
  staffName: string;
  leaveType: 'sick' | 'casual' | 'emergency' | 'vacation';
  startDate: Date;
  endDate: Date;
  days: number;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveRequestSchema = new Schema<ILeaveRequest>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    staffId: { type: String, required: true, index: true },
    staffName: { type: String, required: true },
    leaveType: { type: String, enum: ['sick', 'casual', 'emergency', 'vacation'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reason: { type: String, default: '' },
  },
  { timestamps: true, collection: 'warehouse_leave_requests' },
);

LeaveRequestSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const LeaveRequest =
  (mongoose.models.WarehouseLeaveRequest as mongoose.Model<ILeaveRequest>) ||
  mongoose.model<ILeaveRequest>('WarehouseLeaveRequest', LeaveRequestSchema, 'warehouse_leave_requests');

// ─── WarehouseOrder ───────────────────────────────────────────────────────────

export interface ITimelineEvent {
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'rto' | 'returned' | 'delayed' | 'pending';
  time: Date;
  note?: string | null;
}

export interface IWarehouseOrder extends Document {
  warehouseKey?: string;
  id: string;
  order_id?: string;
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'rto' | 'returned' | 'delayed' | 'pending';
  riderId?: string | null;
  etaMinutes?: number | null;
  slaDeadline: Date;
  pickupLocation: string;
  dropLocation: string;
  zone?: string | null;
  customerName: string;
  items: string[];
  timeline: ITimelineEvent[];
  completedAt?: Date | null;
  deliveryTimeSeconds?: number | null;
  delivery?: { address?: { coordinates?: { lat?: number; lng?: number } } };
  createdAt: Date;
  updatedAt: Date;
}

const TimelineEventSchema = new Schema<ITimelineEvent>(
  {
    status: {
      type: String,
      required: true,
      enum: ['assigned', 'picked_up', 'in_transit', 'delivered', 'rto', 'returned', 'delayed', 'pending'],
    },
    time: { type: Date, required: true, default: Date.now },
    note: { type: String, default: null },
  },
  { _id: false },
);

const WarehouseOrderSchema = new Schema<IWarehouseOrder>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, match: /^ORD-[\d-]+$/, index: true },
    order_id: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['assigned', 'picked_up', 'in_transit', 'delivered', 'rto', 'returned', 'delayed', 'pending'],
      default: 'pending',
      index: true,
    },
    riderId: { type: String, default: null, match: /^(RIDER-\d+|RDR-[A-Z0-9]+-\d{4}-\d+)$/, index: true },
    etaMinutes: { type: Number, default: null, min: 0 },
    slaDeadline: { type: Date, required: true, index: true },
    pickupLocation: { type: String, required: true, maxlength: 500, trim: true },
    dropLocation: { type: String, required: true, maxlength: 500, trim: true },
    zone: { type: String, default: null, trim: true, index: true },
    customerName: { type: String, required: true, maxlength: 100, trim: true, index: true },
    items: {
      type: [String],
      required: true,
      validate: {
        validator: function (v: string[]) { return v && v.length > 0; },
        message: 'Order must have at least one item',
      },
    },
    timeline: { type: [TimelineEventSchema], required: true, default: [] },
    completedAt: { type: Date, default: null },
    deliveryTimeSeconds: { type: Number, default: null, min: 0 },
    delivery: {
      address: {
        coordinates: {
          lat: Number,
          lng: Number,
        },
      },
    },
  },
  { timestamps: true, collection: 'warehouse_orders' },
);

WarehouseOrderSchema.pre('save', function (next) {
  if (this.timeline && this.timeline.length > 0) {
    this.timeline.sort((a, b) => a.time.getTime() - b.time.getTime());
  }
  next();
});

WarehouseOrderSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });
WarehouseOrderSchema.index({ status: 1, slaDeadline: 1 });
WarehouseOrderSchema.index({ riderId: 1, status: 1 });
WarehouseOrderSchema.index({ zone: 1, status: 1 });
WarehouseOrderSchema.index({ customerName: 'text' });
WarehouseOrderSchema.index({ createdAt: -1 });
WarehouseOrderSchema.index({ status: 1, createdAt: -1 });

export const WarehouseOrder =
  (mongoose.models.WarehouseOrder as mongoose.Model<IWarehouseOrder>) ||
  mongoose.model<IWarehouseOrder>('WarehouseOrder', WarehouseOrderSchema, 'warehouse_orders');

// ─── PickingBatch ─────────────────────────────────────────────────────────────

export interface IPickingBatch extends Document {
  warehouseKey?: string;
  id: string;
  status: 'pending' | 'in-progress' | 'completed';
  zone: string;
  pickerId?: string;
  orders: string[];
  itemCount: number;
  startTime?: Date;
  endTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PickingBatchSchema = new Schema<IPickingBatch>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
    zone: { type: String, required: true },
    pickerId: { type: String },
    orders: [{ type: String }],
    itemCount: { type: Number, default: 0 },
    startTime: { type: Date },
    endTime: { type: Date },
  },
  { timestamps: true, collection: 'warehouse_picking_batches' },
);

PickingBatchSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const PickingBatch =
  (mongoose.models.PickingBatch as mongoose.Model<IPickingBatch>) ||
  mongoose.model<IPickingBatch>('PickingBatch', PickingBatchSchema, 'warehouse_picking_batches');

// ─── Picklist ─────────────────────────────────────────────────────────────────

export interface IPicklist extends Document {
  warehouseKey?: string;
  id: string;
  orderId: string;
  customer: string;
  items: number;
  priority: 'high' | 'medium' | 'low';
  status: 'queued' | 'assigned' | 'picking' | 'completed';
  picker?: string;
  pickerId?: string;
  zone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PicklistSchema = new Schema<IPicklist>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    orderId: { type: String, required: true },
    customer: { type: String, required: true },
    items: { type: Number, required: true },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    status: { type: String, enum: ['queued', 'assigned', 'picking', 'completed'], default: 'queued' },
    picker: { type: String },
    pickerId: { type: String, index: true },
    zone: { type: String },
  },
  { timestamps: true, collection: 'warehouse_picklists' },
);

PicklistSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const Picklist =
  (mongoose.models.WarehousePicklist as mongoose.Model<IPicklist>) ||
  mongoose.model<IPicklist>('WarehousePicklist', PicklistSchema, 'warehouse_picklists');

// ─── QCInspection ────────────────────────────────────────────────────────────

export interface IQCInspection extends Document {
  warehouseKey?: string;
  id: string;
  inspectionId: string;
  batchId: string;
  productName: string;
  inspector: string;
  date: Date;
  status: 'pending' | 'passed' | 'failed';
  score?: number;
  itemsInspected?: number;
  defectsFound?: number;
  createdAt: Date;
  updatedAt: Date;
}

const QCInspectionSchema = new Schema<IQCInspection>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    inspectionId: { type: String, required: true },
    batchId: { type: String, required: true },
    productName: { type: String, required: true },
    inspector: { type: String, required: true },
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'passed', 'failed'], default: 'pending' },
    score: { type: Number, min: 0, max: 100 },
    itemsInspected: { type: Number },
    defectsFound: { type: Number },
  },
  { timestamps: true, collection: 'warehouse_qc_inspections' },
);

QCInspectionSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const QCInspection =
  (mongoose.models.WarehouseQCInspection as mongoose.Model<IQCInspection>) ||
  mongoose.model<IQCInspection>('WarehouseQCInspection', QCInspectionSchema, 'warehouse_qc_inspections');

// ─── ReorderRequest ───────────────────────────────────────────────────────────

export interface IReorderRequest extends Document {
  warehouseKey?: string;
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  priority: 'high' | 'medium' | 'low';
  notes: string;
  status: 'pending' | 'ordered' | 'fulfilled' | 'cancelled';
  alertId?: string | null;
  requestedBy: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReorderRequestSchema = new Schema<IReorderRequest>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    sku: { type: String, required: true, trim: true, index: true },
    productName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    priority: { type: String, required: true, enum: ['high', 'medium', 'low'], default: 'medium' },
    notes: { type: String, default: '', trim: true, maxlength: 500 },
    status: { type: String, required: true, enum: ['pending', 'ordered', 'fulfilled', 'cancelled'], default: 'pending', index: true },
    alertId: { type: String, default: null, trim: true },
    requestedBy: { type: String, default: 'System', trim: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'warehouse_reorder_requests' },
);

ReorderRequestSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const ReorderRequest =
  (mongoose.models.WarehouseReorderRequest as mongoose.Model<IReorderRequest>) ||
  mongoose.model<IReorderRequest>('WarehouseReorderRequest', ReorderRequestSchema, 'warehouse_reorder_requests');

// ─── SampleTest ───────────────────────────────────────────────────────────────

export interface ISampleTest extends Document {
  warehouseKey?: string;
  id: string;
  sampleId: string;
  productName: string;
  batchId?: string;
  testType?: string;
  result: 'pass' | 'fail' | 'pending';
  tester?: string;
  testDate: Date;
  reportUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SampleTestSchema = new Schema<ISampleTest>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    sampleId: { type: String, required: true },
    productName: { type: String, required: true },
    batchId: { type: String },
    testType: { type: String },
    result: { type: String, enum: ['pass', 'fail', 'pending'], default: 'pending' },
    tester: { type: String },
    testDate: { type: Date, default: Date.now },
    reportUrl: { type: String },
  },
  { timestamps: true, collection: 'warehouse_sample_tests' },
);

SampleTestSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const SampleTest =
  (mongoose.models.WarehouseSampleTest as mongoose.Model<ISampleTest>) ||
  mongoose.model<ISampleTest>('WarehouseSampleTest', SampleTestSchema, 'warehouse_sample_tests');

// ─── Shift ───────────────────────────────────────────────────────────────────

export interface IShift extends Document {
  warehouseKey?: string;
  id: string;
  staffId: string;
  staffName: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'active' | 'completed' | 'absent' | 'late';
  checkInTime?: string | null;
  checkOutTime?: string | null;
  hub: string;
  isPeakHour: boolean;
  overtimeMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftSchema = new Schema<IShift>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    staffId: { type: String, required: true, index: true },
    staffName: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: { type: String, required: true, enum: ['scheduled', 'active', 'completed', 'absent', 'late'], default: 'scheduled', index: true },
    checkInTime: { type: String, default: null },
    checkOutTime: { type: String, default: null },
    hub: { type: String, required: true, trim: true },
    isPeakHour: { type: Boolean, default: false },
    overtimeMinutes: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'warehouse_shifts' },
);

ShiftSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });
ShiftSchema.index({ staffId: 1, date: 1 });
ShiftSchema.index({ date: 1, status: 1 });
ShiftSchema.index({ hub: 1, date: 1 });

export const Shift =
  (mongoose.models.WarehouseShift as mongoose.Model<IShift>) ||
  mongoose.model<IShift>('WarehouseShift', ShiftSchema, 'warehouse_shifts');

// ─── Staff ───────────────────────────────────────────────────────────────────

export interface IStaff extends Document {
  warehouseKey?: string;
  id: string;
  name: string;
  role: 'Picker' | 'Packer' | 'Loader' | 'Rider' | 'Supervisor' | 'Forklift Operator' | 'QC Inspector' | 'Warehouse Manager';
  zone?: string | null;
  status: 'Active' | 'Break' | 'Meeting' | 'Offline';
  currentShift?: string | null;
  currentTask?: string | null;
  storeId?: mongoose.Types.ObjectId | null;
  storeName?: string | null;
  phone?: string | null;
  email?: string | null;
  shift?: 'morning' | 'afternoon' | 'evening' | 'night' | 'full_day' | null;
  joinedAt?: Date | null;
  joinDate?: string | null;
  performance?: number | null;
  productivity?: number | null;
  hourlyRate?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const StaffSchema = new Schema<IStaff>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      required: true,
      enum: ['Picker', 'Packer', 'Loader', 'Rider', 'Supervisor', 'Forklift Operator', 'QC Inspector', 'Warehouse Manager'],
      index: true,
    },
    zone: { type: String, default: null, trim: true },
    status: { type: String, required: true, enum: ['Active', 'Break', 'Meeting', 'Offline'], default: 'Offline', index: true },
    currentShift: { type: String, default: null },
    currentTask: { type: String, default: null, trim: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', default: null },
    storeName: { type: String, default: null, trim: true },
    phone: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true },
    shift: { type: String, enum: ['morning', 'afternoon', 'evening', 'night', 'full_day'], default: null },
    joinedAt: { type: Date, default: null },
    joinDate: { type: String, default: null },
    performance: { type: Number, default: null },
    productivity: { type: Number, default: null },
    hourlyRate: { type: Number, default: null },
  },
  { timestamps: true, collection: 'warehouse_staff' },
);

StaffSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });
StaffSchema.index({ role: 1, status: 1 });
StaffSchema.index({ zone: 1 });
StaffSchema.index({ storeId: 1 });

export const Staff =
  (mongoose.models.WarehouseStaff as mongoose.Model<IStaff>) ||
  mongoose.model<IStaff>('WarehouseStaff', StaffSchema, 'warehouse_staff');

// ─── StockAlert ───────────────────────────────────────────────────────────────

export interface IStockAlert extends Document {
  warehouseKey?: string;
  id: string;
  type: 'low-stock' | 'overstock' | 'expiring' | 'out-of-stock';
  sku: string;
  productName: string;
  currentLevel: number;
  threshold: number;
  priority: 'high' | 'medium' | 'low';
  location?: string | null;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StockAlertSchema = new Schema<IStockAlert>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ['low-stock', 'overstock', 'expiring', 'out-of-stock'], index: true },
    sku: { type: String, required: true, trim: true, index: true },
    productName: { type: String, required: true, maxlength: 200, trim: true },
    currentLevel: { type: Number, required: true, min: 0 },
    threshold: { type: Number, required: true, min: 0 },
    priority: { type: String, required: true, enum: ['high', 'medium', 'low'], default: 'medium', index: true },
    location: { type: String, default: null, trim: true },
    lastUpdated: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'warehouse_stock_alerts' },
);

StockAlertSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });
StockAlertSchema.index({ type: 1, priority: 1 });
StockAlertSchema.index({ sku: 1, type: 1 });
StockAlertSchema.index({ priority: 1, lastUpdated: -1 });

export const StockAlert =
  (mongoose.models.WarehouseStockAlert as mongoose.Model<IStockAlert>) ||
  mongoose.model<IStockAlert>('WarehouseStockAlert', StockAlertSchema, 'warehouse_stock_alerts');

// ─── StorageLocation ─────────────────────────────────────────────────────────

export interface IStorageLocation extends Document {
  warehouseKey?: string;
  id: string;
  aisle: string;
  rack: number;
  shelf: number;
  status: 'occupied' | 'empty' | 'restricted';
  sku?: string | null;
  quantity?: number | null;
  zone?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const StorageLocationSchema = new Schema<IStorageLocation>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    aisle: { type: String, required: true, trim: true, index: true },
    rack: { type: Number, required: true, min: 1 },
    shelf: { type: Number, required: true, min: 1 },
    status: { type: String, required: true, enum: ['occupied', 'empty', 'restricted'], default: 'empty', index: true },
    sku: { type: String, default: null, trim: true, index: true },
    quantity: { type: Number, default: null, min: 0 },
    zone: { type: String, default: null, trim: true, index: true },
  },
  { timestamps: true, collection: 'warehouse_storage_locations' },
);

StorageLocationSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });
StorageLocationSchema.index({ warehouseKey: 1, aisle: 1, rack: 1, shelf: 1 }, { unique: true });
StorageLocationSchema.index({ status: 1, zone: 1 });
StorageLocationSchema.index({ sku: 1 });

export const StorageLocation =
  (mongoose.models.WarehouseStorageLocation as mongoose.Model<IStorageLocation>) ||
  mongoose.model<IStorageLocation>('WarehouseStorageLocation', StorageLocationSchema, 'warehouse_storage_locations');

// ─── TemperatureLog ───────────────────────────────────────────────────────────

export interface ITemperatureLog extends Document {
  warehouseKey?: string;
  id: string;
  zone: string;
  temperature: number;
  humidity: number;
  status: 'normal' | 'warning' | 'critical';
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TemperatureLogSchema = new Schema<ITemperatureLog>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    zone: { type: String, required: true },
    temperature: { type: Number, required: true },
    humidity: { type: Number, required: true },
    status: { type: String, enum: ['normal', 'warning', 'critical'], default: 'normal' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'warehouse_temperature_logs' },
);

TemperatureLogSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const TemperatureLog =
  (mongoose.models.WarehouseTemperatureLog as mongoose.Model<ITemperatureLog>) ||
  mongoose.model<ITemperatureLog>('WarehouseTemperatureLog', TemperatureLogSchema, 'warehouse_temperature_logs');

// ─── WarehouseAttendance ──────────────────────────────────────────────────────

export interface IWarehouseAttendance extends Document {
  warehouseKey?: string;
  id: string;
  staffId: string;
  status: 'check-in' | 'check-out';
  timestamp: Date;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseAttendanceSchema = new Schema<IWarehouseAttendance>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    staffId: { type: String, required: true, index: true },
    status: { type: String, enum: ['check-in', 'check-out'], required: true },
    timestamp: { type: Date, default: Date.now },
    location: { type: String, default: 'Main Gate' },
  },
  { timestamps: true, collection: 'warehouse_attendance' },
);

WarehouseAttendanceSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const WarehouseAttendance =
  (mongoose.models.WarehouseAttendance as mongoose.Model<IWarehouseAttendance>) ||
  mongoose.model<IWarehouseAttendance>('WarehouseAttendance', WarehouseAttendanceSchema, 'warehouse_attendance');

// ─── WarehouseEquipment ───────────────────────────────────────────────────────

export interface IWarehouseEquipment extends Document {
  warehouseKey?: string;
  id: string;
  name: string;
  type: 'forklift' | 'hsd-device' | 'pallet-jack' | 'crane' | 'conveyor' | 'other';
  serialNumber?: string;
  status: 'active' | 'maintenance' | 'offline' | 'broken' | 'idle';
  lastMaintenance?: Date;
  nextMaintenance?: Date;
  assignedTo?: string;
  operator?: string;
  zone?: string;
  issue?: string;
  batteryLevel?: number;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseEquipmentSchema = new Schema<IWarehouseEquipment>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['forklift', 'hsd-device', 'pallet-jack', 'crane', 'conveyor', 'other'], default: 'forklift' },
    serialNumber: { type: String },
    status: { type: String, enum: ['active', 'maintenance', 'offline', 'broken', 'idle'], default: 'active' },
    lastMaintenance: { type: Date },
    nextMaintenance: { type: Date },
    assignedTo: { type: String },
    operator: { type: String },
    zone: { type: String },
    issue: { type: String },
    batteryLevel: { type: Number, min: 0, max: 100 },
    location: { type: String },
  },
  { timestamps: true, collection: 'warehouse_equipment' },
);

WarehouseEquipmentSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });
WarehouseEquipmentSchema.index({ warehouseKey: 1, serialNumber: 1 }, { unique: true, sparse: true });

export const WarehouseEquipment =
  (mongoose.models.WarehouseEquipment as mongoose.Model<IWarehouseEquipment>) ||
  mongoose.model<IWarehouseEquipment>('WarehouseEquipment', WarehouseEquipmentSchema, 'warehouse_equipment');

// ─── WarehouseException ───────────────────────────────────────────────────────

export interface IWarehouseException extends Document {
  warehouseKey?: string;
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'inbound' | 'outbound' | 'inventory' | 'technical' | 'qc' | 'other';
  title: string;
  description: string;
  relatedId?: string;
  relatedType?: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  reportedBy: string;
  reportedAt: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseExceptionSchema = new Schema<IWarehouseException>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    category: { type: String, enum: ['inbound', 'outbound', 'inventory', 'technical', 'qc', 'other'], required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    relatedId: { type: String },
    relatedType: { type: String },
    status: { type: String, enum: ['open', 'investigating', 'resolved', 'closed'], default: 'open' },
    reportedBy: { type: String, required: true },
    reportedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String },
  },
  { timestamps: true, collection: 'warehouse_exceptions' },
);

WarehouseExceptionSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const WarehouseException =
  (mongoose.models.WarehouseException as mongoose.Model<IWarehouseException>) ||
  mongoose.model<IWarehouseException>('WarehouseException', WarehouseExceptionSchema, 'warehouse_exceptions');

// ─── WarehouseNotification ───────────────────────────────────────────────────

export interface IWarehouseNotification extends Document {
  warehouseKey?: string;
  title: string;
  body: string;
  category: 'inbound' | 'inventory' | 'outbound' | 'qc' | 'workforce' | 'equipment' | 'exception' | 'system';
  channel: 'in-app';
  refType?: string;
  refId?: string;
  readByUserIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseNotificationSchema = new Schema<IWarehouseNotification>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    category: {
      type: String,
      enum: ['inbound', 'inventory', 'outbound', 'qc', 'workforce', 'equipment', 'exception', 'system'],
      default: 'system',
    },
    channel: { type: String, enum: ['in-app'], default: 'in-app' },
    refType: { type: String },
    refId: { type: String },
    readByUserIds: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'warehouse_notifications' },
);

WarehouseNotificationSchema.index({ warehouseKey: 1, createdAt: -1 });

export const WarehouseNotification =
  (mongoose.models.WarehouseNotification as mongoose.Model<IWarehouseNotification>) ||
  mongoose.model<IWarehouseNotification>('WarehouseNotification', WarehouseNotificationSchema, 'warehouse_notifications');

// ─── WarehouseReport ─────────────────────────────────────────────────────────

export interface IWarehouseReport extends Document {
  warehouseKey?: string;
  id: string;
  date: Date;
  metrics: {
    inboundQueue: number;
    outboundQueue: number;
    inventoryHealth: number;
    criticalAlerts: number;
  };
  capacityUtilization: {
    storageBins: number;
    palletZones: number;
    coldStorage: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseReportSchema = new Schema<IWarehouseReport>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    date: { type: Date, required: true },
    metrics: {
      inboundQueue: { type: Number, default: 0 },
      outboundQueue: { type: Number, default: 0 },
      inventoryHealth: { type: Number, default: 100 },
      criticalAlerts: { type: Number, default: 0 },
    },
    capacityUtilization: {
      storageBins: { type: Number, default: 0 },
      palletZones: { type: Number, default: 0 },
      coldStorage: { type: Number, default: 0 },
    },
  },
  { timestamps: true, collection: 'warehouse_daily_reports' },
);

WarehouseReportSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const WarehouseReport =
  (mongoose.models.WarehouseReport as mongoose.Model<IWarehouseReport>) ||
  mongoose.model<IWarehouseReport>('WarehouseReport', WarehouseReportSchema, 'warehouse_daily_reports');

// ─── WarehouseShiftSlot ───────────────────────────────────────────────────────

export interface IWarehouseShiftSlot extends Document {
  warehouseKey?: string;
  id: string;
  date: Date;
  shift: 'morning' | 'afternoon' | 'night';
  requiredStaff: number;
  assignedStaff: string[];
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseShiftSlotSchema = new Schema<IWarehouseShiftSlot>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    shift: { type: String, enum: ['morning', 'afternoon', 'night'], default: 'morning' },
    requiredStaff: { type: Number, default: 4 },
    assignedStaff: [{ type: String }],
  },
  { timestamps: true, collection: 'warehouse_shift_slots' },
);

WarehouseShiftSlotSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });
WarehouseShiftSlotSchema.index({ date: 1, shift: 1 });

export const WarehouseShiftSlot =
  (mongoose.models.WarehouseShiftSlot as mongoose.Model<IWarehouseShiftSlot>) ||
  mongoose.model<IWarehouseShiftSlot>('WarehouseShiftSlot', WarehouseShiftSlotSchema, 'warehouse_shift_slots');

// ─── WarehouseTraining ────────────────────────────────────────────────────────

export interface IWarehouseTraining extends Document {
  warehouseKey?: string;
  id: string;
  trainingId: string;
  title: string;
  type: 'Safety' | 'Equipment' | 'Process' | 'Compliance' | 'Mandatory' | 'Quality' | 'Technical' | 'Operational' | 'Leadership';
  date: Date;
  duration?: string;
  instructor?: string;
  enrolled: number;
  capacity: number;
  status: 'upcoming' | 'ongoing' | 'completed';
  description?: string;
  enrolledStaff: string[];
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseTrainingSchema = new Schema<IWarehouseTraining>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    id: { type: String, required: true, index: true },
    trainingId: { type: String, required: true },
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ['Safety', 'Equipment', 'Process', 'Compliance', 'Mandatory', 'Quality', 'Technical', 'Operational', 'Leadership'],
      default: 'Process',
    },
    date: { type: Date, required: true },
    duration: { type: String },
    instructor: { type: String },
    enrolled: { type: Number, default: 0 },
    capacity: { type: Number, default: 20 },
    status: { type: String, enum: ['upcoming', 'ongoing', 'completed'], default: 'upcoming' },
    description: { type: String },
    enrolledStaff: [{ type: String }],
  },
  { timestamps: true, collection: 'warehouse_trainings' },
);

WarehouseTrainingSchema.index({ warehouseKey: 1, id: 1 }, { unique: true });

export const WarehouseTraining =
  (mongoose.models.WarehouseTraining as mongoose.Model<IWarehouseTraining>) ||
  mongoose.model<IWarehouseTraining>('WarehouseTraining', WarehouseTrainingSchema, 'warehouse_trainings');

// ─── Warehouse Staff Mapping ──────────────────────────────────────────────────

export interface IWarehouseStaffMapping extends Document {
  warehouseId: mongoose.Types.ObjectId;
  userId: string;
  role: 'manager' | 'picker' | 'delivery_boy';
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseStaffMappingSchema = new Schema<IWarehouseStaffMapping>(
  {
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    userId: { type: String, required: true, trim: true, index: true },
    role: { type: String, required: true, enum: ['manager', 'picker', 'delivery_boy'], index: true },
    status: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, collection: 'warehouse_staff_mappings' },
);

WarehouseStaffMappingSchema.index({ warehouseId: 1, userId: 1 }, { unique: true });

export const WarehouseStaffMapping =
  (mongoose.models.WarehouseStaffMapping as mongoose.Model<IWarehouseStaffMapping>) ||
  mongoose.model<IWarehouseStaffMapping>('WarehouseStaffMapping', WarehouseStaffMappingSchema, 'warehouse_staff_mappings');

// ─── Warehouse Location (schema-driven) ──────────────────────────────────────

export interface IWarehouseLocation extends Document {
  name: string;
  code: string;
  type: 'warehouse' | 'dark_store';
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  service_radius_km: number;
  status: boolean;
  open_time: string;
  close_time: string;
  max_orders_per_day: number;
  max_orders_per_hour: number;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseLocationSchema = new Schema<IWarehouseLocation>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    code: { type: String, required: true, trim: true, maxlength: 50, unique: true, uppercase: true },
    type: { type: String, required: true, enum: ['warehouse', 'dark_store'], default: 'warehouse', index: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    pincode: { type: String, required: true, trim: true, maxlength: 20 },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    service_radius_km: { type: Number, required: true, default: 5, min: 1 },
    status: { type: Boolean, required: true, default: true, index: true },
    open_time: { type: String, required: true, default: '09:00' },
    close_time: { type: String, required: true, default: '21:00' },
    max_orders_per_day: { type: Number, required: true, default: 500, min: 1 },
    max_orders_per_hour: { type: Number, required: true, default: 50, min: 1 },
  },
  { timestamps: true, collection: 'warehouse_locations' },
);

WarehouseLocationSchema.index({ city: 1, status: 1 });
WarehouseLocationSchema.index({ latitude: 1, longitude: 1 });

export const WarehouseLocation =
  (mongoose.models.WarehouseLocation as mongoose.Model<IWarehouseLocation>) ||
  mongoose.model<IWarehouseLocation>('WarehouseLocation', WarehouseLocationSchema, 'warehouse_locations');

// ─── WD (Warehouse → Darkstore) Transfer Request ─────────────────────────────

export interface IWDTransferItem {
  product_id: mongoose.Types.ObjectId;
  product_name: string;
  sku: string;
  requested_qty: number;
  approved_qty: number;
  packed_qty: number;
  received_qty: number;
}

export interface IWDTransferRequest extends Document {
  transfer_id: string;
  warehouse_id: mongoose.Types.ObjectId;
  dark_store_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'packed' | 'dispatched' | 'completed';
  items: IWDTransferItem[];
  requested_by: string;
  accepted_by?: string;
  dispatch_date?: Date;
  driver_name?: string;
  driver_phone?: string;
  vehicle_no?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const wdTransferItemSchema = new Schema<IWDTransferItem>(
  {
    product_id: { type: Schema.Types.ObjectId, ref: 'CustomerProduct' },
    product_name: { type: String, default: '' },
    sku: { type: String, default: '' },
    requested_qty: { type: Number, default: 0, min: 0 },
    approved_qty: { type: Number, default: 0, min: 0 },
    packed_qty: { type: Number, default: 0, min: 0 },
    received_qty: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const wdTransferRequestSchema = new Schema<IWDTransferRequest>(
  {
    transfer_id: { type: String, required: true, unique: true, index: true },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation', required: true },
    dark_store_id: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'packed', 'dispatched', 'completed'],
      default: 'pending',
      index: true,
    },
    items: { type: [wdTransferItemSchema], default: [] },
    requested_by: { type: String, default: '' },
    accepted_by: { type: String },
    dispatch_date: { type: Date },
    driver_name: { type: String },
    driver_phone: { type: String },
    vehicle_no: { type: String },
    notes: { type: String },
  },
  { timestamps: true, collection: 'wd_transfer_requests' },
);

wdTransferRequestSchema.index({ warehouse_id: 1, status: 1 });
wdTransferRequestSchema.index({ dark_store_id: 1, status: 1 });

export const WDTransferRequest =
  (mongoose.models.WDTransferRequest as mongoose.Model<IWDTransferRequest>) ||
  mongoose.model<IWDTransferRequest>('WDTransferRequest', wdTransferRequestSchema, 'wd_transfer_requests');

// ─── WD Transfer Action Log ───────────────────────────────────────────────────

export interface IWDTransferLog extends Document {
  transfer_id: string;
  action: 'created' | 'accepted' | 'rejected' | 'packed' | 'dispatched' | 'received' | 'completed';
  performed_by: string;
  note?: string;
  snapshot?: Record<string, unknown>;
  createdAt: Date;
}

const wdTransferLogSchema = new Schema<IWDTransferLog>(
  {
    transfer_id: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: ['created', 'accepted', 'rejected', 'packed', 'dispatched', 'received', 'completed'],
      required: true,
    },
    performed_by: { type: String, default: 'system' },
    note: { type: String },
    snapshot: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'wd_transfer_logs' },
);

export const WDTransferLog =
  (mongoose.models.WDTransferLog as mongoose.Model<IWDTransferLog>) ||
  mongoose.model<IWDTransferLog>('WDTransferLog', wdTransferLogSchema, 'wd_transfer_logs');
