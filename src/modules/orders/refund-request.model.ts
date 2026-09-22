import mongoose, { Document, Schema } from 'mongoose';

/**
 * Schema-only port of legacy finance/models/RefundRequest.js — orders creates these
 * (self_service channel) on cancellation. Full finance/ops refund-processing workflow
 * (approve/reject/escalate, ticket linkage) is out of scope for the orders module.
 */

const refundTimelineSchema = new Schema(
  {
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'processed', 'escalated', 'completed'], required: true },
    timestamp: { type: Date, default: Date.now },
    actor: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { _id: false },
);

export interface IRefundRequest extends Document {
  orderId: unknown;
  orderNumber: string;
  customerId: unknown;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  reasonCode: string;
  reasonText: string;
  amount: number;
  currency: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'escalated' | 'completed';
  channel: 'customer_support' | 'self_service' | 'ops_adjustment' | 'auto_missing_item';
  refundMethod: 'original_payment' | 'wallet' | 'bank_transfer' | 'manual';
  paymentId?: string;
  transactionId?: string;
  ticketId?: mongoose.Types.ObjectId;
  timeline: Array<Record<string, unknown>>;
  missingItems: Array<Record<string, unknown>>;
  processedAt?: Date;
  completedAt?: Date;
  rejectionReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refundRequestSchema = new Schema<IRefundRequest>(
  {
    orderId: { type: Schema.Types.Mixed, required: true, index: true },
    orderNumber: { type: String, default: '' },
    customerId: { type: Schema.Types.Mixed, required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true, index: true },
    customerPhone: { type: String, default: '' },
    reasonCode: {
      type: String,
      required: true,
      enum: ['item_damaged', 'expired', 'late_delivery', 'wrong_item', 'customer_cancelled', 'item_not_available', 'quality_issue', 'partial_delivery', 'other'],
      index: true,
    },
    reasonText: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'INR' },
    requestedAt: { type: Date, default: Date.now, index: true },
    status: { type: String, required: true, enum: ['pending', 'approved', 'rejected', 'processed', 'escalated', 'completed'], index: true },
    channel: { type: String, required: true, enum: ['customer_support', 'self_service', 'ops_adjustment', 'auto_missing_item'] },
    refundMethod: { type: String, enum: ['original_payment', 'wallet', 'bank_transfer', 'manual'], default: 'original_payment' },
    paymentId: { type: String },
    transactionId: { type: String },
    ticketId: { type: Schema.Types.ObjectId, ref: 'AdminSupportTicket' },
    timeline: [refundTimelineSchema],
    missingItems: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'CustomerProduct' },
        productName: { type: String },
        quantity: { type: Number },
        refundAmount: { type: Number },
      },
    ],
    processedAt: { type: Date },
    completedAt: { type: Date },
    rejectionReason: { type: String },
    notes: { type: String },
  },
  { timestamps: true },
);

refundRequestSchema.index({ customerId: 1, status: 1 });
refundRequestSchema.index({ status: 1, requestedAt: -1 });
refundRequestSchema.index({ ticketId: 1 });

export const RefundRequest =
  (mongoose.models.RefundRequest as mongoose.Model<IRefundRequest>) || mongoose.model<IRefundRequest>('RefundRequest', refundRequestSchema);
