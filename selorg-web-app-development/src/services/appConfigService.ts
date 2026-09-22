import { apiGet } from "./api";

/**
 * GET /customer/bootstrap — the one-call app-startup payload. `appConfig.checkout`
 * is rewritten server-side before being returned so it always reflects the
 * *effective* pricing the backend will actually bill with (see
 * deliveryPricing.service.ts) — this is the right place to source checkout
 * constants from at runtime instead of hardcoding them client-side.
 */

export interface AppCheckoutConfig {
  handlingCharge: number;
  deliveryFee: number;
  freeDeliveryMinAmount: number;
  minOrderAmount?: number;
  tipAmounts?: number[];
  cancelReasons?: string[];
}

export interface AppWalletConfig {
  topUpAmounts: number[];
  maxTopUpAmount: number;
}

export interface AppPaymentMethodConfig {
  key: string;
  label: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  isActive: boolean;
  order?: number;
}

export interface AppConfig {
  checkout: AppCheckoutConfig;
  wallet: AppWalletConfig;
  paymentMethods: AppPaymentMethodConfig[];
  featureFlags?: Record<string, boolean | number>;
  search?: { placeholder?: string; popularSearches?: string[] };
  support?: {
    contactPhone?: string;
    contactEmail?: string;
    supportPhone?: string;
    supportEmail?: string;
    whatsappNumber?: string;
    workingHours?: string;
    responseTime?: string;
    liveChatEnabled?: boolean;
  };
}

export interface BootstrapPayload {
  appConfig: AppConfig;
  homeConfig?: {
    searchPlaceholder?: string;
    deliveryTypeLabel?: string;
    categorySectionTitle?: string;
  } | null;
  featureFlags?: Record<string, unknown>;
}

export const appConfigService = {
  /** GET /customer/bootstrap */
  async getBootstrap(): Promise<BootstrapPayload | undefined> {
    try {
      return await apiGet<BootstrapPayload>("/bootstrap");
    } catch {
      return undefined;
    }
  },

  /** GET /customer/app-config — used if only the config (not the rest of bootstrap) is needed. */
  async getAppConfig(): Promise<AppConfig | undefined> {
    try {
      return await apiGet<AppConfig>("/app-config");
    } catch {
      return undefined;
    }
  },
};
