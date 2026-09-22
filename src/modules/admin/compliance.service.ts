import {
  ComplianceDocument,
  ComplianceCertification,
  ComplianceAudit,
  CompliancePolicy,
  ComplianceViolation,
} from './compliance.model';
import { uploadComplianceFile, deleteComplianceFile } from './compliance-upload.service';

// --- Documents -----------------------------------------------------------------------------

function toDoc(d: InstanceType<typeof ComplianceDocument>) {
  return {
    id: d._id.toString(),
    name: d.name,
    type: d.type,
    category: d.category,
    status: d.status,
    uploadedAt: d.uploadedAt,
    expiresAt: d.expiresAt || null,
    fileSize: d.fileSize,
    version: d.version,
    uploadedBy: d.uploadedBy,
    description: d.description || '',
    tags: d.tags || [],
    acknowledged: d.acknowledged || false,
    acknowledgedBy: d.acknowledgedBy || [],
    fileUrl: d.fileUrl || null,
    lastUpdated: d.updatedAt || d.uploadedAt,
  };
}

export async function listDocuments() {
  const docs = await ComplianceDocument.find().sort({ uploadedAt: -1 });
  return docs.map(toDoc);
}

export interface CreateDocumentPayload {
  name: string;
  type?: string;
  category?: string;
  description?: string;
}

export async function createDocument(payload: CreateDocumentPayload, uploadedBy: string, file?: Express.Multer.File) {
  let fileUrl: string | undefined;
  let fileSize = '0 KB';
  if (file) {
    const uploaded = await uploadComplianceFile(file);
    fileUrl = uploaded.url;
    fileSize = uploaded.size;
  }

  const doc = new ComplianceDocument({
    name: payload.name,
    type: payload.type || 'policy',
    category: payload.category || 'legal',
    description: payload.description || '',
    uploadedBy,
    fileUrl,
    fileSize,
  });
  await doc.save();
  return toDoc(doc);
}

export interface UpdateDocumentPayload {
  name?: string;
  type?: string;
  category?: string;
  description?: string;
}

export async function updateDocument(documentId: string, payload: UpdateDocumentPayload, file?: Express.Multer.File) {
  const doc = await ComplianceDocument.findById(documentId);
  if (!doc) return null;

  if (typeof payload.name === 'string') doc.name = payload.name;
  if (typeof payload.type === 'string') doc.type = payload.type as typeof doc.type;
  if (typeof payload.category === 'string') doc.category = payload.category as typeof doc.category;
  if (typeof payload.description === 'string') doc.description = payload.description;

  if (file) {
    const previousUrl = doc.fileUrl;
    const uploaded = await uploadComplianceFile(file);
    doc.fileUrl = uploaded.url;
    doc.fileSize = uploaded.size;
    if (previousUrl) deleteComplianceFile(previousUrl).catch(() => {});
  }

  await doc.save();
  return toDoc(doc);
}

export async function deleteDocument(documentId: string) {
  const doc = await ComplianceDocument.findByIdAndDelete(documentId);
  if (!doc) return null;
  if (doc.fileUrl) deleteComplianceFile(doc.fileUrl).catch(() => {});
  return toDoc(doc);
}

// --- Certifications --------------------------------------------------------------------------

function toCert(c: InstanceType<typeof ComplianceCertification>) {
  return {
    id: c._id.toString(),
    name: c.name,
    issuer: c.issuer,
    certNumber: c.certNumber,
    type: c.type,
    status: c.status,
    issuedDate: c.issuedDate,
    expiryDate: c.expiryDate,
    scope: c.scope || '',
    auditedBy: c.auditedBy || '',
    nextAudit: c.nextAudit || c.expiryDate,
    score: c.score,
    attachments: c.attachments ?? 0,
  };
}

export async function listCertifications() {
  const certs = await ComplianceCertification.find().sort({ expiryDate: 1 });
  return certs.map(toCert);
}

// --- Audits ------------------------------------------------------------------------------------

function toFinding(f: { _id?: unknown; severity: string; title: string; description?: string; status: string; assignedTo?: string; dueDate?: Date }) {
  return {
    id: String(f._id),
    severity: f.severity,
    title: f.title,
    description: f.description || '',
    status: f.status,
    assignedTo: f.assignedTo || '',
    dueDate: f.dueDate || new Date(),
  };
}

function toAudit(a: InstanceType<typeof ComplianceAudit>) {
  return {
    id: a._id.toString(),
    name: a.name,
    type: a.type,
    status: a.status,
    scheduledDate: a.scheduledDate,
    completedDate: a.completedDate,
    auditor: a.auditor,
    auditorOrg: a.auditorOrg || '',
    scope: a.scope || [],
    findings: (a.findings || []).map(toFinding),
    overallScore: a.overallScore,
    criticalIssues: a.criticalIssues ?? 0,
    majorIssues: a.majorIssues ?? 0,
    minorIssues: a.minorIssues ?? 0,
  };
}

export async function listAudits() {
  const audits = await ComplianceAudit.find().sort({ scheduledDate: -1 });
  return audits.map(toAudit);
}

export interface CreateAuditPayload {
  name: string;
  type?: string;
  auditor: string;
  auditorOrg?: string;
  scheduledDate?: string;
  scope?: string[];
}

export async function createAudit(payload: CreateAuditPayload) {
  const audit = new ComplianceAudit({
    name: payload.name,
    type: payload.type || 'internal',
    auditor: payload.auditor || '',
    auditorOrg: payload.auditorOrg || 'Internal Audit Team',
    scheduledDate: payload.scheduledDate ? new Date(payload.scheduledDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    scope: payload.scope || [],
  });
  await audit.save();
  return toAudit(audit);
}

export async function updateFindingStatus(auditId: string, findingId: string, status: string) {
  const audit = await ComplianceAudit.findById(auditId);
  if (!audit) return null;
  const finding = audit.findings.id(findingId);
  if (!finding) return null;
  finding.status = status as typeof finding.status;
  await audit.save();
  return toAudit(audit);
}

// --- Policies ------------------------------------------------------------------------------------

function toPolicy(p: InstanceType<typeof CompliancePolicy>) {
  const total = p.totalEmployees ?? 0;
  const ack = p.acknowledgedEmployees ?? p.acknowledgedBy?.length ?? 0;
  const rate = total > 0 ? Math.round((ack / total) * 100) : 0;
  return {
    id: p._id.toString(),
    name: p.name,
    category: p.category,
    version: p.version,
    status: p.status,
    effectiveDate: p.effectiveDate,
    reviewDate: p.reviewDate || p.effectiveDate,
    owner: p.owner || '',
    approvedBy: p.approvedBy || '',
    description: p.description || '',
    requiresAcknowledgment: p.requiresAcknowledgment || false,
    acknowledgmentRate: rate,
    totalEmployees: total,
    acknowledgedEmployees: ack,
  };
}

export async function listPolicies() {
  const policies = await CompliancePolicy.find().sort({ effectiveDate: -1 });
  return policies.map(toPolicy);
}

export async function acknowledgePolicy(policyId: string, userEmail: string) {
  const policy = await CompliancePolicy.findById(policyId);
  if (!policy) return null;
  const acked = policy.acknowledgedBy || [];
  if (!acked.includes(userEmail)) {
    acked.push(userEmail);
    policy.acknowledgedBy = acked;
    policy.acknowledgedEmployees = acked.length;
    await policy.save();
  }
  return toPolicy(policy);
}

// --- Violations ------------------------------------------------------------------------------------

function toViolation(v: InstanceType<typeof ComplianceViolation>) {
  return {
    id: v._id.toString(),
    type: v.type,
    severity: v.severity,
    title: v.title,
    description: v.description || '',
    affectedArea: v.affectedArea || '',
    timestamp: v.createdAt,
    status: v.status,
    assignedTo: v.assignedTo || '',
  };
}

export async function listViolations() {
  const violations = await ComplianceViolation.find({ status: { $ne: 'resolved' } }).sort({ createdAt: -1 });
  return violations.map(toViolation);
}

// --- Metrics ------------------------------------------------------------------------------------

export async function getMetrics() {
  const [docs, certs, audits, policies, violations] = await Promise.all([
    ComplianceDocument.find().lean(),
    ComplianceCertification.find().lean(),
    ComplianceAudit.find().lean(),
    CompliancePolicy.find().lean(),
    ComplianceViolation.find({ status: { $ne: 'resolved' } }).lean(),
  ]);

  const validDocs = docs.filter((d) => d.status === 'valid').length;
  const activeCerts = certs.filter((c) => c.status === 'active').length;
  const completedAudits = audits.filter((a) => a.status === 'completed').length;
  let openFindings = 0;
  let criticalFindings = 0;
  for (const a of audits) {
    for (const f of a.findings || []) {
      if (f.status !== 'resolved' && f.status !== 'accepted-risk') {
        openFindings++;
        if (f.severity === 'critical') criticalFindings++;
      }
    }
  }

  const policyAckRates = policies
    .filter((p) => p.requiresAcknowledgment)
    .map((p) => (p.totalEmployees > 0 ? (p.acknowledgedEmployees || 0) / p.totalEmployees : 1));
  const policyCompliance = policyAckRates.length
    ? Math.round((policyAckRates.reduce((a, b) => a + b, 0) / policyAckRates.length) * 100)
    : 100;

  const totalDocs = docs.length;
  const overallScore =
    totalDocs === 0
      ? 100
      : Math.round(
          ((validDocs / totalDocs) * 30 +
            (activeCerts / Math.max(certs.length, 1)) * 25 +
            (policyCompliance / 100) * 25 +
            (1 - Math.min(openFindings, 10) / 10) * 20) *
            0.95,
        );

  return {
    overallScore: Math.min(100, Math.max(0, overallScore)),
    totalDocuments: totalDocs,
    validDocuments: validDocs,
    expiringDocuments: docs.filter((d) => d.status === 'expiring-soon').length,
    expiredDocuments: docs.filter((d) => d.status === 'expired').length,
    activeCertifications: activeCerts,
    completedAudits,
    openFindings,
    criticalFindings,
    policyCompliance,
  };
}

export async function generateReport() {
  const [documents, certifications, audits, policies, violations, metrics] = await Promise.all([
    listDocuments(),
    listCertifications(),
    listAudits(),
    listPolicies(),
    listViolations(),
    getMetrics(),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    metrics,
    documents,
    certifications,
    audits,
    policies,
    violations,
  };
}
