export type AddressType = "Home" | "Work" | "Other";

export interface Address {
  id: string;
  type: AddressType;
  line1: string;
  /** Neighborhood / locality (e.g. Adyar). */
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  def: boolean;
  /** Derived display strings (computed from the fields above by addressService)
   *  so existing "{line}, {area}" call sites keep working unchanged. */
  line: string;
  area: string;
}

export interface AddressFormValues {
  type: AddressType;
  line1: string;
  /** Neighborhood / locality (e.g. Adyar). Stored as backend `line2`. */
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  /** Optional map pin — required for live store assign / delivery ETA. */
  latitude?: number;
  longitude?: number;
}
