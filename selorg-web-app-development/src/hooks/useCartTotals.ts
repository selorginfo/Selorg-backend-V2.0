"use client";

import { useMemo } from "react";
import { calculateTotals } from "@/lib/cart";
import { useAppConfig } from "@/context/AppConfigContext";
import { useCart } from "@/context/CartContext";
import { useDelivery } from "@/context/DeliveryContext";
import { useWallet } from "@/context/WalletContext";
import type { CartTotals } from "@/types";

/**
 * Cart totals enriched with live delivery fee / ETA from the backend when available.
 * Falls back to bootstrap pricing config when delivery APIs are unavailable.
 */
export function useCartTotals(): CartTotals {
  const { lines, couponApplied } = useCart();
  const { wallet } = useWallet();
  const { pricing } = useAppConfig();
  const { deliveryFee, platformFee, freeDeliveryApplied, fee } = useDelivery();

  return useMemo(() => {
    const effectiveDelivery = fee != null ? deliveryFee : undefined;
    const effectivePlatform = fee != null ? platformFee : 0;
    const threshold = fee?.freeDeliveryThreshold ?? pricing.freeDeliveryThreshold;
    // The handling charge is billed by POST /orders from the same config the fee
    // endpoint reports, so prefer that value and only fall back to bootstrap.
    const effectiveHandling = fee?.handlingCharge ?? pricing.handlingFee;

    const base = calculateTotals(
      lines,
      couponApplied,
      wallet.useAtCheckout,
      wallet.balance,
      {
        freeDeliveryThreshold: threshold,
        deliveryFee: effectiveDelivery ?? pricing.deliveryFee,
        handlingFee: effectiveHandling + effectivePlatform,
      },
    );

    if (freeDeliveryApplied && fee != null) {
      return { ...base, delivery: 0, belowFree: false, amtToFree: 0 };
    }

    return base;
  }, [
    lines,
    couponApplied,
    wallet.useAtCheckout,
    wallet.balance,
    pricing,
    deliveryFee,
    platformFee,
    freeDeliveryApplied,
    fee,
  ]);
}
