import mongoose, { Schema, Document } from 'mongoose';
import { BULK_EXCEPTION_REASONS, RIDER_CANCEL_REASONS } from '../orders/order.model';

/**
 * Collections backing the rider (picker) app verticals that had no data model:
 * bulk multi-drop batches, the COD floating-cash ledger, the onboarding application,
 * kit acknowledgement, proof-of-delivery photos, the location breadcrumb trail,
 * push tokens, incentive rules, the cancel-reason catalogue and request idempotency.
 *
 * Kept separate from `picker.models.ts` (which holds the workforce/attendance core)
 * so the two surfaces stay independently readable.
 */

// ─── Bulk Batch + Stops ───────────────────────────────────────────────────────

export const BULK_BATCH_STATUSES = ['assigned', 'loading', 'ready', 'dispatched', 'in_transit', 'completed', 'cancelled'] as const;
export type BulkBatchStatus = (typeof BULK_BATCH_STATUSES)[number];

export const BULK_STOP_STATUSES = ['pending', 'delivered', 'failed'] as const;
export type BulkStopStatus = (typeof BULK_STOP_STATUSES)[number];

export const BULK_STOP_PHASES = ['to_nav', 'navigating', 'arrived'] as const;
export type BulkStopPhase = (typeof BULK_STOP_PHASES)[number];

export interface IBulkBatchStop {
  stopId: string;
  seq: number;
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  customerName: string;
  address: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  bagCode: string;
  bagLoaded: boolean;
  bagLoadedAt?: Date;
  bagScanMethod?: 'scan' | 'manual';
  itemCount: number;
  distanceKm?: number;
  etaMinutes?: number;
  status: BulkStopStatus;
  phase: BulkStopPhase;
  navigationStartedAt?: Date;
  arrivedAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  failureNote?: string;
  returnToHub: boolean;
  podPhotoId?: mongoose.Types.ObjectId;
  paymentMode: 'cod' | 'prepaid';
  codAmount?: number;
  codCollected?: number;
  requiresOtp: boolean;
  payout: number;
}

const bulkBatchStopSchema = new Schema<IBulkBatchStop>(
  {
    stopId: { type: String, required: true },
    seq: { type: Number, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'CustomerOrder', required: true },
    orderNumber: { type: String, default: '' },
    customerName: { type: String, default: 'Customer' },
    address: { type: String, default: '' },
    landmark: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    phone: { type: String },
    bagCode: { type: String, required: true },
    bagLoaded: { type: Boolean, default: false },
    bagLoadedAt: { type: Date },
    bagScanMethod: { type: String, enum: ['scan', 'manual'] },
    itemCount: { type: Number, default: 0 },
    distanceKm: { type: Number },
    etaMinutes: { type: Number },
    status: { type: String, enum: BULK_STOP_STATUSES, default: 'pending' },
    phase: { type: String, enum: BULK_STOP_PHASES, default: 'to_nav' },
    navigationStartedAt: { type: Date },
    arrivedAt: { type: Date },
    deliveredAt: { type: Date },
    failedAt: { type: Date },
    failureReason: { type: String, enum: [...BULK_EXCEPTION_REASONS, null], default: null },
    failureNote: { type: String, default: '' },
    returnToHub: { type: Boolean, default: false },
    podPhotoId: { type: Schema.Types.ObjectId, ref: 'PickerPodPhoto', default: null },
    paymentMode: { type: String, enum: ['cod', 'prepaid'], default: 'prepaid' },
    codAmount: { type: Number, default: null },
    codCollected: { type: Number, default: null },
    requiresOtp: { type: Boolean, default: false },
    payout: { type: Number, default: 0 },
  },
  { _id: false },
);

export interface IPickerBulkBatch extends Document {
  batchId: string;
  pickerId: mongoose.Types.ObjectId;
  hubKey?: string;
  hubName?: string;
  hubLatitude?: number;
  hubLongitude?: number;
  vehicleType: 'auto' | 'van' | 'motorcycle';
  vehicleRegistrationNumber?: string;
  status: BulkBatchStatus;
  stops: IBulkBatchStop[];
  currentStopId?: string | null;
  totalDistanceKm?: number;
  estimatedMinutes?: number;
  durationMinutes?: number;
  earnings: { total: number; base?: number; perStop?: number; distance?: number; incentive?: number };
  assignedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  clusterId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PickerBulkBatchSchema = new Schema<IPickerBulkBatch>(
  {
    batchId: { type: String, required: true, unique: true, index: true },
    pickerId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, index: true },
    hubKey: { type: String, index: true },
    hubName: { type: String },
    hubLatitude: { type: Number },
    hubLongitude: { type: Number },
    vehicleType: { type: String, enum: ['auto', 'van', 'motorcycle'], default: 'auto' },
    vehicleRegistrationNumber: { type: String },
    status: { type: String, enum: BULK_BATCH_STATUSES, default: 'assigned', index: true },
    stops: { type: [bulkBatchStopSchema], default: [] },
    currentStopId: { type: String, default: null },
    totalDistanceKm: { type: Number },
    estimatedMinutes: { type: Number },
    durationMinutes: { type: Number },
    earnings: {
      total: { type: Number, default: 0 },
      base: { type: Number },
      perStop: { type: Number },
      distance: { type: Number },
      incentive: { type: Number },
    },
    assignedAt: { type: Date, default: Date.now },
    startedAt: { type: Date },
    completedAt: { type: Date },
    clusterId: { type: String },
  },
  { timestamps: true, collection: 'picker_bulk_batches' },
);
PickerBulkBatchSchema.index({ pickerId: 1, status: 1 });
PickerBulkBatchSchema.index({ pickerId: 1, completedAt: -1 });

export const PickerBulkBatch =
  (mongoose.models.PickerBulkBatch as mongoose.Model<IPickerBulkBatch>) ||
  mongoose.model<IPickerBulkBatch>('PickerBulkBatch', PickerBulkBatchSchema);

// ─── Floating Cash (COD) Ledger ───────────────────────────────────────────────

export const CASH_LEDGER_TYPES = ['cod_collected', 'deposit', 'adjustment'] as const;
export type CashLedgerType = (typeof CASH_LEDGER_TYPES)[number];

export const DEPOSIT_METHODS = ['upi', 'bank', 'card'] as const;
export type DepositMethod = (typeof DEPOSIT_METHODS)[number];

export const DEPOSIT_METHOD_LABELS: Record<DepositMethod, string> = {
  upi: 'UPI',
  bank: 'Bank Transfer',
  card: 'Card',
};

export interface IPickerCashLedger extends Document {
  pickerId: mongoose.Types.ObjectId;
  type: CashLedgerType;
  /** Always positive; `direction` carries the sign. */
  amount: number;
  direction: 'in' | 'out';
  label: string;
  orderId?: mongoose.Types.ObjectId | null;
  orderNumber?: string;
  batchId?: string | null;
  method?: DepositMethod | null;
  ref?: string | null;
  hubKey?: string;
  note?: string;
  status: 'pending' | 'confirmed' | 'reconciled' | 'disputed';
  /** Orders whose `cod_pending` payment this deposit settled. */
  reconciledOrderIds: mongoose.Types.ObjectId[];
  idempotencyKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PickerCashLedgerSchema = new Schema<IPickerCashLedger>(
  {
    pickerId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, index: true },
    type: { type: String, enum: CASH_LEDGER_TYPES, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    direction: { type: String, enum: ['in', 'out'], required: true },
    label: { type: String, default: '' },
    orderId: { type: Schema.Types.ObjectId, ref: 'CustomerOrder', default: null },
    orderNumber: { type: String, default: '' },
    batchId: { type: String, default: null },
    method: { type: String, enum: [...DEPOSIT_METHODS, null], default: null },
    ref: { type: String, default: null },
    hubKey: { type: String },
    note: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'confirmed', 'reconciled', 'disputed'], default: 'confirmed' },
    reconciledOrderIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerOrder' }],
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: true, collection: 'picker_cash_ledger' },
);
PickerCashLedgerSchema.index({ pickerId: 1, createdAt: -1 });
// A deposit reference is a customer-visible receipt number; it must be globally unique.
PickerCashLedgerSchema.index({ ref: 1 }, { unique: true, sparse: true });
PickerCashLedgerSchema.index({ pickerId: 1, orderId: 1, type: 1 });

export const PickerCashLedger =
  (mongoose.models.PickerCashLedger as mongoose.Model<IPickerCashLedger>) ||
  mongoose.model<IPickerCashLedger>('PickerCashLedger', PickerCashLedgerSchema);

// ─── Onboarding Application ───────────────────────────────────────────────────

export const ONBOARDING_STEP_KEYS = ['personal', 'vehicle', 'hub', 'documents', 'training'] as const;
export type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number];

export const ONBOARDING_STEP_LABELS: Record<OnboardingStepKey, string> = {
  personal: 'Personal details',
  vehicle: 'Vehicle information',
  hub: 'Choose your hub',
  documents: 'Upload documents',
  training: 'Training & kit',
};

export interface IPickerOnboardingApplication extends Document {
  applicationId: string;
  pickerId: mongoose.Types.ObjectId;
  status: 'draft' | 'under_review' | 'approved' | 'rejected';
  hubKey?: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  acceptedTermsVersion?: string;
  acceptedPrivacyVersion?: string;
  /** Snapshot of which steps were complete at submission, for the review queue. */
  stepsAtSubmission: Record<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const PickerOnboardingApplicationSchema = new Schema<IPickerOnboardingApplication>(
  {
    applicationId: { type: String, required: true, unique: true, index: true },
    pickerId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, unique: true, index: true },
    status: { type: String, enum: ['draft', 'under_review', 'approved', 'rejected'], default: 'draft', index: true },
    hubKey: { type: String },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId },
    rejectionReason: { type: String },
    acceptedTermsVersion: { type: String },
    acceptedPrivacyVersion: { type: String },
    stepsAtSubmission: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, collection: 'picker_onboarding_applications' },
);

export const PickerOnboardingApplication =
  (mongoose.models.PickerOnboardingApplication as mongoose.Model<IPickerOnboardingApplication>) ||
  mongoose.model<IPickerOnboardingApplication>('PickerOnboardingApplication', PickerOnboardingApplicationSchema);

// ─── Kit Acknowledgement ──────────────────────────────────────────────────────

export const KIT_ITEMS = ['bag', 'tshirt', 'id', 'helmet'] as const;
export type KitItem = (typeof KIT_ITEMS)[number];

export interface IPickerKitAcknowledgement extends Document {
  pickerId: mongoose.Types.ObjectId;
  items: KitItem[];
  hubKey?: string;
  acknowledgedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PickerKitAcknowledgementSchema = new Schema<IPickerKitAcknowledgement>(
  {
    pickerId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, unique: true, index: true },
    items: [{ type: String, enum: KIT_ITEMS }],
    hubKey: { type: String },
    acknowledgedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'picker_kit_acknowledgements' },
);

export const PickerKitAcknowledgement =
  (mongoose.models.PickerKitAcknowledgement as mongoose.Model<IPickerKitAcknowledgement>) ||
  mongoose.model<IPickerKitAcknowledgement>('PickerKitAcknowledgement', PickerKitAcknowledgementSchema);

// ─── Proof-of-Delivery Photo ──────────────────────────────────────────────────

export interface IPickerPodPhoto extends Document {
  pickerId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId | null;
  batchId?: string | null;
  stopId?: string | null;
  url: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  capturedAt?: Date;
  latitude?: number;
  longitude?: number;
  consumedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PickerPodPhotoSchema = new Schema<IPickerPodPhoto>(
  {
    pickerId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'CustomerOrder', default: null, index: true },
    batchId: { type: String, default: null },
    stopId: { type: String, default: null },
    url: { type: String, required: true },
    fileName: { type: String },
    mimeType: { type: String },
    sizeBytes: { type: Number },
    capturedAt: { type: Date },
    latitude: { type: Number },
    longitude: { type: Number },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'picker_pod_photos' },
);

export const PickerPodPhoto =
  (mongoose.models.PickerPodPhoto as mongoose.Model<IPickerPodPhoto>) ||
  mongoose.model<IPickerPodPhoto>('PickerPodPhoto', PickerPodPhotoSchema);

// ─── Location Breadcrumb Trail ────────────────────────────────────────────────

const LOCATION_TRAIL_TTL_DAYS = parseInt(process.env.PICKER_LOCATION_TRAIL_TTL_DAYS || '30', 10);

export interface IPickerLocationPing extends Document {
  pickerId: mongoose.Types.ObjectId;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  orderId?: mongoose.Types.ObjectId | null;
  batchId?: string | null;
  recordedAt: Date;
}

const PickerLocationPingSchema = new Schema<IPickerLocationPing>(
  {
    pickerId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number },
    speed: { type: Number },
    heading: { type: Number },
    batteryLevel: { type: Number },
    orderId: { type: Schema.Types.ObjectId, ref: 'CustomerOrder', default: null },
    batchId: { type: String, default: null },
    recordedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false, collection: 'picker_location_pings' },
);
PickerLocationPingSchema.index({ pickerId: 1, recordedAt: -1 });
PickerLocationPingSchema.index({ recordedAt: 1 }, { expireAfterSeconds: LOCATION_TRAIL_TTL_DAYS * 86400 });

export const PickerLocationPing =
  (mongoose.models.PickerLocationPing as mongoose.Model<IPickerLocationPing>) ||
  mongoose.model<IPickerLocationPing>('PickerLocationPing', PickerLocationPingSchema);

// ─── Push Token ───────────────────────────────────────────────────────────────

export interface IPickerPushToken extends Document {
  pickerId: mongoose.Types.ObjectId;
  token: string;
  platform: 'ios' | 'android';
  deviceId?: string;
  appVersion?: string;
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PickerPushTokenSchema = new Schema<IPickerPushToken>(
  {
    pickerId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, index: true },
    token: { type: String, required: true, maxlength: 512 },
    platform: { type: String, enum: ['ios', 'android'], required: true },
    deviceId: { type: String },
    appVersion: { type: String },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'picker_push_tokens' },
);
PickerPushTokenSchema.index({ token: 1 }, { unique: true });
PickerPushTokenSchema.index({ pickerId: 1, deviceId: 1 });

export const PickerPushToken =
  (mongoose.models.PickerPushToken as mongoose.Model<IPickerPushToken>) ||
  mongoose.model<IPickerPushToken>('PickerPushToken', PickerPushTokenSchema);

// ─── Incentive Rule ───────────────────────────────────────────────────────────

export interface IPickerIncentiveRule extends Document {
  title: string;
  metric: 'orders' | 'deliveries' | 'hours';
  targetValue: number;
  rewardAmount: number;
  /** Paid pro-rata below target when true, all-or-nothing otherwise. */
  prorated: boolean;
  hubKey?: string | null;
  deliveryMode?: 'standard' | 'bulk' | null;
  validFrom?: Date | null;
  validTo?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PickerIncentiveRuleSchema = new Schema<IPickerIncentiveRule>(
  {
    title: { type: String, required: true },
    metric: { type: String, enum: ['orders', 'deliveries', 'hours'], default: 'orders' },
    targetValue: { type: Number, required: true, min: 1 },
    rewardAmount: { type: Number, required: true, min: 0 },
    prorated: { type: Boolean, default: false },
    hubKey: { type: String, default: null },
    deliveryMode: { type: String, enum: ['standard', 'bulk', null], default: null },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: 'picker_incentive_rules' },
);

export const PickerIncentiveRule =
  (mongoose.models.PickerIncentiveRule as mongoose.Model<IPickerIncentiveRule>) ||
  mongoose.model<IPickerIncentiveRule>('PickerIncentiveRule', PickerIncentiveRuleSchema);

// ─── Cancel / Exception Reason Catalogue ──────────────────────────────────────

export interface IPickerCancelReason extends Document {
  context: 'standard' | 'bulk';
  reasonId: string;
  label: string;
  subtitle?: string | null;
  requiresNote: boolean;
  order: number;
  isActive: boolean;
}

const PickerCancelReasonSchema = new Schema<IPickerCancelReason>(
  {
    context: { type: String, enum: ['standard', 'bulk'], required: true, index: true },
    reasonId: { type: String, required: true },
    label: { type: String, required: true },
    subtitle: { type: String, default: null },
    requiresNote: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'picker_cancel_reasons' },
);
PickerCancelReasonSchema.index({ context: 1, reasonId: 1 }, { unique: true });

export const PickerCancelReason =
  (mongoose.models.PickerCancelReason as mongoose.Model<IPickerCancelReason>) ||
  mongoose.model<IPickerCancelReason>('PickerCancelReason', PickerCancelReasonSchema);

/**
 * Seed catalogue, used as the fallback when the collection is empty so the endpoint is
 * never a blocker. The ids are authoritative for `Order.riderCancellationReason` and
 * `IBulkBatchStop.failureReason`.
 */
export const DEFAULT_CANCEL_REASONS: Array<Omit<IPickerCancelReason, keyof Document>> = [
  { context: 'standard', reasonId: 'unreachable', label: 'Customer not reachable', subtitle: 'No answer after multiple calls', requiresNote: false, order: 1, isActive: true },
  { context: 'standard', reasonId: 'refused', label: 'Customer refused delivery', subtitle: 'Order declined at the door', requiresNote: false, order: 2, isActive: true },
  { context: 'standard', reasonId: 'address', label: 'Wrong or incomplete address', subtitle: 'Location could not be found', requiresNote: false, order: 3, isActive: true },
  { context: 'standard', reasonId: 'asked', label: 'Customer asked to cancel', subtitle: 'Requested cancellation directly', requiresNote: false, order: 4, isActive: true },
  { context: 'standard', reasonId: 'vehicle', label: 'Vehicle breakdown / safety issue', subtitle: 'Unable to continue the trip', requiresNote: false, order: 5, isActive: true },
  { context: 'standard', reasonId: 'other', label: 'Other reason', subtitle: 'Add a note for support', requiresNote: true, order: 6, isActive: true },
  { context: 'bulk', reasonId: 'unreachable', label: 'Customer not reachable', subtitle: null, requiresNote: false, order: 1, isActive: true },
  { context: 'bulk', reasonId: 'refused', label: 'Customer refused delivery', subtitle: null, requiresNote: false, order: 2, isActive: true },
  { context: 'bulk', reasonId: 'address', label: 'Wrong or incomplete address', subtitle: null, requiresNote: false, order: 3, isActive: true },
  { context: 'bulk', reasonId: 'other', label: 'Other reason', subtitle: null, requiresNote: true, order: 4, isActive: true },
] as Array<Omit<IPickerCancelReason, keyof Document>>;

export { RIDER_CANCEL_REASONS, BULK_EXCEPTION_REASONS };

// ─── Idempotency ──────────────────────────────────────────────────────────────

const IDEMPOTENCY_TTL_HOURS = 24;

export interface IPickerIdempotencyRecord extends Document {
  pickerId: mongoose.Types.ObjectId;
  scope: string;
  key: string;
  response: unknown;
  statusCode: number;
  createdAt: Date;
}

const PickerIdempotencyRecordSchema = new Schema<IPickerIdempotencyRecord>(
  {
    pickerId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true },
    scope: { type: String, required: true },
    key: { type: String, required: true },
    response: { type: Schema.Types.Mixed },
    statusCode: { type: Number, default: 200 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false, collection: 'picker_idempotency_records' },
);
PickerIdempotencyRecordSchema.index({ pickerId: 1, scope: 1, key: 1 }, { unique: true });
PickerIdempotencyRecordSchema.index({ createdAt: 1 }, { expireAfterSeconds: IDEMPOTENCY_TTL_HOURS * 3600 });

export const PickerIdempotencyRecord =
  (mongoose.models.PickerIdempotencyRecord as mongoose.Model<IPickerIdempotencyRecord>) ||
  mongoose.model<IPickerIdempotencyRecord>('PickerIdempotencyRecord', PickerIdempotencyRecordSchema);
