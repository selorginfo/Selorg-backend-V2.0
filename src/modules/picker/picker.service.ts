import mongoose from 'mongoose';
import {
  PickerUser, PickerShift, PickerShiftAssignment, PickerAttendance, PickerWallet,
  PickerTransaction, PickerWithdrawalRequest, PickerDocument, PickerDevice,
  PickerNotification, PickerBankAccount, PickerWorkLocation, PickerTrainingVideo,
  PickerActionLog, deriveDeliveryMode,
} from './picker.models';
import { Order } from '../orders/order.model';
import { storeRiderPosition, emitRiderLocation, emitOrderStatus } from '../../services/realtime.service';
import { bankLabel, maskAccountNumber } from './picker.format';

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getProfile(userId: string) {
  return PickerUser.findById(userId).lean();
}

export async function updateProfile(userId: string, updates: Record<string, unknown>) {
  const allowed = [
    'name', 'email', 'age', 'gender', 'photoUri', 'locationType', 'upiId', 'upiName', 'gpsLocation',
    'vehicleType', 'vehicleRegistrationNumber',
  ];
  const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
  if (typeof updates.photoUrl === 'string' && !safe.photoUri) safe.photoUri = updates.photoUrl;
  if (typeof safe.vehicleType === 'string') {
    safe.deliveryMode = deriveDeliveryMode(safe.vehicleType as string);
  }
  return PickerUser.findByIdAndUpdate(userId, safe, { new: true }).lean();
}

/** Credits a completed delivery onto the rider's payout wallet. */
export async function creditEarnings(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string,
): Promise<void> {
  if (!amount || amount <= 0) return;
  const oid = new mongoose.Types.ObjectId(userId);
  await PickerWallet.findOneAndUpdate(
    { userId: oid },
    { $inc: { availableBalance: amount, totalEarnings: amount }, $setOnInsert: { userId: oid, currency: 'INR' } },
    { upsert: true },
  );
  await PickerTransaction.create({
    userId: oid,
    type: 'credit',
    amount,
    description,
    referenceId,
    status: 'completed',
  });
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

export async function listAvailableShifts(warehouseKey: string) {
  const query: Record<string, unknown> = { status: 'SCHEDULED' };
  if (warehouseKey) query.warehouseKey = warehouseKey;
  return PickerShift.find(query).sort({ startTime: 1 }).lean();
}

export async function getMyShifts(userId: string) {
  return PickerShiftAssignment.find({ userId: new mongoose.Types.ObjectId(userId), status: { $in: ['ASSIGNED', 'STARTED'] } }).populate('shiftId').sort({ date: 1 }).lean();
}

export async function selectShift(userId: string, shiftId: string) {
  const shift = await PickerShift.findById(shiftId);
  if (!shift) throw Object.assign(new Error('Shift not found'), { statusCode: 404 });
  const assignment = new PickerShiftAssignment({ userId: new mongoose.Types.ObjectId(userId), shiftId: shift._id, date: new Date(), warehouseKey: shift.warehouseKey, status: 'ASSIGNED' });
  await assignment.save();
  return assignment;
}

export async function startShift(userId: string, shiftId: string) {
  const assignment = await PickerShiftAssignment.findOne({ userId: new mongoose.Types.ObjectId(userId), shiftId: new mongoose.Types.ObjectId(shiftId), status: 'ASSIGNED' });
  if (!assignment) throw Object.assign(new Error('Shift assignment not found'), { statusCode: 404 });
  assignment.status = 'STARTED';
  assignment.startedAt = new Date();
  await assignment.save();
  await PickerUser.findByIdAndUpdate(userId, { onBreak: false });
  return assignment;
}

export async function endShift(userId: string, shiftId: string) {
  const assignment = await PickerShiftAssignment.findOne({ userId: new mongoose.Types.ObjectId(userId), shiftId: new mongoose.Types.ObjectId(shiftId), status: 'STARTED' });
  if (!assignment) throw Object.assign(new Error('Shift not started'), { statusCode: 404 });
  assignment.status = 'COMPLETED';
  assignment.completedAt = new Date();
  await assignment.save();
  return assignment;
}

export async function startBreak(userId: string) {
  const attendance = await PickerAttendance.findOne({ userId: new mongoose.Types.ObjectId(userId), punchOut: null, status: 'ON_DUTY' });
  if (!attendance) throw Object.assign(new Error('No active shift found'), { statusCode: 404 });
  attendance.breaks.push({ startTime: new Date() });
  attendance.status = 'ON_BREAK';
  await attendance.save();
  await PickerUser.findByIdAndUpdate(userId, { onBreak: true });
  return attendance;
}

export async function endBreak(userId: string) {
  const attendance = await PickerAttendance.findOne({ userId: new mongoose.Types.ObjectId(userId), punchOut: null, status: 'ON_BREAK' });
  if (!attendance) throw Object.assign(new Error('No active break found'), { statusCode: 404 });
  const lastBreak = attendance.breaks[attendance.breaks.length - 1];
  if (lastBreak && !lastBreak.endTime) lastBreak.endTime = new Date();
  attendance.status = 'ON_DUTY';
  await attendance.save();
  await PickerUser.findByIdAndUpdate(userId, { onBreak: false });
  return attendance;
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export async function punchIn(userId: string, location?: Record<string, unknown>, shiftId?: string) {
  const existing = await PickerAttendance.findOne({ userId: new mongoose.Types.ObjectId(userId), punchOut: null });
  if (existing) throw Object.assign(new Error('Already punched in'), { statusCode: 400 });
  let lateByMinutes = 0;
  let warehouseKey: string | undefined;
  if (shiftId && mongoose.isValidObjectId(shiftId)) {
    const shift = await PickerShift.findById(shiftId).select('startTime warehouseKey').lean() as { startTime?: string; warehouseKey?: string } | null;
    warehouseKey = shift?.warehouseKey;
    if (shift?.startTime) {
      const match = /^(\d{1,2}):(\d{2})/.exec(shift.startTime);
      if (match) {
        const startMin = Number(match[1]) * 60 + Number(match[2]);
        const now = new Date(Date.now() + 330 * 60000);
        const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
        lateByMinutes = Math.max(0, nowMin - startMin);
      }
    }
  }
  const attendance = new PickerAttendance({
    userId: new mongoose.Types.ObjectId(userId),
    punchIn: new Date(),
    locationIn: location,
    shiftId,
    warehouseKey,
    status: 'ON_DUTY',
    lateByMinutes,
  });
  await attendance.save();
  return attendance;
}

export async function punchOut(userId: string, location?: Record<string, unknown>) {
  const attendance = await PickerAttendance.findOne({ userId: new mongoose.Types.ObjectId(userId), punchOut: null });
  if (!attendance) throw Object.assign(new Error('Not punched in'), { statusCode: 400 });
  attendance.punchOut = new Date();
  attendance.locationOut = location;

  const {
    resolveSalaryConfig,
    computeShiftBreakdown,
    hubYearMonth,
    isWeekOffDateKey,
  } = await import('./picker.salary');
  const { hubDateKey } = await import('./picker.format');

  const cfg = await resolveSalaryConfig();
  const punchIn = new Date(attendance.punchIn);
  const { year, monthIndex0 } = hubYearMonth(punchIn);
  const weekOff = isWeekOffDateKey(hubDateKey(punchIn), cfg, year, monthIndex0);
  const breakdown = computeShiftBreakdown({
    punchIn,
    punchOut: attendance.punchOut,
    breaks: attendance.breaks as Array<{ startTime: Date; endTime?: Date }>,
    cfg,
    isWeekOffDay: weekOff,
  });

  attendance.totalShiftMinutes = breakdown.totalShiftMinutes;
  attendance.startHandoverMinutes = breakdown.startHandoverMinutes;
  attendance.endHandoverMinutes = breakdown.endHandoverMinutes;
  attendance.breakMinutes = breakdown.breakMinutes;
  attendance.productiveWorkMinutes = breakdown.productiveWorkMinutes;
  attendance.actualWorkStartTime = breakdown.actualWorkStartTime;
  attendance.actualWorkEndTime = breakdown.actualWorkEndTime || undefined;
  attendance.isWeekOffWork = breakdown.isWeekOffWork;
  attendance.totalWorkedMinutes = breakdown.productiveWorkMinutes;
  attendance.overtimeMinutes = breakdown.overtimeMinutes;
  attendance.overtimeHours = Math.round((breakdown.overtimeMinutes / 60) * 10) / 10;
  const regularMins = Math.max(0, breakdown.totalShiftMinutes - breakdown.overtimeMinutes);
  attendance.regularHours = Math.round((regularMins / 60) * 10) / 10;
  attendance.status = breakdown.totalShiftMinutes < cfg.standardShiftMinutes * 0.5 ? 'half-day' : 'present';
  await attendance.save();
  return attendance;
}

export async function getAttendance(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [records, total] = await Promise.all([
    PickerAttendance.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ punchIn: -1 }).skip(skip).limit(limit).lean(),
    PickerAttendance.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
  ]);
  return { records, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export async function getWallet(userId: string) {
  let wallet = await PickerWallet.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
  if (!wallet) {
    const w = await PickerWallet.create({ userId: new mongoose.Types.ObjectId(userId) });
    wallet = w.toObject();
  }
  return wallet;
}

export async function getTransactions(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [transactions, total] = await Promise.all([
    PickerTransaction.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PickerTransaction.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
  ]);
  return { transactions, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function requestWithdrawal(userId: string, amount: number) {
  const wallet = await PickerWallet.findOne({ userId: new mongoose.Types.ObjectId(userId) });
  if (!wallet) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
  if (wallet.availableBalance < amount) throw Object.assign(new Error('Insufficient balance'), { statusCode: 400 });
  wallet.availableBalance -= amount;
  wallet.reservedBalance += amount;
  await wallet.save();
  const request = await PickerWithdrawalRequest.create({ userId: new mongoose.Types.ObjectId(userId), amount, status: 'PENDING' });
  return request;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function listDocuments(userId: string) {
  return PickerDocument.find({ userId: new mongoose.Types.ObjectId(userId) }).lean();
}

export async function uploadDocument(userId: string, type: string, url: string, fileName?: string) {
  return PickerDocument.create({ userId: new mongoose.Types.ObjectId(userId), type, url, fileName, status: 'pending' });
}

export async function reviewDocument(documentId: string, status: 'approved' | 'rejected', reviewedBy: string, rejectionReason?: string) {
  return PickerDocument.findByIdAndUpdate(documentId, { status, reviewedBy: new mongoose.Types.ObjectId(reviewedBy), reviewedAt: new Date(), rejectionReason }, { new: true });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getNotifications(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [notifications, total, unread] = await Promise.all([
    PickerNotification.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PickerNotification.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
    PickerNotification.countDocuments({ userId: new mongoose.Types.ObjectId(userId), read: false }),
  ]);
  return { notifications, total, unread, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  return PickerNotification.findOneAndUpdate({ _id: notificationId, userId: new mongoose.Types.ObjectId(userId) }, { read: true }, { new: true });
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await PickerNotification.updateMany(
    { userId: new mongoose.Types.ObjectId(userId), read: false },
    { read: true },
  );
  return result.modifiedCount || 0;
}

// ─── Bank Accounts ────────────────────────────────────────────────────────────

export async function listBankAccounts(userId: string) {
  return PickerBankAccount.find({ userId: new mongoose.Types.ObjectId(userId) }).lean();
}

export async function addBankAccount(userId: string, data: Record<string, unknown>) {
  return PickerBankAccount.create({ userId: new mongoose.Types.ObjectId(userId), ...data });
}

// ─── Payout method verification (admin) ───────────────────────────────────────

export type PayoutMethodStatus = 'pending' | 'verified' | 'rejected';

export interface PayoutVerificationItem {
  id: string;
  kind: 'bank' | 'upi';
  pickerId: string;
  pickerName: string | null;
  pickerPhone: string | null;
  status: PayoutMethodStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  /** Masked payout destination, safe to render in the dashboard. */
  label: string | null;
  fields: Array<{ label: string; value: string }>;
}

function bankStatusOf(account: { verificationStatus?: string; isVerified?: boolean }): PayoutMethodStatus {
  if (account.verificationStatus === 'verified' || account.verificationStatus === 'rejected') {
    return account.verificationStatus;
  }
  if (account.verificationStatus === 'pending') return 'pending';
  return account.isVerified ? 'verified' : 'pending';
}

function iso(value?: Date | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

/**
 * Unified queue of bank accounts and UPI IDs awaiting (or past) payout review.
 * Account numbers are never returned in full — only the masked label and IFSC.
 */
export async function listPayoutVerifications(
  filters: { status?: PayoutMethodStatus; search?: string; page?: number; limit?: number } = {},
) {
  const { status, search, page = 1, limit = 50 } = filters;

  const userQuery: Record<string, unknown> = {};
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    userQuery.$or = [{ name: rx }, { phone: rx }];
  }
  const users = await PickerUser.find(userQuery)
    .select('name phone upiId upiPayoutVerificationStatus upiPayoutRejectionReason upiPayoutSubmittedAt upiPayoutReviewedAt')
    .lean() as any[];
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const accounts = await PickerBankAccount.find({ userId: { $in: users.map((u) => u._id) } })
    .sort({ createdAt: -1 })
    .lean() as any[];

  const items: PayoutVerificationItem[] = [];

  for (const a of accounts) {
    const user = userById.get(String(a.userId));
    items.push({
      id: String(a._id),
      kind: 'bank',
      pickerId: String(a.userId),
      pickerName: user?.name || null,
      pickerPhone: user?.phone || null,
      status: bankStatusOf(a),
      submittedAt: iso(a.submittedAt || a.createdAt),
      reviewedAt: iso(a.reviewedAt),
      rejectionReason: a.rejectionReason || null,
      label: bankLabel(a.bankName, a.accountNumber),
      fields: [
        { label: 'Account holder', value: a.accountHolderName || '—' },
        { label: 'Bank', value: a.bankName || '—' },
        { label: 'Account number', value: maskAccountNumber(a.accountNumber) },
        { label: 'IFSC', value: a.ifscCode || '—' },
        { label: 'Primary', value: a.isPrimary ? 'Yes' : 'No' },
      ],
    });
  }

  for (const u of users) {
    if (!u.upiId || u.upiPayoutVerificationStatus === 'none') continue;
    items.push({
      id: String(u._id),
      kind: 'upi',
      pickerId: String(u._id),
      pickerName: u.name || null,
      pickerPhone: u.phone || null,
      status: (u.upiPayoutVerificationStatus || 'pending') as PayoutMethodStatus,
      submittedAt: iso(u.upiPayoutSubmittedAt),
      reviewedAt: iso(u.upiPayoutReviewedAt),
      rejectionReason: u.upiPayoutRejectionReason || null,
      label: u.upiId,
      fields: [{ label: 'UPI ID', value: u.upiId }],
    });
  }

  const filtered = status ? items.filter((i) => i.status === status) : items;
  filtered.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));

  const skip = (page - 1) * limit;
  return {
    items: filtered.slice(skip, skip + limit),
    total: filtered.length,
    pendingTotal: items.filter((i) => i.status === 'pending').length,
    page,
    limit,
  };
}

async function notifyPayoutDecision(
  userId: mongoose.Types.ObjectId,
  method: 'Bank account' | 'UPI',
  decision: PayoutMethodStatus,
  rejectionReason?: string,
): Promise<void> {
  const approved = decision === 'verified';
  await PickerNotification.create({
    userId,
    type: 'payout',
    title: approved ? `${method} verified` : `${method} verification failed`,
    body: approved
      ? `Your ${method.toLowerCase()} has been verified. Payouts will be sent here.`
      : rejectionReason
        ? `${method} rejected: ${rejectionReason}`
        : `${method} was rejected. Please update your details and submit again.`,
    data: { method, decision },
    read: false,
  });
}

export async function reviewBankAccount(
  pickerId: string,
  accountId: string,
  decision: PayoutMethodStatus,
  reviewedBy: string,
  rejectionReason?: string,
) {
  if (decision === 'rejected' && !String(rejectionReason || '').trim()) {
    throw Object.assign(new Error('A rejection reason is required'), { statusCode: 400 });
  }
  const account = await PickerBankAccount.findOneAndUpdate(
    { _id: accountId, userId: new mongoose.Types.ObjectId(pickerId) },
    {
      $set: {
        verificationStatus: decision,
        isVerified: decision === 'verified',
        rejectionReason: decision === 'rejected' ? String(rejectionReason).trim() : '',
        reviewedAt: new Date(),
        reviewedBy: mongoose.isValidObjectId(reviewedBy) ? new mongoose.Types.ObjectId(reviewedBy) : null,
      },
    },
    { new: true },
  );
  if (!account) return null;
  await notifyPayoutDecision(account.userId, 'Bank account', decision, rejectionReason);
  return {
    id: String(account._id),
    pickerId,
    status: account.verificationStatus,
    label: bankLabel(account.bankName, account.accountNumber),
    rejectionReason: account.rejectionReason || null,
    reviewedAt: iso(account.reviewedAt),
  };
}

export async function reviewUpiPayout(
  pickerId: string,
  decision: PayoutMethodStatus,
  reviewedBy: string,
  rejectionReason?: string,
) {
  if (decision === 'rejected' && !String(rejectionReason || '').trim()) {
    throw Object.assign(new Error('A rejection reason is required'), { statusCode: 400 });
  }
  const user = await PickerUser.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(pickerId), upiId: { $nin: [null, ''] } },
    {
      $set: {
        upiPayoutVerificationStatus: decision,
        upiPayoutRejectionReason: decision === 'rejected' ? String(rejectionReason).trim() : '',
        upiPayoutReviewedAt: new Date(),
        upiPayoutReviewedBy: mongoose.isValidObjectId(reviewedBy) ? new mongoose.Types.ObjectId(reviewedBy) : null,
      },
    },
    { new: true },
  );
  if (!user) return null;
  await notifyPayoutDecision(user._id as mongoose.Types.ObjectId, 'UPI', decision, rejectionReason);
  return {
    id: pickerId,
    pickerId,
    status: user.upiPayoutVerificationStatus,
    label: user.upiId || null,
    rejectionReason: user.upiPayoutRejectionReason || null,
    reviewedAt: iso(user.upiPayoutReviewedAt),
  };
}

// ─── Work Locations ───────────────────────────────────────────────────────────

export async function listWorkLocations(type?: string) {
  const query: Record<string, unknown> = { isActive: true };
  if (type) query.type = type;
  return PickerWorkLocation.find(query).lean();
}

// ─── Training Videos ──────────────────────────────────────────────────────────

export async function listTrainingVideos(warehouseKey?: string) {
  const query: Record<string, unknown> = { isActive: true };
  if (warehouseKey) query.warehouseKey = warehouseKey;
  return PickerTrainingVideo.find(query).sort({ order: 1 }).lean();
}

export async function updateTrainingProgress(userId: string, videoId: string, progress: number) {
  const user = await PickerUser.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  const tp = (user.trainingProgress || {}) as Record<string, number>;
  tp[videoId] = Math.min(100, Math.max(0, progress));
  user.trainingProgress = tp;
  const allVideos = await PickerTrainingVideo.find({ isActive: true }).lean() as Array<{ videoId: string }>;
  const allComplete = allVideos.every((v) => (tp[v.videoId] || 0) >= 100);
  if (allComplete && !user.trainingCompleted) { user.trainingCompleted = true; user.trainingCompletedAt = new Date(); }
  await user.save();
  const completedSteps = Array.from(new Set([...(user.onboarding?.completedSteps || []), 5]));
  await PickerUser.updateOne({ _id: user._id }, {
    $set: { 'onboarding.completedSteps': completedSteps, 'onboarding.currentStep': Math.max(user.onboarding?.currentStep || 1, 6) },
  });
  return { trainingProgress: tp, trainingCompleted: user.trainingCompleted };
}

// ─── Admin Operations ─────────────────────────────────────────────────────────

export async function listPickers(filters: { status?: string; search?: string; warehouseKey?: string; page?: number; limit?: number } = {}) {
  const { status, search, warehouseKey, page = 1, limit = 50 } = filters;
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (warehouseKey) query.currentLocationId = warehouseKey;
  if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }];
  const skip = (page - 1) * limit;
  const [pickers, total] = await Promise.all([PickerUser.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), PickerUser.countDocuments(query)]);
  return { pickers, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function approvePicker(pickerId: string, approvedBy: string) {
  return PickerUser.findByIdAndUpdate(pickerId, { status: 'ACTIVE', approvedAt: new Date(), approvedBy: new mongoose.Types.ObjectId(approvedBy) }, { new: true });
}

export async function rejectPicker(pickerId: string, reason: string) {
  return PickerUser.findByIdAndUpdate(pickerId, { status: 'REJECTED', rejectedReason: reason, rejectedAt: new Date() }, { new: true });
}

export async function listWithdrawalRequests(filters: { status?: string; page?: number; limit?: number } = {}) {
  const { status, page = 1, limit = 20 } = filters;
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  const skip = (page - 1) * limit;
  const [requests, total] = await Promise.all([PickerWithdrawalRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userId', 'name phone').lean(), PickerWithdrawalRequest.countDocuments(query)]);
  return { requests, total, page, limit };
}

export async function processWithdrawal(requestId: string, action: 'APPROVED' | 'REJECTED' | 'PAID', processedBy: string, rejectionReason?: string) {
  const request = await PickerWithdrawalRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Withdrawal request not found'), { statusCode: 404 });
  request.status = action;
  if (action === 'APPROVED') request.approvedBy = new mongoose.Types.ObjectId(processedBy);
  if (action === 'REJECTED') {
    request.rejectionReason = rejectionReason;
    const wallet = await PickerWallet.findOne({ userId: request.userId });
    if (wallet) { wallet.availableBalance += request.amount; wallet.reservedBalance -= request.amount; await wallet.save(); }
  }
  if (action === 'PAID') request.paidAt = new Date();
  await request.save();
  return request;
}

export async function getLiveAttendance(warehouseKey?: string) {
  const query: Record<string, unknown> = { punchOut: null, status: { $in: ['ON_DUTY', 'ON_BREAK'] } };
  if (warehouseKey) query.warehouseKey = warehouseKey;
  return PickerAttendance.find(query).populate('userId', 'name phone').lean();
}

export async function listPickerDevices(filters: { status?: string; warehouseKey?: string } = {}) {
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;
  if (filters.warehouseKey) query.warehouseKey = filters.warehouseKey;
  return PickerDevice.find(query).populate('assignedTo', 'name phone').lean();
}

export async function assignDevice(deviceId: string, userId: string) {
  await PickerDevice.findOneAndUpdate(
    { deviceId },
    { assignedTo: new mongoose.Types.ObjectId(userId), status: 'assigned', assignedAt: new Date() },
  );
  await PickerUser.findByIdAndUpdate(userId, { activeDeviceId: deviceId });
  return PickerDevice.findOne({ deviceId }).lean();
}

export async function unassignDevice(deviceId: string) {
  const device = await PickerDevice.findOne({ deviceId });
  if (!device) throw Object.assign(new Error('Device not found'), { statusCode: 404 });
  if (device.assignedTo) await PickerUser.findByIdAndUpdate(device.assignedTo, { $unset: { activeDeviceId: '' } });
  device.assignedTo = undefined;
  device.status = 'available';
  await device.save();
  return device;
}

export async function logAction(userId: string, action: string, details?: Record<string, unknown>, entityType?: string, entityId?: string) {
  return PickerActionLog.create({ userId: new mongoose.Types.ObjectId(userId), action, details, entityType, entityId });
}

export async function getPickerById(pickerId: string) {
  return PickerUser.findById(pickerId).lean();
}

export async function updatePickerStatus(pickerId: string, status: string, updatedBy: string) {
  return PickerUser.findByIdAndUpdate(pickerId, { status, updatedBy }, { new: true }).lean();
}

export async function getPerformance(userId: string, startDate?: Date, endDate?: Date) {
  const query: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(userId) };
  if (startDate || endDate) {
    const range: Record<string, Date> = {};
    if (startDate) range.$gte = startDate;
    if (endDate) range.$lte = endDate;
    query.punchIn = range;
  }
  const attendance = await PickerAttendance.find(query).lean() as Array<{ totalWorkedMinutes?: number; ordersCompleted?: number; overtimeMinutes?: number; lateByMinutes?: number; status?: string }>;
  const totalShifts = attendance.length;
  const present = attendance.filter((a) => ['ON_DUTY', 'COMPLETED', 'present'].includes(a.status || '')).length;
  const totalWorked = attendance.reduce((s, a) => s + (a.totalWorkedMinutes || 0), 0);
  const totalOrders = attendance.reduce((s, a) => s + (a.ordersCompleted || 0), 0);
  return { totalShifts, present, absent: totalShifts - present, totalWorkedMinutes: totalWorked, totalOrdersCompleted: totalOrders, averageOrdersPerShift: totalShifts > 0 ? Math.round(totalOrders / totalShifts) : 0 };
}

// ─── Wallet: Extra ────────────────────────────────────────────────────────────

export async function getWalletBalance(userId: string) {
  const wallet = await PickerWallet.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean() as any;
  if (!wallet) return { balance: 0, availableBalance: 0, pendingBalance: 0, reservedBalance: 0, currency: 'INR' };
  return { balance: wallet.availableBalance, availableBalance: wallet.availableBalance, pendingBalance: wallet.pendingBalance, reservedBalance: wallet.reservedBalance, currency: wallet.currency };
}

export async function getEarningsBreakdown(userId: string) {
  const uid = new mongoose.Types.ObjectId(userId);
  const [wallet, transactions] = await Promise.all([
    PickerWallet.findOne({ userId: uid }).lean() as Promise<any>,
    PickerTransaction.find({ userId: uid, type: 'credit' }).sort({ createdAt: -1 }).limit(100).lean() as Promise<Array<any>>,
  ]);
  const total = (transactions as Array<any>).reduce((s: number, t: any) => s + t.amount, 0);
  const byType: Record<string, number> = {};
  for (const t of (transactions as Array<any>)) {
    const key = t.description || 'earnings';
    byType[key] = (byType[key] || 0) + t.amount;
  }
  const breakdown = Object.entries(byType).map(([label, amount]) => ({ label, amount }));
  return { total: `₹${total.toLocaleString('en-IN')}`, totalRaw: total, orders: (transactions as Array<any>).length, availableBalance: (wallet as any)?.availableBalance ?? 0, breakdown };
}

export async function getWalletHistory(userId: string, page = 1, limit = 20) {
  return getTransactions(userId, page, limit);
}

export async function getTransactionById(transactionId: string) {
  return PickerTransaction.findById(transactionId).lean();
}

export async function getWithdrawalRequestById(requestId: string) {
  return PickerWithdrawalRequest.findById(requestId).lean();
}

// Cash-deposit + duplicate markAllNotificationsRead removed — cash handling
// moved to picker.cash.service.ts (recordDeposit), and the notifications
// helper is already defined above with the correct signature.

// ─── Bank Accounts: Extra ─────────────────────────────────────────────────────

export async function updateBankAccount(accountId: string, data: Record<string, unknown>) {
  const allowed = ['accountHolderName', 'accountNumber', 'ifscCode', 'bankName', 'branchName'];
  const safe = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
  return PickerBankAccount.findByIdAndUpdate(accountId, safe, { new: true }).lean();
}

export async function setBankAccountDefault(userId: string, accountId: string) {
  await PickerBankAccount.updateMany({ userId: new mongoose.Types.ObjectId(userId) }, { isPrimary: false });
  return PickerBankAccount.findByIdAndUpdate(accountId, { isPrimary: true }, { new: true }).lean();
}

export async function deleteBankAccount(accountId: string) {
  return PickerBankAccount.findByIdAndDelete(accountId).lean();
}

// ─── Attendance: Summary ──────────────────────────────────────────────────────

export async function getAttendanceSummary(userId: string) {
  const uid = new mongoose.Types.ObjectId(userId);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const records = await PickerAttendance.find({ userId: uid, punchIn: { $gte: startOfMonth } }).lean() as Array<{ status?: string; lateByMinutes?: number; totalWorkedMinutes?: number }>;
  const present = records.filter((r) => ['ON_DUTY', 'COMPLETED', 'present'].includes(r.status || '')).length;
  const late = records.filter((r) => (r.lateByMinutes || 0) > 0).length;
  const totalWorkedMinutes = records.reduce((s, r) => s + (r.totalWorkedMinutes || 0), 0);
  return { present, absent: 0, late, totalWorkedMinutes, month: now.getMonth() + 1, year: now.getFullYear() };
}

export async function getAttendanceStats(userId: string) {
  const uid = new mongoose.Types.ObjectId(userId);
  const records = await PickerAttendance.find({ userId: uid }).sort({ punchIn: -1 }).limit(30).lean() as Array<{ totalWorkedMinutes?: number; ordersCompleted?: number; status?: string; punchIn?: Date }>;
  const totalMinutes = records.reduce((s, r) => s + (r.totalWorkedMinutes || 0), 0);
  const totalOrders = records.reduce((s, r) => s + (r.ordersCompleted || 0), 0);
  return { totalShifts: records.length, totalWorkedMinutes: totalMinutes, totalOrders, avgMinutesPerShift: records.length > 0 ? Math.round(totalMinutes / records.length) : 0 };
}

// ─── Location ─────────────────────────────────────────────────────────────────

export async function getCurrentLocation(userId: string) {
  const user = await PickerUser.findById(userId).select('gpsLocation currentLocationId').lean() as any;
  return { location: user?.gpsLocation ?? null, locationId: user?.currentLocationId ?? null };
}

export async function updateUserLocation(userId: string, latitude: number, longitude: number) {
  const result = await PickerUser.findByIdAndUpdate(userId, { gpsLocation: { latitude, longitude, timestamp: new Date() }, lastSeenAt: new Date() }, { new: true }).select('gpsLocation').lean();
  await storeRiderPosition(userId, latitude, longitude);
  emitRiderLocation(userId, latitude, longitude);
  return result;
}

export async function setUserLocation(userId: string, locationId: string) {
  return PickerUser.findByIdAndUpdate(userId, { currentLocationId: locationId, lastSeenAt: new Date() }, { new: true }).select('currentLocationId').lean();
}

// ─── Presence / Heartbeat ─────────────────────────────────────────────────────

export async function updateLastSeen(userId: string, batteryLevel?: number, location?: { latitude: number; longitude: number }) {
  const update: Record<string, unknown> = { lastSeenAt: new Date() };
  if (batteryLevel != null) update.batteryLevel = batteryLevel;
  if (location) update.gpsLocation = { ...location, timestamp: new Date() };
  const result = await PickerUser.findByIdAndUpdate(userId, update).lean();
  // Mirror the live position to Redis with a short TTL so admin/customer live
  // maps can query without hitting Mongo, and push it to subscribed admins.
  if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
    await storeRiderPosition(userId, location.latitude, location.longitude);
    emitRiderLocation(userId, location.latitude, location.longitude);
  }
  return result;
}

// ─── Push Token ───────────────────────────────────────────────────────────────

export async function savePushToken(userId: string, token: string, platform?: 'fcm' | 'apns') {
  return PickerUser.findByIdAndUpdate(userId, { pushToken: token, pushTokenPlatform: platform || 'fcm', lastSeenAt: new Date() }, { new: true }).select('pushToken pushTokenPlatform').lean();
}

// ─── Account ──────────────────────────────────────────────────────────────────

export async function requestAccountDeletion(userId: string, reason?: string) {
  return PickerUser.findByIdAndUpdate(userId, { deletionRequestedAt: new Date(), deletionReason: reason || '' }, { new: true }).lean();
}

// ─── Profile: Contract / Employment / Overview ────────────────────────────────

export async function getUserContract(userId: string) {
  const user = await PickerUser.findById(userId).select('contractInfo').lean() as any;
  return user?.contractInfo ?? null;
}

export async function updateUserContract(userId: string, data: Record<string, unknown>) {
  const allowed = ['legalName', 'contractStartDate', 'documentId'];
  const safe = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
  const update = Object.fromEntries(Object.entries(safe).map(([k, v]) => [`contractInfo.${k}`, v]));
  return PickerUser.findByIdAndUpdate(userId, update, { new: true }).select('contractInfo').lean();
}

export async function getEmployment(userId: string) {
  const user = await PickerUser.findById(userId).select('employment').lean() as any;
  return user?.employment ?? null;
}

export async function updateEmployment(userId: string, data: Record<string, unknown>) {
  const allowed = ['joiningDate', 'role', 'shiftType', 'employerName', 'employeeId', 'department'];
  const safe = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
  const update = Object.fromEntries(Object.entries(safe).map(([k, v]) => [`employment.${k}`, v]));
  return PickerUser.findByIdAndUpdate(userId, update, { new: true }).select('employment').lean();
}

export async function setLocationType(userId: string, locationType: string) {
  return PickerUser.findByIdAndUpdate(userId, { locationType }, { new: true }).select('locationType').lean();
}

export async function setUpi(userId: string, upiId: string, upiName?: string) {
  const update: Record<string, unknown> = { upiId, upiPayoutVerificationStatus: 'pending' };
  if (upiName) update.upiName = upiName;
  return PickerUser.findByIdAndUpdate(userId, update, { new: true }).select('upiId upiName upiPayoutVerificationStatus').lean();
}

export async function getProfileOverview(userId: string) {
  const uid = new mongoose.Types.ObjectId(userId);
  const [user, wallet, attendanceCount, txCount] = await Promise.all([
    PickerUser.findById(userId).lean() as any,
    PickerWallet.findOne({ userId: uid }).lean() as Promise<any>,
    PickerAttendance.countDocuments({ userId: uid }),
    PickerTransaction.countDocuments({ userId: uid }),
  ]);
  return {
    name: user?.name, phone: user?.phone, status: user?.status,
    availableBalance: (wallet as any)?.availableBalance ?? 0,
    totalShifts: attendanceCount, totalTransactions: txCount,
    trainingCompleted: user?.trainingCompleted ?? false,
    faceVerificationStatus: user?.faceVerificationStatus,
  };
}

export async function getLinkStatus(userId: string) {
  const user = await PickerUser.findById(userId).select('hhdUserId activeDeviceId').lean() as any;
  return { linked: !!(user?.hhdUserId || user?.activeDeviceId), hhdUserId: user?.hhdUserId ?? null, deviceId: user?.activeDeviceId ?? null };
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export async function getOnboardingState(userId: string) {
  const user = await PickerUser.findById(userId).lean() as any;
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  const steps = [
    { id: 'profile', label: 'Profile', done: !!(user.name && user.email) },
    { id: 'documents', label: 'Documents', done: false },
    { id: 'training', label: 'Training', done: user.trainingCompleted === true },
    { id: 'face_verification', label: 'Face Verification', done: ['verified', 'overridden_approved'].includes(user.faceVerificationStatus) },
    { id: 'bank', label: 'Bank Account', done: false },
  ];
  const completedSteps = steps.filter((s) => s.done).length;
  const stateLabel = completedSteps === steps.length ? 'complete' : completedSteps === 0 ? 'pending' : 'in_progress';
  return { state: stateLabel, completedSteps, totalSteps: steps.length, steps };
}

// ─── Training: Extra ──────────────────────────────────────────────────────────

export async function getTrainingVideoById(videoId: string) {
  return PickerTrainingVideo.findOne({ videoId }).lean();
}

export async function getTrainingUserProgress(userId: string) {
  const user = await PickerUser.findById(userId).select('trainingProgress trainingCompleted trainingCompletedAt').lean() as any;
  return { progress: user?.trainingProgress ?? {}, completed: user?.trainingCompleted ?? false, completedAt: user?.trainingCompletedAt ?? null };
}

export async function getTrainingProgress(userId: string) {
  const [user, allVideos] = await Promise.all([
    PickerUser.findById(userId).select('trainingProgress trainingCompleted').lean() as any,
    PickerTrainingVideo.find({ isActive: true }).select('videoId').lean() as unknown as Array<{ videoId: string }>,
  ]);
  if (!allVideos.length) return { percentage: 0, completed: user?.trainingCompleted ?? false };
  const progress = (user?.trainingProgress ?? {}) as Record<string, number>;
  const total = allVideos.reduce((s, v) => s + (progress[v.videoId] || 0), 0);
  const percentage = Math.round(total / allVideos.length);
  return { percentage, completed: user?.trainingCompleted ?? false };
}

export async function completeTrainingVideo(userId: string, videoId: string) {
  return updateTrainingProgress(userId, videoId, 100);
}

// ─── Shift Readiness ──────────────────────────────────────────────────────────

export async function getShiftReadiness(userId: string) {
  const user = await PickerUser.findById(userId).lean() as any;
  const checks = [
    { id: 'training', label: 'Training complete', passed: user?.trainingCompleted === true },
    { id: 'face', label: 'Face verified', passed: ['verified', 'overridden_approved'].includes(user?.faceVerificationStatus) },
    { id: 'docs', label: 'Documents approved', passed: false },
  ];
  const ready = checks.every((c) => c.passed);
  return { ready, checks };
}

// ─── Device ───────────────────────────────────────────────────────────────────

export async function getAssignedDevice(userId: string) {
  return PickerDevice.findOne({ assignedTo: new mongoose.Types.ObjectId(userId), status: 'assigned' }).lean();
}

// ─── Performance: Extra ───────────────────────────────────────────────────────

export async function getPerformanceSummary(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return getPerformance(userId, startOfMonth, now);
}

export async function getPerformanceHistory(userId: string, months = 3) {
  const history = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const perf = await getPerformance(userId, start, end);
    history.push({ month: start.getMonth() + 1, year: start.getFullYear(), ...perf });
  }
  return history;
}

// Support-ticket helpers removed — the model was retired from picker.models.ts
// in the split refactor. Consumers should hit picker.support.service.ts.

// ─── Shared Orders (Rider ↔ CustomerOrder bridge) ────────────────────────────

const ACTIVE_RIDER_STATUSES = ['confirmed', 'getting-packed', 'on-the-way', 'arrived'];
const COMPLETED_RIDER_STATUSES = ['delivered'];

export async function getAssignedOrders(pickerId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find({ riderId: pickerId, status: { $in: ACTIVE_RIDER_STATUSES } })
      .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments({ riderId: pickerId, status: { $in: ACTIVE_RIDER_STATUSES } }),
  ]);
  return { orders, total, page, limit };
}

export async function getCompletedAssignedOrders(pickerId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find({ riderId: pickerId, status: { $in: COMPLETED_RIDER_STATUSES } })
      .sort({ deliveredAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments({ riderId: pickerId, status: { $in: COMPLETED_RIDER_STATUSES } }),
  ]);
  return { orders, total, page, limit };
}

export async function getAssignedOrderById(pickerId: string, orderId: string) {
  return Order.findOne({ _id: new mongoose.Types.ObjectId(orderId), riderId: pickerId }).lean();
}

const RIDER_STATUS_MAP: Record<string, string> = {
  accepted: 'getting-packed',
  picked_up: 'on-the-way',
  arrived: 'arrived',
  cancelled: 'cancelled',
};

export async function updateRiderOrderStatus(
  pickerId: string,
  orderId: string,
  riderStatus: string,
  opts?: { reason?: string; note?: string },
) {
  const order = await Order.findOne({ _id: new mongoose.Types.ObjectId(orderId), riderId: pickerId });
  if (!order) throw Object.assign(new Error('Order not found or not assigned to you'), { statusCode: 404 });

  const newStatus = RIDER_STATUS_MAP[riderStatus];
  if (!newStatus) throw Object.assign(new Error(`Unknown rider status: ${riderStatus}`), { statusCode: 400 });

  order.status = newStatus as any;
  order.timeline.push({
    status: newStatus,
    timestamp: new Date(),
    note: opts?.note || '',
    actor: `rider:${pickerId}`,
  } as any);

  if (newStatus === 'cancelled') {
    order.cancellationReason = opts?.reason || opts?.note || 'Cancelled by rider';
  }

  await order.save();
  emitOrderStatus(String(order._id), { status: newStatus, orderNumber: order.orderNumber, note: opts?.note || '', actor: `rider:${pickerId}` });
  return order.toObject();
}

export async function completeRiderOrder(
  pickerId: string,
  orderId: string,
  otp: string,
  photo?: string,
) {
  const order = await Order.findOne({ _id: new mongoose.Types.ObjectId(orderId), riderId: pickerId });
  if (!order) throw Object.assign(new Error('Order not found or not assigned to you'), { statusCode: 404 });

  if (order.status === 'delivered') {
    throw Object.assign(new Error('Order already delivered'), { statusCode: 409 });
  }

  if (order.deliveryOtp) {
    if (order.otpAttempts >= 5) {
      throw Object.assign(new Error('Too many OTP attempts'), { statusCode: 429 });
    }
    if (order.deliveryOtp !== String(otp)) {
      order.otpAttempts = (order.otpAttempts || 0) + 1;
      await order.save();
      throw Object.assign(new Error('Invalid delivery OTP'), { statusCode: 400 });
    }
    order.otpVerified = true;
  }

  order.status = 'delivered';
  order.deliveredAt = new Date();
  order.timeline.push({
    status: 'delivered',
    timestamp: new Date(),
    note: photo ? `Proof photo: ${photo}` : '',
    actor: `rider:${pickerId}`,
  } as any);

  await order.save();

  const deliveryEarning = 25;
  await creditRiderWallet(pickerId, deliveryEarning, `Delivery earnings — Order #${order.orderNumber}`, String(order._id));

  emitOrderStatus(String(order._id), { status: 'delivered', orderNumber: order.orderNumber, actor: `rider:${pickerId}` });
  return order.toObject();
}

async function creditRiderWallet(pickerId: string, amount: number, description: string, referenceId: string) {
  const pickOid = new mongoose.Types.ObjectId(pickerId);
  await PickerWallet.findOneAndUpdate(
    { userId: pickOid },
    { $inc: { availableBalance: amount, totalEarnings: amount } },
    { upsert: true, new: true },
  );
  await PickerTransaction.create({
    userId: pickOid,
    type: 'credit',
    amount,
    description,
    referenceId,
    status: 'completed',
    currency: 'INR',
  });
}
