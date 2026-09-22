import { z } from 'zod';
import { ORDER_STATUS, TASK_STATUS, BAG_STATUS } from './hhd.constants';

const mobileField = z.string().optional().default('');
const emailField = z.string().optional().default('');

export const sendOtpBodySchema = z
  .object({
    mobile: mobileField,
    mobileNumber: mobileField,
    phone: mobileField,
    email: emailField,
    preferredChannel: z.enum(['sms', 'whatsapp']).optional(),
  })
  .superRefine((data, ctx) => {
    const mobile = String(data.mobile || data.mobileNumber || data.phone || '').trim();
    const email = String(data.email || '').trim();
    if (!mobile && !email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please provide a mobile number or email',
        path: ['mobile'],
      });
    }
  });

export const verifyOtpBodySchema = z
  .object({
    mobile: mobileField,
    mobileNumber: mobileField,
    phone: mobileField,
    email: emailField,
    otp: z.string().optional(),
    enteredOTP: z.string().optional(),
    deviceId: z.string().max(128).optional(),
  })
  .superRefine((data, ctx) => {
    const mobile = String(data.mobile || data.mobileNumber || data.phone || '').trim();
    const email = String(data.email || '').trim();
    if (!mobile && !email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please provide a mobile number or email',
        path: ['mobile'],
      });
    }
    const otp = String(data.otp || data.enteredOTP || '').trim();
    if (!/^\d{4}$/.test(otp)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OTP must be a 4-digit code',
        path: ['otp'],
      });
    }
  });

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
  deviceId: z.string().max(128).optional(),
});

export const updateOrderStatusBodySchema = z.object({
  status: z.enum([
    ORDER_STATUS.PENDING,
    ORDER_STATUS.RECEIVED,
    ORDER_STATUS.BAG_SCANNED,
    ORDER_STATUS.PICKING,
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.PHOTO_VERIFIED,
    ORDER_STATUS.RACK_ASSIGNED,
    ORDER_STATUS.HANDED_OFF,
  ]),
  bagId: z.string().optional(),
  rackLocation: z.string().optional(),
  riderName: z.string().optional(),
  riderId: z.string().optional(),
  pickTime: z.number().nonnegative().optional(),
  priority: z.string().optional(),
});

export const assignOrderStatusBodySchema = z.object({
  status: z.string().min(1, 'Status is required'),
});

export const scanItemBodySchema = z
  .object({
    orderId: z.string().min(1, 'orderId is required'),
    barcodeData: z.string().min(1).max(128).optional(),
    itemCode: z.string().min(1).max(128).optional(),
    barcodeType: z
      .enum(['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc', 'other'])
      .optional(),
    deviceId: z.string().max(128).optional(),
    scannedAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.barcodeData && !data.itemCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'barcodeData or itemCode is required',
        path: ['barcodeData'],
      });
    }
  });

export const scannedItemBodySchema = z.object({
  barcodeData: z.string().min(1).max(128),
  barcodeType: z
    .enum(['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc', 'other'])
    .optional(),
  orderId: z.string().optional(),
  deviceId: z.string().max(128).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const scanBagBodySchema = z.object({
  qrCode: z.string().min(1, 'qrCode is required'),
  orderId: z.string().min(1, 'orderId is required'),
});

export const scanRackBodySchema = z.object({
  qrCode: z.string().min(1, 'qrCode is required'),
  orderId: z.string().min(1, 'orderId is required'),
  riderId: z.string().optional(),
  pickTime: z.number().positive().optional(),
});

export const updateTaskBodySchema = z
  .object({
    done: z.boolean().optional(),
    status: z
      .enum([
        TASK_STATUS.PENDING,
        TASK_STATUS.IN_PROGRESS,
        TASK_STATUS.COMPLETED,
        TASK_STATUS.CANCELLED,
      ])
      .optional(),
    notes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.done === undefined && data.status === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'done or status is required',
        path: ['done'],
      });
    }
  });

export const markNotFoundBodySchema = z.object({
  notes: z.string().max(500).optional(),
  substituteSku: z.string().max(128).optional(),
});

export const heartbeatBodySchema = z.object({
  deviceId: z.string().max(128).optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
});

export const orderStatusParamSchema = z.object({
  status: z.enum([
    ORDER_STATUS.PENDING,
    ORDER_STATUS.RECEIVED,
    ORDER_STATUS.BAG_SCANNED,
    ORDER_STATUS.PICKING,
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.PHOTO_VERIFIED,
    ORDER_STATUS.RACK_ASSIGNED,
    ORDER_STATUS.HANDED_OFF,
  ]),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.string().optional(),
  includeItems: z.union([z.string(), z.boolean()]).optional(),
});

export const substitutesQuerySchema = z.object({
  sku: z.string().min(1, 'sku is required'),
  orderId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
});

export const assignOrderBodySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

export const updateBagBodySchema = z.object({
  status: z
    .enum([BAG_STATUS.SCANNED, BAG_STATUS.IN_USE, BAG_STATUS.PHOTO_TAKEN, BAG_STATUS.COMPLETED])
    .optional(),
  photoUrl: z.string().url().optional(),
});
