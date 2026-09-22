import mongoose from 'mongoose';
import {
  LogisticsOrder,
  ProviderOrder,
  OrderStatusHistory,
  LogisticsProviderConfig,
  type ILogisticsOrder,
  type OrderStatus,
  type HistorySource,
} from './logistics.models';
import { createPorterAdapter, type PorterAdapter } from './porter.adapter';
import { ensureDefaultConfigs } from './logistics.provider-config.service';
import { canTransition } from './logistics.state-machine';
import { publishLogisticsEvent } from './logistics.events';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';

// ─── Provider factory ─────────────────────────────────────────────────────────

function getProviderAdapter(name: string): PorterAdapter {
  // Currently only Porter is implemented. Extend here for SHADOWFAX, LOADSHARE, etc.
  if (name === 'PORTER') return createPorterAdapter();
  // Fallback: return Porter adapter and log a warning
  logger.warn(`[logistics] no adapter for provider "${name}", falling back to PORTER`);
  return createPorterAdapter();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function appendHistory(
  orderId: mongoose.Types.ObjectId | string,
  status: string,
  message: string,
  source: HistorySource,
  location?: { lat?: number; lng?: number },
): Promise<void> {
  await OrderStatusHistory.create({
    logisticsOrderId: orderId,
    status,
    message: message || '',
    source,
    eventTime: new Date(),
    location,
  });
}

async function getOrderedProviderNames(): Promise<string[]> {
  await ensureDefaultConfigs();
  const rows = await LogisticsProviderConfig.find({ isActive: true })
    .sort({ priority: 1 })
    .select('name')
    .lean();
  if (!rows.length) return ['PORTER'];
  return rows.map((r) => r.name);
}

interface ProviderAttemptResult {
  providerName: string;
  adapter: PorterAdapter;
  result: {
    providerOrderId: string;
    status: string;
    estimatedFare?: number;
    distanceKm?: number;
    rawRequest: unknown;
    rawResponse: unknown;
  };
}

async function tryProvidersWithFailover(
  orderPayload: Partial<ILogisticsOrder> & {
    pickup: ILogisticsOrder['pickup'];
    drop: ILogisticsOrder['drop'];
  },
): Promise<ProviderAttemptResult> {
  const names = await getOrderedProviderNames();
  const errors: Array<{ name: string; error: string }> = [];

  for (const name of names) {
    const adapter = getProviderAdapter(name);
    try {
      const result = await adapter.createOrder({ ...orderPayload, provider: name as 'PORTER' });
      return { providerName: name, adapter, result };
    } catch (e) {
      logger.warn('[logistics] provider attempt failed', {
        provider: name,
        error: (e as Error).message,
      });
      errors.push({ name, error: (e as Error).message });
    }
  }

  throw new AppError('All active logistics providers failed', 502, 'ALL_PROVIDERS_FAILED', errors);
}

// ─── Status event routing ─────────────────────────────────────────────────────

function emitStatusEvent(order: Partial<ILogisticsOrder> & { _id: unknown }, status: OrderStatus, extra: Record<string, unknown> = {}): void {
  // Fire-and-forget — metrics + in-process bus; RabbitMQ stays opt-in via LOGISTICS_RABBITMQ_URL
  void publishLogisticsEvent(order, status, extra);
}

// ─── Public service methods ───────────────────────────────────────────────────

export interface CreateOrderBody {
  referenceId: string;
  type: ILogisticsOrder['type'];
  provider: ILogisticsOrder['provider'];
  pickup: ILogisticsOrder['pickup'];
  drop: ILogisticsOrder['drop'];
  items: ILogisticsOrder['items'];
  vehicleType?: string;
  scheduledTime?: Date;
}

export async function createOrder(
  body: CreateOrderBody,
  opts: { enforcedType?: string } = {},
): Promise<ILogisticsOrder> {
  const payload = { ...body };
  if (opts.enforcedType) payload.type = opts.enforcedType as ILogisticsOrder['type'];

  const order = await LogisticsOrder.create({
    referenceId: payload.referenceId,
    type: payload.type,
    provider: payload.provider,
    pickup: payload.pickup,
    drop: payload.drop,
    items: payload.items,
    vehicleType: payload.vehicleType || 'mini_truck',
    scheduledTime: payload.scheduledTime,
    status: 'CREATED',
  });

  await appendHistory(order._id, 'CREATED', 'Order created', 'INTERNAL');

  try {
    const { providerName, result } = await tryProvidersWithFailover(payload);

    order.provider = providerName as ILogisticsOrder['provider'];
    order.providerOrderId = result.providerOrderId;
    order.estimatedFare = result.estimatedFare;
    order.distanceKm = result.distanceKm;
    order.status = (result.status as OrderStatus) || 'CREATED';
    if (order.status === 'DRIVER_ASSIGNED') order.assignedAt = new Date();
    await order.save();

    await ProviderOrder.create({
      logisticsOrderId: order._id,
      provider: providerName,
      providerOrderId: result.providerOrderId,
      rawRequest: result.rawRequest,
      rawResponse: result.rawResponse,
      status: order.status,
    });

    if (order.status !== 'CREATED') {
      await appendHistory(order._id, order.status, 'Provider response', 'INTERNAL');
    }

    emitStatusEvent(order.toObject() as unknown as Partial<ILogisticsOrder> & { _id: unknown }, 'CREATED', {
      initialProviderStatus: result.status,
    });
    if (order.status !== 'CREATED') {
      emitStatusEvent(order.toObject() as unknown as Partial<ILogisticsOrder> & { _id: unknown }, order.status);
    }

    return order;
  } catch (err) {
    order.status = 'FAILED';
    await order.save();
    await appendHistory(order._id, 'FAILED', (err as Error).message || 'Provider failure', 'INTERNAL');
    emitStatusEvent(order.toObject() as unknown as Partial<ILogisticsOrder> & { _id: unknown }, 'FAILED', {
      error: (err as Error).message,
    });

    if (err instanceof AppError) throw err;
    throw new AppError((err as Error).message || 'Create failed', 502, 'PROVIDER_ERROR');
  }
}

export interface ListOrdersQuery {
  status?: string;
  provider?: string;
  type?: string;
  referenceId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export async function listOrders(
  query: ListOrdersQuery,
  opts: { enforcedType?: string } = {},
): Promise<{ items: ILogisticsOrder[]; total: number; page: number; limit: number }> {
  const { status, provider, type, referenceId, from, to, page = 1, limit = 20 } = query;

  const filter: Record<string, unknown> = {};
  if (opts.enforcedType) filter.type = opts.enforcedType;
  if (status) filter.status = status;
  if (provider) filter.provider = provider;
  if (!opts.enforcedType && type) filter.type = type;
  if (referenceId) {
    filter.referenceId = new RegExp(referenceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) (filter.createdAt as Record<string, unknown>).$gte = from;
    if (to) (filter.createdAt as Record<string, unknown>).$lte = to;
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    LogisticsOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    LogisticsOrder.countDocuments(filter),
  ]);

  return { items: items as unknown as ILogisticsOrder[], total, page, limit };
}

export async function getOrderById(
  id: string,
  opts: { enforcedType?: string } = {},
): Promise<{
  order: ILogisticsOrder;
  history: unknown[];
  audits: unknown[];
}> {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid order id', 400, 'INVALID_ID');
  }

  const order = await LogisticsOrder.findById(id).lean();
  if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');

  if (opts.enforcedType && order.type !== opts.enforcedType) {
    throw new AppError('Order not in scope', 403, 'FORBIDDEN_SCOPE');
  }

  const [history, audits] = await Promise.all([
    OrderStatusHistory.find({ logisticsOrderId: id }).sort({ eventTime: 1 }).lean(),
    ProviderOrder.find({ logisticsOrderId: id }).sort({ createdAt: -1 }).lean(),
  ]);

  return { order: order as unknown as ILogisticsOrder, history, audits };
}

export async function cancelOrder(
  id: string,
  opts: { enforcedType?: string } = {},
): Promise<ILogisticsOrder> {
  const { order } = await getOrderById(id, opts);

  if (!canTransition(order.status, 'CANCELLED')) {
    throw new AppError(
      `Cannot transition from ${order.status} to CANCELLED`,
      409,
      'INVALID_TRANSITION',
    );
  }

  const adapter = getProviderAdapter(order.provider);
  if (order.providerOrderId) {
    try {
      await adapter.cancelOrder(order.providerOrderId);
    } catch (err) {
      logger.warn('[logistics] provider cancel failed, continuing with local cancel', {
        error: (err as Error).message,
      });
    }
  }

  await LogisticsOrder.updateOne({ _id: id }, { $set: { status: 'CANCELLED' } });
  await appendHistory(id, 'CANCELLED', 'Cancelled via API', 'MANUAL');

  const updated = (await LogisticsOrder.findById(id).lean()) as unknown as ILogisticsOrder;
  emitStatusEvent(updated as unknown as Partial<ILogisticsOrder> & { _id: unknown }, 'CANCELLED');
  return updated;
}

export async function getTracking(
  id: string,
  opts: { enforcedType?: string } = {},
): Promise<{ order: ILogisticsOrder; tracking: unknown }> {
  const { order } = await getOrderById(id, opts);

  if (!order.providerOrderId) {
    return { order, tracking: { status: order.status, path: [], raw: {} } };
  }

  const adapter = getProviderAdapter(order.provider);
  const tracking = await adapter.trackOrder(order.providerOrderId);
  return { order, tracking };
}

export interface WebhookStatusUpdateParams {
  providerOrderId: string;
  nextStatus: OrderStatus;
  message?: string;
  driver?: {
    name?: string;
    phone?: string;
    vehicleNumber?: string;
    vehicle_number?: string;
    vehicleType?: string;
    vehicle_type?: string;
  };
  location?: { lat?: number; lng?: number };
}

export async function applyWebhookStatusUpdate({
  providerOrderId,
  nextStatus,
  message,
  driver,
  location,
}: WebhookStatusUpdateParams): Promise<{ ok: boolean; reason?: string; from?: string; nextStatus?: string; duplicate?: boolean; order?: ILogisticsOrder }> {
  const order = await LogisticsOrder.findOne({ providerOrderId }).exec();

  if (!order) {
    logger.warn('[logistics] webhook for unknown providerOrderId', { providerOrderId });
    return { ok: false, reason: 'UNKNOWN_ORDER' };
  }

  const from = order.status;
  if (from === nextStatus) {
    return { ok: true, duplicate: true };
  }

  if (!canTransition(from, nextStatus)) {
    logger.warn('[logistics] illegal webhook transition', {
      from,
      nextStatus,
      id: order._id,
    });
    return { ok: false, reason: 'ILLEGAL_TRANSITION', from, nextStatus };
  }

  order.status = nextStatus;
  if (nextStatus === 'DRIVER_ASSIGNED') order.assignedAt = new Date();
  if (nextStatus === 'PICKED_UP') order.pickedUpAt = new Date();
  if (nextStatus === 'DELIVERED') order.deliveredAt = new Date();

  if (driver) {
    order.driverInfo = {
      name: driver.name,
      phone: driver.phone,
      vehicleNumber: driver.vehicleNumber || driver.vehicle_number,
      vehicleType: driver.vehicleType || driver.vehicle_type,
    };
  }

  await order.save();
  await appendHistory(order._id, nextStatus, message || 'Webhook', 'WEBHOOK', location);

  const orderObj = order.toObject() as unknown as ILogisticsOrder;
  emitStatusEvent(orderObj as unknown as Partial<ILogisticsOrder> & { _id: unknown }, nextStatus);

  return { ok: true, order: orderObj };
}

export { appendHistory };
