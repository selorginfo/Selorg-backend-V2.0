import mongoose, { Document, Schema } from 'mongoose';

/**
 * Admin-editable override of `src/modules/picker/picker.config.ts`. That module stays the
 * env-driven source of truth for defaults; this collection holds a single document per
 * `key` so an operator can change a helpline number or a payout rate without a redeploy.
 */

export const ADMIN_PICKER_CONFIG_KEY = 'global';

export interface IAdminPickerConfig extends Document {
  key: string;

  otpLength: number;
  otpResendSeconds: number;
  otpMaxSendsPerWindow: number;
  otpThrottleWindowMinutes: number;
  otpMaxVerifyAttempts: number;

  codDepositLimit: number;
  codOfflineCarryLimit: number;

  supportPhone: string;
  supportEmail: string;
  supportHours: string;
  supportEmailSlaHours: number;

  minSupportedVersion: string;
  latestVersion: string;
  updateUrl: string | null;

  bulkDeliveryEnabled: boolean;
  emailLoginEnabled: boolean;

  locationPingSeconds: number;
  offerExpirySeconds: number;

  payoutBase: number;
  payoutPerKm: number;
  minutesPerKm: number;
  minutesPerStopBuffer: number;
  bulkStopPayout: number;
  bulkBatchBasePayout: number;

  estimatedReviewHours: number;
  autoApproveAfterMs: number;
  minRatedTripsForRating: number;

  payoutWeekday: number;
  payoutScheduleLabel: string;

  maxUploadBytes: number;
  geofenceMeters: number;
  minWithdrawal: number;
  overtimeMultiplier: number;
  payoutDayOfMonth: number;
  defaultShiftMinutes: number;
  defaultHourlyRate: number;

  /** Picker monthly salary (₹) — single admin-editable source. */
  monthlySalary: number;
  standardShiftMinutes: number;
  productiveWorkMinutes: number;
  breakMinutes: number;
  startHandoverMinutes: number;
  endHandoverMinutes: number;
  weekOffAllowance: number;
  weekOffWeekday: number;
  monthlyWorkingDaysMode: 'calendar_minus_weekoffs' | 'fixed';
  monthlyWorkingDaysFixed: number;

  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const adminPickerConfigSchema = new Schema<IAdminPickerConfig>(
  {
    key: { type: String, required: true, unique: true, default: ADMIN_PICKER_CONFIG_KEY, index: true },

    otpLength: { type: Number, min: 4, max: 8 },
    otpResendSeconds: { type: Number, min: 0 },
    otpMaxSendsPerWindow: { type: Number, min: 1 },
    otpThrottleWindowMinutes: { type: Number, min: 1 },
    otpMaxVerifyAttempts: { type: Number, min: 1 },

    codDepositLimit: { type: Number, min: 0 },
    codOfflineCarryLimit: { type: Number, min: 0 },

    supportPhone: { type: String, trim: true },
    supportEmail: { type: String, trim: true },
    supportHours: { type: String, trim: true },
    supportEmailSlaHours: { type: Number, min: 0 },

    minSupportedVersion: { type: String, trim: true },
    latestVersion: { type: String, trim: true },
    updateUrl: { type: String, default: null },

    bulkDeliveryEnabled: { type: Boolean },
    emailLoginEnabled: { type: Boolean },

    locationPingSeconds: { type: Number, min: 1 },
    offerExpirySeconds: { type: Number, min: 1 },

    payoutBase: { type: Number, min: 0 },
    payoutPerKm: { type: Number, min: 0 },
    minutesPerKm: { type: Number, min: 0 },
    minutesPerStopBuffer: { type: Number, min: 0 },
    bulkStopPayout: { type: Number, min: 0 },
    bulkBatchBasePayout: { type: Number, min: 0 },

    estimatedReviewHours: { type: Number, min: 0 },
    autoApproveAfterMs: { type: Number, min: 0 },
    minRatedTripsForRating: { type: Number, min: 0 },

    payoutWeekday: { type: Number, min: 0, max: 6 },
    payoutScheduleLabel: { type: String, trim: true },

    maxUploadBytes: { type: Number, min: 1 },
    geofenceMeters: { type: Number, min: 0 },
    minWithdrawal: { type: Number, min: 0 },
    overtimeMultiplier: { type: Number, min: 0 },
    payoutDayOfMonth: { type: Number, min: 1, max: 28 },
    defaultShiftMinutes: { type: Number, min: 1 },
    defaultHourlyRate: { type: Number, min: 0 },

    monthlySalary: { type: Number, min: 0 },
    standardShiftMinutes: { type: Number, min: 1 },
    productiveWorkMinutes: { type: Number, min: 0 },
    breakMinutes: { type: Number, min: 0 },
    startHandoverMinutes: { type: Number, min: 0 },
    endHandoverMinutes: { type: Number, min: 0 },
    weekOffAllowance: { type: Number, min: 0 },
    weekOffWeekday: { type: Number, min: 0, max: 6 },
    monthlyWorkingDaysMode: { type: String, enum: ['calendar_minus_weekoffs', 'fixed'] },
    monthlyWorkingDaysFixed: { type: Number, min: 1 },

    updatedBy: { type: String, default: null },
  },
  { timestamps: true, collection: 'admin_picker_configs' },
);

export const AdminPickerConfig =
  (mongoose.models.AdminPickerConfig as mongoose.Model<IAdminPickerConfig>) ||
  mongoose.model<IAdminPickerConfig>('AdminPickerConfig', adminPickerConfigSchema);
