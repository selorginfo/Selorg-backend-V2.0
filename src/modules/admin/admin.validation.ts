import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().trim().email('Valid email address required'),
  password: z.string().min(1, 'Password is required'),
  role: z.string().trim().optional(),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const createRoleSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  roleType: z.enum(['system', 'custom']).optional(),
  permissions: z.array(z.string()).min(1),
  accessScope: z.enum(['global', 'zone', 'store']).optional(),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().trim().optional(),
  description: z.string().trim().optional(),
  roleType: z.enum(['system', 'custom']).optional(),
  permissions: z.array(z.string()).optional(),
  accessScope: z.enum(['global', 'zone', 'store']).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const createRoleFromTemplateSchema = z.object({
  name: z.string().trim().min(1),
  templateId: z.string().trim().optional(),
  templateKey: z.string().trim().optional(),
  description: z.string().trim().optional(),
  accessScope: z.enum(['global', 'zone', 'store']).optional(),
});
export type CreateRoleFromTemplateInput = z.infer<typeof createRoleFromTemplateSchema>;

export const updateRoleMatrixSchema = z.object({
  permissions: z.array(z.string()),
  accessScope: z.enum(['global', 'zone', 'store']).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
});
export type UpdateRoleMatrixInput = z.infer<typeof updateRoleMatrixSchema>;

export const importRoleConfigSchema = z.object({
  role: z.object({
    name: z.string().trim().min(1),
    description: z.string().trim().optional(),
    accessScope: z.enum(['global', 'zone', 'store']).optional(),
    riskLevel: z.enum(['low', 'medium', 'high']).optional(),
    permissions: z.array(z.string()).min(1),
  }),
  overwrite: z.boolean().optional(),
});
export type ImportRoleConfigInput = z.infer<typeof importRoleConfigSchema>;

export const createPermissionSchema = z.object({
  name: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  module: z.string().trim().min(1),
  description: z.string().trim().optional(),
  category: z.enum(['read', 'write', 'delete', 'admin']).optional(),
  action: z.string().trim().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  dependsOn: z.array(z.string()).optional(),
});
export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;

export const updatePermissionSchema = z.object({
  displayName: z.string().trim().optional(),
  module: z.string().trim().optional(),
  description: z.string().trim().optional(),
  category: z.enum(['read', 'write', 'delete', 'admin']).optional(),
  action: z.string().trim().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  dependsOn: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;

export const createUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  name: z.string().trim().min(1),
  department: z.string().trim().optional(),
  roleId: z.string().trim().optional(),
  reportingManagerId: z.string().trim().optional(),
  location: z.array(z.string()).optional(),
  twoFactorEnabled: z.boolean().optional(),
  startDate: z.string().optional(),
  notes: z.string().optional(),
  assignedStores: z.array(z.string()).optional(),
  primaryStoreId: z.string().optional(),
  emailVerifiedToken: z.string().optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().optional(),
  department: z.string().trim().optional(),
  roleId: z.string().trim().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  reportingManagerId: z.string().trim().optional(),
  location: z.array(z.string()).optional(),
  notes: z.string().optional(),
  assignedStores: z.array(z.string()).optional(),
  primaryStoreId: z.string().optional(),
  /** Enforce 2FA on next sign-in. Admin directory model stores this as `twoFactorEnabled`. */
  twoFactorEnabled: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const assignRoleSchema = z.object({
  roleId: z.string().trim().min(1, 'roleId is required'),
});
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

export const resetPasswordSchema = z.object({
  sendEmail: z.boolean().optional(),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const bulkUserActionSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'assign_role', 'update', 'reset_password']),
  userIds: z.array(z.string()).min(1, 'userIds (non-empty array) is required'),
  roleId: z.string().optional(),
  updates: z
    .object({
      status: z.enum(['active', 'inactive', 'suspended']).optional(),
      department: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  sendEmail: z.boolean().optional(),
});
export type BulkUserActionInput = z.infer<typeof bulkUserActionSchema>;

export const sendCreateUserOtpSchema = z.object({
  email: z.string().trim().email('Email is required'),
});
export type SendCreateUserOtpInput = z.infer<typeof sendCreateUserOtpSchema>;

export const verifyCreateUserOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().min(1),
  verificationRequestId: z.string().trim().min(1),
});
export type VerifyCreateUserOtpInput = z.infer<typeof verifyCreateUserOtpSchema>;
