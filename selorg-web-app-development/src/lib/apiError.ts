import { ApiError } from "@/services/api";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: "No account found for this number. Please sign up first.",
  EMAIL_EXISTS: "An account with this email already exists. Please log in.",
  PHONE_EXISTS: "An account with this phone number already exists. Please log in.",
  EMAIL_NOT_CONFIGURED: "Email OTP is not configured. Please use Mobile or WhatsApp login.",
  OTP_PROVIDER_ERROR: "Could not deliver the verification code. Please try again in a moment.",
  OTP_LOCKED: "Too many incorrect attempts. Please request a new code.",
  VALIDATION_ERROR: "Please check your input and try again.",
  NETWORK_ERROR: "Cannot reach the server. Make sure selorg-service is running and reachable.",
};

/** Maps backend ApiError codes/messages to user-safe auth-form text. */
export function formatAuthError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.appCode && AUTH_ERROR_MESSAGES[err.appCode]) {
      return AUTH_ERROR_MESSAGES[err.appCode]!;
    }
    if (err.status === 0) {
      return AUTH_ERROR_MESSAGES.NETWORK_ERROR!;
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
