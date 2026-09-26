import crypto from 'crypto';
import mongoose from 'mongoose';
import { PickerDevice } from './picker.models';
import { DarkstoreDevice } from '../darkstore/darkstore.models';
import { DarkStore } from '../store/dark-store.model';

export function newCollectionOtp(): string {
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}

/** Store id, code, and any alias the picker or device might be tagged with. */
export async function expandStoreKeys(keys: Array<string | undefined | null>): Promise<string[]> {
  const raw = [...new Set(keys.map((k) => String(k || '').trim()).filter(Boolean))];
  if (!raw.length) return [];
  const ids = raw.filter((k) => /^[a-f0-9]{24}$/i.test(k));
  const codes = raw.filter((k) => !/^[a-f0-9]{24}$/i.test(k));
  const or: Record<string, unknown>[] = [];
  if (ids.length) or.push({ _id: { $in: ids } });
  if (codes.length) {
    or.push({ code: { $in: codes } });
    or.push({ code: { $in: codes.map((c) => c.toUpperCase()) } });
  }
  const stores = or.length ? await DarkStore.find({ $or: or }).select('code').lean() : [];
  const expanded = [...raw];
  for (const store of stores) {
    expanded.push(String(store._id), store.code || '');
  }
  return [...new Set(expanded.map((k) => k.trim()).filter(Boolean))];
}

export function pickerStoreKeys(user: { currentLocationId?: string | null; storeId?: unknown }): string[] {
  const keys = [user.currentLocationId, user.storeId ? String(user.storeId) : ''];
  return [...new Set(keys.map((k) => String(k || '').trim()).filter(Boolean))];
}

export async function ensurePickerDeviceOtp(deviceId: string): Promise<string> {
  const device = await PickerDevice.findOne({ deviceId });
  if (!device) return '';
  if (device.collectionOtp && /^\d{4}$/.test(device.collectionOtp)) return device.collectionOtp;
  device.collectionOtp = newCollectionOtp();
  device.collectionOtpUpdatedAt = new Date();
  await device.save();
  return device.collectionOtp;
}

export async function ensureDarkstoreDeviceOtp(deviceId: string): Promise<string> {
  const device = await DarkstoreDevice.findOne({ device_id: deviceId });
  if (!device) return '';
  const current = String((device as { collection_otp?: string }).collection_otp || '');
  if (/^\d{4}$/.test(current)) return current;
  const otp = newCollectionOtp();
  await DarkstoreDevice.updateOne(
    { device_id: deviceId },
    { collection_otp: otp, collection_otp_updated_at: new Date() },
  );
  return otp;
}

export async function rotateDeviceOtp(deviceId: string): Promise<string> {
  const otp = newCollectionOtp();
  const picker = await PickerDevice.findOneAndUpdate(
    { deviceId },
    { collectionOtp: otp, collectionOtpUpdatedAt: new Date() },
    { new: true },
  );
  if (picker) return otp;
  await DarkstoreDevice.updateOne(
    { device_id: deviceId },
    { collection_otp: otp, collection_otp_updated_at: new Date() },
  );
  return otp;
}

type MatchedDevice = { deviceId: string; source: 'picker_devices' | 'darkstore_devices'; storeKey: string };

export async function findDeviceByCollectionOtp(otp: string, storeKeys: string[]): Promise<MatchedDevice | null> {
  const keys = await expandStoreKeys(storeKeys);
  const pickerQuery: Record<string, unknown> = {
    collectionOtp: otp,
    status: { $nin: ['retired', 'maintenance'] },
  };
  if (keys.length) {
    pickerQuery.$or = [
      { warehouseKey: { $in: keys } },
      { warehouseKey: { $in: [null, ''] } },
      { warehouseKey: { $exists: false } },
    ];
  }
  const picker = await PickerDevice.findOne(pickerQuery).select('deviceId warehouseKey').lean() as { deviceId?: string; warehouseKey?: string } | null;
  if (picker) {
    return { deviceId: picker.deviceId || '', source: 'picker_devices' as const, storeKey: picker.warehouseKey || '' };
  }

  const dsQuery: Record<string, unknown> = {
    collection_otp: otp,
    status: { $nin: ['maintenance'] },
  };
  if (keys.length) {
    dsQuery.$or = [
      { store_id: { $in: keys } },
      { store_id: { $in: [null, ''] } },
      { store_id: { $exists: false } },
    ];
  }
  const dark = await DarkstoreDevice.findOne(dsQuery).select('device_id store_id').lean();
  if (!dark) return null;
  return {
    deviceId: String((dark as { device_id?: string }).device_id || ''),
    source: 'darkstore_devices',
    storeKey: String((dark as { store_id?: string }).store_id || ''),
  };
}

/** Device the picker should collect: one already held, else an available unit at their store. */
export async function resolveCollectableDevice(user: {
  _id: mongoose.Types.ObjectId;
  currentLocationId?: string | null;
  storeId?: unknown;
  activeDeviceId?: string | null;
}) {
  if (user.activeDeviceId) {
    const held = await PickerDevice.findOne({ deviceId: user.activeDeviceId, status: 'assigned' });
    if (held) return held;
  }
  const assigned = await PickerDevice.findOne({ assignedTo: user._id, status: 'assigned' });
  if (assigned) return assigned;

  const keys = await expandStoreKeys(pickerStoreKeys(user));
  if (keys.length) {
    const atStore = await PickerDevice.findOne({
      status: 'available',
      warehouseKey: { $in: keys },
    }).sort({ updatedAt: -1 });
    if (atStore) return atStore;
    const dark = await DarkstoreDevice.findOne({
      status: { $in: ['available', 'charging'] },
      store_id: { $in: keys },
    }).sort({ updatedAt: -1 });
    if (dark) return dark;
  }
  return PickerDevice.findOne({ status: 'available', warehouseKey: { $in: [null, ''] } }).sort({ updatedAt: -1 });
}
