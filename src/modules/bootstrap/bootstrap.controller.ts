import { Request, Response, NextFunction } from 'express';
import { getBootstrapPayload } from './bootstrap.service';

export async function getBootstrap(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.customer?._id ?? req.user?.userId;
    const data = await getBootstrapPayload(userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
