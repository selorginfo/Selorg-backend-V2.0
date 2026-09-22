"use client";

import type { ReactNode } from "react";
import { AccountResetProvider } from "./AccountResetContext";
import { AppConfigProvider } from "./AppConfigContext";
import { CategoriesProvider } from "./CategoriesContext";
import { UIProvider } from "./UIContext";
import { AuthProvider } from "./AuthContext";
import { PreferencesProvider } from "./PreferencesContext";
import { AddressProvider } from "./AddressContext";
import { WalletProvider } from "./WalletContext";
import { CartProvider } from "./CartContext";
import { CheckoutProvider } from "./CheckoutContext";
import { OrdersProvider } from "./OrdersContext";
import { RecentlyViewedProvider } from "./RecentlyViewedContext";
import { DeliveryProvider } from "./DeliveryContext";
import { NotificationsInboxProvider } from "./NotificationsInboxContext";

/**
 * Nesting order matters: each provider below may read from the ones above it
 * via hooks (e.g. CartContext reads wallet balance + AppConfig pricing for
 * totals math, OrdersContext reads cart/address/wallet/checkout to build a
 * placed order).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AccountResetProvider>
      <AppConfigProvider>
        <CategoriesProvider>
          <UIProvider>
            <AuthProvider>
              <NotificationsInboxProvider>
              <PreferencesProvider>
                <RecentlyViewedProvider>
                  <AddressProvider>
                    <WalletProvider>
                      <CartProvider>
                        <DeliveryProvider>
                        <CheckoutProvider>
                          <OrdersProvider>{children}</OrdersProvider>
                        </CheckoutProvider>
                        </DeliveryProvider>
                      </CartProvider>
                    </WalletProvider>
                  </AddressProvider>
                </RecentlyViewedProvider>
              </PreferencesProvider>
              </NotificationsInboxProvider>
            </AuthProvider>
          </UIProvider>
        </CategoriesProvider>
      </AppConfigProvider>
    </AccountResetProvider>
  );
}
