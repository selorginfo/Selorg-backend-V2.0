import mongoose, { Document, Schema } from 'mongoose';
import {
  FULFILLMENT_STAGES,
  EXCEPTION_REASONS,
  type FulfillmentStage,
  type ExceptionReason,
} from './order-lifecycle';

/**
 * Schema-only port (faithful field-for-field), following the products/categories precedent:
 * this model exists so coupons.service.ts (isFirstOrderOnly / targetSegment checks) and the
 * future orders module can both reference it. Order business logic (create/checkout/status
 * transitions, orderService.js ~1719 lines) is NOT ported here — deferred to a dedicated
 * orders-module session.
 */

export type OrderStatus = 'pending' | 'confirmed' | 'getting-packed' | 'on-the-way' | 'arrived' | 'delivered' | 'cancelled';

/**
 * Last-mile stage of the assigned rider, tracked alongside `status`. The rider app's
 * `accepted`/`picked_up` states have no equivalent in the customer-facing `status` enum,
 * and a rider cancellation returns the order to the hub rather than cancelling it.
 */
export type OrderRiderStage = 'offered' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';

export const ORDER_RIDER_STAGES: readonly OrderRiderStage[] = ['offered', 'accepted', 'picked_up', 'delivered', 'cancelled'];

export type { FulfillmentStage, ExceptionReason };

/** Reason ids sent by `CancelOrderSheet`. Stored enumerated so ops can report on them. */
export const RIDER_CANCEL_REASONS = ['unreachable', 'refused', 'address', 'asked', 'vehicle', 'other'] as const;
export type RiderCancelReason = (typeof RIDER_CANCEL_REASONS)[number];

/** Reason ids sent by `BulkExceptionSheet` — deliberately a shorter list than the standard one. */
export const BULK_EXCEPTION_REASONS = ['unreachable', 'refused', 'address', 'other'] as const;
export type BulkExceptionReason = (typeof BULK_EXCEPTION_REASONS)[number];

const timelineEventSchema = new Schema(
  {
    // Rider stages are appended here alongside customer statuses so a single feed shows the
    // whole lifecycle; `status` on the order itself keeps the original customer-facing enum.
    status: {
      type: String,
      enum: [
        'pending', 'confirmed', 'getting-packed', 'on-the-way', 'arrived', 'delivered', 'cancelled',
        'accepted', 'picked_up', 'rider_cancelled', 'delivery_failed',
        'picker_accepted', 'packed_in_rack', 'waiting_for_picker', 'waiting_for_rider',
        'rider_accepted', 'rider_picked', 'exception',
      ],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    actor: { type: String, default: '' },
    userId: { type: String, default: '' },
  },
  { _id: false },
);

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'CustomerProduct', required: true },
    productName: { type: String, default: '' },
    variantId: { type: String, default: '' },
    variantSize: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    hsnCode: { type: String, default: '' },
    gstRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    image: { type: String, default: '' },
    itemStatus: { type: String, enum: ['picked', 'not_found', 'damaged', 'substituted', 'delivered', 'pending'], default: 'pending' },
    substituteProductId: { type: Schema.Types.ObjectId, ref: 'CustomerProduct' },
    substituteProductName: { type: String, default: '' },
  },
  { _id: true },
);

export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId;
  orderNumber: string;
  items: Array<Record<string, unknown>>;
  status: OrderStatus;
  /** Ops-canonical lifecycle. Customer `status` is derived for app compatibility. */
  fulfillmentStage: FulfillmentStage;
  exceptionReason?: ExceptionReason | null;
  exceptionNote?: string;
  timeline: Array<Record<string, unknown>>;
  cancellationReason: string;
  addressId?: mongoose.Types.ObjectId;
  deliveryAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
  };
  deliveryNotes: string;
  customerName: string;
  customerPhone: string;
  deliveryMode?: 'express' | 'scheduled';
  deliverySlotId?: string;
  deliverySlotLabel?: string;
  scheduledWindowStart?: Date | null;
  scheduledWindowEnd?: Date | null;
  paymentMethodId: string;
  paymentMethod: {
    methodType: 'card' | 'upi' | 'cash' | 'wallet' | 'digital';
    last4?: string;
    instrument: string;
    displayLabel: string;
    paymentMode: string;
  };
  paymentStatus: 'paid' | 'cod_pending' | 'pending' | 'failed';
  itemTotal: number;
  adjustedTotal?: number;
  totalTax: number;
  handlingCharge: number;
  deliveryFee: number;
  deliveryTip: number;
  discount: number;
  walletDeduction: number;
  onlineAmountDue: number;
  walletRefundedAt: Date | null;
  totalBill: number;
  /** Server pricing frozen at placement. Compared again at payment confirmation. */
  pricingLock?: unknown;
  pricingSnapshot: unknown;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  deliveryOtp?: string;
  otpVerified: boolean;
  otpAttempts: number;
  refundId?: mongoose.Types.ObjectId;
  refundStatus: 'none' | 'pending' | 'approved' | 'rejected' | 'processed';
  refundAmount: number;
  supportTicketId?: mongoose.Types.ObjectId;
  storeId?: mongoose.Types.ObjectId;
  riderId: string | null;
  /**
   * The `PickerUser` holding this order. `riderId` remains the legacy free-string field used by
   * the ops dashboard; `pickerId` is the single indexed relation the rider app queries by.
   */
  pickerId?: mongoose.Types.ObjectId | null;
  /** HSD/HHD operator (`hhd_users`) currently packing this order — distinct from rider `pickerId`. */
  hhdUserId?: mongoose.Types.ObjectId | null;
  /** HSD device / session / picker shift that packed this order. */
  hsdDeviceId?: string | null;
  hsdSessionId?: string | null;
  pickerShiftId?: string | null;
  pickerAcceptedAt?: Date | null;
  bagScannedAt?: Date | null;
  rackedAt?: Date | null;
  riderStage?: OrderRiderStage | null;
  offerHubKey?: string | null;
  /** Rider this offer is reserved for until `offerExpiresAt`. Accept is still required. */
  offeredRiderId?: string | null;
  offerExpiresAt?: Date | null;
  assignedAt?: Date | null;
  acceptedAt?: Date | null;
  pickedUpAt?: Date | null;
  riderPayout: number;
  riderEarningBreakdown?: { base?: number; distance?: number; incentive?: number };
  /** Container-stall attribution — set when the order originated from a stall conversion. */
  stallAttribution?: {
    stallId?: string;
    employeeId?: string;
    conversionId?: string;
    areaId?: string;
    attributedAt?: Date;
  } | null;
  dispatchBay?: string;
  bagCode?: string;
  distanceKm?: number;
  etaMinutes?: number;
  isPriority: boolean;
  slaDeadline?: Date | null;
  deliveryType: 'standard' | 'bulk';
  bulkBatchId?: string | null;
  /** Admin B2C bulk-order workflow. Present only when deliveryType is bulk. */
  adminFulfillment?: {
    stage?: number;
    paymentLabel?: string;
    slot?: string;
    contactEmail?: string;
    displayName?: string;
    pickerName?: string;
    riderName?: string;
    addressText?: string;
  };
  podPhotoId?: mongoose.Types.ObjectId | null;
  riderCancellationReason?: RiderCancelReason | BulkExceptionReason | null;
  riderCancellationNote?: string;
  riderCancelledAt?: Date | null;
  riderReassignmentCount: number;
  codCollectedAmount?: number | null;
  deliveryFailedAt?: Date | null;
  ratingScore?: number;
  ratingComment: string;
  fulfillmentReleased: boolean;
  cartRestoredAt: Date | null;
  checkoutCouponCode: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'CustomerUser', required: true },
    orderNumber: { type: String, required: true, unique: true },
    items: [orderItemSchema],
    status: { type: String, enum: ['pending', 'confirmed', 'getting-packed', 'on-the-way', 'arrived', 'delivered', 'cancelled'], default: 'pending' },
    fulfillmentStage: {
      type: String,
      enum: [...FULFILLMENT_STAGES],
      default: 'pending',
      index: true,
    },
    exceptionReason: { type: String, enum: [...EXCEPTION_REASONS, null], default: null },
    exceptionNote: { type: String, default: '' },
    timeline: [timelineEventSchema],
    cancellationReason: { type: String, default: '' },
    addressId: { type: Schema.Types.ObjectId, ref: 'CustomerAddress' },
    deliveryAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String,
      latitude: Number,
      longitude: Number,
    },
    deliveryNotes: { type: String, default: '' },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    deliveryMode: { type: String, enum: ['express', 'scheduled'], default: 'express' },
    deliverySlotId: { type: String, default: '' },
    deliverySlotLabel: { type: String, default: '' },
    scheduledWindowStart: { type: Date, default: null },
    scheduledWindowEnd: { type: Date, default: null },
    paymentMethodId: { type: String, default: '' },
    paymentMethod: {
      methodType: { type: String, enum: ['card', 'upi', 'cash', 'wallet', 'digital'], default: 'cash' },
      last4: String,
      instrument: { type: String, default: '' },
      displayLabel: { type: String, default: '' },
      paymentMode: { type: String, default: '' },
    },
    paymentStatus: { type: String, enum: ['paid', 'cod_pending', 'pending', 'failed'], default: 'pending' },
    itemTotal: { type: Number, required: true, default: 0 },
    adjustedTotal: { type: Number },
    totalTax: { type: Number, default: 0 },
    handlingCharge: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    deliveryTip: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    walletDeduction: { type: Number, default: 0 },
    onlineAmountDue: { type: Number, default: 0 },
    walletRefundedAt: { type: Date, default: null },
    totalBill: { type: Number, required: true, default: 0 },
    pricingLock: { type: Schema.Types.Mixed, default: null },
    pricingSnapshot: { type: Schema.Types.Mixed, default: null },
    estimatedDelivery: { type: Date },
    deliveredAt: { type: Date },
    deliveryOtp: { type: String },
    otpVerified: { type: Boolean, default: false },
    otpAttempts: { type: Number, default: 0 },
    refundId: { type: Schema.Types.ObjectId, ref: 'RefundRequest' },
    refundStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected', 'processed'], default: 'none' },
    refundAmount: { type: Number, default: 0 },
    supportTicketId: { type: Schema.Types.ObjectId, ref: 'AdminSupportTicket' },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store' },
    riderId: { type: String, default: null, index: true },
    pickerId: { type: Schema.Types.ObjectId, ref: 'PickerUser', default: null, index: true },
    hhdUserId: { type: Schema.Types.ObjectId, ref: 'HHDUser', default: null, index: true },
    hsdDeviceId: { type: String, default: null, index: true },
    hsdSessionId: { type: String, default: null },
    pickerShiftId: { type: String, default: null },
    pickerAcceptedAt: { type: Date, default: null },
    bagScannedAt: { type: Date, default: null },
    rackedAt: { type: Date, default: null },
    riderStage: { type: String, enum: [...ORDER_RIDER_STAGES, null], default: null, index: true },
    offerHubKey: { type: String, default: null },
    offeredRiderId: { type: String, default: null, index: true },
    offerExpiresAt: { type: Date, default: null },
    assignedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    riderPayout: { type: Number, default: 0 },
    riderEarningBreakdown: { base: Number, distance: Number, incentive: Number },
    stallAttribution: {
      stallId: { type: String },
      employeeId: { type: String },
      conversionId: { type: String },
      areaId: { type: String },
      attributedAt: { type: Date },
    },
    dispatchBay: { type: String },
    bagCode: { type: String },
    distanceKm: { type: Number },
    etaMinutes: { type: Number },
    isPriority: { type: Boolean, default: false },
    slaDeadline: { type: Date, default: null },
    deliveryType: { type: String, enum: ['standard', 'bulk'], default: 'standard', index: true },
    bulkBatchId: { type: String, default: null, index: true },
    /**
     * Admin lifecycle for B2C bulk orders (`deliveryType: 'bulk'`).
     * Customer-facing `status` stays the existing order enum; this block holds the
     * dashboard stage, payment label and assignment names the Delivery module reads.
     */
    adminFulfillment: {
      stage: { type: Number, default: 0 },
      paymentLabel: { type: String, default: 'Pending' },
      slot: { type: String, default: '' },
      contactEmail: { type: String, default: '' },
      displayName: { type: String, default: '' },
      pickerName: { type: String, default: '' },
      riderName: { type: String, default: '' },
      addressText: { type: String, default: '' },
    },
    podPhotoId: { type: Schema.Types.ObjectId, ref: 'PickerPodPhoto', default: null },
    riderCancellationReason: { type: String, default: null },
    riderCancellationNote: { type: String, default: '' },
    riderCancelledAt: { type: Date, default: null },
    riderReassignmentCount: { type: Number, default: 0 },
    codCollectedAmount: { type: Number, default: null },
    deliveryFailedAt: { type: Date, default: null },
    ratingScore: { type: Number, min: 1, max: 5 },
    ratingComment: { type: String, default: '' },
    fulfillmentReleased: { type: Boolean, default: false },
    cartRestoredAt: { type: Date, default: null },
    checkoutCouponCode: { type: String, default: '' },
  },
  { timestamps: true },
);

orderSchema.pre('save', function rejectDeliveredWithoutOtp(next) {
  const delivered = this.status === 'delivered' || this.fulfillmentStage === 'delivered';
  if (delivered && this.otpVerified !== true) {
    const err = new Error('Delivery OTP must be verified before the order can be stored as delivered') as Error & {
      statusCode?: number;
      code?: string;
    };
    err.statusCode = 409;
    err.code = 'OTP_REQUIRED';
    next(err);
    return;
  }
  next();
});

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, status: 1 });
orderSchema.index({ riderId: 1, status: 1 });
// Rider-app access paths: "my active order", "my completed deliveries", and the hub offer pool.
orderSchema.index({ pickerId: 1, riderStage: 1 });
orderSchema.index({ pickerId: 1, deliveredAt: -1 });
orderSchema.index({ offerHubKey: 1, riderStage: 1, status: 1 });
orderSchema.index({ bagCode: 1 });
orderSchema.index({ fulfillmentStage: 1, createdAt: -1 });
orderSchema.index({ fulfillmentStage: 1, offerHubKey: 1 });

export const Order =
  (mongoose.models.CustomerOrder as mongoose.Model<IOrder>) || mongoose.model<IOrder>('CustomerOrder', orderSchema, 'customer_orders');
