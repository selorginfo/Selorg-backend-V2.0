import type { Request, Response, NextFunction } from 'express';
import * as service from './analytics.service';
import type { RangeQuery, ExportQuery, CustomReportInput } from './analytics.validation';

function rangeOf(req: Request): RangeQuery['range'] {
  return (req.query as unknown as RangeQuery).range;
}

export async function getRealtimeMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getRealtimeMetrics(rangeOf(req)) });
  } catch (err) {
    next(err);
  }
}

export async function getTimeSeriesData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getTimeSeriesData(rangeOf(req)) });
  } catch (err) {
    next(err);
  }
}

export async function getProductPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getProductPerformance(rangeOf(req)) });
  } catch (err) {
    next(err);
  }
}

export async function getCategoryAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getCategoryAnalytics(rangeOf(req)) });
  } catch (err) {
    next(err);
  }
}

export async function getRegionalPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getRegionalPerformance(rangeOf(req)) });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getCustomerMetrics(rangeOf(req)) });
  } catch (err) {
    next(err);
  }
}

export async function getOperationalMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getOperationalMetrics(rangeOf(req)) });
  } catch (err) {
    next(err);
  }
}

export async function getRevenueBreakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getRevenueBreakdown(rangeOf(req)) });
  } catch (err) {
    next(err);
  }
}

export async function getGrowthTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getGrowthTrends(rangeOf(req)) });
  } catch (err) {
    next(err);
  }
}

export async function getPeakHours(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getPeakHours(rangeOf(req)) });
  } catch (err) {
    next(err);
  }
}

export function getConversionFunnel(req: Request, res: Response): void {
  res.json({ success: true, data: service.getConversionFunnel() });
}

export async function getPaymentMethods(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getPaymentMethods(rangeOf(req)) });
  } catch (err) {
    next(err);
  }
}

export async function getOrdersByHour(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getOrdersByHour(rangeOf(req)) });
  } catch (err) {
    next(err);
  }
}

export function getRiderPerformance(req: Request, res: Response): void {
  res.json({ success: true, data: service.getRiderPerformance() });
}

export async function getInventoryHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getInventoryHealth() });
  } catch (err) {
    next(err);
  }
}

export async function getFinancialSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getFinancialSummary(rangeOf(req)) });
  } catch (err) {
    next(err);
  }
}

export async function createCustomReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await service.createCustomReport(req.body as CustomReportInput);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function exportReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { format = 'json', range, report = 'overview' } = req.query as unknown as ExportQuery;
    const data = await service.exportReportData({ format, range, report });

    if (format === 'csv') {
      const csv = service.toCsv(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${report}-${range || '30d'}.csv"`);
      res.send(csv);
      return;
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getPickerAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getPickerAnalytics() });
  } catch (err) {
    next(err);
  }
}

export async function getPickerDrilldown(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getPickerDrilldown(req.params.pickerId) });
  } catch (err) {
    next(err);
  }
}
