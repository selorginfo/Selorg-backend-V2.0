import type { Metadata } from "next";
import { Suspense } from "react";
import { HelpClient } from "./HelpClient";

export const metadata: Metadata = {
  title: "Help & Support",
  description: "Call, chat, or email Selorg support. Track tickets, FAQs, and policies.",
};

function HelpFallback() {
  return (
    <div className="wrap max-w-[980px] pb-14 pt-6 sm:pt-8">
      <div className="h-[180px] animate-pulse rounded-[22px] bg-[#1a2116]/60" />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="h-[140px] animate-pulse rounded-2xl bg-line/50" />
        <div className="h-[140px] animate-pulse rounded-2xl bg-line/50" />
        <div className="h-[140px] animate-pulse rounded-2xl bg-line/50" />
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <Suspense fallback={<HelpFallback />}>
      <HelpClient />
    </Suspense>
  );
}
