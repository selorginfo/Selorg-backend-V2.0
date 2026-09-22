import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { pickerConfig } from '../picker/picker.config';
import { AdminPickerConfig, ADMIN_PICKER_CONFIG_KEY, IAdminPickerConfig } from './admin-picker-config.model';

type NumericField =
  | 'otpLength' | 'otpResendSeconds' | 'otpMaxSendsPerWindow' | 'otpThrottleWindowMinutes' | 'otpMaxVerifyAttempts'
  | 'codDepositLimit' | 'codOfflineCarryLimit' | 'supportEmailSlaHours'
  | 'locationPingSeconds' | 'offerExpirySeconds'
  | 'payoutBase' | 'payoutPerKm' | 'minutesPerKm' | 'minutesPerStopBuffer' | 'bulkStopPayout' | 'bulkBatchBasePayout'
  | 'estimatedReviewHours' | 'autoApproveAfterMs' | 'minRatedTripsForRating'
  | 'payoutWeekday' | 'maxUploadBytes' | 'geofenceMeters' | 'minWithdrawal' | 'overtimeMultiplier'
  | 'payoutDayOfMonth' | 'defaultShiftMinutes' | 'defaultHourlyRate';

type StringField =
  | 'supportPhone' | 'supportEmail' | 'supportHours' | 'minSupportedVersion' | 'latestVersion' | 'payoutScheduleLabel';

type BooleanField = 'bulkDeliveryEnabled' | 'emailLoginEnabled';

const NUMERIC_BOUNDS: Record<NumericField, { min: number; max: number; integer?: boolean }> = {
  otpLength: { min: 4, max: 8, integer: true },
  otpResendSeconds: { min: 0, max: 600, integer: true },
  otpMaxSendsPerWindow: { min: 1, max: 50, integer: true },
  otpThrottleWindowMinutes: { min: 1, max: 1440, integer: true },
  otpMaxVerifyAttempts: { min: 1, max: 20, integer: true },
  codDepositLimit: { min: 0, max: 1000000 },
  codOfflineCarryLimit: { min: 0, max: 1000000 },
  supportEmailSlaHours: { min: 0, max: 720 },
  locationPingSeconds: { min: 1, max: 3600, integer: true },
  offerExpirySeconds: { min: 1, max: 3600, integer: true },
  payoutBase: { min: 0, max: 100000 },
  payoutPerKm: { min: 0, max: 100000 },
  minutesPerKm: { min: 0, max: 1440 },
  minutesPerStopBuffer: { min: 0, max: 1440 },
  bulkStopPayout: { min: 0, max: 100000 },
  bulkBatchBasePayout: { min: 0, max: 100000 },
  estimatedReviewHours: { min: 0, max: 720 },
  autoApproveAfterMs: { min: 0, max: 86400000, integer: true },
  minRatedTripsForRating: { min: 0, max: 10000, integer: true },
  payoutWeekday: { min: 0, max: 6, integer: true },
  maxUploadBytes: { min: 1, max: 1024 * 1024 * 1024, integer: true },
  geofenceMeters: { min: 0, max: 100000 },
  minWithdrawal: { min: 0, max: 1000000 },
  overtimeMultiplier: { min: 0, max: 10 },
  payoutDayOfMonth: { min: 1, max: 28, integer: true },
  defaultShiftMinutes: { min: 1, max: 1440, integer: true },
  defaultHourlyRate: { min: 0, max: 100000 },
};

const STRING_FIELDS: readonly StringField[] = [
  'supportPhone', 'supportEmail', 'supportHours', 'minSupportedVersion', 'latestVersion', 'payoutScheduleLabel',
];

const BOOLEAN_FIELDS: readonly BooleanField[] = ['bulkDeliveryEnabled', 'emailLoginEnabled'];

type PickerConfigPayload = Record<NumericField, number> &
  Record<StringField, string> &
  Record<BooleanField, boolean> & { updateUrl: string | null };

/** Env-driven defaults from picker.config.ts — the fallback whenever a field was never overridden. */
function envDefaults(): PickerConfigPayload {
  return {
    otpLength: pickerConfig.otpLength,
    otpResendSeconds: pickerConfig.otpResendSeconds,
    otpMaxSendsPerWindow: pickerConfig.otpMaxSendsPerWindow,
    otpThrottleWindowMinutes: pickerConfig.otpThrottleWindowMinutes,
    otpMaxVerifyAttempts: pickerConfig.otpMaxVerifyAttempts,
    codDepositLimit: pickerConfig.codDepositLimit,
    codOfflineCarryLimit: pickerConfig.codOfflineCarryLimit,
    supportPhone: pickerConfig.supportPhone,
    supportEmail: pickerConfig.supportEmail,
    supportHours: pickerConfig.supportHours,
    supportEmailSlaHours: pickerConfig.supportEmailSlaHours,
    minSupportedVersion: pickerConfig.minSupportedVersion,
    latestVersion: pickerConfig.latestVersion,
    updateUrl: pickerConfig.updateUrl,
    bulkDeliveryEnabled: pickerConfig.bulkDeliveryEnabled,
    emailLoginEnabled: pickerConfig.emailLoginEnabled,
    locationPingSeconds: pickerConfig.locationPingSeconds,
    offerExpirySeconds: pickerConfig.offerExpirySeconds,
    payoutBase: pickerConfig.payoutBase,
    payoutPerKm: pickerConfig.payoutPerKm,
    minutesPerKm: pickerConfig.minutesPerKm,
    minutesPerStopBuffer: pickerConfig.minutesPerStopBuffer,
    bulkStopPayout: pickerConfig.bulkStopPayout,
    bulkBatchBasePayout: pickerConfig.bulkBatchBasePayout,
    estimatedReviewHours: pickerConfig.estimatedReviewHours,
    autoApproveAfterMs: pickerConfig.autoApproveAfterMs,
    minRatedTripsForRating: pickerConfig.minRatedTripsForRating,
    payoutWeekday: pickerConfig.payoutWeekday,
    payoutScheduleLabel: pickerConfig.payoutScheduleLabel,
    maxUploadBytes: pickerConfig.maxUploadBytes,
    geofenceMeters: pickerConfig.geofenceMeters,
    minWithdrawal: pickerConfig.minWithdrawal,
    overtimeMultiplier: pickerConfig.overtimeMultiplier,
    payoutDayOfMonth: pickerConfig.payoutDayOfMonth,
    defaultShiftMinutes: pickerConfig.defaultShiftMinutes,
    defaultHourlyRate: pickerConfig.defaultHourlyRate,
  };
}

function shape(doc: Record<string, unknown>): PickerConfigPayload & { key: string; updatedBy: string | null; updatedAt: unknown } {
  const defaults = envDefaults();
  const merged = { ...defaults } as Record<string, unknown>;
  for (const field of Object.keys(defaults)) {
    const stored = doc[field];
    if (stored !== undefined && stored !== null) merged[field] = stored;
  }
  // `updateUrl` is legitimately nullable, so a stored null must win over the env default.
  if (Object.prototype.hasOwnProperty.call(doc, 'updateUrl')) merged.updateUrl = doc.updateUrl ?? null;

  return {
    ...(merged as PickerConfigPayload),
    key: String(doc.key ?? ADMIN_PICKER_CONFIG_KEY),
    updatedBy: (doc.updatedBy as string | null) ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

export async function getPickerConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const doc = await AdminPickerConfig.findOneAndUpdate(
      { key: ADMIN_PICKER_CONFIG_KEY },
      { $setOnInsert: { key: ADMIN_PICKER_CONFIG_KEY, ...envDefaults() } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    res.status(200).json({ success: true, data: shape((doc ?? {}) as Record<string, unknown>) });
  } catch (error) {
    next(error);
  }
}

export async function updatePickerConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const update: Partial<Record<keyof IAdminPickerConfig, unknown>> = {};

    for (const field of Object.keys(NUMERIC_BOUNDS) as NumericField[]) {
      if (body[field] === undefined) continue;
      const value = typeof body[field] === 'number' ? (body[field] as number) : Number(body[field]);
      const bounds = NUMERIC_BOUNDS[field];
      if (!Number.isFinite(value)) throw AppError.badRequest(`${field} must be a number`);
      if (bounds.integer && !Number.isInteger(value)) throw AppError.badRequest(`${field} must be an integer`);
      if (value < bounds.min || value > bounds.max) {
        throw AppError.badRequest(`${field} must be between ${bounds.min} and ${bounds.max}`);
      }
      update[field] = value;
    }

    for (const field of STRING_FIELDS) {
      if (body[field] === undefined) continue;
      const value = String(body[field] ?? '').trim();
      if (!value) throw AppError.badRequest(`${field} cannot be empty`);
      if (value.length > 200) throw AppError.badRequest(`${field} must be 200 characters or fewer`);
      if (field === 'supportEmail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw AppError.badRequest('supportEmail must be a valid email address');
      }
      update[field] = value;
    }

    for (const field of BOOLEAN_FIELDS) {
      if (body[field] === undefined) continue;
      const raw = body[field];
      if (typeof raw === 'boolean') update[field] = raw;
      else if (raw === 'true' || raw === 'false') update[field] = raw === 'true';
      else throw AppError.badRequest(`${field} must be a boolean`);
    }

    if (body.updateUrl !== undefined) {
      const raw = body.updateUrl;
      if (raw === null || String(raw).trim() === '') {
        update.updateUrl = null;
      } else {
        const value = String(raw).trim();
        if (!/^https?:\/\/\S+$/i.test(value)) throw AppError.badRequest('updateUrl must be an http(s) URL');
        update.updateUrl = value;
      }
    }

    if (Object.keys(update).length === 0) {
      throw AppError.badRequest('At least one configuration field is required');
    }

    update.updatedBy = req.user?.userId || req.user?.email || null;

    const doc = await AdminPickerConfig.findOneAndUpdate(
      { key: ADMIN_PICKER_CONFIG_KEY },
      { $set: update, $setOnInsert: { key: ADMIN_PICKER_CONFIG_KEY } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();

    res.status(200).json({ success: true, data: shape((doc ?? {}) as Record<string, unknown>) });
  } catch (error) {
    next(error);
  }
}
