import { LogisticsOrder, LogisticsMetric, type OrderStatus } from './logistics.models';

function dateRange(from?: string, to?: string): { $gte?: Date; $lte?: Date } | undefined {
  const range: { $gte?: Date; $lte?: Date } = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return range.$gte || range.$lte ? range : undefined;
}

export async function getLogisticsKpis(from?: string, to?: string) {
  const createdAt = dateRange(from, to);
  const match: Record<string, unknown> = {};
  if (createdAt) match.createdAt = createdAt;

  const [totals, byStatus, byProvider, fareAgg] = await Promise.all([
    LogisticsOrder.countDocuments(match),
    LogisticsOrder.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    LogisticsOrder.aggregate([{ $match: match }, { $group: { _id: '$provider', count: { $sum: 1 } } }]),
    LogisticsOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          avgEstimatedFare: { $avg: '$estimatedFare' },
          avgActualFare: { $avg: '$actualFare' },
          avgDistanceKm: { $avg: '$distanceKm' },
          delivered: {
            $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((r) => [r._id, r.count]));
  const providerMap = Object.fromEntries(byProvider.map((r) => [r._id, r.count]));
  const fare = fareAgg[0] || {};
  const delivered = Number(fare.delivered || statusMap.DELIVERED || 0);

  return {
    totalOrders: totals,
    deliveryRate: totals > 0 ? Math.round((delivered / totals) * 1000) / 10 : 0,
    byStatus: statusMap,
    byProvider: providerMap,
    avgEstimatedFare: fare.avgEstimatedFare != null ? Math.round(Number(fare.avgEstimatedFare) * 100) / 100 : null,
    avgActualFare: fare.avgActualFare != null ? Math.round(Number(fare.avgActualFare) * 100) / 100 : null,
    avgDistanceKm: fare.avgDistanceKm != null ? Math.round(Number(fare.avgDistanceKm) * 100) / 100 : null,
    from: from || null,
    to: to || null,
  };
}

export async function getCostPerRoute(from?: string, to?: string) {
  const createdAt = dateRange(from, to);
  const match: Record<string, unknown> = {
    distanceKm: { $gt: 0 },
    $or: [{ actualFare: { $gt: 0 } }, { estimatedFare: { $gt: 0 } }],
  };
  if (createdAt) match.createdAt = createdAt;

  const rows = await LogisticsOrder.aggregate([
    { $match: match },
    {
      $project: {
        provider: 1,
        type: 1,
        distanceKm: 1,
        fare: { $ifNull: ['$actualFare', '$estimatedFare'] },
        pickup: '$pickup.address',
        drop: '$drop.address',
        referenceId: 1,
        status: 1,
      },
    },
    {
      $addFields: {
        costPerKm: {
          $cond: [
            { $gt: ['$distanceKm', 0] },
            { $round: [{ $divide: ['$fare', '$distanceKm'] }, 2] },
            null,
          ],
        },
      },
    },
    { $sort: { costPerKm: -1 } },
    { $limit: 100 },
  ]);

  const summary = await LogisticsOrder.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$provider',
        trips: { $sum: 1 },
        avgCostPerKm: {
          $avg: {
            $cond: [
              { $gt: ['$distanceKm', 0] },
              { $divide: [{ $ifNull: ['$actualFare', '$estimatedFare'] }, '$distanceKm'] },
              null,
            ],
          },
        },
      },
    },
  ]);

  return {
    from: from || null,
    to: to || null,
    byProvider: summary.map((s) => ({
      provider: s._id,
      trips: s.trips,
      avgCostPerKm: s.avgCostPerKm != null ? Math.round(Number(s.avgCostPerKm) * 100) / 100 : null,
    })),
    routes: rows,
  };
}

export async function getSlaBreaches(limit = 50) {
  const metricBreaches = await LogisticsMetric.find({ slaBreached: true })
    .sort({ recordedAt: -1 })
    .limit(limit)
    .lean();

  if (metricBreaches.length > 0) {
    return {
      source: 'metrics' as const,
      count: metricBreaches.length,
      breaches: metricBreaches,
    };
  }

  // Fallback: open/delivered orders past scheduledTime + 4h
  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const openStatuses: OrderStatus[] = ['CREATED', 'DRIVER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];
  const orders = await LogisticsOrder.find({
    scheduledTime: { $lte: cutoff },
    $or: [
      { status: { $in: openStatuses } },
      {
        status: 'DELIVERED',
        $expr: {
          $gt: ['$deliveredAt', { $add: ['$scheduledTime', 4 * 60 * 60 * 1000] }],
        },
      },
    ],
  })
    .sort({ scheduledTime: 1 })
    .limit(limit)
    .lean();

  return {
    source: 'orders' as const,
    count: orders.length,
    breaches: orders.map((o) => ({
      logisticsOrderId: o._id,
      referenceId: o.referenceId,
      status: o.status,
      provider: o.provider,
      scheduledTime: o.scheduledTime,
      deliveredAt: o.deliveredAt,
      slaBreached: true,
    })),
  };
}
