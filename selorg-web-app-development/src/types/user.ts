export interface UserProfile {
  name: string;
  email: string;
  phone: string;
}

export type AuthMode = "login" | "signup";
export type AuthMethod = "mobile" | "whatsapp" | "email";
export type AuthStep = "phone" | "otp" | "details";

export interface AuthState {
  loggedIn: boolean;
  mode: AuthMode;
  method: AuthMethod;
  step: AuthStep;
  phone: string;
  otp: string;
  /** OTP session id from send-otp, required by verify-otp/resend-otp. */
  sessionId: string;
  /** True while an OTP send/verify/resend request is in flight. */
  submitting: boolean;
  /** Unix ms timestamp after which resend is allowed (from backend cooldown). */
  resendAvailableAt?: number;
}

export interface SignupDraft {
  name: string;
  phone: string;
  email: string;
  referral: string;
}

export interface DialCodeOption {
  iso: string;
  c: string;
  d: string;
  flag: string;
}
