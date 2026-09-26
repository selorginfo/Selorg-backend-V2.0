import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import { AppError } from '../../utils/AppError';
import * as usersService from './admin-users.service';
import type {
  CreateUserInput,
  UpdateUserInput,
  AssignRoleInput,
  ResetPasswordInput,
  BulkUserActionInput,
  SendCreateUserOtpInput,
  VerifyCreateUserOtpInput,
} from './admin.validation';

export async function getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, roleId, department, search } = req.query as Record<string, string | undefined>;
    const data = await usersService.getUsers({ status, roleId, department, search });
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await usersService.getUserById(req.params.id);
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function getCurrentUserProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await usersService.getCurrentUserProfile(req.user?.userId, req.user?.email);
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function sendCreateUserOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body as SendCreateUserOtpInput;
    const data = await usersService.sendCreateUserOtp(email, req.user?.userId, req.user?.email);
    res.status(200).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function verifyCreateUserOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, otp, verificationRequestId } = req.body as VerifyCreateUserOtpInput;
    const data = await usersService.verifyCreateUserOtp(email, otp, verificationRequestId);
    res.status(200).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await usersService.createUser(req.body as CreateUserInput, req.user?.email);
    res.status(201).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await usersService.updateUser(req.params.id, req.body as UpdateUserInput);
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await usersService.deleteUser(req.params.id);
    res.json(ResponseFormatter.success(null, 'User deleted successfully'));
  } catch (err) {
    next(err);
  }
}

export async function assignRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roleId, assignedStores, primaryStoreId } = req.body as AssignRoleInput;
    const data = await usersService.assignRole(req.params.id, roleId, { assignedStores, primaryStoreId });
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sendEmail } = req.body as ResetPasswordInput;
    const data = await usersService.resetPassword(req.params.id, sendEmail !== false);
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function bulkUserAction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const data = await usersService.bulkUserAction(req.body as BulkUserActionInput);
    res.json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}
