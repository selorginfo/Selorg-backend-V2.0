import { z } from 'zod';
import { PICKER_VEHICLE_TYPES, PICKER_LANGUAGES, PICKER_DOCUMENT_TYPES } from './picker.models';
import { RIDER_CANCEL_REASONS, BULK_EXCEPTION_REASONS } from '../orders/order.model';
import { KIT_ITEMS, DEPOSIT_METHODS } from './picker.rider.models';

/**
 * Request schemas for the rider (picker) app, consumed by `validate(schema, part)`.
 * Query schemas rely on `z.coerce` because Express delivers query values as strings.
 */

const objectId = z.string().trim().regex(/^[a-f\d]{24}$/i, 'Must be a 24-character hex id');
const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format');
const otpCode = z.string().trim().regex(/^\d{4}$/, 'OTP must be exactly 4 numeric digits');
const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

/** Optional `{ latitude, longitude }` sent with most transitions for geotagging. */
const locationPoint = z
  .object({ latitude, longitude })
  .optional();

/**
 * Boolean that also accepts the string forms multipart/query encoding produces.
 * `z.coerce.boolean()` is unusable here because it maps the string `"false"` to `true`.
 */
const flexibleBoolean = z.union([
  z.boolean(),
  z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1'),
]);

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};

/** Rejects `dateTo` earlier than `dateFrom` once both are supplied. */
function withOrderedRange<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine(
    (value) => {
      const from = (value as { dateFrom?: string }).dateFrom;
      const to = (value as { dateTo?: string }).dateTo;
      return !from || !to || from <= to;
    },
    { message: 'dateFrom must not be after dateTo', path: ['dateFrom'] },
  );
}

// ─── Auth (APIs 1–7) ──────────────────────────────────────────────────────────

export const sendOtpSchema = z.object({
  phone: z.string().trim().min(1, 'phone is required'),
  preferredChannel: z.enum(['sms', 'whatsapp']).optional(),
  // Accepted for backward compatibility with the in-store picker client.
  storeId: z.string().trim().optional(),
});

export const sendOtpEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
});

export const verifyOtpSchema = z.object({
  phone: z.string().trim().min(1, 'phone is required'),
  otp: otpCode,
  preferredChannel: z.enum(['sms', 'whatsapp']).optional(),
  intent: z.enum(['login', 'signup']).optional(),
  storeId: z.string().trim().optional(),
});

export const verifyOtpEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  otp: otpCode,
  intent: z.enum(['login', 'signup']).optional(),
});

// ─── Profile + onboarding (APIs 9–17) ─────────────────────────────────────────

/**
 * Indian registration plate, e.g. `KA01AB1234` / `KA 01 AB 1234`. Separators are
 * tolerated on input and normalised by the service.
 */
const registrationNumber = z
  .string()
  .trim()
  .toUpperCase()
  .min(4, 'Registration number must be at least 4 characters')
  .max(20, 'Registration number is too long')
  .regex(/^[A-Z0-9][A-Z0-9 -]*$/, 'Enter a valid vehicle registration number');

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
    photoUrl: z.string().trim().url('photoUrl must be a valid URL'),
    vehicleType: z.enum(PICKER_VEHICLE_TYPES),
    vehicleRegistrationNumber: registrationNumber,
    hubId: z.string().trim().min(1),
    age: z.coerce.number().int().min(18, 'Riders must be at least 18').max(70),
    gender: z.enum(['male', 'female', 'other', 'Male', 'Female', 'Other']),
    upiId: z.string().trim().min(3).max(100),
    upiName: z.string().trim().min(2).max(100),
    // Legacy field kept so the existing in-store picker client is unaffected.
    locationType: z.enum(['warehouse', 'darkstore']),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field must be provided' });

export const listWorkLocationsQuerySchema = z
  .object({
    type: z.enum(['warehouse', 'darkstore']).optional(),
    lat: latitude.optional(),
    lng: longitude.optional(),
    radiusKm: z.coerce.number().min(1).max(100).default(25),
  })
  .refine((value) => (value.lat == null) === (value.lng == null), {
    message: 'lat and lng must be supplied together',
    path: ['lat'],
  });

const DOC_TYPE_SET = new Set<string>(PICKER_DOCUMENT_TYPES);

/** React Native FormData often sends `type` as the file MIME, or as an array of both. */
function pickDocumentType(value: unknown): string | undefined {
  const parts = Array.isArray(value) ? value : [value];
  for (const part of parts) {
    const s = String(part || '').trim().toLowerCase();
    if (!s || s.includes('/')) continue;
    if (s === 'aadhaar') return 'aadhar';
    if (DOC_TYPE_SET.has(s)) return s;
  }
  return undefined;
}

function pickDocumentSide(value: unknown): 'front' | 'back' | undefined {
  const parts = Array.isArray(value) ? value : [value];
  for (const part of parts) {
    const s = String(part || '').trim().toLowerCase();
    if (s === 'front' || s === 'back') return s;
  }
  return undefined;
}

/**
 * KYC upload. Arrives as `multipart/form-data`, so every value is a string; the
 * file itself is validated by `picker.upload.middleware`.
 */
export const uploadDocumentSchema = z
  .object({
    type: z.any().optional(),
    documentType: z.any().optional(),
    side: z.any().optional(),
    fileName: z.string().trim().max(255).optional(),
    url: z.string().trim().optional(),
  })
  .passthrough()
  .transform((value) => {
    const type = pickDocumentType(value.documentType) || pickDocumentType(value.type);
    const url = value.url && /^https?:\/\//i.test(value.url) ? value.url : undefined;
    return {
      type,
      side: pickDocumentSide(value.side),
      fileName: value.fileName || undefined,
      url,
    };
  })
  .superRefine((value, ctx) => {
    if (!value.type || !DOC_TYPE_SET.has(value.type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: `type must be one of: ${PICKER_DOCUMENT_TYPES.join(', ')}`,
      });
    }
  });

export const updateTrainingProgressSchema = z.object({
  videoId: z.string().trim().min(1, 'videoId is required'),
  progress: z.coerce.number().min(0).max(100),
});

export const kitAckSchema = z.object({
  items: z
    .array(z.enum(KIT_ITEMS))
    .min(1, 'At least one kit item is required')
    .refine((items) => new Set(items).size === items.length, { message: 'Duplicate kit items are not allowed' }),
  hubId: z.string().trim().min(1).optional(),
});

export const submitOnboardingSchema = z.object({
  acceptedTermsVersion: z.string().trim().max(50).optional(),
  acceptedPrivacyVersion: z.string().trim().max(50).optional(),
});

// ─── Shifts (APIs 18–23) ──────────────────────────────────────────────────────

export const listShiftsQuerySchema = withOrderedRange(
  z.object({
    warehouseKey: z.string().trim().optional(),
    date: isoDate.optional(),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
  }),
);

export const selectShiftSchema = z.object({
  shiftId: objectId,
});

export const deselectShiftSchema = z.object({
  shiftId: objectId,
  reason: z.string().trim().max(200).optional(),
});

export const startShiftSchema = z.object({
  shiftId: objectId.optional(),
  location: locationPoint,
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  lat: latitude.optional(),
  lng: longitude.optional(),
});

export const endShiftSchema = z.object({
  shiftId: objectId.optional(),
  location: locationPoint,
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  lat: latitude.optional(),
  lng: longitude.optional(),
});

/** Shiftless HomeScreen online toggle — location optional (geofence skipped when omitted). */
export const goOnlineSchema = z.object({
  location: locationPoint,
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  lat: latitude.optional(),
  lng: longitude.optional(),
});

export const goOfflineSchema = z.object({
  location: locationPoint,
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  lat: latitude.optional(),
  lng: longitude.optional(),
});

// ─── Dashboard + incentives (APIs 24, 25) ─────────────────────────────────────

export const dayQuerySchema = z.object({
  date: isoDate.optional(),
});

// ─── Standard orders (APIs 26–31, 45) ─────────────────────────────────────────

export const listAvailableOrdersQuerySchema = z.object({
  scope: z.enum(['available', 'mine', 'all']).default('all'),
  ...pagination,
});

export const orderIdParamSchema = z.object({
  orderId: objectId,
});

export const updateOrderStatusSchema = z
  .object({
    status: z.enum(['accepted', 'picked_up', 'cancelled']),
    reason: z.enum(RIDER_CANCEL_REASONS).optional(),
    note: z.string().trim().max(500).optional(),
    itemsVerified: flexibleBoolean.optional(),
    location: locationPoint,
  })
  .refine((value) => value.status !== 'cancelled' || Boolean(value.reason), {
    message: 'reason is required when cancelling',
    path: ['reason'],
  })
  .refine((value) => value.reason !== 'other' || Boolean(value.note?.trim()), {
    message: 'note is required when the reason is "other"',
    path: ['note'],
  });

/** POD upload metadata; `photo` itself is handled by multer. */
export const proofPhotoSchema = z.object({
  capturedAt: z.coerce.date().optional(),
  latitude: latitude.optional(),
  longitude: longitude.optional(),
});

export const completeOrderSchema = z
  .object({
    otp: otpCode,
    photoId: objectId.optional(),
    /**
     * Transitional: the shipped app sends `photo: true` instead of a `photoId`.
     * Accepted for one release and recorded as "no verifiable proof".
     */
    photo: flexibleBoolean.optional(),
    codCollected: z.coerce.number().min(0).optional(),
    location: locationPoint,
  })
  .refine((value) => Boolean(value.photoId) || value.photo !== undefined, {
    message: 'photoId is required (upload the proof-of-delivery photo first)',
    path: ['photoId'],
  });

export const trackLocationSchema = z.object({
  latitude,
  longitude,
  accuracy: z.coerce.number().min(0).optional(),
  speed: z.coerce.number().min(0).optional(),
  heading: z.coerce.number().min(0).max(360).optional(),
  recordedAt: z.coerce.date().optional(),
  orderId: objectId.optional(),
  batchId: z.string().trim().max(50).optional(),
  batteryLevel: z.coerce.number().min(0).max(100).optional(),
});

export const deliveryHistoryQuerySchema = withOrderedRange(
  z.object({
    type: z.enum(['all', 'standard', 'bulk']).default('all'),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    ...pagination,
  }),
);

// ─── Bulk delivery (APIs 32–40) ───────────────────────────────────────────────

export const bulkBatchQuerySchema = z.object({
  batchId: z.string().trim().max(50).optional(),
});

export const loadBagSchema = z.object({
  bag: z.string().trim().min(1, 'bag is required').max(50),
  batchId: z.string().trim().max(50).optional(),
  loaded: flexibleBoolean.default(true),
  scanMethod: z.enum(['scan', 'manual']).optional(),
});

export const startBulkSchema = z.object({
  batchId: z.string().trim().max(50).optional(),
  location: locationPoint,
});

/**
 * Stop addressing. The shipped client sends the numeric `seq`, so a bare integer
 * is accepted alongside the stable `stopId` (see API 32's design note).
 */
export const stopIdParamSchema = z.object({
  stopId: z.string().trim().min(1, 'stopId is required').max(50),
});

export const arriveStopSchema = z.object({
  phase: z.enum(['navigating', 'arrived']),
  location: locationPoint,
});

export const deliverStopSchema = z.object({
  photoId: objectId.optional(),
  photo: flexibleBoolean.optional(),
  otp: otpCode.optional(),
  codCollected: z.coerce.number().min(0).optional(),
  location: locationPoint,
});

export const failStopSchema = z
  .object({
    reason: z.enum(BULK_EXCEPTION_REASONS),
    note: z.string().trim().max(500).optional(),
    photoId: objectId.optional(),
    location: locationPoint,
  })
  .refine((value) => value.reason !== 'other' || Boolean(value.note?.trim()), {
    message: 'note is required when the reason is "other"',
    path: ['note'],
  });

export const listBulkBatchesQuerySchema = withOrderedRange(
  z.object({
    status: z.enum(['completed', 'cancelled', 'all']).default('completed'),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    ...pagination,
  }),
);

export const batchIdParamSchema = z.object({
  batchId: z.string().trim().min(1).max(50),
});

// ─── Earnings + wallet (APIs 41–44) ───────────────────────────────────────────

export const earningsSummaryQuerySchema = z
  .object({
    period: z.enum(['week', 'month', 'custom']).default('week'),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
  })
  .refine((value) => value.period !== 'custom' || (value.dateFrom && value.dateTo), {
    message: 'dateFrom and dateTo are required when period is "custom"',
    path: ['dateFrom'],
  })
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    message: 'dateFrom must not be after dateTo',
    path: ['dateFrom'],
  });

export const dailyEarningsQuerySchema = withOrderedRange(
  z.object({
    period: z.enum(['week', 'month']).default('week'),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    limit: z.coerce.number().int().min(1).max(90).default(7),
  }),
);

export const walletTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Floating cash (APIs 46–48) ───────────────────────────────────────────────

export const cashTransactionsQuerySchema = withOrderedRange(
  z.object({
    type: z.enum(['all', 'cod_collected', 'deposit', 'adjustment'] as const).default('all'),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    ...pagination,
  }),
);

export const recordDepositSchema = z.object({
  amount: z.coerce.number().int('Deposit amount must be a whole number of rupees').positive('Enter an amount to deposit'),
  method: z.enum(DEPOSIT_METHODS),
  hubId: z.string().trim().max(50).optional(),
  note: z.string().trim().max(200).optional(),
});

// ─── Settings, config, support (APIs 49–58) ───────────────────────────────────

export const updatePreferencesSchema = z
  .object({
    pushNotifications: z.boolean(),
    locationSharing: z.boolean(),
    orderSoundAlerts: z.boolean(),
    language: z.enum(PICKER_LANGUAGES),
    shiftReminders: z.boolean(),
    payoutAlerts: z.boolean(),
    incentiveUpdates: z.boolean(),
    push: z.boolean(),
    shiftRem: z.boolean(),
    payout: z.boolean(),
    incentive: z.boolean(),
    sound: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one preference must be provided' });

export const registerPushTokenSchema = z.object({
  token: z.string().trim().min(1, 'token is required').max(512),
  platform: z.enum(['ios', 'android']),
  deviceId: z.string().trim().max(200).optional(),
  appVersion: z.string().trim().max(50).optional(),
});

export const appConfigQuerySchema = z.object({
  platform: z.enum(['ios', 'android']).optional(),
  appVersion: z.string().trim().max(50).optional(),
});

export const cancelReasonsQuerySchema = z.object({
  context: z.enum(['standard', 'bulk'], { errorMap: () => ({ message: 'context must be "standard" or "bulk"' }) }),
});

export const listFaqQuerySchema = z.object({
  category: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const listTicketsQuerySchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'all']).default('all'),
  ...pagination,
});

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200).optional(),
  message: z.string().trim().min(1).max(2000).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  category: z.enum(['payment', 'order', 'account', 'app', 'other']).default('other'),
  orderId: objectId.optional(),
  batchId: z.string().trim().max(50).optional(),
}).refine((v) => Boolean(v.message || v.description), { message: 'description is required', path: ['description'] });

export const workforceUpdateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  dob: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  gender: z.string().optional(),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  altPhone: z.string().optional(),
  address: z.string().max(250).optional(),
  city: z.string().max(100).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional().or(z.literal('')),
  emgName: z.string().max(100).optional(),
  emgPhone: z.string().optional(),
  emgRel: z.enum(['Spouse', 'Parent', 'Sibling', 'Friend']).optional(),
  photoUri: z.string().optional(),
  photoUrl: z.string().optional(),
}).passthrough();

export const setLocationTypeSchema = z.object({
  locationType: z.string().min(1),
});

export const setUpiSchema = z.object({
  upi: z.string().trim().min(3).optional(),
  upiId: z.string().trim().min(3).optional(),
}).refine((v) => Boolean(v.upi || v.upiId), { message: 'upi is required' });

export const addBankAccountSchema = z.object({
  accountHolderName: z.string().optional(),
  holderName: z.string().optional(),
  holder: z.string().optional(),
  accountNumber: z.string().optional(),
  acc: z.string().optional(),
  ifscCode: z.string().optional(),
  ifsc: z.string().optional(),
  bankName: z.string().optional(),
  bank: z.string().optional(),
  branchName: z.string().optional(),
  isPrimary: z.boolean().optional(),
}).passthrough();

export const verifyBankSchema = z.object({
  accountNumber: z.string().optional(),
  acc: z.string().optional(),
  ifscCode: z.string().optional(),
  ifsc: z.string().optional(),
  accountHolderName: z.string().optional(),
  holderName: z.string().optional(),
  holder: z.string().optional(),
  accountId: objectId.optional(),
}).passthrough();

export const withdrawSchema = z.object({
  amount: z.coerce.number().positive('Valid amount is required'),
  accountId: objectId.optional(),
  idempotencyKey: z.string().trim().max(100).optional(),
});

export const managerOtpSchema = z.object({
  otp: otpCode,
});

export const faceVerifySchema = z.object({
  imageUrl: z.string().trim().url().optional(),
  url: z.string().trim().url().optional(),
}).passthrough();

export const reportIssueSchema = z.object({
  type: z.enum(['device', 'app', 'shift', 'payout', 'other']).optional(),
  reason: z.string().trim().min(1).optional(),
  description: z.string().trim().max(1000).optional(),
  deviceId: z.string().optional(),
}).refine((v) => Boolean(v.reason || v.description), { message: 'Select an issue to report.', path: ['reason'] });

export const deleteAccountSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const homeSummaryQuerySchema = z.object({
  lat: latitude.optional(),
  lng: longitude.optional(),
  accuracyM: z.coerce.number().min(0).optional(),
});

export const attendanceQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  year: z.string().optional(),
  view: z.enum(['history', 'records']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const workforceUploadDocumentSchema = z.object({
  type: z.string().optional(),
  number: z.string().optional(),
  url: z.string().optional(),
  fileName: z.string().optional(),
  aadhaar: z.string().optional(),
  pan: z.string().optional(),
  side: z.enum(['front', 'back']).optional(),
}).passthrough();

export const chatMessagesQuerySchema = z.object({
  since: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const sendChatMessageSchema = z.object({
  text: z.string().trim().min(1, 'Message cannot be empty').max(2000),
  orderId: objectId.optional(),
  batchId: z.string().trim().max(50).optional(),
  clientMessageId: z.string().trim().max(100).optional(),
});

// ─── Legal (APIs 59, 60) ──────────────────────────────────────────────────────

export const legalQuerySchema = z.object({
  version: z.string().trim().max(50).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CompleteOrderInput = z.infer<typeof completeOrderSchema>;
export type TrackLocationInput = z.infer<typeof trackLocationSchema>;
export type LoadBagInput = z.infer<typeof loadBagSchema>;
export type DeliverStopInput = z.infer<typeof deliverStopSchema>;
export type FailStopInput = z.infer<typeof failStopSchema>;
export type RecordDepositInput = z.infer<typeof recordDepositSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
