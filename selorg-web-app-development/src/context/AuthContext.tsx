"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as authService from "@/services/authService";
import { getSessionUser, getToken, onAuthChange } from "@/services/session";
import { formatAuthError } from "@/lib/apiError";
import { isValidEmail, isValidPhone10, last10Digits } from "@/lib/validation";
import { DIAL_CODES } from "@/lib/constants";
import type {
  AuthMethod,
  AuthMode,
  AuthState,
  SignupDraft,
  UserProfile,
} from "@/types";
import { useUI } from "./UIContext";
import { useAccountReset } from "./AccountResetContext";

interface AuthContextValue {
  /** False until the client has read persisted session state (avoids SSR/client mismatch). */
  authReady: boolean;
  auth: AuthState;
  profile: UserProfile;
  signup: SignupDraft;
  signupError: string;
  dialCode: string;
  dialOpen: boolean;
  setDialOpen: (open: boolean) => void;
  setDialCode: (code: string) => void;
  setAuthMode: (mode: AuthMode) => void;
  setAuthMethod: (method: AuthMethod) => void;
  setAuthPhone: (phone: string) => void;
  setSignupField: (field: keyof SignupDraft, value: string) => void;
  startSignup: (identifierOverride?: string) => Promise<void>;
  startLogin: (identifierOverride?: string) => Promise<void>;
  resendOtp: () => void;
  setOtp: (otp: string) => void;
  verifyOtp: () => Promise<boolean>;
  backToPhone: () => void;
  completeSignup: () => Promise<void>;
  logout: () => void;
  // profile editing
  profileEditing: boolean;
  profileDraft: UserProfile;
  profileError: string;
  /** Backend rule: once a phone is OTP-verified it is immutable
   *  (`PHONE_LOCKED`), so the number is shown read-only rather than offering a
   *  re-verification the server would reject. */
  phoneLocked: boolean;
  startEditProfile: () => void;
  cancelEditProfile: () => void;
  setProfileField: (field: keyof UserProfile, value: string) => void;
  saveProfile: () => Promise<void>;
  // phone-change re-verification
  phoneOtp: string;
  phoneOtpError: string;
  otpError: string;
  setPhoneOtp: (otp: string) => void;
  verifyPhoneChange: () => Promise<void>;
  cancelPhoneOtp: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_AUTH: AuthState = {
  loggedIn: false,
  mode: "login",
  method: "mobile",
  step: "phone",
  phone: "",
  otp: "",
  sessionId: "",
  submitting: false,
};

const INITIAL_SIGNUP: SignupDraft = { name: "", phone: "", email: "", referral: "" };

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast, closeModal, openModal } = useUI();
  const { triggerAccountReset } = useAccountReset();
  const [authReady, setAuthReady] = useState(false);
  const [auth, setAuth] = useState<AuthState>(INITIAL_AUTH);
  const authRef = useRef(auth);
  authRef.current = auth;
  const [profile, setProfile] = useState<UserProfile>({ name: "", email: "", phone: "" });
  const [signup, setSignup] = useState<SignupDraft>(INITIAL_SIGNUP);
  const [signupError, setSignupError] = useState("");
  const [dialCode, setDialCode] = useState(DIAL_CODES[0]!.d);
  const [dialOpen, setDialOpen] = useState(false);

  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState<UserProfile>({ name: "", email: "", phone: "" });
  const [profileError, setProfileError] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpError, setPhoneOtpError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [phoneChangeSessionId, setPhoneChangeSessionId] = useState("");
  const [pendingProfileSave, setPendingProfileSave] = useState<UserProfile | null>(null);
  const [phoneLocked, setPhoneLocked] = useState(false);

  // Restore a persisted session on mount / when it changes in another tab.
  useEffect(() => {
    const hydrate = () => {
      const token = getToken();
      const user = getSessionUser();
      if (token) {
        // Token alone is enough to treat the session as authenticated. Requiring
        // a cached user blob previously left CartContext / guards idle when the
        // user cookie was missing or unreadable despite a valid token.
        if (user) {
          const restored: UserProfile = {
            name: user.name || "",
            email: user.email || "",
            phone: user.phone || "",
          };
          setProfile(restored);
          setProfileDraft(restored);
          setPhoneLocked(Boolean(user.phoneVerified && user.phone));
        }
        setAuth((s) => ({ ...s, loggedIn: true }));
      } else {
        setPhoneLocked(false);
        setAuth((s) => ({ ...s, loggedIn: false }));
      }
      setAuthReady(true);
    };
    hydrate();
    return onAuthChange(hydrate);
  }, []);

  const setAuthMode = useCallback((mode: AuthMode) => {
    setAuth((s) => ({ ...s, mode, step: "phone" }));
    setSignupError("");
  }, []);

  const setAuthMethod = useCallback((method: AuthMethod) => {
    setAuth((s) => ({ ...s, method }));
  }, []);

  const setAuthPhone = useCallback((phone: string) => {
    setAuth((s) => ({ ...s, phone }));
  }, []);

  const setSignupField = useCallback((field: keyof SignupDraft, value: string) => {
    setSignup((s) => ({ ...s, [field]: value }));
  }, []);

  const channelForMethod = (method: AuthMethod): "sms" | "whatsapp" | "email" =>
    method === "whatsapp" ? "whatsapp" : method === "email" ? "email" : "sms";

  /** The backend still hands back a usable session when the provider rejected the
   *  message (non-production only), so without this the OTP screen would sit there
   *  waiting for a code that was never sent. */
  const warnIfUndelivered = useCallback(
    (deliveryStatus?: string, devNote?: string) => {
      if (deliveryStatus === "failed") {
        showToast(devNote ?? "OTP could not be sent — SMS provider failed. Check server logs for the code.");
      }
    },
    [showToast],
  );

  const startSignup = useCallback(async (identifierOverride?: string) => {
    const current = authRef.current;
    const identifier = (identifierOverride ?? current.phone).trim();
    const snapshot = { ...current, phone: identifier };
    const result = validateSignupPhoneOrEmail(snapshot);
    if (!result.ok) {
      setSignupError(result.error ?? "Invalid phone number");
      return;
    }
    setSignupError("");
    setOtpError("");
    setSignup((s) => ({ ...s, phone: identifier }));
    setAuth((s) => ({ ...s, phone: identifier, submitting: true }));
    try {
      const { sessionId, deliveryStatus, devNote, resendCooldownSeconds } = await authService.sendOtp(
        identifier,
        channelForMethod(snapshot.method),
        "signup",
      );
      const resendAvailableAt = Date.now() + (resendCooldownSeconds ?? 30) * 1000;
      setAuth((s) => ({ ...s, step: "otp", sessionId, submitting: false, resendAvailableAt }));
      warnIfUndelivered(deliveryStatus, devNote);
    } catch (err) {
      setSignupError(formatAuthError(err, "Could not send the code. Please try again."));
      setAuth((s) => ({ ...s, submitting: false }));
    }
  }, [warnIfUndelivered]);

  const startLogin = useCallback(async (identifierOverride?: string) => {
    const current = authRef.current;
    const identifier = (identifierOverride ?? current.phone).trim();
    const snapshot = { ...current, phone: identifier };
    const result = validateSignupPhoneOrEmail(snapshot);
    if (!result.ok) {
      setSignupError(result.error ?? "Enter a valid mobile number or email address");
      return;
    }
    setSignupError("");
    setOtpError("");
    setAuth((s) => ({ ...s, phone: identifier, submitting: true }));
    try {
      const { sessionId, deliveryStatus, devNote, resendCooldownSeconds } = await authService.sendOtp(
        identifier,
        channelForMethod(snapshot.method),
        "login",
      );
      const resendAvailableAt = Date.now() + (resendCooldownSeconds ?? 30) * 1000;
      setAuth((s) => ({ ...s, step: "otp", sessionId, submitting: false, resendAvailableAt }));
      warnIfUndelivered(deliveryStatus, devNote);
    } catch (err) {
      setSignupError(formatAuthError(err, "Could not send the code. Please try again."));
      setAuth((s) => ({ ...s, submitting: false }));
    }
  }, [warnIfUndelivered]);

  const resendOtp = useCallback(() => {
    if (!auth.sessionId) return;
    authService
      .resendOtp(auth.sessionId)
      .then((r) => {
        const resendAvailableAt = Date.now() + (r?.resendCooldownSeconds ?? 30) * 1000;
        setAuth((s) => ({ ...s, resendAvailableAt }));
        if (r?.deliveryStatus === "failed") warnIfUndelivered(r.deliveryStatus, (r as { devNote?: string }).devNote);
        else showToast("OTP resent");
      })
      .catch((err) => showToast(formatAuthError(err, "Could not resend the code")));
  }, [auth.sessionId, showToast, warnIfUndelivered]);

  const setOtp = useCallback((otp: string) => {
    setOtpError("");
    setAuth((s) => ({ ...s, otp }));
  }, []);

  const backToPhone = useCallback(() => {
    setOtpError("");
    setAuth((s) => ({ ...s, step: "phone", otp: "", sessionId: "" }));
  }, []);

  /** Verifies the OTP against selorg-service. Signup advances to the details
   *  step; login logs the user straight in with the profile the server returns. */
  const verifyOtp = useCallback(async (): Promise<boolean> => {
    if (!auth.sessionId || !auth.otp) return false;
    setAuth((s) => ({ ...s, submitting: true }));
    try {
      const result = await authService.verifyOtp(auth.sessionId, auth.otp);
      setAuth((s) => ({ ...s, submitting: false }));
      if (auth.mode === "signup") {
        setSignup((s) => ({ ...s, phone: result.user.phoneNumber || auth.phone }));
        setAuth((s) => ({ ...s, step: "details" }));
      } else {
        let loadedProfile: UserProfile = {
          name: result.user.name || "",
          email: result.user.email || "",
          phone: result.user.phoneNumber || "",
        };
        try {
          const fresh = await authService.getProfile();
          loadedProfile = {
            name: fresh.name || loadedProfile.name,
            email: fresh.email || loadedProfile.email,
            phone: fresh.phoneNumber || loadedProfile.phone,
          };
        } catch {
          // use profile from verify-otp response
        }
        setProfile(loadedProfile);
        setProfileDraft(loadedProfile);
        setAuth((s) => ({ ...s, loggedIn: true }));
        showToast(
          loadedProfile.name
            ? `Welcome back, ${loadedProfile.name.split(" ")[0]}!`
            : "Welcome back!",
        );
      }
      return true;
    } catch (err) {
      setAuth((s) => ({ ...s, submitting: false }));
      setOtpError(formatAuthError(err, "Incorrect or expired code. Please try again."));
      return false;
    }
  }, [auth.mode, auth.otp, auth.phone, auth.sessionId, showToast]);

  const completeSignup = useCallback(async () => {
    if (!signup.name.trim()) {
      setSignupError("Please enter your full name");
      return;
    }
    if (signup.email && !isValidEmail(signup.email)) {
      setSignupError("Enter a valid email address");
      return;
    }
    setSignupError("");
    const firstName = signup.name.trim().split(" ")[0] ?? signup.name.trim();
    try {
      const updated = await authService.updateProfile({
        name: signup.name.trim(),
        email: signup.email || undefined,
      });
      const newProfile: UserProfile = {
        name: updated.name,
        email: updated.email || "",
        phone: updated.phoneNumber || `${dialCode} ${signup.phone || auth.phone}`,
      };
      setProfile(newProfile);
      setProfileDraft(newProfile);
      setAuth((s) => ({ ...s, loggedIn: true }));
      triggerAccountReset();
      showToast(`Welcome to Selorg, ${firstName}!`);
    } catch (err) {
      setSignupError(formatAuthError(err, "Could not save your details. Please try again."));
    }
  }, [auth.phone, dialCode, showToast, signup, triggerAccountReset]);

  const logout = useCallback(() => {
    authService.logout();
    setAuth(INITIAL_AUTH);
    setProfile({ name: "", email: "", phone: "" });
    setProfileDraft({ name: "", email: "", phone: "" });
    closeModal();
  }, [closeModal]);

  const startEditProfile = useCallback(() => {
    setProfileDraft(profile);
    setProfileError("");
    setProfileEditing(true);
  }, [profile]);

  const cancelEditProfile = useCallback(() => {
    setProfileEditing(false);
    setProfileError("");
  }, []);

  const setProfileFieldFn = useCallback((field: keyof UserProfile, value: string) => {
    setProfileDraft((s) => ({ ...s, [field]: value }));
  }, []);

  const saveProfile = useCallback(async () => {
    if (!profileDraft.name.trim() || profileDraft.name.trim().length < 2) {
      setProfileError("Name looks too short");
      return;
    }
    if (!isValidEmail(profileDraft.email)) {
      setProfileError("Enter a valid email address");
      return;
    }
    if (!phoneLocked && !isValidPhone10(profileDraft.phone)) {
      setProfileError("Enter a valid 10-digit mobile number");
      return;
    }
    setProfileError("");

    const currentDigits = last10Digits(profile.phone);
    const nextDigits = last10Digits(profileDraft.phone);

    if (!phoneLocked && currentDigits !== nextDigits) {
      try {
        const { sessionId } = await authService.sendPhoneChangeOtp(profileDraft.phone);
        setPhoneChangeSessionId(sessionId);
        setPendingProfileSave(profileDraft);
        setPhoneOtp("");
        setPhoneOtpError("");
        openModal({ type: "phoneOtp" });
      } catch (err) {
        setProfileError(formatAuthError(err, "Could not send a verification code to that number."));
      }
      return;
    }

    try {
      const updated = await authService.updateProfile({
        name: profileDraft.name.trim(),
        email: profileDraft.email,
      });
      setProfile({
        ...profileDraft,
        name: updated.name,
        email: updated.email || profileDraft.email,
        phone: phoneLocked ? profile.phone : profileDraft.phone,
      });
      setProfileEditing(false);
    } catch (err) {
      setProfileError(formatAuthError(err, "Could not update your profile."));
    }
  }, [openModal, phoneLocked, profile.phone, profileDraft]);

  const setPhoneOtpFn = useCallback((otp: string) => setPhoneOtp(otp), []);

  const verifyPhoneChange = useCallback(async () => {
    if (!phoneChangeSessionId) return;
    const result = await authService.verifyPhoneChangeOtp(phoneChangeSessionId, phoneOtp);
    if (!result.ok) {
      setPhoneOtpError(result.error ?? "Incorrect code");
      return;
    }
    if (pendingProfileSave) {
      try {
        const updated = await authService.updateProfile({
          name: pendingProfileSave.name.trim(),
          email: pendingProfileSave.email,
        });
        setProfile({ ...pendingProfileSave, name: updated.name, email: updated.email || pendingProfileSave.email });
      } catch (err) {
        setPhoneOtpError(formatAuthError(err, "Could not save your changes."));
        return;
      }
    }
    setPendingProfileSave(null);
    setPhoneChangeSessionId("");
    setPhoneOtpError("");
    setProfileEditing(false);
    closeModal();
    showToast("Profile updated");
  }, [closeModal, pendingProfileSave, phoneChangeSessionId, phoneOtp, showToast]);

  const cancelPhoneOtp = useCallback(() => {
    setPendingProfileSave(null);
    setPhoneChangeSessionId("");
    setPhoneOtpError("");
    closeModal();
  }, [closeModal]);

  return (
    <AuthContext.Provider
      value={{
        authReady,
        auth,
        profile,
        signup,
        signupError,
        dialCode,
        dialOpen,
        setDialOpen,
        setDialCode,
        setAuthMode,
        setAuthMethod,
        setAuthPhone,
        setSignupField,
        startSignup,
        startLogin,
        resendOtp,
        setOtp,
        verifyOtp,
        backToPhone,
        completeSignup,
        logout,
        profileEditing,
        profileDraft,
        profileError,
        phoneLocked,
        startEditProfile,
        cancelEditProfile,
        setProfileField: setProfileFieldFn,
        saveProfile,
        phoneOtp,
        phoneOtpError,
        otpError,
        setPhoneOtp: setPhoneOtpFn,
        verifyPhoneChange,
        cancelPhoneOtp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function validateSignupPhoneOrEmail(auth: AuthState): { ok: boolean; error?: string } {
  if (auth.method === "email") {
    if (!isValidEmail(auth.phone)) return { ok: false, error: "Enter a valid email address" };
    return { ok: true };
  }
  return authService.validateSignupPhone(auth.phone);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
