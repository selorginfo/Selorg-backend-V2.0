import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import { HHDTask } from './hhd.models';
import { TASK_STATUS, TASK_PRIORITY, TaskStatus } from './hhd.constants';
import { mapTaskView } from './hhd.mappers';

function requireUserId(req: Request): string {
  const userId = req.hhdUser?.id;
  if (!userId) {
    throw new AppError('User ID is required', 401, 'AUTH_REQUIRED');
  }
  return userId;
}

function parsePageLimit(query: Record<string, string | undefined>): {
  page: number;
  limit: number;
} {
  const page = Math.max(1, parseInt(String(query.page ?? 1), 10) || 1);
  const rawLimit = parseInt(String(query.limit ?? 20), 10) || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  return { page, limit };
}

const PRIORITY_WEIGHT: Record<string, number> = {
  [TASK_PRIORITY.URGENT]: 4,
  [TASK_PRIORITY.HIGH]: 3,
  [TASK_PRIORITY.MEDIUM]: 2,
  [TASK_PRIORITY.LOW]: 1,
};

/**
 * GET /tasks
 * Query: { status?, page?, limit? }
 */
export async function listTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { status } = req.query as { status?: string };
    const { page, limit } = parsePageLimit(req.query as Record<string, string | undefined>);

    if (status && !Object.values(TASK_STATUS).includes(status as TaskStatus)) {
      return next(new AppError(`Invalid status '${status}'`, 400, 'VALIDATION_ERROR'));
    }

    const filter: Record<string, unknown> = { userId };
    if (status) filter.status = status;

    // Fetch a window large enough to sort incomplete-first then paginate in memory,
    // or use aggregation. Prefer aggregation for correctness at scale.
    const skip = (page - 1) * limit;

    const [total, tasks] = await Promise.all([
      HHDTask.countDocuments(filter),
      HHDTask.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), ...(status ? { status } : {}) } },
        {
          $addFields: {
            _incomplete: {
              $cond: [{ $eq: ['$status', TASK_STATUS.COMPLETED] }, 1, 0],
            },
            _priorityWeight: {
              $switch: {
                branches: [
                  { case: { $eq: ['$priority', TASK_PRIORITY.URGENT] }, then: 4 },
                  { case: { $eq: ['$priority', TASK_PRIORITY.HIGH] }, then: 3 },
                  { case: { $eq: ['$priority', TASK_PRIORITY.MEDIUM] }, then: 2 },
                  { case: { $eq: ['$priority', TASK_PRIORITY.LOW] }, then: 1 },
                ],
                default: 0,
              },
            },
          },
        },
        { $sort: { _incomplete: 1, _priorityWeight: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),
    ]);

    // Fallback if aggregate returns empty but count > 0 without ObjectId match quirks
    let rows = tasks;
    if (rows.length === 0 && total > 0) {
      const all = await HHDTask.find(filter).lean();
      all.sort((a, b) => {
        const aDone = a.status === TASK_STATUS.COMPLETED ? 1 : 0;
        const bDone = b.status === TASK_STATUS.COMPLETED ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        const pw = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
        if (pw !== 0) return pw;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      rows = all.slice(skip, skip + limit);
    }

    const data = rows.map((t) => mapTaskView(t));
    res.status(200).json(ResponseFormatter.paginated(data, total, page, limit, 'Tasks fetched'));
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /tasks/:taskId
 * Body: { done?: boolean, status?: string, notes?: string }
 */
export async function updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const { taskId } = req.params;
    const { done, status, notes } = req.body as {
      done?: boolean;
      status?: string;
      notes?: string;
    };

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return next(new AppError('taskId must be a valid ObjectId', 400, 'VALIDATION_ERROR'));
    }

    if (status === undefined && done === undefined) {
      return next(new AppError('done (boolean) is required', 400, 'VALIDATION_ERROR'));
    }

    const task = await HHDTask.findById(taskId);
    if (!task) {
      return next(new AppError(`Task not found with id of ${taskId}`, 404, 'NOT_FOUND'));
    }

    if (String(task.userId) !== userId) {
      return next(new AppError('Access denied for this task', 403, 'ACCESS_DENIED'));
    }

    if (task.status === TASK_STATUS.CANCELLED) {
      return next(new AppError('Cancelled tasks cannot be updated', 409, 'TASK_CANCELLED'));
    }

    if (status != null) {
      if (!Object.values(TASK_STATUS).includes(status as TaskStatus)) {
        return next(new AppError(`Invalid status '${status}'`, 400, 'VALIDATION_ERROR'));
      }
      task.status = status as TaskStatus;
      if (status === TASK_STATUS.COMPLETED) {
        task.completedAt = new Date();
      } else if (status === TASK_STATUS.PENDING || status === TASK_STATUS.IN_PROGRESS) {
        task.completedAt = undefined;
      }
    } else if (typeof done === 'boolean') {
      if (done) {
        task.status = TASK_STATUS.COMPLETED;
        task.completedAt = new Date();
      } else {
        task.status = TASK_STATUS.PENDING;
        task.completedAt = undefined;
      }
    } else {
      return next(new AppError('done must be a boolean', 400, 'VALIDATION_ERROR'));
    }

    if (notes != null) {
      task.description = String(notes).slice(0, 500);
    }

    await task.save();
    res.status(200).json(ResponseFormatter.success(mapTaskView(task)));
  } catch (error) {
    next(error);
  }
}
