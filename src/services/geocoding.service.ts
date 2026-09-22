import fetch from 'node-fetch';
import { logger } from '../utils/logger';
import { Integration } from '../modules/admin/integration.model';

/**
 * Google Maps Geocoding — converts addresses to lat/lng and back.
 * Resolves API key from active Integration (`google_maps`) with env fallback.
 */
const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';
const PLACES_AUTOCOMPLETE_BASE = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const GEOLOCATE_BASE = 'https://www.googleapis.com/geolocation/v1/geolocate';

async function getGoogleMapsApiKey(): Promise<string | null> {
  try {
    const integ = await Integration.findOne({ service: 'google_maps', isActive: true }).lean();
    const key = (integ as { apiKey?: string } | null)?.apiKey?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim();
    return key || null;
  } catch {
    return process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
  }
}

export interface AddressComponent {
  long_name: string;
  short_name?: string;
  types: string[];
}

export interface ParsedAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

/**
 * Google returns address_components most-specific first. Resolve by type priority,
 * and keep multiple locality levels when they are distinct (e.g. Bharathi Nagar + Adyar).
 */
function pickComponent(components: AddressComponent[], types: string[]): string {
  for (const type of types) {
    const name = components.find((c) => c.types.includes(type))?.long_name?.trim();
    if (name) return name;
  }
  return '';
}

function pushUnique(parts: string[], value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  if (parts.some((p) => p.toLowerCase() === key)) return;
  parts.push(trimmed);
}

/**
 * AREA / LOCALITY hierarchy (most → least specific), then joined when distinct.
 * Does not include city `locality` — that belongs in city.
 *
 * Important for Chennai (and similar): Google often returns
 *   neighborhood = "Venkata Rathinam Nagar"
 *   sublocality_level_1 OR administrative_area_level_3 = "Adyar"
 *   locality = "Chennai"
 * We must keep BOTH neighborhood and Adyar — do not stop after the first match.
 */
function pickArea(components: AddressComponent[], city: string): string {
  const parts: string[] = [];
  pushUnique(parts, pickComponent(components, ['neighborhood']));
  pushUnique(parts, pickComponent(components, ['sublocality_level_2']));
  pushUnique(parts, pickComponent(components, ['sublocality_level_1']));
  pushUnique(parts, pickComponent(components, ['sublocality']));
  // Many Indian pins put the named area (Adyar, T. Nagar, etc.) only here.
  pushUnique(parts, pickComponent(components, ['administrative_area_level_3']));

  const cityKey = city.trim().toLowerCase();
  return parts.filter((p) => p.toLowerCase() !== cityKey).join(', ');
}

/**
 * If structured components missed a mid-level locality that Google still put in
 * formatted_address (…, Venkata Rathinam Nagar, Adyar, Chennai, …), recover it.
 */
function enrichAreaFromFormattedAddress(
  line2: string,
  formattedAddress: string,
  city: string,
  state: string,
  pincode: string,
  country: string,
  line1: string,
): string {
  const formatted = String(formattedAddress || '').trim();
  if (!formatted || !city) return line2;

  const segments = formatted.split(',').map((s) =>
    s
      .replace(/\b\d{6}\b/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  ).filter(Boolean);

  const cityIdx = segments.findIndex((s) => s.toLowerCase() === city.toLowerCase());
  if (cityIdx <= 0) return line2;

  const known = new Set(
    [line2, line1, city, state, pincode, country, 'India']
      .flatMap((s) =>
        String(s || '')
          .split(',')
          .map((p) => p.trim().toLowerCase())
          .filter(Boolean),
      ),
  );

  const areaParts = line2
    ? line2.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const lastKnownIdx = areaParts.reduce((max, part) => {
    const idx = segments.findIndex((s) => s.toLowerCase() === part.toLowerCase());
    return idx > max ? idx : max;
  }, -1);

  // Walk from just after the last known area token up to (but not including) city.
  // If we have no area yet, only take the segment immediately before city (the locality).
  const start = lastKnownIdx >= 0 ? lastKnownIdx + 1 : Math.max(0, cityIdx - 1);
  for (let i = start; i < cityIdx; i++) {
    const seg = segments[i];
    if (!seg || known.has(seg.toLowerCase())) continue;
    // Skip pure house/street numbers already represented in line1.
    if (/^\d+[A-Za-z/.-]*$/.test(seg)) continue;
    areaParts.push(seg);
    known.add(seg.toLowerCase());
  }

  return areaParts.join(', ');
}

function pickCity(components: AddressComponent[]): string {
  return pickComponent(components, [
    'locality',
    'postal_town',
    'administrative_area_level_2',
  ]);
}

export function parseGoogleAddressComponents(
  components: AddressComponent[],
  formattedAddress = '',
): ParsedAddress {
  const subpremise = pickComponent(components, ['subpremise']);
  const premise = pickComponent(components, ['premise']);
  const streetNumber = pickComponent(components, ['street_number', 'house_number']);
  const route = pickComponent(components, ['route', 'street', 'road']);
  const city = pickCity(components);
  const state = pickComponent(components, ['administrative_area_level_1', 'state']);
  const pincode = pickComponent(components, ['postal_code', 'postcode']);
  const country = pickComponent(components, ['country']);

  const street = [streetNumber, route].filter(Boolean).join(' ');
  const line1 = [subpremise, premise, street].filter(Boolean).join(', ');
  let line2 = pickArea(components, city);
  line2 = enrichAreaFromFormattedAddress(
    line2,
    formattedAddress,
    city,
    state,
    pincode,
    country,
    line1,
  );

  // Only drop area when it is literally the city name alone.
  if (line2 && city && line2.toLowerCase() === city.toLowerCase()) {
    line2 = '';
  }

  return {
    line1,
    line2,
    city,
    state,
    pincode,
    country,
  };
}

/**
 * Street/premise line only. Falls back to the leading segment of Google's formatted
 * address when it is not already captured as area/city/state/pin.
 */
export function toLine1(parsed: ParsedAddress, formattedAddress: string): string {
  if (parsed.line1) return parsed.line1;
  const lead = formattedAddress.split(',')[0]?.trim() || '';
  if (!lead) return '';
  const alreadyCaptured = [parsed.line2, parsed.city, parsed.state, parsed.pincode, parsed.country]
    .filter(Boolean)
    .flatMap((s) => s.split(',').map((p) => p.trim().toLowerCase()))
    .filter(Boolean);
  return alreadyCaptured.includes(lead.toLowerCase()) ? '' : lead;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  /** Google's own single-line address — callers must not re-join the parts above. */
  formattedAddress: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = String(address || '').trim();
  if (!trimmed) return null;

  const key = await getGoogleMapsApiKey();
  if (!key) {
    logger.warn('Geocoding: No Google Maps API key configured');
    return null;
  }

  try {
    const url = new URL(GEOCODE_BASE);
    url.searchParams.set('address', trimmed);
    url.searchParams.set('key', key);

    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status: string;
      results?: Array<{
        geometry: { location: { lat: number; lng: number } };
        address_components?: AddressComponent[];
        formatted_address?: string;
      }>;
    };
    if (data.status !== 'OK' || !data.results?.length) return null;

    const result = data.results[0];
    const { lat, lng } = result.geometry.location;
    const formattedAddress = String(result.formatted_address || '').trim();
    const parsed = parseGoogleAddressComponents(result.address_components || [], formattedAddress || trimmed);

    return {
      latitude: lat,
      longitude: lng,
      line1: toLine1(parsed, formattedAddress || trimmed),
      line2: parsed.line2,
      city: parsed.city,
      state: parsed.state,
      pincode: parsed.pincode,
      formattedAddress: formattedAddress || trimmed,
    };
  } catch (err) {
    logger.error('Geocoding API error', { error: (err as Error).message });
    return null;
  }
}

export interface ReverseGeocodeResult {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  /** Google's own single-line address — callers must not re-join the parts above. */
  formattedAddress: string;
}

/**
 * Google reverse geocode returns multiple overlapping results for one lat/lng.
 * Result[0] is often street-level and omits mid localities (Adyar / Thiruvanmiyur).
 * Keep the first high-confidence locality chain, and only fall back to later
 * results when the primary result has no area at all.
 */
function mergeReverseResults(
  results: Array<{ address_components?: AddressComponent[]; formatted_address?: string }>,
): ReverseGeocodeResult {
  const primaryFormatted = String(results[0]?.formatted_address || '').trim();
  const primary = parseGoogleAddressComponents(results[0]?.address_components || [], primaryFormatted);

  let line1 = toLine1(primary, primaryFormatted);
  let city = primary.city;
  let state = primary.state;
  let pincode = primary.pincode;
  let country = primary.country;
  let line2 = primary.line2;
  let bestFormatted = primaryFormatted;

  for (const candidate of results.slice(0, 8)) {
    const formatted = String(candidate.formatted_address || '').trim();
    const parsed = parseGoogleAddressComponents(candidate.address_components || [], formatted);
    if (!line1 && parsed.line1) line1 = parsed.line1;
    if (!city && parsed.city) city = parsed.city;
    if (!state && parsed.state) state = parsed.state;
    if (!pincode && parsed.pincode) pincode = parsed.pincode;
    if (!country && parsed.country) country = parsed.country;
    if (!line2 && parsed.line2) line2 = parsed.line2;

    // Prefer a richer formatted_address that already names more localities.
    if (formatted.split(',').length > bestFormatted.split(',').length) {
      bestFormatted = formatted;
    }
  }

  // Final pass: pull any still-missing mid segments from the richest formatted string.
  line2 = enrichAreaFromFormattedAddress(line2, bestFormatted, city, state, pincode, country, line1);
  line2 = enrichAreaFromFormattedAddress(line2, primaryFormatted, city, state, pincode, country, line1);

  const formattedAddress = buildDisplayFormattedAddress({
    line1,
    line2,
    city,
    state,
    pincode,
    country,
    fallback: bestFormatted || primaryFormatted,
  });

  return {
    line1,
    line2,
    city,
    state,
    pincode,
    formattedAddress,
  };
}

/** Build a clean label that includes recovered area names for the map card. */
function buildDisplayFormattedAddress(input: {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  fallback: string;
}): string {
  const { line1, line2, city, state, pincode, fallback } = input;
  const parts = [line1, line2, city, state].filter(Boolean);
  if (!parts.length) return fallback;

  let built = parts.join(', ');
  if (pincode && !built.includes(pincode)) {
    built = `${built} ${pincode}`;
  }

  // If Google's fallback already has more street/building detail (e.g. "Ganesh Apartment"),
  // keep it when our built string is not richer on area.
  const fallbackAreas = (line2 || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const fallbackHasAllAreas = fallbackAreas.every((a) =>
    fallback.toLowerCase().includes(a.toLowerCase()),
  );
  if (fallbackHasAllAreas && fallback.split(',').length >= built.split(',').length) {
    return fallback;
  }
  return built;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
  if (latitude == null || longitude == null || Number.isNaN(Number(latitude)) || Number.isNaN(Number(longitude))) {
    return null;
  }

  const key = await getGoogleMapsApiKey();
  if (!key) {
    logger.warn('Reverse geocoding: No Google Maps API key configured');
    return null;
  }

  try {
    const url = new URL(GEOCODE_BASE);
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    url.searchParams.set('key', key);

    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status: string;
      results?: Array<{ address_components?: AddressComponent[]; formatted_address?: string }>;
    };
    if (data.status !== 'OK' || !data.results?.length) return null;

    // De-dupe identical formatted addresses while preserving order.
    const seenFmt = new Set<string>();
    const unique = data.results.filter((r) => {
      const keyFmt = String(r.formatted_address || '').trim().toLowerCase();
      if (!keyFmt) return true;
      if (seenFmt.has(keyFmt)) return false;
      seenFmt.add(keyFmt);
      return true;
    });

    // Merge street-level + neighborhood + locality results so Adyar / Thiruvanmiyur
    // are not lost when result[0] is only "63 LB Road, Venkata Rathinam Nagar, Chennai…".
    return mergeReverseResults(unique);
  } catch (err) {
    logger.error('Reverse geocoding API error', { error: (err as Error).message });
    return null;
  }
}

export interface AddressSuggestion {
  name: string;
  addr: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

export async function searchAddressSuggestions(
  query: string,
  options: { latitude?: number; longitude?: number } = {},
): Promise<AddressSuggestion[]> {
  const trimmed = String(query || '').trim();
  if (trimmed.length < 2) return [];

  const key = await getGoogleMapsApiKey();
  if (!key) {
    const geo = await geocodeAddress(trimmed);
    if (!geo) return [];
    const name = geo.line2 || geo.city || trimmed.split(',')[0].trim();
    return [{ name, addr: geo.formattedAddress, latitude: geo.latitude, longitude: geo.longitude }];
  }

  try {
    const url = new URL(PLACES_AUTOCOMPLETE_BASE);
    url.searchParams.set('input', trimmed);
    url.searchParams.set('key', key);
    url.searchParams.set('components', 'country:in');
    url.searchParams.set('types', 'geocode|establishment');

    const { latitude, longitude } = options;
    if (
      latitude != null &&
      longitude != null &&
      !Number.isNaN(Number(latitude)) &&
      !Number.isNaN(Number(longitude))
    ) {
      url.searchParams.set('location', `${latitude},${longitude}`);
      url.searchParams.set('radius', '50000');
    }

    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status: string;
      predictions?: Array<{
        structured_formatting?: { main_text?: string; secondary_text?: string };
        description?: string;
        place_id?: string;
      }>;
    };

    if (data.status !== 'OK' || !Array.isArray(data.predictions)) {
      if (data.status === 'ZERO_RESULTS') return [];
      const geo = await geocodeAddress(trimmed);
      if (!geo) return [];
      const name = geo.line2 || geo.city || trimmed.split(',')[0].trim();
      return [{ name, addr: geo.formattedAddress, latitude: geo.latitude, longitude: geo.longitude }];
    }

    return data.predictions.slice(0, 8).map((p) => ({
      name: p.structured_formatting?.main_text || p.description || trimmed,
      addr: p.structured_formatting?.secondary_text || p.description || '',
      placeId: p.place_id,
    }));
  } catch (err) {
    logger.error('Places autocomplete error', { error: (err as Error).message });
    return [];
  }
}

export async function getApproximateLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy?: number;
  source?: string;
} | null> {
  const fallback = {
    latitude: 13.0827,
    longitude: 80.2707,
    accuracy: 50000,
    source: 'fallback',
  };
  const key = await getGoogleMapsApiKey();
  if (!key) {
    logger.warn('Approximate location: No Google Maps API key configured — using Chennai fallback');
    return fallback;
  }

  try {
    const res = await fetch(`${GEOLOCATE_BASE}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ considerIp: true }),
    });
    const data = (await res.json()) as {
      error?: { message?: string };
      location?: { lat: number; lng: number };
      accuracy?: number;
    };

    if (data.error) {
      logger.warn('Approximate location API error', { error: data.error.message || data.error });
      return fallback;
    }

    const lat = data.location?.lat;
    const lng = data.location?.lng;
    if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) return fallback;

    return {
      latitude: Number(lat),
      longitude: Number(lng),
      accuracy: data.accuracy != null ? Number(data.accuracy) : undefined,
      source: 'google',
    };
  } catch (err) {
    logger.error('Approximate location error', { error: (err as Error).message });
    return fallback;
  }
}
