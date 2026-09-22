import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { SupportTicket, SupportTicketNote } from '../support/support-ticket.model';
import { FaqItem } from '../faq/faq.model';
import { AppError } from '../../utils/AppError';

function actor(req: Request) {
  return { id: req.user?.userId || 'system', name: req.user?.name || req.user?.email || 'Admin' };
}

// ─── Tickets ──────────────────────────────────────────────────────────────────

export async function listTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.q) {
      const re = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ subject: re }, { ticketNumber: re }, { customerName: re }, { customerEmail: re }];
    }

    const [data, total] = await Promise.all([
      SupportTicket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SupportTicket.countDocuments(filter),
    ]);

    res.json({ success: true, data, list: data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
}

export async function getTicketById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await SupportTicket.findById(req.params.id).lean();
    if (!ticket) throw AppError.notFound('Ticket not found');
    const notes = await SupportTicketNote.find({ ticketId: ticket._id }).sort({ createdAt: 1 }).lean();
    res.json({ success: true, data: { ...ticket, notes } });
  } catch (err) {
    next(err);
  }
}

export async function createTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { subject, description, category, priority, channel, customerName, customerEmail, customerPhone, customerId, orderId, orderNumber, tags } = req.body as Record<string, string>;
    if (!subject || !customerName || !customerEmail) throw AppError.badRequest('subject, customerName and customerEmail are required');

    const count = await SupportTicket.countDocuments();
    const ticketNumber = `TKT-${String(count + 1).padStart(6, '0')}`;

    const ticket = await SupportTicket.create({
      ticketNumber,
      subject,
      description: description || '',
      category: category || 'order',
      priority: priority || 'medium',
      channel: channel || 'in_app',
      customerName,
      customerEmail,
      customerPhone: customerPhone || '',
      customerId,
      orderId: orderId && mongoose.Types.ObjectId.isValid(orderId) ? orderId : undefined,
      orderNumber,
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
    });

    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
}

export async function updateTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const allowed = ['status', 'priority', 'category', 'tags', 'resolutionNote', 'slaBreached', 'slaDeadline'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.status === 'resolved') update.resolvedAt = new Date();

    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).lean();
    if (!ticket) throw AppError.notFound('Ticket not found');

    if (update.status) {
      await SupportTicketNote.create({
        ticketId: ticket._id,
        authorId: actor(req).id,
        authorName: actor(req).name,
        type: 'status_change',
        content: `Status changed to ${update.status}`,
        isInternal: true,
      });
    }

    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
}

export async function assignTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { agent, agentName } = req.body as { agent?: string; agentName?: string };
    if (!agent) throw AppError.badRequest('agent (userId) is required');

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { $set: { assignedTo: agent, assignedToName: agentName || agent, assignedAt: new Date(), status: 'in_progress' } },
      { new: true },
    ).lean();
    if (!ticket) throw AppError.notFound('Ticket not found');

    await SupportTicketNote.create({
      ticketId: ticket._id,
      authorId: actor(req).id,
      authorName: actor(req).name,
      type: 'assignment',
      content: `Assigned to ${agentName || agent}`,
      isInternal: true,
    });

    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
}

export async function addTicketNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await SupportTicket.findById(req.params.id).lean();
    if (!ticket) throw AppError.notFound('Ticket not found');

    const { text, content: bodyContent, isInternal, type } = req.body as Record<string, string | boolean>;
    const noteContent = String(text ?? bodyContent ?? '').trim();
    if (!noteContent) throw AppError.badRequest('text is required');

    const note = await SupportTicketNote.create({
      ticketId: ticket._id,
      authorId: actor(req).id,
      authorName: actor(req).name,
      type: type || 'agent_reply',
      content: noteContent,
      isInternal: isInternal === true || isInternal === 'true',
    });

    // Update ticket status if it was waiting and agent replied
    if (!isInternal && ticket.status === 'waiting_for_customer') {
      await SupportTicket.updateOne({ _id: ticket._id }, { $set: { status: 'in_progress' } });
    }

    res.status(201).json({ success: true, data: { ...note.toObject(), ticketId: ticket._id } });
  } catch (err) {
    next(err);
  }
}

export async function closeTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { resolutionNote } = req.body as { resolutionNote?: string };
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'closed', resolvedAt: new Date(), resolutionNote: resolutionNote || '' } },
      { new: true },
    ).lean();
    if (!ticket) throw AppError.notFound('Ticket not found');

    await SupportTicketNote.create({
      ticketId: ticket._id,
      authorId: actor(req).id,
      authorName: actor(req).name,
      type: 'status_change',
      content: resolutionNote ? `Closed: ${resolutionNote}` : 'Ticket closed',
      isInternal: true,
    });

    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
}

export async function escalateTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { escalateTo, reason } = req.body as { escalateTo?: string; reason?: string };
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { $set: { escalatedTo: escalateTo || 'admin', escalationType: reason || '', priority: 'urgent' } },
      { new: true },
    ).lean();
    if (!ticket) throw AppError.notFound('Ticket not found');

    await SupportTicketNote.create({
      ticketId: ticket._id,
      authorId: actor(req).id,
      authorName: actor(req).name,
      type: 'status_change',
      content: `Escalated to ${escalateTo || 'admin'}${reason ? ': ' + reason : ''}`,
      isInternal: true,
    });

    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
}

export async function refundTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    const amountRaw = (req.body as { amount?: unknown } | undefined)?.amount;
    const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) throw AppError.badRequest('amount must be a positive number');
    const customerId = String(ticket.customerId || '');
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      throw AppError.badRequest('Ticket has no customer to refund');
    }
    const { creditWallet } = await import('../wallet/wallet.service');
    const result = await creditWallet(customerId, amount, {
      source: 'goodwill',
      description: String((req.body as { reason?: string } | undefined)?.reason || 'Support ticket refund'),
      referenceType: 'support_ticket',
      referenceId: String(ticket._id),
    });
    if ('error' in result) throw AppError.badRequest(result.error);
    ticket.status = 'resolved';
    await ticket.save();
    await SupportTicketNote.create({
      ticketId: ticket._id,
      authorId: actor(req).id,
      authorName: actor(req).name,
      type: 'status_change',
      content: `Refunded ₹${amount}`,
      isInternal: true,
    });
    res.json({ success: true, data: { ticket, refund: result }, message: 'Refund issued' });
  } catch (err) {
    next(err);
  }
}

export async function redeliveryTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    if (ticket.orderId) {
      const { Order } = await import('../orders/order.model');
      await Order.findByIdAndUpdate(ticket.orderId, {
        $set: { status: 'confirmed' },
        $push: { timeline: { status: 'confirmed', note: 'Redelivery scheduled from support ticket', actor: actor(req).name } },
      });
    }
    ticket.status = 'in_progress';
    await ticket.save();
    await SupportTicketNote.create({
      ticketId: ticket._id,
      authorId: actor(req).id,
      authorName: actor(req).name,
      type: 'status_change',
      content: 'Redelivery scheduled',
      isInternal: true,
    });
    res.json({ success: true, data: ticket, message: 'Redelivery scheduled' });
  } catch (err) {
    next(err);
  }
}

// ─── Agents / Categories / Canned Responses / SLA ────────────────────────────

export async function listAgents(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Return admin users who have been assigned tickets as a shortcut
    const agents = await SupportTicket.distinct('assignedToName', { assignedToName: { $exists: true, $ne: '' } });
    res.json({ success: true, data: agents.map((name) => ({ name })), total: agents.length });
  } catch (err) {
    next(err);
  }
}

export async function listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = ['order', 'payment', 'delivery', 'account', 'technical', 'feedback'];
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
}

export async function listCannedResponses(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({
      success: true,
      data: [
        { id: '1', title: 'Order delayed', body: 'We apologize for the delay. Your order is on its way and will arrive shortly.' },
        { id: '2', title: 'Refund processed', body: 'Your refund has been processed and will reflect in your account within 5–7 business days.' },
        { id: '3', title: 'Item missing', body: 'We are sorry to hear an item was missing. We will arrange a redelivery or refund immediately.' },
        { id: '4', title: 'Account issue', body: 'Our team is looking into your account issue. We will update you within 24 hours.' },
      ],
    });
  } catch (err) {
    next(err);
  }
}

export async function getSlaMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [total, open, breached, resolved] = await Promise.all([
      SupportTicket.countDocuments(),
      SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      SupportTicket.countDocuments({ slaBreached: true }),
      SupportTicket.countDocuments({ status: { $in: ['resolved', 'closed'] } }),
    ]);
    res.json({
      success: true,
      data: {
        total,
        open,
        resolved,
        breached,
        complianceRate: total > 0 ? (((total - breached) / total) * 100).toFixed(1) + '%' : '100%',
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Live Chats (no support-chat store wired on this admin surface yet) ────

export async function listLiveChats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const chat = await import('../support-chat/support-chat.service');
    const data = await chat.listConversationsForAdmin({ status: 'open' });
    res.json({ success: true, data, total: data.length });
  } catch (err) {
    next(err);
  }
}

export async function acceptLiveChat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const chat = await import('../support-chat/support-chat.service');
    const data = await chat.updateStatus(req.params.id, 'open', actor(req).id);
    res.json({ success: true, data, message: 'Chat accepted' });
  } catch (err) {
    next(err);
  }
}

export async function sendLiveChatMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const chat = await import('../support-chat/support-chat.service');
    const body = (req.body || {}) as { message?: string; body?: string; text?: string };
    const text = String(body.message || body.body || body.text || '').trim();
    if (!text) throw AppError.badRequest('message is required');
    const data = await chat.sendMessage({
      conversationId: req.params.id,
      senderType: 'admin',
      senderId: actor(req).id,
      senderName: actor(req).name,
      body: text,
    });
    res.json({ success: true, data, message: 'Message sent' });
  } catch (err) {
    next(err);
  }
}

// ─── FAQs ─────────────────────────────────────────────────────────────────────

export async function listFaqs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await FaqItem.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data, total: data.length });
  } catch (err) {
    next(err);
  }
}

export async function createFaq(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const faq = await FaqItem.create(req.body);
    res.status(201).json({ success: true, data: faq });
  } catch (err) {
    next(err);
  }
}

export async function updateFaq(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const faq = await FaqItem.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean();
    if (!faq) throw AppError.notFound('FAQ not found');
    res.json({ success: true, data: faq });
  } catch (err) {
    next(err);
  }
}

export async function deleteFaq(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await FaqItem.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'FAQ deleted' });
  } catch (err) {
    next(err);
  }
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export async function listFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const data = await SupportTicket.find({ category: 'feedback' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const total = await SupportTicket.countDocuments({ category: 'feedback' });
    res.json({ success: true, data, total });
  } catch (err) {
    next(err);
  }
}
