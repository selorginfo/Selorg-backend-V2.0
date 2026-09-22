import mongoose from 'mongoose';
import { RefundRequest } from '../orders/refund-request.model';

export function findByCustomer(customerId: string, skip: number, limit: number) {
  const query = { customerId: String(customerId) };
  return Promise.all([
    RefundRequest.find(query).sort({ requestedAt: -1 }).skip(skip).limit(limit).lean(),
    RefundRequest.countDocuments(query),
  ]);
}

export function findByIdForCustomer(refundId: string) {
  if (!mongoose.Types.ObjectId.isValid(refundId)) return Promise.resolve(null);
  return RefundRequest.findById(refundId).lean();
}

export function findExistingActiveForOrder(orderId: string, customerId: string) {
  return RefundRequest.findOne({
    orderId: String(orderId),
    customerId: String(customerId),
    status: { $in: ['pending', 'approved', 'processed'] },
  });
}

export function createRefundRequest(doc: Record<string, unknown>) {
  return RefundRequest.create(doc);
}
