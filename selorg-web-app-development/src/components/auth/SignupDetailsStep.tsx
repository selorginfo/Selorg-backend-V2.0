"use client";

import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SignupStepper } from "./SignupStepper";

export function SignupDetailsStep() {
  const { signup, setSignupField, signupError, completeSignup, dialCode, auth } = useAuth();

  return (
    <div className="animate-authStepIn">
      <SignupStepper step={3} />
      <div className="my-[14px] inline-flex animate-badgePop items-center gap-[7px] rounded-[20px] bg-accent-tint px-3 py-1.5 text-xs font-extrabold text-accent-dark">
        <CheckCircle2 size={14} />
        {dialCode} {auth.phone} verified
      </div>
      <h2 className="font-sans text-[20px] font-extrabold tracking-[-0.5px] min-[480px]:text-[22px]">
        Almost there
      </h2>
      <p className="mb-4 mt-1 text-[13px] text-muted">
        Tell us a little about you to finish setting up.
      </p>

      <div className="flex flex-col gap-[13px]">
        <Input
          label="Full name"
          autoFocus
          value={signup.name}
          onChange={(e) => setSignupField("name", e.target.value)}
          placeholder="Your full name"
        />
        <Input
          label="Email (optional)"
          value={signup.email}
          onChange={(e) => setSignupField("email", e.target.value)}
          placeholder="you@email.com"
        />
      </div>

      {signupError ? (
        <div className="mt-3.5 rounded-[11px] border border-[#ffd9cf] bg-[#fff2ef] px-3.5 py-2.5 text-[12.5px] font-bold text-warn">
          {signupError}
        </div>
      ) : null}

      <Button onClick={completeSignup} className="mt-5 w-full">
        Create my account
      </Button>
    </div>
  );
}
