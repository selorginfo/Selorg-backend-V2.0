import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import * as supportService from './support.service';

function requireCustomerId(req: Request): void {
  if (!req.customer?._id) throw AppError.unauthorized();
}

export async function getActiveChatTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireCustomerId(req);
    const data = await supportService.getActiveChatTicket(req);
    res.status(200).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function createTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireCustomerId(req);
    const ticket = await supportService.createTicket(req);
    res.status(201).json(ResponseFormatter.success(ticket));
  } catch (err) {
    next(err);
  }
}

export async function listMyTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireCustomerId(req);
    const tickets = await supportService.listMyTickets(req);
    res.status(200).json(ResponseFormatter.success(tickets));
  } catch (err) {
    next(err);
  }
}

export async function reopenTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireCustomerId(req);
    const ticket = await supportService.reopenTicket(req);
    res.status(200).json(ResponseFormatter.success(ticket));
  } catch (err) {
    next(err);
  }
}

export async function getTicketMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireCustomerId(req);
    const messages = await supportService.getTicketMessages(req);
    res.status(200).json(ResponseFormatter.success({ messages }));
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireCustomerId(req);
    const message = await supportService.sendMessage(req);
    res.status(201).json(ResponseFormatter.success(message));
  } catch (err) {
    next(err);
  }
}

/** Public (unauthenticated) ticket creation, ported from legacy top-level `support/` sub-app. */
export async function createPublicTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await supportService.createPublicTicket(req.body);
    res.status(201).json(ResponseFormatter.success(ticket));
  } catch (err) {
    next(err);
  }
}
