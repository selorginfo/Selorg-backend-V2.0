import mongoose, { Document, Schema } from 'mongoose';
import { supportAttachmentSchema, SupportAttachment } from './support-attachment.schema';

/**
 * Ported from legacy `admin/models/AdminSupportTicket.js` — kept under the same Mongoose
 * model/collection names ('AdminSupportTicket', 'AdminSupportTicketNote') so a future
 * admin-support-center module can read/write the exact same collection without a migration.
 * Only the customer-facing surface (create/list/reopen/messages) is built on top of this in
 * this module; full admin ticket management (assign/escalate/canned responses/SLA/etc, see
 * legacy `admin/services/adminSupportService.js` ~1162 lines) is a separate future phase.
 */

export type TicketCategory = 'order' | 'payment' | 'delivery' | 'account' | 'technical' | 'feedback';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'waiting_for_customer' | 'resolved' | 'closed';
export type TicketChannel = 'email' | 'chat' | 'phone' | 'in_app' | 'customer_app' | 'rider_app';
export type TicketNoteType = 'customer_reply' | 'agent_reply' | 'internal_note' | 'status_change' | 'assignment';

export interface SupportTicketDocument extends Document {
  ticketNumber: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  channel: TicketChannel;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  assignedTo?: mongoose.Types.ObjectId;
  assignedToName?: string;
  assignedAt?: Date;
  orderId?: mongoose.Types.ObjectId;
  orderNumber?: string;
  tags: string[];
  attachments: SupportAttachment[];
  responseTime?: number;
  resolutionTime?: number;
  slaBreached: boolean;
  slaDeadline?: Date;
  rating?: number;
  resolvedAt?: Date | null;
  escalatedTo: 'darkstore' | 'rider_ops' | 'finance' | 'admin' | '';
  escalationType: string;
  escalationId?: mongoose.Types.ObjectId;
  linkedRefundId?: mongoose.Types.ObjectId;
  linkedRedeliveryId?: mongoose.Types.ObjectId;
  resolutionNote: string;
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketSchema = new Schema<SupportTicketDocument>(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    subject: { type: String, required: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['order', 'payment', 'delivery', 'account', 'technical', 'feedback'],
      default: 'order',
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    channel: {
      type: String,
      enum: ['email', 'chat', 'phone', 'in_app', 'customer_app', 'rider_app'],
      default: 'in_app',
    },
    customerId: { type: String },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedToName: { type: String },
    assignedAt: { type: Date },
    orderId: { type: Schema.Types.ObjectId, ref: 'CustomerOrder' },
    orderNumber: { type: String },
    tags: [{ type: String }],
    attachments: { type: [supportAttachmentSchema], default: [] },
    responseTime: { type: Number },
    resolutionTime: { type: Number },
    slaBreached: { type: Boolean, default: false },
    slaDeadline: { type: Date },
    rating: { type: Number },
    resolvedAt: { type: Date },
    escalatedTo: { type: String, enum: ['darkstore', 'rider_ops', 'finance', 'admin', ''], default: '' },
    escalationType: { type: String, default: '' },
    escalationId: { type: Schema.Types.ObjectId, ref: 'Escalation' },
    linkedRefundId: { type: Schema.Types.ObjectId, ref: 'RefundRequest' },
    linkedRedeliveryId: { type: Schema.Types.ObjectId },
    resolutionNote: { type: String, default: '' },
  },
  { timestamps: true },
);

supportTicketSchema.index({ status: 1, priority: 1 });
supportTicketSchema.index({ category: 1 });
supportTicketSchema.index({ assignedTo: 1 });
supportTicketSchema.index({ createdAt: -1 });

export interface SupportTicketNoteDocument extends Document {
  ticketId: mongoose.Types.ObjectId;
  authorId: string;
  authorName: string;
  type: TicketNoteType;
  content: string;
  isInternal: boolean;
  attachments: SupportAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketNoteSchema = new Schema<SupportTicketNoteDocument>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'AdminSupportTicket', required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    type: {
      type: String,
      enum: ['customer_reply', 'agent_reply', 'internal_note', 'status_change', 'assignment'],
      default: 'agent_reply',
    },
    content: { type: String, required: true },
    isInternal: { type: Boolean, default: false },
    attachments: { type: [supportAttachmentSchema], default: [] },
  },
  { timestamps: true },
);

export const SupportTicket =
  (mongoose.models.AdminSupportTicket as mongoose.Model<SupportTicketDocument>) ||
  mongoose.model<SupportTicketDocument>('AdminSupportTicket', supportTicketSchema);

export const SupportTicketNote =
  (mongoose.models.AdminSupportTicketNote as mongoose.Model<SupportTicketNoteDocument>) ||
  mongoose.model<SupportTicketNoteDocument>('AdminSupportTicketNote', supportTicketNoteSchema);
