import type { Server as HttpServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { getRedisClient } from '../database/redis';

const RIDER_GPS_TTL_SECONDS = 60;

/**
 * Handshake tokens on this namespace can be admin, customer or picker issued, and each
 * family may be signed with its own secret (falling back to JWT_SECRET when unset).
 * Resolved per-verification rather than at module load so it reflects post-
 * validateEnvironment() state, and never falls back to a placeholder secret.
 */
function candidateJwtSecrets(): string[] {
  const secrets = [process.env.JWT_SECRET, process.env.CUSTOMER_JWT_SECRET, process.env.PICKER_JWT_SECRET]
    .map((s) => (s || '').trim())
    .filter((s) => s.length > 0);
  const unique = [...new Set(secrets)];
  if (!unique.length) throw new Error('JWT_SECRET is required for realtime auth');
  return unique;
}

/** Verify against every configured secret; throws the last error when none match. */
function verifyHandshakeToken(token: string): Record<string, unknown> {
  const secrets = candidateJwtSecrets();
  let lastError: Error = new Error('Invalid token');
  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret) as Record<string, unknown>;
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw lastError;
}

// Rooms:
//   admin              — all admin sockets
//   order:{orderId}    — anyone subscribed to a specific order (customer, admin, rider)
//   rider:{riderId}    — the rider's own personal channel

interface AuthedSocket extends Socket {
  data: { userId: string; role: 'customer' | 'picker' | 'admin' };
}

let io: IOServer | null = null;

export function initRealtime(httpServer: HttpServer): IOServer {
  if (io) return io;
  io = new IOServer(httpServer, {
    cors: {
      origin: (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()),
      credentials: true,
    },
  });

  // JWT handshake: client passes token in `auth.token`. Role is inferred from the
  // JWT payload shape used by picker vs admin auth (claims differ — kept lenient
  // here, downstream code checks role).
  io.use((socket: Socket, next) => {
    const token = (socket.handshake.auth?.token || socket.handshake.query?.token) as string | undefined;
    if (!token) return next(new Error('Missing auth token'));
    try {
      const payload = verifyHandshakeToken(token);
      const userId = String(payload.sub || payload.userId || payload.id || '');
      if (!userId) return next(new Error('Invalid token: no user id'));
      const role = (payload.role as string) || (payload.adminId ? 'admin' : payload.sid ? 'picker' : 'customer');
      (socket as AuthedSocket).data = { userId, role: role as AuthedSocket['data']['role'] };
      return next();
    } catch (err) {
      return next(new Error(`Auth failed: ${(err as Error).message}`));
    }
  });

  io.on('connection', (socket: Socket) => {
    const s = socket as AuthedSocket;
    const { userId, role } = s.data;
    logger.info(`[realtime] connected role=${role} user=${userId} sid=${s.id}`);

    if (role === 'admin') s.join('admin');
    if (role === 'picker') s.join(`rider:${userId}`);

    // Customers/admin can subscribe to a specific order feed.
    s.on('order:subscribe', (orderId: string) => {
      if (typeof orderId === 'string' && orderId) s.join(`order:${orderId}`);
    });
    s.on('order:unsubscribe', (orderId: string) => {
      if (typeof orderId === 'string' && orderId) s.leave(`order:${orderId}`);
    });

    // Rider live GPS push (alternative to HTTP heartbeat).
    s.on('rider:gps', async (payload: { lat: number; lng: number }) => {
      if (role !== 'picker') return;
      if (!payload || typeof payload.lat !== 'number' || typeof payload.lng !== 'number') return;
      await storeRiderPosition(userId, payload.lat, payload.lng);
      io?.to('admin').emit('rider:location', { riderId: userId, lat: payload.lat, lng: payload.lng, ts: Date.now() });
    });

    s.on('disconnect', () => {
      logger.info(`[realtime] disconnected user=${userId} sid=${s.id}`);
    });
  });

  logger.info('[realtime] Socket.IO initialized');
  return io;
}

export function getIO(): IOServer | null {
  return io;
}

// ─── Emit helpers ────────────────────────────────────────────────────────────
// These are safe to call even when Socket.IO hasn't been initialized (unit tests,
// worker processes) — they no-op instead of throwing.

export function emitOrderStatus(orderId: string, payload: Record<string, unknown>): void {
  if (!io) return;
  io.to(`order:${orderId}`).emit('order:status', { orderId, ...payload, ts: Date.now() });
  io.to('admin').emit('order:status', { orderId, ...payload, ts: Date.now() });
}

export function emitOrderAssigned(orderId: string, riderId: string, payload: Record<string, unknown> = {}): void {
  if (!io) return;
  io.to(`rider:${riderId}`).emit('order:assigned', { orderId, ...payload, ts: Date.now() });
  io.to('admin').emit('order:assigned', { orderId, riderId, ...payload, ts: Date.now() });
}

export function emitRiderLocation(riderId: string, lat: number, lng: number): void {
  if (!io) return;
  io.to('admin').emit('rider:location', { riderId, lat, lng, ts: Date.now() });
}

/** Broadcast an arbitrary event to every connected admin socket. */
export function emitToAdmins(event: string, payload: Record<string, unknown>): void {
  if (!io) return;
  io.to('admin').emit(event, { ...payload, ts: Date.now() });
}

// ─── Redis-backed rider position store ────────────────────────────────────────
// Keys: `rider:pos:{riderId}` → JSON `{ lat, lng, ts }`, TTL 60s. Falls back to
// a process-local map when Redis is not configured (dev / tests).

const memoryPositions = new Map<string, { lat: number; lng: number; ts: number }>();

export async function storeRiderPosition(riderId: string, lat: number, lng: number): Promise<void> {
  const record = { lat, lng, ts: Date.now() };
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(`rider:pos:${riderId}`, JSON.stringify(record), 'EX', RIDER_GPS_TTL_SECONDS);
      return;
    } catch (err) {
      logger.warn(`[realtime] redis set failed, using memory fallback: ${(err as Error).message}`);
    }
  }
  memoryPositions.set(riderId, record);
}

export async function listActiveRiderPositions(): Promise<Array<{ riderId: string; lat: number; lng: number; ts: number }>> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const keys = await redis.keys('rider:pos:*');
      if (!keys.length) return [];
      const values = await redis.mget(keys);
      return keys
        .map((k, i) => {
          const v = values[i];
          if (!v) return null;
          try {
            const parsed = JSON.parse(v) as { lat: number; lng: number; ts: number };
            return { riderId: k.replace('rider:pos:', ''), ...parsed };
          } catch {
            return null;
          }
        })
        .filter((x): x is { riderId: string; lat: number; lng: number; ts: number } => x !== null);
    } catch (err) {
      logger.warn(`[realtime] redis keys failed, using memory fallback: ${(err as Error).message}`);
    }
  }
  // Prune memory-fallback entries older than the TTL.
  const cutoff = Date.now() - RIDER_GPS_TTL_SECONDS * 1000;
  const out: Array<{ riderId: string; lat: number; lng: number; ts: number }> = [];
  for (const [riderId, rec] of memoryPositions.entries()) {
    if (rec.ts < cutoff) {
      memoryPositions.delete(riderId);
      continue;
    }
    out.push({ riderId, ...rec });
  }
  return out;
}
