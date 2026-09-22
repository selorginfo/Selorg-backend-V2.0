import { randomUUID } from 'crypto';
import { SupportConversation } from './support-conversation.model';
import { SupportMessage } from './support-message.model';
import { Rider } from '../rider/rider.models';
import { Order } from '../orders/order.model';
import { logger } from '../../utils/logger';

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface ConversationDto {
  conversationId: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  status: 'open' | 'resolved';
  lastMessage: string;
  lastMessageAt: Date | null;
  riderUnreadCount: number;
  adminUnreadCount: number;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  updatedAt: Date;
}

export interface MessageDto {
  messageId: string;
  conversationId: string;
  senderType: 'rider' | 'admin';
  senderId: string;
  senderName: string;
  body: string;
  clientMessageId: string | null;
  createdAt: Date;
  readByRider: boolean;
  readByAdmin: boolean;
}

export interface OrderContext {
  riderId: string;
  availability: string | null;
  currentOrderId: string | null;
  order: {
    id: string;
    status: string;
    customerName: string;
    dropLocation: unknown;
    riderId: string | null;
    slaDeadline: Date | null;
    isCod: boolean;
    codAmount: number | null;
  } | null;
}

export interface SendMessageParams {
  conversationId: string;
  senderType: 'rider' | 'admin';
  senderId: string;
  senderName?: string;
  body: string;
  clientMessageId?: string | null;
}

export interface SendMessageResult {
  conversation: ConversationDto | null;
  message: MessageDto;
  duplicate: boolean;
}

export interface ListConversationsOptions {
  search?: string;
  status?: string;
  unreadOnly?: boolean;
}

export interface ListMessagesOptions {
  limit?: number;
  before?: string;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

export function toConversationDto(doc: Record<string, unknown> | null): ConversationDto | null {
  if (!doc) return null;
  return {
    conversationId: doc.conversationId as string,
    riderId: doc.riderId as string,
    riderName: doc.riderName as string,
    riderPhone: doc.riderPhone as string,
    status: doc.status as 'open' | 'resolved',
    lastMessage: (doc.lastMessage as string) || '',
    lastMessageAt: (doc.lastMessageAt as Date | null) ?? null,
    riderUnreadCount: (doc.riderUnreadCount as number) || 0,
    adminUnreadCount: (doc.adminUnreadCount as number) || 0,
    resolvedAt: (doc.resolvedAt as Date | null) ?? null,
    resolvedBy: (doc.resolvedBy as string | null) ?? null,
    updatedAt: doc.updatedAt as Date,
  };
}

export function toMessageDto(doc: Record<string, unknown>): MessageDto {
  return {
    messageId: doc.messageId as string,
    conversationId: doc.conversationId as string,
    senderType: doc.senderType as 'rider' | 'admin',
    senderId: doc.senderId as string,
    senderName: doc.senderName as string,
    body: doc.body as string,
    clientMessageId: (doc.clientMessageId as string | null) ?? null,
    createdAt: doc.createdAt as Date,
    readByRider: doc.readByRider as boolean,
    readByAdmin: doc.readByAdmin as boolean,
  };
}

// ─── Rider profile helper ────────────────────────────────────────────────────

async function resolveRiderProfile(riderId: string): Promise<{ name: string; phone: string }> {
  try {
    const rider = await Rider.findOne({ id: riderId }).lean();
    if (!rider) return { name: 'Rider', phone: '' };
    return {
      name: (rider as unknown as Record<string, unknown>).name as string || 'Rider',
      phone: ((rider as unknown as Record<string, unknown>).phone as string) || '',
    };
  } catch (err) {
    logger.warn('resolveRiderProfile: could not fetch rider', { riderId, error: (err as Error).message });
    return { name: 'Rider', phone: '' };
  }
}

// ─── Order context helper ────────────────────────────────────────────────────

export async function getRiderOrderContext(riderId: string): Promise<OrderContext | null> {
  try {
    const rider = await Rider.findOne({ id: riderId }).lean() as Record<string, unknown> | null;
    if (!rider) return null;

    const orderId = (rider.currentOrderId as string | null) || null;
    if (!orderId) {
      return {
        riderId,
        availability: (rider.status as string) || null,
        currentOrderId: null,
        order: null,
      };
    }

    const order = await Order.findOne({
      $or: [{ orderNumber: orderId }, { riderId: orderId }, { _id: orderId }],
    })
      .select('orderNumber status paymentMethod deliveryAddress riderId')
      .lean() as Record<string, unknown> | null;

    const paymentMethod = order?.paymentMethod as Record<string, unknown> | undefined;
    const isCod =
      ((paymentMethod?.methodType as string) || '').toLowerCase() === 'cash' ||
      ((paymentMethod?.paymentMode as string) || '').toLowerCase() === 'cod';

    return {
      riderId,
      availability: (rider.status as string) || null,
      currentOrderId: orderId,
      order: order
        ? {
            id: (order.orderNumber as string) || orderId,
            status: order.status as string,
            customerName: '',
            dropLocation: order.deliveryAddress ?? null,
            riderId: (order.riderId as string | null) ?? null,
            slaDeadline: null,
            isCod,
            codAmount: null,
          }
        : null,
    };
  } catch (err) {
    logger.warn('getRiderOrderContext: error fetching context', { riderId, error: (err as Error).message });
    return null;
  }
}

// ─── Core service functions ───────────────────────────────────────────────────

export async function getOrCreateConversationForRider(riderId: string): Promise<Record<string, unknown>> {
  const existing = await SupportConversation.findOne({ riderId }).lean();
  if (existing) return existing as unknown as Record<string, unknown>;

  const profile = await resolveRiderProfile(riderId);
  const created = await SupportConversation.create({
    conversationId: `sc-${randomUUID()}`,
    riderId,
    riderName: profile.name,
    riderPhone: profile.phone,
    status: 'open',
    lastMessage: '',
    lastMessageAt: null,
    riderUnreadCount: 0,
    adminUnreadCount: 0,
  });
  return created.toObject() as unknown as Record<string, unknown>;
}

export async function listConversationsForAdmin(options: ListConversationsOptions = {}): Promise<(ConversationDto | null)[]> {
  const { search, status, unreadOnly } = options;
  const query: Record<string, unknown> = {};

  if (status) query.status = status;
  if (unreadOnly) query.adminUnreadCount = { $gt: 0 };

  if (search && String(search).trim()) {
    const term = String(search).trim();
    const digits = term.replace(/\D/g, '');
    const or: Record<string, unknown>[] = [
      { riderName: { $regex: term, $options: 'i' } },
      { riderId: { $regex: term, $options: 'i' } },
    ];
    if (digits.length >= 4) {
      or.push({ riderPhone: { $regex: digits, $options: 'i' } });
    }
    query.$or = or;
  }

  const rows = await SupportConversation.find(query as any)
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(200)
    .lean();

  return (rows as unknown as Record<string, unknown>[]).map(toConversationDto);
}

export async function getConversationById(conversationId: string): Promise<ConversationDto | null> {
  const doc = await SupportConversation.findOne({ conversationId }).lean();
  return toConversationDto(doc as unknown as Record<string, unknown> | null);
}

export async function assertRiderOwnsConversation(
  conversationId: string,
  riderId: string,
): Promise<Record<string, unknown>> {
  const doc = await SupportConversation.findOne({ conversationId }).lean();
  if (!doc) throw new Error('Conversation not found');
  if ((doc as unknown as Record<string, unknown>).riderId !== riderId) throw new Error('Access denied');
  return doc as unknown as Record<string, unknown>;
}

export async function listMessages(
  conversationId: string,
  options: ListMessagesOptions = {},
): Promise<MessageDto[]> {
  const { limit = 50, before } = options;
  const q: Record<string, unknown> = { conversationId };
  if (before) q.createdAt = { $lt: new Date(before) };

  const rows = await SupportMessage.find(q as any)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .lean();

  return (rows as unknown as Record<string, unknown>[]).reverse().map(toMessageDto);
}

export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const { conversationId, senderType, senderId, senderName, body, clientMessageId } = params;

  const text = String(body || '').trim();
  if (!text) throw new Error('Message body is required');

  if (clientMessageId) {
    const existing = await SupportMessage.findOne({ conversationId, clientMessageId }).lean();
    if (existing) {
      const conversation = await SupportConversation.findOne({ conversationId }).lean();
      return {
        conversation: toConversationDto(conversation as unknown as Record<string, unknown> | null),
        message: toMessageDto(existing as unknown as Record<string, unknown>),
        duplicate: true,
      };
    }
  }

  const message = await SupportMessage.create({
    messageId: `sm-${randomUUID()}`,
    conversationId,
    senderType,
    senderId,
    senderName: senderName || (senderType === 'admin' ? 'Support' : 'Rider'),
    body: text,
    clientMessageId: clientMessageId || null,
    readByRider: senderType === 'rider',
    readByAdmin: senderType === 'admin',
  });

  const inc: Record<string, unknown> = {
    lastMessage: text,
    lastMessageAt: new Date(),
  };
  const update: Record<string, unknown> = { $set: inc };
  if (senderType === 'rider') {
    update.$inc = { adminUnreadCount: 1 };
  } else {
    update.$inc = { riderUnreadCount: 1 };
  }

  const conversation = await SupportConversation.findOneAndUpdate(
    { conversationId },
    update as Parameters<typeof SupportConversation.findOneAndUpdate>[1],
    { new: true },
  ).lean();

  // TODO: emit via Socket.IO when available

  return {
    conversation: toConversationDto(conversation as unknown as Record<string, unknown> | null),
    message: toMessageDto(message.toObject() as unknown as Record<string, unknown>),
    duplicate: false,
  };
}

export async function markRead(
  conversationId: string,
  readerType: 'rider' | 'admin',
): Promise<ConversationDto | null> {
  const isRider = readerType === 'rider';
  const readField = isRider ? 'readByRider' : 'readByAdmin';

  await SupportMessage.updateMany(
    { conversationId, [readField]: false } as Parameters<typeof SupportMessage.updateMany>[0],
    { $set: { [readField]: true } },
  );

  const convUpdate = isRider
    ? { $set: { riderUnreadCount: 0 } }
    : { $set: { adminUnreadCount: 0 } };

  const conversation = await SupportConversation.findOneAndUpdate(
    { conversationId },
    convUpdate as Parameters<typeof SupportConversation.findOneAndUpdate>[1],
    { new: true },
  ).lean();

  // TODO: emit via Socket.IO when available

  return toConversationDto(conversation as unknown as Record<string, unknown> | null);
}

export async function updateStatus(
  conversationId: string,
  status: 'open' | 'resolved',
  adminUserId?: string,
): Promise<ConversationDto | null> {
  const update: Record<string, unknown> = {
    status,
    resolvedAt: status === 'resolved' ? new Date() : null,
    resolvedBy: status === 'resolved' ? adminUserId || 'admin' : null,
  };

  const conversation = await SupportConversation.findOneAndUpdate(
    { conversationId },
    { $set: update } as Parameters<typeof SupportConversation.findOneAndUpdate>[1],
    { new: true },
  ).lean();

  // TODO: emit via Socket.IO when available

  return toConversationDto(conversation as unknown as Record<string, unknown> | null);
}

export async function getConversationContext(
  conversationId: string,
): Promise<{ conversation: ConversationDto; orderContext: OrderContext | null } | null> {
  const conversation = await SupportConversation.findOne({ conversationId }).lean();
  if (!conversation) return null;

  const convoDoc = conversation as unknown as Record<string, unknown>;
  const orderContext = await getRiderOrderContext(convoDoc.riderId as string);

  return {
    conversation: toConversationDto(convoDoc) as ConversationDto,
    orderContext,
  };
}
