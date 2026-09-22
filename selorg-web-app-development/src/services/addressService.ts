import { apiDelete, apiGet, apiPost, apiPut } from "./api";
import { formatAddressArea, formatAddressLine } from "@/lib/formatAddress";
import type { Address, AddressFormValues, AddressType } from "@/types";

interface BackendAddress {
  _id: string;
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

const KNOWN_TYPES: AddressType[] = ["Home", "Work", "Other"];

function toAddressType(label?: string): AddressType {
  return (KNOWN_TYPES as string[]).includes(label ?? "") ? (label as AddressType) : "Other";
}

/** Map backend / form fields → display Address with deduped line/area. */
export function toAddress(raw: BackendAddress): Address {
  const line1 = raw.line1 || "";
  const line2 = raw.line2 || "";
  const landmark = raw.landmark || "";
  const city = raw.city || "";
  const state = raw.state || "";
  const pincode = raw.pincode || "";
  const parts = { line1, line2, landmark, city, state, pincode };

  return {
    id: raw._id,
    type: toAddressType(raw.label),
    line1,
    line2,
    landmark,
    city,
    state,
    pincode,
    latitude: raw.latitude,
    longitude: raw.longitude,
    def: Boolean(raw.isDefault),
    line: formatAddressLine(parts),
    area: formatAddressArea(parts),
  };
}

export function toDisplayAddress(
  values: AddressFormValues & { id: string; def?: boolean },
): Address {
  return toAddress({
    _id: values.id,
    label: values.type,
    line1: values.line1,
    line2: values.line2,
    landmark: values.landmark,
    city: values.city,
    state: values.state,
    pincode: values.pincode,
    latitude: values.latitude,
    longitude: values.longitude,
    isDefault: values.def,
  });
}

function toPayload(values: AddressFormValues) {
  const hasPin =
    typeof values.latitude === "number" &&
    typeof values.longitude === "number" &&
    Number.isFinite(values.latitude) &&
    Number.isFinite(values.longitude) &&
    values.latitude >= -90 &&
    values.latitude <= 90 &&
    values.longitude >= -180 &&
    values.longitude <= 180;

  return {
    label: values.type,
    line1: values.line1.trim(),
    line2: values.line2.trim() || undefined,
    landmark: values.landmark.trim() || undefined,
    city: values.city.trim(),
    state: values.state.trim() || undefined,
    pincode: values.pincode.trim() || undefined,
    ...(hasPin ? { latitude: values.latitude, longitude: values.longitude } : {}),
  };
}

export async function listAddresses(): Promise<Address[]> {
  const raw = await apiGet<BackendAddress[]>("/addresses");
  return raw.map(toAddress);
}

export async function createAddress(values: AddressFormValues): Promise<Address> {
  const raw = await apiPost<BackendAddress>("/addresses", toPayload(values));
  return toAddress(raw);
}

export async function updateAddress(id: string, values: AddressFormValues): Promise<Address> {
  const raw = await apiPut<BackendAddress>(`/addresses/${id}`, toPayload(values));
  return toAddress(raw);
}

export async function deleteAddress(id: string): Promise<void> {
  await apiDelete(`/addresses/${id}`);
}

export async function setDefaultAddress(id: string): Promise<Address> {
  const raw = await apiPost<BackendAddress>(`/addresses/${id}/default`);
  return toAddress(raw);
}
