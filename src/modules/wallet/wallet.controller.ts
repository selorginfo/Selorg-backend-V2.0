import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import * as walletService from './wallet.service';
import * as worldlineService from '../payments/worldline.service';
import { Order } from '../orders/order.model';
import type { DebitForCheckoutInput, InitiateTopUpInput } from './wallet.validation';

function requireCustomerId(req: Request): string {
  if (!req.customer?._id) throw AppError.unauthorized();
  return req.customer._id;
}

export async function getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const data = await walletService.getBalance(userId);
    res.status(200).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const page = parseInt(String(req.query.page || ''), 10) || 1;
    const limit = Math.min(parseInt(String(req.query.limit || ''), 10) || 20, 100);
    const data = await walletService.getTransactions(userId, page, limit);
    res.status(200).json(ResponseFormatter.paginated(data.data, data.pagination.total, page, limit));
  } catch (err) {
    next(err);
  }
}

/**
 * Legacy direct debit endpoint. Prefer order create with paymentMethodType=wallet —
 * that path validates the order total server-side and is idempotent per order.
 */
export async function debitForCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const { amount, orderId } = req.body as DebitForCheckoutInput;

    const order = await Order.findOne({ _id: orderId, userId }).lean();
    if (!order) {
      res.status(404).json(ResponseFormatter.error('Order not found', 404));
      return;
    }
    if (order.paymentStatus === 'paid') {
      res.status(400).json(ResponseFormatter.error('Order is already paid', 400));
      return;
    }
    if (order.status === 'cancelled') {
      res.status(400).json(ResponseFormatter.error('Order is cancelled', 400));
      return;
    }

    const expected = Number(order.walletDeduction) > 0 ? Number(order.walletDeduction) : Number(order.totalBill) || 0;
    const requested = Number(amount);
    if (Number.isFinite(requested) && Math.abs(requested - expected) > 0.009) {
      res.status(400).json(ResponseFormatter.error('Wallet amount must match the order wallet deduction computed by the server', 400));
      return;
    }

    const result = await walletService.debitWalletForOrder(userId, expected, order._id, {
      description: `Payment for order ${order.orderNumber || order._id}`,
    });
    if ('error' in result) {
      res.status(400).json(ResponseFormatter.error(result.error, 400));
      return;
    }

    res.status(200).json(ResponseFormatter.success({ balance: result.balance, deducted: result.deducted, alreadyDebited: !!result.alreadyDebited }));
  } catch (err) {
    next(err);
  }
}

/**
 * Direct free credit is disabled for customers.
 * Use POST /wallet/top-up/session -> Paynimo -> verified complete instead.
 */
export async function creditForTopUp(_req: Request, res: Response): Promise<void> {
  res.status(403).json(ResponseFormatter.error('Direct wallet credit is disabled. Please add money using payment.', 403));
}

/** Start a Worldline/Paynimo checkout for wallet top-up. */
export async function initiateTopUp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const { amount, platform = 'web', algo, consumerEmailId, consumerMobileNo, paymentMode = 'all', checkoutOrigin } = req.body as InitiateTopUpInput;

    const result = await worldlineService.createWalletTopUpSession(userId, {
      amount,
      platform,
      algo,
      consumerEmailId,
      consumerMobileNo,
      paymentMode,
      checkoutOrigin,
    });

    if ('error' in result) {
      res.status(400).json(ResponseFormatter.error(result.error, 400));
      return;
    }

    res.status(200).json(ResponseFormatter.success(result.data));
  } catch (err) {
    next(err);
  }
}
