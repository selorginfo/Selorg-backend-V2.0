import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import { AppError } from '../../utils/AppError';
import * as addressesService from './addresses.service';
import type { CreateAddressInput, UpdateAddressInput } from './addresses.validation';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    res.status(200).json(ResponseFormatter.success(await addressesService.getAddressesByUserId(req.customer._id)));
  } catch (err) {
    next(err);
  }
}

export async function getDefault(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    res.status(200).json(ResponseFormatter.success(await addressesService.getDefaultAddress(req.customer._id)));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const { address, wasUpdated } = await addressesService.createAddress(req.customer._id, req.body as CreateAddressInput);
    res.status(wasUpdated ? 200 : 201).json({ ...ResponseFormatter.success(address), updated: wasUpdated });
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      res.status(400).json({ success: false, message: 'Could not save address. Please restart the app and try again.' });
      return;
    }
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const address = await addressesService.updateAddress(req.customer._id, req.params.id, req.body as UpdateAddressInput);
    if (!address) throw AppError.notFound('Address');
    res.status(200).json(ResponseFormatter.success(address));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const deleted = await addressesService.deleteAddress(req.customer._id, req.params.id);
    if (!deleted) throw AppError.notFound('Address');
    res.status(200).json(ResponseFormatter.success(null));
  } catch (err) {
    next(err);
  }
}

export async function setDefault(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const address = await addressesService.setDefaultAddress(req.customer._id, req.params.id);
    if (!address) throw AppError.notFound('Address');
    res.status(200).json(ResponseFormatter.success(address));
  } catch (err) {
    next(err);
  }
}
