import mongoose, { Schema, Document } from 'mongoose';

// ─── Rider Operational ───────────────────────────────────────────────────────

export interface ILocation {
  lat: number;
  lng: number;
}

export interface ICapacity {
  currentLoad: number;
  maxLoad: number;
}

export interface IRider extends Document {
  id: string;
  name: string;
  avatarInitials: string;
  status: 'online' | 'offline' | 'busy' | 'idle';
  currentOrderId: string | null;
  location: ILocation | null;
  capacity: ICapacity;
  avgEtaMins: number;
  rating: number;
  zone: string | null;
  homeStoreId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>({ lat: { type: Number, required: true, min: -90, max: 90 }, lng: { type: Number, required: true, min: -180, max: 180 } }, { _id: false });
const CapacitySchema = new Schema<ICapacity>({ currentLoad: { type: Number, required: true, min: 0, default: 0 }, maxLoad: { type: Number, required: true, min: 1, default: 5 } }, { _id: false });

const RiderSchema = new Schema<IRider>(
  {
    id: { type: String, required: true, unique: true, match: /^(RIDER-\d+|RDR-[A-Z0-9]+-\d{4}-\d+)$/, index: true },
    name: { type: String, required: true, maxlength: 100, trim: true },
    avatarInitials: { type: String, required: true, minlength: 1, maxlength: 3, uppercase: true },
    status: { type: String, required: true, enum: ['online', 'offline', 'busy', 'idle'], default: 'offline', index: true },
    currentOrderId: { type: String, default: null },
    location: { type: LocationSchema, default: null },
    capacity: { type: CapacitySchema, required: true },
    avgEtaMins: { type: Number, required: true, min: 0, default: 0 },
    rating: { type: Number, required: true, min: 0, max: 5, default: 0 },
    zone: { type: String, default: null, index: true },
    homeStoreId: { type: Schema.Types.ObjectId, ref: 'DarkStore', default: null, index: true },
  },
  { timestamps: true, collection: 'riders', id: false },
);

RiderSchema.pre('save', function (next) {
  if (this.capacity.currentLoad > this.capacity.maxLoad) return next(new Error('Current load cannot exceed max load'));
  next();
});
RiderSchema.index({ status: 1, zone: 1 });

export const Rider = mongoose.models.RiderOperational || mongoose.model<IRider>('RiderOperational', RiderSchema);

// ─── Rider HR ─────────────────────────────────────────────────────────────────

export interface IRiderHR extends Document {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended' | 'onboarding';
  onboardingStatus: 'invited' | 'pending_docs' | 'under_review' | 'approved' | 'rejected';
  trainingStatus: 'not_started' | 'in_progress' | 'completed';
  appAccess: 'enabled' | 'disabled';
  deviceAssigned: boolean;
  contract: { startDate: Date; endDate: Date; renewalDue: boolean };
  compliance: { isCompliant: boolean; lastAuditDate: Date; policyViolationsCount: number; lastViolationReason?: string };
  suspension: { isSuspended: boolean; reason?: string; since?: Date };
  createdAt: Date;
  updatedAt: Date;
}

const RiderHRSchema = new Schema<IRiderHR>(
  {
    id: { type: String, required: true, unique: true, match: /^(RIDER-\d+|RDR-[A-Z0-9]+-\d{4}-\d+)$/, index: true },
    name: { type: String, required: true, maxlength: 100, trim: true },
    phone: { type: String, required: true, match: /^\+[1-9]\d{1,14}$/ },
    email: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, required: true, enum: ['active', 'inactive', 'suspended', 'onboarding'], default: 'onboarding', index: true },
    onboardingStatus: { type: String, required: true, enum: ['invited', 'pending_docs', 'under_review', 'approved', 'rejected'], default: 'invited', index: true },
    trainingStatus: { type: String, required: true, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
    appAccess: { type: String, required: true, enum: ['enabled', 'disabled'], default: 'disabled' },
    deviceAssigned: { type: Boolean, required: true, default: false },
    contract: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      renewalDue: { type: Boolean, required: true, default: false },
    },
    compliance: {
      isCompliant: { type: Boolean, required: true, default: true },
      lastAuditDate: { type: Date, required: true },
      policyViolationsCount: { type: Number, required: true, min: 0, default: 0 },
      lastViolationReason: { type: String, default: null },
    },
    suspension: {
      isSuspended: { type: Boolean, required: true, default: false },
      reason: { type: String, default: null },
      since: { type: Date, default: null },
    },
  },
  { timestamps: true, collection: 'rider_hr' },
);

export const RiderHR = mongoose.models.RiderHR || mongoose.model<IRiderHR>('RiderHR', RiderHRSchema);

// ─── Rider Shift ──────────────────────────────────────────────────────────────

export interface IRiderShift extends Document {
  id: string;
  hubId?: string;
  hubName?: string;
  date: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
  status: 'draft' | 'published' | 'cancelled';
  isPeak: boolean;
  basePay: number;
  bonus: number;
  currency: string;
  breakMinutes: number;
  walkInBufferMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const RiderShiftSchema = new Schema<IRiderShift>(
  {
    id: { type: String, required: true, unique: true, index: true },
    hubId: { type: String, index: true },
    hubName: { type: String },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    capacity: { type: Number, required: true, min: 1 },
    bookedCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['draft', 'published', 'cancelled'], default: 'draft', index: true },
    isPeak: { type: Boolean, default: false },
    basePay: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    breakMinutes: { type: Number, default: 0, min: 0 },
    walkInBufferMinutes: { type: Number, default: 15, min: 0 },
  },
  { timestamps: true, collection: 'rider_shifts' },
);
RiderShiftSchema.index({ hubId: 1, date: 1 });
RiderShiftSchema.index({ date: 1, status: 1 });

export const RiderShift = mongoose.models.RiderShift || mongoose.model<IRiderShift>('RiderShift', RiderShiftSchema);

// ─── Rider Shift Assignment ───────────────────────────────────────────────────

export interface IRiderShiftAssignment extends Document {
  shiftId: mongoose.Types.ObjectId;
  riderId: string;
  date: Date;
  status: 'selected' | 'started' | 'completed' | 'cancelled';
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RiderShiftAssignmentSchema = new Schema<IRiderShiftAssignment>(
  {
    shiftId: { type: Schema.Types.ObjectId, ref: 'RiderShift', required: true, index: true },
    riderId: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    status: { type: String, enum: ['selected', 'started', 'completed', 'cancelled'], default: 'selected', index: true },
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: true, collection: 'rider_shift_assignments' },
);
RiderShiftAssignmentSchema.index({ riderId: 1, date: 1, status: 1 });

export const RiderShiftAssignment = mongoose.models.RiderShiftAssignment || mongoose.model<IRiderShiftAssignment>('RiderShiftAssignment', RiderShiftAssignmentSchema);

// ─── Compliance ───────────────────────────────────────────────────────────────

export interface ICompliance extends Document {
  riderId: string;
  riderName: string;
  isCompliant: boolean;
  lastAuditDate: Date;
  policyViolationsCount: number;
  lastViolationReason?: string;
  suspension: { isSuspended: boolean; reason?: string; since?: Date; durationDays?: number; expiresAt?: Date };
  violations: Array<{ id: string; violationType: string; description: string; occurredAt: Date; severity: 'low' | 'medium' | 'high' }>;
  createdAt: Date;
  updatedAt: Date;
}

const ComplianceSchema = new Schema<ICompliance>(
  {
    riderId: { type: String, required: true, unique: true, match: /^(RIDER-\d+|RDR-[A-Z0-9]+-\d{4}-\d+)$/, index: true },
    riderName: { type: String, required: true },
    isCompliant: { type: Boolean, required: true, default: true, index: true },
    lastAuditDate: { type: Date, required: true },
    policyViolationsCount: { type: Number, required: true, min: 0, default: 0 },
    lastViolationReason: { type: String, default: null },
    suspension: {
      isSuspended: { type: Boolean, required: true, default: false },
      reason: { type: String, default: null },
      since: { type: Date, default: null },
      durationDays: { type: Number, default: null, min: 1 },
      expiresAt: { type: Date, default: null },
    },
    violations: [
      {
        id: { type: String, required: true },
        violationType: { type: String, required: true },
        description: { type: String, required: true },
        occurredAt: { type: Date, required: true },
        severity: { type: String, required: true, enum: ['low', 'medium', 'high'] },
        _id: false,
      },
    ],
  },
  { timestamps: true, collection: 'compliance' },
);
ComplianceSchema.index({ 'suspension.isSuspended': 1 });
ComplianceSchema.index({ lastAuditDate: -1 });

export const Compliance = mongoose.models.Compliance || mongoose.model<ICompliance>('Compliance', ComplianceSchema);

// ─── Contract ─────────────────────────────────────────────────────────────────

export interface IContract extends Document {
  riderId: string;
  riderName: string;
  startDate: Date;
  endDate: Date;
  renewalDue: boolean;
  status: 'active' | 'expired' | 'pending_renewal' | 'terminated';
  contractType?: string;
  terms?: Record<string, unknown>;
  terminationReason?: string;
  terminatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ContractSchema = new Schema<IContract>(
  {
    riderId: { type: String, required: true, unique: true, index: true },
    riderName: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    renewalDue: { type: Boolean, required: true, default: false, index: true },
    status: { type: String, required: true, enum: ['active', 'expired', 'pending_renewal', 'terminated'], default: 'active', index: true },
    contractType: { type: String, default: null },
    terms: { type: Schema.Types.Mixed, default: null },
    terminationReason: { type: String, default: null },
    terminatedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'contracts' },
);

ContractSchema.pre('save', function (next) {
  if (this.status === 'terminated') return next();
  const now = new Date();
  if (this.endDate < now) {
    this.status = 'expired';
    this.renewalDue = true;
  }
  const daysUntilEnd = Math.ceil((this.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilEnd <= 30 && daysUntilEnd > 0) this.renewalDue = true;
  next();
});

ContractSchema.index({ status: 1, renewalDue: 1 });
ContractSchema.index({ endDate: 1 });

export const Contract = mongoose.models.Contract || mongoose.model<IContract>('Contract', ContractSchema);

// ─── Vehicle ──────────────────────────────────────────────────────────────────

export interface IVehicle extends Document {
  id: string;
  vehicleId: string;
  type: 'Electric Scooter' | 'Motorbike (Gas)' | 'Bicycle' | 'Car' | 'Van';
  fuelType: 'EV' | 'Petrol' | 'Diesel' | 'Other';
  assignedRiderId?: string;
  assignedRiderName?: string;
  status: 'active' | 'maintenance' | 'inactive';
  conditionScore: number;
  conditionLabel: 'New' | 'Excellent' | 'Good' | 'Fair' | 'Needs Service';
  lastServiceDate: Date;
  nextServiceDueDate: Date;
  currentOdometerKm: number;
  utilizationPercent: number;
  documents: { rcValidTill: Date; insuranceValidTill: Date; pucValidTill?: Date };
  pool: 'Hub' | 'Dedicated' | 'Spare';
  notes?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema = new Schema<IVehicle>(
  {
    id: { type: String, required: true, unique: true, index: true },
    vehicleId: { type: String, required: true, unique: true, trim: true, index: true },
    type: { type: String, required: true, enum: ['Electric Scooter', 'Motorbike (Gas)', 'Bicycle', 'Car', 'Van'] },
    fuelType: { type: String, required: true, enum: ['EV', 'Petrol', 'Diesel', 'Other'] },
    assignedRiderId: { type: String, default: null },
    assignedRiderName: { type: String, default: null, trim: true },
    status: { type: String, required: true, enum: ['active', 'maintenance', 'inactive'], default: 'active', index: true },
    conditionScore: { type: Number, required: true, min: 0, max: 100, default: 100 },
    conditionLabel: { type: String, required: true, enum: ['New', 'Excellent', 'Good', 'Fair', 'Needs Service'], default: 'New' },
    lastServiceDate: { type: Date, required: true, default: Date.now },
    nextServiceDueDate: { type: Date, required: true },
    currentOdometerKm: { type: Number, required: true, min: 0, default: 0 },
    utilizationPercent: { type: Number, required: true, min: 0, max: 100, default: 0 },
    documents: {
      rcValidTill: { type: Date, required: true },
      insuranceValidTill: { type: Date, required: true },
      pucValidTill: { type: Date, default: null },
    },
    pool: { type: String, required: true, enum: ['Hub', 'Dedicated', 'Spare'], default: 'Spare', index: true },
    notes: { type: String, default: null, trim: true },
    location: { type: String, default: null, trim: true },
  },
  { timestamps: true, collection: 'vehicles' },
);

VehicleSchema.pre('save', function (next) {
  if (this.isModified('conditionScore')) {
    if (this.conditionScore >= 90) this.conditionLabel = 'Excellent';
    else if (this.conditionScore >= 60) this.conditionLabel = 'Good';
    else this.conditionLabel = 'Needs Service';
  }
  next();
});

VehicleSchema.index({ status: 1, pool: 1 });
VehicleSchema.index({ assignedRiderId: 1 });

export const Vehicle = mongoose.models.Vehicle || mongoose.model<IVehicle>('Vehicle', VehicleSchema);

// ─── Auto-Assign Rule ─────────────────────────────────────────────────────────

export interface IAutoAssignRule extends Document {
  id: string;
  name: string;
  isActive: boolean;
  criteria: { maxRadiusKm: number; maxOrdersPerRider: number; preferSameZone: boolean };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const AutoAssignRuleSchema = new Schema<IAutoAssignRule>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: false },
    criteria: {
      maxRadiusKm: { type: Number, default: 5, min: 0.5, max: 50 },
      maxOrdersPerRider: { type: Number, default: 3, min: 1, max: 10 },
      preferSameZone: { type: Boolean, default: true },
    },
    createdBy: { type: String, default: 'system' },
  },
  { timestamps: true, collection: 'auto_assign_rules' },
);

export const AutoAssignRule = mongoose.models.AutoAssignRule || mongoose.model<IAutoAssignRule>('AutoAssignRule', AutoAssignRuleSchema);

// ─── Cluster ──────────────────────────────────────────────────────────────────

export interface ICluster extends Document {
  clusterId: string;
  orderIds: string[];
  center: { lat: number; lng: number };
  status: 'active' | 'assigned' | 'completed' | 'cancelled';
  riderId?: string;
  color: string;
  zone?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ClusterSchema = new Schema<ICluster>(
  {
    clusterId: { type: String, required: true, unique: true, index: true },
    orderIds: [{ type: String, required: true }],
    center: { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
    status: { type: String, enum: ['active', 'assigned', 'completed', 'cancelled'], default: 'active', index: true },
    riderId: { type: String, default: null, index: true },
    color: { type: String, default: '#F97316' },
    zone: { type: String, default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'clusters' },
);
ClusterSchema.index({ status: 1, zone: 1 });
ClusterSchema.index({ createdAt: -1 });

export const Cluster = mongoose.models.Cluster || mongoose.model<ICluster>('Cluster', ClusterSchema);

// ─── Training ─────────────────────────────────────────────────────────────────

export interface ITraining extends Document {
  riderId: string;
  riderName: string;
  status: 'not_started' | 'in_progress' | 'completed';
  modules: Array<{ id: string; name: string; completed: boolean }>;
  modulesCompleted: number;
  totalModules: number;
  progressPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingSchema = new Schema<ITraining>(
  {
    riderId: { type: String, required: true, unique: true, index: true },
    riderName: { type: String, required: true },
    status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started', index: true },
    modules: [{ id: String, name: String, completed: { type: Boolean, default: false }, _id: false }],
    modulesCompleted: { type: Number, default: 0, min: 0 },
    totalModules: { type: Number, default: 0, min: 0 },
    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true, collection: 'rider_training' },
);

export const Training = mongoose.models.Training || mongoose.model<ITraining>('Training', TrainingSchema);

// ─── Rider Dashboard Notification ────────────────────────────────────────────

export interface IRiderDashboardNotification extends Document {
  type: string;
  title: string;
  body: string;
  scopeKey?: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

const RiderDashboardNotificationSchema = new Schema<IRiderDashboardNotification>(
  {
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    scopeKey: { type: String, default: null, index: true },
    data: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: 'rider_dashboard_notifications' },
);
RiderDashboardNotificationSchema.index({ createdAt: -1 });

export const RiderDashboardNotification = mongoose.models.RiderDashboardNotification || mongoose.model<IRiderDashboardNotification>('RiderDashboardNotification', RiderDashboardNotificationSchema);

// ─── Maintenance Task ─────────────────────────────────────────────────────────

export interface IMaintenanceTask extends Document {
  vehicleId: string;
  taskType: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  scheduledDate: Date;
  completedDate?: Date;
  workshop?: string;
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceTaskSchema = new Schema<IMaintenanceTask>(
  {
    vehicleId: { type: String, required: true, index: true },
    taskType: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending', index: true },
    scheduledDate: { type: Date, required: true, index: true },
    completedDate: { type: Date, default: null },
    workshop: { type: String, default: null },
    estimatedCost: { type: Number, default: null },
    actualCost: { type: Number, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true, collection: 'maintenance_tasks' },
);

export const MaintenanceTask = mongoose.models.MaintenanceTask || mongoose.model<IMaintenanceTask>('MaintenanceTask', MaintenanceTaskSchema);
