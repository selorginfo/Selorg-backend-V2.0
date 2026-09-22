import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { PERMISSIONS } from '../../config/permissions';
import * as controller from './analytics.controller';
import { rangeQuerySchema, exportQuerySchema, customReportSchema, pickerDrilldownQuerySchema } from './analytics.validation';

const router = Router();

/**
 * Every endpoint here is read-only (reports/aggregates, no state mutation — even the POST
 * `/custom-report` just runs a parameterized aggregation). Gated on the existing
 * `ANALYTICS_REPORTS_READ` permission (already declared in the permission registry for
 * darkstore/store_manager/finance/merch role defaults) rather than inventing a new one.
 */
router.use(requirePermission(PERMISSIONS.ANALYTICS_REPORTS_READ));

router.get('/realtime', validate(rangeQuerySchema, 'query'), controller.getRealtimeMetrics);
router.get('/timeseries', validate(rangeQuerySchema, 'query'), controller.getTimeSeriesData);
router.get('/products', validate(rangeQuerySchema, 'query'), controller.getProductPerformance);
router.get('/categories', validate(rangeQuerySchema, 'query'), controller.getCategoryAnalytics);
router.get('/regional', validate(rangeQuerySchema, 'query'), controller.getRegionalPerformance);
router.get('/customers', validate(rangeQuerySchema, 'query'), controller.getCustomerMetrics);
router.get('/operational', validate(rangeQuerySchema, 'query'), controller.getOperationalMetrics);
router.get('/revenue', validate(rangeQuerySchema, 'query'), controller.getRevenueBreakdown);
router.get('/growth', validate(rangeQuerySchema, 'query'), controller.getGrowthTrends);
router.get('/peak-hours', validate(rangeQuerySchema, 'query'), controller.getPeakHours);
router.get('/funnel', controller.getConversionFunnel);
router.get('/payment-methods', validate(rangeQuerySchema, 'query'), controller.getPaymentMethods);

router.get('/orders-by-hour', validate(rangeQuerySchema, 'query'), controller.getOrdersByHour);
router.get('/rider-performance', controller.getRiderPerformance);
router.get('/pickers', controller.getPickerAnalytics);
router.get('/picker-drilldown/:pickerId', validate(pickerDrilldownQuerySchema, 'query'), controller.getPickerDrilldown);
router.get('/inventory-health', controller.getInventoryHealth);
router.get('/financial-summary', validate(rangeQuerySchema, 'query'), controller.getFinancialSummary);

router.post('/custom-report', validate(customReportSchema), controller.createCustomReport);

router.get('/export', validate(exportQuerySchema, 'query'), controller.exportReport);

export default router;
