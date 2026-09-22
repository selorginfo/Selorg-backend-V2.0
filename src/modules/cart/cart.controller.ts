import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import * as cartService from './cart.service';
import type { AddCartItemInput, MergeCartInput, RemoveCartItemInput, UpdateCartItemByProductVariantInput, UpdateCartItemInput } from './cart.validation';

function errorStatus(message: string): number {
  return message === 'Item not found' || message === 'Cart not found' ? 404 : 400;
}

export async function getCart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const couponCode = typeof req.query?.coupon_code === 'string' ? req.query.coupon_code.trim() : '';
    const zone = typeof req.query?.zone === 'string' ? req.query.zone.trim() : '';
    const paymentMethod = typeof req.query?.payment_method === 'string' ? req.query.payment_method.trim() : '';
    const data = await cartService.getCartForUser(req.customer._id, {
      couponCode: couponCode || null,
      zone: zone || null,
      paymentMethod: paymentMethod || null,
    });
    res.status(200).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function addCartItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const result = await cartService.addItem(req.customer._id, req.body as AddCartItemInput);
    if ('error' in result) {
      res.status(400).json(ResponseFormatter.error(result.error, 400));
      return;
    }
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function updateCartItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const { quantity, productId, variantId } = req.body as UpdateCartItemInput;
    const result = await cartService.updateItem(req.customer._id, req.params.itemId, quantity, { productId, variantId });
    if ('error' in result) {
      res.status(errorStatus(result.error)).json(ResponseFormatter.error(result.error, errorStatus(result.error)));
      return;
    }
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

/** PUT /cart/items — update quantity by productId + variantId (no line-item id required). */
export async function updateCartItemByProductVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const { quantity, productId, variantId } = req.body as UpdateCartItemByProductVariantInput;
    const result = await cartService.updateItem(req.customer._id, null, quantity, { productId, variantId });
    if ('error' in result) {
      res.status(errorStatus(result.error)).json(ResponseFormatter.error(result.error, errorStatus(result.error)));
      return;
    }
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function removeCartItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const { productId, variantId } = (req.body || {}) as RemoveCartItemInput;
    const result = await cartService.removeItem(req.customer._id, req.params.itemId, { productId, variantId });
    if ('error' in result) {
      res.status(404).json(ResponseFormatter.error(result.error, 404));
      return;
    }
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /cart/merge — merge a guest cart into the user's server cart exactly once.
 * Body: { mergeKey: string, items: [{ productId, variantId?, quantity }] }
 */
export async function mergeCart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const { mergeKey, items } = req.body as MergeCartInput;
    const result = await cartService.mergeGuestItems(req.customer._id, items || [], mergeKey);
    if ('error' in result) {
      res.status(400).json(ResponseFormatter.error(result.error, 400));
      return;
    }
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function clear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const data = await cartService.clearCart(req.customer._id);
    res.status(200).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}
