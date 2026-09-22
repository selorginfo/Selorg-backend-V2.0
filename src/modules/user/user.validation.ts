import { z } from 'zod';

/** Allow clearing email with "" / omit, but reject malformed non-empty values. */
const optionalEmailField = z
  .string()
  .trim()
  .optional()
  .refine(
    (val) => val === undefined || val === "" || z.string().email().safeParse(val).success,
    { message: "Invalid email address" },
  );

export const updateProfileSchema = z
  .object({
    name: z.string().optional(),
    email: optionalEmailField,
    avatarUrl: z.string().optional(),
    profileImageUrl: z.string().optional(),
    phoneNumber: z.string().optional(),
    mobileNumber: z.string().optional(),
    phone: z.string().optional(),
    savedCheckoutContact: z
      .object({
        fullName: z.string().optional(),
        email: optionalEmailField,
        phone: z.string().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const uploadAvatarSchema = z
  .object({
    image: z.string().optional(),
    avatar: z.string().optional(),
    file: z.string().optional(),
  })
  .refine((data) => Boolean(data.image || data.avatar || data.file), {
    message: 'image (base64) is required',
    path: ['image'],
  });
export type UploadAvatarInput = z.infer<typeof uploadAvatarSchema>;
