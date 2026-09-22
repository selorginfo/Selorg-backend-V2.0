import mongoose, { Document, Schema } from 'mongoose';

// ─── Alert ────────────────────────────────────────────────────────────────────

export interface IAlert extends Document {
  id: string;
  type: 'sla_breach' | 'delayed_delivery' | 'rider_no_show' | 'zone_deviation' | 'vehicle_breakdown' | 'rto_return' | 'other';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  source?: {
    orderId?: string;
    riderId?: string;
    riderName?: string;
    vehicleId?: string;
    zone?: string;
    lat?: number;
    lng?: number;
  };
  timeline: Array<{ at: Date; status: string; note?: string; actor?: string }>;
  acknowledgedBy?: string;
  resolvedBy?: string;
  lastUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    id: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['sla_breach', 'delayed_delivery', 'rider_no_show', 'zone_deviation', 'vehicle_breakdown', 'rto_return', 'other'],
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: { type: String, enum: ['open', 'acknowledged', 'resolved', 'dismissed'], default: 'open', index: true },
    source: {
      orderId: String, riderId: String, riderName: String, vehicleId: String,
      zone: String, lat: Number, lng: Number,
    },
    timeline: [
      {
        at: { type: Date, required: true },
        status: { type: String, required: true },
        note: { type: String, default: null },
        actor: { type: String, default: null },
        _id: false,
      },
    ],
    acknowledgedBy: String,
    resolvedBy: String,
    lastUpdatedAt: Date,
  },
  { timestamps: true },
);

alertSchema.index({ priority: -1, createdAt: -1 });
alertSchema.index({ status: 1, type: 1 });

export const Alert =
  (mongoose.models.Alert as mongoose.Model<IAlert>) ||
  mongoose.model<IAlert>('Alert', alertSchema, 'alerts');

// ─── ApprovalRequest ──────────────────────────────────────────────────────────

export interface IApprovalRequest extends Document {
  id: string;
  type: 'order_exception' | 'vehicle_request' | 'document_approval' | 'other';
  title: string;
  description: string;
  reason?: string;
  requestedBy: string;
  requestedById: string;
  requesterRole?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewedBy?: string;
  reviewedById?: string;
  reviewNote?: string;
  reviewedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const approvalRequestSchema = new Schema<IApprovalRequest>(
  {
    id: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['order_exception', 'vehicle_request', 'document_approval', 'other'],
      index: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 1000 },
    reason: { type: String, default: null, maxlength: 500 },
    requestedBy: { type: String, required: true },
    requestedById: { type: String, required: true },
    requesterRole: { type: String, default: null },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
    reviewedBy: String,
    reviewedById: String,
    reviewNote: String,
    reviewedAt: Date,
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

approvalRequestSchema.index({ status: 1, createdAt: -1 });
approvalRequestSchema.index({ requestedById: 1 });

export const ApprovalRequest =
  (mongoose.models.ApprovalRequest as mongoose.Model<IApprovalRequest>) ||
  mongoose.model<IApprovalRequest>('ApprovalRequest', approvalRequestSchema, 'approval_requests');

// ─── CallLog ──────────────────────────────────────────────────────────────────

export interface ICallLog extends Document {
  orderId?: mongoose.Types.ObjectId;
  ticketId?: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  fromRole: 'customer' | 'support_agent' | 'rider' | 'darkstore_staff';
  toRole: 'customer' | 'support_agent' | 'rider' | 'darkstore_staff';
  fromUserId?: mongoose.Types.ObjectId;
  toUserId?: mongoose.Types.ObjectId;
  callerPhone?: string;
  calleePhone?: string;
  virtualNumber?: string;
  isMasked: boolean;
  direction: 'inbound' | 'outbound';
  status: 'initiated' | 'ringing' | 'connected' | 'missed' | 'failed' | 'busy' | 'declined';
  startTime: Date;
  endTime?: Date;
  duration: number;
  recordingUrl?: string;
  agentNotes?: string;
  storeId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const callLogSchema = new Schema<ICallLog>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'CustomerOrder' },
    ticketId: { type: Schema.Types.ObjectId, ref: 'AdminSupportTicket' },
    customerId: { type: Schema.Types.ObjectId, ref: 'CustomerUser' },
    fromRole: { type: String, enum: ['customer', 'support_agent', 'rider', 'darkstore_staff'], required: true },
    toRole: { type: String, enum: ['customer', 'support_agent', 'rider', 'darkstore_staff'], required: true },
    fromUserId: Schema.Types.ObjectId,
    toUserId: Schema.Types.ObjectId,
    callerPhone: String,
    calleePhone: String,
    virtualNumber: String,
    isMasked: { type: Boolean, default: false },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    status: { type: String, enum: ['initiated', 'ringing', 'connected', 'missed', 'failed', 'busy', 'declined'], required: true },
    startTime: { type: Date, required: true },
    endTime: Date,
    duration: { type: Number, default: 0 },
    recordingUrl: String,
    agentNotes: { type: String, default: '' },
    storeId: Schema.Types.ObjectId,
  },
  { timestamps: true },
);

callLogSchema.index({ orderId: 1 });
callLogSchema.index({ customerId: 1 });
callLogSchema.index({ startTime: -1 });

export const CallLog =
  (mongoose.models.CallLog as mongoose.Model<ICallLog>) ||
  mongoose.model<ICallLog>('CallLog', callLogSchema, 'call_logs');

// ─── Escalation ───────────────────────────────────────────────────────────────

export interface IEscalation extends Document {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  assignedToId?: string;
  escalatedBy: string;
  escalatedById: string;
  sourceType?: string;
  sourceId?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const escalationSchema = new Schema<IEscalation>(
  {
    id: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium', index: true },
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open', index: true },
    assignedTo: String,
    assignedToId: String,
    escalatedBy: { type: String, required: true },
    escalatedById: { type: String, required: true },
    sourceType: String,
    sourceId: String,
    resolvedAt: Date,
  },
  { timestamps: true },
);

escalationSchema.index({ status: 1, priority: -1 });
escalationSchema.index({ createdAt: -1 });

export const Escalation =
  (mongoose.models.Escalation as mongoose.Model<IEscalation>) ||
  mongoose.model<IEscalation>('Escalation', escalationSchema, 'escalations');

// ─── RecentSearch ─────────────────────────────────────────────────────────────

export interface IRecentSearch extends Document {
  query: string;
  count: number;
  lastSearchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const recentSearchSchema = new Schema<IRecentSearch>(
  {
    query: { type: String, required: true, unique: true },
    count: { type: Number, default: 1 },
    lastSearchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

recentSearchSchema.index({ count: -1 });
recentSearchSchema.index({ lastSearchedAt: -1 });

export const RecentSearch =
  (mongoose.models.SharedRecentSearch as mongoose.Model<IRecentSearch>) ||
  mongoose.model<IRecentSearch>('SharedRecentSearch', recentSearchSchema, 'shared_recent_searches');
