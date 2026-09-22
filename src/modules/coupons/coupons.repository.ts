import mongoose from 'mongoose';
import { CouponRedemption } from './coupon-redemption.model';
import { PricingCoupon } from './coupon.model';

export function findActiveWindowCoupons() {
  const now = new Date();
  return PricingCoupon.find({
    status: { $in: ['active', 'ACTIVE'] },
    isActive: { $ne: false },
    $and: [{ $or: [{ startDate: null }, { startDate: { $lte: now } }] }, { $or: [{ endDate: null }, { endDate: { $gte: now } }] }],
  })
    .sort({ priorityRank: 1 })
    .lean();
}

export function findByCode(code: string) {
  return PricingCoupon.findOne({ code: String(code || '').toUpperCase() }).lean();
}

/** Guests (and any caller without a resolvable customer id) have no redemption
 *  history, so return 0 rather than letting ObjectId casting throw. */
export function countUserRedemptions(couponId: mongoose.Types.ObjectId | string, userId: mongoose.Types.ObjectId | string) {
  const id = String(userId || '');
  if (!mongoose.Types.ObjectId.isValid(id)) return Promise.resolve(0);
  return CouponRedemption.countDocuments({ couponId, userId: new mongoose.Types.ObjectId(id) });
}

export function recordRedemption(payload: {
  couponId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  orderId: mongoose.Types.ObjectId | string;
  discountApplied: number;
}) {
  return CouponRedemption.create(payload);
}

export async function recordRedemptionInSession(
  payload: {
    couponId: mongoose.Types.ObjectId | string;
    userId: mongoose.Types.ObjectId | string;
    orderId: mongoose.Types.ObjectId | string;
    discountApplied: number;
  },
  session: mongoose.ClientSession,
) {
  await CouponRedemption.create([payload], { session });
}

export interface AdminCouponFilter {
  search?: string;
  isActive?: boolean;
}

export function adminList(filter: AdminCouponFilter, skip: number, limit: number) {
  const query: Record<string, unknown> = {};
  if (filter.isActive !== undefined) {
    query.isActive = filter.isActive;
    query.status = filter.isActive ? 'active' : { $ne: 'active' };
  }
  if (filter.search) {
    query.$or = [{ code: { $regex: filter.search, $options: 'i' } }, { description: { $regex: filter.search, $options: 'i' } }];
  }
  return Promise.all([
    PricingCoupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PricingCoupon.countDocuments(query),
  ]);
}

export function findById(id: string) {
  return PricingCoupon.findById(id).lean();
}

export function create(payload: Record<string, unknown>) {
  return PricingCoupon.create(payload);
}

export function updateById(id: string, payload: Record<string, unknown>) {
  return PricingCoupon.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
}

export function deleteById(id: string) {
  return PricingCoupon.findByIdAndDelete(id);
}

export async function stats() {
  const [total, active, expired] = await Promise.all([
    PricingCoupon.countDocuments(),
    PricingCoupon.countDocuments({ status: 'active', isActive: true }),
    PricingCoupon.countDocuments({ $or: [{ endDate: { $lt: new Date() } }, { validTo: { $lt: new Date() } }] }),
  ]);
  const totalRedemptions = await PricingCoupon.aggregate([{ $group: { _id: null, count: { $sum: '$usageCount' } } }]);
  return { total, active, expired, inactive: total - active, totalRedemptions: totalRedemptions[0]?.count || 0 };
}

/** Activate scheduled coupons whose startDate has arrived; expire coupons past endDate. Ported from legacy `couponStatusJob.js`. Not scheduled here — no cron/worker exists in this repo yet. */
export async function processCouponStatusUpdates(): Promise<{ activated: number; expired: number }> {
  const now = new Date();
  const activated = await PricingCoupon.updateMany(
    { status: { $in: ['scheduled', 'SCHEDULED'] }, startDate: { $lte: now } },
    { $set: { status: 'active', isActive: true } },
  );
  const expired = await PricingCoupon.updateMany(
    { status: { $in: ['active', 'ACTIVE'] }, endDate: { $ne: null, $lte: now } },
    { $set: { status: 'expired', isActive: false } },
  );
  return { activated: activated.modifiedCount, expired: expired.modifiedCount };
}
