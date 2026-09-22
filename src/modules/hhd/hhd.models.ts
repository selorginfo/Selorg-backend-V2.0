import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  ORDER_STATUS,
  ORDER_PRIORITY,
  ZONE,
  ITEM_STATUS,
  BAG_STATUS,
  TASK_STATUS,
  TASK_PRIORITY,
  PICK_ISSUE_TYPE,
  INVENTORY_STATUS,
  USER_ROLE,
  OrderStatus,
  OrderPriority,
  Zone,
  ItemStatus,
  BagStatus,
  TaskStatus,
  TaskPriority,
  PickIssueType,
  InventoryStatus,
  UserRole,
} from './hhd.constants';

// ─── HHD User ─────────────────────────────────────────────────────────────────

export interface IHHDUserAccuracyStats {
  successfulUnits: number;
  misScans: number;
  rescans: number;
  substitutions: number;
  shortPicks: number;
}

export interface IHHDUserShift {
  startTime: string;
  endTime: string;
  breakScheduled?: string;
  dailyTarget?: number;
  shiftTarget?: number;
}

export interface IHHDUser extends Document {
  mobile?: string;
  name?: string;
  email?: string;
  warehouse?: string;
  darkstore?: string;
  role: UserRole;
  password?: string;
  isActive: boolean;
  deviceId?: string;
  lastLogin?: Date;
  shift?: IHHDUserShift;
  accuracyStats: IHHDUserAccuracyStats;
  createdAt: Date;
  updatedAt: Date;
  generateOTP(): string;
  matchPassword(enteredPassword: string): Promise<boolean>;
  getSignedJwtToken(): string;
}

const HHDUserSchema = new Schema<IHHDUser>(
  {
    mobile: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      match: [/^[6-9]\d{9}$/, 'Please add a valid 10-digit mobile number'],
      index: true,
    },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true, index: true },
    warehouse: { type: String, trim: true },
    darkstore: { type: String, trim: true },
    role: {
      type: String,
      enum: Object.values(USER_ROLE),
      default: USER_ROLE.PICKER,
    },
    password: { type: String, select: false },
    isActive: { type: Boolean, default: true },
    deviceId: { type: String },
    lastLogin: { type: Date },
    shift: {
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '17:00' },
      breakScheduled: { type: String, default: '12:00-12:30' },
      dailyTarget: { type: Number, default: 50 },
      shiftTarget: { type: Number, default: 25 },
    },
    accuracyStats: {
      successfulUnits: { type: Number, default: 0 },
      misScans: { type: Number, default: 0 },
      rescans: { type: Number, default: 0 },
      substitutions: { type: Number, default: 0 },
      shortPicks: { type: Number, default: 0 },
    },
  },
  { timestamps: true, collection: 'hhd_users' },
);

HHDUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

HHDUserSchema.methods.generateOTP = function (): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

HHDUserSchema.methods.matchPassword = async function (enteredPassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

HHDUserSchema.methods.getSignedJwtToken = function (): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign({ id: this._id }, secret, {
    expiresIn: (process.env.JWT_EXPIRE || '7d') as any,
  });
};

export const HHDUser =
  (mongoose.models.HHDUser as mongoose.Model<IHHDUser>) ||
  mongoose.model<IHHDUser>('HHDUser', HHDUserSchema);

// ─── HHD Order ────────────────────────────────────────────────────────────────

export interface IHHDOrder extends Document {
  orderId: string;
  userId?: mongoose.Types.ObjectId | null;
  /** Darkstore / hub key this ticket belongs to (`DS-Adyar-01`). */
  hubKey?: string | null;
  zone: Zone;
  priority: OrderPriority;
  status: OrderStatus;
  itemCount: number;
  /** Distinct pick lines */
  lineCount?: number;
  /** Total units across all lines */
  unitCount?: number;
  /** Target pick duration in minutes (legacy) */
  targetTime?: number;
  /** Pick duration in seconds */
  pickTime?: number;
  pickTimeSeconds?: number;
  bagId?: string;
  rackLocation?: string;
  riderName?: string;
  riderId?: string;
  assignedAt?: Date;
  slaDueAt?: Date;
  recommendedBagSize?: string;
  targetRackCode?: string;
  targetRiderName?: string;
  targetRiderId?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HHDOrderSchema = new Schema<IHHDOrder>(
  {
    orderId: { type: String, required: [true, 'Please add an order ID'], unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'HHDUser', required: false, default: null, index: true },
    hubKey: { type: String, default: null, index: true },
    zone: { type: String, enum: Object.values(ZONE), required: true },
    priority: {
      type: String,
      enum: Object.values(ORDER_PRIORITY),
      default: ORDER_PRIORITY.HIGH,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index: true,
    },
    itemCount: { type: Number, required: true, min: 1 },
    lineCount: { type: Number, min: 0 },
    unitCount: { type: Number, min: 0 },
    targetTime: { type: Number, min: 0 },
    pickTime: { type: Number, min: 0 },
    pickTimeSeconds: { type: Number, min: 0 },
    bagId: { type: String },
    rackLocation: { type: String },
    riderName: { type: String },
    riderId: { type: String },
    assignedAt: { type: Date },
    slaDueAt: { type: Date },
    recommendedBagSize: { type: String },
    targetRackCode: { type: String },
    targetRiderName: { type: String },
    targetRiderId: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true, collection: 'hhd_orders' },
);

HHDOrderSchema.index({ userId: 1, status: 1 });
HHDOrderSchema.index({ status: 1, createdAt: -1 });
HHDOrderSchema.index({ hubKey: 1, status: 1, userId: 1 });

export const HHDOrder =
  (mongoose.models.HHDOrder as mongoose.Model<IHHDOrder>) ||
  mongoose.model<IHHDOrder>('HHDOrder', HHDOrderSchema);

// ─── HHD Item ─────────────────────────────────────────────────────────────────

export interface IHHDItem extends Document {
  orderId: string;
  itemCode: string;
  name: string;
  quantity: number;
  scannedQuantity: number;
  category?: 'Fresh' | 'Snacks' | 'Grocery' | 'Care';
  status: ItemStatus;
  substituteItemCode?: string | null;
  scannedAt?: Date;
  /** Bin code (e.g. A3-04) */
  location?: string;
  /** Crate / tote barcode scanned by the device */
  crate?: string;
  packSize?: string;
  mrp?: number;
  expiryDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HHDItemSchema = new Schema<IHHDItem>(
  {
    orderId: { type: String, required: true, index: true },
    itemCode: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    scannedQuantity: { type: Number, min: 0, default: 0 },
    category: { type: String, enum: ['Fresh', 'Snacks', 'Grocery', 'Care'], index: true },
    status: {
      type: String,
      enum: Object.values(ITEM_STATUS),
      default: ITEM_STATUS.PENDING,
      index: true,
    },
    substituteItemCode: { type: String, default: null },
    scannedAt: { type: Date },
    location: { type: String },
    crate: { type: String, index: true },
    packSize: { type: String },
    mrp: { type: Number, min: 0 },
    expiryDate: { type: Date },
    notes: { type: String, maxlength: 500 },
  },
  { timestamps: true, collection: 'hhd_items' },
);

HHDItemSchema.index({ orderId: 1, status: 1 });
HHDItemSchema.index({ itemCode: 1 });
HHDItemSchema.index({ orderId: 1, crate: 1 });

export const HHDItem =
  (mongoose.models.HHDItem as mongoose.Model<IHHDItem>) ||
  mongoose.model<IHHDItem>('HHDItem', HHDItemSchema);

// ─── HHD Bag ──────────────────────────────────────────────────────────────────

export interface IHHDBag extends Document {
  /** Full bag QR string (e.g. BAG-25-M-4471) */
  bagId: string;
  orderId: string;
  userId: mongoose.Types.ObjectId;
  status: BagStatus;
  size?: string;
  sizeLabel?: string;
  litres?: number;
  scannedAt: Date;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HHDBagSchema = new Schema<IHHDBag>(
  {
    bagId: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'HHDUser', required: true },
    status: {
      type: String,
      enum: Object.values(BAG_STATUS),
      default: BAG_STATUS.SCANNED,
      index: true,
    },
    size: { type: String, index: true },
    sizeLabel: { type: String },
    litres: { type: Number, min: 0 },
    scannedAt: { type: Date, default: Date.now },
    photoUrl: { type: String },
  },
  { timestamps: true, collection: 'hhd_bags' },
);

HHDBagSchema.index({ orderId: 1, status: 1 });

export const HHDBag =
  (mongoose.models.HHDBag as mongoose.Model<IHHDBag>) ||
  mongoose.model<IHHDBag>('HHDBag', HHDBagSchema);

// ─── HHD Task ─────────────────────────────────────────────────────────────────

export interface IHHDTask extends Document {
  title: string;
  description?: string;
  userId: mongoose.Types.ObjectId;
  orderId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HHDTaskSchema = new Schema<IHHDTask>(
  {
    title: { type: String, required: [true, 'Please add a task title'] },
    description: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: 'HHDUser', required: true, index: true },
    orderId: { type: String },
    status: {
      type: String,
      enum: Object.values(TASK_STATUS),
      default: TASK_STATUS.PENDING,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(TASK_PRIORITY),
      default: TASK_PRIORITY.MEDIUM,
    },
    dueDate: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true, collection: 'hhd_tasks' },
);

HHDTaskSchema.index({ userId: 1, status: 1 });
HHDTaskSchema.index({ status: 1, priority: 1 });

export const HHDTask =
  (mongoose.models.HHDTask as mongoose.Model<IHHDTask>) ||
  mongoose.model<IHHDTask>('HHDTask', HHDTaskSchema);

// ─── HHD Rack ─────────────────────────────────────────────────────────────────

export interface IHHDRack extends Document {
  rackCode: string;
  rackIdentifier: string;
  slotNumber: number;
  location: string;
  zone: string;
  isAvailable: boolean;
  currentOrderId?: string;
  riderName?: string;
  riderId?: string;
  assignedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HHDRackSchema = new Schema<IHHDRack>(
  {
    rackCode: { type: String, required: true, unique: true, index: true },
    rackIdentifier: { type: String, required: true, index: true },
    slotNumber: { type: Number, required: true },
    location: { type: String, required: true },
    zone: { type: String, required: true, index: true },
    isAvailable: { type: Boolean, default: true, index: true },
    currentOrderId: { type: String },
    riderName: { type: String },
    riderId: { type: String },
    assignedAt: { type: Date },
  },
  { timestamps: true, collection: 'hhd_racks' },
);

HHDRackSchema.index({ zone: 1, isAvailable: 1 });
HHDRackSchema.index({ rackIdentifier: 1, slotNumber: 1 }, { unique: true });

export const HHDRack =
  (mongoose.models.HHDRack as mongoose.Model<IHHDRack>) ||
  mongoose.model<IHHDRack>('HHDRack', HHDRackSchema);

// ─── HHD Photo ────────────────────────────────────────────────────────────────

export interface IHHDPhoto extends Document {
  orderId: string;
  bagId: string;
  userId: mongoose.Types.ObjectId;
  photoUrl: string;
  photoKey?: string;
  verified: boolean;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HHDPhotoSchema = new Schema<IHHDPhoto>(
  {
    orderId: { type: String, required: true, index: true },
    bagId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'HHDUser', required: true },
    photoUrl: { type: String, required: true },
    photoKey: { type: String },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
  },
  { timestamps: true, collection: 'hhd_photos' },
);

HHDPhotoSchema.index({ orderId: 1, bagId: 1 });

export const HHDPhoto =
  (mongoose.models.HHDPhoto as mongoose.Model<IHHDPhoto>) ||
  mongoose.model<IHHDPhoto>('HHDPhoto', HHDPhotoSchema);

// ─── HHD Scanned Item ─────────────────────────────────────────────────────────

export interface IHHDScannedItem extends Document {
  barcodeData: string;
  barcodeType: 'qr' | 'ean13' | 'ean8' | 'code128' | 'code39' | 'upc' | 'other';
  orderId?: string;
  userId?: string;
  deviceId?: string;
  metadata: Record<string, unknown>;
  scannedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HHDScannedItemSchema = new Schema<IHHDScannedItem>(
  {
    barcodeData: { type: String, required: true, index: true },
    barcodeType: {
      type: String,
      required: true,
      enum: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc', 'other'],
      default: 'other',
    },
    orderId: { type: String, index: true },
    userId: { type: String, index: true },
    deviceId: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    scannedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'hhd_scanned_items' },
);

HHDScannedItemSchema.index({ barcodeData: 1, scannedAt: -1 });
HHDScannedItemSchema.index({ orderId: 1, scannedAt: -1 });
HHDScannedItemSchema.index({ userId: 1, scannedAt: -1 });
HHDScannedItemSchema.index({ deviceId: 1, scannedAt: -1 });

export const HHDScannedItem =
  (mongoose.models.HHDScannedItem as mongoose.Model<IHHDScannedItem>) ||
  mongoose.model<IHHDScannedItem>('HHDScannedItem', HHDScannedItemSchema);

// ─── HHD Inventory ────────────────────────────────────────────────────────────

export interface IHHDInventory extends Document {
  sku: string;
  binId: string;
  quantity: number;
  status: InventoryStatus;
  expiryDate?: Date;
  batchNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HHDInventorySchema = new Schema<IHHDInventory>(
  {
    sku: { type: String, required: [true, 'Please add a SKU'], index: true },
    binId: { type: String, required: [true, 'Please add a bin ID'], index: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: Object.values(INVENTORY_STATUS),
      default: INVENTORY_STATUS.AVAILABLE,
      index: true,
    },
    expiryDate: { type: Date },
    batchNumber: { type: String },
  },
  { timestamps: true, collection: 'hhd_inventory' },
);

HHDInventorySchema.index({ sku: 1, binId: 1 }, { unique: true });
HHDInventorySchema.index({ sku: 1, status: 1 });
HHDInventorySchema.index({ binId: 1, status: 1 });

export const HHDInventory =
  (mongoose.models.HHDInventory as mongoose.Model<IHHDInventory>) ||
  mongoose.model<IHHDInventory>('HHDInventory', HHDInventorySchema);

// ─── HHD OTP ──────────────────────────────────────────────────────────────────

export interface IHHDOTP extends Document {
  /** Generic identity key — mobile digits or lowercased email */
  identifier: string;
  channel: 'sms' | 'email';
  /** @deprecated kept for backward-compatible reads of legacy rows */
  mobile?: string;
  otp: string;
  expiresAt: Date;
  isUsed: boolean;
  attemptCount: number;
  lockedUntil?: Date;
  lastSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HHDOTPSchema = new Schema<IHHDOTP>(
  {
    identifier: { type: String, required: true, index: true },
    channel: { type: String, enum: ['sms', 'email'], default: 'sms', index: true },
    mobile: { type: String, index: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    isUsed: { type: Boolean, default: false },
    attemptCount: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    lastSentAt: { type: Date },
  },
  { timestamps: true, collection: 'hhd_otps' },
);

HHDOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const HHDOTP =
  (mongoose.models.HHDOTP as mongoose.Model<IHHDOTP>) ||
  mongoose.model<IHHDOTP>('HHDOTP', HHDOTPSchema);

// ─── HHD Pick Issue ───────────────────────────────────────────────────────────

export interface IHHDPickIssue extends Document {
  orderId: string;
  sku: string;
  binId: string;
  issueType: PickIssueType;
  reportedBy: mongoose.Types.ObjectId;
  deviceId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HHDPickIssueSchema = new Schema<IHHDPickIssue>(
  {
    orderId: { type: String, required: [true, 'Please add an order ID'], index: true },
    sku: { type: String, required: [true, 'Please add a SKU'], index: true },
    binId: { type: String, required: [true, 'Please add a bin ID'], index: true },
    issueType: {
      type: String,
      enum: Object.values(PICK_ISSUE_TYPE),
      required: [true, 'Please add an issue type'],
      index: true,
    },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'HHDUser', required: true, index: true },
    deviceId: { type: String, index: true },
    notes: { type: String },
  },
  { timestamps: true, collection: 'hhd_pick_issues' },
);

HHDPickIssueSchema.index({ orderId: 1, sku: 1 });
HHDPickIssueSchema.index({ issueType: 1, createdAt: -1 });
HHDPickIssueSchema.index({ binId: 1 });

export const HHDPickIssue =
  (mongoose.models.HHDPickIssue as mongoose.Model<IHHDPickIssue>) ||
  mongoose.model<IHHDPickIssue>('HHDPickIssue', HHDPickIssueSchema);

// ─── HHD Completed Order ──────────────────────────────────────────────────────

export interface IHHDCompletedOrder extends Document {
  orderId: string;
  userId: mongoose.Types.ObjectId;
  zone: Zone;
  status: OrderStatus;
  itemCount: number;
  lineCount?: number;
  unitCount?: number;
  targetTime?: number;
  pickTime?: number;
  pickTimeSeconds?: number;
  bagId?: string;
  rackLocation?: string;
  riderName?: string;
  riderId?: string;
  assignedAt?: Date;
  slaDueAt?: Date;
  recommendedBagSize?: string;
  startedAt?: Date;
  completedAt?: Date;
  rackAssignedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HHDCompletedOrderSchema = new Schema<IHHDCompletedOrder>(
  {
    orderId: { type: String, required: [true, 'Please add an order ID'], unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'HHDUser', required: true, index: true },
    zone: { type: String, enum: Object.values(ZONE), required: true },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.COMPLETED,
      index: true,
    },
    itemCount: { type: Number, required: true, min: 1 },
    lineCount: { type: Number, min: 0 },
    unitCount: { type: Number, min: 0 },
    targetTime: { type: Number, min: 0 },
    pickTime: { type: Number, min: 0 },
    pickTimeSeconds: { type: Number, min: 0 },
    bagId: { type: String },
    rackLocation: { type: String },
    riderName: { type: String },
    riderId: { type: String },
    assignedAt: { type: Date },
    slaDueAt: { type: Date },
    recommendedBagSize: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    rackAssignedAt: { type: Date },
  },
  { timestamps: true, collection: 'hhd_completed_orders' },
);

HHDCompletedOrderSchema.index({ userId: 1, status: 1 });
HHDCompletedOrderSchema.index({ status: 1, createdAt: -1 });
HHDCompletedOrderSchema.index({ orderId: 1 });

export const HHDCompletedOrder =
  (mongoose.models.HHDCompletedOrder as mongoose.Model<IHHDCompletedOrder>) ||
  mongoose.model<IHHDCompletedOrder>('HHDCompletedOrder', HHDCompletedOrderSchema);

// ─── HHD Refresh Token ────────────────────────────────────────────────────────

export interface IHHDRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  deviceId?: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HHDRefreshTokenSchema = new Schema<IHHDRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'HHDUser', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    deviceId: { type: String },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date },
    replacedBy: { type: String },
  },
  { timestamps: true, collection: 'hhd_refresh_tokens' },
);

HHDRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const HHDRefreshToken =
  (mongoose.models.HHDRefreshToken as mongoose.Model<IHHDRefreshToken>) ||
  mongoose.model<IHHDRefreshToken>('HHDRefreshToken', HHDRefreshTokenSchema);

// ─── Assign Order (typed wrapper over legacy assignorders collection) ─────────

export interface IHHDAssignOrder extends Document {
  orderId: string;
  userId?: mongoose.Types.ObjectId;
  status: string;
  completedAt?: Date;
  scannedBy?: string;
  scannedAt?: Date;
  hub?: string;
  bagId?: string;
  packageId?: string;
  customerOrderId?: mongoose.Types.ObjectId;
  handedOver?: boolean;
  deviceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HHDAssignOrderSchema = new Schema<IHHDAssignOrder>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'HHDUser', index: true },
    status: { type: String, required: true, index: true },
    completedAt: { type: Date },
    scannedBy: { type: String },
    scannedAt: { type: Date },
    hub: { type: String },
    bagId: { type: String },
    packageId: { type: String },
    customerOrderId: { type: Schema.Types.ObjectId, ref: 'CustomerOrder', index: true },
    handedOver: { type: Boolean, default: false, index: true },
    deviceId: { type: String },
  },
  { timestamps: true, collection: 'assignorders' },
);

export const HHDAssignOrder =
  (mongoose.models.HHDAssignOrder as mongoose.Model<IHHDAssignOrder>) ||
  mongoose.model<IHHDAssignOrder>('HHDAssignOrder', HHDAssignOrderSchema);

