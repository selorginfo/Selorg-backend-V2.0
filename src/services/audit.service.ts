import mongoose, { Schema } from 'mongoose';
import { logger } from '../utils/logger';

const auditLogSchema = new Schema(
  {
    module: { type: String, required: true },
    action: { type: String, required: true },
    entityType: { type: String },
    entityId: { type: String },
    userId: { type: Schema.Types.ObjectId, required: false },
    severity: { type: String, enum: ['info', 'warning', 'error', 'critical'], default: 'info' },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true },
);
auditLogSchema.index({ module: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ severity: 1 });

export const AuditLogModel =
  (mongoose.models.AuditLog as mongoose.Model<mongoose.Document>) || mongoose.model('AuditLog', auditLogSchema);

export interface AuditLogEntry {
  module: string;
  action: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/** Fire-and-forget audit trail write. Never throws — a failed audit write must not fail the request. */
export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await AuditLogModel.create(entry);
  } catch (err) {
    logger.warn('AuditLog create failed (non-blocking)', { error: (err as Error).message, module: entry.module, action: entry.action });
  }
}
