import mongoose, { Document, Schema } from 'mongoose';
import { randomUUID } from 'crypto';

export interface ISupportMessage extends Document {
  messageId: string;
  conversationId: string;
  senderType: 'rider' | 'admin';
  senderId: string;
  senderName: string;
  body: string;
  clientMessageId: string | null;
  readByRider: boolean;
  readByAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupportMessageSchema = new Schema<ISupportMessage>(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `sm-${randomUUID()}`,
    },
    conversationId: { type: String, required: true, index: true },
    senderType: { type: String, enum: ['rider', 'admin'], required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, default: '' },
    body: { type: String, required: true, trim: true },
    clientMessageId: { type: String, default: null },
    readByRider: { type: Boolean, default: false },
    readByAdmin: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'support_messages' },
);

SupportMessageSchema.index(
  { conversationId: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } },
);

export const SupportMessage =
  (mongoose.models.SupportMessage as mongoose.Model<ISupportMessage>) ||
  mongoose.model<ISupportMessage>('SupportMessage', SupportMessageSchema);
