import mongoose, { Document, Schema } from 'mongoose';

export interface ICmsMedia extends Document {
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  categories: string[];
  status: 'in_use' | 'unused' | 'awaiting' | 'archived';
  uploadedBy?: string;
  usedIn?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CmsMediaSchema = new Schema<ICmsMedia>(
  {
    filename: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
    sizeBytes: { type: Number, default: 0 },
    width: { type: Number },
    height: { type: Number },
    categories: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['in_use', 'unused', 'awaiting', 'archived'],
      default: 'unused',
    },
    uploadedBy: { type: String },
    usedIn: { type: String, default: '—' },
  },
  { timestamps: true },
);

export const CmsMedia =
  mongoose.models.CmsMedia || mongoose.model<ICmsMedia>('CmsMedia', CmsMediaSchema);
