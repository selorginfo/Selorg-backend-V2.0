import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import { AppError } from '../../utils/AppError';
import * as legalService from './legal.service';
import type {
  AcceptLegalInput,
  CreateLegalDocInput,
  UpdateLegalDocInput,
  UpdateLegalConfigInput,
} from './legal.validation';

// --- Customer-facing ---------------------------------------------------------

export async function getConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await legalService.getLoginLegalConfig()));
  } catch (err) {
    next(err);
  }
}

function versionFromQuery(req: Request): string | undefined {
  const q = req.query as Record<string, string | undefined>;
  return q.version || q.v;
}

export async function getTerms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await legalService.getTerms(versionFromQuery(req))));
  } catch (err) {
    next(err);
  }
}

export async function getPrivacy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await legalService.getPrivacy(versionFromQuery(req))));
  } catch (err) {
    next(err);
  }
}

export async function getLicense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await legalService.getLicense(versionFromQuery(req))));
  } catch (err) {
    next(err);
  }
}

export async function accept(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const result = await legalService.acceptLegal(req.customer._id, req.body as AcceptLegalInput);
    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

// --- Admin ---------------------------------------------------------------

export async function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { type } = req.query as { type?: 'terms' | 'privacy' | 'license' };
    res.status(200).json(ResponseFormatter.success(await legalService.listDocuments(type)));
  } catch (err) {
    next(err);
  }
}

export async function getDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await legalService.getDocument(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function createDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const doc = await legalService.createDocument(req.body as CreateLegalDocInput);
    res.status(201).json(ResponseFormatter.success(doc));
  } catch (err) {
    next(err);
  }
}

export async function updateDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const doc = await legalService.updateDocument(req.params.id, req.body as UpdateLegalDocInput);
    res.status(200).json(ResponseFormatter.success(doc));
  } catch (err) {
    next(err);
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await legalService.deleteDocument(req.params.id);
    res.status(200).json(ResponseFormatter.success(null, 'Document deleted'));
  } catch (err) {
    next(err);
  }
}

export async function setCurrentDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const doc = await legalService.setCurrentDocument(req.params.id);
    res.status(200).json(ResponseFormatter.success(doc));
  } catch (err) {
    next(err);
  }
}

export async function getAdminConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await legalService.getDefaultConfig()));
  } catch (err) {
    next(err);
  }
}

export async function updateAdminConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = await legalService.updateDefaultConfig(req.body as UpdateLegalConfigInput);
    res.status(200).json(ResponseFormatter.success(config));
  } catch (err) {
    next(err);
  }
}
