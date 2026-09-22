import mongoose from 'mongoose';
import { Cart, ICart } from './cart.model';

export function findByUser(userId: mongoose.Types.ObjectId) {
  return Cart.findOne({ userId });
}

export function findByUserLean(userId: mongoose.Types.ObjectId) {
  return Cart.findOne({ userId }).lean();
}

export function create(payload: { userId: mongoose.Types.ObjectId; items: Record<string, unknown>[] }) {
  return Cart.create(payload);
}

export function ensureExists(userId: mongoose.Types.ObjectId) {
  return Cart.findOneAndUpdate(userId ? { userId } : {}, { $setOnInsert: { items: [] } }, { upsert: true, new: true });
}

export function save(cart: ICart) {
  return cart.save();
}

export function setQuantityByItemId(userId: mongoose.Types.ObjectId, itemId: mongoose.Types.ObjectId, quantity: number) {
  return Cart.findOneAndUpdate(
    { userId, 'items._id': itemId },
    { $set: { 'items.$.quantity': quantity } },
    { new: true },
  ).lean();
}

export function pullItem(userId: mongoose.Types.ObjectId, itemId: mongoose.Types.ObjectId) {
  return Cart.findOneAndUpdate({ userId }, { $pull: { items: { _id: itemId } } }, { new: true }).lean();
}

export function clearItems(userId: mongoose.Types.ObjectId, session?: mongoose.ClientSession) {
  return Cart.findOneAndUpdate({ userId }, { $set: { items: [] } }, { upsert: true, session });
}

export function claimMergeKey(userId: mongoose.Types.ObjectId, key: string, maxKeys: number) {
  return Cart.findOneAndUpdate(
    { userId, appliedMergeKeys: { $ne: key } },
    { $push: { appliedMergeKeys: { $each: [key], $slice: -maxKeys } } },
    { new: true },
  );
}
