"use client";

import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AccountNav } from "@/components/account/AccountNav";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const loggedIn = useRequireAuth();
  if (!loggedIn) return null;

  return (
    <div className="wrap pb-9 pt-[18px]">
      <h1 className="mb-4 font-sans text-[28px] font-extrabold tracking-[-0.7px]">My account</h1>
      <div className="grid grid-cols-1 items-start gap-[26px] min-[861px]:grid-cols-[250px_minmax(0,1fr)]">
        <AccountNav />
        <div className="min-w-0 w-full">{children}</div>
      </div>
    </div>
  );
}
