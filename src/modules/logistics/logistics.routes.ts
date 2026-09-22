import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateAdmin, requireRole } from '../../middleware/auth.middleware';

// Controllers
import * as ordersCtrl from './logistics.controller';
import { estimate } from './logistics.estimate.controller';
import * as adminCtrl from './logistics.admin.controller';
import { ingestPorter } from './logistics.webhook.controller';

// Validation middleware
import {
  validateBody,
  validateQuery,
  validateParams,
  createOrderBodySchema,
  listOrdersQuerySchema,
  estimateBodySchema,
  patchProviderParamsSchema,
  patchProviderBodySchema,
  reorderProviderBodySchema,
  analyticsCostQuerySchema,
} from './logistics.validation';

const router = Router();

// ─── Webhook (public, rate-limited) ──────────────────────────────────────────

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

router.post('/webhooks/porter', webhookLimiter, ingestPorter);

// ─── Health (public) ──────────────────────────────────────────────────────────

router.get('/health', (_req, res) => {
  res.json({ success: true, module: 'logistics', status: 'ok', ts: new Date().toISOString() });
});

// ─── Authenticated operational routes ────────────────────────────────────────
// All ops routes require a valid admin JWT. Both admin and ops roles are accepted.

const ops = Router();
ops.use(authenticateAdmin);

// Orders
ops.get('/orders', validateQuery(listOrdersQuerySchema), ordersCtrl.listOrders);
ops.post('/orders', validateBody(createOrderBodySchema), ordersCtrl.createOrder);
ops.get('/orders/:id', ordersCtrl.getOrder);
ops.post('/orders/:id/cancel', ordersCtrl.cancelOrder);
ops.get('/orders/:id/tracking', ordersCtrl.getTracking);
ops.patch('/orders/:id/status', ordersCtrl.updateStatus);

// Estimate
ops.post('/estimate', validateBody(estimateBodySchema), estimate);

router.use(ops);

// ─── Admin-only routes ────────────────────────────────────────────────────────

const adminOnly = Router();
adminOnly.use(authenticateAdmin, requireRole('admin', 'super_admin'));

// Provider management
adminOnly.get('/admin/providers', adminCtrl.listProviders);
adminOnly.patch(
  '/admin/providers/:id',
  validateParams(patchProviderParamsSchema),
  validateBody(patchProviderBodySchema),
  adminCtrl.patchProvider,
);
adminOnly.post(
  '/admin/providers/:id/reorder',
  validateParams(patchProviderParamsSchema),
  validateBody(reorderProviderBodySchema),
  adminCtrl.reorderProvider,
);

// Analytics
adminOnly.get(
  '/admin/analytics/cost-per-route',
  validateQuery(analyticsCostQuerySchema),
  adminCtrl.costPerRoute,
);
adminOnly.get('/admin/analytics/sla-breaches', adminCtrl.slaBreaches);
adminOnly.get('/admin/analytics/kpis', adminCtrl.kpis);

router.use(adminOnly);

export default router;
