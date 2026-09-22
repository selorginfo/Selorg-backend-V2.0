import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthClient } from "./AuthClient";
import { AuthPageSkeleton } from "@/components/ui/page-skeletons";

export const metadata: Metadata = {
  title: "Log in or sign up",
};

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <AuthClient />
    </Suspense>
  );
}
