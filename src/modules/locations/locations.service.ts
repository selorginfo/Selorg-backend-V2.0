import { Integration } from '../admin/integration.model';
import {
  parseGoogleAddressComponents,
  reverseGeocode as reverseGeocodeCore,
  toLine1,
  type AddressComponent,
} from '../../services/geocoding.service';

const PLACES_AUTOCOMPLETE_BASE = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const PLACES_DETAILS_BASE = 'https://maps.googleapis.com/maps/api/place/details/json';
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

export interface AddressSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export async function searchAddressSuggestions(
  q: string,
  opts: { latitude?: number; longitude?: number } = {},
): Promise<AddressSuggestion[]> {
  const key = await getGoogleMapsApiKey();
  if (!key) return [];

  const url = new URL(PLACES_AUTOCOMPLETE_BASE);
  url.searchParams.set('input', q);
  url.searchParams.set('key', key);
  url.searchParams.set('types', 'geocode');
  url.searchParams.set('components', 'country:in');
  if (opts.latitude != null && opts.longitude != null) {
    url.searchParams.set('location', `${opts.latitude},${opts.longitude}`);
    url.searchParams.set('radius', '50000');
  }

  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    status: string;
    predictions?: Array<{
      place_id: string;
      description: string;
      structured_formatting?: { main_text?: string; secondary_text?: string };
    }>;
  };

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];

  return (data.predictions || []).map((p) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text || p.description,
    secondaryText: p.structured_formatting?.secondary_text || '',
  }));
}

export async function getApproximateLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
} | null> {
  const key = await getGoogleMapsApiKey();
  if (!key) return null;

  const url = `${GEOLOCATE_BASE}?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ considerIp: true }),
  });

  const data = (await res.json()) as {
    location?: { lat: number; lng: number };
    accuracy?: number;
  };
  if (!data?.location) return null;

  return {
    latitude: data.location.lat,
    longitude: data.location.lng,
    accuracy: data.accuracy || 0,
  };
}

export interface ReverseLocationResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

/** Reverse-geocode real GPS coordinates via Google Geocoding (server key). */
export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number,
): Promise<ReverseLocationResult | null> {
  if (
    latitude == null ||
    longitude == null ||
    Number.isNaN(Number(latitude)) ||
    Number.isNaN(Number(longitude))
  ) {
    return null;
  }

  const geo = await reverseGeocodeCore(Number(latitude), Number(longitude));
  if (!geo) return null;

  // Google's formatted_address from result[0] is often street-thin.
  // Prefer the enriched label produced by multi-result merge.
  const formattedAddress =
    geo.formattedAddress ||
    [geo.line1, geo.line2, geo.city, geo.state, geo.pincode].filter(Boolean).join(', ');

  return {
    latitude: Number(latitude),
    longitude: Number(longitude),
    formattedAddress,
    line1: geo.line1 || '',
    line2: geo.line2 || '',
    city: geo.city || '',
    state: geo.state || '',
    pincode: geo.pincode || '',
  };
}

function fromPlaceAddressComponents(
  components: AddressComponent[],
  formatted: string,
  lat: number,
  lng: number,
): ReverseLocationResult {
  const parsed = parseGoogleAddressComponents(components, formatted);
  return {
    latitude: lat,
    longitude: lng,
    formattedAddress: formatted,
    line1: toLine1(parsed, formatted),
    line2: parsed.line2,
    city: parsed.city,
    state: parsed.state,
    pincode: parsed.pincode,
  };
}

/** Resolve a Places autocomplete `placeId` to coordinates + address parts. */
export async function getPlaceDetails(placeId: string): Promise<ReverseLocationResult | null> {
  const id = String(placeId || '').trim();
  if (!id) return null;

  const key = await getGoogleMapsApiKey();
  if (!key) return null;

  const url = new URL(PLACES_DETAILS_BASE);
  url.searchParams.set('place_id', id);
  url.searchParams.set('fields', 'geometry,address_component,formatted_address');
  url.searchParams.set('key', key);

  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    status: string;
    result?: {
      geometry?: { location?: { lat: number; lng: number } };
      address_components?: AddressComponent[];
      formatted_address?: string;
    };
  };
  if (data.status !== 'OK' || !data.result?.geometry?.location) return null;

  const lat = Number(data.result.geometry.location.lat);
  const lng = Number(data.result.geometry.location.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const formatted = String(data.result.formatted_address || '').trim();
  const components = data.result.address_components || [];

  // Prefer structured Places components first (same parser as reverse geocode).
  if (components.length > 0) {
    const fromComponents = fromPlaceAddressComponents(components, formatted, lat, lng);
    if (fromComponents.city || fromComponents.line2 || fromComponents.pincode || fromComponents.line1) {
      return fromComponents;
    }
  }

  const reversed = await reverseGeocodeLocation(lat, lng);
  if (reversed) return reversed;

  return {
    latitude: lat,
    longitude: lng,
    formattedAddress: formatted,
    line1: formatted.split(',')[0]?.trim() || '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
  };
}
