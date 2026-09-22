import type { Request, Response, NextFunction } from 'express';
import { multiEstimate } from './logistics.estimate.service';
import type { MultiEstimateBody } from './logistics.estimate.service';

/**
 * POST /estimate
 * Returns fare estimates from all active providers (or a filtered subset).
 */
export async function estimate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await multiEstimate(req.body as MultiEstimateBody);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
