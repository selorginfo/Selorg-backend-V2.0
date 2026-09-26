import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { ResponseFormatter } from '../../utils/response';
import { HHDUser } from './hhd.models';
import { mapUserView } from './hhd.mappers';
import { PickerUser } from '../picker/picker.models';

/**
 * GET /users/profile
 * Query: { sync } - if "1" or "true", update lastLogin to mark presence.
 */
export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const touchPresence =
      req.query?.sync === '1' || req.query?.sync === 'true' || (req.query?.sync as unknown) === true;
    const userId = req.hhdUser?.id;

    if (userId) {
      const { ensureHhdOperatorHub } = await import('./hhdOperator.bridge');
      await ensureHhdOperatorHub(userId);
    }

    const user = await HHDUser.findById(userId).select('-password');
    if (!user) {
      return next(new AppError('User not found', 404, 'NOT_FOUND'));
    }

    if (touchPresence) {
      await HHDUser.updateOne({ _id: userId }, { $set: { lastLogin: new Date() } }).catch(() => {});
      user.lastLogin = new Date();
    }

    res.status(200).json(ResponseFormatter.success(mapUserView(user)));
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /users/profile
 * Body: { name, email, warehouse, darkstore, mobile, deviceId, shift }
 */
export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, email, warehouse, darkstore, mobile, deviceId, shift } = req.body as {
      name?: string;
      email?: string;
      warehouse?: string;
      darkstore?: string;
      mobile?: string;
      deviceId?: string;
      shift?: {
        startTime?: string;
        endTime?: string;
        breakScheduled?: string;
        dailyTarget?: number;
        shiftTarget?: number;
      };
    };

    const user = await HHDUser.findById(req.hhdUser?.id);
    if (!user) {
      return next(new AppError('User not found', 404, 'NOT_FOUND'));
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (warehouse !== undefined) user.warehouse = warehouse;
    if (darkstore !== undefined) user.darkstore = darkstore;
    if (mobile !== undefined) user.mobile = mobile;
    if (deviceId !== undefined) user.deviceId = deviceId;
    if (shift && typeof shift === 'object') {
      user.shift = {
        startTime: shift.startTime ?? user.shift?.startTime ?? '09:00',
        endTime: shift.endTime ?? user.shift?.endTime ?? '17:00',
        breakScheduled: shift.breakScheduled ?? user.shift?.breakScheduled,
        dailyTarget: shift.dailyTarget ?? user.shift?.dailyTarget,
        shiftTarget: shift.shiftTarget ?? user.shift?.shiftTarget,
      };
    }

    await user.save();
    res.status(200).json(ResponseFormatter.success(mapUserView(user)));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /users/contract
 */
export async function getContract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pickerUser = await PickerUser.findOne({
      hhdUserId: new mongoose.Types.ObjectId(req.hhdUser?.id),
    })
      .select('contractInfo')
      .lean();
    res
      .status(200)
      .json(ResponseFormatter.success((pickerUser as { contractInfo?: unknown } | null)?.contractInfo ?? {}));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /users/employment
 */
export async function getEmployment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const pickerUser = await PickerUser.findOne({
      hhdUserId: new mongoose.Types.ObjectId(req.hhdUser?.id),
    })
      .select('employment')
      .lean();
    res
      .status(200)
      .json(ResponseFormatter.success((pickerUser as { employment?: unknown } | null)?.employment ?? {}));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /users/linked-picker-profile
 */
export async function getLinkedPickerProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const pickerUser = await PickerUser.findOne({
      hhdUserId: new mongoose.Types.ObjectId(req.hhdUser?.id),
    })
      .select('name email phone status locationType contractInfo employment photoUri')
      .lean();

    if (!pickerUser) {
      res.status(200).json(ResponseFormatter.success({ linked: false, picker: null }));
      return;
    }

    res.status(200).json(
      ResponseFormatter.success({
        linked: true,
        picker: pickerUser,
      }),
    );
  } catch (error) {
    next(error);
  }
}

/**
 * POST /users/heartbeat
 * Body: { deviceId, batteryLevel }
 */
export async function postHeartbeat(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const hhdUserId = req.hhdUser?.id;
    if (!hhdUserId) {
      return next(new AppError('Unauthorized', 401, 'AUTH_REQUIRED'));
    }

    const { deviceId: bodyDeviceId, batteryLevel } = req.body as {
      deviceId?: string;
      batteryLevel?: number;
    };

    if (batteryLevel !== undefined && batteryLevel !== null) {
      const n = Number(batteryLevel);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return next(
          new AppError('batteryLevel must be a number between 0 and 100', 400, 'VALIDATION_ERROR'),
        );
      }
    }

    const hhdUser = await HHDUser.findById(hhdUserId);
    if (!hhdUser) {
      return next(new AppError('User not found', 404, 'NOT_FOUND'));
    }

    const now = new Date();
    if (bodyDeviceId) hhdUser.deviceId = String(bodyDeviceId).trim();
    hhdUser.lastLogin = now;
    await hhdUser.save();

    const pickerUser = await PickerUser.findOne({
      hhdUserId: new mongoose.Types.ObjectId(hhdUserId),
    });

    if (!pickerUser) {
      res.status(200).json(
        ResponseFormatter.success(
          { lastSeenAt: null, linked: false, hsdDeviceOnline: false },
          'No picker account for this mobile; heartbeat recorded on HHD only',
        ),
      );
      return;
    }

    pickerUser.lastSeenAt = now;
    if (batteryLevel !== undefined && batteryLevel !== null) {
      pickerUser.batteryLevel = Number(batteryLevel);
    }
    await pickerUser.save();

    logger.info('[HHD Heartbeat] Picker presence updated', {
      hhdUserId,
      pickerUserId: (pickerUser._id as { toString(): string }).toString(),
    });

    res.status(200).json(
      ResponseFormatter.success({
        lastSeenAt: now,
        linked: true,
        deviceId: bodyDeviceId ?? hhdUser.deviceId ?? null,
        hsdDeviceOnline: false,
      }),
    );
  } catch (error) {
    next(error);
  }
}
