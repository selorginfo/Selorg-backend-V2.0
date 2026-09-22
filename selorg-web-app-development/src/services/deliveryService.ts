import { apiGet } from "./api";

export interface DeliveryEstimate {
  estimatedMinutes: number;
  promiseText: string;
  breakdown: {
    pickPackTime: number;
    travelTime: number;
    bufferTime: number;
    itemBonus: number;
    distanceKm: number;
  };
}

/** Mirrors the amounts POST /orders bills with — never the indicative dynamic
 *  pricing, which the backend keeps inside `breakdown`. */
export interface DeliveryFeeResult {
  deliveryFee: number;
  platformFee: number;
  totalFee: number;
  freeDeliveryApplied: boolean;
  freeDeliveryThreshold: number;
  handlingCharge?: number;
  surgeMult: number;
  breakdown: {
    base: number;
    distanceSurcharge: number;
    surgeMult: number;
    distanceKm: number;
    indicativeDynamicFee?: number;
    smallOrderPlatformFee?: number;
  };
}

export const deliveryService = {
  async getEstimate(params: {
    storeId: string;
    latitude: number;
    longitude: number;
    cartItemCount?: number;
  }): Promise<DeliveryEstimate> {
    const q = new URLSearchParams({
      storeId: params.storeId,
      latitude: String(params.latitude),
      longitude: String(params.longitude),
    });
    if (params.cartItemCount != null) q.set("cartItemCount", String(params.cartItemCount));
    return apiGet<DeliveryEstimate>(`/delivery/estimate?${q.toString()}`, { skipAuth: true });
  },

  async getFee(params: {
    storeId: string;
    latitude: number;
    longitude: number;
    orderTotal?: number;
  }): Promise<DeliveryFeeResult> {
    const q = new URLSearchParams({
      storeId: params.storeId,
      latitude: String(params.latitude),
      longitude: String(params.longitude),
    });
    if (params.orderTotal != null) q.set("orderTotal", String(params.orderTotal));
    return apiGet<DeliveryFeeResult>(`/delivery/fee?${q.toString()}`, { skipAuth: true });
  },
};
