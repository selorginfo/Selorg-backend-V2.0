import mongoose from 'mongoose';
import { SupportTicket, SupportTicketDocument, SupportTicketNote, SupportTicketNoteDocument, TicketChannel, TicketNoteType } from './support-ticket.model';
import { SupportAttachment } from './support-attachment.schema';
import { AppError } from '../../utils/AppError';

/** Ported from legacy `admin/services/adminSupportService.js`'s `getNextTicketNumber` — re-derives from the last ticket every call, same as legacy (no correctness-relevant in-memory cache). */
export async function getNextTicketNumber(): Promise<string> {
  const last = await SupportTicket.findOne().sort({ createdAt: -1 }).select('ticketNumber').lean();
  let counter = 0;
  if (last?.ticketNumber && last.ticketNumber.startsWith('TKT-')) {
    const num = parseInt(last.ticketNumber.replace('TKT-', ''), 10);
    counter = Number.isNaN(num) ? 0 : num;
  }
  counter += 1;
  return `TKT-${String(counter).padStart(5, '0')}`;
}

function normalizeTicketChannel(channel?: string): TicketChannel {
  const valid = new Set(['email', 'chat', 'phone', 'in_app', 'customer_app', 'rider_app']);
  return valid.has(String(channel)) ? (channel as TicketChannel) : 'in_app';
}

export interface CreateTicketData {
  subject?: string;
  description?: string;
  category?: string;
  priority?: string;
  channel?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderNumber?: string;
  tags?: string[];
  attachments?: SupportAttachment[];
  welcomeMessage?: string;
}

export async function createTicket(
  data: CreateTicketData,
  agentId: string | undefined,
  agentName: string | undefined,
): Promise<{ ticket: SupportTicketDocument; notes: SupportTicketNoteDocument[] }> {
  const ticketNumber = await getNextTicketNumber();
  const noteAuthorId = agentId || data.customerId || (data.customerEmail ? String(data.customerEmail) : 'customer');
  const noteAuthorName = agentName || data.customerName || 'Customer';

  const doc = await SupportTicket.create({
    ticketNumber,
    subject: data.subject || 'Untitled',
    description: data.description || '',
    category: (data.category as SupportTicketDocument['category']) || 'order',
    priority: (data.priority as SupportTicketDocument['priority']) || 'medium',
    status: 'open',
    channel: normalizeTicketChannel(data.channel),
    customerId: data.customerId,
    customerName: data.customerName || 'Unknown',
    customerEmail: data.customerEmail || 'unknown@email.com',
    customerPhone: data.customerPhone || '',
    orderNumber: data.orderNumber,
    tags: data.tags || [],
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
  });

  let notes: SupportTicketNoteDocument[];
  if (data.channel === 'chat') {
    const welcomeNote = await SupportTicketNote.create({
      ticketId: doc._id,
      authorId: agentId || 'system',
      authorName: agentName || 'Support',
      type: 'agent_reply',
      content: data.welcomeMessage || 'Hi! How can we help you today? Send a message and our team will respond shortly.',
      isInternal: false,
      attachments: [],
    });
    notes = [welcomeNote];
  } else {
    const note = await SupportTicketNote.create({
      ticketId: doc._id,
      authorId: String(noteAuthorId),
      authorName: String(noteAuthorName),
      type: 'customer_reply',
      content: data.description || data.subject,
      isInternal: false,
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
    });
    notes = [note];
  }

  return { ticket: doc, notes };
}

export interface AddTicketNoteData {
  authorId: string;
  authorName: string;
  type?: TicketNoteType;
  content?: string;
  isInternal?: boolean;
  attachments?: SupportAttachment[];
}

export async function addTicketNote(ticketId: string, noteData: AddTicketNoteData): Promise<SupportTicketNoteDocument> {
  const content = String(noteData.content || '').trim();
  const attachments = Array.isArray(noteData.attachments) ? noteData.attachments : [];
  if (!content && attachments.length === 0) {
    throw AppError.badRequest('Note content is required');
  }
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw AppError.badRequest('Invalid ticket id');
  }

  const noteContent = content || (attachments.length ? '[Attachment]' : '');

  const ticketExists = await SupportTicket.findById(ticketId).select('_id').lean();
  if (!ticketExists) {
    throw AppError.notFound('Ticket');
  }

  return SupportTicketNote.create({
    ticketId: new mongoose.Types.ObjectId(ticketId),
    authorId: noteData.authorId,
    authorName: noteData.authorName,
    type: noteData.type || 'agent_reply',
    content: noteContent,
    isInternal: noteData.isInternal || false,
    attachments,
  });
}

export function findTicketById(ticketId: string) {
  return SupportTicket.findById(ticketId);
}

export function findTicketByIdLean(ticketId: string) {
  return SupportTicket.findById(ticketId).lean();
}

export function updateTicketFields(ticketId: string, fields: Record<string, unknown>) {
  return SupportTicket.findByIdAndUpdate(ticketId, { $set: fields });
}

export function findMyTickets(customerId: string) {
  return SupportTicket.find({ customerId: String(customerId), channel: { $ne: 'chat' } })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
}

export async function countNonInternalNotesByTicketIds(ticketIds: mongoose.Types.ObjectId[]): Promise<Record<string, number>> {
  if (ticketIds.length === 0) return {};
  const agg = await SupportTicketNote.aggregate([
    { $match: { ticketId: { $in: ticketIds }, isInternal: false } },
    { $group: { _id: '$ticketId', count: { $sum: 1 } } },
  ]);
  const counts: Record<string, number> = {};
  agg.forEach((row: { _id: mongoose.Types.ObjectId; count: number }) => {
    counts[String(row._id)] = row.count;
  });
  return counts;
}

export function findNonInternalNotes(ticketId: string) {
  return SupportTicketNote.find({ ticketId: new mongoose.Types.ObjectId(ticketId), isInternal: false }).sort({ createdAt: 1 }).lean();
}

export function findActiveChatTicket(customerId: string, orderNumber?: string) {
  const filter: Record<string, unknown> = {
    customerId: String(customerId),
    channel: 'chat',
    status: { $in: ['open', 'in_progress'] },
  };
  if (orderNumber) {
    filter.orderNumber = orderNumber;
  } else {
    filter.$or = [{ orderNumber: { $exists: false } }, { orderNumber: null }, { orderNumber: '' }];
  }
  return SupportTicket.findOne(filter).sort({ updatedAt: -1 }).lean();
}
