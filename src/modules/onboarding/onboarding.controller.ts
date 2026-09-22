import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as onboardingService from './onboarding.service';
import type {
  CreateOnboardingPageInput,
  UpdateOnboardingPageInput,
  ReorderOnboardingPagesInput,
  UploadOnboardingImageInput,
} from './onboarding.validation';

// --- Customer-facing ---------------------------------------------------------

export async function getPages(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await onboardingService.getPages()));
  } catch (err) {
    next(err);
  }
}

export async function getPageByNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await onboardingService.getPageByNumber(Number(req.params.pageNumber))));
  } catch (err) {
    next(err);
  }
}

export async function completeOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await onboardingService.completeOnboarding(req.customer?._id)));
  } catch (err) {
    next(err);
  }
}

export async function getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ResponseFormatter.success(await onboardingService.getStatus(req.customer?._id)));
  } catch (err) {
    next(err);
  }
}

// --- Admin ---------------------------------------------------------------

export async function adminList(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await onboardingService.adminList() });
  } catch (err) {
    next(err);
  }
}

export async function adminCreate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = await onboardingService.adminCreate(req.body as CreateOnboardingPageInput);
    res.status(201).json({ success: true, data: page });
  } catch (err) {
    next(err);
  }
}

export async function adminUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = await onboardingService.adminUpdate(req.params.id, req.body as UpdateOnboardingPageInput);
    res.json({ success: true, data: page });
  } catch (err) {
    next(err);
  }
}

export async function adminRemove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await onboardingService.adminRemove(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}

export async function adminReorder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { order } = req.body as ReorderOnboardingPagesInput;
    res.json({ success: true, data: await onboardingService.adminReorder(order) });
  } catch (err) {
    next(err);
  }
}

export async function adminUploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { image } = req.body as UploadOnboardingImageInput;
    res.json({ success: true, data: await onboardingService.adminUploadImage(req.params.id, image) });
  } catch (err) {
    next(err);
  }
}
