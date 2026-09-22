import type { PipelineStage } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { Order } from '../orders/order.model';
import { Product } from '../products/products.model';

type Range = '24h' | '7d' | '30d' | '90d';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

function getDateRange(range?: string): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  switch (range) {
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    default:
      start.setHours(start.getHours() - 24);
  }
  return { start, end: now };
}

export async function getRealtimeMetrics(range?: Range) {
  const { start, end } = getDateRange(range);
  const prevEnd = new Date(start);
  const prevStart = new Date(prevEnd.getTime() - (end.getTime() - start.getTime()));

  const [currentAgg, prevAgg, uniqueUsers] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalBill' }, totalOrders: { $sum: 1 } } },
      { $project: { _id: 0, totalRevenue: 1, totalOrders: 1 } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: prevStart, $lt: prevEnd }, status: { $nin: ['cancelled'] } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalBill' }, totalOrders: { $sum: 1 } } },
      { $project: { _id: 0, totalRevenue: 1, totalOrders: 1 } },
    ]),
    Order.distinct('userId', { createdAt: { $gte: start, $lte: end } }),
  ]);

  const curr = currentAgg[0] || { totalRevenue: 0, totalOrders: 0 };
  const prev = prevAgg[0] || { totalRevenue: 0, totalOrders: 0 };

  const revenueGrowth = prev.totalRevenue > 0 ? Math.round(((curr.totalRevenue - prev.totalRevenue) / prev.totalRevenue) * 1000) / 10 : 0;
  const ordersGrowth = prev.totalOrders > 0 ? Math.round(((curr.totalOrders - prev.totalOrders) / prev.totalOrders) * 1000) / 10 : 0;
  const aov = curr.totalOrders > 0 ? Math.round(curr.totalRevenue / curr.totalOrders) : 0;

  return {
    totalRevenue: curr.totalRevenue,
    totalOrders: curr.totalOrders,
    activeUsers: uniqueUsers.length,
    conversionRate: 0,
    averageOrderValue: aov,
    revenueGrowth,
    ordersGrowth,
    usersGrowth: 0,
  };
}

export async function getTimeSeriesData(range?: Range) {
  const { start, end } = getDateRange(range);
  const groupBy =
    range === '24h' || !range
      ? { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' }, hour: { $hour: '$createdAt' } }
      : { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };

  const pipeline: PipelineStage[] = [
    { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } } },
    { $group: { _id: groupBy, revenue: { $sum: '$totalBill' }, orders: { $sum: 1 }, users: { $addToSet: '$userId' } } },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
    {
      $project: {
        timestamp: {
          $dateFromParts: { year: '$_id.year', month: '$_id.month', day: '$_id.day', hour: range === '24h' || !range ? '$_id.hour' : 0 },
        },
        revenue: 1,
        orders: 1,
        users: { $size: '$users' },
      },
    },
    {
      $project: {
        timestamp: { $dateToString: { date: '$timestamp', format: '%Y-%m-%dT%H:%M:%S.000Z' } },
        revenue: 1,
        orders: 1,
        users: 1,
        conversionRate: { $literal: 0 },
      },
    },
  ];

  const result = await Order.aggregate(pipeline);
  return result.map((r) => ({ timestamp: r.timestamp, revenue: r.revenue, orders: r.orders, users: r.users, conversionRate: r.conversionRate }));
}

export async function getProductPerformance(range?: Range) {
  const { start, end } = getDateRange(range || '30d');
  const pipeline: PipelineStage[] = [
    { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.productId', totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }, unitsSold: { $sum: '$items.quantity' } } },
    { $lookup: { from: 'customer_products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        id: { $toString: '$_id' },
        name: { $ifNull: ['$product.name', 'Unknown'] },
        sku: { $ifNull: ['$product.sku', ''] },
        category: { $ifNull: ['$product.brand', 'Uncategorized'] },
        totalRevenue: 1,
        unitsSold: 1,
        averagePrice: { $cond: [{ $gt: ['$unitsSold', 0] }, { $round: [{ $divide: ['$totalRevenue', '$unitsSold'] }, 0] }, 0] },
        stockLevel: { $ifNull: ['$product.stockQuantity', 0] },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 20 },
    { $addFields: { growthRate: 0 } },
  ];

  const result = await Order.aggregate(pipeline);
  return result.map((r) => ({
    id: r.id, name: r.name, sku: r.sku, category: r.category, totalRevenue: r.totalRevenue,
    unitsSold: r.unitsSold, averagePrice: r.averagePrice, growthRate: r.growthRate, stockLevel: r.stockLevel,
  }));
}

export async function getCategoryAnalytics(range?: Range) {
  const { start, end } = getDateRange(range || '30d');
  const pipeline: PipelineStage[] = [
    { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } } },
    { $unwind: '$items' },
    { $lookup: { from: 'customer_products', localField: 'items.productId', foreignField: '_id', as: 'prod' } },
    { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'customer_categories', localField: 'prod.categoryId', foreignField: '_id', as: 'cat' } },
    { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
    { $group: { _id: { $ifNull: ['$cat.name', 'Uncategorized'] }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }, orders: { $sum: 1 } } },
    { $sort: { revenue: -1 } },
  ];

  const result = await Order.aggregate(pipeline);
  const totalRev = result.reduce((s, r) => s + r.revenue, 0);
  return result.map((r) => ({
    category: r._id || 'Uncategorized',
    revenue: r.revenue,
    orders: r.orders,
    averageOrderValue: r.orders > 0 ? Math.round(r.revenue / r.orders) : 0,
    percentageOfTotal: totalRev > 0 ? Math.round((r.revenue / totalRev) * 1000) / 10 : 0,
    growthRate: 0,
  }));
}

export async function getRegionalPerformance(range?: Range) {
  const { start, end } = getDateRange(range || '30d');
  const pipeline: PipelineStage[] = [
    { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } } },
    { $group: { _id: { $ifNull: ['$deliveryAddress.city', 'Unknown'] }, revenue: { $sum: '$totalBill' }, orders: { $sum: 1 }, users: { $addToSet: '$userId' } } },
    { $project: { city: '$_id', revenue: 1, orders: 1, activeUsers: { $size: '$users' } } },
    { $sort: { revenue: -1 } },
    { $limit: 20 },
  ];

  const result = await Order.aggregate(pipeline);
  return result.map((r) => ({ region: r.city, city: r.city, revenue: r.revenue, orders: r.orders, activeUsers: r.activeUsers, averageDeliveryTime: 0, customerSatisfaction: 0 }));
}

export async function getCustomerMetrics(range?: Range) {
  const { start, end } = getDateRange(range || '30d');
  const pipeline: PipelineStage[] = [
    { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } } },
    { $group: { _id: null, totalCustomers: { $addToSet: '$userId' }, totalRevenue: { $sum: '$totalBill' }, totalOrders: { $sum: 1 } } },
  ];

  const [agg] = await Promise.all([Order.aggregate(pipeline)]);
  const totalCustomers = agg[0] ? agg[0].totalCustomers.length : 0;
  const totalRevenue = agg[0]?.totalRevenue || 0;

  return {
    totalCustomers,
    newCustomers: totalCustomers,
    returningCustomers: 0,
    customerRetentionRate: 0,
    averageLifetimeValue: totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0,
    customerAcquisitionCost: 0,
    churnRate: 0,
  };
}

export async function getOperationalMetrics(range?: Range) {
  const { start, end } = getDateRange(range || '30d');
  const [total, delivered, cancelled] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Order.countDocuments({ createdAt: { $gte: start, $lte: end }, status: 'delivered' }),
    Order.countDocuments({ createdAt: { $gte: start, $lte: end }, status: 'cancelled' }),
  ]);

  return {
    averageDeliveryTime: 0,
    onTimeDeliveryRate: 0,
    cancellationRate: total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0,
    refundRate: 0,
    averageRating: 0,
    orderFulfillmentRate: total > 0 ? Math.round((delivered / total) * 1000) / 10 : 0,
  };
}

export async function getRevenueBreakdown(range?: Range) {
  const { start, end } = getDateRange(range || '30d');
  const pipeline: PipelineStage[] = [
    { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } } },
    { $unwind: '$items' },
    { $lookup: { from: 'customer_products', localField: 'items.productId', foreignField: '_id', as: 'prod' } },
    { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'customer_categories', localField: 'prod.categoryId', foreignField: '_id', as: 'cat' } },
    { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
    { $group: { _id: { $ifNull: ['$cat.name', 'Uncategorized'] }, value: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
    { $sort: { value: -1 } },
  ];

  const result = await Order.aggregate(pipeline);
  const total = result.reduce((s, r) => s + r.value, 0);
  return result.map((r, i) => ({
    category: r._id || 'Uncategorized',
    value: r.value,
    percentage: total > 0 ? Math.round((r.value / total) * 1000) / 10 : 0,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
}

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function getGrowthTrends(range?: Range) {
  const { start, end } = getDateRange(range || '90d');
  const pipeline: PipelineStage[] = [
    { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$totalBill' }, orders: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ];

  const result = await Order.aggregate(pipeline);
  return result.map((r, i) => {
    const prev = result[i - 1];
    const revGrowth = prev && prev.revenue > 0 ? Math.round(((r.revenue - prev.revenue) / prev.revenue) * 1000) / 10 : 0;
    const ordGrowth = prev && prev.orders > 0 ? Math.round(((r.orders - prev.orders) / prev.orders) * 1000) / 10 : 0;
    return { period: `${MONTH_NAMES[r._id.month]} ${r._id.year}`, revenue: r.revenue, orders: r.orders, revenueGrowth: revGrowth, ordersGrowth: ordGrowth };
  });
}

function hourLabels(): string[] {
  return Array.from({ length: 24 }, (_, i) => `${i % 12 || 12} ${i < 12 ? 'AM' : 'PM'}`);
}

async function peakHoursLogic(range?: Range) {
  const { start, end } = getDateRange(range || '7d');
  const pipeline: PipelineStage[] = [
    { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } } },
    { $group: { _id: { $hour: '$createdAt' }, orders: { $sum: 1 }, revenue: { $sum: '$totalBill' } } },
    { $sort: { _id: 1 } },
  ];
  const result = await Order.aggregate(pipeline);
  const labels = hourLabels();
  const byHour = new Map<number, { hour: string; orders: number; revenue: number }>();
  for (const r of result) byHour.set(r._id, { hour: labels[r._id], orders: r.orders, revenue: r.revenue });
  return Array.from({ length: 24 }, (_, i) => byHour.get(i) || { hour: labels[i], orders: 0, revenue: 0 });
}

export async function getPeakHours(range?: Range) {
  return peakHoursLogic(range || '7d');
}

export function getConversionFunnel() {
  return [];
}

export async function getPaymentMethods(range?: Range) {
  const { start, end } = getDateRange(range || '30d');
  const pipeline: PipelineStage[] = [
    { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } } },
    { $group: { _id: { $ifNull: ['$paymentMethod.methodType', 'cash'] }, transactions: { $sum: 1 }, revenue: { $sum: '$totalBill' } } },
    { $sort: { revenue: -1 } },
  ];

  const result = await Order.aggregate(pipeline);
  const totalRev = result.reduce((s, r) => s + r.revenue, 0);
  const methodLabels: Record<string, string> = { upi: 'UPI', card: 'Credit/Debit Card', cash: 'Cash on Delivery' };
  return result.map((r) => ({
    method: methodLabels[r._id] || r._id,
    transactions: r.transactions,
    revenue: r.revenue,
    percentage: totalRev > 0 ? Math.round((r.revenue / totalRev) * 1000) / 10 : 0,
  }));
}

export async function getOrdersByHour(range?: Range) {
  return peakHoursLogic(range || '7d');
}

/** Legacy stub — no rider data available to this admin surface (rider_v2 sub-app not ported). */
export function getRiderPerformance() {
  return [];
}

export async function getInventoryHealth() {
  const products = await Product.find({ isActive: true }).select('name sku stockQuantity lowStockThreshold categoryId').limit(100).lean();
  return products.map((p) => ({
    sku: p.sku || p._id.toString(),
    name: p.name,
    stockLevel: p.stockQuantity || 0,
    lowStockThreshold: p.lowStockThreshold || 10,
    status: (p.stockQuantity || 0) <= (p.lowStockThreshold || 10) ? 'low' : 'ok',
  }));
}

export async function getFinancialSummary(range?: Range) {
  const { start, end } = getDateRange(range || '30d');
  const agg = await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } } },
    { $group: { _id: null, totalRevenue: { $sum: '$totalBill' }, totalOrders: { $sum: 1 }, totalDiscount: { $sum: '$discount' }, totalDeliveryFee: { $sum: '$deliveryFee' } } },
  ]);

  const r = agg[0] || {};
  const aov = r.totalOrders > 0 ? Math.round(r.totalRevenue / r.totalOrders) : 0;
  return {
    totalRevenue: r.totalRevenue || 0,
    totalOrders: r.totalOrders || 0,
    totalDiscount: r.totalDiscount || 0,
    totalDeliveryFee: r.totalDeliveryFee || 0,
    averageOrderValue: aov,
  };
}

export interface CustomReportPayload {
  dimensions?: string[];
  metrics?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export async function createCustomReport(payload: CustomReportPayload) {
  const { dimensions = [], metrics = [], dateFrom, dateTo } = payload;
  const start = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = dateTo ? new Date(dateTo) : new Date();

  const matchStage = { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } };

  const groupId: Record<string, unknown> = {};
  if (dimensions.includes('hour')) groupId.hour = { $hour: '$createdAt' };
  if (dimensions.includes('day')) groupId.day = { $dayOfMonth: '$createdAt' };
  if (dimensions.includes('month')) groupId.month = { $month: '$createdAt' };
  if (dimensions.includes('year')) groupId.year = { $year: '$createdAt' };
  if (dimensions.includes('city')) groupId.city = { $ifNull: ['$deliveryAddress.city', 'Unknown'] };
  const groupIdValue = Object.keys(groupId).length === 0 ? null : groupId;

  const groupStage: { _id: unknown; revenue?: unknown; orders?: unknown } = { _id: groupIdValue };
  if (metrics.includes('revenue')) groupStage.revenue = { $sum: '$totalBill' };
  if (metrics.includes('orders')) groupStage.orders = { $sum: 1 };

  const pipeline: PipelineStage[] = [{ $match: matchStage }, { $group: groupStage as PipelineStage.Group['$group'] }];
  return Order.aggregate(pipeline);
}

export interface ExportReportParams {
  format?: 'csv' | 'json';
  range?: Range;
  report?: 'orders-by-hour' | 'financial-summary' | 'overview';
}

export async function exportReportData(params: ExportReportParams) {
  const { range, report = 'overview' } = params;
  const { start, end } = getDateRange(range || '30d');

  if (report === 'orders-by-hour') return peakHoursLogic(range || '7d');

  if (report === 'financial-summary') {
    const agg = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalBill' }, totalOrders: { $sum: 1 } } },
    ]);
    return agg[0] || { totalRevenue: 0, totalOrders: 0 };
  }

  return Order.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } } },
    { $group: { _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d' } }, revenue: { $sum: '$totalBill' }, orders: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
}

export function toCsv(data: unknown): string {
  const rows: Record<string, unknown>[] = Array.isArray(data) ? data : [data as Record<string, unknown>];
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return [headers.join(',')].concat(rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))).join('\n');
}

export async function getPickerAnalytics() {
  const { PickerUser, PickerAttendance } = await import('../picker/picker.models');
  const [total, byStatus, byRole, punchedIn] = await Promise.all([
    PickerUser.countDocuments(),
    PickerUser.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    PickerUser.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$workforceRole', count: { $sum: 1 } } }]),
    PickerAttendance.countDocuments({ punchOut: null, status: { $in: ['ON_DUTY', 'ON_BREAK'] } }),
  ]);
  return {
    total,
    punchedIn,
    byStatus: Object.fromEntries(byStatus.map((r) => [r._id || 'unknown', r.count])),
    byRole: Object.fromEntries(byRole.map((r) => [r._id || 'unknown', r.count])),
  };
}

export async function getPickerDrilldown(pickerId?: string) {
  const { PickerUser, PickerAttendance, PickerActionLog } = await import('../picker/picker.models');
  if (!pickerId) throw AppError.badRequest('pickerId is required');
  const picker = await PickerUser.findById(pickerId).lean();
  if (!picker) throw AppError.notFound('Picker', pickerId);
  const [attendance, logs] = await Promise.all([
    PickerAttendance.find({ userId: pickerId }).sort({ createdAt: -1 }).limit(30).lean(),
    PickerActionLog.find({ userId: pickerId }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);
  return { picker, attendance, logs };
}
