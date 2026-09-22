import { Suspense } from "react";
import { PaymentClient } from "../checkout/payment/PaymentClient";
import { PaymentPageSkeleton } from "@/components/ui/page-skeletons";

/** Worldline/Paynimo gateway returnUrl lands here (selorg-service payments.controller). */
export default function PaymentReturnPage() {
  return (
    <Suspense fallback={<PaymentPageSkeleton />}>
      <PaymentClient />
    </Suspense>
  );
}
