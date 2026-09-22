import mongoose, { type Document, type InferSchemaType } from 'mongoose';

const sheetResultSchema = new mongoose.Schema(
  {
    sheetKey: { type: String, required: true },
    label: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'processed', 'missing', 'error'],
      default: 'pending',
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
 * One mastersheet upload attempt. Only a successfully finalized version becomes
 * `active` (and previous actives become `superseded`). Failed/incomplete imports
 * stay `failed` / `importing` and do not bump HomeConfig.contentRevision.
 */
const mastersheetVersionSchema = new mongoose.Schema(
  {
    versionId: { type: String, required: true, unique: true, index: true },
    jobId: { type: String, default: '', index: true },
    status: {
      type: String,
      enum: ['importing', 'active', 'failed', 'superseded'],
      default: 'importing',
      index: true,
    },
    fileName: { type: String, default: 'mastersheet.xlsx' },
    sheetsFound: { type: [String], default: [] },
    sheetRowCounts: { type: mongoose.Schema.Types.Mixed, default: {} },
    sheets: { type: [sheetResultSchema], default: [] },
    uploadedById: { type: String, default: '' },
    uploadedByName: { type: String, default: 'Admin' },
    uploadedByEmail: { type: String, default: '' },
    failureReason: { type: String, default: '' },
    validationIssues: { type: [String], default: [] },
    activatedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    contentRevisionAfter: { type: Number, default: null },
    totalCreated: { type: Number, default: 0 },
    totalUpdated: { type: Number, default: 0 },
    totalSkipped: { type: Number, default: 0 },
    totalErrors: { type: Number, default: 0 },
    totalRecords: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'mastersheet_versions' },
);

mastersheetVersionSchema.index({ status: 1, createdAt: -1 });
mastersheetVersionSchema.index({ createdAt: -1 });

export type MastersheetVersionDoc = Document & InferSchemaType<typeof mastersheetVersionSchema>;
export const MastersheetVersion = mongoose.model<MastersheetVersionDoc>(
  'MastersheetVersion',
  mastersheetVersionSchema,
);
