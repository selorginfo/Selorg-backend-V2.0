"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TOAST_DURATION_MS } from "@/lib/constants";
import type { ModalKind, ToastState } from "@/types";

interface UIContextValue {
  toast: ToastState | null;
  showToast: (message: string) => void;
  modal: ModalKind;
  openModal: (modal: NonNullable<ModalKind>) => void;
  closeModal: () => void;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  const openModal = useCallback((m: NonNullable<ModalKind>) => setModal(m), []);
  const closeModal = useCallback(() => setModal(null), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <UIContext.Provider
      value={{
        toast,
        showToast,
        modal,
        openModal,
        closeModal,
        drawerOpen,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within a UIProvider");
  return ctx;
}
