import SelorgApi from '../api';

export interface LocationSuggestion {
  placeId?: string;
  description?: string;
  mainText?: string;
  secondaryText?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}

const unwrap = <T,>(res: unknown): T =>
  (res && typeof res === 'object' && 'data' in res ? (res as { data: T }).data : res) as T;

export const locationsApi = {
  getSuggestions: (params: { q: string; latitude?: number; longitude?: number }): Promise<LocationSuggestion[]> =>
    SelorgApi.get('/locations/suggestions', { query: params }).then(unwrap<LocationSuggestion[]>),

  getApproximate: (): Promise<{ latitude: number; longitude: number } | null> =>
    SelorgApi.get('/locations/approximate').then(unwrap<{ latitude: number; longitude: number } | null>),
};
