import mongoose, { Document, Schema, Types } from 'mongoose';

// --- ComplianceDocument ------------------------------------------------------------------

export interface IComplianceDocument extends Document {
  name: string;
  type: 'certificate' | 'policy' | 'license' | 'audit' | 'report' | 'agreement';
  category: 'data-protection' | 'financial' | 'operational' | 'legal' | 'security' | 'tax';
  status: 'valid' | 'expiring-soon' | 'expired' | 'pending-renewal' | 'under-review';
  uploadedAt: Date;
  expiresAt: Date | null;
  fileSize: string;
  version: string;
  uploadedBy: string;
  description: string;
  tags: string[];
  acknowledged: boolean;
  acknowledgedBy: string[];
  fileUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ComplianceDocumentSchema = new Schema<IComplianceDocument>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['certificate', 'policy', 'license', 'audit', 'report', 'agreement'], default: 'policy' },
    category: { type: String, enum: ['data-protection', 'financial', 'operational', 'legal', 'security', 'tax'], default: 'legal' },
    status: { type: String, enum: ['valid', 'expiring-soon', 'expired', 'pending-renewal', 'under-review'], default: 'valid' },
    uploadedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    fileSize: { type: String, default: '0 KB' },
    version: { type: String, default: '1.0' },
    uploadedBy: { type: String, required: true },
    description: { type: String, default: '' },
    tags: [{ type: String }],
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: [{ type: String }],
    fileUrl: { type: String },
  },
  { timestamps: true, collection: 'admin_compliance_documents' },
);

ComplianceDocumentSchema.index({ type: 1, category: 1 });
ComplianceDocumentSchema.index({ status: 1 });
ComplianceDocumentSchema.index({ expiresAt: 1 });

ComplianceDocumentSchema.pre('save', function (next) {
  if (this.expiresAt) {
    const daysLeft = Math.ceil((this.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) this.status = 'expired';
    else if (daysLeft <= 30) this.status = 'expiring-soon';
  }
  next();
});

export const ComplianceDocument =
  (mongoose.models.ComplianceDocument as mongoose.Model<IComplianceDocument>) ||
  mongoose.model<IComplianceDocument>('ComplianceDocument', ComplianceDocumentSchema);

// --- ComplianceCertification --------------------------------------------------------------

export interface IComplianceCertification extends Document {
  name: string;
  issuer: string;
  certNumber: string;
  type: 'ISO' | 'PCI-DSS' | 'SOC2' | 'GDPR' | 'HIPAA' | 'Other';
  status: 'active' | 'expiring-soon' | 'expired' | 'pending';
  issuedDate: Date;
  expiryDate: Date;
  scope: string;
  auditedBy: string;
  nextAudit?: Date;
  score?: number;
  attachments: number;
  createdAt: Date;
  updatedAt: Date;
}

const ComplianceCertificationSchema = new Schema<IComplianceCertification>(
  {
    name: { type: String, required: true },
    issuer: { type: String, required: true },
    certNumber: { type: String, required: true },
    type: { type: String, enum: ['ISO', 'PCI-DSS', 'SOC2', 'GDPR', 'HIPAA', 'Other'], default: 'Other' },
    status: { type: String, enum: ['active', 'expiring-soon', 'expired', 'pending'], default: 'active' },
    issuedDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    scope: { type: String, default: '' },
    auditedBy: { type: String, default: '' },
    nextAudit: { type: Date },
    score: { type: Number },
    attachments: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'admin_compliance_certifications' },
);

ComplianceCertificationSchema.index({ status: 1 });
ComplianceCertificationSchema.index({ expiryDate: 1 });

ComplianceCertificationSchema.pre('save', function (next) {
  if (this.expiryDate) {
    const daysLeft = Math.ceil((this.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) this.status = 'expired';
    else if (daysLeft <= 60) this.status = 'expiring-soon';
  }
  next();
});

export const ComplianceCertification =
  (mongoose.models.ComplianceCertification as mongoose.Model<IComplianceCertification>) ||
  mongoose.model<IComplianceCertification>('ComplianceCertification', ComplianceCertificationSchema);

// --- ComplianceAudit ------------------------------------------------------------------------

export interface IComplianceFinding extends Document {
  severity: 'critical' | 'major' | 'minor' | 'observation';
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'accepted-risk';
  assignedTo: string;
  dueDate?: Date;
}

const ComplianceFindingSchema = new Schema<IComplianceFinding>(
  {
    severity: { type: String, enum: ['critical', 'major', 'minor', 'observation'], default: 'minor' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['open', 'in-progress', 'resolved', 'accepted-risk'], default: 'open' },
    assignedTo: { type: String, default: '' },
    dueDate: { type: Date },
  },
  { _id: true },
);

export interface IComplianceAudit extends Document {
  name: string;
  type: 'internal' | 'external' | 'regulatory' | 'third-party';
  status: 'scheduled' | 'in-progress' | 'completed' | 'failed';
  scheduledDate: Date;
  completedDate?: Date;
  auditor: string;
  auditorOrg: string;
  scope: string[];
  findings: Types.DocumentArray<IComplianceFinding>;
  overallScore?: number;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  createdAt: Date;
  updatedAt: Date;
}

const ComplianceAuditSchema = new Schema<IComplianceAudit>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['internal', 'external', 'regulatory', 'third-party'], default: 'internal' },
    status: { type: String, enum: ['scheduled', 'in-progress', 'completed', 'failed'], default: 'scheduled' },
    scheduledDate: { type: Date, required: true },
    completedDate: { type: Date },
    auditor: { type: String, required: true },
    auditorOrg: { type: String, default: '' },
    scope: [{ type: String }],
    findings: [ComplianceFindingSchema],
    overallScore: { type: Number },
    criticalIssues: { type: Number, default: 0 },
    majorIssues: { type: Number, default: 0 },
    minorIssues: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'admin_compliance_audits' },
);

ComplianceAuditSchema.index({ status: 1 });
ComplianceAuditSchema.index({ scheduledDate: 1 });

export const ComplianceAudit =
  (mongoose.models.ComplianceAudit as mongoose.Model<IComplianceAudit>) ||
  mongoose.model<IComplianceAudit>('ComplianceAudit', ComplianceAuditSchema);

// --- CompliancePolicy -----------------------------------------------------------------------

export interface ICompliancePolicy extends Document {
  name: string;
  category: 'privacy' | 'security' | 'hr' | 'operational' | 'financial' | 'legal';
  version: string;
  status: 'active' | 'draft' | 'under-review' | 'archived';
  effectiveDate: Date;
  reviewDate?: Date;
  owner: string;
  approvedBy: string;
  description: string;
  requiresAcknowledgment: boolean;
  totalEmployees: number;
  acknowledgedEmployees: number;
  acknowledgedBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CompliancePolicySchema = new Schema<ICompliancePolicy>(
  {
    name: { type: String, required: true },
    category: { type: String, enum: ['privacy', 'security', 'hr', 'operational', 'financial', 'legal'], default: 'legal' },
    version: { type: String, default: '1.0' },
    status: { type: String, enum: ['active', 'draft', 'under-review', 'archived'], default: 'active' },
    effectiveDate: { type: Date, required: true },
    reviewDate: { type: Date },
    owner: { type: String, default: '' },
    approvedBy: { type: String, default: '' },
    description: { type: String, default: '' },
    requiresAcknowledgment: { type: Boolean, default: false },
    totalEmployees: { type: Number, default: 0 },
    acknowledgedEmployees: { type: Number, default: 0 },
    acknowledgedBy: [{ type: String }],
  },
  { timestamps: true, collection: 'admin_compliance_policies' },
);

CompliancePolicySchema.index({ status: 1 });
CompliancePolicySchema.index({ category: 1 });

export const CompliancePolicy =
  (mongoose.models.CompliancePolicy as mongoose.Model<ICompliancePolicy>) ||
  mongoose.model<ICompliancePolicy>('CompliancePolicy', CompliancePolicySchema);

// --- ComplianceViolation --------------------------------------------------------------------

export interface IComplianceViolation extends Document {
  type: 'expiry' | 'audit-failure' | 'policy-violation' | 'data-breach' | 'regulatory';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedArea: string;
  status: 'open' | 'investigating' | 'resolved';
  assignedTo: string;
  createdAt: Date;
  updatedAt: Date;
}

const ComplianceViolationSchema = new Schema<IComplianceViolation>(
  {
    type: { type: String, enum: ['expiry', 'audit-failure', 'policy-violation', 'data-breach', 'regulatory'], default: 'expiry' },
    severity: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    affectedArea: { type: String, default: '' },
    status: { type: String, enum: ['open', 'investigating', 'resolved'], default: 'open' },
    assignedTo: { type: String, default: '' },
  },
  { timestamps: true, collection: 'admin_compliance_violations' },
);

ComplianceViolationSchema.index({ status: 1 });
ComplianceViolationSchema.index({ severity: 1 });

export const ComplianceViolation =
  (mongoose.models.ComplianceViolation as mongoose.Model<IComplianceViolation>) ||
  mongoose.model<IComplianceViolation>('ComplianceViolation', ComplianceViolationSchema);
