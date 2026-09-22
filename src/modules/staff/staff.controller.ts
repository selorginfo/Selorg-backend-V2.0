import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import * as staffService from './staff.service';
import { logger } from '../../utils/logger';

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const summary = await staffService.getSummaryForDate(dateStr);
    res.status(200).json({ success: true, ...summary });
  } catch (error) {
    next(error);
  }
}

export async function listShifts(req: Request, res: Response, next: NextFunction) {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const filter = ((req.query.filter as string) || 'all').toLowerCase();
    const data = await staffService.listShiftsForDate(dateStr, filter);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getShiftById(req: Request, res: Response, next: NextFunction) {
  try {
    const shift = await staffService.getShift(req.params.id);
    if (!shift) throw AppError.notFound('Shift not found');
    res.status(200).json({ success: true, data: staffService.toRiderShift(shift) });
  } catch (error) {
    next(error);
  }
}

export async function createShift(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body;
    const riderId = body.riderId || body.staffId;
    if (!riderId || !body.date || !body.startTime || !body.endTime || !body.hub) {
      throw AppError.badRequest('riderId, date, startTime, endTime, and hub are required');
    }
    const riderName = body.riderName || body.staffName || 'Unknown Rider';
    const shift = await staffService.createShift(body, riderName);
    res.status(201).json({ success: true, data: shift });
  } catch (error) {
    next(error);
  }
}

export async function updateShift(req: Request, res: Response, next: NextFunction) {
  try {
    const shift = await staffService.updateShift(req.params.id, req.body);
    if (!shift) throw AppError.notFound('Shift not found');
    res.status(200).json({ success: true, data: shift });
  } catch (error) {
    next(error);
  }
}

export async function listRiders(req: Request, res: Response, next: NextFunction) {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const data = await staffService.listRidersForDate(dateStr);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
