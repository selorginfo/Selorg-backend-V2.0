import { apiGet } from "./api";

export interface LocationSuggestion {
  description?: string;
  mainText?: string;
  secondaryText?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface ResolvedLocation extends GeoCoordinates {
  formattedAddress: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

export type GeolocationFailureReason =
  | "unsupported"
  | "permission_denied"
  | "unavailable"
  | "timeout"
  | "insecure_context"
  | "unknown";

export class GeolocationError extends Error {
  reason: GeolocationFailureReason;
  constructor(reason: GeolocationFailureReason, message: string) {
    super(message);
    this.name = "GeolocationError";
    this.reason = reason;
  }
}

export function isValidLatitude(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= -90 && n <= 90;
}

export function isValidLongitude(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= -180 && n <= 180;
}

/** GET /locations/suggestions?q= — address autocomplete (min 2 chars). */
export async function searchLocations(
  query: string,
  opts?: { latitude?: number; longitude?: number },
): Promise<LocationSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ q });
  if (opts?.latitude != null) params.set("latitude", String(opts.latitude));
  if (opts?.longitude != null) params.set("longitude", String(opts.longitude));
  try {
    return await apiGet<LocationSuggestion[]>(`/locations/suggestions?${params.toString()}`, {
      skipAuth: true,
    });
  } catch (err) {
    throw err instanceof Error ? err : new Error("Location search failed");
  }
}

/**
 * GET /locations/approximate — IP-based network estimate.
 * Not used for "Use my current location" (that must be real device geolocation only).
 */
export async function getApproximateLocation(): Promise<GeoCoordinates | null> {
  try {
    return await apiGet<GeoCoordinates>("/locations/approximate", { skipAuth: true });
  } catch {
    return null;
  }
}

/** GET /locations/reverse?latitude=&longitude= — real reverse geocode via backend Google key. */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ResolvedLocation | null> {
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return null;
  }
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  try {
    return await apiGet<ResolvedLocation>(`/locations/reverse?${params.toString()}`, {
      skipAuth: true,
    });
  } catch {
    return null;
  }
}

/** GET /locations/place-details?placeId= — resolve Places autocomplete result. */
export async function resolvePlace(placeId: string): Promise<ResolvedLocation | null> {
  const id = placeId.trim();
  if (!id) return null;
  const params = new URLSearchParams({ placeId: id });
  try {
    return await apiGet<ResolvedLocation>(`/locations/place-details?${params.toString()}`, {
      skipAuth: true,
    });
  } catch {
    return null;
  }
}

function mapGeolocationError(err: unknown): GeolocationError {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return new GeolocationError(
      "insecure_context",
      "Location needs HTTPS (or localhost). Open the site on a secure origin and try again.",
    );
  }
  if (!err || typeof err !== "object") {
    return new GeolocationError("unknown", "Could not detect your location");
  }
  const code = "code" in err ? Number((err as GeolocationPositionError).code) : NaN;
  if (code === 1) {
    return new GeolocationError(
      "permission_denied",
      "Location permission denied. Allow location access in your browser settings, then try again.",
    );
  }
  if (code === 2) {
    return new GeolocationError(
      "unavailable",
      "Location unavailable. Enable OS/browser location services and try again.",
    );
  }
  if (code === 3) {
    return new GeolocationError("timeout", "Location request timed out. Try again.");
  }
  return new GeolocationError("unknown", "Could not detect your location");
}

/**
 * Browser Geolocation only — requests permission when needed.
 * Never invents coordinates and never falls back to IP/approximate location.
 */
export async function getBrowserCoordinates(): Promise<GeoCoordinates> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new GeolocationError(
      "insecure_context",
      "Location needs HTTPS (or localhost). Open the site on a secure origin and try again.",
    );
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new GeolocationError(
      "unsupported",
      "This browser does not support location detection.",
    );
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 0,
      });
    });
    const { latitude, longitude, accuracy } = position.coords;
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      throw new GeolocationError("unavailable", "Browser returned invalid coordinates.");
    }
    return {
      latitude,
      longitude,
      accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
      timestamp: position.timestamp,
    };
  } catch (err) {
    if (err instanceof GeolocationError) throw err;
    throw mapGeolocationError(err);
  }
}

/**
 * Real device/browser location only (triggers permission prompt when needed),
 * then reverse-geocodes. Does not use IP approximate or any fake coordinates.
 */
export async function detectAndResolveLocation(): Promise<{
  coords: GeoCoordinates;
  resolved: ResolvedLocation | null;
}> {
  const coords = await getBrowserCoordinates();
  const resolved = await reverseGeocode(coords.latitude, coords.longitude);
  return { coords, resolved };
}
