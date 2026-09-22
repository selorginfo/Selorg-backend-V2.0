import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { PickerUser } from '../picker/picker.models';

/**
 * PUT /admin/picker-users/:pickerUserId/link
 * Body: { hhdUserId: ObjectId | null }
 *
 * Links (or unlinks) a PickerUser to an HHDUser by setting picker_users.hhdUserId.
 */
export async function linkPickerUserToHhd(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { pickerUserId } = req.params;
    let { hhdUserId } = req.body as { hhdUserId?: string | null };

    if (!mongoose.Types.ObjectId.isValid(pickerUserId)) {
      return next(new AppError('Invalid picker user ID', 400, 'BAD_REQUEST'));
    }

    let resolvedHhdUserId: mongoose.Types.ObjectId | null = null;
    if (hhdUserId !== null && hhdUserId !== undefined) {
      if (mongoose.Types.ObjectId.isValid(hhdUserId)) {
        resolvedHhdUserId = new mongoose.Types.ObjectId(hhdUserId);
      } else {
        return next(new AppError('Invalid hhdUserId', 400, 'BAD_REQUEST'));
      }
    }

    const pickerUser = await PickerUser.findByIdAndUpdate(
      pickerUserId,
      { $set: { hhdUserId: resolvedHhdUserId } },
      { new: true },
    );

    if (!pickerUser) {
      return next(new AppError('Picker user not found', 404, 'NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: {
        pickerUserId: (pickerUser._id as { toString(): string }).toString(),
        hhdUserId: pickerUser.hhdUserId ? pickerUser.hhdUserId.toString() : null,
      },
    });
  } catch (error) {
    next(error);
  }
}
