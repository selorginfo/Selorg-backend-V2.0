import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as couponsService from './coupons.service';
import type { ValidateCouponInput, RedeemCouponInput, CreateCouponInput } from './coupons.validation';

// --- Customer-facing ---------------------------------------------------------

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, user_id, cartValue, cart_value, zone, paymentMethod, payment_method } = req.query as Record<string, string | undefined>;
    const data = await couponsService.listActiveCoupons({
      userId: userId || user_id || req.customer?._id,
      cartValue: parseFloat(String(cartValue ?? cart_value)) || 0,
      zone,
      paymentMethod: paymentMethod || payment_method || 'ALL',
    });
    res.status(200).json(ResponseFormatter.success({ coupons: data }));
  } catch (err) {
    next(err);
  }
}

export async function validate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as ValidateCouponInput;
    const result = await couponsService.validateCoupon(
      body.coupon_code,
      String(body.user_id || req.customer?._id || ''),
      (body.cart_items as couponsService.CartItemForValidation[]) || [],
      parseFloat(String(body.cart_value)) || 0,
      body.payment_method || 'ALL',
      body.zone || '',
      parseFloat(String(body.delivery_fee)) || 0,
    );
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function redeem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as RedeemCouponInput;
    const result = await couponsService.redeemCoupon({
      couponCode: body.coupon_code,
      userId: String(body.user_id || req.customer?._id || ''),
      orderId: body.order_id,
      cartItems: body.cart_items as couponsService.CartItemForValidation[] | undefined,
      cartValue: parseFloat(String(body.cart_value)) || 0,
      paymentMethod: body.payment_method || 'ALL',
      zone: body.zone || '',
      deliveryFee: parseFloat(String(body.delivery_fee)) || 0,
    });
    if (!result.success) {
      res.status(result.error_code === 'INVALID_CODE' ? 404 : 400).json(ResponseFormatter.error(result.error_code || 'Redemption failed', 400, result));
      return;
    }
    res.status(200).json(ResponseFormatter.success({ discount_applied: result.discount_applied }));
  } catch (err) {
    next(err);
  }
}

// --- Admin ---------------------------------------------------------------

export async function adminList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, isActive, page, limit } = req.query as Record<string, string | undefined>;
    const result = await couponsService.adminListCoupons({
      search,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(ResponseFormatter.paginated(result.items, result.total, result.page, result.limit));
  } catch (err) {
    next(err);
  }
}

export async function adminStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await couponsService.adminStats()));
  } catch (err) {
    next(err);
  }
}

export async function adminGetById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await couponsService.adminGetCoupon(req.params.id);
    if (!item) {
      res.status(404).json(ResponseFormatter.error('Coupon not found', 404));
      return;
    }
    res.status(200).json(ResponseFormatter.success(item));
  } catch (err) {
    next(err);
  }
}

export async function adminCreate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const created = await couponsService.adminCreateCoupon(req.body as CreateCouponInput);
    res.status(201).json(ResponseFormatter.success(created));
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode) {
      res.status(statusCode).json(ResponseFormatter.error((err as Error).message, statusCode));
      return;
    }
    next(err);
  }
}

export async function adminUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const updated = await couponsService.adminUpdateCoupon(req.params.id, req.body as Record<string, unknown>);
    res.status(200).json(ResponseFormatter.success(updated));
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode) {
      res.status(statusCode).json(ResponseFormatter.error((err as Error).message, statusCode));
      return;
    }
    next(err);
  }
}

export async function adminRemove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await couponsService.adminDeleteCoupon(req.params.id);
    res.status(200).json(ResponseFormatter.success({ message: 'Coupon deleted' }));
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode) {
      res.status(statusCode).json(ResponseFormatter.error((err as Error).message, statusCode));
      return;
    }
    next(err);
  }
}
