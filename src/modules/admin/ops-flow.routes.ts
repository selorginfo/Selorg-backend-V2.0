import { Router, Request, Response, NextFunction } from 'express';
import * as ops from './ops-flow.service';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

router.get(
  '/cod',
  asyncHandler(async (req, res) => {
    const data = await ops.getCodSummary(
      String(req.query.range || 'today'),
      req.query.from ? String(req.query.from) : undefined,
      req.query.to ? String(req.query.to) : undefined,
    );
    res.json({ success: true, data });
  }),
);

router.get(
  '/cod/transfers',
  asyncHandler(async (req, res) => {
    const data = await ops.getCodRiderTransfers(
      String(req.query.range || 'today'),
      req.query.from ? String(req.query.from) : undefined,
      req.query.to ? String(req.query.to) : undefined,
    );
    res.json({ success: true, data });
  }),
);

router.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const data = await ops.listReviews({
      rating: req.query.rating ? Number(req.query.rating) : undefined,
      from: req.query.from ? String(req.query.from) : undefined,
      to: req.query.to ? String(req.query.to) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 200,
    });
    res.json({ success: true, data });
  }),
);

router.get(
  '/order-progress',
  asyncHandler(async (req, res) => {
    const data = await ops.listOrderProgress({
      store: req.query.store ? String(req.query.store) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 100,
    });
    res.json({ success: true, data });
  }),
);

router.get(
  '/riders/:id',
  asyncHandler(async (req, res) => {
    const data = await ops.getRiderDetails(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: 'Rider not found' });
      return;
    }
    res.json({ success: true, data });
  }),
);

router.get(
  '/riders/:id/stats',
  asyncHandler(async (req, res) => {
    const data = await ops.getRiderStats(
      req.params.id,
      String(req.query.range || 'today'),
      req.query.from ? String(req.query.from) : undefined,
      req.query.to ? String(req.query.to) : undefined,
    );
    res.json({ success: true, data });
  }),
);

router.get(
  '/pickers/:id',
  asyncHandler(async (req, res) => {
    const data = await ops.getPickerDetails(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: 'Picker not found' });
      return;
    }
    res.json({ success: true, data });
  }),
);

router.get(
  '/pickers/:id/stats',
  asyncHandler(async (req, res) => {
    const data = await ops.getPickerStats(
      req.params.id,
      String(req.query.range || 'today'),
      req.query.from ? String(req.query.from) : undefined,
      req.query.to ? String(req.query.to) : undefined,
    );
    res.json({ success: true, data });
  }),
);

router.get(
  '/hsd-devices',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await ops.listHsdDevices() });
  }),
);

router.get(
  '/hsd-devices/:id/history',
  asyncHandler(async (req, res) => {
    const data = await ops.getHsdDeviceHistory(
      req.params.id,
      String(req.query.range || 'today'),
      req.query.from ? String(req.query.from) : undefined,
      req.query.to ? String(req.query.to) : undefined,
    );
    res.json({ success: true, data });
  }),
);

export default router;
