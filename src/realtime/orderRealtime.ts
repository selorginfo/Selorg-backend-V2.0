import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { eventBus } from '../events/eventBus';
import { EVENT_TYPES } from '../events/eventTypes';
import { getCustomerJwtSecret } from '../utils/auth';
import {
  PICKER_JWT_SECRET,
  PICKER_TOKEN_AUDIENCE,
  PICKER_APP_TOKEN_AUDIENCE,
  RIDER_APP_TOKEN_AUDIENCE,
} from '../modules/picker/picker.auth.service';
import { DEFAULT_HUB_KEY } from '../modules/orders/fulfillment.service';
import { isAllowedOrigin } from '../config/cors';

const WORKFORCE_SOCKET_AUDIENCES = new Set([
  PICKER_TOKEN_AUDIENCE,
  PICKER_APP_TOKEN_AUDIENCE,
  RIDER_APP_TOKEN_AUDIENCE,
]);
type ActorRole = 'hhd' | 'rider' | 'customer';

interface AuthedSocketData {
  role: ActorRole;
  userId: string;
  hubKey?: string | null;
}

type OrderEventPayload = {
  orderId?: string;
  orderNumber?: string;
  userId?: string;
  hubKey?: string | null;
  offerHubKey?: string | null;
  pickerId?: string | null;
  rackCode?: string | null;
  dispatchBay?: string | null;
  bagCode?: string | null;
  status?: string | null;
  riderStage?: string | null;
  [key: string]: unknown;
};

let hhdIo: Server | null = null;
let pickerIo: Server | null = null;
let customerIo: Server | null = null;
let listenersBound = false;

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required for realtime auth');
  return secret;
}

function hubRoom(hubKey?: string | null): string {
  return `hub:${String(hubKey || DEFAULT_HUB_KEY).trim() || DEFAULT_HUB_KEY}`;
}

function customerRoom(userId: string): string {
  return `customer:${userId}`;
}

function riderRoom(pickerId: string): string {
  return `rider:${pickerId}`;
}

function orderRoom(orderId: string): string {
  return `order:${orderId}`;
}

function corsOriginCheck(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  if (!origin || isAllowedOrigin(origin)) {
    callback(null, true);
    return;
  }
  callback(null, false);
}

async function authHhd(socket: Socket): Promise<AuthedSocketData> {
  const token = String(socket.handshake.auth?.token || socket.handshake.query?.token || '').trim();
  if (!token) throw new Error('AUTH_REQUIRED');
  const decoded = jwt.verify(token, requireJwtSecret()) as { id?: string };
  if (!decoded?.id) throw new Error('AUTH_REQUIRED');
  const hubKey = String(socket.handshake.auth?.hubKey || socket.handshake.query?.hubKey || DEFAULT_HUB_KEY);
  return { role: 'hhd', userId: String(decoded.id), hubKey };
}

async function authPicker(socket: Socket): Promise<AuthedSocketData> {
  const token = String(socket.handshake.auth?.token || socket.handshake.query?.token || '').trim();
  if (!token) throw new Error('AUTH_REQUIRED');
  // Match HTTP picker auth: verify signature only (audience may be absent on older tokens).
  const decoded = jwt.verify(token, PICKER_JWT_SECRET) as { sub?: string; id?: string; aud?: string | string[] };
  const audiences = decoded.aud ? ([] as string[]).concat(decoded.aud) : [];
  if (audiences.length > 0 && !audiences.some((a) => WORKFORCE_SOCKET_AUDIENCES.has(a))) {
    throw new Error('AUTH_REQUIRED');
  }
  const userId = String(decoded.sub || decoded.id || '');
  if (!userId) throw new Error('AUTH_REQUIRED');
  const hubKey = String(socket.handshake.auth?.hubKey || socket.handshake.query?.hubKey || DEFAULT_HUB_KEY);
  return { role: 'rider', userId, hubKey };
}

async function authCustomer(socket: Socket): Promise<AuthedSocketData> {
  const token = String(socket.handshake.auth?.token || socket.handshake.query?.token || '').trim();
  if (!token) throw new Error('AUTH_REQUIRED');
  const decoded = jwt.verify(token, getCustomerJwtSecret()) as { sub?: string };
  if (!decoded?.sub) throw new Error('AUTH_REQUIRED');
  return { role: 'customer', userId: String(decoded.sub) };
}

function attachAuth(
  io: Server,
  authenticate: (socket: Socket) => Promise<AuthedSocketData>,
  onJoin: (socket: Socket, data: AuthedSocketData) => void,
): void {
  io.use(async (socket, next) => {
    try {
      const data = await authenticate(socket);
      (socket.data as AuthedSocketData) = data;
      next();
    } catch (err) {
      logger.warn('[realtime] socket auth failed', { error: (err as Error).message });
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const data = socket.data as AuthedSocketData;
    onJoin(socket, data);
    socket.emit('realtime:ready', { role: data.role, userId: data.userId });
    socket.on('disconnect', () => {
      // no-op — rooms are cleaned by socket.io
    });
  });
}

function publicPayload(event: string, payload: OrderEventPayload): Record<string, unknown> {
  return {
    event,
    orderId: payload.orderId || null,
    orderNumber: payload.orderNumber || null,
    hubKey: payload.hubKey || payload.offerHubKey || null,
    rackCode: payload.rackCode || payload.dispatchBay || null,
    dispatchBay: payload.dispatchBay || payload.rackCode || null,
    bagCode: payload.bagCode || null,
    status: payload.status || null,
    riderStage: payload.riderStage || null,
    at: new Date().toISOString(),
  };
}

function emitToHhd(hubKey: string | null | undefined, event: string, payload: OrderEventPayload): void {
  if (!hhdIo) return;
  const body = publicPayload(event, payload);
  hhdIo.to(hubRoom(hubKey)).emit(event, body);
  // Prototype clients listen for assignorder:assigned
  if (event === EVENT_TYPES.ORDER_CREATED || event === EVENT_TYPES.ORDER_CONFIRMED) {
    hhdIo.to(hubRoom(hubKey)).emit('assignorder:assigned', body);
    hhdIo.to(hubRoom(hubKey)).emit('order:available', body);
  }
}

function emitToRiders(hubKey: string | null | undefined, event: string, payload: OrderEventPayload): void {
  if (!pickerIo) return;
  const body = publicPayload(event, payload);
  pickerIo.to(hubRoom(hubKey)).emit(event, body);
  if (payload.pickerId) {
    pickerIo.to(riderRoom(String(payload.pickerId))).emit(event, body);
  }
  if (event === EVENT_TYPES.ORDER_HANDED_OVER) {
    pickerIo.to(hubRoom(hubKey)).emit('order:ready_for_dispatch', body);
  }
}

function emitToCustomer(userId: string | null | undefined, event: string, payload: OrderEventPayload): void {
  if (!customerIo || !userId) return;
  customerIo.to(customerRoom(String(userId))).emit(event, publicPayload(event, payload));
  if (payload.orderId) {
    customerIo.to(orderRoom(String(payload.orderId))).emit(event, publicPayload(event, payload));
  }
}

function bindEventBridge(): void {
  if (listenersBound) return;
  listenersBound = true;

  const bridge = (event: string) => {
    eventBus.on(event, (payload: OrderEventPayload = {}) => {
      try {
        const hub = payload.hubKey || payload.offerHubKey || DEFAULT_HUB_KEY;
        if (
          event === EVENT_TYPES.ORDER_CREATED ||
          event === EVENT_TYPES.ORDER_CONFIRMED ||
          event === EVENT_TYPES.ORDER_CANCELLED
        ) {
          emitToHhd(hub, event, payload);
        }
        if (
          event === EVENT_TYPES.ORDER_HANDED_OVER ||
          event === EVENT_TYPES.ORDER_HHD_SCANNED ||
          event === EVENT_TYPES.ORDER_PICKED ||
          event === EVENT_TYPES.ORDER_RIDER_ACCEPTED ||
          event === EVENT_TYPES.ORDER_OUT_FOR_DELIVERY ||
          event === EVENT_TYPES.ORDER_DISPATCHED
        ) {
          emitToRiders(hub, event, payload);
        }
        if (
          event === EVENT_TYPES.ORDER_CONFIRMED ||
          event === EVENT_TYPES.ORDER_PICKING_STARTED ||
          event === EVENT_TYPES.ORDER_HANDED_OVER ||
          event === EVENT_TYPES.ORDER_RIDER_ACCEPTED ||
          event === EVENT_TYPES.ORDER_OUT_FOR_DELIVERY ||
          event === EVENT_TYPES.ORDER_DELIVERED ||
          event === EVENT_TYPES.ORDER_CANCELLED
        ) {
          emitToCustomer(payload.userId ? String(payload.userId) : null, event, payload);
        }
      } catch (err) {
        logger.warn('[realtime] event bridge failed', { event, error: (err as Error).message });
      }
    });
  };

  Object.values(EVENT_TYPES).forEach((event) => bridge(event));
}

/**
 * Attach Socket.IO namespaces used by HSD, Rider, and Customer/Web apps.
 * Safe to call once per process after the HTTP server is created.
 */
export function initOrderRealtime(httpServer: HttpServer): void {
  if (hhdIo || pickerIo || customerIo) return;

  const common = {
    cors: { origin: corsOriginCheck, credentials: true },
    transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
  };

  hhdIo = new Server(httpServer, { ...common, path: '/hhd-socket.io' });
  pickerIo = new Server(httpServer, { ...common, path: '/picker-socket.io' });
  customerIo = new Server(httpServer, { ...common, path: '/customer-socket.io' });

  attachAuth(hhdIo, authHhd, (socket, data) => {
    socket.join(hubRoom(data.hubKey));
    socket.join(`hhd:${data.userId}`);
  });

  attachAuth(pickerIo, authPicker, (socket, data) => {
    socket.join(hubRoom(data.hubKey));
    socket.join(riderRoom(data.userId));
    socket.on('subscribe:hub', (hubKey: string) => {
      if (hubKey) socket.join(hubRoom(hubKey));
    });
  });

  attachAuth(customerIo, authCustomer, (socket, data) => {
    socket.join(customerRoom(data.userId));
    socket.on('subscribe:order', (orderId: string) => {
      if (orderId) socket.join(orderRoom(String(orderId)));
    });
  });

  bindEventBridge();
  logger.info('[realtime] order sockets ready', {
    paths: ['/hhd-socket.io', '/picker-socket.io', '/customer-socket.io'],
  });
}

/** Direct emit helpers for services that already know the audience. */
export const orderRealtime = {
  notifyHhdHub(hubKey: string | null | undefined, event: string, payload: OrderEventPayload): void {
    emitToHhd(hubKey, event, payload);
  },
  notifyRiders(hubKey: string | null | undefined, event: string, payload: OrderEventPayload): void {
    emitToRiders(hubKey, event, payload);
  },
  notifyCustomer(userId: string | null | undefined, event: string, payload: OrderEventPayload): void {
    emitToCustomer(userId, event, payload);
  },
  /**
   * Inbox row just committed. Customer/web clients listening on their user room
   * update the bell and list without a reload.
   */
  publishInboxNotification(
    userId: string | null | undefined,
    doc: {
      _id?: unknown;
      title?: string;
      body?: string;
      read?: boolean;
      category?: string;
      data?: Record<string, unknown>;
      createdAt?: Date | string;
      deliveryStatus?: string;
    },
  ): void {
    if (!customerIo || !userId || !doc?._id) return;
    const createdAt =
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : doc.createdAt || new Date().toISOString();
    customerIo.to(customerRoom(String(userId))).emit('notification:created', {
      id: String(doc._id),
      title: doc.title || '',
      body: doc.body || '',
      read: Boolean(doc.read),
      category: doc.category || 'system',
      data: doc.data || {},
      createdAt,
      deliveryStatus: doc.deliveryStatus,
    });
  },
  /** Live rider GPS for the customer tracking map. Includes coordinates (status events do not). */
  emitRiderGps(input: {
    orderId: string;
    userId?: string | null;
    latitude: number;
    longitude: number;
    heading?: number | null;
  }): void {
    if (!customerIo || !input.orderId) return;
    const body = {
      event: 'rider:location',
      orderId: input.orderId,
      latitude: input.latitude,
      longitude: input.longitude,
      heading: input.heading ?? null,
      at: new Date().toISOString(),
    };
    customerIo.to(orderRoom(input.orderId)).emit('rider:location', body);
    if (input.userId) customerIo.to(customerRoom(String(input.userId))).emit('rider:location', body);
  },
};
