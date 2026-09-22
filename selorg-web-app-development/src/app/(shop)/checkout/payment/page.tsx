import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentClient } from "./PaymentClient";
import { PaymentPageSkeleton } from "@/components/ui/page-skeletons";

export const metadata: Metadata = { title: "Payment" };

export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentPageSkeleton />}>
      <PaymentClient />
    </Suspense>
  );
}
