import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import * as ordersService from './orders.service';
import { Order } from './order.model';
import type { CreateOrderInput, RateOrderInput, VerifyOrderOtpInput, UpdateOrderStatusInput } from './order.validation';
import {
  persistCustomerOrderIdempotency,
  readCustomerIdempotencyKey,
  replayCustomerOrderIdempotency,
} from './order.idempotency';

function requireCustomerId(req: Request): string {
  if (!req.customer?._id) throw AppError.unauthorized();
  return req.customer._id;
}

/** TS can't narrow `Record<string, unknown> | { error: string }` via `'error' in x` alone. */
function errorOf(x: unknown): string | null {
  return x && typeof x === 'object' && 'error' in x ? String((x as { error: unknown }).error) : null;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const page = parseInt(String(req.query.page || ''), 10) || 1;
    const limit = Math.min(parseInt(String(req.query.limit || ''), 10) || 20, 100);
    const status = (req.query.status as string) || undefined;
    const result = await ordersService.listOrders(userId, page, limit, status);
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const order = await ordersService.getOrderById(userId, req.params.id);
    if (!order) throw AppError.notFound('Order');
    res.status(200).json(ResponseFormatter.success(order));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const idempotencyKey = readCustomerIdempotencyKey(req);
    if (idempotencyKey) {
      const replay = await replayCustomerOrderIdempotency(userId, idempotencyKey);
      if (replay) {
        res.status(replay.statusCode).json(ResponseFormatter.success(replay.body));
        return;
      }
    }

    const order = await ordersService.createOrder(userId, req.body as CreateOrderInput);
    const err = errorOf(order);
    if (err) {
      res.status(400).json(ResponseFormatter.error(err, 400));
      return;
    }
    if (idempotencyKey) {
      await persistCustomerOrderIdempotency(userId, idempotencyKey, order, 201);
    }
    res.status(201).json(ResponseFormatter.success(order));
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const order = await ordersService.cancelOrder(userId, req.params.id, req.body?.reason);
    if (!order) throw AppError.notFound('Order');
    const err = errorOf(order);
    if (err) {
      res.status(400).json(ResponseFormatter.error(err, 400));
      return;
    }
    res.status(200).json(ResponseFormatter.success(order));
  } catch (err) {
    next(err);
  }
}

export async function status(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const order = await ordersService.getOrderById(userId, req.params.id);
    if (!order) throw AppError.notFound('Order');
    res.status(200).json(ResponseFormatter.success({ status: order.status, ...order }));
  } catch (err) {
    next(err);
  }
}

export async function rate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const { rating, comment } = req.body as RateOrderInput;
    const order = await Order.findOneAndUpdate({ _id: req.params.id, userId }, { ratingScore: rating, ratingComment: comment || '' }, { new: true });
    if (!order) throw AppError.notFound('Order');
    res.status(200).json(ResponseFormatter.success({ message: 'Rating recorded', rating: order.ratingScore }));
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const { otp } = req.body as VerifyOrderOtpInput;
    const order = await Order.findOne({ _id: req.params.id, userId });
    if (!order) throw AppError.notFound('Order');

    if (order.otpVerified) {
      res.status(200).json(ResponseFormatter.success({ verified: true, message: 'OTP already verified' }));
      return;
    }

    order.otpAttempts = (order.otpAttempts || 0) + 1;
    if (order.otpAttempts > 5) {
      await order.save();
      res.status(429).json(ResponseFormatter.error('Too many OTP attempts', 429));
      return;
    }

    if (order.deliveryOtp === otp) {
      order.otpVerified = true;
      order.timeline.push({ status: order.status, timestamp: new Date(), note: 'Customer confirmed the delivery OTP', actor: 'customer' });
      await order.save();
      res.status(200).json(ResponseFormatter.success({ verified: true, message: 'OTP verified. The rider confirms delivery.' }));
    } else {
      await order.save();
      res.status(400).json(ResponseFormatter.error('Invalid OTP', 400, { attemptsRemaining: 5 - order.otpAttempts }));
    }
  } catch (err) {
    next(err);
  }
}

export async function canCancel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const result = await ordersService.canCustomerCancel(userId, req.params.id);
    // Expose both `allowed` (cancellation service) and `canCancel` (customer app contract).
    res.status(200).json(
      ResponseFormatter.success({
        ...result,
        canCancel: result.allowed,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function active(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const order = await ordersService.getActiveOrder(userId);
    res.status(200).json(ResponseFormatter.success(order || null));
  } catch (err) {
    next(err);
  }
}

export async function tracking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const order = await ordersService.getOrderTracking(userId, req.params.id);
    if (!order) throw AppError.notFound('Order');
    res.status(200).json(ResponseFormatter.success(order));
  } catch (err) {
    next(err);
  }
}

/** Dashboard/rider status transition — admin-authenticated, not customer-authenticated (matches legacy `authenticateToken` on this route). */
export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status: newStatus, actor, note, riderId } = req.body as UpdateOrderStatusInput;
    if (!newStatus) {
      res.status(400).json(ResponseFormatter.error('status is required', 400));
      return;
    }
    const result = await ordersService.updateCustomerOrderStatus(req.params.id, newStatus, { actor, note, riderId });
    const statusErr = errorOf(result);
    if (statusErr) {
      res.status(400).json(ResponseFormatter.error(statusErr, 400));
      return;
    }
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function reorder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const result = await ordersService.reorderItems(userId, req.params.id);
    const reorderErr = errorOf(result);
    if (reorderErr) {
      res.status(400).json(ResponseFormatter.error(reorderErr, 400));
      return;
    }
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

// ─── Admin (dashboard) endpoints ──────────────────────────────────────────────

export async function adminList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(String(req.query.page || ''), 10) || 1;
    const limit = Math.min(parseInt(String(req.query.limit || ''), 10) || 20, 200);
    const status = (req.query.status as string) || undefined;
    const storeId = (req.query.storeId as string) || undefined;
    const riderId = (req.query.riderId as string) || undefined;
    const search = (req.query.search as string) || undefined;
    const date = (req.query.date as string) || undefined;
    const result = await ordersService.adminListOrders(page, limit, { status, storeId, riderId, search, date });
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function adminGetDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await ordersService.adminGetOrderById(req.params.id);
    if (!order) throw AppError.notFound('Order');
    res.status(200).json(ResponseFormatter.success(order));
  } catch (err) {
    next(err);
  }
}

export async function adminGetLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const logs = await ordersService.adminGetOrderLogs(req.params.id);
    if (!logs) throw AppError.notFound('Order');
    res.status(200).json(ResponseFormatter.success({ data: logs }));
  } catch (err) {
    next(err);
  }
}

function actorFrom(req: Request): string {
  const u = (req as { user?: { email?: string; name?: string; id?: string } }).user;
  return u?.email || u?.name || u?.id || 'admin';
}

export async function adminAddNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { note, visibility } = req.body as { note?: string; visibility?: string };
    const result = await ordersService.adminAddOrderNote(req.params.id, {
      note: note || '',
      visibility,
      actor: actorFrom(req),
    });
    const err = errorOf(result);
    if (err) {
      res.status(400).json(ResponseFormatter.error(err, 400));
      return;
    }
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function adminReassignPicker(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { pickerId, picker, pickerName, reason, note } = req.body as Record<string, string>;
    const result = await ordersService.adminReassignPicker(req.params.id, {
      pickerId: pickerId || picker || '',
      pickerName: pickerName || picker,
      reason,
      note,
      actor: actorFrom(req),
    });
    const err = errorOf(result);
    if (err) {
      res.status(400).json(ResponseFormatter.error(err, 400));
      return;
    }
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function adminReassignRider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { riderId, rider, riderName, reason, note } = req.body as Record<string, string>;
    const result = await ordersService.adminReassignRider(req.params.id, {
      riderId: riderId || rider || '',
      riderName: riderName || rider,
      reason,
      note,
      actor: actorFrom(req),
    });
    const err = errorOf(result);
    if (err) {
      res.status(400).json(ResponseFormatter.error(err, 400));
      return;
    }
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function adminContactCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { channel, template, note } = req.body as Record<string, string>;
    const result = await ordersService.adminContactCustomer(req.params.id, {
      channel: channel || '',
      template,
      note,
      actor: actorFrom(req),
    });
    const err = errorOf(result);
    if (err) {
      res.status(400).json(ResponseFormatter.error(err, 400));
      return;
    }
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function adminInitiateRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount, method, reason, scope, note } = req.body as Record<string, string | number>;
    const result = await ordersService.adminInitiateRefund(req.params.id, {
      amount: typeof amount === 'number' ? amount : Number(amount),
      method: method != null ? String(method) : undefined,
      reason: reason != null ? String(reason) : undefined,
      scope: scope != null ? String(scope) : undefined,
      note: note != null ? String(note) : undefined,
      actor: actorFrom(req),
    });
    const err = errorOf(result);
    if (err) {
      res.status(400).json(ResponseFormatter.error(err, 400));
      return;
    }
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}
