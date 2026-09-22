import mongoose, { Document, Schema } from 'mongoose';

export type LegalDocType = 'terms' | 'privacy' | 'license';
export type LegalAppTarget = 'customer' | 'picker' | 'rider' | 'hhd';

export interface ILegalDocument extends Document {
  type: LegalDocType;
  version: string;
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  contentFormat: 'plain' | 'html' | 'markdown';
  content: string;
  isCurrent: boolean;
  appTarget: LegalAppTarget;
  createdAt: Date;
  updatedAt: Date;
}

const legalDocumentSchema = new Schema<ILegalDocument>(
  {
    type: { type: String, required: true, enum: ['terms', 'privacy', 'license'] },
    version: { type: String, required: true },
    title: { type: String, required: true },
    effectiveDate: { type: String, required: true },
    lastUpdated: { type: String, required: true },
    contentFormat: { type: String, enum: ['plain', 'html', 'markdown'], default: 'plain' },
    content: { type: String, required: true },
    isCurrent: { type: Boolean, default: true },
    appTarget: { type: String, enum: ['customer', 'picker', 'rider', 'hhd'], default: 'customer' },
  },
  { timestamps: true },
);
legalDocumentSchema.index({ type: 1, isCurrent: 1 });
legalDocumentSchema.index({ type: 1, version: 1, appTarget: 1 }, { unique: true });

export const LegalDocument =
  (mongoose.models.CustomerLegalDocument as mongoose.Model<ILegalDocument>) ||
  mongoose.model<ILegalDocument>('CustomerLegalDocument', legalDocumentSchema, 'customer_legal_documents');

export interface ILegalConfig extends Document {
  key: string;
  loginLegal: {
    preamble: string;
    terms: { label: string; type: 'in_app' | 'url'; url: string | null };
    privacy: { label: string; type: 'in_app' | 'url'; url: string | null };
    connector: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const legalConfigSchema = new Schema<ILegalConfig>(
  {
    key: { type: String, required: true, unique: true },
    loginLegal: {
      preamble: { type: String, default: 'By continuing, you agree to our ' },
      terms: {
        label: { type: String, default: 'Terms of Service' },
        type: { type: String, enum: ['in_app', 'url'], default: 'in_app' },
        url: { type: String, default: null },
      },
      privacy: {
        label: { type: String, default: 'Privacy Policy' },
        type: { type: String, enum: ['in_app', 'url'], default: 'in_app' },
        url: { type: String, default: null },
      },
      connector: { type: String, default: ' and ' },
    },
  },
  { timestamps: true },
);

export const LegalConfig =
  (mongoose.models.CustomerLegalConfig as mongoose.Model<ILegalConfig>) ||
  mongoose.model<ILegalConfig>('CustomerLegalConfig', legalConfigSchema, 'customer_legal_config');
