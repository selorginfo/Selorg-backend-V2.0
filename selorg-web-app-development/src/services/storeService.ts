import { apiGet, apiPostBody } from "./api";

export interface AssignedStore {
  id: string;
  name: string;
  code?: string;
  distanceKm: number;
  avgPickPackTime?: number;
  operatingHours?: unknown;
}

export type StoreAssignResult =
  | { serviceable: true; store: AssignedStore }
  | { serviceable: false; message: string; nearestStore?: string; distanceKm?: number };

export const storeService = {
  async assignStore(latitude: number, longitude: number): Promise<StoreAssignResult> {
    const body = await apiPostBody<StoreAssignResult & { success?: boolean }>("/store/assign", {
      latitude,
      longitude,
    }, { skipAuth: true });
    if (body && "serviceable" in body) return body;
    return { serviceable: false, message: "Could not assign a store for your location." };
  },

  async getInventory(storeId: string, page = 1, limit = 50) {
    // Backend wraps inventory in the standard `{ success, data: { inventory } }` envelope.
    return apiGet<{ inventory: { productId: string; quantity: number }[] }>(
      `/store/${encodeURIComponent(storeId)}/inventory?page=${page}&limit=${limit}`,
      { skipAuth: true },
    );
  },
};
