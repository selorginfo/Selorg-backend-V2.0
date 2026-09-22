import type { Request, Response, NextFunction } from 'express';
import * as service from './compliance.service';
import type { CreateAuditInput, UpdateFindingStatusInput } from './compliance.validation';

export async function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listDocuments() });
  } catch (err) {
    next(err);
  }
}

export async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body || {};
    const name = body.name || body.Name || 'Untitled Document';
    const type = body.type || body.Type || 'policy';
    const category = body.category || body.Category || 'legal';
    const description = body.description || body.Description || '';
    const uploadedBy = req.user?.email || req.user?.userId || 'admin@quickcommerce.com';

    const doc = await service.createDocument({ name, type, category, description }, uploadedBy, req.file);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

export async function updateDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const updated = await service.updateDocument(
      id,
      { name: body.name, type: body.type, category: body.category, description: body.description },
      req.file,
    );
    if (!updated) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const deleted = await service.deleteDocument(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }
    res.json({ success: true, data: deleted });
  } catch (err) {
    next(err);
  }
}

export async function listCertifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listCertifications() });
  } catch (err) {
    next(err);
  }
}

export async function listAudits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listAudits() });
  } catch (err) {
    next(err);
  }
}

export async function createAudit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await service.createAudit(req.body as CreateAuditInput);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateFindingStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { auditId, findingId } = req.params;
    const { status } = req.body as UpdateFindingStatusInput;
    const data = await service.updateFindingStatus(auditId, findingId, status);
    if (!data) {
      res.status(404).json({ success: false, error: 'Audit or finding not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listPolicies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listPolicies() });
  } catch (err) {
    next(err);
  }
}

export async function acknowledgePolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userEmail = req.user?.email || req.user?.userId || req.body?.userEmail || 'admin@quickcommerce.com';
    const data = await service.acknowledgePolicy(req.params.id, userEmail);
    if (!data) {
      res.status(404).json({ success: false, error: 'Policy not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listViolations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listViolations() });
  } catch (err) {
    next(err);
  }
}

export async function getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getMetrics() });
  } catch (err) {
    next(err);
  }
}

export async function generateReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const report = await service.generateReport();
    res.json({ success: true, data: report, url: null });
  } catch (err) {
    next(err);
  }
}
