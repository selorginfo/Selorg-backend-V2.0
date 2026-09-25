/**
 * Rider-app remote configuration. Every value here is hard-coded in the app's
 * `src/config/environment.ts` today; serving it from the API means a helpline
 * number or a deposit limit can change without a store release.
 *
 * Values are read from the environment so they are deployable per-stage without
 * a schema migration; the defaults match the app's current constants exactly.
 */

function num(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return value === 'true' || value === '1';
}

export const pickerConfig = {
  otpLength: 4,
  get otpResendSeconds() { return num('PICKER_OTP_RESEND_SECONDS', 24); },
  /** Max OTP sends per identifier inside `otpThrottleWindowMinutes`. */
  get otpMaxSendsPerWindow() { return num('PICKER_OTP_MAX_SENDS', 3); },
  get otpThrottleWindowMinutes() { return num('PICKER_OTP_THROTTLE_WINDOW_MINUTES', 15); },
  get otpMaxVerifyAttempts() { return num('PICKER_OTP_MAX_VERIFY_ATTEMPTS', 5); },

  /** ₹2,000 — the FloatCash screen's stated carry limit. */
  get codDepositLimit() { return num('PICKER_COD_DEPOSIT_LIMIT', 2000); },
  /** Cash a rider may still hold when ending a shift. */
  get codOfflineCarryLimit() { return num('PICKER_COD_OFFLINE_CARRY_LIMIT', 0); },

  get supportPhone() { return str('PICKER_SUPPORT_PHONE', '+91 1800 266 0800'); },
  get supportEmail() { return str('PICKER_SUPPORT_EMAIL', 'support@selorg.in'); },
  get supportHours() { return str('PICKER_SUPPORT_HOURS', '24×7'); },
  get supportEmailSlaHours() { return num('PICKER_SUPPORT_EMAIL_SLA_HOURS', 4); },

  get minSupportedVersion() { return str('PICKER_MIN_SUPPORTED_VERSION', '1.0.0'); },
  get latestVersion() { return str('PICKER_LATEST_VERSION', '1.3.0'); },
  get updateUrl() { return process.env.PICKER_UPDATE_URL || null; },

  get bulkDeliveryEnabled() { return bool('PICKER_FEATURE_BULK_DELIVERY', true); },
  /** Email OTP is available via Resend; set PICKER_FEATURE_EMAIL_LOGIN=false to hide it in the app. */
  get emailLoginEnabled() { return bool('PICKER_FEATURE_EMAIL_LOGIN', true); },

  get locationPingSeconds() { return num('PICKER_LOCATION_PING_SECONDS', 15); },
  get offerExpirySeconds() { return num('PICKER_ORDER_OFFER_EXPIRY_SECONDS', 300); },

  /** Per-order rider payout, matching `dispatch.service`'s admin-side constants. */
  get payoutBase() { return num('RIDER_EARNING_BASE_INR', 25); },
  get payoutPerKm() { return num('RIDER_EARNING_PER_KM_INR', 8); },
  get minutesPerKm() { return num('RIDER_MINUTES_PER_KM', 3); },
  get minutesPerStopBuffer() { return num('RIDER_MINUTES_PER_STOP_BUFFER', 5); },
  /** Flat per-stop rate for bulk batches, on top of the batch base. */
  get bulkStopPayout() { return num('RIDER_BULK_STOP_PAYOUT_INR', 26); },
  get bulkBatchBasePayout() { return num('RIDER_BULK_BATCH_BASE_INR', 120); },

  get estimatedReviewHours() { return num('PICKER_ONBOARDING_REVIEW_HOURS', 4); },
  /** Delay before a submitted PENDING picker is auto-approved. Matches the app's under-review → successful animation. */
  get autoApproveAfterMs() { return num('PICKER_AUTO_APPROVE_AFTER_MS', 5000); },
  get minRatedTripsForRating() { return num('PICKER_MIN_RATED_TRIPS', 5); },

  /** Weekly payout run, 0 = Sunday. Default Monday, matching "Every Monday · UPI". */
  get payoutWeekday() { return num('PICKER_PAYOUT_WEEKDAY', 1); },
  get payoutScheduleLabel() { return str('PICKER_PAYOUT_SCHEDULE_LABEL', 'Every Monday · UPI'); },

  get maxUploadBytes() { return num('PICKER_MAX_UPLOAD_BYTES', 10 * 1024 * 1024); },

  /** Workforce-app geofence; frontend `config.geofenceMeters` is 150. */
  get geofenceMeters() { return num('PICKER_GEOFENCE_METERS', 150); },
  get minWithdrawal() { return num('PICKER_MIN_WITHDRAWAL', 100); },
  /** Overtime multiplier applied to the normal hourly salary rate. */
  get overtimeMultiplier() { return num('PICKER_OT_MULTIPLIER', 1.5); },
  /** Day of month net payout lands (mock uses the 5th). */
  get payoutDayOfMonth() { return num('PICKER_PAYOUT_DAY_OF_MONTH', 5); },
  /**
   * Fallback scheduled minutes when a shift has no start/end times.
   * Aligned to the standard 10-hour picker shift (work + break + handovers).
   */
  get defaultShiftMinutes() { return num('PICKER_DEFAULT_SHIFT_MINUTES', 10 * 60); },
  /** Legacy hourly fallback — salary payroll uses monthlySalary instead. */
  get defaultHourlyRate() { return num('PICKER_DEFAULT_HOURLY_RATE', 100); },

  // ─── Monthly salary / shift structure (single source for payroll) ─────────
  /** Fixed monthly salary (₹). Overridable via AdminPickerConfig.monthlySalary. */
  get monthlySalary() { return num('PICKER_MONTHLY_SALARY', 13000); },
  /** Full scheduled shift including break + handovers (minutes). Default 10h. */
  get standardShiftMinutes() { return num('PICKER_STANDARD_SHIFT_MINUTES', 10 * 60); },
  /** Productive picking time inside the shift (minutes). Default 8h. */
  get productiveWorkMinutes() { return num('PICKER_PRODUCTIVE_WORK_MINUTES', 8 * 60); },
  /** Paid break inside the shift — not productive, not OT (minutes). Default 1h. */
  get breakMinutes() { return num('PICKER_BREAK_MINUTES', 60); },
  /** Device assignment / start handover — not productive, not OT (minutes). */
  get startHandoverMinutes() { return num('PICKER_START_HANDOVER_MINUTES', 30); },
  /** End-of-shift handover — not productive, not OT (minutes). */
  get endHandoverMinutes() { return num('PICKER_END_HANDOVER_MINUTES', 30); },
  /** Paid week-offs granted per month (non-deductible). */
  get weekOffAllowance() { return num('PICKER_WEEK_OFF_ALLOWANCE', 4); },
  /** Weekday used as the weekly off: 0=Sun … 6=Sat. Default Sunday. */
  get weekOffWeekday() { return num('PICKER_WEEK_OFF_WEEKDAY', 0); },
  /**
   * Daily-rate divisor mode:
   * - calendar_minus_weekoffs → daysInMonth − weekOffAllowance
   * - fixed → monthlyWorkingDaysFixed
   */
  get monthlyWorkingDaysMode(): 'calendar_minus_weekoffs' | 'fixed' {
    const v = str('PICKER_MONTHLY_WORKING_DAYS_MODE', 'calendar_minus_weekoffs');
    return v === 'fixed' ? 'fixed' : 'calendar_minus_weekoffs';
  },
  get monthlyWorkingDaysFixed() { return num('PICKER_MONTHLY_WORKING_DAYS_FIXED', 26); },
};

export const PICKER_LANGUAGE_CATALOG = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu' },
];

export { VEHICLE_LABELS } from './picker.format';

/** Maps `PickerUser.status` (SCREAMING_CASE) to the lowercase enum the contract exposes. */
export function toApiAccountStatus(status?: string | null): 'pending' | 'active' | 'inactive' | 'rejected' | 'suspended' {
  switch (String(status || '').toUpperCase()) {
    case 'ACTIVE': return 'active';
    case 'INACTIVE': return 'inactive';
    case 'REJECTED': return 'rejected';
    case 'SUSPENDED': return 'suspended';
    default: return 'pending';
  }
}
