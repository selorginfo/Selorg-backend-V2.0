import mongoose, { Document, Schema } from 'mongoose';

export interface ICouponRedemption extends Document {
  couponId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  discountApplied: number;
  redeemedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const couponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    couponId: { type: Schema.Types.ObjectId, ref: 'PricingCoupon', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'CustomerUser', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'CustomerOrder', required: true },
    discountApplied: { type: Number, required: true },
    redeemedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

couponRedemptionSchema.index({ couponId: 1, userId: 1 });
couponRedemptionSchema.index({ orderId: 1 });

export const CouponRedemption =
  (mongoose.models.CouponRedemption as mongoose.Model<ICouponRedemption>) ||
  mongoose.model<ICouponRedemption>('CouponRedemption', couponRedemptionSchema, 'coupon_redemptions');
