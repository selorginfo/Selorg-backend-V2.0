import { Router } from 'express';
import { authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import * as ctrl from './merch.controller';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, module: 'merch', status: 'ok', ts: new Date().toISOString() });
});

// All routes require admin JWT + merch/admin/super_admin role
const protected_ = Router();
protected_.use(authenticateAdmin, requireRole('merch', 'admin', 'super_admin'));

// ─── Overview / Campaigns ─────────────────────────────────────────────────────

protected_.get('/overview/stats', ctrl.getMerchStats);
protected_.get('/overview/performance-report', ctrl.getPerformanceReport);
protected_.get('/overview/conflicts', ctrl.getStockConflicts);
protected_.post('/overview/conflicts', ctrl.createStockConflict);
protected_.get('/overview/uplift', ctrl.getPromoUplift);
protected_.post('/overview/uplift', ctrl.createPromoUplift);
protected_.get('/overview/price-changes', ctrl.getPriceChanges);
protected_.post('/overview/price-changes', ctrl.createPriceChange);

protected_.get('/campaigns', ctrl.getCampaigns);
protected_.post('/campaigns', ctrl.createCampaign);
protected_.get('/campaigns/:id', ctrl.getCampaign);
protected_.put('/campaigns/:id', ctrl.updateCampaign);
protected_.delete('/campaigns/:id', ctrl.deleteCampaign);

// ─── Catalog ─────────────────────────────────────────────────────────────────

protected_.get('/catalog/skus', ctrl.getSKUs);
protected_.post('/catalog/skus', ctrl.createSKU);
protected_.patch('/catalog/skus/:id/visibility', ctrl.patchSKUVisibility);
protected_.put('/catalog/skus/:id', ctrl.updateSKU);
protected_.delete('/catalog/skus/:id', ctrl.deleteSKU);

protected_.get('/catalog/collections', ctrl.getCollections);
protected_.post('/catalog/collections', ctrl.createCollection);
protected_.put('/catalog/collections/:id', ctrl.updateCollection);
protected_.delete('/catalog/collections/:id', ctrl.deleteCollection);

// ─── Pricing ─────────────────────────────────────────────────────────────────

protected_.get('/pricing/stats', ctrl.getPricingStats);
protected_.get('/pricing/skus', ctrl.getSKUsForPricing);
protected_.patch('/pricing/skus/:id/price', ctrl.updateSKUPrice);
protected_.patch('/pricing/skus/bulk-price', ctrl.bulkUpdateSKUPrices);

protected_.get('/pricing/surge-rules', ctrl.getSurgeRules);
protected_.post('/pricing/surge-rules', ctrl.createSurgeRule);
protected_.put('/pricing/surge-rules/:id', ctrl.updateSurgeRule);
protected_.delete('/pricing/surge-rules/:id', ctrl.deleteSurgeRule);

protected_.get('/pricing/surge-config', ctrl.getSurgeConfig);
protected_.put('/pricing/surge-config', ctrl.updateSurgeConfig);

protected_.get('/pricing/pending-updates', ctrl.getPendingPriceUpdates);
protected_.post('/pricing/pending-updates/:id/handle', ctrl.handlePendingUpdate);

protected_.get('/pricing/price-rules', ctrl.getPriceRules);
protected_.post('/pricing/price-rules', ctrl.createPriceRule);

protected_.get('/pricing/discount-campaigns', ctrl.getDiscountCampaigns);
protected_.post('/pricing/discount-campaigns', ctrl.createDiscountCampaign);
protected_.put('/pricing/discount-campaigns/:id', ctrl.updateDiscountCampaign);
protected_.delete('/pricing/discount-campaigns/:id', ctrl.deleteDiscountCampaign);

protected_.get('/pricing/coupons', ctrl.getCoupons);
protected_.post('/pricing/coupons', ctrl.createCoupon);
protected_.post('/pricing/coupons/generate-code', ctrl.generateCouponCode);
protected_.put('/pricing/coupons/:id', ctrl.updateCoupon);
protected_.delete('/pricing/coupons/:id', ctrl.deleteCoupon);

protected_.get('/pricing/flash-sales', ctrl.getFlashSales);
protected_.post('/pricing/flash-sales', ctrl.createFlashSale);
protected_.put('/pricing/flash-sales/:id', ctrl.updateFlashSale);
protected_.delete('/pricing/flash-sales/:id', ctrl.deleteFlashSale);

protected_.get('/pricing/bundles', ctrl.getBundles);
protected_.post('/pricing/bundles', ctrl.createBundle);
protected_.put('/pricing/bundles/:id', ctrl.updateBundle);
protected_.delete('/pricing/bundles/:id', ctrl.deleteBundle);

// ─── Allocation ───────────────────────────────────────────────────────────────

protected_.get('/allocation', ctrl.getAllocations);
protected_.get('/allocation/references/locations', ctrl.getAllocationLocations);
protected_.get('/allocation/sku/:skuId/history', ctrl.getAllocationHistory);
protected_.get('/allocation/alerts', ctrl.getAllocationAlerts);
protected_.post('/allocation/alerts', ctrl.createAllocationAlert);
protected_.put('/allocation/alerts/:id', ctrl.updateAllocationAlertStatus);

// ─── Geofence ─────────────────────────────────────────────────────────────────

protected_.get('/geofence/zones', ctrl.getZones);
protected_.post('/geofence/zones', ctrl.createZone);
protected_.get('/geofence/zones/:id', ctrl.getZoneById);
protected_.put('/geofence/zones/:id', ctrl.updateZone);
protected_.patch('/geofence/zones/:id', ctrl.toggleZoneStatus);
protected_.delete('/geofence/zones/:id', ctrl.deleteZone);
protected_.get('/geofence/history', ctrl.getGeofenceHistory);
protected_.get('/geofence/overlaps', ctrl.getOverlaps);
protected_.get('/geofence/promo-heatmap', ctrl.getPromoHeatmap);
protected_.get('/geofence/stats', ctrl.getGeofenceStats);
protected_.get('/geofence/stores', ctrl.getGeofenceStores);
protected_.put('/geofence/stores/:id', ctrl.updateGeofenceStore);

// ─── Analytics ────────────────────────────────────────────────────────────────

protected_.get('/analytics/summary', ctrl.getAnalyticsSummary);
protected_.get('/analytics/campaign/:entityId', ctrl.getCampaignAnalytics);
protected_.post('/analytics/records', ctrl.createAnalyticsRecord);

// ─── Alerts ───────────────────────────────────────────────────────────────────

protected_.get('/alerts', ctrl.getAlerts);
protected_.put('/alerts/bulk-update', ctrl.bulkUpdateAlerts);
protected_.post('/alerts/clear-resolved', ctrl.clearResolvedAlerts);
protected_.put('/alerts/:id', ctrl.updateAlert);

// ─── Compliance ───────────────────────────────────────────────────────────────

protected_.get('/compliance/summary', ctrl.getComplianceSummary);
protected_.get('/compliance/approvals', ctrl.getApprovals);
protected_.post('/compliance/approvals/bulk', ctrl.bulkUpdateApprovals);
protected_.put('/compliance/approvals/:id', ctrl.updateApprovalStatus);
protected_.get('/compliance/audits', ctrl.getAudits);

// ─── Citywide Operations ─────────────────────────────────────────────────────

protected_.get('/citywide/live-metrics', ctrl.getLiveMetrics);
protected_.get('/citywide/zones', ctrl.getCitywideZones);
protected_.get('/citywide/zones/:id', ctrl.getZoneDetail);
protected_.get('/citywide/zones/:id/trend', ctrl.getZoneOrderTrend);
protected_.post('/citywide/zones/:id/request-riders', ctrl.requestZoneRiders);
protected_.get('/citywide/incidents', ctrl.getIncidents);
protected_.get('/citywide/incidents/:id', ctrl.getIncidentById);
protected_.patch('/citywide/incidents/:id', ctrl.updateIncident);
protected_.get('/citywide/exceptions', ctrl.getExceptions);
protected_.post('/citywide/exceptions/:id/resolve', ctrl.resolveException);
protected_.get('/citywide/integration-health', ctrl.getIntegrationHealth);
protected_.get('/citywide/surge', ctrl.getSurge);
protected_.put('/citywide/surge', ctrl.updateSurge);
protected_.delete('/citywide/surge', ctrl.endSurge);
protected_.post('/citywide/surge/actions', ctrl.executeSurgeAction);
protected_.get('/citywide/dispatch', ctrl.getDispatch);
protected_.patch('/citywide/dispatch', ctrl.updateDispatch);
protected_.post('/citywide/dispatch/restart', ctrl.restartDispatch);
protected_.post('/citywide/dispatch/manual-override', ctrl.manualOverrideDispatch);
protected_.get('/citywide/dispatch/logs', ctrl.getDispatchLogs);
protected_.get('/citywide/sla', ctrl.getSla);

router.use(protected_);

export default router;
