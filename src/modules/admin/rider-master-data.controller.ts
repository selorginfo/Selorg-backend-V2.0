import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { PickerUser } from '../picker/picker.models';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';

const ALLOWED_STATUSES = new Set([
  'PENDING',
  'ACTIVE',
  'INACTIVE',
  'REJECTED',
  'SUSPENDED',
  'BLOCKED',
  'DELETION_PENDING',
]);

type RiderDoc = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  status?: string;
  workforceRole?: string | null;
};

/** Map dashboard approve/reject vocabulary onto PickerUser.status enum. */
function mapRiderStatus(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'approve' || lower === 'approved') return 'ACTIVE';
  if (lower === 'reject' || lower === 'rejected') return 'REJECTED';
  if (lower === 'pending') return 'PENDING';
  if (lower === 'active') return 'ACTIVE';
  if (lower === 'inactive') return 'INACTIVE';
  if (lower === 'suspended') return 'SUSPENDED';
  if (lower === 'blocked') return 'BLOCKED';
  const upper = value.toUpperCase();
  return ALLOWED_STATUSES.has(upper) ? upper : null;
}

export async function listRiders(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const riders = await PickerUser.find({
      $or: [
        { workforceRole: 'rider' },
        { workforceRole: { $exists: false } },
        { workforceRole: null },
      ],
    }).sort({ createdAt: -1 }).limit(200).lean();
    const data = (riders as RiderDoc[]).map((r) => ({
      id: String(r._id),
      name: r.name ?? '',
      status: r.status ?? 'PENDING',
      workforceRole: r.workforceRole ?? 'rider',
    }));
    res.status(200).json({ success: true, data, total: data.length });
  } catch (error) {
    next(error);
  }
}

export async function getRiderById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid rider id');
    }
    const rider = (await PickerUser.findById(id).lean()) as RiderDoc | null;
    if (!rider) {
      throw AppError.notFound('Rider', id);
    }
    if (rider.workforceRole === 'picker') {
      throw AppError.notFound('Rider', id);
    }
    res.status(200).json({
      success: true,
      data: {
        id: String(rider._id),
        name: rider.name,
        status: rider.status,
        workforceRole: rider.workforceRole ?? 'rider',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateRiderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid rider id');
    }

    const status = mapRiderStatus((req.body as { status?: unknown } | undefined)?.status);
    if (!status) {
      throw AppError.badRequest('Invalid status');
    }

    const existing = (await PickerUser.findById(id).select('_id status workforceRole').lean()) as RiderDoc | null;
    if (!existing) {
      throw AppError.notFound('Rider', id);
    }

    const updated = (await PickerUser.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          ...(status === 'ACTIVE' ? { approvedAt: new Date() } : {}),
        },
      },
      { new: true },
    ).lean()) as RiderDoc | null;

    if (!updated) {
      throw AppError.notFound('Rider', id);
    }

    res.status(200).json(
      ResponseFormatter.success(
        {
          id: String(updated._id),
          status: updated.status,
          workforceRole: updated.workforceRole ?? 'rider',
        },
        'Rider status updated',
      ),
    );
  } catch (error) {
    next(error);
  }
}
