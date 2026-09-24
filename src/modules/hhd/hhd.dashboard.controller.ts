import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import { HHDUser, HHDOrder, HHDCompletedOrder, IHHDCompletedOrder } from './hhd.models';
import { ORDER_STATUS } from './hhd.constants';

const ACTIVE_STATUSES = [
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.BAG_SCANNED,
  ORDER_STATUS.PICKING,
  ORDER_STATUS.PHOTO_VERIFIED,
];

function resolvePickTimeSeconds(order: IHHDCompletedOrder | Record<string, unknown>): number | null {
  const o = order as Record<string, unknown>;
  if (o.pickTimeSeconds != null && Number(o.pickTimeSeconds) > 0) {
    return Math.round(Number(o.pickTimeSeconds));
  }
  if (o.startedAt && o.completedAt) {
    const secs = Math.round(
      (new Date(o.completedAt as string).getTime() - new Date(o.startedAt as string).getTime()) /
        1000,
    );
    if (secs > 0) return secs;
  }
  if (o.pickTime != null && Number(o.pickTime) > 0) {
    // Legacy: pickTime stored as minutes
    return Math.round(Number(o.pickTime) * 60);
  }
  return null;
}

function parseShiftHour(hhmm?: string, fallback = 9): number {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return fallback;
  return parseInt(hhmm.split(':')[0], 10);
}

/**
 * GET /dashboard
 */
export async function getDashboard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.hhdUser?.id;
    if (!userId) {
      return next(new AppError('User not authenticated', 401, 'AUTH_REQUIRED'));
    }

    const user = await HHDUser.findById(userId).select('-password').lean();
    if (!user) {
      return next(new AppError('User not found', 404, 'NOT_FOUND'));
    }

    const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
    const connectionStatus =
      lastLogin && Date.now() - lastLogin.getTime() <= 2 * 60 * 1000 ? 'online' : 'offline';

    await HHDUser.updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: { lastLogin: new Date() } },
    ).catch(() => {});

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayCompletedOrders: IHHDCompletedOrder[] = await HHDCompletedOrder.find({
      userId: new mongoose.Types.ObjectId(userId),
      completedAt: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    const todayCompleted = todayCompletedOrders.length;

    let totalPickTimeSeconds = 0;
    let validPickTimeCount = 0;
    for (const order of todayCompletedOrders) {
      const pickTimeSeconds = resolvePickTimeSeconds(order);
      if (pickTimeSeconds !== null && pickTimeSeconds > 0) {
        totalPickTimeSeconds += pickTimeSeconds;
        validPickTimeCount++;
      }
    }
    const averagePickTimeSeconds =
      validPickTimeCount > 0 ? Math.round(totalPickTimeSeconds / validPickTimeCount) : 0;

    let slaCompliance: number | null = null;
    if (todayCompleted > 0) {
      let eligible = 0;
      let compliant = 0;
      for (const order of todayCompletedOrders) {
        if (order.targetTime == null || Number(order.targetTime) <= 0) {
          continue;
        }
        const pickSecs = resolvePickTimeSeconds(order);
        if (pickSecs == null) continue;
        eligible += 1;
        const targetSecs = Number(order.targetTime) * 60;
        if (pickSecs <= targetSecs) compliant += 1;
      }
      slaCompliance = eligible > 0 ? Math.round((compliant / eligible) * 100) : null;
    }

    const stats = user.accuracyStats || {
      successfulUnits: 0,
      misScans: 0,
      shortPicks: 0,
      rescans: 0,
      substitutions: 0,
    };
    const successful = Number(stats.successfulUnits || 0);
    const misScans = Number(stats.misScans || 0);
    const shortPicks = Number(stats.shortPicks || 0);
    const denom = successful + misScans + shortPicks;
    const accuracyPercent = denom === 0 ? 100 : Math.round((successful / denom) * 100);

    const activeOrder = await HHDOrder.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      status: { $in: ACTIVE_STATUSES },
    })
      .sort({ updatedAt: -1 })
      .lean();

    let statusCurrent = 'waiting';
    if (activeOrder) {
      statusCurrent =
        activeOrder.status === ORDER_STATUS.PICKING ||
        activeOrder.status === ORDER_STATUS.BAG_SCANNED ||
        activeOrder.status === ORDER_STATUS.PHOTO_VERIFIED
          ? activeOrder.status === ORDER_STATUS.PICKING
            ? 'picking'
            : activeOrder.status
          : 'assigned';
    }

    const userShift = user.shift || {
      startTime: '09:00',
      endTime: '17:00',
      breakScheduled: '12:00-12:30',
      dailyTarget: 50,
      shiftTarget: 25,
    };
    const startHour = parseShiftHour(userShift.startTime, 9);
    const endHour = parseShiftHour(userShift.endTime, 17);
    const currentHour = now.getHours();
    const shiftLength = Math.max(1, endHour - startHour);

    const shift = {
      startTime: userShift.startTime || '09:00',
      endTime: userShift.endTime || '17:00',
      hoursWorked: Math.max(0, Math.min(shiftLength, currentHour - startHour)),
      remainingTime: Math.max(0, endHour - currentHour),
      breakScheduled: userShift.breakScheduled || '12:00-12:30',
    };

    const dashboardData = {
      user: {
        name: user.name ?? 'User',
        deviceId: user.deviceId ?? 'N/A',
        role: user.role,
      },
      goals: {
        dailyTarget: userShift.dailyTarget ?? 50,
        shiftTarget: userShift.shiftTarget ?? 25,
        type: 'orders',
      },
      statistics: {
        todayCompleted,
        accuracyPercent,
        averagePickTimeSeconds,
        slaCompliance,
      },
      status: {
        current: statusCurrent,
        assignmentMode: 'auto',
        connectionStatus,
        nextOrderETA: null,
        queuePosition: null,
      },
      shift,
      notifications: (
        await HHDOrder.find({ userId: new mongoose.Types.ObjectId(userId) })
          .sort({ updatedAt: -1 })
          .limit(20)
          .select('orderId status rackLocation updatedAt')
          .lean()
      ).map(order => ({
        id: String(order.orderId),
        title: String(order.orderId),
        body: `Status ${String(order.status).replace(/_/g, ' ')}${
          order.rackLocation ? ` · ${order.rackLocation}` : ''
        }`,
        at: order.updatedAt ? new Date(order.updatedAt).toISOString() : new Date().toISOString(),
      })),
    };

    res.status(200).json(ResponseFormatter.success(dashboardData));
  } catch (error) {
    next(error);
  }
}
