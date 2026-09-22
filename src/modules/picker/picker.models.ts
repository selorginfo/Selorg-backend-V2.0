import mongoose, { Schema, Document } from 'mongoose';

// ─── Picker User ──────────────────────────────────────────────────────────────

/**
 * Vehicle classes a rider can be assigned.
 * `auto` / `ev_auto` / `van` imply bulk (multi-drop) delivery.
 * Legacy `ev` (EV Scooter) remains standard for existing profiles.
 */
export const PICKER_VEHICLE_TYPES = [
  'bike',
  'scooter',
  'ev',
  'cycle',
  'auto',
  'van',
  'ev_auto',
] as const;
export type PickerVehicleType = (typeof PICKER_VEHICLE_TYPES)[number];

export const BULK_VEHICLE_TYPES: readonly PickerVehicleType[] = [
  'auto',
  'ev_auto',
  'van',
];

/** Single place the Auto / EV Auto / van ⇒ bulk rule lives. */
export function deriveDeliveryMode(vehicleType?: string | null): 'standard' | 'bulk' {
  return BULK_VEHICLE_TYPES.includes(vehicleType as PickerVehicleType) ? 'bulk' : 'standard';
}

export const PICKER_LANGUAGES = ['en', 'hi', 'kn', 'ta', 'te'] as const;
export type PickerLanguage = (typeof PICKER_LANGUAGES)[number];

export interface IPickerPreferences {
  pushNotifications: boolean;
  locationSharing: boolean;
  orderSoundAlerts: boolean;
  language: PickerLanguage;
  /** Picker-app extras — rider clients ignore these. */
  shiftReminders?: boolean;
  payoutAlerts?: boolean;
  incentiveUpdates?: boolean;
  updatedAt?: Date;
}

export type PickerUserStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'BLOCKED'
  | 'DELETION_PENDING';

/** Discriminator for the shared `/api/v1/picker` namespace. Unset on legacy rows. */
export type WorkforceRole = 'picker' | 'rider';

export function parseWorkforceRole(raw?: unknown): WorkforceRole | undefined {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'picker' || v === 'rider') return v;
  return undefined;
}

export function pickerDisplayRole(user: {
  workforceRole?: WorkforceRole | string | null;
  employment?: { role?: string | null } | null;
}): string {
  const job = user.employment?.role?.trim();
  if (job) return job;
  if (user.workforceRole === 'rider') return 'Rider';
  return 'Picker';
}

export interface IPickerEmergencyContact {
  name?: string;
  phone?: string;
  relation?: 'Spouse' | 'Parent' | 'Sibling' | 'Friend';
}

export interface IPickerOnboardingProgress {
  currentStep: number;
  completedSteps: number[];
  submittedForReviewAt?: Date;
}

export interface IPickerUser extends Document {
  phone: string;
  status: PickerUserStatus;
  rejectedReason?: string;
  rejectedAt?: Date;
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  email?: string;
  /**
   * True when `phone` holds a synthetic placeholder generated for an email-only
   * signup (the column is `required` + `unique`, so a value must exist). API
   * responses return `phone: null` for these accounts and admin lists must hide it.
   */
  phoneIsPlaceholder: boolean;
  loginMethod?: 'mobile' | 'whatsapp' | 'email';
  /** Which workforce app this account belongs to. Legacy rows may be unset. */
  workforceRole?: WorkforceRole;
  name?: string;
  age?: number;
  dob?: Date;
  gender?: 'male' | 'female' | 'other';
  photoUri?: string;
  altPhone?: string;
  address?: string;
  city?: string;
  pincode?: string;
  emergencyContact?: IPickerEmergencyContact;
  onboarding?: IPickerOnboardingProgress;
  locationType?: 'warehouse' | 'darkstore';
  vehicleType?: PickerVehicleType;
  vehicleRegistrationNumber?: string;
  deliveryMode: 'standard' | 'bulk';
  isOnline: boolean;
  onlineSince?: Date;
  activeShiftId?: mongoose.Types.ObjectId;
  activeDeviceId?: string;
  activeBatchId?: string;
  preferences: IPickerPreferences;
  ratingSum: number;
  ratingCount: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  totalTrips: number;
  acceptedTermsVersion?: string;
  acceptedPrivacyVersion?: string;
  selectedShifts: Array<{ id: string; name: string; time: string }>;
  trainingProgress: Record<string, number>;
  trainingCompleted: boolean;
  trainingCompletedAt?: Date;
  currentLocationId?: string;
  upiId?: string;
  upiName?: string;
  upiPayoutVerificationStatus: 'none' | 'pending' | 'verified' | 'rejected';
  upiPayoutRejectionReason: string;
  upiPayoutSubmittedAt?: Date;
  upiPayoutReviewedAt?: Date;
  upiPayoutReviewedBy?: mongoose.Types.ObjectId;
  hhdUserId?: mongoose.Types.ObjectId;
  agencyId?: mongoose.Types.ObjectId;
  storeId?: mongoose.Types.ObjectId;
  contractInfo?: { legalName?: string; contractStartDate?: Date; documentId?: string };
  employment?: { joiningDate?: Date; role?: string; shiftType?: string; employerName?: string; employeeId?: string; department?: string };
  lastSeenAt?: Date;
  batteryLevel?: number;
  activeOrderId?: string;
  faceVerificationStatus: 'pending' | 'verified' | 'rejected' | 'overridden_approved' | 'overridden_rejected';
  faceImageUrl?: string;
  onBreak: boolean;
  gpsLocation?: { latitude: number; longitude: number; timestamp: Date };
  sessionToken?: string;
  locationOtp?: string;
  locationOtpForLocationId?: string;
  locationOtpExpiresAt?: Date;
  locationOtpAttempts?: number;
  deletionRequestedAt?: Date;
  deletionReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const PickerUserSchema = new Schema<IPickerUser>(
  {
    phone: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED', 'SUSPENDED', 'BLOCKED', 'DELETION_PENDING'],
      default: 'PENDING',
      index: true,
    },
    rejectedReason: { type: String },
    rejectedAt: { type: Date },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId },
    email: { type: String },
    phoneIsPlaceholder: { type: Boolean, default: false },
    loginMethod: { type: String, enum: ['mobile', 'whatsapp', 'email'] },
    workforceRole: { type: String, enum: ['picker', 'rider'], index: true },
    name: { type: String },
    age: { type: Number },
    dob: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    photoUri: { type: String },
    altPhone: { type: String },
    address: { type: String, maxlength: 250 },
    city: { type: String, maxlength: 100 },
    pincode: { type: String },
    emergencyContact: {
      name: { type: String, maxlength: 100 },
      phone: { type: String },
      relation: { type: String, enum: ['Spouse', 'Parent', 'Sibling', 'Friend'] },
    },
    onboarding: {
      currentStep: { type: Number, default: 1, min: 1, max: 8 },
      completedSteps: { type: [Number], default: [] },
      submittedForReviewAt: { type: Date, default: null },
    },
    locationType: { type: String, enum: ['warehouse', 'darkstore'] },
    vehicleType: { type: String, enum: PICKER_VEHICLE_TYPES },
    vehicleRegistrationNumber: { type: String, uppercase: true, trim: true },
    deliveryMode: { type: String, enum: ['standard', 'bulk'], default: 'standard', index: true },
    isOnline: { type: Boolean, default: false, index: true },
    onlineSince: { type: Date },
    activeShiftId: { type: Schema.Types.ObjectId, ref: 'PickerShift', default: null },
    activeDeviceId: { type: String, default: null },
    activeBatchId: { type: String, default: null },
    preferences: {
      pushNotifications: { type: Boolean, default: true },
      locationSharing: { type: Boolean, default: true },
      orderSoundAlerts: { type: Boolean, default: true },
      language: { type: String, enum: PICKER_LANGUAGES, default: 'en' },
      shiftReminders: { type: Boolean, default: true },
      payoutAlerts: { type: Boolean, default: true },
      incentiveUpdates: { type: Boolean, default: false },
      updatedAt: { type: Date },
    },
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    onTimeDeliveries: { type: Number, default: 0 },
    lateDeliveries: { type: Number, default: 0 },
    totalTrips: { type: Number, default: 0 },
    acceptedTermsVersion: { type: String },
    acceptedPrivacyVersion: { type: String },
    selectedShifts: [{ id: String, name: String, time: String, _id: false }],
    trainingProgress: { type: Schema.Types.Mixed, default: () => ({ video1: 0, video2: 0, video3: 0, video4: 0 }) },
    trainingCompleted: { type: Boolean, default: false },
    trainingCompletedAt: { type: Date },
    currentLocationId: { type: String },
    upiId: { type: String },
    upiName: { type: String },
    upiPayoutVerificationStatus: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none', index: true },
    upiPayoutRejectionReason: { type: String, default: '' },
    upiPayoutSubmittedAt: { type: Date, default: null },
    upiPayoutReviewedAt: { type: Date, default: null },
    upiPayoutReviewedBy: { type: Schema.Types.ObjectId, default: null },
    hhdUserId: { type: Schema.Types.ObjectId, default: null },
    agencyId: { type: Schema.Types.ObjectId, default: null, index: true },
    storeId: { type: Schema.Types.ObjectId, default: null, index: true },
    contractInfo: { legalName: String, contractStartDate: Date, documentId: String },
    employment: { joiningDate: Date, role: String, shiftType: String, employerName: String, employeeId: String, department: String },
    lastSeenAt: { type: Date },
    batteryLevel: { type: Number },
    activeOrderId: { type: String },
    faceVerificationStatus: { type: String, enum: ['pending', 'verified', 'rejected', 'overridden_approved', 'overridden_rejected'], default: 'pending' },
    faceImageUrl: { type: String },
    onBreak: { type: Boolean, default: false },
    gpsLocation: { latitude: Number, longitude: Number, timestamp: Date },
    sessionToken: { type: String, default: null },
    locationOtp: { type: String, default: null },
    locationOtpForLocationId: { type: String, default: null },
    locationOtpExpiresAt: { type: Date, default: null },
    locationOtpAttempts: { type: Number, default: 0 },
    deletionRequestedAt: { type: Date, default: null },
    deletionReason: { type: String, default: '' },
  },
  { timestamps: true, collection: 'picker_users' },
);
PickerUserSchema.index({ status: 1 });
PickerUserSchema.index({ lastSeenAt: -1 });
// Email login looks accounts up by address. Non-unique: legacy rows may share one.
PickerUserSchema.index({ email: 1 }, { sparse: true });
// Order offer fan-out: online riders at a hub on a given delivery mode.
PickerUserSchema.index({ isOnline: 1, currentLocationId: 1, deliveryMode: 1 });

export const PickerUser = mongoose.models.PickerUser || mongoose.model<IPickerUser>('PickerUser', PickerUserSchema);

// ─── Picker OTP ───────────────────────────────────────────────────────────────

export interface IPickerOtp extends Document {
  identifier: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  /** Sends inside the current throttle window — survives the per-send `attempts` reset. */
  sendCount: number;
  windowStartedAt?: Date;
  createdAt: Date;
}

const PickerOtpSchema = new Schema<IPickerOtp>(
  {
    identifier: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    sendCount: { type: Number, default: 0 },
    windowStartedAt: { type: Date },
  },
  { timestamps: true, collection: 'picker_otps' },
);

export const PickerOtp = mongoose.models.PickerOtp || mongoose.model<IPickerOtp>('PickerOtp', PickerOtpSchema);

// ─── Picker Shift ─────────────────────────────────────────────────────────────

export interface IPickerShift extends Document {
  id?: string;
  name: string;
  warehouseKey?: string;
  site?: string;
  siteId?: string;
  startTime?: string;
  endTime?: string;
  time?: string;
  duration?: string;
  /** Calendar day the shift runs on. Absent on legacy rows — treated as "recurring/today". */
  date?: Date;
  capacity: number;
  breakDuration: number;
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  orders?: number;
  basePay?: number;
  hasIncentive: boolean;
  isSurge: boolean;
  color?: string;
  locationType?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PickerShiftSchema = new Schema<IPickerShift>(
  {
    id: { type: String },
    name: { type: String, required: true },
    warehouseKey: { type: String, trim: true, index: true },
    site: { type: String },
    siteId: { type: String },
    startTime: { type: String },
    endTime: { type: String },
    time: { type: String },
    duration: { type: String },
    date: { type: Date, index: true },
    capacity: { type: Number, default: 1 },
    breakDuration: { type: Number, default: 0 },
    status: { type: String, enum: ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'], default: 'SCHEDULED', index: true },
    orders: { type: Number },
    basePay: { type: Number },
    hasIncentive: { type: Boolean, default: true },
    isSurge: { type: Boolean, default: false },
    color: { type: String },
    locationType: { type: String },
  },
  { timestamps: true, collection: 'picker_shifts' },
);
PickerShiftSchema.index({ warehouseKey: 1, siteId: 1, status: 1 });
PickerShiftSchema.index({ status: 1, date: 1 });

export const PickerShift = mongoose.models.PickerShift || mongoose.model<IPickerShift>('PickerShift', PickerShiftSchema);

// ─── Picker Shift Assignment ──────────────────────────────────────────────────

export interface IPickerShiftAssignment extends Document {
  userId: mongoose.Types.ObjectId;
  shiftId: mongoose.Types.ObjectId;
  date: Date;
  warehouseKey?: string;
  status: 'ASSIGNED' | 'STARTED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PickerShiftAssignmentSchema = new Schema<IPickerShiftAssignment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, index: true },
    shiftId: { type: Schema.Types.ObjectId, ref: 'PickerShift', required: true, index: true },
    date: { type: Date, required: true, index: true },
    warehouseKey: { type: String, index: true },
    status: { type: String, enum: ['ASSIGNED', 'STARTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'], default: 'ASSIGNED', index: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true, collection: 'picker_shift_assignments' },
);
PickerShiftAssignmentSchema.index({ userId: 1, date: 1 });
PickerShiftAssignmentSchema.index(
  { userId: 1, shiftId: 1, date: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['ASSIGNED', 'STARTED', 'COMPLETED'] } } },
);

export const PickerShiftAssignment = mongoose.models.PickerShiftAssignment || mongoose.model<IPickerShiftAssignment>('PickerShiftAssignment', PickerShiftAssignmentSchema);

// ─── Picker Attendance ────────────────────────────────────────────────────────

export interface IPickerAttendance extends Document {
  warehouseKey?: string;
  userId: mongoose.Types.ObjectId;
  punchIn: Date;
  punchOut?: Date;
  locationIn?: Record<string, unknown>;
  locationOut?: Record<string, unknown>;
  shiftId?: string;
  status: 'present' | 'half-day' | 'absent' | 'ON_DUTY' | 'COMPLETED' | 'ON_BREAK';
  breaks: Array<{ startTime: Date; endTime?: Date }>;
  lateByMinutes: number;
  overtimeMinutes: number;
  totalWorkedMinutes: number;
  ordersCompleted?: number;
  regularHours?: number;
  overtimeHours?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PickerAttendanceSchema = new Schema<IPickerAttendance>(
  {
    warehouseKey: { type: String, trim: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true },
    punchIn: { type: Date, required: true },
    punchOut: { type: Date },
    locationIn: { type: Schema.Types.Mixed },
    locationOut: { type: Schema.Types.Mixed },
    shiftId: { type: String },
    status: { type: String, enum: ['present', 'half-day', 'absent', 'ON_DUTY', 'COMPLETED', 'ON_BREAK'], default: 'present' },
    breaks: [{ startTime: { type: Date, required: true }, endTime: Date, _id: false }],
    lateByMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },
    totalWorkedMinutes: { type: Number, default: 0 },
    ordersCompleted: { type: Number },
    regularHours: { type: Number },
    overtimeHours: { type: Number },
  },
  { timestamps: true, collection: 'picker_attendance' },
);
PickerAttendanceSchema.index({ userId: 1, punchIn: -1 });
PickerAttendanceSchema.index({ warehouseKey: 1, punchIn: -1 });

export const PickerAttendance = mongoose.models.PickerAttendance || mongoose.model<IPickerAttendance>('PickerAttendance', PickerAttendanceSchema);

// ─── Picker Wallet ────────────────────────────────────────────────────────────

export interface IPickerWallet extends Document {
  userId: mongoose.Types.ObjectId;
  availableBalance: number;
  pendingBalance: number;
  reservedBalance: number;
  totalEarnings: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const PickerWalletSchema = new Schema<IPickerWallet>(
  { userId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, unique: true }, availableBalance: { type: Number, default: 0 }, pendingBalance: { type: Number, default: 0 }, reservedBalance: { type: Number, default: 0 }, totalEarnings: { type: Number, default: 0 }, currency: { type: String, default: 'INR' } },
  { timestamps: true, collection: 'picker_wallets' },
);

export const PickerWallet = mongoose.models.PickerWallet || mongoose.model<IPickerWallet>('PickerWallet', PickerWalletSchema);

// ─── Picker Transaction ───────────────────────────────────────────────────────

export interface IPickerTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  referenceId?: string;
  status: 'pending' | 'completed' | 'failed';
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const PickerTransactionSchema = new Schema<IPickerTransaction>(
  { userId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, index: true }, type: { type: String, enum: ['credit', 'debit'], required: true }, amount: { type: Number, required: true, min: 0 }, description: { type: String, required: true }, referenceId: { type: String }, status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' }, currency: { type: String, default: 'INR' } },
  { timestamps: true, collection: 'picker_transactions' },
);
PickerTransactionSchema.index({ userId: 1, createdAt: -1 });

export const PickerTransaction = mongoose.models.PickerTransaction || mongoose.model<IPickerTransaction>('PickerTransaction', PickerTransactionSchema);

// ─── Picker Withdrawal Request ────────────────────────────────────────────────

export interface IPickerWithdrawalRequest extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  accountId?: mongoose.Types.ObjectId;
  idempotencyKey?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  paidAt?: Date;
  currency: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PickerWithdrawalRequestSchema = new Schema<IPickerWithdrawalRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    accountId: { type: Schema.Types.ObjectId, ref: 'PickerBankAccount', default: null },
    idempotencyKey: { type: String, trim: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAID'], default: 'PENDING', index: true },
    approvedBy: { type: Schema.Types.ObjectId },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    paidAt: { type: Date },
    currency: { type: String, default: 'INR' },
    notes: { type: String },
  },
  { timestamps: true, collection: 'picker_withdrawal_requests' },
);
PickerWithdrawalRequestSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

export const PickerWithdrawalRequest = mongoose.models.PickerWithdrawalRequest || mongoose.model<IPickerWithdrawalRequest>('PickerWithdrawalRequest', PickerWithdrawalRequestSchema);

// ─── Picker Document ──────────────────────────────────────────────────────────

/** KYC document types the rider app collects (`ObKycScreen` `DOC_LIST[].code`). */
export const PICKER_DOCUMENT_TYPES = ['aadhar', 'pan', 'dl', 'rc', 'ins'] as const;
export type PickerDocumentType = (typeof PICKER_DOCUMENT_TYPES)[number];

/** Aadhaar and PAN are captured front and back; DL / RC / insurance are a single image. */
export const PICKER_TWO_SIDED_DOCUMENT_TYPES: readonly PickerDocumentType[] = ['aadhar', 'pan'];

export interface IPickerDocument extends Document {
  userId: mongoose.Types.ObjectId;
  type: string;
  side?: 'front' | 'back';
  url?: string;
  documentNumber?: string;
  fileName?: string;
  status: 'pending' | 'approved' | 'rejected';
  /** Set on the older row when a rejected document is re-uploaded. */
  supersededBy?: mongoose.Types.ObjectId;
  supersededAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PickerDocumentSchema = new Schema<IPickerDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, index: true },
    type: { type: String, required: true },
    // Aadhaar and PAN use front/back; other KYC types have no side — omit the field, do not store null.
    side: { type: String, enum: ['front', 'back'] },
    url: { type: String },
    documentNumber: { type: String },
    fileName: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    supersededBy: { type: Schema.Types.ObjectId, ref: 'PickerDocument', default: null },
    supersededAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { timestamps: true, collection: 'picker_documents' },
);
PickerDocumentSchema.index({ userId: 1, type: 1, side: 1 });

if (mongoose.models.PickerDocument) {
  delete mongoose.models.PickerDocument;
  delete (mongoose as unknown as { modelSchemas?: Record<string, unknown> }).modelSchemas?.PickerDocument;
}

export const PickerDocument = mongoose.model<IPickerDocument>('PickerDocument', PickerDocumentSchema);

/**
 * Older DBs had a unique index on `{ userId, docType, side }` while the schema
 * field is `type`. Every insert left `docType` null, so the 2nd KYC upload
 * failed with "userId already exists". Drop that legacy index if present.
 */
export async function ensurePickerDocumentIndexes(): Promise<void> {
  const col = PickerDocument.collection;
  try {
    await col.dropIndex('userId_1_docType_1_side_1');
  } catch {
    // Index already gone — fine.
  }
  await col.createIndex(
    { userId: 1, type: 1, side: 1 },
    { name: 'userId_1_type_1_side_1', background: true },
  ).catch(() => undefined);
}

// ─── Picker Device ────────────────────────────────────────────────────────────

export interface IPickerDevice extends Document {
  deviceId: string;
  type: string;
  deviceModel?: string;
  assignedTo?: mongoose.Types.ObjectId;
  status: 'available' | 'assigned' | 'maintenance' | 'retired';
  condition: 'new' | 'good' | 'fair' | 'poor';
  warehouseKey?: string;
  notes?: string;
  battery?: number;
  lastSyncedAt?: Date;
  assignedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PickerDeviceSchema = new Schema<IPickerDevice>(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true },
    deviceModel: { type: String },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'PickerUser', default: null, index: true },
    status: { type: String, enum: ['available', 'assigned', 'maintenance', 'retired'], default: 'available', index: true },
    condition: { type: String, enum: ['new', 'good', 'fair', 'poor'], default: 'good' },
    warehouseKey: { type: String },
    notes: { type: String },
    battery: { type: Number, min: 0, max: 100 },
    lastSyncedAt: { type: Date },
    assignedAt: { type: Date },
  },
  { timestamps: true, collection: 'picker_devices' },
);

export const PickerDevice = mongoose.models.PickerDevice || mongoose.model<IPickerDevice>('PickerDevice', PickerDeviceSchema);

// ─── Picker Notification ──────────────────────────────────────────────────────

export interface IPickerNotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

const PickerNotificationSchema = new Schema<IPickerNotification>(
  { userId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, index: true }, type: { type: String, required: true }, title: { type: String, required: true }, body: { type: String, required: true }, data: { type: Schema.Types.Mixed, default: {} }, read: { type: Boolean, default: false, index: true } },
  { timestamps: true, collection: 'picker_notifications' },
);
PickerNotificationSchema.index({ userId: 1, createdAt: -1 });

export const PickerNotification = mongoose.models.PickerNotification || mongoose.model<IPickerNotification>('PickerNotification', PickerNotificationSchema);

// ─── Picker Bank Account ──────────────────────────────────────────────────────

export interface IPickerBankAccount extends Document {
  userId: mongoose.Types.ObjectId;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName?: string;
  branchName?: string;
  isVerified: boolean;
  isPrimary: boolean;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  rejectionReason: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PickerBankAccountSchema = new Schema<IPickerBankAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, index: true },
    accountHolderName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    bankName: { type: String },
    branchName: { type: String },
    isVerified: { type: Boolean, default: false },
    isPrimary: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
    rejectionReason: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: 'picker_bank_accounts' },
);

export const PickerBankAccount = mongoose.models.PickerBankAccount || mongoose.model<IPickerBankAccount>('PickerBankAccount', PickerBankAccountSchema);

// ─── Picker Work Location ─────────────────────────────────────────────────────

export interface IPickerWorkLocation extends Document {
  warehouseKey: string;
  name: string;
  address?: string;
  type: 'warehouse' | 'darkstore';
  isActive: boolean;
  coordinates?: { latitude: number; longitude: number };
  /** GeoJSON mirror of `coordinates`, indexed 2dsphere for nearby-hub queries. */
  geo?: { type: 'Point'; coordinates: [number, number] };
  geofenceRadius?: number;
  dispatchBays?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PickerWorkLocationSchema = new Schema<IPickerWorkLocation>(
  {
    warehouseKey: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    address: { type: String },
    type: { type: String, enum: ['warehouse', 'darkstore'], required: true },
    isActive: { type: Boolean, default: true, index: true },
    coordinates: { latitude: Number, longitude: Number },
    geo: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] },
    },
    geofenceRadius: { type: Number, default: 200 },
    dispatchBays: { type: Number },
  },
  { timestamps: true, collection: 'picker_work_locations' },
);
PickerWorkLocationSchema.index({ geo: '2dsphere' });
PickerWorkLocationSchema.pre('save', function syncGeo() {
  const lat = this.coordinates?.latitude;
  const lng = this.coordinates?.longitude;
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    this.geo = { type: 'Point', coordinates: [lng, lat] };
  }
});

export const PickerWorkLocation = mongoose.models.PickerWorkLocation || mongoose.model<IPickerWorkLocation>('PickerWorkLocation', PickerWorkLocationSchema);

// ─── Picker SLA Config ────────────────────────────────────────────────────────

export interface IPickerSlaConfig extends Document {
  warehouseKey: string;
  targetMinutes: number;
  warningThresholdMinutes: number;
  criticalThresholdMinutes: number;
  lateToleranceMinutes: number;
  overtimeGraceMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const PickerSlaConfigSchema = new Schema<IPickerSlaConfig>(
  { warehouseKey: { type: String, required: true, unique: true, index: true }, targetMinutes: { type: Number, default: 30 }, warningThresholdMinutes: { type: Number, default: 25 }, criticalThresholdMinutes: { type: Number, default: 35 }, lateToleranceMinutes: { type: Number, default: 5 }, overtimeGraceMinutes: { type: Number, default: 10 } },
  { timestamps: true, collection: 'picker_sla_configs' },
);

export const PickerSlaConfig = mongoose.models.PickerSlaConfig || mongoose.model<IPickerSlaConfig>('PickerSlaConfig', PickerSlaConfigSchema);

// ─── Picker Action Log ────────────────────────────────────────────────────────

export interface IPickerActionLog extends Document {
  userId: mongoose.Types.ObjectId;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const PickerActionLogSchema = new Schema<IPickerActionLog>(
  { userId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, index: true }, action: { type: String, required: true }, entityType: { type: String }, entityId: { type: String }, details: { type: Schema.Types.Mixed }, ip: { type: String }, userAgent: { type: String } },
  { timestamps: true, collection: 'picker_action_logs' },
);
PickerActionLogSchema.index({ userId: 1, createdAt: -1 });
PickerActionLogSchema.index({ createdAt: -1 });

export const PickerActionLog = mongoose.models.PickerActionLog || mongoose.model<IPickerActionLog>('PickerActionLog', PickerActionLogSchema);

// ─── Picker Training Video ─────────────────────────────────────────────────────

export interface IPickerTrainingVideo extends Document {
  videoId: string;
  title: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  order: number;
  warehouseKey?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PickerTrainingVideoSchema = new Schema<IPickerTrainingVideo>(
  { videoId: { type: String, required: true, unique: true, index: true }, title: { type: String, required: true }, description: { type: String }, url: { type: String, required: true }, thumbnailUrl: { type: String }, durationSeconds: { type: Number }, order: { type: Number, default: 0, index: true }, warehouseKey: { type: String }, isActive: { type: Boolean, default: true, index: true } },
  { timestamps: true, collection: 'picker_training_videos' },
);

export const PickerTrainingVideo = mongoose.models.PickerTrainingVideo || mongoose.model<IPickerTrainingVideo>('PickerTrainingVideo', PickerTrainingVideoSchema);

// ─── Picker Issue (device / app / shift reports) ──────────────────────────────

export const PICKER_ISSUE_TYPES = ['device', 'app', 'shift', 'payout', 'other'] as const;
export type PickerIssueType = (typeof PICKER_ISSUE_TYPES)[number];

export interface IPickerIssue extends Document {
  userId: mongoose.Types.ObjectId;
  type: PickerIssueType;
  reason: string;
  description?: string;
  deviceId?: string;
  status: 'open' | 'in_progress' | 'resolved';
  ticketId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PickerIssueSchema = new Schema<IPickerIssue>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'PickerUser', required: true, index: true },
    type: { type: String, enum: PICKER_ISSUE_TYPES, default: 'device' },
    reason: { type: String, required: true },
    description: { type: String, maxlength: 1000 },
    deviceId: { type: String },
    status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open', index: true },
    ticketId: { type: String },
  },
  { timestamps: true, collection: 'picker_issues' },
);
PickerIssueSchema.index({ userId: 1, createdAt: -1 });

export const PickerIssue = mongoose.models.PickerIssue || mongoose.model<IPickerIssue>('PickerIssue', PickerIssueSchema);
