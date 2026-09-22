"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { deliveryService, type DeliveryEstimate, type DeliveryFeeResult } from "@/services/deliveryService";
import { storeService, type AssignedStore } from "@/services/storeService";
import { useAddresses } from "./AddressContext";
import { useCart } from "./CartContext";
import { useAppConfig } from "./AppConfigContext";

export interface DeliveryState {
  loading: boolean;
  error: string | null;
  serviceable: boolean;
  store: AssignedStore | null;
  estimate: DeliveryEstimate | null;
  fee: DeliveryFeeResult | null;
  /** Human-readable ETA e.g. "10-15 mins" */
  promiseText: string | null;
  /** Minutes for display (midpoint of estimate) */
  estimatedMinutes: number | null;
  /** Delivery fee from backend (includes platform fee in totalFee) */
  deliveryFee: number;
  platformFee: number;
  freeDeliveryApplied: boolean;
}

const DEFAULT_STATE: DeliveryState = {
  loading: false,
  error: null,
  serviceable: true,
  store: null,
  estimate: null,
  fee: null,
  promiseText: null,
  estimatedMinutes: null,
  deliveryFee: 0,
  platformFee: 0,
  freeDeliveryApplied: false,
};

interface DeliveryContextValue extends DeliveryState {
  refresh: () => Promise<void>;
}

const DeliveryContext = createContext<DeliveryContextValue | null>(null);

export function DeliveryProvider({ children }: { children: ReactNode }) {
  const { addresses, selectedAddr } = useAddresses();
  const { lines, totals } = useCart();
  const { pricing } = useAppConfig();
  const [state, setState] = useState<DeliveryState>(DEFAULT_STATE);

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedAddr),
    [addresses, selectedAddr],
  );

  // Primitive deps only — `lines` is a new array whenever Cart's productCache
  // identity changes, which previously re-fired store/delivery APIs on idle.
  const cartItemCount = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines]);
  const orderSubtotal = totals.sub;
  const lat = selectedAddress?.latitude ?? null;
  const lng = selectedAddress?.longitude ?? null;
  const freeDeliveryThreshold = pricing.freeDeliveryThreshold;
  const fallbackDeliveryFee = pricing.deliveryFee;

  const refresh = useCallback(async () => {
    if (lat == null || lng == null) {
      const fee = orderSubtotal >= freeDeliveryThreshold ? 0 : fallbackDeliveryFee;
      const free = orderSubtotal >= freeDeliveryThreshold;
      setState((s) => {
        if (
          !s.loading &&
          s.promiseText == null &&
          s.estimatedMinutes == null &&
          s.deliveryFee === fee &&
          s.platformFee === 0 &&
          s.freeDeliveryApplied === free
        ) {
          return s;
        }
        return {
          ...s,
          loading: false,
          promiseText: null,
          estimatedMinutes: null,
          deliveryFee: fee,
          platformFee: 0,
          freeDeliveryApplied: free,
        };
      });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    if (process.env.NODE_ENV === "development") {
      console.debug(
        "[API REQUEST]\nmethod: POST|GET\nendpoint: /store/assign + /delivery/estimate + /delivery/fee\ntrigger: DeliveryProvider.refresh\ntimestamp:",
        new Date().toISOString(),
      );
    }
    try {
      const assign = await storeService.assignStore(lat, lng);

      if (!assign.serviceable) {
        setState({
          ...DEFAULT_STATE,
          loading: false,
          serviceable: false,
          error: assign.message,
          deliveryFee: fallbackDeliveryFee,
        });
        return;
      }

      const storeId = assign.store.id;
      const [estimate, fee] = await Promise.all([
        deliveryService.getEstimate({
          storeId,
          latitude: lat,
          longitude: lng,
          cartItemCount: cartItemCount || 1,
        }),
        deliveryService.getFee({
          storeId,
          latitude: lat,
          longitude: lng,
          orderTotal: orderSubtotal,
        }),
      ]);

      setState({
        loading: false,
        error: null,
        serviceable: true,
        store: assign.store,
        estimate,
        fee,
        promiseText: estimate.promiseText,
        estimatedMinutes: estimate.estimatedMinutes,
        deliveryFee: fee.deliveryFee,
        platformFee: fee.platformFee,
        freeDeliveryApplied: fee.freeDeliveryApplied,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Could not calculate delivery",
        deliveryFee: orderSubtotal >= freeDeliveryThreshold ? 0 : fallbackDeliveryFee,
        freeDeliveryApplied: orderSubtotal >= freeDeliveryThreshold,
      }));
    }
  }, [lat, lng, cartItemCount, orderSubtotal, freeDeliveryThreshold, fallbackDeliveryFee]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <DeliveryContext.Provider value={{ ...state, refresh }}>
      {children}
    </DeliveryContext.Provider>
  );
}

export function useDelivery(): DeliveryContextValue {
  const ctx = useContext(DeliveryContext);
  if (!ctx) throw new Error("useDelivery must be used within a DeliveryProvider");
  return ctx;
}

/** Hook for guest users without full delivery context — returns static bootstrap pricing only. */
export function useDeliveryEtaLabel(fallbackMinutes?: number): string | null {
  const ctx = useContext(DeliveryContext);
  if (ctx?.promiseText) return ctx.promiseText;
  if (ctx?.estimatedMinutes != null) return `${ctx.estimatedMinutes} min`;
  if (fallbackMinutes != null) return `${fallbackMinutes} min`;
  return null;
}
