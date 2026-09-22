"use client";

import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";

export function PhoneOtpModal() {
  const { modal } = useUI();
  const { phoneOtp, setPhoneOtp, phoneOtpError, verifyPhoneChange, cancelPhoneOtp } = useAuth();
  const open = modal?.type === "phoneOtp";

  return (
    <Modal open={open} onClose={cancelPhoneOtp} title="Verify your new number">
      <p className="mb-4 text-sm text-muted">
        Enter the 4-digit code sent to your new mobile number.
      </p>
      <OtpInput length={4} value={phoneOtp} onChange={setPhoneOtp} error={phoneOtpError} autoFocus />
      <div className="mt-5 flex gap-3">
        <Button variant="outline" onClick={cancelPhoneOtp} className="flex-1">
          Cancel
        </Button>
        <Button onClick={verifyPhoneChange} className="flex-1">
          Verify
        </Button>
      </div>
    </Modal>
  );
}
