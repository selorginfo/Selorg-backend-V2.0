import mongoose from 'mongoose';
import { Order, IOrder } from './order.model';

function orderFilter(orderId: string) {
  return mongoose.Types.ObjectId.isValid(orderId)
    ? { _id: orderId }
    : { orderNumber: orderId };
}

export function findById(orderId: string) {
  return Order.findOne(orderFilter(orderId));
}

export function findByIdLean(orderId: string) {
  return Order.findOne(orderFilter(orderId)).lean();
}

export function findOneForUser(orderId: string, userId: string | mongoose.Types.ObjectId) {
  return Order.findOne({ ...orderFilter(orderId), userId });
}

export function findOneForUserLean(orderId: string, userId: string | mongoose.Types.ObjectId) {
  return Order.findOne({ ...orderFilter(orderId), userId }).lean();
}

export function listForUser(userId: mongoose.Types.ObjectId, query: Record<string, unknown>, skip: number, limit: number) {
  return Order.find({ userId, ...query })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

export function countForUser(userId: mongoose.Types.ObjectId, query: Record<string, unknown>) {
  return Order.countDocuments({ userId, ...query });
}

export function countAll() {
  return Order.countDocuments();
}

export async function generateOrderNumber(): Promise<string> {
  const count = await Order.countDocuments();
  const prefix = 'ORD';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${String(count + 1).padStart(5, '0')}`;
}

export function create(payload: Record<string, unknown>[], session: mongoose.ClientSession) {
  return Order.create(payload as Partial<IOrder>[], { session });
}
