"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface AccountResetContextValue {
  /** 0 until the first reset; changes to a fresh non-zero value on every subsequent signup. */
  resetToken: number;
  triggerAccountReset: () => void;
}

const AccountResetContext = createContext<AccountResetContextValue | null>(null);

/**
 * A brand-new signup should start with a clean slate (no seed addresses/orders), but those
 * live in sibling providers AuthContext can't reach directly. This context sits above all of
 * them so AuthContext can signal "reset" and each domain provider can independently react.
 */
export function AccountResetProvider({ children }: { children: ReactNode }) {
  const [resetToken, setResetToken] = useState(0);
  const triggerAccountReset = useCallback(() => setResetToken(Date.now()), []);

  return (
    <AccountResetContext.Provider value={{ resetToken, triggerAccountReset }}>
      {children}
    </AccountResetContext.Provider>
  );
}

export function useAccountReset(): AccountResetContextValue {
  const ctx = useContext(AccountResetContext);
  if (!ctx) throw new Error("useAccountReset must be used within an AccountResetProvider");
  return ctx;
}
