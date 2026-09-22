import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemConfig extends Document {
  key: string;
  value: unknown;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SystemConfigSchema = new Schema<ISystemConfig>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: String },
  },
  { timestamps: true },
);

SystemConfigSchema.index({ key: 1 }, { unique: true });

export const SystemConfig =
  (mongoose.models.SystemConfig as mongoose.Model<ISystemConfig>) ||
  mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);
