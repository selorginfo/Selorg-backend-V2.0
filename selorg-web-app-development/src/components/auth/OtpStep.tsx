"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { SignupStepper } from "./SignupStepper";

function useResendCountdown(resendAvailableAt?: number) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!resendAvailableAt) { setSecondsLeft(0); return; }
    const tick = () => {
      const diff = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [resendAvailableAt]);

  return secondsLeft;
}

export function OtpStep() {
  const { auth, backToPhone, resendOtp, setOtp, verifyOtp, dialCode, otpError } = useAuth();
  const secondsLeft = useResendCountdown(auth.resendAvailableAt);

  const handleVerify = async () => {
    await verifyOtp();
  };

  const isEmail = auth.method === "email";
  const canResend = secondsLeft === 0 && !auth.submitting;

  return (
    <div className="animate-authStepIn">
      {auth.mode === "signup" ? <SignupStepper step={2} /> : null}
      <h2 className="font-sans text-[20px] font-extrabold tracking-[-0.5px] min-[480px]:text-[22px]">
        {isEmail ? "Verify your email" : "Verify your number"}
      </h2>
      <p className="mb-4 mt-1 text-[13px] text-muted">
        Enter the 4-digit code sent to{" "}
        {isEmail ? auth.phone || "your email" : `${dialCode} ${auth.phone || "your number"}`}.
      </p>

      <OtpInput length={4} value={auth.otp} onChange={setOtp} error={otpError} autoFocus />

      <div className="mt-3 text-center text-[12.5px] text-muted">
        Didn&apos;t get it?{" "}
        {canResend ? (
          <button
            type="button"
            onClick={resendOtp}
            className="font-bold text-accent-dark"
          >
            Resend OTP
          </button>
        ) : (
          <span className="font-bold text-muted opacity-60">
            Resend in {secondsLeft}s
          </span>
        )}
      </div>

      <Button
        onClick={() => void handleVerify()}
        disabled={auth.submitting || auth.otp.length < 4}
        className="mt-[22px] w-full"
      >
        {auth.submitting ? "Verifying…" : "Verify & continue"}
      </Button>

      <button
        type="button"
        onClick={backToPhone}
        disabled={auth.submitting}
        className="mt-3 w-full text-center text-[13px] font-bold text-accent-dark disabled:opacity-50"
      >
        {isEmail ? "Change email address" : "Change number"}
      </button>
    </div>
  );
}
