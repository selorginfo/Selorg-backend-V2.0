import { CustomerUser } from '../auth/auth.model';

export function findProfileById(id: string) {
  return CustomerUser.findById(id).select('-passwordHash').lean();
}

export function findPhoneStateById(id: string) {
  return CustomerUser.findById(id).select('phoneNumber phoneVerified').lean();
}

export function findCheckoutContactById(id: string) {
  return CustomerUser.findById(id).select('savedCheckoutContact').lean();
}

export function findById(id: string) {
  return CustomerUser.findById(id);
}

export interface ProfileUpdateOps {
  $set?: Record<string, unknown>;
  $unset?: Record<string, 1>;
}

export function updateProfile(id: string, ops: ProfileUpdateOps) {
  return CustomerUser.findByIdAndUpdate(id, ops, { new: true }).select('-passwordHash').lean();
}
