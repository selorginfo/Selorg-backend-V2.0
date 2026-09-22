import mongoose, { Schema, Document } from 'mongoose';

export interface IPermission extends Document {
  name: string;
  displayName: string;
  module: string;
  action: string;
  description?: string;
  riskLevel: 'low' | 'medium' | 'high';
  dependsOn: string[];
  category: 'read' | 'write' | 'delete' | 'admin';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PermissionSchema = new Schema<IPermission>(
  {
    name: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    displayName: { type: String, required: true, trim: true },
    module: { type: String, required: true, trim: true, index: true },
    action: { type: String, trim: true, lowercase: true, default: 'view', index: true },
    description: { type: String, trim: true },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low', index: true },
    dependsOn: [{ type: String, trim: true, lowercase: true }],
    category: { type: String, enum: ['read', 'write', 'delete', 'admin'], default: 'read', index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

PermissionSchema.index({ module: 1, isActive: 1 });
PermissionSchema.index({ category: 1, isActive: 1 });
PermissionSchema.index({ module: 1, action: 1, isActive: 1 });

export const Permission =
  (mongoose.models.Permission as mongoose.Model<IPermission>) ||
  mongoose.model<IPermission>('Permission', PermissionSchema);
