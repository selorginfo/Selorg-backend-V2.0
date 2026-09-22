import type { Metadata } from "next";
import { PoliciesClient } from "@/app/(shop)/policies/PoliciesClient";

export const metadata: Metadata = { title: "Policies" };

export default function AccountPoliciesPage() {
  return <PoliciesClient embedded />;
}
