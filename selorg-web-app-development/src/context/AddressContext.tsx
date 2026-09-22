"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { detectAndResolveLocation, GeolocationError } from "@/services/locationService";
import * as addressService from "@/services/addressService";
import { addressesLookSame } from "@/lib/formatAddress";
import { getToken, onAuthChange } from "@/services/session";
import type { Address, AddressFormValues } from "@/types";
import { useUI } from "./UIContext";
import { useAccountReset } from "./AccountResetContext";

interface AddressContextValue {
  addresses: Address[];
  loading: boolean;
  selectedAddr: string | null;
  /** Selects delivery address and persists it as default (API when logged in). */
  selectAddr: (id: string) => Promise<void>;
  addAddress: (values: AddressFormValues) => Promise<void>;
  updateAddress: (id: string, values: AddressFormValues) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  locOpen: boolean;
  setLocOpen: (open: boolean) => void;
  locQuery: string;
  setLocQuery: (query: string) => void;
  locDetecting: boolean;
  detectLocation: () => Promise<void>;
}

const AddressContext = createContext<AddressContextValue | null>(null);

// Guest (not-logged-in) addresses persist locally only — there's no account to
// save them against yet. Once the user logs in, the real backend list takes over.
const GUEST_STORAGE_KEY = "selorg_guest_addresses";

function loadGuestAddresses(): Address[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as Address[]) : [];
    // Re-derive display fields so older fat line1 values don't keep duplicating.
    return list.map((a) =>
      addressService.toDisplayAddress({
        id: a.id,
        def: a.def,
        type: a.type,
        line1: a.line1,
        line2: a.line2,
        landmark: a.landmark,
        city: a.city,
        state: a.state,
        pincode: a.pincode,
        latitude: a.latitude,
        longitude: a.longitude,
      }),
    );
  } catch {
    return [];
  }
}

function saveGuestAddresses(addresses: Address[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(addresses));
  } catch {
    /* ignore quota/availability errors */
  }
}

export function AddressProvider({ children }: { children: ReactNode }) {
  const { showToast, openModal } = useUI();
  const { resetToken } = useAccountReset();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [locOpen, setLocOpen] = useState(false);
  const [locQuery, setLocQuery] = useState("");
  const [locDetecting, setLocDetecting] = useState(false);
  /** Last GPS coords from detect — attached to new addresses when the form has no pin. */
  const [pendingCoords, setPendingCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const selectDefault = useCallback((list: Address[]) => {
    setSelectedAddr((prev) => {
      if (prev && list.some((a) => a.id === prev)) return prev;
      return list.find((a) => a.def)?.id ?? list[0]?.id ?? null;
    });
  }, []);

  // Load addresses from the backend when signed in; from local storage otherwise.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (getToken()) {
        setLoading(true);
        try {
          const list = await addressService.listAddresses();
          if (cancelled) return;
          setAddresses(list);
          selectDefault(list);
        } catch {
          if (!cancelled) showToast("Could not load your saved addresses");
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        const list = loadGuestAddresses();
        setAddresses(list);
        selectDefault(list);
      }
    };

    load();
    const unsubscribe = onAuthChange(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [selectDefault, showToast]);

  // A fresh signup starts with no saved addresses. Adjusting state during render (rather than
  // in an effect) mirrors React's recommended pattern for reacting to an external signal change.
  const [handledResetToken, setHandledResetToken] = useState(resetToken);
  if (resetToken !== handledResetToken) {
    setHandledResetToken(resetToken);
    if (!getToken()) {
      setAddresses([]);
      setSelectedAddr(null);
      saveGuestAddresses([]);
    }
  }

  const selectAddr = useCallback(
    async (id: string) => {
      setSelectedAddr(id);
      if (getToken()) {
        try {
          await addressService.setDefaultAddress(id);
          setAddresses((prev) => prev.map((a) => ({ ...a, def: a.id === id })));
        } catch {
          showToast("Address selected here, but could not sync default to your account");
        }
        return;
      }
      setAddresses((prev) => {
        const next = prev.map((a) => ({ ...a, def: a.id === id }));
        saveGuestAddresses(next);
        return next;
      });
    },
    [showToast],
  );

  const addAddress = useCallback(
    async (values: AddressFormValues) => {
      const withCoords: AddressFormValues = {
        ...values,
        line1: values.line1.trim(),
        line2: values.line2.trim(),
        landmark: values.landmark.trim(),
        city: values.city.trim(),
        state: values.state.trim(),
        pincode: values.pincode.trim(),
        latitude: values.latitude ?? pendingCoords?.latitude,
        longitude: values.longitude ?? pendingCoords?.longitude,
      };

      const duplicate = addresses.find((a) => addressesLookSame(a, withCoords));
      if (duplicate) {
        setSelectedAddr(duplicate.id);
        showToast("This address is already saved");
        if (getToken()) {
          try {
            await addressService.setDefaultAddress(duplicate.id);
            setAddresses((prev) => prev.map((a) => ({ ...a, def: a.id === duplicate.id })));
          } catch {
            /* selection already set locally */
          }
        } else {
          setAddresses((prev) => {
            const next = prev.map((a) => ({ ...a, def: a.id === duplicate.id }));
            saveGuestAddresses(next);
            return next;
          });
        }
        return;
      }

      if (getToken()) {
        try {
          const created = await addressService.createAddress(withCoords);
          setAddresses((prev) => {
            const next = [...prev, created];
            if (created.def) return next.map((a) => ({ ...a, def: a.id === created.id }));
            return next;
          });
          setSelectedAddr(created.id);
          showToast("Address added");
          try {
            await addressService.setDefaultAddress(created.id);
            setAddresses((prev) => prev.map((a) => ({ ...a, def: a.id === created.id })));
          } catch {
            /* selection already set locally */
          }
        } catch (err) {
          showToast("Could not add address");
          throw err;
        }
        return;
      }
      setAddresses((prev) => {
        const id = `a${Date.now()}`;
        const created = addressService.toDisplayAddress({
          ...withCoords,
          id,
          def: true,
        });
        const next = [...prev.map((a) => ({ ...a, def: false })), created];
        saveGuestAddresses(next);
        setSelectedAddr(id);
        return next;
      });
      showToast("Address added");
    },
    [addresses, pendingCoords, showToast],
  );

  const updateAddress = useCallback(
    async (id: string, values: AddressFormValues) => {
      if (getToken()) {
        try {
          const updated = await addressService.updateAddress(id, values);
          setAddresses((prev) => prev.map((a) => (a.id === id ? updated : a)));
          showToast("Address updated");
        } catch (err) {
          showToast("Could not update address");
          throw err;
        }
        return;
      }
      setAddresses((prev) => {
        const next = prev.map((a) => {
          if (a.id !== id) return a;
          return addressService.toDisplayAddress({
            ...values,
            id,
            def: a.def,
          });
        });
        saveGuestAddresses(next);
        return next;
      });
      showToast("Address updated");
    },
    [showToast],
  );

  const deleteAddress = useCallback(
    async (id: string) => {
      if (getToken()) {
        try {
          await addressService.deleteAddress(id);
          setAddresses((prev) => prev.filter((a) => a.id !== id));
          setSelectedAddr((prev) => (prev === id ? null : prev));
          showToast("Address removed");
        } catch {
          showToast("Could not remove address");
        }
        return;
      }
      setAddresses((prev) => {
        const next = prev.filter((a) => a.id !== id);
        saveGuestAddresses(next);
        return next;
      });
      setSelectedAddr((prev) => (prev === id ? null : prev));
      showToast("Address removed");
    },
    [showToast],
  );

  const setDefaultAddress = useCallback(
    async (id: string) => {
      if (getToken()) {
        try {
          await addressService.setDefaultAddress(id);
          setAddresses((prev) => prev.map((a) => ({ ...a, def: a.id === id })));
        } catch {
          showToast("Could not set default address");
        }
        return;
      }
      setAddresses((prev) => {
        const next = prev.map((a) => ({ ...a, def: a.id === id }));
        saveGuestAddresses(next);
        return next;
      });
    },
    [showToast],
  );

  /**
   * Real browser geolocation (permission prompt) → reverse geocode → open
   * address modal for user confirmation. Never auto-saves, never uses IP/fake coords.
   */
  const detectLocation = useCallback(async () => {
    setLocDetecting(true);
    try {
      const { coords, resolved } = await detectAndResolveLocation();
      setPendingCoords({ latitude: coords.latitude, longitude: coords.longitude });

      const draft: AddressFormValues = {
        type: "Other",
        line1: resolved?.line1?.trim() || "",
        line2: resolved?.line2?.trim() || "",
        landmark: "",
        city: resolved?.city?.trim() || "",
        state: resolved?.state?.trim() || "",
        pincode: resolved?.pincode?.trim() || "",
        latitude: coords.latitude,
        longitude: coords.longitude,
      };

      setLocOpen(false);
      openModal({ type: "address", draft });
      if (!resolved?.city) {
        showToast(
          "Location found. Address lookup failed — confirm the pin and fill missing fields.",
        );
      } else if (!resolved.line1) {
        // Google often has no premise for a GPS pin — only the house/flat is missing.
        showToast("Location found. Add your house / flat number to finish.");
      }
    } catch (err) {
      const message =
        err instanceof GeolocationError ? err.message : "Could not detect your location";
      showToast(message);
    } finally {
      setLocDetecting(false);
    }
  }, [showToast, openModal]);

  return (
    <AddressContext.Provider
      value={{
        addresses,
        loading,
        selectedAddr,
        selectAddr,
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        locOpen,
        setLocOpen,
        locQuery,
        setLocQuery,
        locDetecting,
        detectLocation,
      }}
    >
      {children}
    </AddressContext.Provider>
  );
}

export function useAddresses(): AddressContextValue {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error("useAddresses must be used within an AddressProvider");
  return ctx;
}
