import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import * as refundsService from './refunds.service';
import type { CreateRefundRequestInput } from './refunds.validation';

function requireCustomerId(req: Request): string {
  if (!req.customer?._id) throw AppError.unauthorized();
  return req.customer._id;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customerId = requireCustomerId(req);
    const page = parseInt(String(req.query.page || ''), 10) || 1;
    const pageSize = Math.min(parseInt(String(req.query.pageSize || ''), 10) || 20, 100);
    const result = await refundsService.listRefunds(customerId, page, pageSize);
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customerId = requireCustomerId(req);
    const refund = await refundsService.getRefundById(customerId, req.params.id);
    if (!refund) {
      res.status(404).json(ResponseFormatter.error('Refund not found', 404));
      return;
    }
    res.status(200).json(ResponseFormatter.success(refund));
  } catch (err) {
    next(err);
  }
}

export async function getDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customerId = requireCustomerId(req);
    const details = await refundsService.getRefundDetailsForCustomer(customerId, req.params.id);
    if (!details) {
      res.status(404).json(ResponseFormatter.error('Refund not found', 404));
      return;
    }
    res.status(200).json(ResponseFormatter.success(details));
  } catch (err) {
    next(err);
  }
}

export async function createRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customerId = requireCustomerId(req);
    const refund = await refundsService.createRefundRequest(customerId, req.body as CreateRefundRequestInput);
    res.status(201).json(ResponseFormatter.success(refund));
  } catch (err) {
    next(err);
  }
}
