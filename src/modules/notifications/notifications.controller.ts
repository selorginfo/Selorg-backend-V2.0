import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import { AppError } from '../../utils/AppError';
import * as notificationsService from './notifications.service';
import type {
  ListNotificationsQuery,
  UpdatePreferencesInput,
  RegisterPushTokenInput,
  RegisterWebPushInput,
  RemoveTokenInput,
} from './notifications.validation';
import { orderRealtime } from '../../realtime/orderRealtime';

function requireCustomerId(req: Request): string {
  if (!req.customer?._id) throw AppError.unauthorized();
  return req.customer._id;
}

// --- Preferences -----------------------------------------------------------

export async function getPreferencesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await notificationsService.getPreferences(requireCustomerId(req))));
  } catch (err) {
    next(err);
  }
}

export async function updatePreferencesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await notificationsService.updatePreferences(requireCustomerId(req), req.body as UpdatePreferencesInput);
    if (result.error) {
      res.status(400).json({ success: false, message: result.error });
      return;
    }
    res.status(200).json(ResponseFormatter.success(result.preferences));
  } catch (err) {
    next(err);
  }
}

// --- Inbox ---------------------------------------------------------------

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const q = req.query as ListNotificationsQuery;
    const page = q.page ? Number(q.page) : 1;
    const limit = Math.min(q.limit ? Number(q.limit) : 50, 100);
    const unreadOnly = q.unread === '1' || q.unread === 'true';
    const result = await notificationsService.listByUserId(userId, page, limit, { category: q.category, unreadOnly });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const count = await notificationsService.getUnreadCount(requireCustomerId(req));
    res.status(200).json(ResponseFormatter.success({ unreadCount: count }));
  } catch (err) {
    next(err);
  }
}

export async function markOneRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await notificationsService.markRead(requireCustomerId(req), req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function markOneUnread(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await notificationsService.markUnread(requireCustomerId(req), req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function markAllReadHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await notificationsService.markAllRead(requireCustomerId(req));
    res.status(200).json(ResponseFormatter.success(null));
  } catch (err) {
    next(err);
  }
}

export async function deleteOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await notificationsService.removeOne(requireCustomerId(req), req.params.id)));
  } catch (err) {
    next(err);
  }
}

export function vapidPublicKey(_req: Request, res: Response, next: NextFunction): void {
  try {
    res.status(200).json(ResponseFormatter.success(notificationsService.vapidPublicKey()));
  } catch (err) {
    next(err);
  }
}

// --- Push tokens -------------------------------------------------------------

export async function registerToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await notificationsService.registerToken(requireCustomerId(req), req.body as RegisterPushTokenInput);
    res.status(200).json({ success: true, message: 'Push token registered', data });
  } catch (err) {
    next(err);
  }
}

export async function registerWebPush(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await notificationsService.registerWebPush(requireCustomerId(req), req.body as RegisterWebPushInput, req.headers['user-agent']);
    res.status(200).json({ success: true, message: 'Web Push subscription registered' });
  } catch (err) {
    next(err);
  }
}

export async function removeToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.body as RemoveTokenInput;
    await notificationsService.removeToken(requireCustomerId(req), token);
    res.status(200).json({ success: true, message: 'Push token removed' });
  } catch (err) {
    next(err);
  }
}

export async function removeAllTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const deactivated = await notificationsService.removeAllTokens(requireCustomerId(req));
    res.status(200).json({ success: true, message: 'All push tokens removed', data: { deactivated } });
  } catch (err) {
    next(err);
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function adminList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Notification } = await import('./notifications.model');
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 20);
    const { userId, channel, type, read } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (userId) query.userId = userId;
    if (channel) query.channel = channel;
    if (type) query.type = type;
    if (read !== undefined) query.read = read === 'true';
    const [items, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Notification.countDocuments(query),
    ]);
    res.status(200).json({ success: true, data: items, total, page, limit });
  } catch (err) { next(err); }
}

export async function adminStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Notification } = await import('./notifications.model');
    const [total, unread, byChannel] = await Promise.all([
      Notification.countDocuments(),
      Notification.countDocuments({ read: false }),
      Notification.aggregate([{ $group: { _id: '$channel', count: { $sum: 1 } } }]),
    ]);
    res.status(200).json({ success: true, data: { total, unread, byChannel } });
  } catch (err) { next(err); }
}

export async function adminSend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Notification } = await import('./notifications.model');
    const { userIds, title, body, channel, type, data } = req.body as {
      userIds: string[]; title: string; body: string; channel?: string; type?: string; data?: unknown;
    };
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw AppError.badRequest('userIds array is required');
    }
    const payload =
      data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
    const docs = userIds.map((uid) => ({
      userId: uid,
      title,
      body,
      channel: channel || 'in_app',
      type: type || 'generic',
      data: payload,
      read: false,
    }));
    const created = await Notification.insertMany(docs);
    for (const doc of created) {
      orderRealtime.publishInboxNotification(String(doc.userId), {
        _id: doc._id,
        title: doc.title,
        body: doc.body,
        read: doc.read,
        data: (doc.data && typeof doc.data === 'object' ? doc.data : {}) as Record<string, unknown>,
        createdAt: doc.createdAt,
      });
    }
    res.status(201).json({ success: true, data: { count: created.length } });
  } catch (err) { next(err); }
}

export async function adminRemove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Notification } = await import('./notifications.model');
    await Notification.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (err) { next(err); }
}
