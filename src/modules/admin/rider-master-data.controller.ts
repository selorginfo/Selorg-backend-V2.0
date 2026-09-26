import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { PickerUser } from '../picker/picker.models';
import { PickerOnboardingApplication } from '../picker/picker.rider.models';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import {
  RIDER_APP_USER_FILTER,
  findPickerFleetUser,
  listPickerFleetUsers,
  mapPickerToAdminDirectory,
} from '../rider/pickerFleet.bridge';
import * as pickerService from '../picker/picker.service';

const ALLOWED_STATUSES = new Set([
  'PENDING',
  'ACTIVE',
  'INACTIVE',
  'REJECTED',
  'SUSPENDED',
  'BLOCKED',
  'DELETION_PENDING',
]);

/** Map dashboard approve/reject vocabulary onto PickerUser.status enum. */
function mapRiderStatus(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'approve' || lower === 'approved') return 'ACTIVE';
  if (lower === 'reject' || lower === 'rejected') return 'REJECTED';
  if (lower === 'pending' || lower === 'under_review' || lower === 'interview' || lower === 'documents_required') {
    return 'PENDING';
  }
  if (lower === 'active') return 'ACTIVE';
  if (lower === 'inactive') return 'INACTIVE';
  if (lower === 'suspended') return 'SUSPENDED';
  if (lower === 'blocked') return 'BLOCKED';
  const upper = value.toUpperCase();
  return ALLOWED_STATUSES.has(upper) ? upper : null;
}

export async function listRiders(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const riders = await listPickerFleetUsers(200);
    const data = riders.map(mapPickerToAdminDirectory);
    res.status(200).json({ success: true, data, total: data.length });
  } catch (error) {
    next(error);
  }
}

export async function getRiderById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    const rider = await findPickerFleetUser(id);
    if (!rider) {
      throw AppError.notFound('Rider', id);
    }
    res.status(200).json({
      success: true,
      data: mapPickerToAdminDirectory(rider),
    });
  } catch (error) {
    next(error);
  }
}

export async function listRiderDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid rider id');
    }
    const rider = await findPickerFleetUser(id);
    if (!rider) {
      throw AppError.notFound('Rider', id);
    }
    const documents = await pickerService.listDocumentsForAdmin(id);
    res.status(200).json(ResponseFormatter.success({ riderId: id, documents }));
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

    const body = (req.body || {}) as {
      status?: unknown;
      note?: string;
      reason?: string;
      rejectionReason?: string;
    };
    const status = mapRiderStatus(body.status);
    if (!status) {
      throw AppError.badRequest('Invalid status');
    }

    const note = String(body.note || body.reason || body.rejectionReason || '').trim();
    if (status === 'REJECTED' && !note) {
      throw AppError.badRequest('A rejection reason is required so the rider can fix and resubmit');
    }

    const existing = await PickerUser.findOne({ _id: id, ...RIDER_APP_USER_FILTER })
      .select('_id status workforceRole')
      .lean();
    if (!existing) {
      throw AppError.notFound('Rider', id);
    }

    const reviewedBy = req.user?.userId || 'system';
    const now = new Date();
    const $set: Record<string, unknown> = { status };
    const $unset: Record<string, 1> = {};

    if (status === 'ACTIVE') {
      $set.approvedAt = now;
      if (mongoose.Types.ObjectId.isValid(reviewedBy)) {
        $set.approvedBy = new mongoose.Types.ObjectId(reviewedBy);
      }
      $unset.rejectedReason = 1;
      $unset.rejectedAt = 1;
    } else if (status === 'REJECTED') {
      $set.rejectedReason = note;
      $set.rejectedAt = now;
      $set.isOnline = false;
      $set.onlineSince = null;
    } else if (status === 'INACTIVE' || status === 'SUSPENDED' || status === 'BLOCKED') {
      $set.isOnline = false;
      $set.onlineSince = null;
    }

    const update: Record<string, unknown> = { $set };
    if (Object.keys($unset).length) update.$unset = $unset;

    const updated = await PickerUser.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) {
      throw AppError.notFound('Rider', id);
    }

    if (status === 'ACTIVE') {
      await PickerOnboardingApplication.updateOne(
        { pickerId: new mongoose.Types.ObjectId(id) },
        { $set: { status: 'approved', reviewedAt: now, reviewedBy }, $unset: { rejectionReason: 1 } },
      );
    } else if (status === 'REJECTED') {
      await PickerOnboardingApplication.updateOne(
        { pickerId: new mongoose.Types.ObjectId(id) },
        { $set: { status: 'rejected', rejectionReason: note, reviewedAt: now, reviewedBy } },
      );
    } else if (status === 'PENDING') {
      await PickerOnboardingApplication.updateOne(
        { pickerId: new mongoose.Types.ObjectId(id), status: { $ne: 'approved' } },
        { $set: { status: 'under_review' } },
      );
    }

    res.status(200).json(
      ResponseFormatter.success(
        mapPickerToAdminDirectory(updated as Parameters<typeof mapPickerToAdminDirectory>[0]),
        'Rider status updated',
      ),
    );
  } catch (error) {
    next(error);
  }
}
