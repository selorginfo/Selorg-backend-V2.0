import { isValidEmail, isValidPhone10 } from "@/lib/validation";
import { apiPost, apiGet, apiPut } from "./api";
import { clearSession, getSessionUser, getToken, saveSession, type SessionUser } from "./session";

export interface AuthValidationResult {
  ok: boolean;
  error?: string;
}

export function validateSignupPhone(phone: string): AuthValidationResult {
  if (!isValidPhone10(phone)) {
    return { ok: false, error: "Enter a valid 10-digit mobile number" };
  }
  return { ok: true };
}

/** E.164-ish formatting expected by selorg-service (bare 10-digit -> +91XXXXXXXXXX). */
function formatPhoneForApi(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return phone.trim();
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  return phone.trim().startsWith("+") ? phone.trim() : `+${digits}`;
}

interface SendOtpResponse {
  sessionId: string;
  channel: string;
  resendCooldownSeconds: number;
  /** 'failed' means the provider rejected the message — no code is on its way.
   *  Production turns that into an error response; non-production still returns a
   *  session so the server-logged code can be used. */
  deliveryStatus?: "sent" | "failed" | "pending";
  devNote?: string;
}

interface VerifyOtpResponse {
  accessToken: string;
  isNewUser: boolean;
  user: {
    _id: string;
    phoneNumber: string | null;
    email: string | null;
    name: string;
    phoneVerified: boolean;
  };
}

export type OtpIntent = "login" | "signup";

/** POST /auth/send-otp — starts a login/signup OTP session. `identifier` is a
 *  phone number for the "sms"/"whatsapp" channels, or an email address for
 *  "email" — sent as the matching field, never both. Returns the sessionId
 *  that must be passed to verifyOtp/resendOtp.
 *
 *  Request body matches selorg-customer-app / backend contract:
 *  { phoneNumber, preferredChannel, intent } or { email, preferredChannel, intent }. */
export async function sendOtp(
  identifier: string,
  channel: "sms" | "whatsapp" | "email" = "sms",
  intent?: OtpIntent,
): Promise<SendOtpResponse> {
  const base =
    channel === "email"
      ? { email: identifier.trim().toLowerCase(), preferredChannel: channel }
      : { phoneNumber: formatPhoneForApi(identifier), preferredChannel: channel };
  const body = intent ? { ...base, intent } : base;
  return apiPost<SendOtpResponse>("/auth/send-otp", body, { skipAuth: true });
}

/** POST /auth/verify-otp — on success, persists the session (token + user). */
export async function verifyOtp(sessionId: string, otp: string): Promise<VerifyOtpResponse> {
  const result = await apiPost<VerifyOtpResponse>(
    "/auth/verify-otp",
    { sessionId, otp: otp.trim() },
    { skipAuth: true },
  );
  const user: SessionUser = {
    id: result.user._id,
    name: result.user.name,
    email: result.user.email,
    phone: result.user.phoneNumber,
    phoneVerified: result.user.phoneVerified,
  };
  saveSession(result.accessToken, user);
  return result;
}

export async function resendOtp(
  sessionId: string,
): Promise<{ channel: string; resendCooldownSeconds: number; deliveryStatus?: "sent" | "failed" | "pending"; devNote?: string }> {
  return apiPost("/auth/resend-otp", { sessionId }, { skipAuth: true });
}

export function logout(): void {
  // Best-effort server-side invalidation; never block local logout on it.
  apiPost("/auth/logout").catch(() => undefined);
  clearSession();
}

export interface ProfileResponse {
  _id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  phoneVerified: boolean;
}

export async function getProfile(): Promise<ProfileResponse> {
  return apiGet<ProfileResponse>("/user/profile");
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

export async function updateProfile(input: UpdateProfileInput): Promise<ProfileResponse> {
  const result = await apiPut<ProfileResponse>("/user/profile", input);
  const token = getToken();
  const current = getSessionUser();
  if (token) {
    saveSession(token, current ? { ...current, name: result.name, email: result.email } : undefined);
  }
  return result;
}

export function validateProfileEmail(email: string): AuthValidationResult {
  if (email && !isValidEmail(email)) return { ok: false, error: "Enter a valid email address" };
  return { ok: true };
}

// ── Phone-change re-verification (profile editing) ──────────────────────────
// Uses the authenticated link-phone endpoints so a real OTP is sent/verified
// against the new number before it's saved to the profile.

export async function sendPhoneChangeOtp(newPhone: string): Promise<{ sessionId: string; channel: string }> {
  return apiPost("/auth/link-phone/send-otp", { phoneNumber: formatPhoneForApi(newPhone) });
}

export async function verifyPhoneChangeOtp(
  sessionId: string,
  otp: string,
): Promise<AuthValidationResult> {
  try {
    await apiPost("/auth/link-phone/verify-otp", { sessionId, otp: otp.trim() });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Incorrect code. Please try again." };
  }
}
