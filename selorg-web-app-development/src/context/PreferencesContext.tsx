"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { notificationsService } from "@/services/notificationsService";
import { getToken, onAuthChange } from "@/services/session";

export interface Preferences {
  veg: boolean;
  offers: boolean;
  sms: boolean;
  whatsapp: boolean;
}

const INITIAL_PREFS: Preferences = { veg: true, offers: true, sms: false, whatsapp: true };

interface PreferencesContextValue {
  prefs: Preferences;
  togglePref: (key: keyof Preferences) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * `sms`/`whatsapp`/`offers` map onto selorg-service's real
 * `GET/PUT /customer/notifications/preferences` (top-level channel booleans +
 * `categories.offers`). `veg` ("Show organic-only") has no backend field at
 * all — selorg-service's CustomerUser/notification schemas don't have a
 * dietary-preference concept — so it stays local-only for every account.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(INITIAL_PREFS);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!getToken()) return;
      try {
        const real = await notificationsService.getPreferences();
        if (cancelled) return;
        setPrefs((s) => ({
          ...s,
          sms: real.sms,
          whatsapp: real.whatsapp,
          offers: real.categories?.offers?.push ?? real.push,
        }));
      } catch {
        /* keep local defaults */
      }
    };
    load();
    const unsubscribe = onAuthChange(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const togglePref = useCallback((key: keyof Preferences) => {
    setPrefs((s) => {
      const next = { ...s, [key]: !s[key] };
      if ((key === "sms" || key === "whatsapp" || key === "offers") && getToken()) {
        const patch =
          key === "offers"
            ? { categories: { offers: { push: next.offers, inApp: next.offers, sms: next.offers, whatsapp: next.offers, email: next.offers } } }
            : { [key]: next[key] };
        notificationsService.updatePreferences(patch).catch((err) => console.warn("[preferences] sync failed:", err));
      }
      return next;
    });
  }, []);

  return (
    <PreferencesContext.Provider value={{ prefs, togglePref }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within a PreferencesProvider");
  return ctx;
}
