import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { PickerActionLog, PickerUser } from '../picker/picker.models';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listPickerActionLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 50);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    const userId = String(req.query.userId || req.query.pickerId || '').trim();
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) throw AppError.badRequest('Invalid picker id');
      filter.userId = new mongoose.Types.ObjectId(userId);
    }

    if (req.query.action) filter.action = String(req.query.action).trim();
    if (req.query.entityType) filter.entityType = String(req.query.entityType).trim();
    if (req.query.entityId) filter.entityId = String(req.query.entityId).trim();

    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    if (from && Number.isNaN(from.getTime())) throw AppError.badRequest('from must be a valid date');
    if (to && Number.isNaN(to.getTime())) throw AppError.badRequest('to must be a valid date');
    if (from || to) {
      filter.createdAt = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }

    if (req.query.q) {
      const re = new RegExp(escapeRegex(String(req.query.q)), 'i');
      filter.$or = [{ action: re }, { entityType: re }, { entityId: re }];
    }

    const [logs, total] = await Promise.all([
      PickerActionLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PickerActionLog.countDocuments(filter),
    ]);

    const rows = logs as Array<Record<string, unknown>>;
    const pickerIds = Array.from(new Set(rows.map((log) => String(log.userId)).filter(Boolean)));
    const pickers = pickerIds.length
      ? ((await PickerUser.find({ _id: { $in: pickerIds } })
          .select('_id name phone workforceRole')
          .lean()) as Array<Record<string, unknown>>)
      : [];
    const pickerById = new Map(pickers.map((p) => [String(p._id), p]));

    const data = rows.map((log) => {
      const picker = pickerById.get(String(log.userId));
      return {
        id: String(log._id),
        userId: String(log.userId),
        pickerName: (picker?.name as string) ?? null,
        pickerPhone: (picker?.phone as string) ?? null,
        workforceRole: (picker?.workforceRole as string) ?? null,
        action: log.action ?? '',
        entityType: log.entityType ?? null,
        entityId: log.entityId ?? null,
        details: log.details ?? null,
        ip: log.ip ?? null,
        userAgent: log.userAgent ?? null,
        createdAt: log.createdAt ?? null,
      };
    });

    res.status(200).json({ success: true, data, total, page, limit });
  } catch (error) {
    next(error);
  }
}
