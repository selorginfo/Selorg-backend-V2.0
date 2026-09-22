import mongoose, { type Document, type InferSchemaType } from 'mongoose';

/**
 * Persistent mastersheet upload job — parsed Excel rows survive backend restarts.
 * Linked 1:1 to MastersheetVersion.versionId.
 */
const mastersheetJobSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    versionId: { type: String, required: true, index: true },
    fileName: { type: String, default: 'mastersheet.xlsx' },
    /** Sheet name → array of row objects */
    sheets: { type: mongoose.Schema.Types.Mixed, required: true },
    /** Sheet name → header column names */
    headers: { type: mongoose.Schema.Types.Mixed, required: true },
    sheetOutcomes: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Soft-delete / sync work deferred until successful finalize */
    pendingCleanup: {
      touchedHeroBannerIds: { type: [String], default: [] },
      touchedSectionKeys: { type: [String], default: [] },
      touchedCategoryBannerIds: { type: [String], default: [] },
      needsHomeSync: { type: Boolean, default: false },
      needsBannerRevision: { type: Boolean, default: false },
      needsSubcatRevision: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ['ready', 'processing', 'finalized', 'failed', 'expired'],
      default: 'ready',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true, collection: 'mastersheet_jobs' },
);

mastersheetJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type MastersheetJobDoc = Document & InferSchemaType<typeof mastersheetJobSchema>;
export const MastersheetJob = mongoose.model<MastersheetJobDoc>('MastersheetJob', mastersheetJobSchema);
