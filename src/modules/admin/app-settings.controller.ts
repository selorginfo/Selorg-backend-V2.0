import type { Request, Response, NextFunction } from 'express';
import * as appSettingsService from './app-settings.service';

export async function getAppSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { settings, lastUpdated } = await appSettingsService.getAppSettings();
    res.status(200).json({ success: true, settings, lastUpdated });
  } catch (err) {
    next(err);
  }
}

export async function updateAppSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { settings: incoming } = req.body || {};
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ success: false, error: 'Settings object is required' });
      return;
    }
    const updatedBy = req.user?.userId || req.user?.email || 'admin';
    const { settings, lastUpdated } = await appSettingsService.updateAppSettings(incoming, updatedBy);
    res.status(200).json({ success: true, settings, lastUpdated, message: 'Settings updated successfully' });
  } catch (err) {
    next(err);
  }
}
