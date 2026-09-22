import type { Metadata } from "next";
import { Suspense } from "react";
import { PoliciesClient } from "./PoliciesClient";

export const metadata: Metadata = {
  title: "Policies",
  description:
    "Selorg terms, privacy, refund, cancellation, delivery, payments, wallet, and grievance policies.",
};

function PoliciesFallback() {
  return (
    <div className="wrap max-w-[1100px] pb-14 pt-6 sm:pt-8">
      <div className="h-[140px] animate-pulse rounded-[22px] bg-line/50" />
      <div className="mt-6 h-[420px] animate-pulse rounded-2xl bg-line/40" />
    </div>
  );
}

export default function PoliciesPage() {
  return (
    <Suspense fallback={<PoliciesFallback />}>
      <PoliciesClient />
    </Suspense>
  );
}
