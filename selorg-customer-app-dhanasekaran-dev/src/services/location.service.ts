import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { GOOGLE_MAPS_API_KEY } from '@env';

/**
 * Device location + Google reverse-geocoding.
 *
 * Native permission strings are already declared:
 *   iOS     — NSLocationWhenInUseUsageDescription (Info.plist)
 *   Android — ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION (AndroidManifest)
 *
 * Reverse geocoding uses the Geocoding REST API (no native SDK) so it works
 * regardless of the map provider. Needs GOOGLE_MAPS_API_KEY from `@env`.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ResolvedPlace extends Coordinates {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  formatted: string;
}

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return new Promise(resolve => {
      Geolocation.requestAuthorization(
        () => resolve(true),
        () => resolve(false),
      );
    });
  }
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location permission',
        message: 'Selorg uses your location to bind you to the nearest darkstore.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });
}

function pick(components: any[], type: string): string {
  return (
    components?.find((c: any) => Array.isArray(c.types) && c.types.includes(type))
      ?.long_name || ''
  );
}

export async function reverseGeocode(coords: Coordinates): Promise<ResolvedPlace> {
  const base: ResolvedPlace = {
    ...coords,
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    formatted: '',
  };
  if (!GOOGLE_MAPS_API_KEY) return base;

  try {
    const url =
      'https://maps.googleapis.com/maps/api/geocode/json' +
      `?latlng=${coords.latitude},${coords.longitude}` +
      `&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    const result = json?.results?.[0];
    if (!result) return base;

    const c = result.address_components || [];
    const streetNumber = pick(c, 'street_number');
    const route = pick(c, 'route');
    const premise = pick(c, 'premise') || pick(c, 'subpremise');
    const sublocality =
      pick(c, 'sublocality_level_1') ||
      pick(c, 'sublocality') ||
      pick(c, 'neighborhood');

    const line1 =
      [premise, streetNumber, route].filter(Boolean).join(' ').trim() ||
      String(result.formatted_address || '').split(',')[0];

    return {
      ...base,
      line1,
      line2: sublocality,
      city: pick(c, 'locality') || pick(c, 'administrative_area_level_2'),
      state: pick(c, 'administrative_area_level_1'),
      pincode: pick(c, 'postal_code'),
      formatted: result.formatted_address || '',
    };
  } catch {
    return base;
  }
}

/** Permission + fix + reverse-geocode in one call. Throws on denial / no fix. */
export async function resolveCurrentPlace(): Promise<ResolvedPlace> {
  const ok = await requestLocationPermission();
  if (!ok) {
    const e = new Error('Location permission denied');
    (e as any).code = 'PERMISSION_DENIED';
    throw e;
  }
  const coords = await getCurrentPosition();
  return reverseGeocode(coords);
}
