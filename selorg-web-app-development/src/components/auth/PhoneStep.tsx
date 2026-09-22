"use client";

import { useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { AuthMethod } from "@/types";
import { DialCodePicker } from "./DialCodePicker";
import { SignupStepper } from "./SignupStepper";

export function PhoneStep() {
  const {
    auth,
    setAuthMode,
    setAuthMethod,
    setAuthPhone,
    signupError,
    dialCode,
    dialOpen,
    setDialOpen,
    setDialCode,
    startSignup,
    startLogin,
  } = useAuth();
  const identifierRef = useRef<HTMLInputElement>(null);

  const isSignup = auth.mode === "signup";
  const isEmail = auth.method === "email";

  const loginMethods: { id: AuthMethod; label: string }[] = [
    { id: "mobile", label: "Mobile" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "email", label: "Email" },
  ];
  const signupChannels: { id: AuthMethod; label: string }[] = [
    { id: "mobile", label: "SMS" },
    { id: "whatsapp", label: "WhatsApp" },
  ];

  /** Read the live input value so Continue works even if a synthetic fill
   *  updated the DOM ahead of React state (Playwright / autofill). */
  const readIdentifier = () => {
    const raw = (identifierRef.current?.value ?? auth.phone).trim();
    if (isEmail) return raw;
    return raw.replace(/\D/g, "").slice(0, 10);
  };

  const handleContinue = () => {
    const identifier = readIdentifier();
    if (identifier !== auth.phone) setAuthPhone(identifier);
    void (isSignup ? startSignup(identifier) : startLogin(identifier));
  };

  return (
    <div className="animate-authStepIn">
      <div className="mb-4 flex gap-1 rounded-[12px] bg-accent-tint p-1 min-[720px]:mb-4">
        <button
          type="button"
          onClick={() => setAuthMode("login")}
          className={cn(
            "flex-1 rounded-[9px] py-2 text-[13px] font-extrabold transition-all duration-200 min-[480px]:py-2.5",
            !isSignup
              ? "bg-white text-accent-dark shadow-[0_2px_8px_-2px_rgba(40,60,20,.22)]"
              : "bg-transparent text-muted",
          )}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => setAuthMode("signup")}
          className={cn(
            "flex-1 rounded-[9px] py-2 text-[13px] font-extrabold transition-all duration-200 min-[480px]:py-2.5",
            isSignup
              ? "bg-white text-accent-dark shadow-[0_2px_8px_-2px_rgba(40,60,20,.22)]"
              : "bg-transparent text-muted",
          )}
        >
          Sign up
        </button>
      </div>

      {isSignup ? <SignupStepper step={1} /> : null}

      <h2 className="font-sans text-[20px] font-extrabold tracking-tight min-[480px]:text-[22px]">
        {isSignup ? "Create your account" : "Welcome back"}
      </h2>
      <p className="mb-3.5 mt-1 text-[13px] text-muted min-[480px]:mb-4">
        {isSignup
          ? "We'll verify your mobile number with a one-time code."
          : "Log in to continue to fresh & organic."}
      </p>

      {!isSignup ? (
        <div className="mb-4 flex gap-1 rounded-xl bg-accent-tint p-1 min-[560px]:mb-5 min-[560px]:gap-1.5 min-[560px]:p-[5px]">
          {loginMethods.map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => setAuthMethod(m.id)}
              className={cn(
                "flex-1 rounded-[9px] px-0.5 py-2 text-[12.5px] font-bold min-[560px]:px-1 min-[560px]:py-[9px] min-[560px]:text-[13px]",
                auth.method === m.id ? "bg-white text-accent-dark shadow-sm" : "text-muted",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : null}

      <label className="text-[12.5px] font-bold text-muted">
        {isEmail ? "Email address" : "Mobile number"} <span className="text-warn">*</span>
      </label>
      {isEmail ? (
        <div className="mt-2 flex h-12 items-center rounded-xl border-[1.5px] border-line px-3.5 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15 min-[560px]:h-[52px]">
          <input
            ref={identifierRef}
            value={auth.phone}
            onChange={(e) => setAuthPhone(e.target.value)}
            placeholder="you@email.com"
            className="h-full min-w-0 flex-1 border-none bg-transparent text-[15px] font-semibold outline-none min-[560px]:text-base"
          />
        </div>
      ) : (
        <div className="mt-2 flex h-12 min-w-0 items-center rounded-xl border-[1.5px] border-line focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15 min-[560px]:h-[52px]">
          <DialCodePicker
            dialCode={dialCode}
            dialOpen={dialOpen}
            setDialOpen={setDialOpen}
            setDialCode={setDialCode}
          />
          <span className="h-6.5 w-px shrink-0 bg-line" />
          <input
            ref={identifierRef}
            value={auth.phone}
            onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            placeholder="Mobile number"
            className="h-full min-w-0 flex-1 border-none bg-transparent px-3 text-[15px] font-semibold outline-none min-[560px]:px-3.5 min-[560px]:text-base"
          />
        </div>
      )}

      {isSignup ? (
        <div className="mt-4">
          <div className="mb-2 text-[12.5px] font-bold text-muted">Send my code via</div>
          <div className="flex gap-1.5 rounded-xl bg-accent-tint p-[5px]">
            {signupChannels.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => setAuthMethod(m.id)}
                className={cn(
                  "flex-1 rounded-[9px] px-1 py-[9px] text-[13px] font-bold",
                  auth.method === m.id ? "bg-white text-accent-dark shadow-sm" : "text-muted",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {signupError ? (
        <div className="mt-3.5 rounded-[11px] border border-[#ffd9cf] bg-[#fff2ef] px-3.5 py-2.5 text-[12.5px] font-bold text-warn">
          {signupError}
        </div>
      ) : null}

      <Button
        type="button"
        onClick={handleContinue}
        disabled={auth.submitting}
        className={cn("w-full", isSignup ? "mt-5" : "mt-[22px]")}
      >
        {auth.submitting
          ? "Sending code…"
          : isSignup
            ? "Send verification code"
            : "Continue"}
      </Button>

      {isSignup ? (
        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-muted">
          By signing up you agree to Selorg&apos;s{" "}
          <a href="/account/policies#terms" className="font-bold text-accent-dark">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/account/policies#privacy" className="font-bold text-accent-dark">
            Privacy Policy
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
