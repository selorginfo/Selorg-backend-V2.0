import crypto from 'crypto';
import fetch from 'node-fetch';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import type { ILogisticsOrder } from './logistics.models';

// ─── Status mapping ───────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  open: 'CREATED',
  created: 'CREATED',
  pending: 'CREATED',
  assigned: 'DRIVER_ASSIGNED',
  driver_assigned: 'DRIVER_ASSIGNED',
  accepted: 'DRIVER_ASSIGNED',
  picked_up: 'PICKED_UP',
  picked: 'PICKED_UP',
  in_transit: 'IN_TRANSIT',
  otw: 'IN_TRANSIT',
  completed: 'DELIVERED',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  failed: 'FAILED',
};

export function mapPorterStatus(providerStatus?: string): string {
  if (!providerStatus) return 'CREATED';
  const key = String(providerStatus).toLowerCase().replace(/\s+/g, '_');
  return STATUS_MAP[key] || 'IN_TRANSIT';
}

// ─── Payload builders ─────────────────────────────────────────────────────────

function toPorterOrderPayload(internal: Partial<ILogisticsOrder> & { pickup: { name: string; phone: string; address: string; lat: number; lng: number }; drop: { name: string; phone: string; address: string; lat: number; lng: number } }) {
  return {
    reference_id: internal.referenceId,
    pickup_details: {
      name: internal.pickup.name,
      phone: internal.pickup.phone,
      address: internal.pickup.address,
      latitude: internal.pickup.lat,
      longitude: internal.pickup.lng,
    },
    drop_details: {
      name: internal.drop.name,
      phone: internal.drop.phone,
      address: internal.drop.address,
      latitude: internal.drop.lat,
      longitude: internal.drop.lng,
    },
    items: (internal.items || []).map((i) => ({
      item_name: i.name,
      quantity: i.quantity,
      weight: i.weight ?? 0,
    })),
    vehicle_type: internal.vehicleType || 'mini_truck',
    order_type: internal.type,
  };
}

// ─── HMAC verification ────────────────────────────────────────────────────────

export function verifyPorterHmac(
  payloadBuffer: Buffer,
  signatureHeader: string,
  secret: string,
): boolean {
  if (!secret || !signatureHeader || !payloadBuffer) return false;
  try {
    const h = crypto.createHmac('sha256', secret).update(payloadBuffer).digest('hex');
    const expectedBuf = Buffer.from(h, 'utf8');
    const got = String(signatureHeader).trim();
    // Support "sha256=<hex>" or raw hex
    const hex = got.includes('=') ? got.split('=').pop()! : got;
    const sigBuf = Buffer.from(hex, 'utf8');
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}

// ─── Adapter types ────────────────────────────────────────────────────────────

export interface PorterCreateResult {
  providerOrderId: string;
  status: string;
  estimatedFare?: number;
  distanceKm?: number;
  rawRequest: unknown;
  rawResponse: unknown;
}

export interface PorterTrackResult {
  status: string;
  path: Array<{ lat: number; lng: number; updatedAt: string }>;
  driver?: unknown;
  raw: unknown;
}

export interface PorterEstimateResult {
  fare?: number;
  distanceKm?: number;
  raw: unknown;
}

export interface EstimatePayload {
  pickup: { name: string; phone: string; address: string; lat: number; lng: number };
  drop: { name: string; phone: string; address: string; lat: number; lng: number };
  items?: Array<{ name: string; quantity: number; weight?: number }>;
  vehicleType?: string;
}

// ─── Adapter factory ──────────────────────────────────────────────────────────

export function createPorterAdapter() {
  const baseUrl = (process.env.PORTER_API_BASE_URL || '').replace(/\/$/, '');
  const apiKey = process.env.PORTER_API_KEY || '';
  const hmacSecret = process.env.PORTER_HMAC_SECRET || '';
  const timeoutMs = Number(process.env.LOGISTICS_FAILOVER_TIMEOUT_MS) || 10000;

  function assertConfigured(): void {
    if (!baseUrl || !apiKey) {
      throw new AppError(
        'Porter is not configured — set PORTER_API_BASE_URL and PORTER_API_KEY',
        501,
        'PROVIDER_NOT_CONFIGURED',
      );
    }
  }

  async function httpJson(method: string, path: string, body?: unknown): Promise<unknown> {
    assertConfigured();
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal as never,
      });

      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }

      if (!res.ok) {
        logger.warn('[porter] http error', { status: res.status, path });
        throw new AppError(
          `Porter HTTP ${res.status}`,
          res.status >= 400 && res.status < 600 ? res.status : 502,
          'PROVIDER_ERROR',
          json,
        );
      }

      return json;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('[porter] request failed', { error: (err as Error).message, path });
      throw new AppError(
        (err as Error).message || 'Porter request failed',
        502,
        'PROVIDER_ERROR',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    name: 'PORTER' as const,

    mapStatus: mapPorterStatus,

    verifyWebhookSignature(payload: Buffer, signature: string): boolean {
      const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload), 'utf8');
      return verifyPorterHmac(buf, signature, hmacSecret);
    },

    async createOrder(
      payload: Partial<ILogisticsOrder> & {
        pickup: { name: string; phone: string; address: string; lat: number; lng: number };
        drop: { name: string; phone: string; address: string; lat: number; lng: number };
      },
    ): Promise<PorterCreateResult> {
      const rawRequest = toPorterOrderPayload(payload);
      // TODO(porter-contract): confirm create path with official Porter B2B bulk docs
      const json = (await httpJson('POST', '/v1/partner/orders', rawRequest)) as Record<string, unknown>;
      const providerOrderId =
        (json?.order_id || json?.id || (json?.data as Record<string, unknown>)?.order_id) as string | undefined;

      if (!providerOrderId) {
        throw new AppError('Porter response missing order id', 502, 'PROVIDER_ERROR', json);
      }

      const status = mapPorterStatus(
        (json?.status || json?.order_status || 'created') as string,
      );

      return {
        providerOrderId: String(providerOrderId),
        status,
        estimatedFare: Number(json?.fare || json?.estimated_fare || 0) || undefined,
        distanceKm: Number(json?.distance_km || json?.estimated_distance_km || 0) || undefined,
        rawRequest,
        rawResponse: json,
      };
    },

    async cancelOrder(providerOrderId: string): Promise<{ ok: boolean; raw: unknown }> {
      const rawRequest = { order_id: providerOrderId };
      const json = (await httpJson(
        'POST',
        `/v1/partner/orders/${encodeURIComponent(providerOrderId)}/cancel`,
        rawRequest,
      )) as Record<string, unknown>;
      return {
        ok: Boolean(json?.success ?? json?.cancelled ?? true),
        raw: json,
      };
    },

    async trackOrder(providerOrderId: string): Promise<PorterTrackResult> {
      const json = (await httpJson(
        'GET',
        `/v1/partner/orders/${encodeURIComponent(providerOrderId)}/track`,
      )) as Record<string, unknown>;

      const status = mapPorterStatus(
        (json?.status || json?.order_status) as string | undefined,
      );

      const loc = (json?.driver_location || json?.location) as
        | { lat?: number; lng?: number }
        | undefined;
      const path: Array<{ lat: number; lng: number; updatedAt: string }> = [];
      if (loc && typeof loc.lat === 'number') {
        path.push({ lat: loc.lat, lng: loc.lng!, updatedAt: new Date().toISOString() });
      }

      return {
        status,
        path,
        driver: json?.driver || json?.driver_details,
        raw: json,
      };
    },

    async getFareEstimate(payload: EstimatePayload): Promise<PorterEstimateResult> {
      const internal = {
        referenceId: 'estimate',
        type: 'VENDOR_TO_WAREHOUSE' as const,
        provider: 'PORTER' as const,
        pickup: payload.pickup,
        drop: payload.drop,
        items: payload.items,
        vehicleType: payload.vehicleType,
      };
      const body = toPorterOrderPayload(internal);
      const json = (await httpJson('POST', '/v1/partner/orders/estimate', body)) as Record<
        string,
        unknown
      >;
      return {
        fare: Number(json?.fare || json?.estimated_fare || 0) || undefined,
        distanceKm: Number(json?.distance_km || 0) || undefined,
        raw: json,
      };
    },
  };
}

export type PorterAdapter = ReturnType<typeof createPorterAdapter>;
