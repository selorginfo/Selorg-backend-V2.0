import type { Metadata } from "next";
import { Suspense } from "react";
import { FailedClient } from "./FailedClient";
import { OrderResultPageSkeleton } from "@/components/ui/page-skeletons";

export const metadata: Metadata = { title: "Order Failed" };

export default function CheckoutFailedPage() {
  return (
    <Suspense fallback={<OrderResultPageSkeleton />}>
      <FailedClient />
    </Suspense>
  );
}
