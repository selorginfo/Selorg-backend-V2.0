/**
 * Bridge: Admin Picker Directory ↔ HSD/HHD operators (`hhd_users`).
 * HSD App authenticates against HHDUser; Admin previously listed only `picker_users`.
 */
import mongoose from 'mongoose';
import { HHDUser } from '../hhd/hhd.models';
import { DEFAULT_HUB_KEY } from '../orders/fulfillment.service';

type LeanHhd = {
  _id: mongoose.Types.ObjectId;
  name?: string | null;
  mobile?: string | null;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
  warehouse?: string | null;
  darkstore?: string | null;
  deviceId?: string | null;
  isActive?: boolean;
  lastLogin?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export function mapHhdToAdminDirectory(u: LeanHhd) {
  const phone = String(u.mobile || u.phone || '').replace(/\D/g, '').slice(-10) || '';
  const hub = u.darkstore || u.warehouse || DEFAULT_HUB_KEY;
  const active = u.isActive !== false;
  const status = active ? 'ACTIVE' : 'INACTIVE';
  return {
    id: String(u._id),
    _id: String(u._id),
    name: u.name || 'HSD Operator',
    fullName: u.name || 'HSD Operator',
    pickerName: u.name || 'HSD Operator',
    phone,
    mobile: phone,
    email: u.email || null,
    status,
    onboardingStatus: active ? 'approved' : 'inactive',
    workforceRole: 'hsd',
    source: 'hhd_users',
    hub,
    darkStore: hub,
    assignedStore: hub,
    zone: hub,
    deviceId: u.deviceId || null,
    linkedHhd: String(u._id),
    hhdUserId: String(u._id),
    isOnline: false,
    onlineStatus: active ? 'idle' : 'offline',
    workStatus: active ? 'idle' : 'offline',
    lastLogin: u.lastLogin || null,
    createdAt: u.createdAt || null,
    updatedAt: u.updatedAt || null,
  };
}

export async function listHhdOperators(filters: {
  status?: string;
  search?: string;
  warehouseKey?: string;
  limit?: number;
} = {}) {
  const and: Record<string, unknown>[] = [];
  if (filters.status === 'ACTIVE' || filters.status === 'active') and.push({ isActive: true });
  if (filters.status === 'INACTIVE' || filters.status === 'inactive') and.push({ isActive: false });
  if (filters.warehouseKey) {
    and.push({
      $or: [{ darkstore: filters.warehouseKey }, { warehouse: filters.warehouseKey }],
    });
  }
  if (filters.search) {
    const rx = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const digits = String(filters.search).replace(/\D/g, '').slice(-10);
    const or: Record<string, unknown>[] = [
      { name: rx },
      { mobile: rx },
      { email: rx },
      { deviceId: rx },
    ];
    if (digits.length >= 7) {
      or.push({ mobile: { $regex: digits } });
      or.push({ phone: { $regex: digits } });
    }
    and.push({ $or: or });
  }

  const query: Record<string, unknown> = and.length === 0 ? {} : and.length === 1 ? and[0] : { $and: and };
  const limit = Math.min(200, Math.max(1, filters.limit || 100));
  const rows = await HHDUser.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
  return rows.map((u) => mapHhdToAdminDirectory(u as LeanHhd));
}

export async function getHhdOperatorById(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const u = await HHDUser.findById(id).lean();
  if (!u) return null;
  return mapHhdToAdminDirectory(u as LeanHhd);
}

/** Ensure operator has a darkstore/warehouse hub (DEFAULT_HUB_KEY fallback). */
export async function ensureHhdOperatorHub(userId: string, preferredHub?: string | null): Promise<string> {
  const hub = String(preferredHub || DEFAULT_HUB_KEY).trim() || DEFAULT_HUB_KEY;
  if (!mongoose.Types.ObjectId.isValid(userId)) return hub;
  const user = await HHDUser.findById(userId).select('warehouse darkstore').lean();
  if (!user) return hub;
  if (user.darkstore || user.warehouse) {
    return String(user.darkstore || user.warehouse);
  }
  await HHDUser.updateOne(
    { _id: userId },
    { $set: { darkstore: hub, warehouse: hub } },
  ).catch(() => undefined);
  return hub;
}
