import { z } from 'zod';

export const createAddressSchema = z
  .object({
    label: z.string().trim().optional(),
    line1: z
      .string({ required_error: 'Address line 1 is required' })
      .trim()
      .min(1, 'Address line 1 is required'),
    line2: z.string().trim().optional(),
    landmark: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    pincode: z.string().trim().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    isDefault: z.boolean().optional(),
    address: z.string().trim().optional(),
  })
  .passthrough();
export type CreateAddressInput = z.infer<typeof createAddressSchema>;

export const updateAddressSchema = createAddressSchema.partial();
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
