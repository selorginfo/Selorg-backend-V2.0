/** Frontend route id → REST mount under `/api/v1/admin`, and which module the role matrix uses. */
export interface ResourceMount {
  route: string;
  /** Express path. Nested resources include `:batchId`. */
  path: string;
  idParam: string;
  module: 'delivery' | 'stalls';
  /** When set, list/get only returns rows whose text contains this param (optional filter). */
  batchParam?: string;
}

export const RESOURCE_MOUNTS: ResourceMount[] = [
  { route: 'deliveries', path: '/deliveries', idParam: 'deliveryId', module: 'delivery' },
  { route: 'bd-overview', path: '/bulk-delivery/overview', idParam: 'areaId', module: 'delivery' },
  { route: 'bd-queue', path: '/bulk-delivery/queue', idParam: 'orderId', module: 'delivery' },
  { route: 'bd-batches', path: '/bulk-delivery/batches', idParam: 'batchId', module: 'delivery' },
  { route: 'bd-stops', path: '/bulk-delivery/batches/:batchId/stops', idParam: 'stopNo', module: 'delivery', batchParam: 'batchId' },
  { route: 'bd-route', path: '/bulk-delivery/batches/:batchId/route/stops', idParam: 'stopId', module: 'delivery', batchParam: 'batchId' },
  { route: 'bd-track', path: '/bulk-delivery/trips', idParam: 'vehicleId', module: 'delivery' },
  { route: 'bd-ops', path: '/bulk-delivery/operators', idParam: 'operatorId', module: 'delivery' },
  { route: 'bd-exceptions', path: '/bulk-delivery/exceptions', idParam: 'exceptionId', module: 'delivery' },
  { route: 'vehicles', path: '/fleet/vehicles', idParam: 'vehicleId', module: 'delivery' },
  { route: 'bulk-dispatch', path: '/bulk-orders/load-plans', idParam: 'loadId', module: 'delivery' },
  { route: 'bulk-track', path: '/bulk-orders/consignments', idParam: 'consignmentId', module: 'delivery' },
  { route: 'stall-overview', path: '/stalls/overview', idParam: 'areaId', module: 'stalls' },
  { route: 'stall-areas', path: '/stall-areas', idParam: 'areaId', module: 'stalls' },
  { route: 'stalls', path: '/stalls', idParam: 'stallId', module: 'stalls' },
  { route: 'stall-staff', path: '/stall-employees', idParam: 'employeeId', module: 'stalls' },
  { route: 'stall-conv', path: '/stall-conversions', idParam: 'conversionId', module: 'stalls' },
  { route: 'stall-orders', path: '/stall-orders', idParam: 'stallOrderId', module: 'stalls' },
  { route: 'stall-ads', path: '/stall-ads', idParam: 'adId', module: 'stalls' },
  { route: 'stall-samples', path: '/stall-sample-allocations', idParam: 'allocationId', module: 'stalls' },
  { route: 'stall-incentives', path: '/stall-incentive-rules', idParam: 'ruleId', module: 'stalls' },
  { route: 'stall-earnings', path: '/stall-earnings', idParam: 'earningId', module: 'stalls' },
];

export const DELIVERY_ROUTES = new Set(RESOURCE_MOUNTS.filter((r) => r.module === 'delivery').map((r) => r.route));
export const STALL_ROUTES = new Set(RESOURCE_MOUNTS.filter((r) => r.module === 'stalls').map((r) => r.route));

/** Finance may edit salary, rules and earnings. Catalog/marketing may edit areas, stalls, ads and samples. */
export const FINANCE_WRITE = new Set(['stall-staff', 'stall-incentives', 'stall-earnings']);
export const CATALOG_WRITE = new Set(['stall-areas', 'stalls', 'stall-ads', 'stall-samples']);
export const APPROVE_ACTIONS = /^(Approve rule|Approve earning|Approve allocation)$/i;

const DELETE_CAPABLE = new Set(['stall-areas', 'stalls', 'stall-staff', 'stall-ads', 'vehicles']);

export function canDelete(route: string): boolean {
  return DELETE_CAPABLE.has(route);
}
