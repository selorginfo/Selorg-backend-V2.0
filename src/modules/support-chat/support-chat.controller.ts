import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import { AppError } from '../../utils/AppError';
import * as service from './support-chat.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireRiderId(req: Request): string {
  // Rider JWT sets req.customer._id (customer auth) or req.user.userId (admin auth)
  const id = req.customer?._id || req.user?.userId;
  if (!id) throw AppError.unauthorized();
  return id;
}

function requireAdminUser(req: Request): { userId: string; name: string } {
  if (!req.user) throw AppError.unauthorized();
  return {
    userId: req.user.userId || 'admin',
    name: req.user.name || req.user.email || 'Support',
  };
}

function mapServiceError(err: unknown): AppError {
  const msg = (err as Error)?.message || 'Request failed';
  if (msg === 'Conversation not found') return AppError.notFound('Conversation');
  if (msg === 'Access denied') return AppError.forbidden();
  if (msg.toLowerCase().includes('required')) return AppError.badRequest(msg);
  return AppError.internal(msg);
}

// ─── Rider handlers ───────────────────────────────────────────────────────────

export async function riderGetConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const riderId = requireRiderId(req);
    const conversation = await service.getOrCreateConversationForRider(riderId);
    const messages = await service.listMessages(
      (conversation as Record<string, unknown>).conversationId as string,
      { limit: 80 },
    );
    res.status(200).json(
      ResponseFormatter.success({
        conversation: service.toConversationDto(conversation),
        messages,
      }),
    );
  } catch (err) {
    next(err instanceof AppError ? err : mapServiceError(err));
  }
}

export async function riderGetMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const riderId = requireRiderId(req);
    const conversation = await service.getOrCreateConversationForRider(riderId);
    const limit = parseInt(String(req.query.limit || '50'), 10) || 50;
    const before = req.query.before ? String(req.query.before) : undefined;
    const messages = await service.listMessages(
      (conversation as Record<string, unknown>).conversationId as string,
      { limit, before },
    );
    res.status(200).json(ResponseFormatter.success({ messages }));
  } catch (err) {
    next(err instanceof AppError ? err : mapServiceError(err));
  }
}

export async function riderSendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const riderId = requireRiderId(req);
    const conversation = await service.getOrCreateConversationForRider(riderId);
    const convoDoc = conversation as Record<string, unknown>;
    const result = await service.sendMessage({
      conversationId: convoDoc.conversationId as string,
      senderType: 'rider',
      senderId: riderId,
      senderName:
        (req.customer?.profile as Record<string, unknown> | undefined)?.name as string ||
        req.user?.name ||
        (convoDoc.riderName as string),
      body: req.body?.body || req.body?.content || req.body?.message,
      clientMessageId: req.body?.clientMessageId ?? null,
    });
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err instanceof AppError ? err : mapServiceError(err));
  }
}

export async function riderMarkRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const riderId = requireRiderId(req);
    const conversation = await service.getOrCreateConversationForRider(riderId);
    const updated = await service.markRead(
      (conversation as Record<string, unknown>).conversationId as string,
      'rider',
    );
    res.status(200).json(ResponseFormatter.success({ conversation: updated }));
  } catch (err) {
    next(err instanceof AppError ? err : mapServiceError(err));
  }
}

// ─── Admin handlers ───────────────────────────────────────────────────────────

export async function adminListConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const conversations = await service.listConversationsForAdmin({
      search: req.query.search ? String(req.query.search) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      unreadOnly: req.query.unreadOnly === 'true',
    });
    res.status(200).json(ResponseFormatter.success({ conversations }));
  } catch (err) {
    next(err instanceof AppError ? err : mapServiceError(err));
  }
}

export async function adminGetConversationContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await service.getConversationContext(req.params.id);
    if (!data) {
      res.status(404).json(ResponseFormatter.notFound('Conversation', req.params.id));
      return;
    }
    res.status(200).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err instanceof AppError ? err : mapServiceError(err));
  }
}

export async function adminGetConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const conversation = await service.getConversationById(req.params.id);
    if (!conversation) {
      res.status(404).json(ResponseFormatter.notFound('Conversation', req.params.id));
      return;
    }
    const limit = parseInt(String(req.query.limit || '80'), 10) || 80;
    const before = req.query.before ? String(req.query.before) : undefined;
    const messages = await service.listMessages(conversation.conversationId, { limit, before });
    res.status(200).json(ResponseFormatter.success({ conversation, messages }));
  } catch (err) {
    next(err instanceof AppError ? err : mapServiceError(err));
  }
}

export async function adminSendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const admin = requireAdminUser(req);
    const result = await service.sendMessage({
      conversationId: req.params.id,
      senderType: 'admin',
      senderId: admin.userId,
      senderName: admin.name,
      body: req.body?.body || req.body?.content,
      clientMessageId: req.body?.clientMessageId ?? null,
    });
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err instanceof AppError ? err : mapServiceError(err));
  }
}

export async function adminMarkRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const updated = await service.markRead(req.params.id, 'admin');
    res.status(200).json(ResponseFormatter.success({ conversation: updated }));
  } catch (err) {
    next(err instanceof AppError ? err : mapServiceError(err));
  }
}

export async function adminUpdateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.body?.status as string;
    if (!['open', 'resolved'].includes(status)) {
      res.status(400).json(ResponseFormatter.error('status must be open or resolved', 400));
      return;
    }
    const admin = requireAdminUser(req);
    const updated = await service.updateStatus(
      req.params.id,
      status as 'open' | 'resolved',
      admin.userId,
    );
    res.status(200).json(ResponseFormatter.success({ conversation: updated }));
  } catch (err) {
    next(err instanceof AppError ? err : mapServiceError(err));
  }
}
