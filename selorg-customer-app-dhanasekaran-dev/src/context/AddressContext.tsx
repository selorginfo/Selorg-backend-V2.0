import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { addressApi } from '../services/address.service';
import type { ApiAddress } from '../services/address.service';
import { Storage } from '../api/storage';
import { showToast } from '../utils/toast';

/** Address shape used by screens — maps from API response. */
export interface Address {
  id: string;
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}

function toAddress(raw: ApiAddress): Address {
  return {
    id: raw._id,
    label: raw.label || 'Home',
    line1: raw.line1 || '',
    line2: raw.line2 || '',
    city: raw.city || '',
    state: raw.state || '',
    pincode: raw.pincode || '',
    latitude: raw.latitude ?? 0,
    longitude: raw.longitude ?? 0,
    isDefault: Boolean(raw.isDefault),
  };
}

interface AddressContextType {
  addresses: Address[];
  loading: boolean;
  selectedAddressId: string;
  selectedAddress: Address | undefined;
  selectAddress: (id: string) => void;
  setDefaultAddress: (id: string) => Promise<void>;
  saveAddress: (draft: Omit<Address, 'id' | 'isDefault'> & { id?: string | null }) => Promise<boolean>;
  deleteAddress: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AddressContext = createContext<AddressContextType | undefined>(undefined);

export const AddressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');


  const loadAddresses = useCallback(async () => {
    if (!Storage.getItem('accessToken')) {
      setAddresses([]);
      return;
    }
    setLoading(true);
    try {
      const raw = await addressApi.listAddresses();
      const mapped = raw.map(toAddress);
      setAddresses(mapped);
      const defaultAddr = mapped.find(a => a.isDefault) || mapped[0];
      if (defaultAddr) {
        setSelectedAddressId(prev => prev && mapped.some(a => a.id === prev) ? prev : defaultAddr.id);
      }
    } catch {
      // keep previous list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAddresses(); }, [loadAddresses]);

  const selectedAddress = useMemo(
    () => addresses.find(a => a.id === selectedAddressId) || addresses.find(a => a.isDefault),
    [addresses, selectedAddressId],
  );

  const selectAddress = useCallback((id: string) => setSelectedAddressId(id), []);

  const setDefaultAddress = useCallback(async (id: string) => {
    try {
      await addressApi.setDefaultAddress(id);
      setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
      setSelectedAddressId(id);
      showToast('Default address updated');
    } catch {
      showToast('Could not update default address', 'err');
    }
  }, []);

  const saveAddress = useCallback(async (draft: Omit<Address, 'id' | 'isDefault'> & { id?: string | null }): Promise<boolean> => {
    if (!draft.line1.trim() || !draft.pincode.trim() || !draft.city.trim()) {
      showToast('Fill address line, city & pincode', 'err');
      return false;
    }
    try {
      const payload = {
        label: draft.label,
        line1: draft.line1,
        line2: draft.line2 || undefined,
        city: draft.city,
        state: draft.state || undefined,
        pincode: draft.pincode || undefined,
        latitude: draft.latitude || undefined,
        longitude: draft.longitude || undefined,
      };
      if (draft.id) {
        const updated = await addressApi.updateAddress(draft.id, payload);
        setAddresses(prev => prev.map(a => a.id === draft.id ? toAddress(updated) : a));
      } else {
        const created = await addressApi.createAddress(payload);
        const addr = toAddress(created);
        setAddresses(prev => {
          const next = [...prev, addr];
          if (addr.isDefault) return next.map(a => ({ ...a, isDefault: a.id === addr.id }));
          return next;
        });
        if (addresses.length === 0) setSelectedAddressId(addr.id);
      }
      showToast('Address saved');
      return true;
    } catch {
      showToast('Could not save address', 'err');
      return false;
    }
  }, [addresses.length]);

  const deleteAddress = useCallback(async (id: string) => {
    try {
      await addressApi.deleteAddress(id);
      setAddresses(prev => prev.filter(a => a.id !== id));
      if (selectedAddressId === id) setSelectedAddressId('');
      showToast('Address deleted');
    } catch {
      showToast('Could not delete address', 'err');
    }
  }, [selectedAddressId]);

  const value = useMemo<AddressContextType>(() => ({
    addresses, loading, selectedAddressId, selectedAddress,
    selectAddress, setDefaultAddress, saveAddress, deleteAddress, refresh: loadAddresses,
  }), [addresses, loading, selectedAddressId, selectedAddress, selectAddress, setDefaultAddress, saveAddress, deleteAddress, loadAddresses]);

  return <AddressContext.Provider value={value}>{children}</AddressContext.Provider>;
};

export const useAddress = () => {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error('useAddress must be used within an AddressProvider');
  return ctx;
};
