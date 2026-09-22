import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import { AppError } from '../../utils/AppError';
import * as userService from './user.service';
import type { UpdateProfileInput, ChangePasswordInput, UploadAvatarInput } from './user.validation';

function noStore(res: Response) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
}

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    noStore(res);
    if (!req.customer?._id) throw AppError.unauthorized();
    res.status(200).json(ResponseFormatter.success(await userService.getProfile(req.customer._id)));
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    noStore(res);
    if (!req.customer?._id) throw AppError.unauthorized();
    const result = await userService.updateProfile(req.customer._id, req.body as UpdateProfileInput);
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    await userService.changePassword(req.customer._id, req.body as ChangePasswordInput);
    res.status(200).json(ResponseFormatter.success(null, 'Password updated'));
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    noStore(res);
    if (!req.customer?._id) throw AppError.unauthorized();
    const body = req.body as UploadAvatarInput;
    const image = body.image || body.avatar || body.file;
    if (!image) throw AppError.badRequest('image (base64) is required');
    res.status(200).json(ResponseFormatter.success(await userService.uploadAvatar(req.customer._id, image)));
  } catch (err) {
    next(err);
  }
}
