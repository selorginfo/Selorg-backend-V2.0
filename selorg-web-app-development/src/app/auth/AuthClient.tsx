"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AuthBrandPanel, AuthMobileBrand } from "@/components/auth/AuthBrandPanel";
import { PhoneStep } from "@/components/auth/PhoneStep";
import { OtpStep } from "@/components/auth/OtpStep";
import { SignupDetailsStep } from "@/components/auth/SignupDetailsStep";

export function AuthClient() {
  const { auth } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (auth.loggedIn) {
      const redirect =
        searchParams.get("redirect") || searchParams.get("returnTo");
      router.replace(redirect && redirect.startsWith("/") ? redirect : "/");
    }
  }, [auth.loggedIn, router, searchParams]);

  return (
    <div
      className="flex min-h-dvh items-center justify-center overflow-y-auto p-2.5 min-[480px]:p-3.5 min-[720px]:p-4"
      style={{
        background: "radial-gradient(900px 480px at 18% -10%, #eef4e6, #ffffff)",
      }}
    >
      {/* Single-column below 720px. Split brand/form from 720px. Height follows
          form content so short / landscape viewports stay within the frame. */}
      <div
        className="grid w-full max-w-[min(100%,360px)] animate-authCardIn grid-cols-1 overflow-hidden rounded-[16px] border border-line bg-white min-[480px]:max-w-[380px] min-[480px]:rounded-[18px] min-[720px]:max-w-[680px] min-[720px]:grid-cols-2 min-[720px]:rounded-[20px] min-[900px]:max-w-[720px] min-[900px]:rounded-[22px] max-h-[calc(100dvh-1.25rem)] min-[720px]:max-h-[calc(100dvh-2rem)]"
        style={{ boxShadow: "0 24px 56px -28px rgba(40,60,20,.4)" }}
      >
        <AuthBrandPanel />
        <div className="flex min-h-0 min-w-0 flex-col justify-center overflow-y-auto">
          <AuthMobileBrand />
          <div className="p-4 min-[480px]:p-5 min-[720px]:p-[28px_24px] min-[900px]:p-[32px_28px]">
            {auth.step === "phone" ? <PhoneStep /> : null}
            {auth.step === "otp" ? <OtpStep /> : null}
            {auth.step === "details" ? <SignupDetailsStep /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
