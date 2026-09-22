import mongoose from 'mongoose';
import { CustomerAddress } from './addresses.model';

export function listByUser(userId: mongoose.Types.ObjectId) {
  return CustomerAddress.find({ userId }).sort({ order: 1, createdAt: 1 }).lean();
}

export function findDefault(userId: mongoose.Types.ObjectId) {
  return CustomerAddress.findOne({ userId, isDefault: true }).lean();
}

export function findFirst(userId: mongoose.Types.ObjectId) {
  return CustomerAddress.findOne({ userId }).sort({ order: 1, createdAt: 1 }).lean();
}

export function findByLabel(userId: mongoose.Types.ObjectId, labelRegex: RegExp) {
  return CustomerAddress.findOne({ userId, label: { $regex: labelRegex } });
}

export function countByUser(userId: mongoose.Types.ObjectId) {
  return CustomerAddress.countDocuments({ userId });
}

export function create(payload: Record<string, unknown>) {
  return CustomerAddress.create(payload);
}

export function unsetOtherDefaults(userId: mongoose.Types.ObjectId, exceptId: unknown) {
  return CustomerAddress.updateMany({ userId, _id: { $ne: exceptId } }, { $set: { isDefault: false } });
}

export function unsetAllDefaults(userId: mongoose.Types.ObjectId) {
  return CustomerAddress.updateMany({ userId }, { $set: { isDefault: false } });
}

export function findOwned(id: string, userId: mongoose.Types.ObjectId) {
  return CustomerAddress.findOne({ _id: id, userId });
}

export function deleteOwned(id: string, userId: mongoose.Types.ObjectId) {
  return CustomerAddress.findOneAndDelete({ _id: id, userId });
}
