import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { geocodeAddress, reverseGeocode } from '../../services/geocoding.service';
import * as addressesRepo from './addresses.repository';
import { ICustomerAddress } from './addresses.model';
import type { CreateAddressInput, UpdateAddressInput } from './addresses.validation';

function toUserObjectId(userId?: string): mongoose.Types.ObjectId {
  if (!userId) throw new AppError('Invalid user id', 401);
  if (mongoose.Types.ObjectId.isValid(userId)) return new mongoose.Types.ObjectId(userId);
  throw new AppError('Invalid user id', 401);
}

function escapeLabelRegex(label: string): string {
  return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface AddressFields {
  label?: string;
  line1?: string;
  line2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

function normalizeAddressFields<T extends AddressFields>(fields: T): T {
  const line1 = (fields.line1 != null ? String(fields.line1) : '').trim();
  const city = (fields.city != null ? String(fields.city) : '').trim();
  // Do not invent a placeholder line1 — callers must supply a real street/house line.
  return { ...fields, line1, city: city || 'Unknown' };
}

/**
 * Merges geocoding results but keeps what the customer actually typed. The form collects
 * house/floor (line1) and area (line2) explicitly, so geocoding may only fill blanks —
 * appending the geocoded street into line2 used to overwrite the chosen area.
 */
function mergeWithEnrichment(body: AddressFields, enriched: AddressFields | null): AddressFields {
  if (!enriched) return normalizeAddressFields(body);
  const merged = normalizeAddressFields({ ...body, ...enriched });
  const userLine1 = (body.line1 != null ? String(body.line1) : '').trim();
  const userArea = (body.line2 != null ? String(body.line2) : '').trim();
  if (userLine1) merged.line1 = userLine1;
  if (userArea) merged.line2 = userArea;
  return merged;
}

async function applyExistingAddressUpdate(existing: ICustomerAddress, fields: AddressFields, userObjectId: mongoose.Types.ObjectId) {
  const { label, line1, line2, landmark, city, state, pincode, latitude, longitude, isDefault } = fields;
  if (label !== undefined) existing.label = String(label).trim() || existing.label;
  if (line1 !== undefined) existing.line1 = line1;
  if (line2 !== undefined) existing.line2 = line2;
  if (landmark !== undefined) existing.landmark = landmark;
  if (city !== undefined) existing.city = city;
  if (state !== undefined) existing.state = state;
  if (pincode !== undefined) existing.pincode = pincode;
  if (latitude !== undefined) existing.latitude = latitude;
  if (longitude !== undefined) existing.longitude = longitude;
  if (isDefault !== undefined) {
    existing.isDefault = Boolean(isDefault);
    if (existing.isDefault) await addressesRepo.unsetOtherDefaults(userObjectId, existing._id);
  }
  await existing.save();
  return existing.toObject();
}

/**
 * Enriches address data via Google Maps Geocoding: lat/lng-only input gets reverse
 * geocoded; address-only input gets geocoded; both gets reverse geocoded to normalize.
 */
async function enrichWithGeocoding(body: AddressFields & { address?: string }): Promise<AddressFields | null> {
  const { line1, line2, landmark, city, state, pincode, latitude, longitude, address: addressField } = body;
  const hasLatLng = latitude != null && longitude != null && !Number.isNaN(Number(latitude)) && !Number.isNaN(Number(longitude));
  const hasAddress = [line1, city, addressField].some((v) => v && String(v).trim());
  const addressStr = addressField?.trim() || [line1, line2, landmark, city, state, pincode].filter(Boolean).map(String).join(', ');

  if (hasLatLng && !hasAddress) {
    const geo = await reverseGeocode(Number(latitude), Number(longitude));
    if (geo) return { line1: geo.line1, line2: geo.line2 || '', landmark: landmark || '', city: geo.city || city || '', state: geo.state || '', pincode: geo.pincode || '', latitude: Number(latitude), longitude: Number(longitude) };
  }

  if (hasAddress && !hasLatLng && addressStr.trim()) {
    const geo = await geocodeAddress(addressStr);
    if (geo) return { line1: geo.line1 || line1 || '', line2: geo.line2 || line2 || '', landmark: landmark || '', city: geo.city || city || '', state: geo.state || state || '', pincode: geo.pincode || pincode || '', latitude: geo.latitude, longitude: geo.longitude };
  }

  // Pin + typed fields: the customer's own values win, geocoding only backfills blanks.
  if (hasLatLng && hasAddress) {
    const geo = await reverseGeocode(Number(latitude), Number(longitude));
    if (geo) return { line1: line1 || geo.line1 || '', line2: line2 || geo.line2 || '', landmark: landmark || '', city: city || geo.city || '', state: state || geo.state || '', pincode: pincode || geo.pincode || '', latitude: Number(latitude), longitude: Number(longitude) };
  }

  return null;
}

function toAddressDto(doc: ICustomerAddress | Record<string, unknown>) {
  if (!doc) return null;
  const o = 'toObject' in doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return { ...o, _id: String(o._id), landmark: o.landmark || '', line2: o.line2 || '' };
}

export async function getAddressesByUserId(userId?: string) {
  const uid = toUserObjectId(userId);
  const addresses = await addressesRepo.listByUser(uid);
  return addresses.map((a) => ({ ...a, _id: String(a._id), landmark: a.landmark || '' }));
}

export async function getDefaultAddress(userId?: string) {
  const uid = toUserObjectId(userId);
  const address = (await addressesRepo.findDefault(uid)) || (await addressesRepo.findFirst(uid));
  return address ? { ...address, _id: String(address._id), landmark: address.landmark || '' } : null;
}

export async function createAddress(userId: string | undefined, body: CreateAddressInput) {
  const uid = toUserObjectId(userId);
  const enriched = await enrichWithGeocoding(body);
  const merged = mergeWithEnrichment(body, enriched);

  const { label, line1, line2, landmark, city, state, pincode, latitude, longitude, isDefault } = merged;

  if (!line1 || !String(line1).trim()) throw AppError.badRequest('Address line 1 is required');
  if (!city || !String(city).trim()) throw AppError.badRequest('City is required');

  const normalizedLabel = (label || 'Home').trim();
  const labelRegex = new RegExp(`^${escapeLabelRegex(normalizedLabel)}$`, 'i');

  const existing = await addressesRepo.findByLabel(uid, labelRegex);
  if (existing) {
    const address = await applyExistingAddressUpdate(existing, merged, uid);
    return { address: toAddressDto(address), wasUpdated: true };
  }

  const count = await addressesRepo.countByUser(uid);
  const createPayload = {
    userId: uid,
    label: normalizedLabel,
    line1: String(line1).trim(),
    line2: String(line2 || '').trim(),
    landmark: String(landmark || '').trim(),
    city: String(city).trim(),
    state: String(state || '').trim(),
    pincode: String(pincode || '').trim(),
    latitude,
    longitude,
    isDefault: Boolean(isDefault),
    order: count,
  };

  let doc: ICustomerAddress;
  try {
    doc = await addressesRepo.create(createPayload);
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      const duplicate = await addressesRepo.findByLabel(uid, labelRegex);
      if (duplicate) {
        const address = await applyExistingAddressUpdate(duplicate, merged, uid);
        return { address: toAddressDto(address), wasUpdated: true };
      }
    }
    throw err;
  }

  if (isDefault) await addressesRepo.unsetOtherDefaults(uid, doc._id);

  return { address: toAddressDto(doc), wasUpdated: false };
}

export async function updateAddress(userId: string | undefined, addressId: string, body: UpdateAddressInput) {
  if (!mongoose.Types.ObjectId.isValid(addressId)) return null;
  const uid = toUserObjectId(userId);
  const address = await addressesRepo.findOwned(addressId, uid);
  if (!address) return null;

  // Edits: apply user fields directly — do not reverse-geocode over typed line1/city.
  const merged = normalizeAddressFields({ ...address.toObject(), ...body });

  const { label, line1, line2, landmark, city, state, pincode, latitude, longitude, isDefault } = merged;
  if (label !== undefined) address.label = String(label).trim() || address.label;
  if (line1 !== undefined) address.line1 = String(line1).trim();
  if (line2 !== undefined) address.line2 = String(line2 || '').trim();
  if (landmark !== undefined) address.landmark = String(landmark || '').trim();
  if (city !== undefined) address.city = String(city).trim();
  if (state !== undefined) address.state = String(state || '').trim();
  if (pincode !== undefined) address.pincode = String(pincode || '').trim();
  if (latitude !== undefined) address.latitude = latitude;
  if (longitude !== undefined) address.longitude = longitude;
  if (isDefault !== undefined) {
    address.isDefault = Boolean(isDefault);
    if (address.isDefault) await addressesRepo.unsetOtherDefaults(uid, addressId);
  }
  await address.save();
  return toAddressDto(address);
}

export async function deleteAddress(userId: string | undefined, addressId: string) {
  if (!mongoose.Types.ObjectId.isValid(addressId)) return null;
  const uid = toUserObjectId(userId);
  return addressesRepo.deleteOwned(addressId, uid);
}

export async function setDefaultAddress(userId: string | undefined, addressId: string) {
  if (!mongoose.Types.ObjectId.isValid(addressId)) return null;
  const uid = toUserObjectId(userId);
  const address = await addressesRepo.findOwned(addressId, uid);
  if (!address) return null;
  await addressesRepo.unsetAllDefaults(uid);
  address.isDefault = true;
  await address.save();
  return toAddressDto(address);
}
