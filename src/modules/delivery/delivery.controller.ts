import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import {
  calculateDeliveryEstimate,
  calculateDeliveryFee,
  listAvailableDeliverySlots,
} from './delivery.service';

export async function getDeliveryEstimate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { storeId, latitude, longitude, cartItemCount } = req.query as Record<string, string>;
    if (!storeId || !latitude || !longitude) {
      return next(new AppError('storeId, latitude, and longitude are required', 400, 'BAD_REQUEST'));
    }

    const result = await calculateDeliveryEstimate(
      storeId,
      Number(latitude),
      Number(longitude),
      Number(cartItemCount) || 1,
    ).catch((err) => {
      if (err?.status === 404) throw new AppError(err.message, 404, 'NOT_FOUND');
      throw err;
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getDeliveryFee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { storeId, latitude, longitude, orderTotal } = req.query as Record<string, string>;
    if (!storeId || !latitude || !longitude) {
      return next(new AppError('storeId, latitude, and longitude are required', 400, 'BAD_REQUEST'));
    }

    const result = await calculateDeliveryFee(
      storeId,
      Number(latitude),
      Number(longitude),
      Number(orderTotal) || 0,
    ).catch((err) => {
      if (err?.status === 404) throw new AppError(err.message, 404, 'NOT_FOUND');
      throw err;
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getDeliverySlots(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { storeId, latitude, longitude, cartItemCount } = req.query as Record<string, string>;
    let expressPromiseText: string | undefined;
    if (storeId && latitude && longitude) {
      try {
        const est = await calculateDeliveryEstimate(
          storeId,
          Number(latitude),
          Number(longitude),
          Number(cartItemCount) || 1,
        );
        expressPromiseText = est.promiseText;
      } catch {
        /* optional — slots still return without live ETA */
      }
    }

    const data = await listAvailableDeliverySlots({ expressPromiseText });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
