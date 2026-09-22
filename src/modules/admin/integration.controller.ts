import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import * as integrationService from './integration.service';
import type { UpdateIntegrationInput, ToggleIntegrationInput, CreateWebhookInput, CreateApiKeyInput } from './integration.validation';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await integrationService.list()));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await integrationService.update(req.params.id, req.body as UpdateIntegrationInput)));
  } catch (err) {
    next(err);
  }
}

export async function toggle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.body as ToggleIntegrationInput;
    res.json(ResponseFormatter.success(await integrationService.toggle(req.params.id, status)));
  } catch (err) {
    next(err);
  }
}

export async function test(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await integrationService.test(req.params.id);
    res.json(ResponseFormatter.success(null, result.message));
  } catch (err) {
    next(err);
  }
}

export async function health(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const integrations = await integrationService.health();
    // Standard envelope: `data` is the array (apiClient unwrap). Keep `integrations`
    // for any older clients that read that key.
    res.json({
      ...ResponseFormatter.success(integrations),
      integrations,
    });
  } catch (err) {
    next(err);
  }
}

export async function listWebhooks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await integrationService.listWebhooks()));
  } catch (err) {
    next(err);
  }
}

export async function createWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(ResponseFormatter.success(await integrationService.createWebhook(req.body as CreateWebhookInput)));
  } catch (err) {
    next(err);
  }
}

export async function retryWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await integrationService.retryWebhook(req.params.webhookId);
    res.json(ResponseFormatter.success(null, result.message));
  } catch (err) {
    next(err);
  }
}

export async function listApiKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await integrationService.listApiKeys()));
  } catch (err) {
    next(err);
  }
}

export async function createApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await integrationService.createApiKey(req.body as CreateApiKeyInput);
    res.status(201).json({ success: true, data: result.data, plainKey: result.plainKey, message: result.message });
  } catch (err) {
    next(err);
  }
}

export async function revokeApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await integrationService.revokeApiKey(req.params.keyId);
    res.json(ResponseFormatter.success(null, result.message));
  } catch (err) {
    next(err);
  }
}

export async function listLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await integrationService.listLogs()));
  } catch (err) {
    next(err);
  }
}

export async function stats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(ResponseFormatter.success(await integrationService.stats()));
  } catch (err) {
    next(err);
  }
}
