import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRole extends Document {
  name: string;
  description?: string;
  templateKey?: string;
  isTemplate: boolean;
  isSystemTemplate: boolean;
  templateVersion: number;
  riskLevel: 'low' | 'medium' | 'high';
  roleType: 'system' | 'custom';
  permissions: string[];
  accessScope: 'global' | 'zone' | 'store';
  isActive: boolean;
  createdBy?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    description: { type: String, trim: true },
    templateKey: { type: String, trim: true, lowercase: true, sparse: true, index: true },
    isTemplate: { type: Boolean, default: false, index: true },
    isSystemTemplate: { type: Boolean, default: false, index: true },
    templateVersion: { type: Number, default: 1, min: 1 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium', index: true },
    roleType: { type: String, enum: ['system', 'custom'], default: 'custom', index: true },
    permissions: [{ type: String, required: true }],
    accessScope: { type: String, enum: ['global', 'zone', 'store'], default: 'global', index: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

RoleSchema.index({ roleType: 1, isActive: 1 });
RoleSchema.index({ accessScope: 1, isActive: 1 });
RoleSchema.index({ isTemplate: 1, isSystemTemplate: 1, isActive: 1 });

export const Role = (mongoose.models.Role as mongoose.Model<IRole>) || mongoose.model<IRole>('Role', RoleSchema);
