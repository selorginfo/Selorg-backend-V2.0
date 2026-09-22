import mongoose from 'mongoose';
import { Notification, PushToken } from './notifications.model';
import { CustomerUser } from '../auth/auth.model';
import { NotificationCategory } from './notifications.constants';

const INBOX_FILTER = { suppressed: { $ne: true } };

export function listNotifications(userId: string, skip: number, limit: number, filter: { category?: NotificationCategory; unreadOnly?: boolean }) {
  const userFilter: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(userId), ...INBOX_FILTER };
  if (filter.category) userFilter.category = filter.category;
  if (filter.unreadOnly) userFilter.read = false;

  return Promise.all([
    Notification.find(userFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(userFilter),
    Notification.countDocuments({ userId: new mongoose.Types.ObjectId(userId), ...INBOX_FILTER, read: false }),
  ]);
}

export function findInboxNotification(userId: string, notificationId: string) {
  return Notification.findOne({ _id: notificationId, userId: new mongoose.Types.ObjectId(userId), ...INBOX_FILTER });
}

export function updateReadState(userId: string, notificationId: string, read: boolean) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId: new mongoose.Types.ObjectId(userId), ...INBOX_FILTER },
    { $set: { read } },
    { new: true },
  ).lean();
}

export function markAllRead(userId: string) {
  return Notification.updateMany({ userId: new mongoose.Types.ObjectId(userId), read: false, ...INBOX_FILTER }, { $set: { read: true } });
}

export function deleteNotification(userId: string, notificationId: string) {
  return Notification.findOneAndDelete({ _id: notificationId, userId: new mongoose.Types.ObjectId(userId) }).lean();
}

export function getUnreadCount(userId: string) {
  return Notification.countDocuments({ userId: new mongoose.Types.ObjectId(userId), ...INBOX_FILTER, read: false });
}

// --- Preferences -----------------------------------------------------------

export function findNotificationPreferences(userId: string) {
  return CustomerUser.findById(userId).select('notificationPreferences').lean();
}

export function updateNotificationPreferences(userId: string, updates: Record<string, unknown>) {
  return CustomerUser.findByIdAndUpdate(userId, { $set: updates }, { new: true }).select('notificationPreferences').lean();
}

// --- Push tokens -------------------------------------------------------------

export function deactivateAllTokens(userId: string) {
  return PushToken.updateMany({ userId, active: true }, { $set: { active: false } });
}

export function reactivateAllTokens(userId: string) {
  return PushToken.updateMany({ userId, active: false }, { $set: { active: true } });
}

export function upsertPushToken(userId: string, token: string, update: Record<string, unknown>) {
  return PushToken.findOneAndUpdate({ userId, token }, update, { upsert: true, new: true });
}

export function deactivateToken(userId: string, token: string) {
  return PushToken.findOneAndUpdate({ userId, token }, { $set: { active: false } });
}

export async function getActiveFcmTokens(userId: string): Promise<string[]> {
  const docs = await PushToken.find({ userId, active: true, tokenType: 'fcm' }).select('token').lean();
  return docs.map(d => d.token);
}
