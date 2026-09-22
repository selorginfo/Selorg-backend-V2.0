import mongoose, { Document, Schema, Types } from 'mongoose';

// --- FraudAlert ------------------------------------------------------------------------------

export interface IFraudEvidence extends Document {
  type: 'transaction' | 'device' | 'behavior' | 'system' | 'manual';
  description?: string;
  timestamp?: Date;
  data?: unknown;
}

const FraudEvidenceSchema = new Schema<IFraudEvidence>(
  {
    type: { type: String, enum: ['transaction', 'device', 'behavior', 'system', 'manual'] },
    description: String,
    timestamp: Date,
    data: Schema.Types.Mixed,
  },
  { _id: true },
);

export interface IFraudAlert extends Document {
  alertNumber: string;
  type: 'promo_abuse' | 'fake_account' | 'payment_fraud' | 'velocity_breach' | 'device_fraud' | 'refund_abuse' | 'chargeback_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  customerId: string;
  customerName: string;
  customerEmail: string;
  description: string;
  riskScore: number;
  evidence: Types.DocumentArray<IFraudEvidence>;
  actions: string[];
  orderNumbers: string[];
  amountInvolved?: number;
  deviceId?: string;
  ipAddress?: string;
  location?: string;
  assignedTo?: Types.ObjectId;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FraudAlertSchema = new Schema<IFraudAlert>(
  {
    alertNumber: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['promo_abuse', 'fake_account', 'payment_fraud', 'velocity_breach', 'device_fraud', 'refund_abuse', 'chargeback_risk'],
      required: true,
    },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    status: { type: String, enum: ['open', 'investigating', 'resolved', 'false_positive'], default: 'open' },
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    description: { type: String, required: true },
    riskScore: { type: Number, required: true },
    evidence: [FraudEvidenceSchema],
    actions: [String],
    orderNumbers: [String],
    amountInvolved: Number,
    deviceId: String,
    ipAddress: String,
    location: String,
    assignedTo: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    resolvedAt: Date,
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: true },
);

FraudAlertSchema.index({ status: 1 });
FraudAlertSchema.index({ severity: 1 });
FraudAlertSchema.index({ type: 1 });
FraudAlertSchema.index({ createdAt: -1 });

export const FraudAlert =
  (mongoose.models.FraudAlert as mongoose.Model<IFraudAlert>) || mongoose.model<IFraudAlert>('FraudAlert', FraudAlertSchema);

// --- BlockedEntity ---------------------------------------------------------------------------

export interface IBlockedEntity extends Document {
  type: 'email' | 'phone' | 'ip' | 'device' | 'user';
  value: string;
  reason: string;
  blockedBy: string;
  blockedByName: string;
  expiresAt?: Date;
  isPermanent: boolean;
  relatedAlerts: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BlockedEntitySchema = new Schema<IBlockedEntity>(
  {
    type: { type: String, enum: ['email', 'phone', 'ip', 'device', 'user'], required: true },
    value: { type: String, required: true },
    reason: { type: String, required: true },
    blockedBy: { type: String, required: true },
    blockedByName: { type: String, required: true },
    expiresAt: Date,
    isPermanent: { type: Boolean, default: false },
    relatedAlerts: [String],
    notes: String,
  },
  { timestamps: true },
);

BlockedEntitySchema.index({ type: 1, value: 1 }, { unique: true });
BlockedEntitySchema.index({ createdAt: -1 });

export const BlockedEntity =
  (mongoose.models.BlockedEntity as mongoose.Model<IBlockedEntity>) || mongoose.model<IBlockedEntity>('BlockedEntity', BlockedEntitySchema);

// --- FraudRule -------------------------------------------------------------------------------

export interface IFraudRule extends Document {
  name: string;
  type: 'velocity' | 'amount' | 'device' | 'location' | 'behavior';
  condition: string;
  threshold: number;
  action: 'flag' | 'block' | 'review' | 'alert';
  isActive: boolean;
  priority: number;
  triggeredCount: number;
  falsePositiveRate: number;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FraudRuleSchema = new Schema<IFraudRule>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['velocity', 'amount', 'device', 'location', 'behavior'], required: true },
    condition: { type: String, required: true },
    threshold: { type: Number, required: true },
    action: { type: String, enum: ['flag', 'block', 'review', 'alert'], required: true },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 1 },
    triggeredCount: { type: Number, default: 0 },
    falsePositiveRate: { type: Number, default: 0 },
    lastTriggered: Date,
  },
  { timestamps: true },
);

FraudRuleSchema.index({ isActive: 1 });

export const FraudRule =
  (mongoose.models.FraudRule as mongoose.Model<IFraudRule>) || mongoose.model<IFraudRule>('FraudRule', FraudRuleSchema);

// --- RiskProfile -----------------------------------------------------------------------------

export interface IRiskFactor {
  name?: string;
  score?: number;
  weight?: number;
  description?: string;
}

const RiskFactorSchema = new Schema<IRiskFactor>(
  { name: String, score: Number, weight: Number, description: String },
  { _id: false },
);

export interface IRiskProfile extends Document {
  entityType: 'customer' | 'device' | 'ip' | 'transaction';
  entityId: string;
  entityName: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: IRiskFactor[];
  totalOrders: number;
  totalSpent: number;
  refundRate: number;
  chargebackCount: number;
  accountAge: number;
  lastActivity?: Date;
  flags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const RiskProfileSchema = new Schema<IRiskProfile>(
  {
    entityType: { type: String, enum: ['customer', 'device', 'ip', 'transaction'], required: true },
    entityId: { type: String, required: true },
    entityName: { type: String, required: true },
    riskScore: { type: Number, required: true },
    riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    factors: [RiskFactorSchema],
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    refundRate: { type: Number, default: 0 },
    chargebackCount: { type: Number, default: 0 },
    accountAge: { type: Number, default: 0 },
    lastActivity: Date,
    flags: [String],
  },
  { timestamps: true },
);

RiskProfileSchema.index({ riskLevel: 1 });
RiskProfileSchema.index({ entityId: 1 });

export const RiskProfile =
  (mongoose.models.RiskProfile as mongoose.Model<IRiskProfile>) || mongoose.model<IRiskProfile>('RiskProfile', RiskProfileSchema);

// --- FraudPattern ----------------------------------------------------------------------------

export interface IFraudPattern extends Document {
  name: string;
  type: 'promo_abuse' | 'account_takeover' | 'payment_fraud' | 'refund_fraud' | 'velocity_abuse';
  description?: string;
  occurrences: number;
  totalLoss: number;
  detectedCount: number;
  preventedCount: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  lastDetected?: Date;
  affectedCustomers: number;
  createdAt: Date;
  updatedAt: Date;
}

const FraudPatternSchema = new Schema<IFraudPattern>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['promo_abuse', 'account_takeover', 'payment_fraud', 'refund_fraud', 'velocity_abuse'], required: true },
    description: String,
    occurrences: { type: Number, default: 0 },
    totalLoss: { type: Number, default: 0 },
    detectedCount: { type: Number, default: 0 },
    preventedCount: { type: Number, default: 0 },
    trend: { type: String, enum: ['increasing', 'decreasing', 'stable'], default: 'stable' },
    lastDetected: Date,
    affectedCustomers: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const FraudPattern =
  (mongoose.models.FraudPattern as mongoose.Model<IFraudPattern>) || mongoose.model<IFraudPattern>('FraudPattern', FraudPatternSchema);

// --- FraudInvestigation ------------------------------------------------------------------------

export interface IInvestigationTimelineEntry extends Document {
  action?: string;
  performedBy?: Types.ObjectId;
  performedByName?: string;
  timestamp?: Date;
  details?: string;
}

const InvestigationTimelineSchema = new Schema<IInvestigationTimelineEntry>(
  {
    action: String,
    performedBy: Schema.Types.ObjectId,
    performedByName: String,
    timestamp: Date,
    details: String,
  },
  { _id: true },
);

export interface IFraudInvestigation extends Document {
  caseNumber: string;
  title: string;
  type: 'fraud' | 'abuse' | 'suspicious';
  status: 'open' | 'investigating' | 'pending_review' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  investigator?: Types.ObjectId;
  customerId?: string;
  customerName?: string;
  totalLoss: number;
  timeline: Types.DocumentArray<IInvestigationTimelineEntry>;
  outcome?: 'confirmed_fraud' | 'false_positive' | 'inconclusive';
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FraudInvestigationSchema = new Schema<IFraudInvestigation>(
  {
    caseNumber: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    type: { type: String, enum: ['fraud', 'abuse', 'suspicious'], default: 'fraud' },
    status: { type: String, enum: ['open', 'investigating', 'pending_review', 'closed'], default: 'open' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    investigator: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    customerId: String,
    customerName: String,
    totalLoss: { type: Number, default: 0 },
    timeline: [InvestigationTimelineSchema],
    outcome: { type: String, enum: ['confirmed_fraud', 'false_positive', 'inconclusive'] },
    closedAt: Date,
  },
  { timestamps: true },
);

FraudInvestigationSchema.index({ status: 1 });
FraudInvestigationSchema.index({ createdAt: -1 });

export const FraudInvestigation =
  (mongoose.models.FraudInvestigation as mongoose.Model<IFraudInvestigation>) ||
  mongoose.model<IFraudInvestigation>('FraudInvestigation', FraudInvestigationSchema);

// --- Chargeback --------------------------------------------------------------------------------

export interface IChargeback extends Document {
  chargebackId: string;
  orderId: string;
  customerId?: string;
  customerName?: string;
  amount: number;
  reason?: string;
  status: 'received' | 'under_review' | 'accepted' | 'disputed' | 'won' | 'lost';
  receivedAt?: Date;
  dueDate?: Date;
  resolvedAt?: Date;
  merchantNotes?: string;
  evidence: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ChargebackSchema = new Schema<IChargeback>(
  {
    chargebackId: { type: String, required: true, unique: true },
    orderId: { type: String, required: true },
    customerId: String,
    customerName: String,
    amount: { type: Number, required: true },
    reason: String,
    status: { type: String, enum: ['received', 'under_review', 'accepted', 'disputed', 'won', 'lost'], default: 'received' },
    receivedAt: Date,
    dueDate: Date,
    resolvedAt: Date,
    merchantNotes: String,
    evidence: [String],
  },
  { timestamps: true },
);

ChargebackSchema.index({ status: 1 });
ChargebackSchema.index({ dueDate: 1 });

export const Chargeback =
  (mongoose.models.Chargeback as mongoose.Model<IChargeback>) || mongoose.model<IChargeback>('Chargeback', ChargebackSchema);
