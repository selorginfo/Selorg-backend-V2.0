import type { Request, Response, NextFunction } from 'express';
import * as service from './notification-campaign.service';
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateCampaignInput,
  UpdateCampaignStatusInput,
  CreateAutomationInput,
  UpdateAutomationInput,
  RetryFailedBatchInput,
} from './notification-campaign.validation';

export async function listTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listTemplates() });
  } catch (err) {
    next(err);
  }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await service.createTemplate(req.body as CreateTemplateInput);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await service.updateTemplate(req.params.id, req.body as UpdateTemplateInput);
    if (!data) {
      res.status(404).json({ success: false, message: 'Template not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const deleted = await service.deleteTemplate(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Template not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function listCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listCampaigns() });
  } catch (err) {
    next(err);
  }
}

export async function getCampaignById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await service.getCampaignById(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const createdBy = req.user?.email || req.user?.userId || 'admin';
    const data = await service.createCampaign(req.body as CreateCampaignInput, createdBy);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateCampaignStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.body as UpdateCampaignStatusInput;
    const updated = await service.updateCampaignStatus(req.params.id, status);
    if (!updated) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function listScheduled(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listScheduled() });
  } catch (err) {
    next(err);
  }
}

export async function listAutomation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listAutomation() });
  } catch (err) {
    next(err);
  }
}

export async function createAutomation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await service.createAutomation(req.body as CreateAutomationInput);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateAutomation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.updateAutomation(req.params.id, req.body as UpdateAutomationInput);
    if (!result) {
      res.status(404).json({ success: false, message: 'Automation rule not found' });
      return;
    }
    if (result.statusOnly) {
      res.json({ success: true });
      return;
    }
    res.json({ success: true, data: result.data });
  } catch (err) {
    next(err);
  }
}

export async function getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getAnalytics() });
  } catch (err) {
    next(err);
  }
}

export async function listHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, channel, campaignId } = req.query as Record<string, string | undefined>;
    res.json({ success: true, data: await service.listHistory({ status, channel, campaignId }) });
  } catch (err) {
    next(err);
  }
}

export async function retryHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.retryHistory(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function retryFailedBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as RetryFailedBatchInput;
    const limit = Math.min(Number(body.limit) || 20, 50);
    // Run in the background so a large failed-history table cannot hang the request.
    const job = service.retryFailedBatch({
      campaignId: body.campaignId || null,
      limit,
    });
    job.catch(() => undefined);
    const raced = await Promise.race([
      job,
      new Promise<{ queued: true }>((resolve) => setTimeout(() => resolve({ queued: true }), 3000)),
    ]);
    res.json({ success: true, data: raced });
  } catch (err) {
    next(err);
  }
}

export async function getChannels(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getChannels() });
  } catch (err) {
    next(err);
  }
}

export async function getTimeSeries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getTimeSeries() });
  } catch (err) {
    next(err);
  }
}
