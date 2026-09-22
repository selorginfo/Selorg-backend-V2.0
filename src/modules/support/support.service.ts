import mongoose from 'mongoose';
import type { Request } from 'express';
import { resolveCustomerIdentity } from '../../utils/customerDisplay';
import { processSupportUploads } from './support-attachment.service';
import * as repo from './support.repository';
import { SupportAttachment } from './support-attachment.schema';
import { SupportTicketDocument, TicketCategory } from './support-ticket.model';
import { AppError } from '../../utils/AppError';

/**
 * Ported from legacy `customer-backend/controllers/supportController.js`. `req.customer`
 * replaces legacy's overloaded `req.user` (customer JWT auth, see migration convention).
 * `validators/supportSchemas.js` was confirmed dead code (never imported anywhere in legacy)
 * — not ported; the inline sanitization/validation below matches what the controller
 * actually enforces in production.
 */

export function sanitizeText(value: unknown, maxLen = 5000): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function mapAttachment(a: SupportAttachment) {
  return { url: a.url, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes };
}

export function ticketOwnedByUser(ticket: { customerId?: string } | null, userId: string): boolean {
  return String(ticket?.customerId || '') === String(userId);
}

interface LiveChatBody {
  channel?: unknown;
  type?: unknown;
  liveChat?: unknown;
}

function isLiveChatRequest(body: LiveChatBody = {}): boolean {
  const type = String(body.type || '').trim();
  return body.channel === 'chat' || type === 'general_inquiry' || type === 'order_issue' || body.liveChat === true || body.liveChat === 'true';
}

const VALID_TICKET_CATEGORIES = new Set(['order', 'payment', 'delivery', 'account', 'technical', 'feedback']);

const CATEGORY_ALIASES: Record<string, TicketCategory> = {
  orders: 'order',
  order_issues: 'order',
  payments: 'payment',
  payment_billing: 'payment',
  refunds: 'payment',
  refund_returns: 'payment',
  wallet: 'payment',
  offers: 'account',
  account_settings: 'account',
  general_inquiry: 'account',
  contact_support: 'account',
  technical_issues: 'technical',
  app_issues: 'technical',
};

/** Map UI / free-text category labels to stored ticket category enum. */
export function normalizeTicketCategory(raw: string | undefined, fallback: TicketCategory = 'order'): TicketCategory {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s&-]+/g, '_');
  if (VALID_TICKET_CATEGORIES.has(value)) return value as TicketCategory;
  return CATEGORY_ALIASES[value] || (VALID_TICKET_CATEGORIES.has(fallback) ? fallback : 'order');
}

function customerIdentityFromRequest(req: Request, ticket?: { customerName?: string; customerPhone?: string; customerId?: string }) {
  return resolveCustomerIdentity({ user: req.customer?.profile as never, ticket });
}

export function mapCustomerTicketSummary(ticket: SupportTicketDocument | Record<string, unknown>, noteCount = 0) {
  const t = ticket as Record<string, unknown> & { _id: mongoose.Types.ObjectId };
  return {
    id: t._id.toString(),
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    description: t.description || '',
    category: t.category,
    priority: t.priority,
    status: t.status,
    channel: t.channel,
    orderNumber: t.orderNumber,
    attachments: ((t.attachments as SupportAttachment[]) || []).map(mapAttachment),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    resolvedAt: t.resolvedAt,
    noteCount,
    canReopen: t.status === 'closed' || t.status === 'resolved',
  };
}

export async function getActiveChatTicket(req: Request) {
  const userId = req.customer?._id;
  const orderNumber = req.query.orderNumber ? String(req.query.orderNumber).trim() : '';
  const ticket = await repo.findActiveChatTicket(String(userId), orderNumber);
  if (!ticket) return null;
  return {
    id: ticket._id.toString(),
    _id: ticket._id.toString(),
    subject: ticket.subject,
    orderNumber: ticket.orderNumber,
    status: ticket.status,
    attachments: ((ticket.attachments as SupportAttachment[]) || []).map(mapAttachment),
  };
}

export async function createTicket(req: Request) {
  const userId = req.customer!._id;
  const profile = req.customer?.profile as { email?: string } | undefined;
  const identity = customerIdentityFromRequest(req);
  const customerName = sanitizeText(req.body.customerName, 120) || identity.customerName;
  const customerPhone = sanitizeText(req.body.customerPhone, 40) || identity.customerPhone;
  const bodyEmail = req.body.customerEmail && sanitizeText(req.body.customerEmail, 160);
  const profileEmail = profile?.email && String(profile.email).trim();
  const customerEmail =
    bodyEmail || profileEmail || (customerPhone ? `customer-${customerPhone.replace(/\D/g, '')}@selorg.com` : `customer-${userId}@selorg.com`);

  const subject = sanitizeText(req.body.subject, 200);
  const description = sanitizeText(req.body.description || req.body.message || '', 5000);
  const categoryRaw = sanitizeText(req.body.category, 40) || undefined;
  const priority = sanitizeText(req.body.priority, 20) || undefined;
  const type = sanitizeText(req.body.type, 40);
  const resolvedOrderNumber = sanitizeText(req.body.orderNumber || req.body.orderId || '', 80);

  const liveChat = isLiveChatRequest(req.body);
  if (!liveChat && !subject && !description) {
    throw AppError.badRequest('Subject or description is required');
  }

  const attachments = await processSupportUploads(req, { userId: String(userId) });
  const fallbackCategory: TicketCategory = type === 'general_inquiry' ? 'account' : 'order';

  const data: repo.CreateTicketData = {
    subject: subject || (liveChat ? 'General Chat Support' : 'Support request'),
    description: liveChat ? description : description || subject || 'General inquiry',
    category: normalizeTicketCategory(categoryRaw, fallbackCategory),
    priority: priority || 'medium',
    customerName: String(customerName).trim(),
    customerEmail: String(customerEmail).trim(),
    customerPhone: String(customerPhone).trim(),
    customerId: String(userId),
    orderNumber: resolvedOrderNumber || undefined,
    channel: liveChat ? 'chat' : sanitizeText(req.body.channel, 40) || 'in_app',
    attachments,
  };

  const { ticket } = await repo.createTicket(data, 'system', 'Support');
  return { _id: ticket._id.toString(), ...mapCustomerTicketSummary(ticket) };
}

export async function listMyTickets(req: Request) {
  const userId = req.customer!._id;
  const tickets = await repo.findMyTickets(userId);
  const ticketIds = tickets.map((t) => t._id as mongoose.Types.ObjectId);
  const noteCounts = await repo.countNonInternalNotesByTicketIds(ticketIds);
  return tickets.map((t) => mapCustomerTicketSummary(t, noteCounts[String(t._id)] || 0));
}

export async function reopenTicket(req: Request) {
  const userId = req.customer!._id;
  const { ticketId } = req.params;
  const ticket = await repo.findTicketByIdLean(ticketId);
  if (!ticket) {
    throw AppError.notFound('Ticket');
  }
  if (!ticketOwnedByUser(ticket, userId)) {
    throw AppError.forbidden();
  }
  if (!['closed', 'resolved'].includes(ticket.status)) {
    throw AppError.badRequest('Ticket is already open');
  }

  await repo.updateTicketFields(ticketId, { status: 'open', resolvedAt: null });

  const identity = customerIdentityFromRequest(req, ticket);
  await repo.addTicketNote(ticketId, {
    authorId: String(userId),
    authorName: identity.displayName,
    type: 'customer_reply',
    content: 'Customer reopened this ticket.',
    isInternal: false,
  });

  const updated = await repo.findTicketByIdLean(ticketId);
  return mapCustomerTicketSummary(updated!);
}

export async function getTicketMessages(req: Request) {
  const userId = req.customer!._id;
  const { ticketId } = req.params;
  const ticket = await repo.findTicketByIdLean(ticketId);
  if (!ticket) {
    throw AppError.notFound('Ticket');
  }
  if (!ticketOwnedByUser(ticket, userId)) {
    throw AppError.forbidden();
  }

  const notes = await repo.findNonInternalNotes(ticketId);
  return notes.map((n) => ({
    id: n._id.toString(),
    _id: n._id.toString(),
    text: n.content,
    message: n.content,
    sender: n.type === 'customer_reply' ? 'user' : 'agent',
    senderType: n.type === 'customer_reply' ? 'customer' : 'agent',
    authorName: n.authorName,
    attachments: ((n.attachments as SupportAttachment[]) || []).map(mapAttachment),
    timestamp: n.createdAt,
    createdAt: n.createdAt,
  }));
}

export async function sendMessage(req: Request) {
  const userId = req.customer!._id;
  const { ticketId } = req.params;
  const ticket = await repo.findTicketByIdLean(ticketId);
  if (!ticket) {
    throw AppError.notFound('Ticket');
  }
  if (!ticketOwnedByUser(ticket, userId)) {
    throw AppError.forbidden();
  }

  const content = sanitizeText(req.body.message || req.body.text || req.body.content || '', 5000);
  const attachments = await processSupportUploads(req, { userId: String(userId), ticketId: String(ticketId) });

  if (!content && attachments.length === 0) {
    throw AppError.badRequest('Message content is required');
  }

  const identity = customerIdentityFromRequest(req, ticket);

  const note = await repo.addTicketNote(ticketId, {
    authorId: String(userId),
    authorName: identity.displayName,
    type: 'customer_reply',
    content: content || '[Attachment]',
    isInternal: false,
    attachments,
  });

  await repo.updateTicketFields(ticketId, {
    updatedAt: new Date(),
    status: ticket.status === 'closed' ? 'open' : 'in_progress',
    customerName: identity.customerName,
    customerPhone: identity.customerPhone || ticket.customerPhone || '',
  });

  return {
    id: note._id.toString(),
    text: note.content,
    message: note.content,
    sender: 'user',
    senderType: 'customer',
    authorName: note.authorName,
    attachments: ((note.attachments as SupportAttachment[]) || []).map(mapAttachment),
    timestamp: note.createdAt,
    createdAt: note.createdAt,
  };
}

/**
 * Ported from legacy top-level `src/support/controllers/supportController.js` (public,
 * unauthenticated ticket creation used by both customer and rider apps). Folded into this
 * module since it's a thin wrapper over the same ticket-creation path — mounted at
 * `/api/v1/support/tickets` (no auth), separate from the customer-authenticated routes above.
 */
export interface PublicCreateTicketBody {
  subject?: string;
  description?: string;
  message?: string;
  category?: string;
  priority?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderNumber?: string;
  source?: 'customer' | 'rider';
  customerId?: string;
}

export async function createPublicTicket(body: PublicCreateTicketBody) {
  if (!body.subject || !body.customerName || !body.customerEmail) {
    throw AppError.badRequest('subject, customerName, and customerEmail are required');
  }

  const desc = body.description || body.message || '';
  const data: repo.CreateTicketData = {
    subject: String(body.subject).trim(),
    description: desc.trim() || body.subject,
    category: body.category || 'order',
    priority: body.priority || 'medium',
    customerName: String(body.customerName).trim(),
    customerEmail: String(body.customerEmail).trim(),
    customerPhone: body.customerPhone ? String(body.customerPhone).trim() : '',
    orderNumber: body.orderNumber ? String(body.orderNumber).trim() : undefined,
    channel: body.source === 'rider' ? 'rider_app' : 'in_app',
    customerId: body.customerId ? String(body.customerId).trim() : undefined,
  };

  const { ticket } = await repo.createTicket(data, 'system', 'Customer/Rider');
  return mapCustomerTicketSummary(ticket);
}
