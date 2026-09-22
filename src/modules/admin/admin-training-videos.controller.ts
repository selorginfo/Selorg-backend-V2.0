import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { PickerTrainingVideo, PickerUser } from '../picker/picker.models';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseBoolean(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'boolean') return raw;
  const value = String(raw).toLowerCase();
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

function shapeVideo(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    videoId: doc.videoId ?? '',
    title: doc.title ?? '',
    description: doc.description ?? '',
    url: doc.url ?? '',
    thumbnailUrl: doc.thumbnailUrl ?? '',
    durationSeconds: doc.durationSeconds ?? null,
    order: doc.order ?? 0,
    warehouseKey: doc.warehouseKey ?? null,
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

/** `:id` accepts either the Mongo `_id` or the business `videoId` the rider app uses. */
function videoLookup(id: string): Record<string, unknown> {
  return mongoose.Types.ObjectId.isValid(id) ? { _id: new mongoose.Types.ObjectId(id) } : { videoId: id };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function resolveVideoId(requested: unknown, title: string): Promise<string> {
  const explicit = String(requested ?? '').trim();
  if (explicit) {
    const clash = await PickerTrainingVideo.findOne({ videoId: explicit }).select('_id').lean();
    if (clash) throw new AppError(`A training video with videoId "${explicit}" already exists`, 409, 'VIDEO_ID_EXISTS');
    return explicit;
  }

  const base = slugify(title) || 'training-video';
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const clash = await PickerTrainingVideo.findOne({ videoId: candidate }).select('_id').lean();
    if (!clash) return candidate;
  }
  throw new AppError('Could not derive a unique videoId — supply videoId explicitly', 409, 'VIDEO_ID_EXISTS');
}

export async function listTrainingVideos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 50);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    const isActive = parseBoolean(req.query.isActive);
    if (isActive !== undefined) filter.isActive = isActive;
    if (req.query.warehouseKey) filter.warehouseKey = String(req.query.warehouseKey).trim();
    if (req.query.q) {
      const re = new RegExp(escapeRegex(String(req.query.q)), 'i');
      filter.$or = [{ title: re }, { description: re }, { videoId: re }];
    }

    const [videos, total] = await Promise.all([
      PickerTrainingVideo.find(filter).sort({ order: 1, createdAt: 1 }).skip(skip).limit(limit).lean(),
      PickerTrainingVideo.countDocuments(filter),
    ]);

    const data = (videos as Array<Record<string, unknown>>).map(shapeVideo);
    res.status(200).json({ success: true, data, total, page, limit });
  } catch (error) {
    next(error);
  }
}

export async function getPickerProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 50);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    const pickerId = String(req.query.pickerId || req.query.userId || '').trim();
    if (pickerId) {
      if (!mongoose.Types.ObjectId.isValid(pickerId)) throw AppError.badRequest('Invalid picker id');
      filter._id = new mongoose.Types.ObjectId(pickerId);
    }
    if (req.query.status) filter.status = String(req.query.status).trim().toUpperCase();
    if (req.query.workforceRole) filter.workforceRole = String(req.query.workforceRole).trim().toLowerCase();
    const completed = parseBoolean(req.query.completed);
    if (completed !== undefined) filter.trainingCompleted = completed;
    if (req.query.q) {
      const re = new RegExp(escapeRegex(String(req.query.q)), 'i');
      filter.$or = [{ name: re }, { phone: re }, { email: re }];
    }

    const [videos, pickers, total] = await Promise.all([
      PickerTrainingVideo.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean(),
      PickerUser.find(filter)
        .select('_id name phone workforceRole status trainingProgress trainingCompleted trainingCompletedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PickerUser.countDocuments(filter),
    ]);

    const activeVideos = videos as Array<Record<string, unknown>>;

    const data = (pickers as Array<Record<string, unknown>>).map((picker) => {
      const progress = (picker.trainingProgress ?? {}) as Record<string, unknown>;
      const perVideo = activeVideos.map((video) => {
        const key = String(video.videoId);
        const percent = Number(progress[key]) || 0;
        return {
          videoId: key,
          title: video.title ?? '',
          order: video.order ?? 0,
          durationSeconds: video.durationSeconds ?? null,
          percent,
          completed: percent >= 100,
        };
      });
      const completedCount = perVideo.filter((v) => v.completed).length;

      return {
        pickerId: String(picker._id),
        name: (picker.name as string) ?? null,
        phone: (picker.phone as string) ?? null,
        workforceRole: (picker.workforceRole as string) ?? null,
        status: (picker.status as string) ?? null,
        trainingCompleted: picker.trainingCompleted === true,
        trainingCompletedAt: picker.trainingCompletedAt ?? null,
        totalVideos: activeVideos.length,
        completedVideos: completedCount,
        overallPercent: activeVideos.length
          ? Math.round((perVideo.reduce((sum, v) => sum + Math.min(100, v.percent), 0) / activeVideos.length) * 10) / 10
          : 0,
        videos: perVideo,
      };
    });

    res.status(200).json({ success: true, data, total, page, limit });
  } catch (error) {
    next(error);
  }
}

export async function getTrainingVideoById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) throw AppError.badRequest('id is required');

    const video = await PickerTrainingVideo.findOne(videoLookup(id)).lean();
    if (!video) throw AppError.notFound('Training video', id);

    res.status(200).json({ success: true, data: shapeVideo(video as Record<string, unknown>) });
  } catch (error) {
    next(error);
  }
}

export async function createTrainingVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const title = String(body.title ?? '').trim();
    const url = String(body.url ?? '').trim();
    if (!title) throw AppError.badRequest('title is required');
    if (!url) throw AppError.badRequest('url is required');

    const durationRaw = body.durationSeconds;
    let durationSeconds: number | undefined;
    if (durationRaw !== undefined && durationRaw !== null && durationRaw !== '') {
      durationSeconds = Number(durationRaw);
      if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
        throw AppError.badRequest('durationSeconds must be a non-negative number');
      }
    }

    const orderRaw = body.order;
    let order = 0;
    if (orderRaw !== undefined && orderRaw !== null && orderRaw !== '') {
      order = Number(orderRaw);
      if (!Number.isFinite(order)) throw AppError.badRequest('order must be a number');
    }

    const videoId = await resolveVideoId(body.videoId, title);
    const isActive = parseBoolean(body.isActive);

    const created = await PickerTrainingVideo.create({
      videoId,
      title,
      description: body.description !== undefined ? String(body.description).trim() : undefined,
      url,
      thumbnailUrl: body.thumbnailUrl !== undefined ? String(body.thumbnailUrl).trim() : undefined,
      durationSeconds,
      order,
      warehouseKey: body.warehouseKey ? String(body.warehouseKey).trim() : undefined,
      isActive: isActive === undefined ? true : isActive,
    });

    res.status(201).json({ success: true, data: shapeVideo(created.toObject() as Record<string, unknown>) });
  } catch (error) {
    next(error);
  }
}

export async function updateTrainingVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) throw AppError.badRequest('id is required');

    const body = (req.body ?? {}) as Record<string, unknown>;
    const update: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) throw AppError.badRequest('title cannot be empty');
      update.title = title;
    }
    if (body.url !== undefined) {
      const url = String(body.url).trim();
      if (!url) throw AppError.badRequest('url cannot be empty');
      update.url = url;
    }
    if (body.description !== undefined) update.description = String(body.description).trim();
    if (body.thumbnailUrl !== undefined) update.thumbnailUrl = String(body.thumbnailUrl).trim();
    if (body.warehouseKey !== undefined) update.warehouseKey = String(body.warehouseKey).trim();

    if (body.durationSeconds !== undefined) {
      const duration = Number(body.durationSeconds);
      if (!Number.isFinite(duration) || duration < 0) throw AppError.badRequest('durationSeconds must be a non-negative number');
      update.durationSeconds = duration;
    }
    if (body.order !== undefined) {
      const order = Number(body.order);
      if (!Number.isFinite(order)) throw AppError.badRequest('order must be a number');
      update.order = order;
    }
    if (body.isActive !== undefined) {
      const isActive = parseBoolean(body.isActive);
      if (isActive === undefined) throw AppError.badRequest('isActive must be a boolean');
      update.isActive = isActive;
    }

    if (Object.keys(update).length === 0) throw AppError.badRequest('At least one field is required');

    const video = await PickerTrainingVideo.findOneAndUpdate(videoLookup(id), { $set: update }, { new: true, runValidators: true }).lean();
    if (!video) throw AppError.notFound('Training video', id);

    res.status(200).json({ success: true, data: shapeVideo(video as Record<string, unknown>) });
  } catch (error) {
    next(error);
  }
}

export async function deleteTrainingVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) throw AppError.badRequest('id is required');

    const video = await PickerTrainingVideo.findOneAndDelete(videoLookup(id)).lean();
    if (!video) throw AppError.notFound('Training video', id);

    res.status(200).json({ success: true, data: { id: String((video as Record<string, unknown>)._id), deleted: true } });
  } catch (error) {
    next(error);
  }
}
