import mongoose, { Document, Schema } from 'mongoose';
import { randomUUID } from 'crypto';

export interface ISupportConversation extends Document {
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
  createdAt: Date;
  updatedAt: Date;
}

const SupportConversationSchema = new Schema<ISupportConversation>(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `sc-${randomUUID()}`,
    },
    riderId: { type: String, required: true, unique: true, index: true },
    riderName: { type: String, default: 'Rider' },
    riderPhone: { type: String, default: '' },
    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: null, index: true },
    riderUnreadCount: { type: Number, default: 0 },
    adminUnreadCount: { type: Number, default: 0 },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
  },
  { timestamps: true, collection: 'support_conversations' },
);

export const SupportConversation =
  (mongoose.models.SupportConversation as mongoose.Model<ISupportConversation>) ||
  mongoose.model<ISupportConversation>('SupportConversation', SupportConversationSchema);
