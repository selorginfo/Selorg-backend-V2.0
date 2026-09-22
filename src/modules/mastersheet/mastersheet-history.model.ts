import mongoose, { type Document, type InferSchemaType } from 'mongoose';

const sheetSummarySchema = new mongoose.Schema(
  {
    sheetKey: { type: String, required: true },
    label: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'processed', 'missing', 'error', 'skipped'],
      default: 'processed',
    },
    totalRows: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    errorMessage: { type: String, default: '' },
  },
  { _id: false },
);

/**
 * Audit log of mastersheet uploads. Does not store catalog data —
 * catalogs live in customer_* collections. Links to MastersheetVersion.
 */
const mastersheetHistorySchema = new mongoose.Schema(
  {
    versionId: { type: String, default: '', index: true },
    uploadedAt: { type: Date, default: () => new Date(), index: true },
    uploadedById: { type: String, default: '' },
    uploadedByName: { type: String, default: 'Admin' },
    uploadedByEmail: { type: String, default: '' },
    fileName: { type: String, default: 'mastersheet.xlsx' },
    /** active | failed | superseded | importing — mirrors version after finalize */
    status: {
      type: String,
      enum: ['importing', 'active', 'failed', 'superseded'],
      default: 'importing',
      index: true,
    },
    isActive: { type: Boolean, default: false, index: true },
    sheetsProcessed: { type: Number, default: 0 },
    totalCreated: { type: Number, default: 0 },
    totalUpdated: { type: Number, default: 0 },
    totalSkipped: { type: Number, default: 0 },
    totalErrors: { type: Number, default: 0 },
    totalRecords: { type: Number, default: 0 },
    failureReason: { type: String, default: '' },
    sheets: { type: [sheetSummarySchema], default: [] },
  },
  { timestamps: false, collection: 'mastersheet_upload_history' },
);

mastersheetHistorySchema.index({ uploadedAt: -1 });
mastersheetHistorySchema.index({ versionId: 1, uploadedAt: -1 });

export type MastersheetHistoryDoc = Document & InferSchemaType<typeof mastersheetHistorySchema>;
export const MastersheetHistory = mongoose.model<MastersheetHistoryDoc>('MastersheetHistory', mastersheetHistorySchema);
