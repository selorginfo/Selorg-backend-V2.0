import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmationClient } from "./ConfirmationClient";
import { OrderResultPageSkeleton } from "@/components/ui/page-skeletons";

export const metadata: Metadata = { title: "Order Confirmed" };

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<OrderResultPageSkeleton />}>
      <ConfirmationClient />
    </Suspense>
  );
}
