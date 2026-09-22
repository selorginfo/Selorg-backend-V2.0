"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { appConfigService, type AppConfig } from "@/services/appConfigService";
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/lib/cart";
import { WALLET_MAX_TOPUP, WALLET_PRESETS } from "@/lib/constants";
import {
  DEFAULT_SUPPORT_CONTACT,
  type SupportContactConfig,
} from "@/lib/supportContact";

interface AppConfigContextValue {
  loaded: boolean;
  pricing: PricingConfig;
  walletPresets: number[];
  walletMaxTopup: number;
  paymentMethods: AppConfig["paymentMethods"];
  /** Admin-authored search box copy (`appConfig.search` / `homeConfig`). */
  searchPlaceholder: string;
  support: SupportContactConfig;
}

const DEFAULT_SEARCH_PLACEHOLDER = "Search for products…";

const DEFAULT_VALUE: AppConfigContextValue = {
  loaded: false,
  pricing: DEFAULT_PRICING_CONFIG,
  walletPresets: [...WALLET_PRESETS],
  walletMaxTopup: WALLET_MAX_TOPUP,
  paymentMethods: [],
  searchPlaceholder: DEFAULT_SEARCH_PLACEHOLDER,
  support: DEFAULT_SUPPORT_CONTACT,
};

function resolveSupport(raw: AppConfig["support"] | undefined): SupportContactConfig {
  if (!raw) return DEFAULT_SUPPORT_CONTACT;
  return {
    phone: raw.supportPhone || raw.contactPhone || DEFAULT_SUPPORT_CONTACT.phone,
    email: raw.supportEmail || raw.contactEmail || DEFAULT_SUPPORT_CONTACT.email,
    whatsapp: raw.whatsappNumber || raw.supportPhone || DEFAULT_SUPPORT_CONTACT.whatsapp,
    workingHours: raw.workingHours || DEFAULT_SUPPORT_CONTACT.workingHours,
    responseTime: raw.responseTime || DEFAULT_SUPPORT_CONTACT.responseTime,
    liveChatEnabled: raw.liveChatEnabled !== false,
  };
}

const AppConfigContext = createContext<AppConfigContextValue>(DEFAULT_VALUE);

/**
 * Fetches GET /customer/bootstrap once and exposes the *effective* checkout
 * pricing (delivery fee / free-delivery threshold / handling charge — already
 * resolved server-side, see appConfigService.ts docstring), wallet top-up
 * config, and the enabled payment-methods list. Falls back to
 * `DEFAULT_PRICING_CONFIG` (matching the backend's own hardcoded defaults)
 * until the request resolves, or forever for guests/offline use.
 */
export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<AppConfigContextValue>(DEFAULT_VALUE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bootstrap = await appConfigService.getBootstrap();
      const config = bootstrap?.appConfig;
      if (cancelled || !config) return;
      setValue({
        loaded: true,
        pricing: {
          freeDeliveryThreshold: config.checkout?.freeDeliveryMinAmount ?? DEFAULT_PRICING_CONFIG.freeDeliveryThreshold,
          deliveryFee: config.checkout?.deliveryFee ?? DEFAULT_PRICING_CONFIG.deliveryFee,
          handlingFee: config.checkout?.handlingCharge ?? DEFAULT_PRICING_CONFIG.handlingFee,
        },
        walletPresets: config.wallet?.topUpAmounts?.length ? config.wallet.topUpAmounts : [...WALLET_PRESETS],
        walletMaxTopup: config.wallet?.maxTopUpAmount ?? WALLET_MAX_TOPUP,
        paymentMethods: config.paymentMethods ?? [],
        searchPlaceholder:
          config.search?.placeholder ||
          bootstrap.homeConfig?.searchPlaceholder ||
          DEFAULT_SEARCH_PLACEHOLDER,
        support: resolveSupport(config.support),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfigContextValue {
  return useContext(AppConfigContext);
}
