import type { Metadata } from "next";
import { Suspense } from "react";
import { WalletClient } from "./WalletClient";

export const metadata: Metadata = { title: "Wallet" };

function WalletFallback() {
  return (
    <div className="flex flex-col gap-5">
      <div className="h-[110px] animate-pulse rounded-app bg-line/60" />
      <div className="h-[180px] animate-pulse rounded-app bg-line/40" />
      <div className="h-[120px] animate-pulse rounded-app bg-line/40" />
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<WalletFallback />}>
      <WalletClient />
    </Suspense>
  );
}
