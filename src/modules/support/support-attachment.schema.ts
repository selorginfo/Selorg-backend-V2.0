import { Schema } from 'mongoose';

/** Shared attachment subdocument for support tickets and messages. */
export const supportAttachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
    sizeBytes: { type: Number, default: 0 },
  },
  { _id: false },
);

export interface SupportAttachment {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}
