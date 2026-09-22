import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import { HHDUser } from './hhd.models';
import { PickerUser, PickerDevice } from '../picker/picker.models';

/**
 * GET /devices/current
 * Returns { deviceId, deviceAssigned, darkstore, shift } from HHDUser + picker device.
 */
export async function getCurrentDevice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const hhdUserId = req.hhdUser?.id;
    if (!hhdUserId) {
      return next(new AppError('Unauthorized', 401, 'AUTH_REQUIRED'));
    }

    const hhdUser = await HHDUser.findById(hhdUserId).select('deviceId warehouse darkstore shift').lean();
    if (!hhdUser) {
      return next(new AppError('User not found', 404, 'NOT_FOUND'));
    }

    const darkstore = (hhdUser.darkstore as string) || (hhdUser.warehouse as string) || null;
    const shift = {
      startTime: hhdUser.shift?.startTime || '09:00',
      endTime: hhdUser.shift?.endTime || '17:00',
    };

    const pickerUser = await PickerUser.findOne({
      hhdUserId: new mongoose.Types.ObjectId(hhdUserId),
    })
      .select('_id')
      .lean();

    if (!pickerUser) {
      res.status(200).json(
        ResponseFormatter.success({
          deviceId: hhdUser.deviceId ?? null,
          deviceAssigned: Boolean(hhdUser.deviceId),
          darkstore,
          shift,
        }),
      );
      return;
    }

    const device = await PickerDevice.findOne({
      assignedTo: (pickerUser as { _id: mongoose.Types.ObjectId })._id,
      status: 'assigned',
    })
      .select('deviceId')
      .lean();

    const deviceId =
      (device as { deviceId?: string } | null)?.deviceId ?? hhdUser.deviceId ?? null;

    res.status(200).json(
      ResponseFormatter.success({
        deviceId,
        deviceAssigned: Boolean(deviceId),
        darkstore,
        shift,
      }),
    );
  } catch (error) {
    next(error);
  }
}
